import { readAlignedCountSupport } from "lib/rollingPlayerCountSupport";
import { resolveNullableCompatibilityValue } from "lib/rollingPlayerMetricCompatibility";
import type { LeaguePhysicalTotals, RollingRow } from "../types/run-forge-projections.types";
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
  SKATER_PHYSICAL_LEAGUE_SCALE_MAX,
  SKATER_PHYSICAL_LEAGUE_SCALE_MIN,
  SKATER_PHYSICAL_LEAGUE_SHRINK_MINUTES,
  SKATER_PHYSICAL_PRIOR_MINUTES,
  SKATER_PHYSICAL_PRIOR_SEASON_WEIGHT,
  SKATER_PHYSICAL_RATE_PRIORS,
  SKATER_PHYSICAL_RECENT_SHRINK_MINUTES,
  SKATER_PHYSICAL_TOI_RATIO_MAX,
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
  /** "legacy" reproduces the pre-Q8 buckets (B2B read as 0) for offline backtests only. */
  buckets?: "legacy";
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

  // Rest days are days since the previous game (fetchTeamRestDays), so a back-to-back is 1,
  // as in the goalie stage: 1 = heavy fatigue, 2 = mild, 3 = small boost, 4+ = full recovery.
  // Legacy buckets read every tier one day lower; restDelta is shift-invariant, and a missing
  // side keeps its former neutral default (old 1 = new 2) in both modes.
  const shift = args.buckets === "legacy" ? 1 : 0;
  const teamRest = teamRestDays == null ? 2 : teamRestDays + shift;
  const oppRest = opponentRestDays == null ? 2 : opponentRestDays + shift;
  const restDelta = clamp((teamRest - oppRest) / 3, -1, 1);
  const teamFatiguePenalty = teamRest <= 1 ? 0.11 : teamRest === 2 ? 0.035 : 0;
  const teamRecoveryBoost = teamRest >= 4 ? 0.03 : teamRest === 3 ? 0.012 : 0;
  const opponentFatigueBoost = oppRest <= 1 ? 0.055 : oppRest === 2 ? 0.018 : 0;
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

/**
 * All-situation hits and blocks per 60 from the all-strength rolling row, which
 * falls back to official NHL counts where NST logs are missing. The last-5 rate
 * is blended toward a baseline of this season plus the two prior seasons at half
 * weight, shrunk to a position prior, so a thin window of zeros lowers a line
 * instead of zeroing it. Prior-season events are rescaled to this season's league
 * rate to date (shrunk toward the prior two seasons' and bounded), because league
 * hit and block rates drift between seasons. Without league totals the constant
 * position priors stand in and nothing is rescaled.
 */
