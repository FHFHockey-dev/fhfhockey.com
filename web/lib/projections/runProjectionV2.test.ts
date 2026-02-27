import { describe, expect, it } from "vitest";

import {
  buildSequentialHorizonScalarsFromDates,
  blendTopStarterScenarioOutputs,
  buildTopStarterScenarios,
  computeGoalieRestSplitSavePctAdjustment,
  computeNstOpponentDangerAdjustment,
  computeTeamFiveOnFiveContextAdjustment,
  computeTeamStrengthContextAdjustment,
  assessLineCombinationRecency,
  buildSkaterRoleTags,
  normalizeWgoToiToSeconds,
  blendToiSecondsWithDeploymentPrior,
  computeSkaterShotQualityAdjustments,
  computeSkaterOnIceContextAdjustments,
  computeSkaterTeamLevelContextAdjustments,
  computeSkaterOpponentGoalieContextAdjustments,
  computeSkaterRestScheduleAdjustments,
  computeSkaterSampleShrinkageAdjustments,
  computeStrengthSplitConversionRates,
  allocatePpToiByTeamOpportunity,
  computeTeammateAssistCoupling,
  applyRoleSpecificUsageBounds,
  mergeSkaterCandidatePoolForRecovery,
  computeSkaterTeamToiTargetWithPoolGuard,
  validateReconciledPlayerDistribution,
  buildSkaterRoleScenarios,
  blendSkaterScenarioStatLines,
  blendSkaterScenarioStatLinesAcrossHorizon,
  buildSkaterScenarioMetadata,
  summarizeSkaterRoleContinuity,
  computeSkaterRoleStabilityMultiplier,
  availabilityMultiplierForEvent,
  filterActiveSkaterCandidateIds,
  computeStarterProbabilities,
  selectStarterCandidateGoalieIds,
  toGoalieRestSplitBucket,
  type StarterContextForTest
} from "./runProjectionV2";

function buildContext(
  overrides?: Partial<StarterContextForTest>
): StarterContextForTest {
  return {
    startsByGoalie: new Map<number, number>(),
    lastPlayedDateByGoalie: new Map<number, string>(),
    totalGames: 10,
    previousGameDate: null,
    previousGameStarterGoalieId: null,
    ...overrides
  };
}

describe("starter probability heuristics", () => {
  it("suppresses the previous-game starter on game 2 of a back-to-back", () => {
    const starterA = 1001;
    const starterB = 1002;
    const context = buildContext({
      startsByGoalie: new Map([
        [starterA, 5],
        [starterB, 5]
      ]),
      lastPlayedDateByGoalie: new Map([
        [starterA, "2026-02-06"],
        [starterB, "2026-02-03"]
      ]),
      previousGameDate: "2026-02-06",
      previousGameStarterGoalieId: starterA
    });

    const probs = computeStarterProbabilities({
      asOfDate: "2026-02-07",
      candidateGoalieIds: [starterA, starterB],
      starterContext: context,
      priorStartProbByGoalieId: new Map([
        [starterA, 0.5],
        [starterB, 0.5]
      ]),
      teamGoalsFor: 2.8,
      opponentGoalsFor: 3.1
    });

    expect((probs.get(starterA) ?? 0)).toBeLessThan(probs.get(starterB) ?? 0);
  });

  it("heavily penalizes stale goalies after 30+ days", () => {
    const stale = 2001;
    const active = 2002;
    const context = buildContext({
      startsByGoalie: new Map([
        [stale, 7],
        [active, 3]
      ]),
      lastPlayedDateByGoalie: new Map([
        [stale, "2025-12-20"],
        [active, "2026-02-05"]
      ]),
      previousGameDate: "2026-02-05",
      previousGameStarterGoalieId: active
    });

    const probs = computeStarterProbabilities({
      asOfDate: "2026-02-07",
      candidateGoalieIds: [stale, active],
      starterContext: context,
      priorStartProbByGoalieId: new Map([
        [stale, 0.6],
        [active, 0.4]
      ]),
      teamGoalsFor: 2.7,
      opponentGoalsFor: 2.9
    });

    expect((probs.get(stale) ?? 0)).toBeLessThan(0.2);
    expect((probs.get(active) ?? 0)).toBeGreaterThan(0.8);
  });

  it("applies line-combo recency prior as a soft starter boost", () => {
    const goalieA = 2101;
    const goalieB = 2102;
    const context = buildContext({
      startsByGoalie: new Map([
        [goalieA, 5],
        [goalieB, 5]
      ]),
      lastPlayedDateByGoalie: new Map([
        [goalieA, "2026-02-05"],
        [goalieB, "2026-02-05"]
      ]),
      previousGameDate: "2026-02-05",
      previousGameStarterGoalieId: goalieA
    });

    const withoutLineCombo = computeStarterProbabilities({
      asOfDate: "2026-02-07",
      candidateGoalieIds: [goalieA, goalieB],
      starterContext: context,
      priorStartProbByGoalieId: new Map([
        [goalieA, 0.5],
        [goalieB, 0.5]
      ]),
      teamGoalsFor: 3,
      opponentGoalsFor: 3
    });
    const withLineCombo = computeStarterProbabilities({
      asOfDate: "2026-02-07",
      candidateGoalieIds: [goalieA, goalieB],
      starterContext: context,
      priorStartProbByGoalieId: new Map([
        [goalieA, 0.5],
        [goalieB, 0.5]
      ]),
      lineComboPriorByGoalieId: new Map([
        [goalieA, 0.85],
        [goalieB, 0.15]
      ]),
      teamGoalsFor: 3,
      opponentGoalsFor: 3
    });

    expect((withLineCombo.get(goalieA) ?? 0)).toBeGreaterThan(
      withoutLineCombo.get(goalieA) ?? 0
    );
    expect((withLineCombo.get(goalieA) ?? 0)).toBeLessThan(0.95);
  });

  it("uses projected GSAA/60 and season start share as soft priors", () => {
    const goalieA = 2201;
    const goalieB = 2202;
    const context = buildContext({
      startsByGoalie: new Map([
        [goalieA, 5],
        [goalieB, 5]
      ]),
      lastPlayedDateByGoalie: new Map([
        [goalieA, "2026-02-05"],
        [goalieB, "2026-02-05"]
      ])
    });

    const base = computeStarterProbabilities({
      asOfDate: "2026-02-07",
      candidateGoalieIds: [goalieA, goalieB],
      starterContext: context,
      priorStartProbByGoalieId: new Map([
        [goalieA, 0.5],
        [goalieB, 0.5]
      ]),
      teamGoalsFor: 3,
      opponentGoalsFor: 3
    });
    const withQualityPriors = computeStarterProbabilities({
      asOfDate: "2026-02-07",
      candidateGoalieIds: [goalieA, goalieB],
      starterContext: context,
      priorStartProbByGoalieId: new Map([
        [goalieA, 0.5],
        [goalieB, 0.5]
      ]),
      projectedGsaaPer60ByGoalieId: new Map([
        [goalieA, 0.28],
        [goalieB, -0.2]
      ]),
      seasonStartPctByGoalieId: new Map([
        [goalieA, 0.66],
        [goalieB, 0.41]
      ]),
      seasonGamesPlayedByGoalieId: new Map([
        [goalieA, 36],
        [goalieB, 14]
      ]),
      teamGoalsFor: 3,
      opponentGoalsFor: 3
    });

    expect((withQualityPriors.get(goalieA) ?? 0)).toBeGreaterThan(
      base.get(goalieA) ?? 0
    );
  });
});

