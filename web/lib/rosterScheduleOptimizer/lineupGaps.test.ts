import { beforeEach, describe, expect, it, vi } from "vitest";
import * as rsoPolicy from "../player-forecasts/rsoUsePolicy";
import { fixtureRsoBindings, fixtureRsoPolicy } from "../player-forecasts/rsoUsePolicy.fixtures";
import { candidatePlanMetrics } from "./candidatePlanMetrics";
import { forecastCalendarPolicy } from "../player-forecasts/contributions";
import { verifiedRunAttribution } from "../projections/externalInputProof";
import { buildForgeDailyBridgeForecasts, type ForgeDailyBridgeInputs } from "../rosterScheduleData/forgeDailyBridge";
import { compactBridgeForecasts, reserveCodeOf } from "../rosterScheduleData/bridgeForecastWire";
import { executeRosterPlanning } from "./executionAdapter";
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
    rsoTargetBindings: fixtureRsoBindings("fixture", data.context.asOf, ["pts"]),
    issuedContext: { version: "forge-issued-context-v1", playerId: player.id, gameId: game.id, nhlPlayerId: player.nhlId!, teamId: player.nhlTeamId!,
      seasonId: 20262027, scheduledAt: game.startsAt, scheduleRevision: game.scheduleRevision, rosterRevision: player.rosterRevision!,
      observedAt: data.context.asOf, scheduleSourceUpdatedAt: null, scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] },
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, startProbability: null, confirmedStart: false, limitations: [] })));
  return data;
}

describe("FORGE lineup gap readback", () => {
  it("explains Schmaltz's missing Utah line after the current FORGE read and legal slot assignment", async () => {
    // Public game, run and missing player from the Nov 16 audit (021, 023, 051). The one-C roster is a local scenario.
    const date = "2026-11-16", asOf = "2026-11-16T20:00:00.000Z";
    const game = { id: "2026020332", date, startsAt: "2026-11-17T02:30:00Z", teamAbbreviation: "UTA",
      opponent: "VAN", home: true, status: "scheduled" as const, scheduleRevision: "schedule-0332" };
    const player = { ...member("schmaltz", "UTA", ["C"], "rostered"), name: "Nick Schmaltz", nhlId: 8477951, nhlTeamId: 68 };
    const runId = "26373189-3ebd-4380-b4f4-c6797d469ca9";
    const closure = "ee5581d901975dd5701c76ecc58e715b396b449bdb50e05360c571f3f3de710b";
    // The old run has no publication witness or per-game cutoff map. Replay the new contract below:
    // the retained Nov 16 read witnessed success before this replay, and 0332 was the last invocation's game.
    const run = { run_id: runId, git_sha: "e1ab46318ec9c6797deb94ac1aa23d68f5672f26", status: "succeeded",
      as_of_date: date, created_at: "2026-11-13T10:33:00Z", scope_key: "h1:full", invocations: "2",
      producer_identity: { version: "forge-producer-closure-v1", invocations: [closure, closure], code_versions: [null, null] } };
    const proof = verifiedRunAttribution(run);
    expect(proof?.basis).toBe("verified_producer_closure");
    // Keller's row anchors Utah's serving run. Only its identity is needed here.
    const teamGame = { run_id: runId, as_of_date: date, game_id: Number(game.id), team_id: 68, horizon_games: 1 };
    const roster = snapshot();
    roster.context = { ...roster.context, startDate: date, endDate: date, timeZone: "America/New_York", asOf };
    roster.players = [player];
    roster.games = [game];
    roster.forecasts = [];
    roster.roster = [{ playerId: player.id, position: "active" }];
    roster.rules.rosterSlots = { C: 1 };
    roster.rules.periods = [{ id: "week", start: "2026-11-16T05:00:00Z", end: "2026-11-23T05:00:00Z", remaining: 0, source: "manager" }];
    roster.rules.scoring = { mode: "points", weights: { GOALS: 1 }, categories: [] };
    roster.realized = {};
    roster.evidence.schedule = { ...roster.evidence.schedule, asOf };
    const revision = `forge-daily-bridge-v1:${runId}`;
    const replay = async (extra: Pick<ForgeDailyBridgeInputs, "reserves" | "goalieNews">) => {
      const bridge = buildForgeDailyBridgeForecasts({ runs: [{ ...run, external_input_proven: !!proof,
        succeeded_observed_at: asOf, decision_as_of_by_game: { [game.id]: "2026-11-13T10:35:27.290Z" } }],
        skaters: [{ ...teamGame, player_id: 8479343 }], goalies: [], ...extra }, [player], [game], new Date(asOf), 20262027, forecastCalendarPolicy());
      const { forecasts, wire } = compactBridgeForecasts(bridge.forecasts, roster, roster.context.seasonId);
      vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => ({ ok: true, json: async () => ({
        success: true, read: { nonce: (init.headers as Record<string, string>)["X-RSO-Read-Nonce"], evaluatedAt: asOf },
        data: { players: roster.players, games: roster.games, forecasts, evidence: roster.evidence,
          forecastManifest: { version: "planning-forecasts-v1", seasonId: 20262027, id: "case-read", asOf, issuedRevisionIds: [revision],
            rsoUsePolicy: { version: "rso-target-use-v1", revision: rsoPolicy.currentRsoUsePolicy().revision, bridgeRevisionIds: [revision] } } },
        bridgeForecasts: wire,
      }) })));
      const { displaySnapshot, result, readError } = await executeRosterPlanning(roster, { ...intent, objective: "outcome" });
      expect(readError).toBeNull();
      return { row: displaySnapshot.forecasts[0], plan: result.selected, report: lineupGapReport(displaySnapshot, intent, result.baseline) };
    };
    try {
      const missing = await replay({ goalieNews: { assertions: [], conflicts: [] } });
      expect(reserveCodeOf(missing.row)).toBe("skater:no_forge_line");
      expect(missing.row).toMatchObject({ revisionId: revision, stats: { GOALS: null }, appearanceProbability: null,
        expiresAt: "2026-11-17T02:30:00.000Z" });
      expect(missing.plan).toMatchObject({ legal: true, activeGames: 1, projectedValue: null,
        assignments: [{ playerId: player.id, gameId: game.id, slotId: "C#1" }] });
      expect(missing.report.bestDrop).toBeNull();
      expect(missing.report.projectionBlockers).toEqual([{ playerId: player.id,
        reason: "has unknown projected points: no current FORGE player projection for 2026-11-16" }]);

      // Counterfactual controls for the same game: an if-dressed estimate and a confirmed absence.
      const conditional = await replay({ reserves: [{ ...teamGame, player_id: player.nhlId, conditioning: "if_dressed",
        player_class: "skater", proj_goals_es: 0.3, proj_assists_es: 0.4, proj_shots_es: 2, proj_toi_pp_seconds: 0 }],
        goalieNews: { assertions: [], conflicts: [] } });
      expect(conditional.row.conditionalStats?.GOALS).toBe(0.3);
      expect(conditional.plan.projectedValue).toBeNull();
      expect(conditional.report.projectionBlockers).toEqual([{ playerId: player.id,
        reason: "has unknown projected points: participation unconfirmed (FORGE estimate assumes he plays) for 2026-11-16" }]);

      const out = await replay({ goalieNews: { conflicts: [], assertions: [{ gameId: Number(game.id), teamId: 68,
        playerId: player.nhlId, dimension: "availability", value: "out", confirmed: true, evidenceId: "fixture-out",
        sourceKey: "fixture", sourceUrl: null, receivedAt: asOf, publishedAt: asOf }] } });
      expect(reserveCodeOf(out.row)).toBe("skater:confirmed_out");
      expect(out.row.stats.GOALS).toBe(0);
      expect(out.plan.projectedValue).toBe(0);
      expect(out.report.projectionBlockers).toEqual([]);
    } finally { vi.unstubAllGlobals(); }
  });
});