export function computeSkaterPhysicalEventRates(args: {
  all: RollingRow | undefined;
  position: string | null | undefined;
  esPpToiSeconds: number;
  currentSeasonId?: number | null;
  league?: LeaguePhysicalTotals | null;
}): {
  hitsPer60: number;
  blocksPer60: number;
  hitsRecentWeight: number;
  blocksRecentWeight: number;
  hitsLeagueScale: number;
  blocksLeagueScale: number;
  toiMultiplier: number;
} {
  const row = args.all;
  const positionGroup = args.position === "D" ? "D" : "F";
  const prior = SKATER_PHYSICAL_RATE_PRIORS[positionGroup];
  const league = args.league?.[positionGroup];
  const nonNegative = (value: number | null | undefined) => Math.max(0, finiteOrNull(value) ?? 0);
  const recentMinutes = nonNegative(row?.toi_seconds_total_last5) / 60;
  const hitsRecentWeight = recentMinutes / (recentMinutes + SKATER_PHYSICAL_RECENT_SHRINK_MINUTES.hits);
  const blocksRecentWeight = recentMinutes / (recentMinutes + SKATER_PHYSICAL_RECENT_SHRINK_MINUTES.blocks);
  // A row from an earlier season has no games this season, so all of its three-season history is prior.
  const sameSeason = args.currentSeasonId != null && row?.season === args.currentSeasonId;
  // League per-60 this season (shrunk toward the prior two seasons') and its bounded ratio to them.
  const leagueReference = (metric: "hits" | "blocks", fallbackPer60: number) => {
    const priorPer60 = league && league.prior.toiSeconds > 0 ? 3600 * league.prior[metric] / league.prior.toiSeconds : 0;
    if (!league || !(priorPer60 > 0)) return { per60: fallbackPer60, scale: 1 };
    const shrinkMinutes = SKATER_PHYSICAL_LEAGUE_SHRINK_MINUTES[positionGroup];
    const per60 = (60 * nonNegative(league.toDate[metric]) + priorPer60 * shrinkMinutes)
      / (nonNegative(league.toDate.toiSeconds) / 60 + shrinkMinutes);
    return { per60, scale: clamp(per60 / priorPer60, SKATER_PHYSICAL_LEAGUE_SCALE_MIN, SKATER_PHYSICAL_LEAGUE_SCALE_MAX) };
  };
  const blend = (recent: number | null | undefined, events3ya: number | null | undefined,
    toiSeconds3ya: number | null | undefined, eventsSeason: number | null | undefined,
    toiSecondsSeason: number | null | undefined, reference: { per60: number; scale: number },
    priorMinutes: number, recentWeight: number) => {
    const events = finiteOrNull(events3ya);
    const historySeconds = nonNegative(toiSeconds3ya);
    let baseline = reference.per60;
    if (events != null && events >= 0 && historySeconds > 0) {
      const seasonEvents = sameSeason ? Math.min(events, nonNegative(eventsSeason)) : 0;
      const seasonSeconds = sameSeason ? Math.min(historySeconds, nonNegative(toiSecondsSeason)) : 0;
      const weightedEvents = seasonEvents + SKATER_PHYSICAL_PRIOR_SEASON_WEIGHT * reference.scale * (events - seasonEvents);
      const weightedMinutes = (seasonSeconds + SKATER_PHYSICAL_PRIOR_SEASON_WEIGHT * (historySeconds - seasonSeconds)) / 60;
      baseline = (weightedEvents * 60 + priorMinutes * reference.per60) / (weightedMinutes + priorMinutes);
    }
    const recentRate = finiteOrNull(recent);
    return recentRate != null && recentRate >= 0
      ? recentWeight * recentRate + (1 - recentWeight) * baseline
      : baseline;
  };
  const hitsReference = leagueReference("hits", prior.hitsPer60);
  const blocksReference = leagueReference("blocks", prior.blocksPer60);
  const allToi = finiteOrNull(row?.toi_seconds_avg_last5);
  return {
    hitsPer60: blend(resolveNullableCompatibilityValue("weighted_rate", row?.hits_per_60_last5, row?.hits_per_60_avg_last5),
      row?.hits_per_60_hits_3ya, row?.hits_per_60_toi_seconds_3ya, row?.hits_per_60_hits_season,
      row?.hits_per_60_toi_seconds_season, hitsReference, SKATER_PHYSICAL_PRIOR_MINUTES.hits, hitsRecentWeight),
    blocksPer60: blend(resolveNullableCompatibilityValue("weighted_rate", row?.blocks_per_60_last5, row?.blocks_per_60_avg_last5),
      row?.blocks_per_60_blocks_3ya, row?.blocks_per_60_toi_seconds_3ya, row?.blocks_per_60_blocks_season,
      row?.blocks_per_60_toi_seconds_season, blocksReference, SKATER_PHYSICAL_PRIOR_MINUTES.blocks, blocksRecentWeight),
    hitsRecentWeight,
    blocksRecentWeight,
    hitsLeagueScale: hitsReference.scale,
    blocksLeagueScale: blocksReference.scale,
    // PK time is not projected; scale ES+PP TOI by the recent all-situation share.
    toiMultiplier: allToi != null && allToi > 0 && args.esPpToiSeconds > 0
      ? clamp(allToi / args.esPpToiSeconds, 1, SKATER_PHYSICAL_TOI_RATIO_MAX)
      : 1,
  };
}