describe("starter candidate filtering", () => {
  it("removes non-current-team goalies and very stale options", () => {
    const legacyGoalie = 3001;
    const staleGoalie = 3002;
    const activeGoalie = 3003;
    const context = buildContext({
      startsByGoalie: new Map([
        [legacyGoalie, 6],
        [staleGoalie, 2],
        [activeGoalie, 2]
      ]),
      lastPlayedDateByGoalie: new Map([
        [legacyGoalie, "2026-02-01"],
        [staleGoalie, "2025-11-01"],
        [activeGoalie, "2026-02-06"]
      ])
    });

    const candidates = selectStarterCandidateGoalieIds({
      asOfDate: "2026-02-07",
      rawCandidateGoalieIds: [legacyGoalie, staleGoalie, activeGoalie],
      currentTeamGoalieIds: new Set([staleGoalie, activeGoalie]),
      context,
      limit: 3
    });

    expect(candidates).toContain(activeGoalie);
    expect(candidates).not.toContain(legacyGoalie);
    expect(candidates).not.toContain(staleGoalie);
  });
});

describe("deployment TOI prior helpers", () => {
  it("normalizes minute-based WGO TOI values to seconds", () => {
    expect(normalizeWgoToiToSeconds(15)).toBe(900);
    expect(normalizeWgoToiToSeconds(22.5)).toBe(1350);
  });

  it("keeps second-like WGO TOI values in seconds", () => {
    expect(normalizeWgoToiToSeconds(960)).toBe(960);
  });

  it("returns null for invalid or non-positive WGO TOI values", () => {
    expect(normalizeWgoToiToSeconds(null)).toBeNull();
    expect(normalizeWgoToiToSeconds(undefined)).toBeNull();
    expect(normalizeWgoToiToSeconds(0)).toBeNull();
    expect(normalizeWgoToiToSeconds(-5)).toBeNull();
  });

  it("blends rolling TOI with deployment prior using provided weight", () => {
    const blended = blendToiSecondsWithDeploymentPrior({
      rollingSeconds: 900,
      deploymentPriorSeconds: 780,
      rollingWeight: 0.8
    });
    expect(blended).toBe(876);
  });

  it("falls back to whichever source exists when one side is missing", () => {
    expect(
      blendToiSecondsWithDeploymentPrior({
        rollingSeconds: null,
        deploymentPriorSeconds: 720,
        rollingWeight: 0.8
      })
    ).toBe(720);
    expect(
      blendToiSecondsWithDeploymentPrior({
        rollingSeconds: 840,
        deploymentPriorSeconds: null,
        rollingWeight: 0.8
      })
    ).toBe(840);
  });
});

describe("skater shot-quality adjustments", () => {
  it("returns neutral multipliers when no profile exists", () => {
    const result = computeSkaterShotQualityAdjustments({ profile: null });
    expect(result.shotRateMultiplier).toBe(1);
    expect(result.goalRateMultiplier).toBe(1);
    expect(result.sampleWeight).toBe(0);
  });

  it("boosts goal conversion and shot rate for strong ixG + rush/rebound profiles", () => {
    const result = computeSkaterShotQualityAdjustments({
      profile: {
        sourceDate: "2026-02-05",
        nstShotsPer60: 10.2,
        nstIxgPer60: 1.15,
        nstRushAttemptsPer60: 0.9,
        nstReboundsCreatedPer60: 0.7
      }
    });
    expect(result.sampleWeight).toBeGreaterThan(0.6);
    expect(result.shotRateMultiplier).toBeGreaterThan(1);
    expect(result.goalRateMultiplier).toBeGreaterThan(1);
    expect(result.qualityPerShot).toBeGreaterThan(0.1);
  });

  it("penalizes weak shot-quality profiles", () => {
    const result = computeSkaterShotQualityAdjustments({
      profile: {
        sourceDate: "2026-02-05",
        nstShotsPer60: 7.4,
        nstIxgPer60: 0.45,
        nstRushAttemptsPer60: 0.2,
        nstReboundsCreatedPer60: 0.1
      }
    });
    expect(result.goalRateMultiplier).toBeLessThan(1);
    expect(result.shotRateMultiplier).toBeLessThanOrEqual(1);
  });
});

describe("skater on-ice context adjustments", () => {
  it("returns neutral multipliers without a profile", () => {
    const result = computeSkaterOnIceContextAdjustments({ profile: null });
    expect(result.shotEnvironmentMultiplier).toBe(1);
    expect(result.goalEnvironmentMultiplier).toBe(1);
    expect(result.assistEnvironmentMultiplier).toBe(1);
    expect(result.sampleWeight).toBe(0);
  });

  it("boosts environment multipliers for strong on-ice xG and possession", () => {
    const result = computeSkaterOnIceContextAdjustments({
      profile: {
        sourceDate: "2026-02-05",
        nstOiXgfPer60: 3.1,
        nstOiXgaPer60: 2.0,
        nstOiCfPct: 56.2,
        possessionPctSafe: null
      }
    });
    expect(result.sampleWeight).toBeGreaterThan(0.6);
    expect(result.shotEnvironmentMultiplier).toBeGreaterThan(1);
    expect(result.goalEnvironmentMultiplier).toBeGreaterThan(1);
    expect(result.assistEnvironmentMultiplier).toBeGreaterThan(1);
  });

  it("penalizes environment for poor on-ice xG and possession", () => {
    const result = computeSkaterOnIceContextAdjustments({
      profile: {
        sourceDate: "2026-02-05",
        nstOiXgfPer60: 1.9,
        nstOiXgaPer60: 3.0,
        nstOiCfPct: 44.1,
        possessionPctSafe: null
      }
    });
    expect(result.shotEnvironmentMultiplier).toBeLessThan(1);
    expect(result.goalEnvironmentMultiplier).toBeLessThan(1);
    expect(result.assistEnvironmentMultiplier).toBeLessThan(1);
  });
});

