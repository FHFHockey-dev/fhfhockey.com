import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { requestRosterPlanning } from "../../hooks/rosterPlanningExecution";
import { executeRosterPlanning } from "./executionAdapter";
import { withCurrentPlanningRead } from "./currentPlanningRead";
import { defaultWorkspace } from "./workspace";
import { currentRsoUsePolicy, restrictRsoForecast } from "../player-forecasts/rsoUsePolicy";
import { expandBridgeForecasts, type BridgeForecastWire } from "../rosterScheduleData/bridgeForecastWire";
import type { PlanningData, PlanningSnapshot } from "./planningTypes";
const now = "2026-10-22T12:00:00.000Z";
function fixture() {
  const workspace = defaultWorkspace(), revision = "forge-daily-bridge-v1:synthetic-run";
  const player = { id: "7", nhlId: 77, nhlTeamId: 1, rosterRevision: "roster-a", name: "Synthetic player",
    teamAbbreviation: "MIN", eligiblePositions: ["C"], playerClass: "skater" as const, eligibilityVerified: true,
    availability: "rostered" as const, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] };
  const game = { id: "30", date: "2026-10-23", startsAt: "2026-10-23T20:00:00Z", teamAbbreviation: "MIN",
    opponent: "TOR", home: true, status: "scheduled" as const, scheduleRevision: "schedule-a" };
  const wire: BridgeForecastWire = { version: "forge-daily-bridge-wire-v1", seasonId: 20262027, limitations: ["Synthetic approved bridge fixture"],
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

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function goalieFixture(mark: boolean | null, observedAt = now) {
  const result = fixture(), { snapshot, body } = result;
  snapshot.context.provider = "yahoo";
  snapshot.players[0].playerClass = "goalie";
  snapshot.players[0].eligiblePositions = ["G"];
  body.data.players = structuredClone(snapshot.players);
  if (mark !== null) snapshot.players[0].startingStatus = { source: "yahoo", date: snapshot.games[0].date, isStarting: mark, observedAt };
  snapshot.rules.rosterSlots = { G: 1 };
  snapshot.rules.scoring = { mode: "points", weights: { SAVES_GOALIE: 1 }, categories: [] };
  snapshot.rules.goalieMinimum = { required: 1, credited: 0, counts: "starts", penalty: "none",
    periodStart: now, periodEnd: "2026-10-24T00:00:00Z" };
  snapshot.realized = {}; snapshot.opponent = null; snapshot.lockedAssignments = [];
  body.bridgeForecasts.rows[0] = ["7", "30", 0, "2026-10-24T00:00:00Z", { SAVES_GOALIE: 7.5 }, 0.3, false, { SAVES_GOALIE: 25 }];
  snapshot.forecasts = expandBridgeForecasts(body.bridgeForecasts, body.data);
  return result;
}
function mockRead(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => ({ ok: true, json: async () => ({ ...structuredClone(body as object),
    read: { nonce: (init.headers as Record<string, string>)["X-RSO-Read-Nonce"], evaluatedAt: now } }) })));
}
it("keeps forged, stale and future Yahoo marks informational through the actual worker and shared fallback", async () => {
  const worker = { onmessage: null as ((event: { data: unknown }) => Promise<void>) | null, postMessage: vi.fn() };
  vi.stubGlobal("self", worker); await import("../../hooks/rosterPlanning.worker");
  vi.stubGlobal("Worker", undefined);
  for (const [mark, observedAt] of [[null, now], [true, now], [false, "2010-01-01T00:00:00Z"], [true, "2100-01-01T00:00:00Z"]] as const) {
    const { snapshot, body, intent } = goalieFixture(mark, observedAt);
    mockRead(body);
    const saved = JSON.parse(JSON.stringify(snapshot));
    const first = requestRosterPlanning(saved, intent, {}), second = requestRosterPlanning(saved, intent, {});
    const result = await first.promise;
    expect(await second.promise).toBe(result); expect(fetch).toHaveBeenCalledOnce();
    expect(result.readError).toBeNull();
    expect(result.displaySnapshot.forecasts[0]).toMatchObject({ startProbability: 0.3, confirmedStart: false, stats: { SAVES_GOALIE: 7.5 } });
    expect(result.displaySnapshot.players[0].startingStatus).toEqual(snapshot.players[0].startingStatus);
    expect(result.result.selected.projectedValue).toBe(7.5);
    expect(result.result.selected.goalie).toMatchObject({ confirmed: 0, projected: 0.3, minimumSatisfied: false });
    first.release(); second.release();
    worker.postMessage.mockClear();
    await worker.onmessage!({ data: { snapshot: structuredClone(saved), intent, options: {}, candidateOptions: {} } });
    expect(worker.postMessage).toHaveBeenCalledWith(result);
    expect(fetch).toHaveBeenCalledTimes(2);
  }
});
it("does not extend an expired bridge with a current-looking Yahoo mark", async () => {
  const { snapshot, body, intent } = goalieFixture(true);
  body.bridgeForecasts.rows[0][3] = now;
  mockRead(body);
  const result = await executeRosterPlanning(snapshot, intent);
  expect(result.result.selected.projectedValue).toBeNull();
  expect(result.displaySnapshot.forecasts).toEqual([]);
});
it("does not admit an unreviewed native target even when Yahoo marks and bridge revision claims are present", async () => {
  const { snapshot, body, intent } = goalieFixture(true);
  body.data.forecasts = [{ ...snapshot.forecasts[0], rsoTargetBindings: { SAVES_GOALIE: {
    component: "synthetic", modelMode: "candidate", codeVersion: snapshot.forecasts[0].modelVersion!,
    configurationHash: "a".repeat(64), artifactHash: "b".repeat(64), targetKey: "SAVES_GOALIE", horizonGames: 1,
    conditioning: "conditional_start", participationLineage: "synthetic-only", cutoffAt: now,
  } } }];
  body.bridgeForecasts.rows = [];
  mockRead(body);
  expect(currentRsoUsePolicy().reviews).toEqual([]);
  const result = await executeRosterPlanning(snapshot, intent);
  expect(result.result.selected.projectedValue).toBeNull();
  expect(result.displaySnapshot.forecasts[0].stats.SAVES_GOALIE).toBeNull();
});
it("denies changed bridge copies inside the read and serialized copies after its scope ends", async () => {
  const { snapshot, body } = goalieFixture(true); mockRead(body);
  const output = await withCurrentPlanningRead(snapshot, {}, currentRsoUsePolicy().revision, new AbortController().signal,
    (_input, data, error) => {
      expect(error).toBeNull(); const row = data!.forecasts[0];
      expect(Object.isFrozen(row.stats)).toBe(true);
      const changed = { ...row, stats: { SAVES_GOALIE: 25 }, startProbability: 1, confirmedStart: true };
      expect(restrictRsoForecast(changed, data!.forecastManifest, now).allowedUses?.totals).toBe(false);
      expect(restrictRsoForecast(row, data!.forecastManifest, now).allowedUses?.totals).toBe(true);
      return JSON.parse(JSON.stringify(data));
    });
  expect(restrictRsoForecast(output.forecasts[0], output.forecastManifest, now).allowedUses?.totals).toBe(false);
});
