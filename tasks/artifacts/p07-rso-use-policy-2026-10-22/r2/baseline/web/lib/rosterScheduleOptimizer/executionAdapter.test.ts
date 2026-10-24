import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestRosterPlanning } from "../../hooks/rosterPlanningExecution";
import { executeRosterPlanning } from "./executionAdapter";
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
function respond(body: unknown) { return { ok: true, json: async () => structuredClone(body) } as Response; }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("fresh RSO execution authority", () => {
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

});