describe("skater team-level context adjustments", () => {
  it("returns neutral multipliers when no team context is available", () => {
    const result = computeSkaterTeamLevelContextAdjustments({
      teamStrengthPrior: null,
      opponentStrengthPrior: null,
      teamFiveOnFiveProfile: null,
      opponentFiveOnFiveProfile: null,
      teamNstProfile: null,
      opponentNstProfile: null
    });
    expect(result.sampleWeight).toBe(0);
    expect(result.shotRateMultiplier).toBe(1);
    expect(result.goalRateMultiplier).toBe(1);
    expect(result.assistRateMultiplier).toBe(1);
  });

  it("boosts multipliers in favorable offense + opponent-defense environments", () => {
    const result = computeSkaterTeamLevelContextAdjustments({
      teamStrengthPrior: {
        sourceDate: "2026-02-05",
        xga: 120,
        xgaPerGame: 2.7,
        xgfPerGame: 3.35
      },
      opponentStrengthPrior: {
        sourceDate: "2026-02-05",
        xga: 140,
        xgaPerGame: 3.45,
        xgfPerGame: 2.85
      },
      teamFiveOnFiveProfile: {
        sourceDate: "2026-02-05",
        gamesPlayed: 50,
        savePct5v5: 0.922,
        shootingPlusSavePct5v5: 1.03
      },
      opponentFiveOnFiveProfile: {
        sourceDate: "2026-02-05",
        gamesPlayed: 50,
        savePct5v5: 0.905,
        shootingPlusSavePct5v5: 0.98
      },
      teamNstProfile: {
        source: "nst_team_all",
        sourceDate: "2026-02-05",
        gamesPlayed: 50,
        xga: 125,
        xgaPer60: 2.8
      },
      opponentNstProfile: {
        source: "nst_team_all",
        sourceDate: "2026-02-05",
        gamesPlayed: 50,
        xga: 132,
        xgaPer60: 2.95
      }
    });
    expect(result.sampleWeight).toBeGreaterThan(0.6);
    expect(result.shotRateMultiplier).toBeGreaterThan(1);
    expect(result.goalRateMultiplier).toBeGreaterThan(1);
    expect(result.assistRateMultiplier).toBeGreaterThan(1);
  });

  it("penalizes multipliers in weak offense + strong-opponent-defense environments", () => {
    const result = computeSkaterTeamLevelContextAdjustments({
      teamStrengthPrior: {
        sourceDate: "2026-02-05",
        xga: 120,
        xgaPerGame: 2.9,
        xgfPerGame: 2.45
      },
      opponentStrengthPrior: {
        sourceDate: "2026-02-05",
        xga: 115,
        xgaPerGame: 2.35,
        xgfPerGame: 3.1
      },
      teamFiveOnFiveProfile: {
        sourceDate: "2026-02-05",
        gamesPlayed: 50,
        savePct5v5: 0.918,
        shootingPlusSavePct5v5: 0.97
      },
      opponentFiveOnFiveProfile: {
        sourceDate: "2026-02-05",
        gamesPlayed: 50,
        savePct5v5: 0.935,
        shootingPlusSavePct5v5: 1.02
      },
      teamNstProfile: {
        source: "nst_team_all",
        sourceDate: "2026-02-05",
        gamesPlayed: 50,
        xga: 116,
        xgaPer60: 2.2
      },
      opponentNstProfile: {
        source: "nst_team_all",
        sourceDate: "2026-02-05",
        gamesPlayed: 50,
        xga: 115,
        xgaPer60: 2.1
      }
    });
    expect(result.shotRateMultiplier).toBeLessThan(1);
    expect(result.goalRateMultiplier).toBeLessThan(1);
    expect(result.assistRateMultiplier).toBeLessThan(1);
  });
});

describe("skater opponent-goalie context adjustments", () => {
  it("returns neutral multipliers with no opponent goalie context", () => {
    const result = computeSkaterOpponentGoalieContextAdjustments({
      context: null
    });
    expect(result.sampleWeight).toBe(0);
    expect(result.goalRateMultiplier).toBe(1);
    expect(result.assistRateMultiplier).toBe(1);
  });

  it("penalizes scoring when likely opponent starter projects strong", () => {
    const result = computeSkaterOpponentGoalieContextAdjustments({
      context: {
        source: "goalie_start_projections",
        weightedProjectedGsaaPer60: 0.32,
        topStarterProbability: 0.82,
        probabilityMass: 0.95,
        isConfirmedStarter: true
      }
    });
    expect(result.sampleWeight).toBeGreaterThan(0.8);
    expect(result.goalRateMultiplier).toBeLessThan(1);
    expect(result.assistRateMultiplier).toBeLessThan(1);
  });

  it("boosts scoring when likely opponent starter projects weak", () => {
    const result = computeSkaterOpponentGoalieContextAdjustments({
      context: {
        source: "goalie_start_projections",
        weightedProjectedGsaaPer60: -0.28,
        topStarterProbability: 0.74,
        probabilityMass: 0.92,
        isConfirmedStarter: false
      }
    });
    expect(result.sampleWeight).toBeGreaterThan(0.5);
    expect(result.goalRateMultiplier).toBeGreaterThan(1);
    expect(result.assistRateMultiplier).toBeGreaterThan(1);
  });
});

describe("skater rest/schedule adjustments", () => {
  it("returns neutral multipliers when rest context is unavailable", () => {
    const result = computeSkaterRestScheduleAdjustments({
      teamRestDays: null,
      opponentRestDays: null,
      isHome: false
    });
    expect(result.sampleWeight).toBe(0);
    expect(result.toiMultiplier).toBe(1);
    expect(result.shotRateMultiplier).toBe(1);
    expect(result.goalRateMultiplier).toBe(1);
    expect(result.assistRateMultiplier).toBe(1);
  });

  it("penalizes on second leg of back-to-back against rested opponent", () => {
    const result = computeSkaterRestScheduleAdjustments({
      teamRestDays: 0,
      opponentRestDays: 2,
      isHome: false
    });
    expect(result.sampleWeight).toBe(1);
    expect(result.toiMultiplier).toBeLessThan(1);
    expect(result.shotRateMultiplier).toBeLessThan(1);
    expect(result.goalRateMultiplier).toBeLessThan(1);
    expect(result.assistRateMultiplier).toBeLessThan(1);
  });

  it("boosts rested home team versus opponent on back-to-back", () => {
    const result = computeSkaterRestScheduleAdjustments({
      teamRestDays: 2,
      opponentRestDays: 0,
      isHome: true
    });
    expect(result.toiMultiplier).toBeGreaterThan(1);
    expect(result.shotRateMultiplier).toBeGreaterThan(1);
    expect(result.goalRateMultiplier).toBeGreaterThan(1);
    expect(result.assistRateMultiplier).toBeGreaterThan(1);
  });
});

describe("skater small-sample shrinkage adjustments", () => {
  it("flags low sample and callup fallback with sparse evidence", () => {
    const result = computeSkaterSampleShrinkageAdjustments({
      evToiSecondsAll: 210,
      ppToiSecondsAll: 40,
      evShotsAll: 5,
      ppShotsAll: 1
    });
    expect(result.sampleWeight).toBeLessThan(0.25);
    expect(result.isLowSample).toBe(true);
    expect(result.usedCallupFallback).toBe(true);
  });

  it("returns strong sample weight for established skaters", () => {
    const result = computeSkaterSampleShrinkageAdjustments({
      evToiSecondsAll: 1450,
      ppToiSecondsAll: 380,
      evShotsAll: 85,
      ppShotsAll: 22
    });
    expect(result.sampleWeight).toBeGreaterThan(0.6);
    expect(result.isLowSample).toBe(false);
    expect(result.usedCallupFallback).toBe(false);
  });
});

