import {
  GOALIE_GSAA_PRIOR_MAX_ABS,
  SKATER_IXG_PER_SHOT_BASELINE,
  SKATER_ON_ICE_ASSIST_ENV_MAX_MULTIPLIER,
  SKATER_ON_ICE_ASSIST_ENV_MIN_MULTIPLIER,
  SKATER_ON_ICE_GOAL_ENV_MAX_MULTIPLIER,
  SKATER_ON_ICE_GOAL_ENV_MIN_MULTIPLIER,
  SKATER_ON_ICE_POSSESSION_BASELINE,
  SKATER_ON_ICE_SHOT_ENV_MAX_MULTIPLIER,
  SKATER_ON_ICE_SHOT_ENV_MIN_MULTIPLIER,
  SKATER_ON_ICE_XG_PER60_BASELINE,
  SKATER_OPP_GOALIE_ASSIST_MAX_MULTIPLIER,
  SKATER_OPP_GOALIE_ASSIST_MIN_MULTIPLIER,
  SKATER_OPP_GOALIE_GOAL_MAX_MULTIPLIER,
  SKATER_OPP_GOALIE_GOAL_MIN_MULTIPLIER,
  SKATER_REST_ASSIST_MAX_MULTIPLIER,
  SKATER_REST_ASSIST_MIN_MULTIPLIER,
  SKATER_REST_GOAL_MAX_MULTIPLIER,
  SKATER_REST_GOAL_MIN_MULTIPLIER,
  SKATER_REST_SHOT_MAX_MULTIPLIER,
  SKATER_REST_SHOT_MIN_MULTIPLIER,
  SKATER_REST_TOI_MAX_MULTIPLIER,
  SKATER_REST_TOI_MIN_MULTIPLIER,
  SKATER_RUSH_REBOUND_PER60_BASELINE,
  SKATER_SHOT_QUALITY_MAX_MULTIPLIER,
  SKATER_SHOT_QUALITY_MIN_MULTIPLIER,
  SKATER_SMALL_SAMPLE_CALLUP_WEIGHT_THRESHOLD,
  SKATER_SMALL_SAMPLE_LOW_WEIGHT_THRESHOLD,
  SKATER_SMALL_SAMPLE_SHOTS_SCALE,
  SKATER_SMALL_SAMPLE_TOI_SECONDS_SCALE,
  SKATER_TEAM_LEVEL_ASSIST_MAX_MULTIPLIER,
  SKATER_TEAM_LEVEL_ASSIST_MIN_MULTIPLIER,
  SKATER_TEAM_LEVEL_GOAL_MAX_MULTIPLIER,
  SKATER_TEAM_LEVEL_GOAL_MIN_MULTIPLIER,
  SKATER_TEAM_LEVEL_SHOT_MAX_MULTIPLIER,
  SKATER_TEAM_LEVEL_SHOT_MIN_MULTIPLIER,
  SKATER_CONVERSION_MIN_MULTIPLIER,
  SKATER_CONVERSION_MAX_MULTIPLIER,
  TEAM_5V5_PDO_BASELINE,
  TEAM_5V5_SAVE_PCT_BASELINE,
  TEAM_NST_XGA_PER60_BASELINE,
  TEAM_XG_BASELINE_PER_GAME
} from "../constants/projection-weights";
import type {
  OpponentGoalieContext,
  SkaterOnIceContextProfile,
  SkaterRestScheduleAdjustment,
  SkaterSampleShrinkageAdjustment,
  SkaterShotQualityProfile,
  SkaterTeamLevelContextAdjustment,
  TeamFiveOnFiveProfile,
  TeamNstExpectedGoalsProfile,
  TeamStrengthPrior
} from "../types/run-forge-projections.types";
import { blendOnlineRate, clamp, finiteOrNull } from "../utils/number-utils";