/**
 * Assist rates are assists per player goal. "per_two_goals" is the former halved scale (denominator
 * goals x 2), kept with its exact constants so stored rows can be recomputed offline. "per_goal"
 * halves every pseudo-count (priorStrength is added to the denominator in blendOnlineRate and sets
 * the recent weight), so shrinkage is identical and every rate is exactly twice the legacy one.
 */
export type SkaterAssistDenominator = "per_goal" | "per_two_goals";
const SKATER_ASSIST_SCALE = {
  per_two_goals: {
    goalsPerDenominator: 2,
    ev: { baseStrength: 22, evidenceScale: 36, minStrength: 8, maxStrength: 40, fallback: 0.72, raw: [0.2, 1.45], out: [0.2, 1.7] },
    pp: { baseStrength: 16, evidenceScale: 24, minStrength: 6, maxStrength: 30, fallback: 0.95, raw: [0.3, 1.8], out: [0.3, 2] },
  },
  per_goal: {
    goalsPerDenominator: 1,
    ev: { baseStrength: 11, evidenceScale: 18, minStrength: 4, maxStrength: 20, fallback: 1.44, raw: [0.4, 2.9], out: [0.4, 3.4] },
    pp: { baseStrength: 8, evidenceScale: 12, minStrength: 3, maxStrength: 15, fallback: 1.9, raw: [0.6, 3.6], out: [0.6, 4] },
  },
} as const;

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
  assistDenominator?: SkaterAssistDenominator;
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
  const assistScale = SKATER_ASSIST_SCALE[args.assistDenominator ?? "per_goal"];
  const perDenominator = assistScale.goalsPerDenominator;
  const evAssist = assistScale.ev, ppAssist = assistScale.pp;
  const evAssistPriorStrength = adaptivePriorStrength({
    baseStrength: evAssist.baseStrength,
    evidenceDenom: Math.max(0, args.evGoalsAll * perDenominator) + Math.max(0, args.evGoalsRecent * perDenominator),
    evidenceScale: evAssist.evidenceScale,
    minStrength: evAssist.minStrength,
    maxStrength: evAssist.maxStrength
  });
  const ppAssistPriorStrength = adaptivePriorStrength({
    baseStrength: ppAssist.baseStrength,
    evidenceDenom: Math.max(0, args.ppGoalsAll * perDenominator) + Math.max(0, args.ppGoalsRecent * perDenominator),
    evidenceScale: ppAssist.evidenceScale,
    minStrength: ppAssist.minStrength,
    maxStrength: ppAssist.maxStrength
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
    recentDenom: args.evGoalsRecent * perDenominator,
    baseNumerator: args.evAssistsAll,
    baseDenom: args.evGoalsAll * perDenominator,
    fallback: evAssist.fallback,
    priorStrength: evAssistPriorStrength,
    minRate: evAssist.raw[0],
    maxRate: evAssist.raw[1]
  });
  const assistRatePpRaw = blendOnlineRate({
    recentNumerator: args.ppAssistsRecent,
    recentDenom: args.ppGoalsRecent * perDenominator,
    baseNumerator: args.ppAssistsAll,
    baseDenom: args.ppGoalsAll * perDenominator,
    fallback: ppAssist.fallback,
    priorStrength: ppAssistPriorStrength,
    minRate: ppAssist.raw[0],
    maxRate: ppAssist.raw[1]
  });

  return {
    goalRateEs: clamp(goalRateEsRaw * args.goalRateMultiplier, 0.02, 0.3),
    goalRatePp: clamp(goalRatePpRaw * args.goalRateMultiplier, 0.03, 0.45),
    assistRateEs: clamp(assistRateEsRaw * args.assistRateMultiplier, evAssist.out[0], evAssist.out[1]),
    assistRatePp: clamp(assistRatePpRaw * args.assistRateMultiplier, ppAssist.out[0], ppAssist.out[1])
  };
}