describe("strength-split conversion rates", () => {
  it("models PP goal rate above ES goal rate when PP shot conversion evidence is stronger", () => {
    const result = computeStrengthSplitConversionRates({
      evGoalsRecent: 1,
      evShotsRecent: 16,
      evGoalsAll: 8,
      evShotsAll: 120,
      evAssistsRecent: 2,
      evAssistsAll: 18,
      ppGoalsRecent: 2,
      ppShotsRecent: 10,
      ppGoalsAll: 9,
      ppShotsAll: 52,
      ppAssistsRecent: 2,
      ppAssistsAll: 11,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1
    });
    expect(result.goalRatePp).toBeGreaterThan(result.goalRateEs);
  });

  it("applies external multipliers independently to split rates", () => {
    const base = computeStrengthSplitConversionRates({
      evGoalsRecent: 1,
      evShotsRecent: 14,
      evGoalsAll: 7,
      evShotsAll: 110,
      evAssistsRecent: 2,
      evAssistsAll: 16,
      ppGoalsRecent: 1,
      ppShotsRecent: 8,
      ppGoalsAll: 6,
      ppShotsAll: 45,
      ppAssistsRecent: 2,
      ppAssistsAll: 10,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1
    });
    const boosted = computeStrengthSplitConversionRates({
      evGoalsRecent: 1,
      evShotsRecent: 14,
      evGoalsAll: 7,
      evShotsAll: 110,
      evAssistsRecent: 2,
      evAssistsAll: 16,
      ppGoalsRecent: 1,
      ppShotsRecent: 8,
      ppGoalsAll: 6,
      ppShotsAll: 45,
      ppAssistsRecent: 2,
      ppAssistsAll: 10,
      goalRateMultiplier: 1.1,
      assistRateMultiplier: 1.08
    });
    expect(boosted.goalRateEs).toBeGreaterThan(base.goalRateEs);
    expect(boosted.goalRatePp).toBeGreaterThan(base.goalRatePp);
    expect(boosted.assistRateEs).toBeGreaterThan(base.assistRateEs);
    expect(boosted.assistRatePp).toBeGreaterThan(base.assistRatePp);
  });

  it("applies stronger shrinkage for tiny samples than for established samples", () => {
    const lowSample = computeStrengthSplitConversionRates({
      evGoalsRecent: 1,
      evShotsRecent: 1,
      evGoalsAll: 1,
      evShotsAll: 1,
      evAssistsRecent: 0,
      evAssistsAll: 0,
      ppGoalsRecent: 1,
      ppShotsRecent: 1,
      ppGoalsAll: 1,
      ppShotsAll: 1,
      ppAssistsRecent: 0,
      ppAssistsAll: 0,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1
    });
    const established = computeStrengthSplitConversionRates({
      evGoalsRecent: 1,
      evShotsRecent: 1,
      evGoalsAll: 18,
      evShotsAll: 95,
      evAssistsRecent: 0,
      evAssistsAll: 20,
      ppGoalsRecent: 1,
      ppShotsRecent: 1,
      ppGoalsAll: 10,
      ppShotsAll: 48,
      ppAssistsRecent: 0,
      ppAssistsAll: 12,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1
    });

    expect(lowSample.goalRateEs).toBeLessThan(established.goalRateEs);
    expect(lowSample.goalRatePp).toBeLessThan(established.goalRatePp);
  });
});

describe("pp opportunity allocation", () => {
  it("allocates team PP TOI target across skaters using role-weighted shares", () => {
    const allocation = allocatePpToiByTeamOpportunity({
      projectedByPlayer: new Map([
        [
          1,
          {
            toiPp: 220,
            roleTag: {
              esRole: "L1",
              unitTier: "TOP",
              roleRank: 1,
              source: "line_combination"
            }
          }
        ],
        [
          2,
          {
            toiPp: 120,
            roleTag: {
              esRole: "L2",
              unitTier: "MIDDLE",
              roleRank: 5,
              source: "line_combination"
            }
          }
        ],
        [
          3,
          {
            toiPp: 35,
            roleTag: {
              esRole: "L4",
              unitTier: "DEPTH",
              roleRank: 11,
              source: "line_combination"
            }
          }
        ]
      ]),
      targetTeamPpSeconds: 540
    });
    const total = Array.from(allocation.perPlayerPpToiSeconds.values()).reduce(
      (acc, n) => acc + n,
      0
    );
    expect(Math.round(total)).toBe(540);
    expect((allocation.perPlayerPpToiSeconds.get(1) ?? 0)).toBeGreaterThan(
      allocation.perPlayerPpToiSeconds.get(2) ?? 0
    );
    expect((allocation.perPlayerPpToiSeconds.get(2) ?? 0)).toBeGreaterThan(
      allocation.perPlayerPpToiSeconds.get(3) ?? 0
    );
  });
});

describe("teammate assist coupling", () => {
  it("boosts assist dependency for top-unit players with strong line/PP share", () => {
    const result = computeTeammateAssistCoupling({
      roleTag: {
        esRole: "L1",
        unitTier: "TOP",
        roleRank: 1,
        source: "line_combination"
      },
      playerShotsEs: 4.2,
      lineGroupShotsEs: 14.5,
      teamShotsEs: 30.1,
      playerPpShare: 0.28
    });
    expect(result.dependencyScore).toBeGreaterThan(0.2);
    expect(result.assistRateEsMultiplier).toBeGreaterThan(1);
    expect(result.assistRatePpMultiplier).toBeGreaterThan(1);
  });

  it("penalizes assist dependency for depth players with low teammate context", () => {
    const result = computeTeammateAssistCoupling({
      roleTag: {
        esRole: "L4",
        unitTier: "DEPTH",
        roleRank: 12,
        source: "line_combination"
      },
      playerShotsEs: 2.1,
      lineGroupShotsEs: 3.2,
      teamShotsEs: 31.8,
      playerPpShare: 0.03
    });
    expect(result.assistRateEsMultiplier).toBeLessThan(1);
    expect(result.assistRatePpMultiplier).toBeLessThan(1);
  });
});

describe("role-specific usage bounds", () => {
  it("caps depth skater TOI/shot spikes", () => {
    const bounded = applyRoleSpecificUsageBounds({
      roleTag: {
        esRole: "L4",
        unitTier: "DEPTH",
        roleRank: 12,
        source: "line_combination"
      },
      toiEsSeconds: 1200,
      toiPpSeconds: 320,
      sogPer60Es: 12.1,
      sogPer60Pp: 18.4
    });
    expect(bounded.wasBounded).toBe(true);
    expect(bounded.toiEsSeconds).toBeLessThanOrEqual(940);
    expect(bounded.toiPpSeconds).toBeLessThanOrEqual(190);
    expect(bounded.sogPer60Es).toBeLessThanOrEqual(8.2);
    expect(bounded.sogPer60Pp).toBeLessThanOrEqual(13);
  });

  it("preserves top-role usage when already within bounds", () => {
    const bounded = applyRoleSpecificUsageBounds({
      roleTag: {
        esRole: "L1",
        unitTier: "TOP",
        roleRank: 1,
        source: "line_combination"
      },
      toiEsSeconds: 1080,
      toiPpSeconds: 230,
      sogPer60Es: 10.4,
      sogPer60Pp: 14.2
    });
    expect(bounded.wasBounded).toBe(false);
    expect(bounded.toiEsSeconds).toBe(1080);
    expect(bounded.toiPpSeconds).toBe(230);
  });
});