function normalizeRateOrPercent(value: number | null | undefined): number | null {
  const n = finiteOrNull(value);
  if (n == null) return null;
  if (n >= 0 && n <= 1) return n;
  if (n > 1 && n <= 100) return n / 100;
  return null;
}

export function computeSkaterShotQualityAdjustments(args: {
  profile: SkaterShotQualityProfile | null;
}): {
  sampleWeight: number;
  shotRateMultiplier: number;
  goalRateMultiplier: number;
  qualityPerShot: number | null;
  rushReboundPer60: number | null;
} {
  const profile = args.profile;
  if (!profile) {
    return {
      sampleWeight: 0,
      shotRateMultiplier: 1,
      goalRateMultiplier: 1,
      qualityPerShot: null,
      rushReboundPer60: null
    };
  }

  const shotsPer60 = finiteOrNull(profile.nstShotsPer60);
  const ixgPer60 = finiteOrNull(profile.nstIxgPer60);
  const rushPer60 = Math.max(0, finiteOrNull(profile.nstRushAttemptsPer60) ?? 0);
  const reboundsPer60 = Math.max(0, finiteOrNull(profile.nstReboundsCreatedPer60) ?? 0);
  const qualityPerShot =
    shotsPer60 != null && shotsPer60 > 0 && ixgPer60 != null
      ? ixgPer60 / shotsPer60
      : null;
  const rushReboundPer60 = rushPer60 + reboundsPer60;

  const shotsSignal = Math.max(0, shotsPer60 ?? 0);
  const sampleWeight = clamp(shotsSignal / (shotsSignal + 5), 0, 1);
  const qualityEdge =
    qualityPerShot != null
      ? clamp(
          (qualityPerShot - SKATER_IXG_PER_SHOT_BASELINE) /
            SKATER_IXG_PER_SHOT_BASELINE,
          -0.35,
          0.35
        )
      : 0;
  const rushReboundEdge = clamp(
    (rushReboundPer60 - SKATER_RUSH_REBOUND_PER60_BASELINE) /
      SKATER_RUSH_REBOUND_PER60_BASELINE,
    -0.5,
    0.5
  );

  const shotRateMultiplier = clamp(
    1 + sampleWeight * (qualityEdge * 0.05 + rushReboundEdge * 0.08),
    SKATER_SHOT_QUALITY_MIN_MULTIPLIER,
    SKATER_SHOT_QUALITY_MAX_MULTIPLIER
  );
  const goalRateMultiplier = clamp(
    1 + sampleWeight * (qualityEdge * 0.26 + rushReboundEdge * 0.07),
    SKATER_CONVERSION_MIN_MULTIPLIER,
    SKATER_CONVERSION_MAX_MULTIPLIER
  );

  return {
    sampleWeight: Number(sampleWeight.toFixed(4)),
    shotRateMultiplier: Number(shotRateMultiplier.toFixed(4)),
    goalRateMultiplier: Number(goalRateMultiplier.toFixed(4)),
    qualityPerShot: qualityPerShot == null ? null : Number(qualityPerShot.toFixed(4)),
    rushReboundPer60: Number(rushReboundPer60.toFixed(4))
  };
}

