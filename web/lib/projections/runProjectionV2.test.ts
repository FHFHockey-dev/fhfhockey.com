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
