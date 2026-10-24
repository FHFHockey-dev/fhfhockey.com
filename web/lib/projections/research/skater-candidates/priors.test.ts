// @vitest-environment node
import { describe, expect, it } from "vitest";
import { estimatePositionPrior, fitSplitHalfK, type HistoricalCounts, type PriorScope } from "./priors";

const scope: PriorScope = { season: "20262027", before: "2026-10-20T00:00:00Z", position: "F", strength: "ES", metric: "shotsPer60" };
function row(change: Partial<HistoricalCounts> = {}): HistoricalCounts {
  return { playerId: 1, gameId: 1, season: scope.season, position: "F", strength: "ES", playedAt: "2026-10-10T00:00:00Z",
    availableAt: "2026-10-11T00:00:00Z", toiSeconds: 1200, shots: 4, goals: 1, assists: 1, onIceGoals: 2, ...change };
}

describe("position-specific historical priors", () => {
  it("pools counts over exposure rather than averaging per-game rates", () => {
    const result = estimatePositionPrior([row(), row({ gameId: 2, shots: 2, toiSeconds: 600 })], scope);
    expect(result).toMatchObject({ events: 6, exposure: 0.5, mean: 12, unit: "hours", rows: 2 });
    expect(estimatePositionPrior([row()], { ...scope, metric: "goalsPerShot" })).toMatchObject({ mean: 0.25, exposure: 4, unit: "shots" });
    expect(estimatePositionPrior([row()], { ...scope, metric: "assistsPerOnIceGoal" })).toMatchObject({ mean: 0.5, unit: "onIceGoals" });
    expect(estimatePositionPrior([row()], { ...scope, metric: "pointsPerOnIceGoal" })).toMatchObject({ mean: 1, unit: "onIceGoals" });
  });

  it("does not mix positions, strengths, seasons or future availability", () => {
    const rows = [row(), row({ position: "D" }), row({ strength: "PP" }), row({ season: "20252026" }),
      row({ gameId: 2, availableAt: scope.before }), row({ gameId: 3, playedAt: scope.before, availableAt: scope.before }), row({ gameId: 4, toiSeconds: null })];
    expect(estimatePositionPrior(rows, scope)).toMatchObject({ rows: 1, mean: 12, excluded: { outsideScope: 3, notAvailableBeforeCutoff: 2, missingExposure: 1 } });
  });

  it("blocks malformed frames and duplicates without manufacturing priors", () => {
    expect(estimatePositionPrior([row({ shots: null })], scope).mean).toBeNull();
    expect(() => estimatePositionPrior([row(), row()], scope)).toThrow("Duplicate");
    expect(() => estimatePositionPrior([row({ shots: 0, goals: 1 })], { ...scope, metric: "goalsPerShot" })).toThrow();
    expect(() => estimatePositionPrior([row({ goals: 2, assists: 1, onIceGoals: 2 })], { ...scope, metric: "pointsPerOnIceGoal" })).toThrow();
    expect(() => estimatePositionPrior([row({ availableAt: "2026-10-09T00:00:00Z" })], scope)).toThrow("vintage");
  });

  it("fits a reproducible stat-specific k grid using held-out halves and peer training priors", () => {
    const rows = [row({ playerId: 1, gameId: 1, shots: 6, toiSeconds: 3600 }), row({ playerId: 1, gameId: 2, shots: 12, toiSeconds: 3600 }),
      row({ playerId: 2, gameId: 1, shots: 12, toiSeconds: 3600 }), row({ playerId: 2, gameId: 2, shots: 6, toiSeconds: 3600 })];
    const fit = fitSplitHalfK(rows, scope, [0, 1, 10]);
    expect(fit).toMatchObject({ status: "candidate", k: 10, boundary: true, unit: "hours", players: 2, evidence: "historical_split_half_tuning_only" });
    if (fit.status !== "candidate") throw new Error("Expected candidate");
    expect(fit.trials.find((trial) => trial.k === 0)?.rmse).toBe(6);
    expect(fit.trials.find((trial) => trial.k === 1)?.rmse).toBe(3);
    expect(fit).toEqual(fitSplitHalfK([...rows].reverse(), scope, [0, 1, 10]));
  });

  it("returns an explicit data blocker instead of a research-suggested k", () => {
    expect(fitSplitHalfK([row()], scope, [0, 1])).toMatchObject({ status: "blocked", reason: "need_two_players_with_two_supported_games" });
    expect(() => fitSplitHalfK([], scope, [1, 1])).toThrow();
    expect(() => fitSplitHalfK([], scope, [0, NaN])).toThrow();
  });
});