export const skaterConversionPriorsAndBounds = (assistDenominator: SkaterAssistDenominator) => {
  const { ev, pp } = SKATER_ASSIST_SCALE[assistDenominator];
  return {
    priors: { goalRateEs: 0.095, goalRatePp: 0.145, assistRateEs: ev.fallback, assistRatePp: pp.fallback },
    bounds: { goalRateEs: [0.025, 0.3], goalRatePp: [0.04, 0.45], assistRateEs: ev.out, assistRatePp: pp.out },
  } as const;
};

/**
 * Supported split rates are already shrunk toward an adaptive prior, so they are used directly
 * (clamped). Only an unsupported head falls back to the fixed prior via the small-sample blend,
 * which reduces to the prior. `conversionShrink` keeps the pre-shrink Bayes rate and the value
 * the former second shrink would have produced, so a backtest can score both from stored rows.
 */
export function resolveSkaterConversionRates(args: {
  splitRates: { goalRateEs: number | null; goalRatePp: number | null; assistRateEs: number | null; assistRatePp: number | null };
  sampleWeight: number;
  assistDenominator?: SkaterAssistDenominator;
}) {
  const { priors, bounds } = skaterConversionPriorsAndBounds(args.assistDenominator ?? "per_goal");
  const resolve = (key: keyof typeof priors) => {
    const prior = priors[key];
    const [min, max] = bounds[key];
    const bayes = args.splitRates[key];
    const legacy = clamp((bayes ?? prior) * args.sampleWeight + (1 - args.sampleWeight) * prior, min, max);
    return { value: bayes == null ? legacy : clamp(bayes, min, max),
      shrink: { bayes, legacy, sample_weight: args.sampleWeight } };
  };
  const goalEs = resolve("goalRateEs"), goalPp = resolve("goalRatePp");
  const assistEs = resolve("assistRateEs"), assistPp = resolve("assistRatePp");
  return {
    goalRateEs: goalEs.value, goalRatePp: goalPp.value, assistRateEs: assistEs.value, assistRatePp: assistPp.value,
    conversionShrink: { goal_es: goalEs.shrink, goal_pp: goalPp.shrink, assist_es: assistEs.shrink, assist_pp: assistPp.shrink },
  };
}

/** Conversion learning consumes paired observations, never legacy independent scalar windows. */
export function computeSupportedStrengthSplitConversionRates(args: {
  ev: RollingRow | undefined;
  pp: RollingRow | undefined;
  goalRateMultiplier: number;
  assistRateMultiplier: number;
  assistDenominator?: SkaterAssistDenominator;
}) {
  const support = (row: RollingRow | undefined, strengthState: "ev" | "pp") => row
    ? readAlignedCountSupport(row.aligned_count_support, {
        playerId: row.player_id, strengthState,
        anchor: { gameId: row.game_id, gameDate: row.game_date, seasonId: row.season },
      }) : null;
  const ev = support(args.ev, "ev"), pp = support(args.pp, "pp");
  // Each call uses its own pair's common frame. Zero placeholders belong only
  // to unused calculations; absent pairs are withheld below, never observations.
  const calculate = (name: "goalPerShot" | "assistPerGoal") => {
    const e = ev?.pairs[name], p = pp?.pairs[name];
    return computeStrengthSplitConversionRates({
      evGoalsRecent: name === "goalPerShot" ? e?.last5.numerator ?? 0 : e?.last5.denominator ?? 0,
      evGoalsAll: name === "goalPerShot" ? e?.all.numerator ?? 0 : e?.all.denominator ?? 0,
      evShotsRecent: name === "goalPerShot" ? e?.last5.denominator ?? 0 : 0,
      evShotsAll: name === "goalPerShot" ? e?.all.denominator ?? 0 : 0,
      evAssistsRecent: name === "assistPerGoal" ? e?.last5.numerator ?? 0 : 0,
      evAssistsAll: name === "assistPerGoal" ? e?.all.numerator ?? 0 : 0,
      ppGoalsRecent: name === "goalPerShot" ? p?.last5.numerator ?? 0 : p?.last5.denominator ?? 0,
      ppGoalsAll: name === "goalPerShot" ? p?.all.numerator ?? 0 : p?.all.denominator ?? 0,
      ppShotsRecent: name === "goalPerShot" ? p?.last5.denominator ?? 0 : 0,
      ppShotsAll: name === "goalPerShot" ? p?.all.denominator ?? 0 : 0,
      ppAssistsRecent: name === "assistPerGoal" ? p?.last5.numerator ?? 0 : 0,
      ppAssistsAll: name === "assistPerGoal" ? p?.all.numerator ?? 0 : 0,
      goalRateMultiplier: args.goalRateMultiplier, assistRateMultiplier: args.assistRateMultiplier,
      assistDenominator: args.assistDenominator,
    });
  };
  const goals = calculate("goalPerShot"), assists = calculate("assistPerGoal");
  return {
    goalRateEs: ev?.pairs.goalPerShot && ev.pairs.goalPerShot.all.denominator > 0 ? goals.goalRateEs : null,
    goalRatePp: pp?.pairs.goalPerShot && pp.pairs.goalPerShot.all.denominator > 0 ? goals.goalRatePp : null,
    assistRateEs: ev?.pairs.assistPerGoal && ev.pairs.assistPerGoal.all.denominator > 0 ? assists.assistRateEs : null,
    assistRatePp: pp?.pairs.assistPerGoal && pp.pairs.assistPerGoal.all.denominator > 0 ? assists.assistRatePp : null,
    support: { ev, pp },
  };
}

