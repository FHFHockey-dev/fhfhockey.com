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
import { DEFAULT_CAPTURE_BUDGET, HOSTED_V2_BUDGET, HOSTED_V2_TIMING, PILOT_TRANSPORT_LIMITS } from "lib/projections/pregameCapture/policy";
import { mintTimeStampResponse } from "lib/projections/pregameCapture/__fixtures__/testTsa";
import { createWorldClient } from "lib/projections/pregameCapture/__fixtures__/world/store";
import route, { config } from "pages/api/v1/db/forge-pregame-capture";

import routeV2, { config as configV2 } from "pages/api/v1/db/forge-pregame-capture-v2";

const { rpc, runGame } = vi.hoisted(() => ({ rpc: vi.fn(), runGame: vi.fn() }));
vi.mock("lib/supabase/server", async importOriginal => ({
  ...await importOriginal<typeof import("lib/supabase/server")>(), getServiceRoleClient: () => ({ rpc }),
}));
vi.mock("lib/projections/pregameCapture/hostedGame", async importOriginal => ({
  ...await importOriginal<typeof import("lib/projections/pregameCapture/hostedGame")>(), runHostedPregameGame: runGame,
}));

const secret = "offline-test-dispatch-signing-key";
const dispatchId = "550e8400-e29b-41d4-a716-446655440000";
const signature = createHmac("sha256", secret).update(dispatchId).digest("hex");
const signatureV2 = createHmac("sha256", secret).update(`capture-v2:${dispatchId}`).digest("hex");
const sha = "0123456789abcdef0123456789abcdef01234567";
const job = { status: "started", game_id: 2026020332, policy_id: "pregame-native-v1", slate_date: "2026-11-17",
  scheduled_start: "2026-11-18T00:00:00Z", current_scheduled_start: "2026-11-18T00:00:00Z", outcome: null };

