import { describe, expect, it } from "vitest";
import type { PlanEvaluation, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { comparePlanScenarios, comparePlanSensitivity } from "./planComparison";

// These fixtures isolate paired scoring: legality and assignment were already evaluated.
function fixture() {
  const forecast = (playerId: string, value: number) => ({ playerId, gameId: "g", stats: { GOALS: value }, conditioning: "unconditional" as const, startProbability: null, confirmedStart: false, revisionId: "issued", issuedAt: "2026-10-01T00:00:00Z", modelVersion: null, limitations: [] });
  const snapshot = {
    forecasts: [forecast("shared", 10), forecast("a", 1), forecast("b", 2)],
    rules: { scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] } }, opponent: null,
  } as unknown as PlanningSnapshot;
  const plan = (playerId: string, goals: number): PlanEvaluation => ({
    objective: "outcome", steps: [], legal: true, budgetVerified: true, scheduledGames: 2, activeGames: 2, benchGames: 0,
    projectedValue: goals, projectedStats: { GOALS: goals }, categoryResults: [], acquisitions: {}, limitations: [],
    goalie: { credited: null, confirmed: 0, projected: null, required: null, risk: false },
    assignments: ["shared", playerId].map(id => ({ playerId: id, gameId: "g", date: "2026-10-01", slotId: id, locked: false })),
  });
  return { snapshot, baseline: plan("a", 11), candidate: plan("b", 12) };
}

describe("paired complete-plan comparison", () => {
  it("cancels a shared player/game contribution using the same scenario", () => {
    const { snapshot, baseline, candidate } = fixture();
    const result = comparePlanScenarios(snapshot, baseline, candidate, [{ id: "shared-shock", label: "Shared game shock", games: [
      { playerId: "shared", gameId: "g", stats: { GOALS: 100 } },
      { playerId: "a", gameId: "g", stats: { GOALS: 1 } }, { playerId: "b", gameId: "g", stats: { GOALS: 2 } },
    ] }]);
    expect(result.scenarios[0]).toMatchObject({ baseline: 101, candidate: 102, difference: 1 });
    expect(snapshot.forecasts[0].stats.GOALS).toBe(10);
  });
  it("keeps missing scenario outcomes unknown and labels stresses without probabilities", () => {
    const { snapshot, baseline, candidate } = fixture();
    const incomplete = comparePlanScenarios(snapshot, baseline, candidate, [{ id: "missing", label: "Missing", games: [] }]);
    expect(incomplete.direction).toBe("unavailable");
    expect(incomplete.scenarios[0].difference).toBeNull();
    const sensitivity = comparePlanSensitivity(snapshot, baseline, candidate);
    expect(sensitivity.scenarios.map(row => row.difference)).toEqual([expect.closeTo(0.8), 1, expect.closeTo(1.2)]);
    expect(sensitivity.basis).toBe("sensitivity");
    expect(sensitivity).not.toHaveProperty("probability");
  });
  it("computes category ratios from complete component totals", () => {
    const { snapshot, baseline, candidate } = fixture();
    snapshot.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "SAVE_PERCENTAGE", direction: "higher", numerator: "SAVES", denominator: "SHOTS" }] };
    snapshot.opponent = { roster: [], realized: { SAVES: 9, SHOTS: 10 }, remaining: { SAVES: 9, SHOTS: 10 } };
    snapshot.forecasts = snapshot.forecasts.map(row => ({ ...row, stats: { SAVES: 9, SHOTS: 10 } }));
    baseline.projectedStats = { SAVES: 18, SHOTS: 20 }; candidate.projectedStats = { SAVES: 18, SHOTS: 20 };
    const result = comparePlanScenarios(snapshot, baseline, candidate, [{ id: "ratio", label: "Ratio", games: snapshot.forecasts.map(row => ({ ...row, stats: { SAVES: row.playerId === "b" ? 1 : 9, SHOTS: row.playerId === "b" ? 1 : 10 } })) }]);
    expect(result.scenarios[0]).toMatchObject({ baseline: 0, candidate: 1, difference: 1 });
  });
});