export function computeSkaterOnIceContextAdjustments(args: {
  profile: SkaterOnIceContextProfile | null;
}): {
  sampleWeight: number;
  shotEnvironmentMultiplier: number;
  goalEnvironmentMultiplier: number;
  assistEnvironmentMultiplier: number;
  possessionPct: number | null;
} {
  const profile = args.profile;
  if (!profile) {
    return {
      sampleWeight: 0,
      shotEnvironmentMultiplier: 1,
      goalEnvironmentMultiplier: 1,
      assistEnvironmentMultiplier: 1,
      possessionPct: null
    };
  }

  const xgfPer60 = finiteOrNull(profile.nstOiXgfPer60);
  const xgaPer60 = finiteOrNull(profile.nstOiXgaPer60);
  const possessionPct =
    normalizeRateOrPercent(profile.nstOiCfPct) ??
    normalizeRateOrPercent(profile.possessionPctSafe);
  const xgSignal = Math.max(0, (xgfPer60 ?? 0) + (xgaPer60 ?? 0));
  const sampleWeight = clamp(xgSignal / (xgSignal + 2.5), 0, 1);

  const offenseEdge =
    xgfPer60 != null
      ? clamp(
          (xgfPer60 - SKATER_ON_ICE_XG_PER60_BASELINE) /
            SKATER_ON_ICE_XG_PER60_BASELINE,
          -0.3,
          0.3
        )
      : 0;
  const defenseDrag =
    xgaPer60 != null
      ? clamp(
          (xgaPer60 - SKATER_ON_ICE_XG_PER60_BASELINE) /
            SKATER_ON_ICE_XG_PER60_BASELINE,
          -0.3,
          0.3
        )
      : 0;
  const possessionEdge =
    possessionPct != null
      ? clamp(
          (possessionPct - SKATER_ON_ICE_POSSESSION_BASELINE) /
            SKATER_ON_ICE_POSSESSION_BASELINE,
          -0.25,
          0.25
        )
      : 0;

  const shotEnvironmentMultiplier = clamp(
    1 + sampleWeight * (offenseEdge * 0.14 + possessionEdge * 0.1 - defenseDrag * 0.05),
    SKATER_ON_ICE_SHOT_ENV_MIN_MULTIPLIER,
    SKATER_ON_ICE_SHOT_ENV_MAX_MULTIPLIER
  );
  const goalEnvironmentMultiplier = clamp(
    1 + sampleWeight * (offenseEdge * 0.18 + possessionEdge * 0.07 - defenseDrag * 0.06),
    SKATER_ON_ICE_GOAL_ENV_MIN_MULTIPLIER,
    SKATER_ON_ICE_GOAL_ENV_MAX_MULTIPLIER
  );
  const assistEnvironmentMultiplier = clamp(
    1 + sampleWeight * (offenseEdge * 0.2 + possessionEdge * 0.13 - defenseDrag * 0.04),
    SKATER_ON_ICE_ASSIST_ENV_MIN_MULTIPLIER,
    SKATER_ON_ICE_ASSIST_ENV_MAX_MULTIPLIER
  );

  return {
    sampleWeight: Number(sampleWeight.toFixed(4)),
    shotEnvironmentMultiplier: Number(shotEnvironmentMultiplier.toFixed(4)),
    goalEnvironmentMultiplier: Number(goalEnvironmentMultiplier.toFixed(4)),
    assistEnvironmentMultiplier: Number(assistEnvironmentMultiplier.toFixed(4)),
    possessionPct: possessionPct == null ? null : Number(possessionPct.toFixed(4))
  };
}

