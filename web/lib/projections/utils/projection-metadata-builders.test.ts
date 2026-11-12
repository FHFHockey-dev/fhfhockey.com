import { describe, expect, it } from "vitest";
import { buildGoalieUncertaintyWithModel } from "./projection-metadata-builders";

// Invented goalie metadata inputs: mechanics only (decision 28, L9b ticket).
const args = {
  baseGoalieUncertainty: {},
  blendedProjection: { modeled_save_pct: 0.905, residual_probability_mass: 0, proj_saves: 27, proj_goals_allowed: 3,
    proj_win_prob: 0.55, proj_shutout_prob: 0.06 },
  goalieModel: { volatilityIndex: 1, blowupRisk: 0.1, confidenceTier: "MEDIUM", qualityTier: "AVERAGE", reliabilityTier: "MEDIUM", recommendation: "START" },
  evidence: { recentStarts: 10, recentShotsAgainst: 300, seasonStarts: 10, seasonShotsAgainst: 300, baselineStarts: 50, baselineShotsAgainst: 1500 },
  workload: { startsLast7Days: 2, startsLast14Days: 4, daysSinceLastStart: 2, isGoalieBackToBack: false },
  workloadSavePctPenalty: 0, restSplitBucket: "2", restSplitBucketGames: null, restSplitBucketSavePct: null,
  restSplitSavePctAdjustment: 0, restSplitProfile: null, adjustedLeagueSavePct: 0.9, horizonGames: 3,
  goalieHorizonScalars: [1, 0.985, 0.97], selectedGoalieId: 8471, starterProb: 0.8, scenarioProjections: [],
  goalieHorizonTotalScalar: 2.955, shotsAgainst: 30, starterModelMeta: {},
} as unknown as Parameters<typeof buildGoalieUncertaintyWithModel>[0];

describe("goalie scenario metadata horizon basis (decision 28)", () => {
  it("keeps win and shutout probabilities per game while counts are horizon totals", () => {
    const blended = (buildGoalieUncertaintyWithModel(args).model as any).scenario_metadata.blended_projection;
    expect(blended.proj_win_prob).toBe(0.55);
    expect(blended.proj_shutout_prob).toBe(0.06);
    expect(blended.proj_saves).toBe(Number((27 * 2.955).toFixed(3)));
    expect(blended.value_basis).toEqual({ counts: "horizon_total", probabilities: "per_game" });
  });
});