/** Withhold unsupported learned heads and their derived bands/scenarios together. */
export function applySupportedSkaterConversionHeads<T extends {
  proj_goals_es: number | null; proj_goals_pp: number | null;
  proj_assists_es: number | null; proj_assists_pp: number | null; uncertainty: unknown;
}>(row: T, rates: ReturnType<typeof computeSupportedStrengthSplitConversionRates>) {
  const available = {
    goals_es: rates.goalRateEs !== null, goals_pp: rates.goalRatePp !== null,
    assists_es: rates.goalRateEs !== null && rates.assistRateEs !== null,
    assists_pp: rates.goalRatePp !== null && rates.assistRatePp !== null,
  };
  const uncertainty = structuredClone(row.uncertainty) as Record<string, unknown>;
  const record = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const mask = (target: Record<string, unknown> | null) => {
    if (!target) return;
    for (const [key, usable] of Object.entries(available)) if (!usable && key in target) target[key] = null;
  };
  mask(uncertainty);
  for (const [key, usable] of Object.entries({
    g: available.goals_es && available.goals_pp, a: available.assists_es && available.assists_pp,
    pts: Object.values(available).every(Boolean), ppp: available.goals_pp && available.assists_pp,
  })) if (!usable && key in uncertainty) uncertainty[key] = null;
  const model = record(uncertainty.model), selection = record(model?.skater_selection);
  if (selection) {
    selection.conversion_count_support = { policy: "aligned_observations_required", ...rates.support };
    const conversion = record(selection.conversion_rates);
    if (conversion) for (const [key, value] of Object.entries({
      goal_rate_es: rates.goalRateEs, goal_rate_pp: rates.goalRatePp,
      assist_rate_es: rates.assistRateEs, assist_rate_pp: rates.assistRatePp,
    })) if (value === null) conversion[key] = null;
    const scenarios = record(selection.role_scenarios)?.scenario_stat_lines;
    if (Array.isArray(scenarios)) for (const scenario of scenarios) mask(record(scenario));
  }
  mask(record(record(model?.holdout_baselines)?.current_baseline));
  return { ...row, uncertainty,
    proj_goals_es: available.goals_es ? row.proj_goals_es : null,
    proj_goals_pp: available.goals_pp ? row.proj_goals_pp : null,
    proj_assists_es: available.assists_es ? row.proj_assists_es : null,
    proj_assists_pp: available.assists_pp ? row.proj_assists_pp : null,
  };
}