export function computeSkaterTeamLevelContextAdjustments(args: {
  teamStrengthPrior: TeamStrengthPrior | null;
  opponentStrengthPrior: TeamStrengthPrior | null;
  teamFiveOnFiveProfile: TeamFiveOnFiveProfile | null;
  opponentFiveOnFiveProfile: TeamFiveOnFiveProfile | null;
  teamNstProfile: TeamNstExpectedGoalsProfile | null;
  opponentNstProfile: TeamNstExpectedGoalsProfile | null;
}): SkaterTeamLevelContextAdjustment {
  const teamStrength = args.teamStrengthPrior;
  const opponentStrength = args.opponentStrengthPrior;
  const teamFiveOnFive = args.teamFiveOnFiveProfile;
  const opponentFiveOnFive = args.opponentFiveOnFiveProfile;
  const teamNst = args.teamNstProfile;
  const opponentNst = args.opponentNstProfile;

  if (!teamStrength && !opponentStrength && !teamFiveOnFive && !opponentFiveOnFive && !teamNst && !opponentNst) {
    return {
      sampleWeight: 0,
      shotRateMultiplier: 1,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1,
      paceEdge: 0,
      opponentDefenseEdge: 0
    };
  }

  const teamXgfPerGame = teamStrength?.xgfPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const opponentXgaPerGame = opponentStrength?.xgaPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const teamPdo = normalizeRateOrPercent(teamFiveOnFive?.shootingPlusSavePct5v5) ?? TEAM_5V5_PDO_BASELINE;
  const opponentSavePct5v5 = normalizeRateOrPercent(opponentFiveOnFive?.savePct5v5) ?? TEAM_5V5_SAVE_PCT_BASELINE;
  const teamNstXgaPer60 = teamNst?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE;
  const opponentNstXgaPer60 = opponentNst?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE;
  const nstPaceProxy = (teamNstXgaPer60 + opponentNstXgaPer60) / 2;

  const strengthSampleRaw = Math.max(0, teamStrength?.xga ?? 0) + Math.max(0, opponentStrength?.xga ?? 0);
  const fiveOnFiveSampleRaw = Math.max(0, teamFiveOnFive?.gamesPlayed ?? 0) + Math.max(0, opponentFiveOnFive?.gamesPlayed ?? 0);
  const nstSampleRaw = Math.max(0, teamNst?.gamesPlayed ?? 0) + Math.max(0, opponentNst?.gamesPlayed ?? 0);
  const sampleWeight = clamp(
    strengthSampleRaw / (strengthSampleRaw + 260) * 0.35 +
      fiveOnFiveSampleRaw / (fiveOnFiveSampleRaw + 18) * 0.3 +
      nstSampleRaw / (nstSampleRaw + 40) * 0.35,
    0,
    1
  );

  const offenseEdge = clamp((teamXgfPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME, -0.22, 0.22);
  const defenseLiabilityEdge = clamp((opponentXgaPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME, -0.22, 0.22);
  const paceEdge = clamp((nstPaceProxy - TEAM_NST_XGA_PER60_BASELINE) / TEAM_NST_XGA_PER60_BASELINE, -0.2, 0.2);
  const pdoEdge = clamp(teamPdo - TEAM_5V5_PDO_BASELINE, -0.08, 0.08);
  const opponentSaveEdge = clamp(TEAM_5V5_SAVE_PCT_BASELINE - opponentSavePct5v5, -0.03, 0.03);

  const shotRateMultiplier = clamp(
    1 + sampleWeight * (offenseEdge * 0.14 + defenseLiabilityEdge * 0.18 + paceEdge * 0.2 + pdoEdge * 0.06),
    SKATER_TEAM_LEVEL_SHOT_MIN_MULTIPLIER,
    SKATER_TEAM_LEVEL_SHOT_MAX_MULTIPLIER
  );
  const goalRateMultiplier = clamp(
    1 + sampleWeight * (offenseEdge * 0.16 + defenseLiabilityEdge * 0.22 + opponentSaveEdge * 2.3 + paceEdge * 0.08),
    SKATER_TEAM_LEVEL_GOAL_MIN_MULTIPLIER,
    SKATER_TEAM_LEVEL_GOAL_MAX_MULTIPLIER
  );
  const assistRateMultiplier = clamp(
    1 + sampleWeight * (offenseEdge * 0.18 + defenseLiabilityEdge * 0.16 + paceEdge * 0.12 + pdoEdge * 0.08),
    SKATER_TEAM_LEVEL_ASSIST_MIN_MULTIPLIER,
    SKATER_TEAM_LEVEL_ASSIST_MAX_MULTIPLIER
  );

  return {
    sampleWeight: Number(sampleWeight.toFixed(4)),
    shotRateMultiplier: Number(shotRateMultiplier.toFixed(4)),
    goalRateMultiplier: Number(goalRateMultiplier.toFixed(4)),
    assistRateMultiplier: Number(assistRateMultiplier.toFixed(4)),
    paceEdge: Number(paceEdge.toFixed(4)),
    opponentDefenseEdge: Number(defenseLiabilityEdge.toFixed(4))
  };
}

export function computeSkaterOpponentGoalieContextAdjustments(args: {
  context: OpponentGoalieContext | null;
}): {
  sampleWeight: number;
  goalRateMultiplier: number;
  assistRateMultiplier: number;
  weightedProjectedGsaaPer60: number | null;
  starterCertainty: number;
} {
  const context = args.context;
  if (!context) {
    return {
      sampleWeight: 0,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1,
      weightedProjectedGsaaPer60: null,
      starterCertainty: 0
    };
  }

  const weightedGsaa = finiteOrNull(context.weightedProjectedGsaaPer60);
  const starterCertainty = context.isConfirmedStarter ? 1 : clamp(context.topStarterProbability, 0, 1);
  const probabilityMass = clamp(context.probabilityMass, 0, 1);
  const sampleWeight = clamp(probabilityMass * (0.45 + 0.55 * starterCertainty), 0, 1);
  const qualityEdge = weightedGsaa != null ? clamp(weightedGsaa / GOALIE_GSAA_PRIOR_MAX_ABS, -1, 1) : 0;

  const goalRateMultiplier = clamp(
    1 + sampleWeight * (-qualityEdge * 0.18),
    SKATER_OPP_GOALIE_GOAL_MIN_MULTIPLIER,
    SKATER_OPP_GOALIE_GOAL_MAX_MULTIPLIER
  );
  const assistRateMultiplier = clamp(
    1 + sampleWeight * (-qualityEdge * 0.11),
    SKATER_OPP_GOALIE_ASSIST_MIN_MULTIPLIER,
    SKATER_OPP_GOALIE_ASSIST_MAX_MULTIPLIER
  );

  return {
    sampleWeight: Number(sampleWeight.toFixed(4)),
    goalRateMultiplier: Number(goalRateMultiplier.toFixed(4)),
    assistRateMultiplier: Number(assistRateMultiplier.toFixed(4)),
    weightedProjectedGsaaPer60: weightedGsaa == null ? null : Number(weightedGsaa.toFixed(4)),
    starterCertainty: Number(starterCertainty.toFixed(4))
  };
}

export function computeSkaterRestScheduleAdjustments(args: {
  teamRestDays: number | null;
  opponentRestDays: number | null;
  isHome: boolean;
}): SkaterRestScheduleAdjustment {
  const teamRestDays = Number.isFinite(args.teamRestDays) && args.teamRestDays != null ? Math.max(0, Number(args.teamRestDays)) : null;
  const opponentRestDays = Number.isFinite(args.opponentRestDays) && args.opponentRestDays != null ? Math.max(0, Number(args.opponentRestDays)) : null;

  if (teamRestDays == null && opponentRestDays == null) {
    return {
      sampleWeight: 0,
      toiMultiplier: 1,
      shotRateMultiplier: 1,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1,
      restDelta: 0,
      teamRestDays: null,
      opponentRestDays: null
    };
  }

  const teamRest = teamRestDays ?? 1;
  const oppRest = opponentRestDays ?? 1;
  const restDelta = clamp((teamRest - oppRest) / 3, -1, 1);
  const teamFatiguePenalty = teamRest <= 0 ? 0.11 : teamRest === 1 ? 0.035 : 0;
  const teamRecoveryBoost = teamRest >= 3 ? 0.03 : teamRest === 2 ? 0.012 : 0;
  const opponentFatigueBoost = oppRest <= 0 ? 0.055 : oppRest === 1 ? 0.018 : 0;
  const homeIceEdge = args.isHome ? 0.012 : -0.004;

  const toiMultiplier = clamp(
    1 - teamFatiguePenalty + teamRecoveryBoost + restDelta * 0.03 + homeIceEdge * 0.6,
    SKATER_REST_TOI_MIN_MULTIPLIER,
    SKATER_REST_TOI_MAX_MULTIPLIER
  );
  const shotRateMultiplier = clamp(
    1 + opponentFatigueBoost - teamFatiguePenalty * 0.35 + restDelta * 0.045 + homeIceEdge * 0.45,
    SKATER_REST_SHOT_MIN_MULTIPLIER,
    SKATER_REST_SHOT_MAX_MULTIPLIER
  );
  const goalRateMultiplier = clamp(
    1 + opponentFatigueBoost * 0.72 - teamFatiguePenalty * 0.25 + restDelta * 0.035 + homeIceEdge * 0.8,
    SKATER_REST_GOAL_MIN_MULTIPLIER,
    SKATER_REST_GOAL_MAX_MULTIPLIER
  );
  const assistRateMultiplier = clamp(
    1 + opponentFatigueBoost * 0.5 - teamFatiguePenalty * 0.2 + restDelta * 0.04 + homeIceEdge * 0.55,
    SKATER_REST_ASSIST_MIN_MULTIPLIER,
    SKATER_REST_ASSIST_MAX_MULTIPLIER
  );

  return {
    sampleWeight: 1,
    toiMultiplier: Number(toiMultiplier.toFixed(4)),
    shotRateMultiplier: Number(shotRateMultiplier.toFixed(4)),
    goalRateMultiplier: Number(goalRateMultiplier.toFixed(4)),
    assistRateMultiplier: Number(assistRateMultiplier.toFixed(4)),
    restDelta: Number(restDelta.toFixed(4)),
    teamRestDays,
    opponentRestDays
  };
}

export function computeSkaterSampleShrinkageAdjustments(args: {
  evToiSecondsAll: number | null;
  ppToiSecondsAll: number | null;
  evShotsAll: number | null;
  ppShotsAll: number | null;
}): SkaterSampleShrinkageAdjustment {
  const evToi = Math.max(0, finiteOrNull(args.evToiSecondsAll) ?? 0);
  const ppToi = Math.max(0, finiteOrNull(args.ppToiSecondsAll) ?? 0);
  const evShots = Math.max(0, finiteOrNull(args.evShotsAll) ?? 0);
  const ppShots = Math.max(0, finiteOrNull(args.ppShotsAll) ?? 0);
  const evidenceToiSeconds = evToi + ppToi;
  const evidenceShots = evShots + ppShots;

  const toiEvidenceWeight = clamp(
    evidenceToiSeconds / (evidenceToiSeconds + SKATER_SMALL_SAMPLE_TOI_SECONDS_SCALE),
    0,
    1
  );
  const shotEvidenceWeight = clamp(
    evidenceShots / (evidenceShots + SKATER_SMALL_SAMPLE_SHOTS_SCALE),
    0,
    1
  );
  const sampleWeight = Number(clamp(toiEvidenceWeight * 0.58 + shotEvidenceWeight * 0.42, 0, 1).toFixed(4));

  return {
    sampleWeight,
    isLowSample: sampleWeight < SKATER_SMALL_SAMPLE_LOW_WEIGHT_THRESHOLD,
    usedCallupFallback: sampleWeight < SKATER_SMALL_SAMPLE_CALLUP_WEIGHT_THRESHOLD,
    evidenceToiSeconds: Number(evidenceToiSeconds.toFixed(3)),
    evidenceShots: Number(evidenceShots.toFixed(3))
  };
}

export function computeStrengthSplitConversionRates(args: {
  evGoalsRecent: number;
  evShotsRecent: number;
  evGoalsAll: number;
  evShotsAll: number;
  evAssistsRecent: number;
  evAssistsAll: number;
  ppGoalsRecent: number;
  ppShotsRecent: number;
  ppGoalsAll: number;
  ppShotsAll: number;
  ppAssistsRecent: number;
  ppAssistsAll: number;
  goalRateMultiplier: number;
  assistRateMultiplier: number;
}): {
  goalRateEs: number;
  goalRatePp: number;
  assistRateEs: number;
  assistRatePp: number;
} {
  const adaptivePriorStrength = (opts: {
    baseStrength: number;
    evidenceDenom: number;
    evidenceScale: number;
    minStrength: number;
    maxStrength: number;
  }): number => {
    const denom = Math.max(0, opts.evidenceDenom);
    const shrinkFactor = opts.evidenceScale / (denom + opts.evidenceScale);
    const scaled = opts.baseStrength * (0.35 + 1.35 * shrinkFactor);
    return clamp(scaled, opts.minStrength, opts.maxStrength);
  };

  const evGoalPriorStrength = adaptivePriorStrength({
    baseStrength: 42,
    evidenceDenom: Math.max(0, args.evShotsAll) + Math.max(0, args.evShotsRecent),
    evidenceScale: 70,
    minStrength: 12,
    maxStrength: 72
  });
  const ppGoalPriorStrength = adaptivePriorStrength({
    baseStrength: 26,
    evidenceDenom: Math.max(0, args.ppShotsAll) + Math.max(0, args.ppShotsRecent),
    evidenceScale: 40,
    minStrength: 9,
    maxStrength: 54
  });
  const evAssistPriorStrength = adaptivePriorStrength({
    baseStrength: 22,
    evidenceDenom: Math.max(0, args.evGoalsAll * 2) + Math.max(0, args.evGoalsRecent * 2),
    evidenceScale: 36,
    minStrength: 8,
    maxStrength: 40
  });
  const ppAssistPriorStrength = adaptivePriorStrength({
    baseStrength: 16,
    evidenceDenom: Math.max(0, args.ppGoalsAll * 2) + Math.max(0, args.ppGoalsRecent * 2),
    evidenceScale: 24,
    minStrength: 6,
    maxStrength: 30
  });

  const goalRateEsRaw = blendOnlineRate({
    recentNumerator: args.evGoalsRecent,
    recentDenom: args.evShotsRecent,
    baseNumerator: args.evGoalsAll,
    baseDenom: args.evShotsAll,
    fallback: 0.095,
    priorStrength: evGoalPriorStrength,
    minRate: 0.025,
    maxRate: 0.24
  });
  const goalRatePpRaw = blendOnlineRate({
    recentNumerator: args.ppGoalsRecent,
    recentDenom: args.ppShotsRecent,
    baseNumerator: args.ppGoalsAll,
    baseDenom: args.ppShotsAll,
    fallback: 0.145,
    priorStrength: ppGoalPriorStrength,
    minRate: 0.04,
    maxRate: 0.36
  });
  const assistRateEsRaw = blendOnlineRate({
    recentNumerator: args.evAssistsRecent,
    recentDenom: args.evGoalsRecent * 2,
    baseNumerator: args.evAssistsAll,
    baseDenom: args.evGoalsAll * 2,
    fallback: 0.72,
    priorStrength: evAssistPriorStrength,
    minRate: 0.2,
    maxRate: 1.45
  });
  const assistRatePpRaw = blendOnlineRate({
    recentNumerator: args.ppAssistsRecent,
    recentDenom: args.ppGoalsRecent * 2,
    baseNumerator: args.ppAssistsAll,
    baseDenom: args.ppGoalsAll * 2,
    fallback: 0.95,
    priorStrength: ppAssistPriorStrength,
    minRate: 0.3,
    maxRate: 1.8
  });

  return {
    goalRateEs: clamp(goalRateEsRaw * args.goalRateMultiplier, 0.02, 0.3),
    goalRatePp: clamp(goalRatePpRaw * args.goalRateMultiplier, 0.03, 0.45),
    assistRateEs: clamp(assistRateEsRaw * args.assistRateMultiplier, 0.2, 1.7),
    assistRatePp: clamp(assistRatePpRaw * args.assistRateMultiplier, 0.3, 2)
  };
}
