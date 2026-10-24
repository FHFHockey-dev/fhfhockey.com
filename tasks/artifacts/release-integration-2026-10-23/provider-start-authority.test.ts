import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
async function observe(mark: boolean | null, observedAt = now) {
  const { snapshot, body } = fixture();
  snapshot.context.provider = "yahoo";
  snapshot.players[0].playerClass = "goalie";
  snapshot.players[0].eligiblePositions = ["G"];
  body.data.players[0] = { ...snapshot.players[0] };
  if (mark !== null) snapshot.players[0].startingStatus = { source: "yahoo", date: snapshot.games[0].date, isStarting: mark, observedAt };
  body.bridgeForecasts.rows[0] = ["7", "30", 0, "2026-10-24T00:00:00Z", { SAVES_GOALIE: 7.5 }, 0.3, false, { SAVES_GOALIE: 25 }];
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => ({ ok: true, json: async () => ({ ...structuredClone(body),
    read: { nonce: (init.headers as Record<string,string>)["X-RSO-Read-Nonce"], evaluatedAt: now } }) })));
  return withCurrentPlanningRead(JSON.parse(JSON.stringify(snapshot)), {}, currentRsoUsePolicy().revision,
    new AbortController().signal, (_input, data, error) => {
      expect(error).toBeNull(); expect(data).not.toBeNull();
      const row = restrictRsoForecast(data!.forecasts[0], data!.forecastManifest, now);
      return { probability: row.startProbability, saves: row.stats.SAVES_GOALIE, totals: row.allowedUses?.totals };
    });
}
it("keeps current server-authorized bridge values for an unmarked Yahoo snapshot", async () => {
  expect(await observe(null)).toEqual({ probability: 0.3, saves: 7.5, totals: true });
});
it("does not mint quantitative authority from a client-forged Yahoo start mark", async () => {
  expect(await observe(true)).toEqual({ probability: 0.3, saves: 7.5, totals: true });
});
it("does not mint quantitative authority from an old serialized Yahoo nonstart", async () => {
  expect(await observe(false, "2010-01-01T00:00:00Z")).toEqual({ probability: 0.3, saves: 7.5, totals: true });
});