describe("skater pool recovery safeguards", () => {
  it("merges supplemental skaters without dropping original ordering", () => {
    const merged = mergeSkaterCandidatePoolForRecovery({
      baseSkaterIds: [1, 2, 3, 4],
      supplementalSkaterIds: [3, 5, 6, 7, 8],
      targetCount: 7
    });
    expect(merged).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("caps team skater TOI target when projected pool is undersized", () => {
    const guarded = computeSkaterTeamToiTargetWithPoolGuard({
      canonicalTargetSeconds: 18000,
      projectedSkaterCount: 7,
      ppShare: 0.11
    });
    expect(guarded.wasCapped).toBe(true);
    expect(guarded.targetSeconds).toBeLessThan(18000);
    expect(guarded.targetSeconds).toBeLessThanOrEqual(8400);
  });

  it("keeps canonical team skater TOI target for normal projected pool sizes", () => {
    const guarded = computeSkaterTeamToiTargetWithPoolGuard({
      canonicalTargetSeconds: 18000,
      projectedSkaterCount: 18,
      ppShare: 0.11
    });
    expect(guarded.wasCapped).toBe(false);
    expect(guarded.targetSeconds).toBe(18000);
  });
});

describe("reconciliation distribution validation", () => {
  it("keeps reconciled vectors unchanged when concentration is within limits", () => {
    const baseline = [
      { playerId: 1, toiEsSeconds: 560, toiPpSeconds: 145, shotsEs: 2.3, shotsPp: 0.75 },
      { playerId: 2, toiEsSeconds: 510, toiPpSeconds: 130, shotsEs: 2.0, shotsPp: 0.64 },
      { playerId: 3, toiEsSeconds: 460, toiPpSeconds: 115, shotsEs: 1.8, shotsPp: 0.57 },
      { playerId: 4, toiEsSeconds: 420, toiPpSeconds: 95, shotsEs: 1.6, shotsPp: 0.49 },
      { playerId: 5, toiEsSeconds: 330, toiPpSeconds: 70, shotsEs: 1.2, shotsPp: 0.38 },
      { playerId: 6, toiEsSeconds: 260, toiPpSeconds: 45, shotsEs: 0.9, shotsPp: 0.26 }
    ];
    const result = validateReconciledPlayerDistribution({
      baselinePlayers: baseline,
      reconciledPlayers: baseline,
      targets: {
        toiEsSeconds: 2540,
        toiPpSeconds: 600,
        shotsEs: 9.8,
        shotsPp: 3.09
      }
    });
    expect(result.wasAdjusted).toBe(false);
    expect(result.players[0].toiEsSeconds).toBe(560);
  });

  it("blends and renormalizes when one player dominates ES/PP share", () => {
    const baseline = [
      { playerId: 1, toiEsSeconds: 980, toiPpSeconds: 260, shotsEs: 4.2, shotsPp: 1.4 },
      { playerId: 2, toiEsSeconds: 840, toiPpSeconds: 210, shotsEs: 3.4, shotsPp: 1.0 },
      { playerId: 3, toiEsSeconds: 720, toiPpSeconds: 170, shotsEs: 2.8, shotsPp: 0.8 }
    ];
    const extreme = [
      { playerId: 1, toiEsSeconds: 1800, toiPpSeconds: 520, shotsEs: 8.2, shotsPp: 2.5 },
      { playerId: 2, toiEsSeconds: 420, toiPpSeconds: 55, shotsEs: 1.5, shotsPp: 0.35 },
      { playerId: 3, toiEsSeconds: 320, toiPpSeconds: 25, shotsEs: 1.1, shotsPp: 0.2 }
    ];
    const result = validateReconciledPlayerDistribution({
      baselinePlayers: baseline,
      reconciledPlayers: extreme,
      targets: {
        toiEsSeconds: 2540,
        toiPpSeconds: 600,
        shotsEs: 10.8,
        shotsPp: 3.2
      }
    });
    const totalEs = result.players.reduce((acc, p) => acc + p.toiEsSeconds, 0);
    const totalPp = result.players.reduce((acc, p) => acc + p.toiPpSeconds, 0);
    expect(result.wasAdjusted).toBe(true);
    expect(Math.round(totalEs)).toBe(2540);
    expect(Math.round(totalPp)).toBe(600);
    expect(result.topEsShareAfter).toBeLessThan(0.6);
  });
});

describe("skater role scenarios", () => {
  it("builds normalized top scenarios from role continuity", () => {
    const scenarios = buildSkaterRoleScenarios({
      roleTag: {
        esRole: "L1",
        unitTier: "TOP",
        roleRank: 1,
        source: "line_combination"
      },
      roleContinuity: {
        windowGames: 10,
        appearancesTracked: 10,
        gamesInCurrentRole: 8,
        continuityShare: 0.8,
        roleChangeRate: 0.2,
        volatilityIndex: 0.2
      }
    });
    const total = scenarios.reduce((acc, s) => acc + s.probability, 0);
    expect(scenarios.length).toBeGreaterThan(1);
    expect(Math.round(total * 1000)).toBe(1000);
    expect(scenarios[0].role).toBe("L1");
  });

  it("produces meaningful alternate scenarios under volatility", () => {
    const scenarios = buildSkaterRoleScenarios({
      roleTag: {
        esRole: "D2",
        unitTier: "MIDDLE",
        roleRank: 4,
        source: "line_combination"
      },
      roleContinuity: {
        windowGames: 8,
        appearancesTracked: 8,
        gamesInCurrentRole: 3,
        continuityShare: 0.375,
        roleChangeRate: 0.57,
        volatilityIndex: 0.5
      }
    });
    expect(scenarios.some((s) => s.role === "D3")).toBe(true);
    expect((scenarios[0]?.probability ?? 0)).toBeLessThan(0.8);
  });
});

describe("skater scenario stat blending", () => {
  it("returns base outputs when scenarios are absent", () => {
    const result = blendSkaterScenarioStatLines({
      currentRole: "L2",
      scenarios: [],
      baseGoalsEs: 0.42,
      baseGoalsPp: 0.16,
      baseAssistsEs: 0.33,
      baseAssistsPp: 0.18
    });
    expect(result.blended.goalsEs).toBe(0.42);
    expect(result.blended.goalsPp).toBe(0.16);
    expect(result.scenarioLines.length).toBe(0);
  });

  it("blends scenario lines by probability", () => {
    const result = blendSkaterScenarioStatLines({
      currentRole: "L2",
      scenarios: [
        { role: "L2", probability: 0.7, source: "current_role" },
        { role: "L1", probability: 0.3, source: "adjacent_role" }
      ],
      baseGoalsEs: 0.5,
      baseGoalsPp: 0.2,
      baseAssistsEs: 0.45,
      baseAssistsPp: 0.25
    });
    expect(result.scenarioLines.length).toBe(2);
    expect(result.blended.goalsEs).toBeGreaterThan(0.5);
    expect(result.blended.assistsEs).toBeGreaterThan(0.45);
  });

  it("matches exact weighted expectation for explicit two-scenario mixture", () => {
    const result = blendSkaterScenarioStatLines({
      currentRole: "L2",
      scenarios: [
        { role: "L2", probability: 0.6, source: "current_role" },
        { role: "L3", probability: 0.4, source: "adjacent_role" }
      ],
      baseGoalsEs: 0.5,
      baseGoalsPp: 0.25,
      baseAssistsEs: 0.4,
      baseAssistsPp: 0.2
    });
    // L2 keeps baseline (multiplier 1). L3 is one rank lower (goal*0.93 assist*0.91).
    const expectedGoalsEs = 0.6 * 0.5 + 0.4 * (0.5 * 0.93);
    const expectedAssistsEs = 0.6 * 0.4 + 0.4 * (0.4 * 0.91);
    expect(result.blended.goalsEs).toBeCloseTo(expectedGoalsEs, 4);
    expect(result.blended.assistsEs).toBeCloseTo(expectedAssistsEs, 4);
  });
});

describe("horizon scenario propagation", () => {
  it("returns per-game scenario summaries matching horizon length", () => {
    const result = blendSkaterScenarioStatLinesAcrossHorizon({
      currentRole: "L1",
      scenarios: [
        { role: "L1", probability: 0.78, source: "current_role" },
        { role: "L2", probability: 0.22, source: "adjacent_role" }
      ],
      baseGoalsEs: 0.65,
      baseGoalsPp: 0.26,
      baseAssistsEs: 0.61,
      baseAssistsPp: 0.33,
      horizonScalars: [1, 0.92, 0.84],
      roleContinuity: {
        windowGames: 10,
        appearancesTracked: 10,
        gamesInCurrentRole: 7,
        continuityShare: 0.7,
        roleChangeRate: 0.2,
        volatilityIndex: 0.25
      }
    });
    expect(result.horizonScenarioSummaries.length).toBe(3);
    expect(result.horizonScenarioSummaries[0]?.topRole).toBe("L1");
  });

  it("softens top-role certainty deeper into horizon", () => {
    const result = blendSkaterScenarioStatLinesAcrossHorizon({
      currentRole: "L1",
      scenarios: [
        { role: "L1", probability: 0.88, source: "current_role" },
        { role: "L2", probability: 0.12, source: "adjacent_role" }
      ],
      baseGoalsEs: 0.6,
      baseGoalsPp: 0.24,
      baseAssistsEs: 0.56,
      baseAssistsPp: 0.29,
      horizonScalars: [1, 0.91, 0.83, 0.78],
      roleContinuity: {
        windowGames: 10,
        appearancesTracked: 10,
        gamesInCurrentRole: 8,
        continuityShare: 0.8,
        roleChangeRate: 0.1,
        volatilityIndex: 0.2
      }
    });
    const firstTop = result.horizonScenarioSummaries[0]?.topProbability ?? 0;
    const lastTop =
      result.horizonScenarioSummaries[result.horizonScenarioSummaries.length - 1]
        ?.topProbability ?? 0;
    expect(lastTop).toBeLessThan(firstTop);
  });

  it("preserves total blended mass near base means for neutral role scenarios", () => {
    const result = blendSkaterScenarioStatLinesAcrossHorizon({
      currentRole: "L2",
      scenarios: [
        { role: "L2", probability: 0.5, source: "current_role" },
        { role: "L2", probability: 0.5, source: "adjacent_role" }
      ],
      baseGoalsEs: 0.44,
      baseGoalsPp: 0.2,
      baseAssistsEs: 0.38,
      baseAssistsPp: 0.24,
      horizonScalars: [1, 0.93, 0.88],
      roleContinuity: null
    });
    expect(result.blended.goalsEs).toBeCloseTo(0.44, 4);
    expect(result.blended.assistsPp).toBeCloseTo(0.24, 4);
  });
});

describe("skater scenario metadata", () => {
  it("produces model version, count, and sorted top drivers", () => {
    const metadata = buildSkaterScenarioMetadata({
      scenarios: [
        { role: "L2", probability: 0.22, source: "adjacent_role" },
        { role: "L1", probability: 0.68, source: "current_role" },
        { role: "L4", probability: 0.1, source: "depth_fallback" }
      ]
    });
    expect(metadata.modelVersion).toBe("skater-role-scenario-v1");
    expect(metadata.scenarioCount).toBe(3);
    expect(metadata.topScenarioDrivers[0]?.role).toBe("L1");
    expect(metadata.topScenarioDrivers.length).toBe(3);
  });
});

describe("active skater filtering", () => {
  it("filters out non-team and goalie-position candidates", () => {
    const result = filterActiveSkaterCandidateIds({
      asOfDate: "2026-02-07",
      teamId: 5,
      rawSkaterIds: [1, 2, 3],
      playerMetaById: new Map([
        [1, { id: 1, team_id: 5, position: "C" }],
        [2, { id: 2, team_id: 8, position: "RW" }],
        [3, { id: 3, team_id: 5, position: "G" }]
      ]),
      latestMetricDateByPlayerId: new Map([[1, "2026-02-06"]])
    });

    expect(result.eligibleSkaterIds).toEqual([1]);
    expect(result.stats.filteredByTeamOrPosition).toBe(2);
  });

  it("hard-filters skaters with stale metrics beyond threshold and soft-penalizes mid-stale skaters", () => {
    const result = filterActiveSkaterCandidateIds({
      asOfDate: "2026-02-07",
      teamId: 5,
      rawSkaterIds: [11, 12, 13],
      playerMetaById: new Map([
        [11, { id: 11, team_id: 5, position: "LW" }],
        [12, { id: 12, team_id: 5, position: "RW" }],
        [13, { id: 13, team_id: 5, position: "D" }]
      ]),
      latestMetricDateByPlayerId: new Map([
        [11, "2026-02-06"],
        [12, "2026-01-10"],
        [13, "2025-11-20"]
      ])
    });

    expect(result.eligibleSkaterIds).toContain(11);
    expect(result.eligibleSkaterIds).toContain(12);
    expect(result.eligibleSkaterIds).not.toContain(13);
    expect(result.recencyMultiplierByPlayerId.get(11)).toBe(1);
    expect((result.recencyMultiplierByPlayerId.get(12) ?? 1)).toBeLessThan(1);
    expect(result.stats.softStalePenalized).toBe(1);
    expect(result.stats.filteredHardStale).toBe(1);
  });

  it("treats players with no recent metrics as inactive and excludes them", () => {
    const result = filterActiveSkaterCandidateIds({
      asOfDate: "2026-02-07",
      teamId: 10,
      rawSkaterIds: [51, 52],
      playerMetaById: new Map([
        [51, { id: 51, team_id: 10, position: "C" }],
        [52, { id: 52, team_id: 10, position: "LW" }]
      ]),
      latestMetricDateByPlayerId: new Map([[52, "2026-02-05"]])
    });

    expect(result.eligibleSkaterIds).toEqual([52]);
    expect(result.stats.filteredMissingRecentMetrics).toBe(1);
    expect(result.excludedSkaterIdsByReason.missingRecentMetrics).toEqual([51]);
  });
});

describe("line-combination recency assessment", () => {
  it("marks missing line combinations as hard stale", () => {
    const result = assessLineCombinationRecency({
      asOfDate: "2026-02-07",
      sourceGameDate: null
    });

    expect(result.isMissing).toBe(true);
    expect(result.isHardStale).toBe(true);
    expect(result.daysStale).toBeNull();
  });

  it("marks moderately old line combinations as soft stale only", () => {
    const result = assessLineCombinationRecency({
      asOfDate: "2026-02-07",
      sourceGameDate: "2026-01-27"
    });

    expect(result.isMissing).toBe(false);
    expect(result.isSoftStale).toBe(true);
    expect(result.isHardStale).toBe(false);
    expect(result.daysStale).toBe(11);
  });

  it("marks very old line combinations as hard stale", () => {
    const result = assessLineCombinationRecency({
      asOfDate: "2026-02-07",
      sourceGameDate: "2026-01-15"
    });

    expect(result.isSoftStale).toBe(true);
    expect(result.isHardStale).toBe(true);
    expect(result.daysStale).toBe(23);
  });

  it("keeps boundary-day line combinations out of hard-stale bucket", () => {
    const result = assessLineCombinationRecency({
      asOfDate: "2026-02-07",
      sourceGameDate: "2026-01-17"
    });

    expect(result.daysStale).toBe(21);
    expect(result.isSoftStale).toBe(true);
    expect(result.isHardStale).toBe(false);
  });
});

describe("skater role tagging", () => {
  it("assigns line/pair roles from line-combination ordering", () => {
    const roles = buildSkaterRoleTags({
      lineCombination: {
        gameId: 1,
        teamId: 55,
        forwards: [101, 102, 103, 104, 105, 106],
        defensemen: [201, 202, 203, 204],
        goalies: [301]
      },
      useFallbackRoles: false,
      fallbackRankedSkaterIds: [],
      teamId: 55,
      playerMetaById: new Map([
        [101, { id: 101, team_id: 55, position: "C" }],
        [102, { id: 102, team_id: 55, position: "LW" }],
        [103, { id: 103, team_id: 55, position: "RW" }],
        [104, { id: 104, team_id: 55, position: "C" }],
        [105, { id: 105, team_id: 55, position: "LW" }],
        [106, { id: 106, team_id: 55, position: "RW" }],
        [201, { id: 201, team_id: 55, position: "D" }],
        [202, { id: 202, team_id: 55, position: "D" }],
        [203, { id: 203, team_id: 55, position: "D" }],
        [204, { id: 204, team_id: 55, position: "D" }]
      ])
    });

    expect(roles.get(101)?.esRole).toBe("L1");
    expect(roles.get(104)?.esRole).toBe("L2");
    expect(roles.get(201)?.esRole).toBe("D1");
    expect(roles.get(203)?.esRole).toBe("D2");
    expect(roles.get(101)?.source).toBe("line_combination");
  });

  it("falls back to TOI-ranked roles when requested", () => {
    const roles = buildSkaterRoleTags({
      lineCombination: null,
      useFallbackRoles: true,
      fallbackRankedSkaterIds: [401, 402, 403, 404, 405, 406, 501, 502],
      teamId: 77,
      playerMetaById: new Map([
        [401, { id: 401, team_id: 77, position: "C" }],
        [402, { id: 402, team_id: 77, position: "LW" }],
        [403, { id: 403, team_id: 77, position: "RW" }],
        [404, { id: 404, team_id: 77, position: "C" }],
        [405, { id: 405, team_id: 77, position: "LW" }],
        [406, { id: 406, team_id: 77, position: "RW" }],
        [501, { id: 501, team_id: 77, position: "D" }],
        [502, { id: 502, team_id: 77, position: "D" }]
      ])
    });

    expect(roles.get(401)?.esRole).toBe("L1");
    expect(roles.get(404)?.esRole).toBe("L2");
    expect(roles.get(501)?.esRole).toBe("D1");
    expect(roles.get(401)?.source).toBe("fallback_toi_rank");
  });

  it("handles emergency fallback skaters with unknown position by assigning depth role", () => {
    const roles = buildSkaterRoleTags({
      lineCombination: null,
      useFallbackRoles: true,
      fallbackRankedSkaterIds: [9001],
      teamId: 88,
      playerMetaById: new Map([
        [9001, { id: 9001, team_id: 88, position: null }]
      ])
    });

    expect(roles.get(9001)?.esRole).toBe("L4");
    expect(roles.get(9001)?.unitTier).toBe("DEPTH");
    expect(roles.get(9001)?.source).toBe("fallback_toi_rank");
  });
});

describe("skater role continuity", () => {
  it("computes continuity and volatility summaries from recent role history", () => {
    const summary = summarizeSkaterRoleContinuity({
      currentRole: "L1",
      recentRoles: ["L1", "L1", "L2", "L1", "L2", "L1"],
      windowGames: 6
    });

    expect(summary.appearancesTracked).toBe(6);
    expect(summary.gamesInCurrentRole).toBe(4);
    expect(summary.continuityShare).toBeCloseTo(0.6667, 4);
    expect(summary.roleChangeRate).toBeGreaterThan(0);
    expect(summary.volatilityIndex).toBeCloseTo(0.3333, 4);
  });

  it("penalizes volatile role histories and mildly boosts stable roles", () => {
    const volatile = computeSkaterRoleStabilityMultiplier({
      windowGames: 8,
      appearancesTracked: 8,
      gamesInCurrentRole: 2,
      continuityShare: 0.25,
      roleChangeRate: 0.8,
      volatilityIndex: 0.75
    });
    const stable = computeSkaterRoleStabilityMultiplier({
      windowGames: 8,
      appearancesTracked: 8,
      gamesInCurrentRole: 7,
      continuityShare: 0.875,
      roleChangeRate: 0.1,
      volatilityIndex: 0.25
    });

    expect(volatile).toBeLessThan(1);
    expect(stable).toBeGreaterThanOrEqual(1);
    expect(stable).toBeGreaterThan(volatile);
  });
});

describe("roster-event availability weighting", () => {
  it("fully removes unavailable event types and restores on return/callup", () => {
    expect(availabilityMultiplierForEvent("INJURY_OUT", 1)).toBe(0);
    expect(availabilityMultiplierForEvent("IR", 0.8)).toBe(0);
    expect(availabilityMultiplierForEvent("LTIR", 0.6)).toBe(0);
    expect(availabilityMultiplierForEvent("SUSPENSION", 0.9)).toBe(0);
    expect(availabilityMultiplierForEvent("RETURN", 0.2)).toBe(1);
    expect(availabilityMultiplierForEvent("CALLUP", 0.7)).toBe(1);
  });

  it("applies confidence-weighted penalties for partial-availability events", () => {
    const dtdLow = availabilityMultiplierForEvent("DTD", 0.2) ?? 1;
    const dtdHigh = availabilityMultiplierForEvent("DTD", 0.9) ?? 1;
    const scratch = availabilityMultiplierForEvent("SCRATCH", 0.8) ?? 1;
    const benching = availabilityMultiplierForEvent("BENCHING", 0.8) ?? 1;

    expect(dtdHigh).toBeLessThan(dtdLow);
    expect(scratch).toBeLessThan(benching);
    expect(scratch).toBeLessThan(1);
    expect(benching).toBeLessThan(1);
  });
});

describe("starter scenarios", () => {
  it("builds normalized top-2 scenarios from multi-goalie probabilities", () => {
    const scenarios = buildTopStarterScenarios({
      probabilitiesByGoalieId: new Map([
        [4001, 0.5],
        [4002, 0.3],
        [4003, 0.2]
      ])
    });

    expect(scenarios).toHaveLength(2);
    expect(scenarios[0]?.goalieId).toBe(4001);
    expect(scenarios[1]?.goalieId).toBe(4002);
    expect(scenarios[0]?.probability).toBeCloseTo(0.625, 5);
    expect(scenarios[1]?.probability).toBeCloseTo(0.375, 5);
  });

  it("returns a single scenario with full probability when only one goalie exists", () => {
    const scenarios = buildTopStarterScenarios({
      probabilitiesByGoalieId: new Map([[4010, 1]])
    });

    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]?.goalieId).toBe(4010);
    expect(scenarios[0]?.probability).toBe(1);
    expect(scenarios[0]?.rawProbability).toBe(1);
  });
});

