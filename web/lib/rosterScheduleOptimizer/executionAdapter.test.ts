import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessageChannel } from "node:worker_threads";
const yahooAuth = vi.hoisted(() => ({ session: vi.fn(), onAuth: vi.fn() }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: yahooAuth.session, onAuthStateChange: yahooAuth.onAuth } } }));
import { requestRosterPlanning } from "../../hooks/rosterPlanningExecution";
import { executeRosterPlanning } from "./executionAdapter";
import { currentPlanningTime, planningMonotonicNow, withCurrentPlanningRead } from "./currentPlanningRead";
import * as policyModule from "../player-forecasts/rsoUsePolicy";
import * as candidates from "./candidatePlanMetrics";
import { defaultWorkspace } from "./workspace";
import { currentRsoUsePolicy, restrictRsoForecast } from "../player-forecasts/rsoUsePolicy";
import { expandBridgeForecasts, packPlanningSnapshots, unpackPlanningSnapshots } from "../rosterScheduleData/bridgeForecastWire";
import type { PlanningData, PlanningSnapshot } from "./planningTypes";

const now = "2026-10-22T12:00:00.000Z";
function fixture() {
  const workspace = defaultWorkspace(), revision = "forge-daily-bridge-v1:synthetic-run";
  const player = { id: "7", nhlId: 77, nhlTeamId: 1, rosterRevision: "roster-a", name: "Synthetic player",
    teamAbbreviation: "MIN", eligiblePositions: ["C"], playerClass: "skater" as const, eligibilityVerified: true,
    availability: "rostered" as const, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] };
  const game = { id: "30", date: "2026-10-23", startsAt: "2026-10-23T20:00:00Z", teamAbbreviation: "MIN",
    opponent: "TOR", home: true, status: "scheduled" as const, scheduleRevision: "schedule-a" };
  const wire = { version: "forge-daily-bridge-wire-v1", seasonId: 20262027, limitations: ["Synthetic approved bridge fixture"],
    runs: [[revision, revision, "forge-daily-bridge-v1:fixture", now, now]],
    rows: [["7", "30", 0, "2026-10-24T00:00:00Z", { GOALS: 2 }, null, false, null]] };
  const data: PlanningData = { players: [player], games: [game], forecasts: [], baselineSources: [], participationSources: [],
    evidence: { schedule: { source: "synthetic complete schedule", asOf: now, seasonId: 20262027, completeness: "complete", limitations: [] },
      forecasts: { source: "synthetic bridge", asOf: now, seasonId: 20262027, completeness: "complete", limitations: [] } },
    forecastManifest: { version: "planning-forecasts-v1", id: "current-read", seasonId: 20262027, asOf: now,
      scheduleRevision: "schedule-a", rosterRevision: "roster-a", issuedRevisionIds: [revision], baselineChecksum: null,
      requiredOpportunities: 1, forecastedOpportunities: 1, exclusionCounts: {},
      rsoUsePolicy: { version: "rso-target-use-v1", revision: currentRsoUsePolicy().revision, bridgeRevisionIds: [revision] } } };
  const forecasts = expandBridgeForecasts(wire, data);
  const snapshot: PlanningSnapshot = { id: "private-saved-work", context: { provider: "manual", seasonId: 20262027,
    leagueId: "private-league", teamId: "private-team", startDate: game.date, endDate: game.date, timeZone: "UTC", asOf: now },
    players: [player], games: [game], forecasts, roster: [{ playerId: "7", position: "active" }],
    rules: { ...workspace.rules, lineupMode: "daily", rosterSlots: { C: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "p", start: now, end: "2026-10-25T00:00:00Z", remaining: 2, source: "manager" }],
      scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] } },
    realized: { GOALS: 5 }, opponent: { roster: [], realized: { GOALS: 3 }, remaining: { GOALS: 1 } },
    lockedAssignments: [{ date: game.date, playerId: "7", slotId: "C#1", source: "manager" }],
    evidence: data.evidence, forecastManifest: data.forecastManifest };
  const body = { success: true, data, bridgeForecasts: wire };
  return { snapshot: structuredClone(snapshot), body, intent: workspace.intent };
}
function respond(body: unknown, readOverride?: unknown) {
  return { ok: true, json: async () => ({ ...structuredClone(body as object), read: readOverride === undefined ? {
    nonce: (vi.mocked(fetch).mock.lastCall?.[1]?.headers as Record<string, string>)["X-RSO-Read-Nonce"], evaluatedAt: now,
  } : readOverride }) } as Response;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("fresh RSO execution authority", () => {
  it.each([
    ["no mark", null, now],
    ["client-created starting mark", true, now],
    ["old serialized nonstarting mark", false, "2010-01-01T00:00:00Z"],
  ] as const)("preserves current server bridge values for a Yahoo snapshot with %s", async (_label, mark, observedAt) => {
    const { snapshot, body } = fixture();
    snapshot.context.provider = "yahoo";
    snapshot.players[0].playerClass = "goalie";
    snapshot.players[0].eligiblePositions = ["G"];
    body.data.players = snapshot.players.map(player => ({ ...player }));
    if (mark !== null) snapshot.players[0].startingStatus = {
      source: "yahoo", date: snapshot.games[0].date, isStarting: mark, observedAt,
    };
    body.bridgeForecasts.rows = [];
    body.data.forecasts = [{ ...snapshot.forecasts[0], stats: { SAVES_GOALIE: 7.5 },
      conditionalStats: { SAVES_GOALIE: 25 }, startProbability: 0.3, confirmedStart: false }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
    const result = await withCurrentPlanningRead(JSON.parse(JSON.stringify(snapshot)), {}, currentRsoUsePolicy().revision,
      new AbortController().signal, (_input, data, readError) => {
        expect(readError).toBeNull(); expect(data).not.toBeNull();
        const row = restrictRsoForecast(data!.forecasts[0], data!.forecastManifest, now);
        return { probability: row.startProbability, saves: row.stats.SAVES_GOALIE, totals: row.allowedUses?.totals };
      });
    expect(result).toEqual({ probability: 0.3, saves: 7.5, totals: true });
  });
  it("uses one current GET for planning, candidates and display, and ends authority before serialization", async () => {
    const { snapshot, body, intent } = fixture();
    const fetcher = vi.fn().mockResolvedValue(respond(body)); vi.stubGlobal("fetch", fetcher);
    const saved = JSON.stringify(snapshot), result = await executeRosterPlanning(snapshot, intent);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/v1/roster-schedule-optimizer/data?seasonId=20262027&startDate=2026-10-23&endDate=2026-10-23&timeZone=UTC");
    expect(init).toMatchObject({ method: "GET", cache: "no-store", credentials: "same-origin" });
    expect(url).not.toContain("private");
    expect(result.result.selected).toMatchObject({ legal: true, activeGames: 1, projectedValue: 7 });
    expect(result.displaySnapshot.forecasts[0].stats.GOALS).toBe(2);
    expect(JSON.stringify(snapshot)).toBe(saved);
    const transported = JSON.parse(JSON.stringify(result.displaySnapshot));
    expect(restrictRsoForecast(transported.forecasts[0], transported.forecastManifest, now).allowedUses?.totals).toBe(false);
  });
  it.each(["mean", "participation", "bridge_claim", "binding", "retained", "packed"])("replaces the entire %s saved forecast graph", async kind => {
    const { snapshot, body, intent } = fixture();
    snapshot.forecasts[0].stats.GOALS = 999;
    if (kind === "participation") { snapshot.forecasts[0].startProbability = 1; snapshot.forecasts[0].confirmedStart = true; }
    if (kind === "bridge_claim") snapshot.forecastManifest!.rsoUsePolicy!.bridgeRevisionIds.push("native-claimed");
    if (kind === "binding") snapshot.forecasts[0].rsoTargetBindings = { GOALS: { component: "claim", modelMode: "candidate",
      codeVersion: "fake", configurationHash: "a".repeat(64), artifactHash: "b".repeat(64), targetKey: "GOALS", horizonGames: 1,
      conditioning: "conditional_playing", participationLineage: "claim", cutoffAt: now } };
    if (kind === "retained") snapshot.forecasts[0].contributions = { GOALS: { inputs: { detailed: { mean: 999 } },
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true } } } as never;
    const saved = kind === "packed" ? unpackPlanningSnapshots(JSON.parse(JSON.stringify(packPlanningSnapshots(snapshot)))) : JSON.parse(JSON.stringify(snapshot));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
    const result = await executeRosterPlanning(saved, intent);
    expect(result.result.selected.projectedValue).toBe(7);
    expect(result.displaySnapshot.forecasts[0].stats.GOALS).toBe(2);
    expect(result.displaySnapshot.forecasts[0].startProbability).toBeNull();
  });
  it.each(["failure", "suspended", "old", "future", "season", "policy", "range", "oversize"])("preserves manager capacity without old numerical fallback on %s read", async kind => {
    const { snapshot, body, intent } = fixture();
    if (kind === "old") body.data.forecastManifest!.asOf = "2026-10-22T11:59:59Z";
    if (kind === "future") body.data.forecastManifest!.asOf = "2026-10-22T12:00:01Z";
    if (kind === "season") body.data.forecastManifest!.seasonId = 20252026;
    if (kind === "policy") body.data.forecastManifest!.rsoUsePolicy!.revision = "revoked-policy";
    if (kind === "range") body.data.games[0].date = "2026-10-24";
    if (kind === "oversize") body.bridgeForecasts.limitations.push("x".repeat(4_000_001));
    const fetcher = kind === "failure" ? vi.fn().mockRejectedValue(new Error("offline")) : vi.fn().mockResolvedValue(respond(body));
    vi.stubGlobal("fetch", fetcher);
    const result = await executeRosterPlanning(snapshot, intent, { allowRead: kind !== "suspended" });
    expect(result.data).toBeNull(); expect(result.displaySnapshot.forecasts).toEqual([]);
    expect(result.displaySnapshot.baselineSources).toEqual([]); expect(result.displaySnapshot.participationSources).toEqual([]);
    expect(result.result.selected).toMatchObject({ legal: true, activeGames: 1, projectedValue: null, comparisonEligible: false });
    expect(result.result.selected.assignments[0].locked).toBe(true);
    expect(result.displaySnapshot.realized).toEqual({ GOALS: 5 }); expect(result.displaySnapshot.opponent).toEqual(snapshot.opponent);
    expect(fetcher).toHaveBeenCalledTimes(kind === "suspended" ? 0 : 1);
  });
  it("does not relabel retained game identity to make fresh evidence fit", async () => {
    const { snapshot, body, intent } = fixture(); snapshot.games[0].scheduleRevision = "older-schedule";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
    const result = await executeRosterPlanning(snapshot, intent);
    expect(result.result.selected.projectedValue).toBeNull();
    expect(result.displaySnapshot.games[0].scheduleRevision).toBe("older-schedule");
  });
  it("rechecks revocation on the next generation with unchanged source counts", async () => {
    const { snapshot, body, intent } = fixture();
    const fetcher = vi.fn().mockResolvedValue(respond(body)); vi.stubGlobal("fetch", fetcher);
    expect((await executeRosterPlanning(snapshot, intent)).result.selected.projectedValue).toBe(7);
    body.data.forecastManifest!.rsoUsePolicy!.bridgeRevisionIds = [];
    fetcher.mockResolvedValue(respond(body));
    const revoked = await executeRosterPlanning(snapshot, intent);
    expect(revoked.result.selected.projectedValue).toBeNull();
    expect(revoked.displaySnapshot.forecasts[0].stats.GOALS).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("aborts obsolete reads and never publishes their result", async () => {
    const { snapshot, body, intent } = fixture(); let release!: (value: Response) => void;
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { release = resolve; })); vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const work = executeRosterPlanning(snapshot, intent, {}, {}, controller.signal);
    controller.abort(); release(respond(body));
    await expect(work).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("runs the actual worker through the same mocked GET boundary as fallback", async () => {
    const { snapshot, body, intent } = fixture(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
    const fallback = await executeRosterPlanning(snapshot, intent);
    const worker = { onmessage: null as ((event: { data: unknown }) => Promise<void>) | null, postMessage: vi.fn() };
    vi.stubGlobal("self", worker); await import("../../hooks/rosterPlanning.worker");
    await worker.onmessage!({ data: { snapshot: structuredClone(snapshot), intent, options: {}, candidateOptions: {} } });
    expect(worker.postMessage).toHaveBeenCalledWith(fallback);
  });
  it("coalesces the actual no-worker fallback and keeps public capacity after a later failure", async () => {
    const { snapshot, body, intent } = fixture(); vi.stubGlobal("Worker", undefined);
    const fetcher = vi.fn().mockResolvedValue(respond(body)); vi.stubGlobal("fetch", fetcher);
    const first = requestRosterPlanning(snapshot, intent, { publicContext: true });
    const second = requestRosterPlanning(snapshot, intent, { publicContext: true });
    const result = await first.promise;
    expect(await second.promise).toBe(result); expect(fetcher).toHaveBeenCalledOnce();
    expect(result.result.selected.projectedValue).toBe(7);
    first.release(); second.release();
    fetcher.mockRejectedValue(new Error("offline"));
    const empty = { ...snapshot, games: [], forecasts: [] };
    const next = requestRosterPlanning(empty, { ...intent, revision: intent.revision + 1 }, { publicContext: true }, [], result.displaySnapshot);
    const failed = await next.promise; next.release();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(failed.result.selected).toMatchObject({ activeGames: 1, projectedValue: null });
    expect(failed.displaySnapshot.forecasts).toEqual([]);
    expect(failed.displaySnapshot.lockedAssignments).toEqual(snapshot.lockedAssignments);
    expect(failed.displaySnapshot.realized).toEqual(snapshot.realized);
  });
  it("retains unknown provider ownership while applying the current stored-position receipt", async () => {
    const { snapshot, body, intent } = fixture(); snapshot.context.provider = "yahoo";
    snapshot.players[0].eligiblePositions = []; snapshot.players[0].eligibilityVerified = false;
    body.data.players[0].eligiblePositions = []; body.data.players[0].eligibilityVerified = false;
    snapshot.evidence.roster = { source: "retained", seasonId: 20262027, asOf: now, completeness: "partial", limitations: ["Verify provider"] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
    const result = await executeRosterPlanning(snapshot, intent, { publicContext: true, yahooEligibility: {
      seasonId: 20262027, source: "yahoo_players", scope: "Yahoo default positions", expiresAt: "2026-10-23T08:40:00.000Z",
      status: "ready", limitations: [], players: [{ playerId: "7", nhlId: 77, providerId: "yahoo-7", positions: ["C"],
        playerClass: "skater", asOf: now }] } });
    expect(result.displaySnapshot.players[0]).toMatchObject({ availability: "unknown", canDrop: null, reserveEligibility: [], eligiblePositions: ["C"], eligibilityVerified: true });
    expect(result.displaySnapshot.evidence.roster).toEqual(snapshot.evidence.roster);
  });

  it.each([false, true])("bootstraps public identity only for a matching manual player/team (mismatch %s)", async mismatch => {
    const { snapshot, body, intent } = fixture();
    delete snapshot.players[0].nhlTeamId; delete snapshot.players[0].rosterRevision;
    if (mismatch) snapshot.players[0].teamAbbreviation = "BOS";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
    const result = await executeRosterPlanning(snapshot, intent, { publicContext: true });
    expect(result.displaySnapshot.players[0].nhlTeamId).toBe(mismatch ? undefined : 1);
    expect(result.displaySnapshot.players[0].rosterRevision).toBe(mismatch ? undefined : "roster-a");
    // Complete calendar has no BOS opportunity: retain the five banked goals,
    // with zero future contribution rather than borrowing MIN's two goals.
    expect(result.result.selected.projectedValue).toBe(mismatch ? 5 : 7);
    expect(snapshot.players[0].rosterRevision).toBeUndefined();
  });

  it.each([-5000, 5000])("uses the server evaluation clock despite %sms browser skew", async skew => {
    const { snapshot, body, intent } = fixture();
    vi.setSystemTime(new Date(Date.parse(now) + skew)); snapshot.context.asOf = new Date().toISOString();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
    const result = await executeRosterPlanning(snapshot, intent);
    expect(result.readError).toBeNull(); expect(result.result.selected.projectedValue).toBe(7);
    expect(result.displaySnapshot.context.asOf).toBe(now);
    expect(snapshot.context.asOf).toBe(new Date(Date.parse(now) + skew).toISOString());
    const remaining = Date.parse("2026-10-24T00:00:00Z") - Date.parse(now);
    expect(result.expiresAt! - Date.now()).toBe(remaining);
    expect(result.expiresAtMonotonic! - planningMonotonicNow()).toBe(remaining);
  });
  it.each([null, { nonce: "old-generation", evaluatedAt: now }, { nonce: "missing-clock" }])("rejects an absent or mismatched current-read receipt %j", async read => {
    const { snapshot, body, intent } = fixture(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body, read)));
    expect((await executeRosterPlanning(snapshot, intent)).result.selected.projectedValue).toBeNull();
  });
  it("does not let a backward device-clock correction extend server authority", async () => {
    const { snapshot, body } = fixture();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
    await withCurrentPlanningRead(snapshot, {}, currentRsoUsePolicy().revision, new AbortController().signal, () => {
      expect(currentPlanningTime()).toBe(Date.parse(now));
      vi.setSystemTime(new Date(Date.parse(now) - 60_000));
      vi.spyOn(performance, "now").mockReturnValue(2000);
      expect(currentPlanningTime()).toBe(Date.parse(now) + 2000);
    });
  });
  it("rejects a response that arrives after the bounded current-read deadline", async () => {
    const { snapshot, body, intent } = fixture();
    vi.stubGlobal("fetch", vi.fn(async () => { vi.spyOn(performance, "now").mockReturnValue(20001); return respond(body); }));
    expect((await executeRosterPlanning(snapshot, intent)).result.selected.projectedValue).toBeNull();
  });
  it.each([-5000, 5000])("uses server time for positive review admission and clears all output when it expires during compute (skew %s)", async skew => {
    const { snapshot, body, intent } = fixture();
    vi.setSystemTime(new Date(Date.parse(now) + skew)); snapshot.context.asOf = new Date().toISOString();
    const binding = { component: "synthetic-only", modelMode: "baseline", codeVersion: "reviewed-test",
      configurationHash: "a".repeat(64), artifactHash: "b".repeat(64), targetKey: "GOALS", horizonGames: 1,
      conditioning: "conditional_playing", participationLineage: "fixture", cutoffAt: now };
    const { cutoffAt: _, ...scope } = binding;
    const policy = { ...currentRsoUsePolicy(), reviews: [{ id: "synthetic-positive", binding: scope,
      reviewedAt: "2026-10-21T00:00:00Z", expiresAt: "2026-10-22T12:00:01Z", inputCutoffFrom: now,
      inputCutoffUntil: "2026-10-23T00:00:00Z", allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
      prospectiveEvidenceRef: "fictional-evidence", ownerApprovalRef: "fictional-approval" }] };
    vi.spyOn(policyModule, "currentRsoUsePolicy").mockReturnValue(policy);
    body.data.forecasts = [{ ...snapshot.forecasts[0], revisionId: "native", modelVersion: binding.codeVersion,
      rsoTargetBindings: { GOALS: binding } }];
    body.data.forecastManifest!.issuedRevisionIds = ["native"]; body.data.forecastManifest!.rsoUsePolicy!.bridgeRevisionIds = [];
    body.bridgeForecasts.rows = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(body)));
    const before = await executeRosterPlanning(snapshot, intent);
    expect(before.result.selected.projectedValue).toBe(7);
    expect(before.expiresAtMonotonic! - planningMonotonicNow()).toBe(1000);
    const original = candidates.candidatePlanMetrics;
    vi.spyOn(candidates, "candidatePlanMetrics").mockImplementation((...args) => {
      const result = original(...args); vi.spyOn(performance, "now").mockReturnValue(2000); return result;
    });
    const expired = await executeRosterPlanning(snapshot, intent);
    expect(expired.result.selected.projectedValue).toBeNull();
    expect(expired.result.selected.forecastInputs).toEqual([]); expect(expired.displaySnapshot.forecasts).toEqual([]);
    expect(expired.expiresAt).toBeNull(); expect(expired.expiresAtMonotonic).toBeNull();
  });

  it("uses the server evaluation cutoff even when delivery takes longer than a future source timestamp", async () => {
    const { snapshot, body, intent } = fixture();
    body.bridgeForecasts.runs[0][3] = "2026-10-22T12:00:00.001Z";
    body.bridgeForecasts.runs[0][4] = "2026-10-22T12:00:00.001Z";
    vi.stubGlobal("fetch", vi.fn(async () => { vi.spyOn(performance, "now").mockReturnValue(2); return respond(body); }));
    const result = await executeRosterPlanning(snapshot, intent);
    expect(result.displaySnapshot.context.asOf).toBe(now);
    expect(result.result.selected.projectedValue).toBeNull();
  });
  it("counts delivery time toward source expiry and creates a new nonce for each generation", async () => {
    const { snapshot, body, intent } = fixture();
    body.bridgeForecasts.rows[0][3] = "2026-10-22T12:00:01Z";
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => { vi.spyOn(performance, "now").mockReturnValue(2000); return respond(body); });
    vi.stubGlobal("fetch", fetcher);
    const result = await executeRosterPlanning(snapshot, intent);
    expect(result.result.selected.projectedValue).toBeNull(); expect(result.displaySnapshot.forecasts).toEqual([]);
    await executeRosterPlanning(snapshot, intent);
    const nonces = fetcher.mock.calls.map(args => (args[1] as RequestInit).headers as Record<string, string>);
    expect(nonces[0]["X-RSO-Read-Nonce"]).not.toBe(nonces[1]["X-RSO-Read-Nonce"]);
  });

});

