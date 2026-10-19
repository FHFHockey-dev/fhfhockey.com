import { describe, expect, it } from "vitest";
import { candidatePlanMetrics } from "./candidatePlanMetrics";
import { lineupGapReport } from "./lineupGaps";
import { evaluatePlan } from "./planning";
import type { GameForecast, PlanIntent, PlanningPlayer, PlanningSnapshot } from "./planningTypes";

const intent: PlanIntent = { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };
const member = (id: string, team: string, positions: string[], availability: PlanningPlayer["availability"]): PlanningPlayer => ({
  id, nhlId: id.charCodeAt(0), nhlTeamId: team.charCodeAt(0), rosterRevision: `roster-${id}`, name: id.toUpperCase(), teamAbbreviation: team,
  eligiblePositions: positions, playerClass: "skater", availability, eligibilityVerified: true, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] });
const perGame: Record<string, number> = { a: 1, b: 2, c: 1.5 };
function snapshot(): PlanningSnapshot {
  const players = [member("a", "A", ["C"], "rostered"), member("b", "B", ["C"], "rostered"), member("c", "C", ["D"], "free_agent")];
  const games = [["A", "2026-10-05"], ["A", "2026-10-06"], ["B", "2026-10-06"], ["C", "2026-10-05"], ["C", "2026-10-06"]].map(([team, date]) => ({
    id: `${team}-${date}`, scheduleRevision: `schedule-${team}-${date}`, date, startsAt: `${date}T23:00:00Z`, teamAbbreviation: team, opponent: "X", home: true, status: "scheduled" as const }));
  const data: PlanningSnapshot = { id: "snap", context: { provider: "manual", seasonId: 20262027, leagueId: "l", teamId: "t", startDate: "2026-10-05",
    endDate: "2026-10-06", timeZone: "UTC", asOf: "2026-10-04T00:00:00Z" }, players, games, forecasts: [],
    roster: [{ playerId: "a", position: "active" }, { playerId: "b", position: "bench" }],
    rules: { lineupMode: "daily", rosterSlots: { C: 1, D: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "p", start: "2026-10-04T00:00:00Z", end: "2026-10-12T00:00:00Z", remaining: 2, source: "manager" }],
      scoring: { mode: "points", weights: { pts: 1 }, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
    lockedAssignments: [], realized: { pts: 0 }, opponent: null,
    evidence: { schedule: { source: "fixture", asOf: "2026-10-04T00:00:00Z", seasonId: 20262027, completeness: "complete", limitations: [] } } };
  data.forecasts = games.flatMap(game => players.filter(player => player.teamAbbreviation === game.teamAbbreviation).map((player): GameForecast => ({
    playerId: player.id, gameId: game.id, stats: { pts: perGame[player.id] }, conditioning: "unconditional", sourceKind: "detailed",
    sourceWatermark: "fixture", cutoffAt: data.context.asOf, issuedAt: data.context.asOf, expiresAt: game.startsAt, modelVersion: "fixture", revisionId: "r",
    issuedContext: { version: "forge-issued-context-v1", playerId: player.id, gameId: game.id, nhlPlayerId: player.nhlId!, teamId: player.nhlTeamId!,
      seasonId: 20262027, scheduledAt: game.startsAt, scheduleRevision: game.scheduleRevision, rosterRevision: player.rosterRevision!,
      observedAt: data.context.asOf, scheduleSourceUpdatedAt: null, scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] },
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, startProbability: null, confirmedStart: false, limitations: [] })));
  return data;
}

describe("lineup gap report", () => {
  it("finds open slots, the weakest droppable player and the adds that fill the gaps", () => {
    const data = snapshot();
    const baseline = evaluatePlan(data, intent, "outcome", [], false);
    const report = lineupGapReport(data, intent, baseline, candidatePlanMetrics(data, intent).candidates);
    expect(report.gaps).toEqual([{ date: "2026-10-05", slot: "D", open: 1 }, { date: "2026-10-06", slot: "D", open: 1 }]);
    expect(report.openSlots).toBe(2);
    // a starts only on 10-05 (b outscores him on 10-06), so he is the weakest droppable player.
    expect(report.bestDrop).toEqual({ playerId: "a", projectedPoints: 1, activeGames: 1, frees: [{ date: "2026-10-05", slot: "C", open: 1 }] });
    expect(report.adds[0]).toMatchObject({ playerId: "c", dropsBest: false,
      fills: [{ date: "2026-10-05", slot: "D" }, { date: "2026-10-06", slot: "D" }], plan: { netPoints: 3, netAGP: 2 } });
  });

  it("never offers a protected player as the drop", () => {
    const data = snapshot();
    const report = lineupGapReport(data, { ...intent, protectedPlayerIds: ["a"] }, evaluatePlan(data, intent, "outcome", [], false));
    expect(report.bestDrop?.playerId).toBe("b");
    expect(report.adds).toEqual([]);
  });
});