describe("scenario blending", () => {
  it("blends top scenarios using raw starter probabilities", () => {
    const blended = blendTopStarterScenarioOutputs({
      scenarioProjections: [
        {
          goalie_id: 5001,
          rank: 1,
          starter_probability_raw: 0.6,
          starter_probability_top2_normalized: 0.6,
          proj_shots_against: 30,
          proj_saves: 27,
          proj_goals_allowed: 3,
          proj_win_prob: 0.55,
          proj_shutout_prob: 0.05,
          modeled_save_pct: 0.9,
          workload_save_pct_penalty: 0
        },
        {
          goalie_id: 5002,
          rank: 2,
          starter_probability_raw: 0.3,
          starter_probability_top2_normalized: 0.3,
          proj_shots_against: 30,
          proj_saves: 26.1,
          proj_goals_allowed: 3.9,
          proj_win_prob: 0.5,
          proj_shutout_prob: 0.03,
          modeled_save_pct: 0.87,
          workload_save_pct_penalty: 0
        }
      ],
      fallbackProjection: {
        proj_shots_against: 30,
        proj_saves: 27,
        proj_goals_allowed: 3,
        proj_win_prob: 0.55,
        proj_shutout_prob: 0.05,
        modeled_save_pct: 0.9,
        workload_save_pct_penalty: 0
      }
    });

    expect(blended.probability_mass).toBeCloseTo(0.9, 5);
    expect(blended.residual_probability_mass).toBeCloseTo(0.1, 5);
    expect(blended.proj_saves).toBeCloseTo(26.73, 5);
    expect(blended.proj_goals_allowed).toBeCloseTo(3.27, 5);
  });
});