describe("lineup gap report", () => {
  beforeEach(() => vi.spyOn(rsoPolicy, "currentRsoUsePolicy").mockReturnValue(fixtureRsoPolicy(["fixture"], ["pts"])));
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
    // b has no forecast: the lineup total is unknown, but a's own value is known (per-player gate, W1 P0 #27), so a is
    // suggested and only b is unprojected.
    data.forecasts = data.forecasts.filter(forecast => forecast.playerId !== "b");
    const report = lineupGapReport(data, intent, evaluatePlan(data, intent, "outcome", [], false));
    expect(report.bestDrop?.playerId).toBe("a");
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
    // d's unknown games no longer blank the droppable players' known values (per-player gate, W1 P0 #27).
    expect(report.bestDrop?.playerId).toBe("a");
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

  it("names the reserve occupant blocking additions without invalidating the existing lineup", () => {
    const data = snapshot();
    const d = member("d", "C", ["D"], "rostered");
    data.players = [...data.players, d];
    data.roster = [...data.roster, { playerId: "d", position: "IR" }];
    data.rules.rosterSlots = { ...data.rules.rosterSlots, IR: 1 };
    const baseline = evaluatePlan(data, intent, "outcome", [], false);
    expect(baseline.legal).toBe(true);
    const report = lineupGapReport(data, intent, baseline);
    expect(report.unprojectedDrops).toEqual([]);
    expect(report.projectionBlockers).toEqual([{ playerId: "d",
      reason: "in IR without verified IR eligibility, which blocks additions; resolve the reserve position or refresh league data" }]);
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
