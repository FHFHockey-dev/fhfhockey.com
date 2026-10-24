import { describe, expect, it } from "vitest";
import { gameForecastPoints } from "./planning";
import type { GameForecast, PlanningPlayer, PlanningSnapshot } from "./planningTypes";
import { defaultWorkspace } from "./workspace";
import { CONTRIBUTION_RESOLVER_POLICY_VERSION, type ResolvedContribution } from "../player-forecasts/contributions";

const allowed = { assignment: true, totals: true, comparison: true, conditionalTieBreak: false };
const denied = { assignment: false, totals: false, comparison: false, conditionalTieBreak: false };
const forecast = (patch: Partial<GameForecast> = {}): GameForecast => ({
  playerId: "1", gameId: "10", stats: { GOALS: 1, ASSISTS: 2 }, conditioning: "unconditional",
  startProbability: null, confirmedStart: false, revisionId: "fixture", issuedAt: "2026-10-22T12:00:00Z",
  modelVersion: "fixture", limitations: [], allowedUses: allowed, ...patch,
});
const workspace = defaultWorkspace(new Date("2026-10-22T12:00:00Z"));
const player = (id: string, goalie: boolean): PlanningPlayer => ({ id, playerClass: goalie ? "goalie" : "skater",
  nhlId: null, name: id, teamAbbreviation: "MIN", eligiblePositions: [goalie ? "G" : "C"],
  availability: "rostered", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] });
// These fixtures exercise readback only; no source reads or admission occurs here.
const snapshot = (row: GameForecast, weights: Record<string, number>, goalie = false): PlanningSnapshot => ({
  id: "display-fixture", context: workspace.context, roster: [], games: [], lockedAssignments: [], realized: {}, opponent: null, evidence: {},
  players: [player(row.playerId, goalie), player("other", !goalie)],
  forecasts: [row, forecast({ playerId: "other", stats: goalie ? { GOALS: 1, ASSISTS: 1 } : { SAVES_GOALIE: 20 } })],
  rules: { ...workspace.rules, scoring: { mode: "points", weights, categories: [] } },
});
const score = (row: GameForecast, weights: Record<string, number> = { GOALS: 3, ASSISTS: 2 }, goalie = false) => gameForecastPoints(snapshot(row, weights, goalie), row);
const resolved = (patch: Partial<ResolvedContribution> = {}): ResolvedContribution => ({
  resolverVersion: CONTRIBUTION_RESOLVER_POLICY_VERSION,
  game: { playerId: 1, nhlPlayerId: 1, seasonId: 20262027, teamId: 1, gameId: 10,
    scheduledAt: "2026-10-23T23:00:00Z", scheduleRevision: "fixture", rosterRevision: "fixture" },
  targetKey: "SAVES_GOALIE", sourceKind: "detailed", conditionalMean: 21, unconditionalMean: 11.55,
  unit: "count", basis: "per_start", allowedUses: allowed, sourceIds: ["fixture"],
  participationRevisionId: "fixture:start", blendWeight: null, exclusionReasons: [], limitations: [], ...patch,
});

describe("per-game forecast points display", () => {
  it.each([undefined, null, NaN, Infinity])("withholds the entire FP total when a weighted stat is %s", value => {
    const row = forecast({ stats: { GOALS: 1, ...(value === undefined ? {} : { ASSISTS: value }) } });
    expect(score(row).expected).toBeNull();
  });

  it("ignores zero weights and the other player class, preserving genuine zero and negative FP", () => {
    expect(score(forecast({ stats: { GOALS: 0 } }), { GOALS: 3, ASSISTS: 0, SAVES_GOALIE: 0.2 }).expected).toBe(0);
    expect(score(forecast({ stats: { GOALS: 1, ASSISTS: 2 } }), { GOALS: -5, ASSISTS: 2 }).expected).toBe(-1);
  });

  it("withholds absent scoring, invalid weights and overflowing sums", () => {
    expect(score(forecast(), {}).expected).toBeNull();
    expect(score(forecast(), { GOALS: NaN }).expected).toBeNull();
    expect(score(forecast({ stats: { GOALS: Number.MAX_VALUE } }), { GOALS: 2 }).expected).toBeNull();
  });

  it.each([0.55, 0, null])("reads conditional stats directly at start probability %s without weighting expected FP again", probability => {
    const row = forecast({ stats: { SAVES_GOALIE: 11.55 }, conditionalStats: { SAVES_GOALIE: 21 }, startProbability: probability });
    expect(score(row, { SAVES_GOALIE: 0.2 }, true)).toEqual({ expected: 2.31, ifStarts: 4.2 });
  });

  it("never reconstructs if-starts points by dividing an unconditional total", () => {
    const row = forecast({ stats: { SAVES_GOALIE: 11.55 }, startProbability: 0.55 });
    expect(score(row, { SAVES_GOALIE: 0.2 }, true)).toEqual({ expected: 2.31, ifStarts: null });
  });

  it("uses the selected per-start contribution instead of retained conditional stats", () => {
    const row = forecast({ stats: { SAVES_GOALIE: 11.55 }, conditionalStats: { SAVES_GOALIE: 999 },
      allowedUses: denied, contributions: { SAVES_GOALIE: resolved() } });
    expect(score(row, { SAVES_GOALIE: 0.2 }, true)).toEqual({ expected: 2.31, ifStarts: 4.2 });
  });

  it.each(["per_appearance", "unconditional_game", null] as const)("does not label %s contributions as if-starts", basis => {
    const row = forecast({ stats: { SAVES_GOALIE: 11.55 }, conditionalStats: { SAVES_GOALIE: 999 },
      contributions: { SAVES_GOALIE: resolved({ basis }) } });
    expect(score(row, { SAVES_GOALIE: 0.2 }, true)).toEqual({ expected: 2.31, ifStarts: null });
  });

  it("withholds a partial if-starts total even when the expected total is complete", () => {
    const row = forecast({ stats: { SAVES_GOALIE: 11.55, WINS_GOALIE: 0.2 }, conditionalStats: { SAVES_GOALIE: 21 } });
    expect(score(row, { SAVES_GOALIE: 0.2, WINS_GOALIE: 3 }, true).ifStarts).toBeNull();
  });

  it.each(["forecast", "target", "contribution"])("preserves %s permission denial even with numeric retained means", scope => {
    const row = forecast({ stats: { SAVES_GOALIE: 11.55 }, conditionalStats: { SAVES_GOALIE: 21 },
      ...(scope === "forecast" ? { allowedUses: denied } : scope === "target" ? { targetAllowedUses: { SAVES_GOALIE: denied } }
        : { contributions: { SAVES_GOALIE: resolved({ allowedUses: denied }) } }) });
    expect(score(row, { SAVES_GOALIE: 0.2 }, true)).toEqual({ expected: null, ifStarts: null });
  });

  it("does not show if-starts for skaters or for category scoring", () => {
    const row = forecast({ conditionalStats: { GOALS: 2, ASSISTS: 4 } });
    expect(score(row)).toEqual({ expected: 7, ifStarts: null });
    const data = snapshot(row, { GOALS: 3 });
    data.rules.scoring.mode = "categories";
    expect(gameForecastPoints(data, row)).toEqual({ expected: null, ifStarts: null });
  });
});
