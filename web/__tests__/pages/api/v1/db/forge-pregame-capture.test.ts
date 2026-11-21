// @vitest-environment node
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, basename } from "node:path";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeHostedGameFixture } from "lib/projections/pregameCapture/__fixtures__/hostedGame";
import type { HostedPregameRequest } from "lib/projections/pregameCapture/hostedGame";
import { reverifyStoredWitness } from "lib/projections/pregameCapture/verifier";
import { supabaseCaptureRpc } from "lib/projections/pregameCapture/rpc";
import { captureDeps } from "lib/projections/pregameCapture/runner";
import { runPregameCapture } from "lib/projections/pregameCapture/custody";
import { DEFAULT_CAPTURE_BUDGET, PILOT_TRANSPORT_LIMITS } from "lib/projections/pregameCapture/policy";
import { mintTimeStampResponse } from "lib/projections/pregameCapture/__fixtures__/testTsa";
import { createWorldClient } from "lib/projections/pregameCapture/__fixtures__/world/store";
import route, { config } from "pages/api/v1/db/forge-pregame-capture";

const { rpc, runGame } = vi.hoisted(() => ({ rpc: vi.fn(), runGame: vi.fn() }));
vi.mock("lib/supabase/server", async importOriginal => ({
  ...await importOriginal<typeof import("lib/supabase/server")>(), getServiceRoleClient: () => ({ rpc }),
}));
vi.mock("lib/projections/pregameCapture/hostedGame", () => ({ runHostedPregameGame: runGame }));

const secret = "offline-test-dispatch-signing-key";
const dispatchId = "550e8400-e29b-41d4-a716-446655440000";
const signature = createHmac("sha256", secret).update(dispatchId).digest("hex");
const sha = "0123456789abcdef0123456789abcdef01234567";
const job = { status: "started", game_id: 2026020332, policy_id: "pregame-native-v1", slate_date: "2026-11-17",
  scheduled_start: "2026-11-18T00:00:00Z", current_scheduled_start: "2026-11-18T00:00:00Z", outcome: null };

function reply(data: unknown, error: unknown = null) {
  return { abortSignal: (signal: AbortSignal) => {
    expect(signal.aborted).toBe(false);
    return { single: async () => ({ data, error }) };
  } };
}
function call(body: unknown = { dispatchId }, signed = signature, method = "POST") {
  const response = { setHeader: vi.fn(), code: 0, body: {} as unknown,
    status(code: number) { this.code = code; return this; }, json(value: unknown) { this.body = value; } };
  return route({ method, headers: { "x-forge-dispatch-signature": signed }, body } as never, response as never).then(() => response);
}