describe("horizon scalars", () => {
  it("builds sequential scalars with schedule decay and b2b penalty", () => {
    const scalars = buildSequentialHorizonScalarsFromDates(
      ["2026-02-10", "2026-02-11", "2026-02-14"],
      5
    );

    expect(scalars).toHaveLength(5);
    expect(scalars[0]).toBeCloseTo(1, 5);
    expect(scalars[1]).toBeLessThan(scalars[0] ?? 1);
    expect(scalars[2]).toBeGreaterThan(scalars[1] ?? 0);
  });
});

describe("goalie rest-split adjustments", () => {
  it("maps days-since-start into expected rest buckets", () => {
    expect(toGoalieRestSplitBucket(0)).toBe("0");
    expect(toGoalieRestSplitBucket(1)).toBe("1");
    expect(toGoalieRestSplitBucket(2)).toBe("2");
    expect(toGoalieRestSplitBucket(3)).toBe("3");
    expect(toGoalieRestSplitBucket(4)).toBe("4_plus");
    expect(toGoalieRestSplitBucket(null)).toBe("4_plus");
  });

  it("applies sample-weighted positive adjustments and ignores low-sample buckets", () => {
    const profile = {
      sourceDate: "2026-02-05",
      savePctByBucket: {
        "0": 0.88,
        "1": 0.912,
        "2": 0.922,
        "3": 0.915,
        "4_plus": 0.905
      },
      gamesByBucket: {
        "0": 3,
        "1": 5,
        "2": 1,
        "3": 2,
        "4_plus": 4
      }
    };

    const day1Adj = computeGoalieRestSplitSavePctAdjustment({
      profile,
      daysSinceLastStart: 1
    });
    const day2Adj = computeGoalieRestSplitSavePctAdjustment({
      profile,
      daysSinceLastStart: 2
    });

    expect(day1Adj).toBeGreaterThan(0);
    expect(day2Adj).toBe(0);
  });
});