function reply(data: unknown, error: unknown = null) {
  return { abortSignal: (signal: AbortSignal) => {
    expect(signal.aborted).toBe(false);
    return { single: async () => ({ data, error }) };
  } };
}
function call(body: unknown = { dispatchId }, signed = signature, method = "POST", handler = route) {
  const response = { setHeader: vi.fn(), code: 0, body: {} as unknown,
    status(code: number) { this.code = code; return this; }, json(value: unknown) { this.body = value; } };
  return handler({ method, headers: { "x-forge-dispatch-signature": signed }, body } as never, response as never).then(() => response);
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

  it.each(["pin_mismatch", "schedule_changed", "load_gate_closed", "window_missed", "custody_exists", "compute_off", "wrong_game_scope"])(
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

  it("separates signed route versions and refuses closed or unbounded compute before begin", async () => {
    vi.stubEnv("START_CHART_GAME_REVISIONS", "true");
    vi.stubEnv("STARTER_BOARD_CANARY_GAME_IDS", String(job.game_id));
    expect((await call({ dispatchId }, signature, "POST", routeV2)).code).toBe(401);
    expect((await call({ dispatchId }, signatureV2)).code).toBe(401);
    for (const [key, value] of [
      ["STARTER_BOARD_COMPUTE_ENABLED", "false"], ["STARTER_BOARD_CAPTURE_ENABLED", "false"],
      ["STARTER_BOARD_CANARY_GAME_IDS", ""], ["STARTER_BOARD_CANARY_GAME_IDS", undefined],
      ["STARTER_BOARD_CANARY_GAME_IDS", "1,2"], ["STARTER_BOARD_CANARY_GAME_IDS", "bogus"],
    ] as const) {
      vi.stubEnv(key, value);
      expect(await call({ dispatchId }, signatureV2, "POST", routeV2)).toMatchObject({ code: 503, body: { status: "compute_scope_disabled" } });
      vi.stubEnv(key, key === "STARTER_BOARD_CANARY_GAME_IDS" ? String(job.game_id) : "true");
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(runGame).not.toHaveBeenCalled();
  });

  it("binds effective compute to begin, pins the four-minute limit and includes queue time in its work deadline", async () => {
    const { request, deps, clock, db, testTrust } = makeHostedGameFixture();
    vi.spyOn(Date, "now").mockImplementation(() => clock.ms);
    vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "true");
    vi.stubEnv("STARTER_BOARD_COMPUTE_ENABLED", "true");
    vi.stubEnv("STARTER_BOARD_CANARY_GAME_IDS", String(request.gameId));
    const enteredAt = clock.ms;
    const queuedAt = enteredAt - 10_000;
    const actual = await vi.importActual<typeof import("lib/projections/pregameCapture/hostedGame")>("lib/projections/pregameCapture/hostedGame");
    runGame.mockImplementation((input, routeDeps) => actual.runHostedPregameGame(input, {
      ...deps, ...routeDeps, env: { ...deps.env, STARTER_BOARD_CAPTURE_ENABLED: "true", STARTER_BOARD_COMPUTE_ENABLED: "true",
        STARTER_BOARD_CANARY_GAME_IDS: String(request.gameId) },
    }));
    rpc.mockReturnValueOnce(reply({ status: "disabled", outcome: null }))
      .mockReturnValueOnce(reply({ ...job, game_id: request.gameId, slate_date: request.slateDate,
        scheduled_start: request.scheduledStart, current_scheduled_start: request.scheduledStart,
        queued_at: new Date(queuedAt).toISOString(), db_now: new Date(enteredAt).toISOString() }))
      .mockReturnValueOnce(reply({ status: "finished", outcome: "qualified" }));
    expect(await call({ dispatchId }, signatureV2, "POST", routeV2)).toMatchObject({ code: 409 });
    expect(runGame).not.toHaveBeenCalled();
    expect(await call({ dispatchId }, signatureV2, "POST", routeV2)).toMatchObject({ code: 200, body: { outcome: "qualified" } });
    expect(rpc.mock.calls[0]).toEqual(["forge_pregame_hosted_begin_v2", {
      p_dispatch_id: dispatchId, p_code_version: sha, p_compute_enabled: true, p_compute_game_id: request.gameId,
    }]);
    expect(runGame.mock.calls[0][0].hostedV2).toEqual({ dispatchId, workDeadlineMs: queuedAt + HOSTED_V2_TIMING.workMs });
    expect(runGame.mock.calls[0][1].signal.aborted).toBe(true);
    expect(db.claimFor(request.gameId, "pregame-native-v1")?.args.requiredMs).toBe(HOSTED_V2_BUDGET.requiredMs);
    expect(reverifyStoredWitness((await db.rpc().read("claim-1"))!, testTrust).withinDeadline).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(configV2.maxDuration * 1000).toBe(HOSTED_V2_TIMING.platformMs);
    const deployment = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(deployment.functions["pages/api/**/*.ts"].maxDuration).toBe(configV2.maxDuration);
  });

  it("withholds a finish once the absolute receipt budget is exhausted", async () => {
    const queuedAt = Date.now();
    let now = queuedAt;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.stubEnv("START_CHART_GAME_REVISIONS", "true");
    vi.stubEnv("STARTER_BOARD_CANARY_GAME_IDS", String(job.game_id));
    rpc.mockReturnValueOnce(reply({ ...job, queued_at: new Date(now).toISOString(), db_now: new Date(now).toISOString() }));
    runGame.mockImplementation(async () => {
      now = queuedAt + HOSTED_V2_TIMING.finishMs;
      return { outcome: "qualified", reason: null, stopTrigger: null, claimId: "claim-1" };
    });
    expect(await call({ dispatchId }, signatureV2, "POST", routeV2)).toMatchObject({ code: 503, body: { status: "finish_unconfirmed" } });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.skipIf(!process.env.FORGE_TEST_PG_SOCKET)("qualifies the scheduled game in disposable PostgreSQL and reads its saved packet independently", async () => {
    const host = process.env.FORGE_TEST_PG_SOCKET!;
    const v2 = process.env.FORGE_TEST_HOSTED_V2 === "1";
    if (v2) {
      vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "true");
      vi.stubEnv("STARTER_BOARD_COMPUTE_ENABLED", "true");
      vi.stubEnv("STARTER_BOARD_CANARY_GAME_IDS", "2026020250");
    }
    if (!isAbsolute(host) || !/^(forge-hosted-pg-|forge-pub-)/.test(basename(host))) throw new Error("disposable test socket required");
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
          if (!/^forge_pregame_(hosted|capture)_[a-z_]+_v1$/.test(name) && !(v2 && /^forge_pregame_hosted_(begin|claim)_v2$/.test(name))) throw new Error("unexpected fixture request");
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
      const writeSdk = sdk(writer), readRpc = supabaseCaptureRpc(sdk(reader));
      rpc.mockImplementation(writeSdk.rpc.bind(writeSdk));
      const actual = await vi.importActual<typeof import("lib/projections/pregameCapture/hostedGame")>("lib/projections/pregameCapture/hostedGame");
      const { deps, world, testTrust } = makeHostedGameFixture();
      runGame.mockImplementation((input: HostedPregameRequest, routeDeps) => {
        const game = world.tables.games.find(row => row.id === input.gameId)!;
        Object.assign(game, { date: input.slateDate, startTime: input.scheduledStart });
        for (const team of world.tables.roster_optimizer_team_games) team.start_time = input.scheduledStart;
        return actual.runHostedPregameGame(input, { ...deps, ...routeDeps, env: { ...process.env, ...deps.env }, now: Date.now,
          runCapture: (cfg, request) => runPregameCapture(captureDeps({
            writer: supabaseCaptureRpc(writeSdk, undefined, cfg.hostedDispatchId), verifier: readRpc, trust: testTrust, now: Date.now,
            tsa: { stamp: async query => mintTimeStampResponse(query, { genTimeMicros: BigInt(Date.now()) * BigInt(1000) }) },
            restBaseUrl: "https://fixture.invalid/rest/v1", createReadClient: () => createWorldClient(world),
            collectNative: cfg.collectNative, seasonBootstrap: cfg.seasonBootstrap, modelEnvironment: cfg.modelEnvironment,
            budget: { ...DEFAULT_CAPTURE_BUDGET, ...cfg.budget }, transportLimits: PILOT_TRANSPORT_LIMITS,
          }), request),
        });
      });
      const signed = headers["X-Forge-Dispatch-Signature"];
      expect(await call(body, signed, "POST", v2 ? routeV2 : route)).toMatchObject({ code: 200, body: { status: "finished", outcome: "qualified" } });
      expect(await call(body, signed, "POST", v2 ? routeV2 : route)).toMatchObject({ code: 200, body: { status: "duplicate", outcome: "qualified" } });
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