describe("scheduled private FORGE capture endpoint", () => {
  beforeEach(() => {
    rpc.mockReset();
    runGame.mockReset();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", sha);
    vi.stubEnv("FORGE_PREGAME_DISPATCH_SECRET", secret);
    vi.stubEnv("FORGE_PREGAME_CAPTURE_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("external request in offline test"); }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("saves and re-verifies one game through the normal route, then serves its existing outcome on duplicate delivery", async () => {
    const { request, deps, clock, db, testTrust } = makeHostedGameFixture();
    vi.spyOn(Date, "now").mockImplementation(() => clock.ms);
    const actual = await vi.importActual<typeof import("lib/projections/pregameCapture/hostedGame")>("lib/projections/pregameCapture/hostedGame");
    runGame.mockImplementation((input: HostedPregameRequest) => actual.runHostedPregameGame(input, deps));
    rpc.mockReturnValueOnce(reply({ ...job, game_id: request.gameId, slate_date: request.slateDate, scheduled_start: request.scheduledStart,
      current_scheduled_start: request.scheduledStart })).mockReturnValueOnce(reply({ status: "finished", outcome: "qualified" }))
      .mockReturnValueOnce(reply({ status: "duplicate", outcome: "qualified" }));

    const first = await call();
    expect(rpc.mock.calls[1]).toEqual(["forge_pregame_hosted_finish_v1",
      { p_dispatch_id: dispatchId, p_code_version: sha, p_outcome: "qualified", p_reason: null, p_stop_trigger: null }]);
    expect([...db.outcomes.values()][0].outcome).toBe("qualified");
    expect(first).toMatchObject({ code: 200, body: { status: "finished", outcome: "qualified", reason: null } });
    expect(first.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(rpc.mock.calls[0]).toEqual(["forge_pregame_hosted_begin_v1", { p_dispatch_id: dispatchId, p_code_version: sha }]);
    expect(await call()).toMatchObject({ code: 200, body: { status: "duplicate", outcome: "qualified" } });
    expect(runGame).toHaveBeenCalledTimes(1);
    expect([db.claims.size, db.artifacts.size, db.witnesses.size]).toEqual([1, 1, 1]);
    const readback = await db.rpc().read([...db.claims.keys()][0]);
    expect(reverifyStoredWitness(readback!, testTrust).withinDeadline).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts only a signed, single dispatch UUID in production with the private capture gate open", async () => {
    expect((await call({ dispatchId }, signature, "GET")).code).toBe(405);
    expect((await call({ dispatchId, gameId: 1 })).code).toBe(400);
    expect((await call({ dispatchId }, "0".repeat(64))).code).toBe(401);
    expect((await call({ dispatchId: dispatchId.replace(/0$/, "1") })).code).toBe(401);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await call()).code).toBe(503);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("FORGE_PREGAME_CAPTURE_ENABLED", "");
    expect((await call()).code).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
    expect(runGame).not.toHaveBeenCalled();
  });

  it.each(["pin_mismatch", "schedule_changed", "load_gate_closed", "window_missed", "custody_exists"])(
    "does not run after database refusal %s", async status => {
      rpc.mockReturnValueOnce(reply({ status, outcome: null }));
      expect(await call()).toMatchObject({ code: 409, body: { status } });
      expect(runGame).not.toHaveBeenCalled();
      expect(rpc).toHaveBeenCalledTimes(1);
    });

  it("preserves a confirmed source failure and its separate shared-stop reason", async () => {
    rpc.mockReturnValueOnce(reply(job)).mockReturnValueOnce(reply({ status: "finished", outcome: "source_failed" }));
    runGame.mockResolvedValue({ claimId: "fixture", outcome: "source_failed", reason: "statement_timeout", stopTrigger: "statement_timeout" });
    expect(await call()).toMatchObject({ code: 503, body: { status: "finished", outcome: "source_failed", reason: "statement_timeout" } });
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_outcome: "source_failed", p_stop_trigger: "statement_timeout" });
  });

  it("distinguishes previously qualified custody from an expired delivery whose outcome is unknown", async () => {
    rpc.mockReturnValueOnce(reply({ status: "custody_exists", outcome: "qualified" }))
      .mockReturnValueOnce(reply({ status: "window_missed", outcome: "unresolved" }));
    expect(await call()).toMatchObject({ code: 200, body: { status: "custody_exists", outcome: "qualified" } });
    expect(await call()).toMatchObject({ code: 503, body: { status: "window_missed", outcome: "unresolved" } });
    expect(runGame).not.toHaveBeenCalled();
  });

  it("fences an interrupted capture and withholds success if the finish acknowledgment is lost", async () => {
    rpc.mockReturnValueOnce(reply(job)).mockReturnValueOnce(reply(null, new Error("private detail")));
    runGame.mockRejectedValue(new Error("private detail"));
    expect(await call()).toMatchObject({ code: 503, body: { status: "finish_unconfirmed" } });
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_outcome: "unresolved", p_stop_trigger: "ambiguous_game" });
    expect(runGame).toHaveBeenCalledTimes(1);
  });

  it("gives the private route its time budget without registering a second scheduler", () => {
    const deployment = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(config.maxDuration).toBe(420);
    expect(deployment.functions["pages/api/v1/db/forge-pregame-capture.ts"].maxDuration).toBe(config.maxDuration);
    expect(deployment.crons.map((cron: { path: string }) => cron.path)).not.toContain("/api/v1/db/forge-pregame-capture");
  });

  it.skipIf(!process.env.FORGE_TEST_PG_SOCKET)("qualifies the scheduled game in disposable PostgreSQL and reads its saved packet independently", async () => {
    const host = process.env.FORGE_TEST_PG_SOCKET!;
    if (!isAbsolute(host) || !basename(host).startsWith("forge-hosted-pg-")) throw new Error("disposable test socket required");
    const [body, headers] = JSON.parse(process.env.FORGE_TEST_REQUEST!);
    vi.stubEnv("FORGE_PREGAME_DISPATCH_SECRET", process.env.FORGE_TEST_SIGNER!);
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", process.env.FORGE_TEST_SHA!);
    const writer = new Client({ host, port: 5432, database: "postgres", user: "postgres" });
    const reader = new Client({ host, port: 5432, database: "postgres", user: "postgres" });
    await Promise.all([writer.connect(), reader.connect()]);
    try {
      await Promise.all([writer.query("set role service_role"), reader.query("set role service_role")]);
      // Emulate only the PostgREST HTTP envelope over the isolated socket. PostgreSQL executes
      // the real RPCs and serializes dates, bigints, hashes, packet and witness values to JSON.
      const sdk = (pg: Client) => createClient("https://fixture.invalid", "fixture-key", {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: async (url, init) => {
          const name = String(url).split("/rpc/")[1];
          if (!/^forge_pregame_(hosted|capture)_[a-z_]+_v1$/.test(name)) throw new Error("unexpected fixture request");
          const args = Object.entries(JSON.parse(String(init?.body)));
          const bindings = args.map(([key], i) => {
            if (!/^p_[a-z_0-9]+$/.test(key)) throw new Error("unexpected RPC parameter");
            return `${key} => $${i + 1}`;
          });
          const result = await pg.query(`select json_agg(t) as rows from public.${name}(${bindings.join(",")}) t`, args.map(([, value]) => value));
          const rows = result.rows[0].rows;
          const single = new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object");
          return Response.json(single ? rows[0] : rows);
        } },
      });
      const writeSdk = sdk(writer), writerRpc = supabaseCaptureRpc(writeSdk), readRpc = supabaseCaptureRpc(sdk(reader));
      rpc.mockImplementation(writeSdk.rpc.bind(writeSdk));
      const actual = await vi.importActual<typeof import("lib/projections/pregameCapture/hostedGame")>("lib/projections/pregameCapture/hostedGame");
      const { deps, world, testTrust } = makeHostedGameFixture();
      runGame.mockImplementation((input: HostedPregameRequest) => {
        const game = world.tables.games.find(row => row.id === input.gameId)!;
        Object.assign(game, { date: input.slateDate, startTime: input.scheduledStart });
        for (const team of world.tables.roster_optimizer_team_games) team.start_time = input.scheduledStart;
        return actual.runHostedPregameGame(input, { ...deps, now: Date.now,
          runCapture: (cfg, request) => runPregameCapture(captureDeps({
            writer: writerRpc, verifier: readRpc, trust: testTrust, now: Date.now,
            tsa: { stamp: async query => mintTimeStampResponse(query, { genTimeMicros: BigInt(Date.now()) * BigInt(1000) }) },
            restBaseUrl: "https://fixture.invalid/rest/v1", createReadClient: () => createWorldClient(world),
            collectNative: cfg.collectNative, seasonBootstrap: cfg.seasonBootstrap, modelEnvironment: cfg.modelEnvironment,
            budget: DEFAULT_CAPTURE_BUDGET, transportLimits: PILOT_TRANSPORT_LIMITS,
          }), request),
        });
      });
      const signed = headers["X-Forge-Dispatch-Signature"];
      expect(await call(body, signed)).toMatchObject({ code: 200, body: { status: "finished", outcome: "qualified" } });
      expect(await call(body, signed)).toMatchObject({ code: 200, body: { status: "duplicate", outcome: "qualified" } });
      expect(runGame).toHaveBeenCalledTimes(1);
      const stored = await readRpc.lookup(2026020250, "pregame-native-v1");
      expect(stored).toMatchObject({ artifactPresent: true, witnessVerdict: "qualified", outcome: "qualified" });
      const row = await readRpc.read(stored.claimId!);
      expect(reverifyStoredWitness(row!, testTrust).withinDeadline).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      await Promise.all([writer.end(), reader.end()]);
    }
  });
});
