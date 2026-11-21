// @vitest-environment node
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeHostedGameFixture } from "./__fixtures__/hostedGame";
import { runHostedPregameGame, type HostedPregameDeps } from "./hostedGame";
import { DEFAULT_CAPTURE_BUDGET, HOSTED_V2_BUDGET, HOSTED_V2_TIMING, POLICY_ID } from "./policy";
import { supabaseCaptureRpc } from "./rpc";
import { latestDispatchAtOf } from "./slateQueue";
import { reverifyStoredWitness } from "./verifier";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fixture() {
  const context = makeHostedGameFixture();
  vi.spyOn(Date, "now").mockImplementation(() => context.clock.ms);
  const fetch = vi.fn(async () => { throw new Error("network_forbidden"); });
  vi.stubGlobal("fetch", fetch);
  return { ...context, fetch };
}

describe("hosted FORGE game adapter", () => {
  it("captures one exact game through the native runner and returns committed witness metadata only", async () => {
    const { request, deps, db, testTrust, world, fetch } = fixture();
    const writes = vi.fn();
    world.onWrite = writes;
    expect(await runHostedPregameGame(request, deps)).toEqual({
      claimId: "claim-1", outcome: "qualified", reason: null, stopTrigger: null,
    });
    expect(db.calls).toEqual(["claim", "save", "read", "read", "recordWitness", "recordOutcome"]);
    expect(db.claimFor(request.gameId, POLICY_ID)?.args).toMatchObject({
      scheduledStart: request.scheduledStart, codeVersion: request.codeVersion, requiredMs: DEFAULT_CAPTURE_BUDGET.requiredMs,
    });
    expect(writes).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    const row = (await db.rpc().read("claim-1"))!;
    expect(reverifyStoredWitness(row, testTrust).withinDeadline).toBe(true);
  });

  it("skips disabled or already late work before schedule or custody reads", async () => {
    const { request, deps, db, clock } = fixture();
    const readSchedule = vi.fn(deps.readSchedule);
    expect(await runHostedPregameGame(request, { ...deps, env: {}, readSchedule })).toMatchObject({
      outcome: "never_dispatched", claimId: null, reason: "capture_disabled",
    });
    clock.ms = latestDispatchAtOf({ ...request, status: "FUT" }, DEFAULT_CAPTURE_BUDGET) + 1;
    expect(await runHostedPregameGame(request, { ...deps, readSchedule })).toMatchObject({
      outcome: "never_dispatched", claimId: null, reason: "dispatch_window_closed",
    });
    expect(readSchedule).not.toHaveBeenCalled();
    expect(db.calls).toEqual([]);
  });

  it("rechecks the deadline after the bounded schedule query", async () => {
    const { request, deps, db, clock } = fixture();
    clock.ms = latestDispatchAtOf({ ...request, status: "FUT" }, DEFAULT_CAPTURE_BUDGET);
    const readSchedule: NonNullable<HostedPregameDeps["readSchedule"]> = async (...args) => {
      clock.advance(1);
      return deps.readSchedule(args[0], args[1], args[2]);
    };
    expect(await runHostedPregameGame(request, { ...deps, readSchedule })).toMatchObject({
      outcome: "never_dispatched", reason: "dispatch_window_closed",
    });
    expect(db.calls).toEqual([]);
  });

  it("refuses a moved current start and denies status changes during the strict pin", async () => {
    const { request, deps, db, world } = fixture();
    const moved = new Date(Date.parse(request.scheduledStart) - 60_000).toISOString();
    const readBeforeRefusal = vi.fn(deps.readSchedule);
    expect(await runHostedPregameGame({ ...request, safeStart: moved }, { ...deps, readSchedule: readBeforeRefusal })).toMatchObject({
      outcome: "never_dispatched", reason: "schedule_changed",
    });
    expect(readBeforeRefusal).not.toHaveBeenCalled();
    const readSchedule: NonNullable<HostedPregameDeps["readSchedule"]> = async (url, key, target) => {
      const [current] = await deps.readSchedule(url, key, target);
      return [{ ...current, currentScheduledStart: moved }];
    };
    expect(await runHostedPregameGame(request, { ...deps, readSchedule })).toMatchObject({
      outcome: "never_dispatched", reason: "schedule_changed",
    });
    const runCapture: NonNullable<HostedPregameDeps["runCapture"]> = (config, target) => {
      for (const row of world.tables.roster_optimizer_team_games) {
        if (row.source_game_id === request.gameId) row.game_status = "LIVE";
      }
      return deps.runCapture(config, target);
    };
    expect(await runHostedPregameGame(request, { ...deps, runCapture })).toMatchObject({
      outcome: "never_dispatched", reason: "schedule_changed",
    });
    expect(db.calls).toEqual([]);
  });

  it("uses the SDK's exact-game read-only schedule queries with the hosted abort signal", async () => {
    const { request, deps, db } = fixture();
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://fixture.invalid");
      expect(init?.method).toBe("GET");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      seen.push(url.pathname);
      if (url.pathname === "/rest/v1/games") {
        expect(url.searchParams.get("id")).toBe(`in.(${request.gameId})`);
        return Response.json([{ id: request.gameId, date: request.slateDate, seasonId: 20262027, startTime: request.scheduledStart }]);
      }
      expect(url.pathname).toBe("/rest/v1/roster_optimizer_team_games");
      expect(url.searchParams.get("source_game_id")).toBe(`in.(${request.gameId})`);
      expect(url.searchParams.get("source_season_id")).toBe("eq.20262027");
      return Response.json([1, 2].map((team_id) => ({
        source_game_id: request.gameId, team_id, start_time: request.scheduledStart, game_status: "LIVE", schedule_status: "OK",
      })));
    });
    expect(await runHostedPregameGame(request, { ...deps, readSchedule: undefined })).toMatchObject({
      outcome: "never_dispatched", reason: "game_no_longer_pregame",
    });
    expect(seen).toEqual(["/rest/v1/games", "/rest/v1/roster_optimizer_team_games"]);
    expect(db.calls).toEqual([]);
  });

  it("bounds the committed read's actual SDK fetch and does not repeat it after cancellation", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      const signal = init?.signal;
      expect(signal).toBeInstanceOf(AbortSignal);
      return new Promise((_resolve, reject) => {
        signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
      });
    });
    const client = createClient("https://fixture.invalid", "synthetic-key", { global: { fetch } });
    await expect(supabaseCaptureRpc(client, 5).read("claim-1")).rejects.toThrow("TimeoutError");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refuses a different singleton or insufficient time after cold delivery before schedule or custody", async () => {
    const { request, deps, clock, db } = fixture();
    const readSchedule = vi.fn(deps.readSchedule);
    const env = { ...deps.env, START_CHART_GAME_REVISIONS: "true", STARTER_BOARD_CANARY_GAME_IDS: String(request.gameId + 1) };
    const hostedV2 = { dispatchId: "fixture", workDeadlineMs: clock.ms + HOSTED_V2_TIMING.workMs };
    expect(await runHostedPregameGame({ ...request, hostedV2 }, { ...deps, env, readSchedule })).toMatchObject({ reason: "capture_disabled" });
    env.STARTER_BOARD_CANARY_GAME_IDS = String(request.gameId);
    clock.advance(HOSTED_V2_TIMING.workMs - HOSTED_V2_BUDGET.pinMs - HOSTED_V2_BUDGET.rpcMs - HOSTED_V2_BUDGET.requiredMs + 1);
    expect(await runHostedPregameGame({ ...request, hostedV2 }, { ...deps, env, readSchedule })).toMatchObject({ reason: "dispatch_window_closed" });
    expect(readSchedule).not.toHaveBeenCalled();
    expect(db.calls).toEqual([]);
  });

  it("cancels a pending native pin at its actual HTTP transport and never opens a claim", async () => {
    const { request, deps, clock } = fixture();
    const controller = new AbortController();
    const paths: string[] = [];
    let aborts = 0;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      paths.push(new URL(String(input)).pathname);
      const signal = init?.signal;
      expect(signal).toBeInstanceOf(AbortSignal);
      return new Promise((_resolve, reject) => {
        signal!.addEventListener("abort", () => { aborts++; reject(signal!.reason); }, { once: true });
        queueMicrotask(() => controller.abort());
      });
    });
    const hostedV2 = { dispatchId: "fixture", workDeadlineMs: clock.ms + HOSTED_V2_TIMING.workMs };
    const env = { ...deps.env, START_CHART_GAME_REVISIONS: "true", STARTER_BOARD_CANARY_GAME_IDS: String(request.gameId) };
    expect(await runHostedPregameGame({ ...request, hostedV2 }, {
      ...deps, env, signal: controller.signal, runCapture: undefined,
    })).toMatchObject({ claimId: null, outcome: "never_dispatched", reason: "pin_failed" });
    expect(aborts).toBeGreaterThan(0);
    expect(paths).toHaveLength(aborts);
    expect(paths.every(path => path.startsWith("/rest/v1/") && !path.includes("/rpc/"))).toBe(true);
  });

  it("returns an unresolved claim when its response is lost", async () => {
    const { request, deps, db } = fixture();
    db.hooks.afterClaimCommit = () => { throw new Error("connection lost: do not emit private diagnostics"); };
    expect(await runHostedPregameGame(request, deps)).toEqual({
      claimId: "claim-1", outcome: null, reason: "capture_unconfirmed", stopTrigger: "ambiguous_game",
    });
    expect(db.calls).toEqual(["claim", "lookup"]);
    expect(db.claims.size).toBe(1);
    expect(db.outcomes.size).toBe(0);
  });

  it("returns a stored source failure and its statement-timeout stop together", async () => {
    const { request, deps, db } = fixture();
    const runCapture: NonNullable<HostedPregameDeps["runCapture"]> = (config, target) => deps.runCapture({
      ...config, collectNative: async () => { throw new Error("canceling statement due to statement timeout: private detail"); },
    }, target);
    expect(await runHostedPregameGame(request, { ...deps, runCapture })).toEqual({
      claimId: "claim-1", outcome: "source_failed", reason: "statement_timeout", stopTrigger: "statement_timeout",
    });
    expect(db.calls).toEqual(["claim", "recordOutcome"]);
  });

  it("fences an ambiguous save without retrying the save", async () => {
    const { request, deps, db } = fixture();
    db.hooks.beforeSave = () => { throw new Error("fetch failed"); };
    expect(await runHostedPregameGame(request, deps)).toEqual({
      claimId: "claim-1", outcome: "save_unknown", reason: "save_unknown", stopTrigger: "save_unknown",
    });
    expect(db.calls).toEqual(["claim", "save", "settle", "recordOutcome"]);
    expect(db.fences.has("claim-1")).toBe(true);
  });
});
