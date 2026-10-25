import { beforeEach, describe, expect, it, vi } from "vitest";
import * as rsoPolicy from "../player-forecasts/rsoUsePolicy";
import { fixtureRsoBindings, fixtureRsoPolicy } from "../player-forecasts/rsoUsePolicy.fixtures";
import { candidatePlanMetrics } from "./candidatePlanMetrics";
import { lineupGapReport } from "./lineupGaps";
import { evaluatePlan } from "./planning";
import type { GameForecast, PlanIntent, PlanningPlayer, PlanningSnapshot } from "./planningTypes";

const intent: PlanIntent = { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };
const member = (id: string, team: string, positions: string[], availability: PlanningPlayer["availability"]): PlanningPlayer => ({
  id, nhlId: id.charCodeAt(0), nhlTeamId: team.charCodeAt(0), rosterRevision: `roster-${id}`, name: id.toUpperCase(), teamAbbreviation: team,
  eligiblePositions: positions, playerClass: "skater", availability, eligibilityVerified: true, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] });
const perGame: Record<string, number> = { a: 1, b: 2, c: 1.5 };
beforeEach(() => vi.spyOn(rsoPolicy, "currentRsoUsePolicy").mockReturnValue(fixtureRsoPolicy(["fixture"], ["pts"])));
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
    rsoTargetBindings: fixtureRsoBindings("fixture", data.context.asOf, ["pts"]),
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
    expect(report.bestDrop).toEqual({ playerId: "a", projectedPoints: 1, activeGames: 1, frees: [{ date: "2026-10-05", slot: "C", open: 1 }],
      caution: { level: "unknown", ownership: null } });
    expect(report.adds[0]).toMatchObject({ playerId: "c", dropsBest: false,
      fills: [{ date: "2026-10-05", slot: "D" }, { date: "2026-10-06", slot: "D" }], plan: { netPoints: 3, netAGP: 2 } });
  });

  it("suggests no drop when every droppable player is unprojected, and names them", () => {
    const data = snapshot();
    data.forecasts = [];
    const report = lineupGapReport(data, intent, evaluatePlan(data, intent, "outcome", [], false));
    expect(report.bestDrop).toBeNull();
    expect(report.unprojectedDrops).toEqual(["a", "b"]);
  });

  it("names only the player missing a forecast when that makes the whole lineup's points unknown", () => {
    const data = snapshot();
    // b has no forecast: lineup points are unknown for everyone, so nobody is suggested, and only b is unprojected.
    data.forecasts = data.forecasts.filter(forecast => forecast.playerId !== "b");
    const report = lineupGapReport(data, intent, evaluatePlan(data, intent, "outcome", [], false));
    expect(report.bestDrop).toBeNull();
    expect(report.unprojectedDrops).toEqual(["b"]);
  });

  it("gives the missing forecast as that player's reason", () => {
    const data = snapshot();
    data.forecasts = data.forecasts.filter(forecast => forecast.playerId !== "b");
    const report = lineupGapReport(data, intent, evaluatePlan(data, intent, "outcome", [], false));
    expect(report.projectionBlockers).toEqual([{ playerId: "b", reason: "has unknown projected points: no FORGE projection issued for 2026-10-06" }]);
  });

  // TJ 2026-10-22: "16 players unprojected" listed every droppable star although each had complete forecasts.
  // One roster member who is not a drop candidate blocked the lineup's points; the report blamed the others.
  it("names a non-droppable roster player who blocks the lineup's points, not the droppable players with forecasts", () => {
    const data = snapshot();
    const d = { ...member("d", "C", ["D"], "rostered"), id: "d" };
    data.players = [...data.players, d];
    data.roster = [...data.roster, { playerId: "d", position: "active" }];
    const kept = { ...intent, protectedPlayerIds: ["d"] };
    const report = lineupGapReport(data, kept, evaluatePlan(data, kept, "outcome", [], false));
    expect(report.bestDrop).toBeNull();
    expect(report.unprojectedDrops).toEqual([]);
    expect(report.projectionBlockers).toEqual([{ playerId: "d", reason: "has unknown projected points: no FORGE projection issued for 2026-10-05, 2026-10-06" }]);
  });

  it("says when unverified league positions, not projections, leave the lineup's points unknown", () => {
    const data = snapshot();
    data.players = data.players.map(row => row.id === "b" ? { ...row, eligibilityVerified: false } : row);
    const report = lineupGapReport(data, intent, evaluatePlan(data, intent, "outcome", [], false));
    expect(report.bestDrop).toBeNull();
    expect(report.projectionBlockers).toEqual([{ playerId: "b", reason: "has unknown projected points: league positions not verified" }]);
    expect(report.unprojectedDrops).toEqual(["b"]);
  });

  it("says the no-move lineup fails a rule check instead of calling players with forecasts unprojected", () => {
    const data = snapshot();
    data.rules.lineupMode = "unsupported";
    const baseline = evaluatePlan(data, intent, "outcome", [], false);
    expect(baseline.legal).toBe(false);
    const report = lineupGapReport(data, intent, baseline);
    expect(report.bestDrop).toBeNull();
    expect(report.unprojectedDrops).toEqual([]);
    expect(report.projectionBlockers).toEqual([{ playerId: null, reason: expect.stringMatching(/^the no-move lineup fails a rule check/) }]);
  });

  // TJ 2026-10-22: a healthy player left in IR (no Yahoo IR eligibility) made the no-move lineup illegal.
  it("names a reserve player without verified eligibility as the reason the lineup fails its rule check", () => {
    const data = snapshot();
    const d = member("d", "C", ["D"], "rostered");
    data.players = [...data.players, d];
    data.roster = [...data.roster, { playerId: "d", position: "IR" }];
    data.rules.rosterSlots = { ...data.rules.rosterSlots, IR: 1 };
    const baseline = evaluatePlan(data, intent, "outcome", [], false);
    expect(baseline.legal).toBe(false);
    const report = lineupGapReport(data, intent, baseline);
    expect(report.unprojectedDrops).toEqual([]);
    expect(report.projectionBlockers).toEqual([{ playerId: "d",
      reason: "in IR without verified IR eligibility, so the lineup fails a rule check; move him to an active or bench spot, or refresh league data" }]);
    data.players = data.players.map(row => row.id === "d" ? { ...row, reserveEligibility: ["IR"] } : row);
    const legal = lineupGapReport(data, intent, evaluatePlan(data, intent, "outcome", [], false));
    expect(legal.projectionBlockers).toEqual([]);
    expect(legal.bestDrop?.playerId).toBe("a");
  });

  it("never offers a protected player as the drop", () => {
    const data = snapshot();
    const report = lineupGapReport(data, { ...intent, protectedPlayerIds: ["a"] }, evaluatePlan(data, intent, "outcome", [], false));
    expect(report.bestDrop?.playerId).toBe("b");
    expect(report.adds).toEqual([]);
  });

  it("never offers a player the provider lists as out as the drop, matching the planner", () => {
    const data = snapshot();
    data.players = data.players.map(row => row.id === "a" ? { ...row, injury: { status: "IR-LT", label: "Injured Reserve", note: null } } : row);
    // With b protected, a is the only other candidate; being out makes him no drop at all.
    const keepB = { ...intent, protectedPlayerIds: ["b"] };
    expect(lineupGapReport(data, keepB, evaluatePlan(data, intent, "outcome", [], false)).bestDrop).toBeNull();
    // Day-to-day is still a drop option.
    data.players = data.players.map(row => row.id === "a" ? { ...row, injury: { status: "DTD", label: "Day-to-Day", note: null } } : row);
    expect(lineupGapReport(data, keepB, evaluatePlan(data, intent, "outcome", [], false)).bestDrop?.playerId).toBe("a");
  });
});
