import { beforeEach, describe, expect, it, vi } from "vitest";
import * as rsoPolicy from "../player-forecasts/rsoUsePolicy";
import { fixtureRsoBindings, fixtureRsoPolicy } from "../player-forecasts/rsoUsePolicy.fixtures";
import { dtdReserves, healthyReserves, withoutHealthyReserves } from "./healthyReserves";
import { lineupGapReport } from "./lineupGaps";
import { evaluatePlan } from "./planning";
import type { GameForecast, PlanIntent, PlanningPlayer, PlanningSnapshot } from "./planningTypes";

const intent: PlanIntent = { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };
const member = (id: string, team: string, positions: string[], extra: Partial<PlanningPlayer> = {}): PlanningPlayer => ({
  id, nhlId: id.charCodeAt(0), nhlTeamId: team.charCodeAt(0), rosterRevision: `roster-${id}`, name: id.toUpperCase(), teamAbbreviation: team,
  eligiblePositions: positions, playerClass: "skater", availability: "rostered", eligibilityVerified: true, ownership: null, canDrop: true,
  holdValue: null, reserveEligibility: [], injury: null, ...extra });
const perGame: Record<string, number> = { a: 1, b: 2, d: 3, e: 1 };
beforeEach(() => vi.spyOn(rsoPolicy, "currentRsoUsePolicy").mockReturnValue(fixtureRsoPolicy(["fixture"], ["pts"])));