describe("team strength priors", () => {
  it("increases shots-against and opponent goal context when defense xGA and opponent xGF are elevated", () => {
    const adjustment = computeTeamStrengthContextAdjustment({
      defendingTeamPrior: {
        sourceDate: "2026-02-08",
        xga: 172,
        xgaPerGame: 3.35,
        xgfPerGame: 3.05
      },
      opponentTeamPrior: {
        sourceDate: "2026-02-08",
        xga: 164,
        xgaPerGame: 3.12,
        xgfPerGame: 3.28
      }
    });

    expect(adjustment.sampleWeight).toBeGreaterThan(0.9);
    expect(adjustment.shotsAgainstPctAdjustment).toBeGreaterThan(0);
    expect(adjustment.opponentGoalsForPctAdjustment).toBeGreaterThan(0);
  });

  it("returns neutral adjustments when no team priors are available", () => {
    const adjustment = computeTeamStrengthContextAdjustment({
      defendingTeamPrior: null,
      opponentTeamPrior: null
    });

    expect(adjustment.sampleWeight).toBe(0);
    expect(adjustment.shotsAgainstPctAdjustment).toBe(0);
    expect(adjustment.teamGoalsForPctAdjustment).toBe(0);
    expect(adjustment.opponentGoalsForPctAdjustment).toBe(0);
  });
});

describe("team 5v5 context priors", () => {
  it("boosts league save context for strong 5v5 save profiles", () => {
    const adjustment = computeTeamFiveOnFiveContextAdjustment({
      defendingTeamProfile: {
        sourceDate: "2026-02-08",
        gamesPlayed: 52,
        savePct5v5: 0.934,
        shootingPlusSavePct5v5: 1.03
      },
      opponentTeamProfile: {
        sourceDate: "2026-02-08",
        gamesPlayed: 52,
        savePct5v5: 0.915,
        shootingPlusSavePct5v5: 0.99
      }
    });

    expect(adjustment.sampleWeight).toBeGreaterThan(0.9);
    expect(adjustment.leagueSavePctAdjustment).toBeGreaterThan(0);
    expect(Math.abs(adjustment.contextPctAdjustment)).toBeLessThan(0.03);
  });

  it("returns neutral values when no 5v5 profile is available", () => {
    const adjustment = computeTeamFiveOnFiveContextAdjustment({
      defendingTeamProfile: null,
      opponentTeamProfile: null
    });

    expect(adjustment.sampleWeight).toBe(0);
    expect(adjustment.leagueSavePctAdjustment).toBe(0);
    expect(adjustment.contextPctAdjustment).toBe(0);
  });
});

describe("NST opponent danger context", () => {
  it("raises shot-danger context when defending team has elevated NST xGA/60", () => {
    const adjustment = computeNstOpponentDangerAdjustment({
      defendingTeamProfile: {
        source: "nst_team_all",
        sourceDate: "2026-02-08",
        gamesPlayed: 51,
        xga: 140,
        xgaPer60: 2.9
      },
      opponentTeamProfile: {
        source: "nst_team_all",
        sourceDate: "2026-02-08",
        gamesPlayed: 51,
        xga: 122,
        xgaPer60: 2.55
      }
    });

    expect(adjustment.sampleWeight).toBeGreaterThan(0.7);
    expect(adjustment.contextPctAdjustment).toBeGreaterThan(0);
  });

  it("returns neutral adjustments when NST profiles are unavailable", () => {
    const adjustment = computeNstOpponentDangerAdjustment({
      defendingTeamProfile: null,
      opponentTeamProfile: null
    });

    expect(adjustment.sampleWeight).toBe(0);
    expect(adjustment.contextPctAdjustment).toBe(0);
  });
});