describe("authenticated Yahoo generation through the real adapter", () => {
  function privateFixture(probability = 1) {
    const f = fixture(); f.snapshot.context.provider = "yahoo";
    f.snapshot.players[0].playerClass = "goalie"; f.snapshot.players[0].eligiblePositions = ["G"];
    f.snapshot.players[0].startingStatus = { source: "yahoo", date: f.snapshot.context.startDate, isStarting: probability === 0, observedAt: "2010-01-01T00:00:00Z" };
    f.body.data.players = structuredClone(f.snapshot.players); delete f.body.data.players[0].startingStatus;
    f.snapshot.rules.rosterSlots = { G: 1 }; f.snapshot.rules.scoring = { mode: "points", weights: { SAVES_GOALIE: 1 }, categories: [] };
    f.snapshot.realized = {}; f.snapshot.opponent = null; f.snapshot.lockedAssignments = [];
    f.body.bridgeForecasts.rows = [];
    f.body.data.forecasts = [{ ...f.snapshot.forecasts[0], stats: { SAVES_GOALIE: 25 * probability },
      conditionalStats: { SAVES_GOALIE: 25 }, startProbability: probability, confirmedStart: probability === 1 }];
    vi.stubGlobal("MessageChannel", MessageChannel); vi.stubGlobal("Worker", undefined);
    yahooAuth.session.mockResolvedValue({ data: { session: { access_token: "synthetic-only", user: { id: "owner" } } } });
    yahooAuth.onAuth.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    const reply = (init: RequestInit) => ({ ...structuredClone(f.body), read: { ...JSON.parse(init.body as string),
      principalId: "owner", evaluatedAt: now, expiresAt: "2026-10-22T12:02:00Z" } });
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => ({ ok: true, json: async () => reply(init!) } as Response));
    vi.stubGlobal("fetch", fetcher);
    return { ...f, fetcher, reply, options: { yahooPrincipalId: "owner" } };
  }
  it.each([1, 0, .3])("uses verified current probability %s through both actual worker and no-worker fallback, ignoring contradictory saved labels", async probability => {
    const f = privateFixture(probability);
    const fallback = requestRosterPlanning(f.snapshot, f.intent, f.options);
    const same = requestRosterPlanning(f.snapshot, f.intent, f.options);
    const result = await fallback.promise;
    expect(await same.promise).toBe(result); expect(f.fetcher).toHaveBeenCalledOnce();
    expect(result.result.selected.projectedValue).toBe(25 * probability);
    expect(result.displaySnapshot.forecasts[0]).toMatchObject({ startProbability: probability,
      confirmedStart: probability === 1, stats: { SAVES_GOALIE: 25 * probability }, conditionalStats: { SAVES_GOALIE: 25 } });
    expect(result.expiresAtMonotonic! - planningMonotonicNow()).toBe(120000);
    // The two-minute Yahoo window, not a public input, ends this plan (a public-only stand-in may follow it).
    expect(result.privateLapsesFirst).toBe(true);
    expect(JSON.stringify(result)).not.toContain("synthetic-only");
    fallback.release(); same.release();
    const { runWorkerRequest } = await import("../../hooks/rosterPlanning.worker");
    let instance: { onmessage: ((event: { data: unknown }) => void) | null };
    const outgoing = vi.fn((data: unknown) => instance.onmessage?.({ data }));
    vi.stubGlobal("self", { postMessage: outgoing });
    class WorkerHarness {
      onmessage = null as ((event: { data: unknown }) => void) | null;
      onerror = null; terminate() {}
      constructor() { instance = this; }
      postMessage(data: Parameters<typeof runWorkerRequest>[0]["data"], ports: MessagePort[]) {
        void runWorkerRequest(new MessageEvent("message", { data, ports }));
      }
    }
    // Vite rewrites the worker URL to an origin-relative development URL. The
    // in-process harness has no worker document; resolve that URL locally only.
    const BrowserURL = URL;
    vi.stubGlobal("URL", class extends BrowserURL { constructor(url: string | URL, base?: string | URL) { super(url, base ?? "http://localhost"); } });
    vi.stubGlobal("Worker", WorkerHarness);
    const worker = requestRosterPlanning(f.snapshot, f.intent, f.options);
    const worked = await worker.promise; worker.release();
    expect(worked.result.selected.projectedValue).toBe(result.result.selected.projectedValue);
    expect(worked.displaySnapshot).toEqual(result.displaySnapshot); expect(f.fetcher).toHaveBeenCalledTimes(2);
    expect(outgoing).toHaveBeenCalledOnce();
    expect(restrictRsoForecast(JSON.parse(JSON.stringify(worked.displaySnapshot.forecasts[0])), worked.displaySnapshot.forecastManifest, now).allowedUses?.totals).toBe(false);
  });
  it.each(["principal", "team", "league", "season", "range", "nonce", "expired", "failure", "revoked"])("withdraws numeric forecasts for %s private receipts without public or old-provider fallback", async kind => {
    const f = privateFixture();
    f.fetcher.mockImplementation(async (_url, init) => {
      const body = f.reply(init!);
      if (kind === "principal") body.read.principalId = "other";
      if (kind === "team") body.read.teamId = "other";
      if (kind === "league") body.read.leagueId = "other";
      if (kind === "season") body.read.seasonId = 20252026;
      if (kind === "range") body.read.startDate = "2026-10-24";
      if (kind === "nonce") body.read.nonce = "replayed";
      if (kind === "expired") body.read.expiresAt = now;
      if (kind === "revoked") body.data.forecastManifest!.rsoUsePolicy!.revision = "revoked";
      return { ok: kind !== "failure", json: async () => body } as Response;
    });
    const request = requestRosterPlanning(f.snapshot, f.intent, f.options), result = await request.promise; request.release();
    expect(result.result.selected.projectedValue).toBeNull(); expect(result.displaySnapshot.forecasts).toEqual([]);
    expect(result.displaySnapshot.rules).toEqual(f.snapshot.rules); expect(result.displaySnapshot.roster).toEqual(f.snapshot.roster);
    expect(result.privateLapsesFirst).toBe(false);
    expect(f.fetcher).toHaveBeenCalledOnce();
  });
  it("reports a public input, not the Yahoo window, when a forecast expires first", async () => {
    const f = privateFixture();
    f.body.data.forecasts[0].expiresAt = "2026-10-22T12:01:00Z";
    const request = requestRosterPlanning(f.snapshot, f.intent, f.options), result = await request.promise; request.release();
    expect(result.expiresAt).not.toBeNull(); expect(result.privateLapsesFirst).toBe(false);
  });
  it("cannot mint private authority from options/worker request JSON without a runtime channel", async () => {
    const f = privateFixture();
    const result = await executeRosterPlanning(f.snapshot, f.intent, { ...f.options, response: f.body, privatePort: {}, trusted: true } as never);
    expect(result.result.selected.projectedValue).toBeNull(); expect(f.fetcher).not.toHaveBeenCalled();
  });
  it("withdraws confirmation authority if its deadline expires during candidate computation", async () => {
    const f = privateFixture(), original = candidates.candidatePlanMetrics;
    vi.spyOn(candidates, "candidatePlanMetrics").mockImplementation((...args) => {
      const result = original(...args); vi.spyOn(performance, "now").mockReturnValue(120001); return result;
    });
    const request = requestRosterPlanning(f.snapshot, f.intent, f.options), result = await request.promise; request.release();
    expect(result.result.selected.projectedValue).toBeNull(); expect(result.displaySnapshot.forecasts).toEqual([]);
    expect(result.expiresAtMonotonic).toBeNull();
  });
});