// A live Yahoo read: a (C) starts, b (C) sits, and D-man d is back to full health (no Yahoo injury, so no IR eligibility)
// but still in the IR spot. One bench spot is open, and nobody fills D.
function snapshot(): PlanningSnapshot {
  const players = [member("a", "A", ["C"]), member("b", "B", ["C"]), member("d", "D", ["D"]), member("e", "E", ["D"])];
  const games = [["A", "2026-10-05"], ["A", "2026-10-06"], ["B", "2026-10-06"], ["D", "2026-10-05"], ["D", "2026-10-06"], ["E", "2026-10-05"], ["E", "2026-10-06"]].map(([team, date]) => ({
    id: `${team}-${date}`, scheduleRevision: `schedule-${team}-${date}`, date, startsAt: `${date}T23:00:00Z`, teamAbbreviation: team, opponent: "X", home: true, status: "scheduled" as const }));
  const data: PlanningSnapshot = { id: "snap", context: { provider: "yahoo", seasonId: 20262027, leagueId: "l", teamId: "t", startDate: "2026-10-05",
    endDate: "2026-10-06", timeZone: "UTC", asOf: "2026-10-04T00:00:00Z" }, players, games, forecasts: [],
    roster: [{ playerId: "a", position: "active" }, { playerId: "b", position: "bench" }, { playerId: "d", position: "IR" }],
    rules: { lineupMode: "daily", rosterSlots: { C: 1, D: 1, BN: 1, IR: 1, "IR+": 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "p", start: "2026-10-04T00:00:00Z", end: "2026-10-12T00:00:00Z", remaining: 2, source: "provider" }],
      scoring: { mode: "points", weights: { pts: 1 }, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
    lockedAssignments: [], realized: { pts: 0 }, opponent: null,
    evidence: { schedule: { source: "fixture", asOf: "2026-10-04T00:00:00Z", seasonId: 20262027, completeness: "complete", limitations: [] },
      roster: { source: "Yahoo authorized current roster", asOf: "2026-10-04T00:00:00Z", seasonId: 20262027, completeness: "complete", limitations: [] } } };
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
// A second healthy D-man, f (5 per game), on d's team.
const withF = (data: PlanningSnapshot, position: "IR" | "IR+") => {
  const f = member("f", "D", ["D"]);
  data.players = [...data.players, f];
  data.roster = [...data.roster, { playerId: "f", position }];
  data.forecasts = [...data.forecasts, ...data.forecasts.filter(row => row.playerId === "d").map(row => ({ ...row, playerId: "f", stats: { pts: 5 },
    issuedContext: { ...row.issuedContext!, playerId: "f", nhlPlayerId: f.nhlId!, rosterRevision: f.rosterRevision! } }))];
};
const injured = (data: PlanningSnapshot, id: string, status: string, reserve: PlanningPlayer["reserveEligibility"]) => {
  data.players = data.players.map(row => row.id === id ? { ...row, injury: { status, label: status, note: null }, reserveEligibility: reserve } : row);
};

describe("healthy reserve players", () => {
  // TJ 2026-10-22: a player got healthy but stayed in his IR spot; activating him gained projected points, unflagged.
  it("flags a healthy player left in IR and prices moving him to the open spot", () => {
    const data = snapshot();
    expect(evaluatePlan(data, intent, "outcome", [], false).legal).toBe(false);
    expect(healthyReserves(data, intent)).toEqual([{ playerId: "d", position: "IR", slotEligible: false,
      activation: { swapPlayerId: null, projectedPoints: 6, activeGames: 2 } }]);
  });

  it("still flags him while Yahoo keeps him eligible for the slot", () => {
    const data = snapshot();
    data.players = data.players.map(row => row.id === "d" ? { ...row, reserveEligibility: ["IR"] } : row);
    expect(healthyReserves(data, intent)).toEqual([expect.objectContaining({ playerId: "d", slotEligible: true,
      activation: { swapPlayerId: null, projectedPoints: 6, activeGames: 2 } })]);
  });

  it("does not flag injured players, including DTD and O in IR+, or players whose status was never read", () => {
    const data = snapshot();
    injured(data, "d", "IR-LT", ["IR"]);
    expect(healthyReserves(data, intent)).toEqual([]);
    data.roster = data.roster.map(row => row.playerId === "d" ? { ...row, position: "IR+" } : row);
    for (const status of ["DTD", "O"]) {
      injured(data, "d", status, ["IR+"]);
      expect(healthyReserves(data, intent)).toEqual([]);
    }
    data.players = data.players.map(row => row.id === "d" ? { ...row, injury: undefined } : row);
    expect(healthyReserves(data, intent)).toEqual([]);
  });

  it("needs a live, complete Yahoo roster read", () => {
    const manual = snapshot();
    manual.context = { ...manual.context, provider: "manual" };
    expect(healthyReserves(manual, intent)).toEqual([]);
    const retained = snapshot();
    retained.evidence.roster = { ...retained.evidence.roster!, source: "Retained local roster", completeness: "partial" };
    expect(healthyReserves(retained, intent)).toEqual([]);
  });

  it("suggests the swap with an injured player Yahoo lists for the slot when the roster is full", () => {
    const data = snapshot();
    data.roster = [...data.roster, { playerId: "e", position: "active" }];
    injured(data, "e", "O", ["IR"]);
    expect(healthyReserves(data, intent)).toEqual([{ playerId: "d", position: "IR", slotEligible: false,
      activation: { swapPlayerId: "e", projectedPoints: 6, activeGames: 2 } }]);
  });

  it("offers no activation when a full roster has nobody to swap into the slot", () => {
    const data = snapshot();
    data.roster = [...data.roster, { playerId: "e", position: "active" }];
    expect(healthyReserves(data, intent)).toEqual([{ playerId: "d", position: "IR", slotEligible: false, activation: null }]);
  });

  it("prices only the games left after today's started games, and stays unknown while a weekly window is unverified", () => {
    const started = snapshot();
    started.context = { ...started.context, asOf: "2026-10-05T23:30:00Z" };
    started.evidence.schedule = { ...started.evidence.schedule!, asOf: started.context.asOf };
    expect(healthyReserves(started, intent)[0].activation).toEqual({ swapPlayerId: null, projectedPoints: 3, activeGames: 1 });
    const weekly = snapshot();
    weekly.rules = { ...weekly.rules, lineupMode: "weekly", lineupPeriods: [] };
    expect(healthyReserves(weekly, intent)[0].activation).toEqual({ swapPlayerId: null, projectedPoints: null, activeGames: null });
  });

  it("leaves points unknown, not zero, when he adds no active games but may outscore the starter", () => {
    const data = snapshot();
    data.rules = { ...data.rules, rosterSlots: { ...data.rules.rosterSlots, BN: 2 } };
    data.roster = [...data.roster, { playerId: "e", position: "active" }];
    data.forecasts = data.forecasts.filter(forecast => !(forecast.playerId === "d" && forecast.gameId === "D-2026-10-05"));
    expect(healthyReserves(data, intent)[0].activation).toEqual({ swapPlayerId: null, projectedPoints: null, activeGames: 0 });
  });

  // CR-RSO-01: the drop notice repeated the alert's illegal-lineup message for the same player.
  it("drops only the lineup-gap blocker that repeats a flagged player's alert", () => {
    const data = snapshot();
    data.players = [...data.players, member("f", "D", ["D"])];
    data.roster = [...data.roster, { playerId: "f", position: "IR+" }];
    injured(data, "f", "DTD", []);
    const blockers = lineupGapReport(data, intent, evaluatePlan(data, intent, "outcome", [], false)).projectionBlockers;
    expect(blockers.map(row => row.playerId)).toEqual(["d", "f"]);
    expect(withoutHealthyReserves(blockers, healthyReserves(data, intent))).toEqual([blockers[1]]);
    const lineupWide = [{ playerId: null, reason: "projected points are unknown" }];
    expect(withoutHealthyReserves(lineupWide, healthyReserves(data, intent))).toEqual(lineupWide);
    const manual = { ...data, context: { ...data.context, provider: "manual" as const } };
    expect(withoutHealthyReserves(blockers, healthyReserves(manual, intent))).toEqual(blockers);
  });

  // TJ 2026-10-25: flagged players competing for too few spots or partners rank by projected gain, unknown gains last.
  it("gives the open spot to the bigger gain, not roster order, and leaves the rest to a drop", () => {
    const data = snapshot();
    withF(data, "IR+");
    expect(healthyReserves(data, intent)).toEqual([
      { playerId: "f", position: "IR+", slotEligible: false, activation: { swapPlayerId: null, projectedPoints: 10, activeGames: 2 } },
      { playerId: "d", position: "IR", slotEligible: false, activation: null }]);
    data.forecasts = data.forecasts.filter(forecast => forecast.playerId !== "f");
    expect(healthyReserves(data, intent).map(row => [row.playerId, row.activation?.projectedPoints])).toEqual([["d", 6], ["f", undefined]]);
  });

  it("gives a shared swap partner to the bigger gain only", () => {
    const data = snapshot();
    data.roster = [...data.roster, { playerId: "e", position: "active" }];
    withF(data, "IR+");
    injured(data, "e", "O", ["IR", "IR+"]);
    expect(healthyReserves(data, intent)).toEqual([
      { playerId: "f", position: "IR+", slotEligible: false, activation: { swapPlayerId: "e", projectedPoints: 10, activeGames: 2 } },
      { playerId: "d", position: "IR", slotEligible: false, activation: null }]);
  });

  // TJ 2026-10-25: a DTD player in IR+ may play on his team's game days: a soft note, not a flag.
  it("notes a DTD player in IR+ only when his team plays today", () => {
    const data = snapshot();
    data.roster = data.roster.map(row => row.playerId === "d" ? { ...row, position: "IR+" } : row);
    injured(data, "d", "DTD", ["IR+"]);
    data.context = { ...data.context, asOf: "2026-10-05T12:00:00Z" };
    expect(dtdReserves(data)).toEqual(["d"]);
    expect(healthyReserves(data, intent)).toEqual([]);
    data.games = data.games.filter(game => !(game.teamAbbreviation === "D" && game.date === "2026-10-05"));
    expect(dtdReserves(data)).toEqual([]);
    const final = snapshot();
    final.roster = final.roster.map(row => row.playerId === "d" ? { ...row, position: "IR+" } : row);
    final.context = { ...final.context, asOf: "2026-10-05T12:00:00Z" };
    for (const status of ["O", "IR"]) {
      injured(final, "d", status, ["IR+"]);
      expect(dtdReserves(final)).toEqual([]);
    }
    injured(final, "d", "DTD", ["IR+"]);
    final.roster = final.roster.map(row => row.playerId === "d" ? { ...row, position: "IR" } : row);
    expect(dtdReserves(final)).toEqual([]);
    final.roster = final.roster.map(row => row.playerId === "d" ? { ...row, position: "IR+" } : row);
    expect(dtdReserves({ ...final, context: { ...final.context, provider: "manual" } })).toEqual([]);
    expect(dtdReserves(final)).toEqual(["d"]);
  });
});
