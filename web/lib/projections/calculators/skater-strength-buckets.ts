import type { RollingRow } from "../types/run-forge-projections.types";
import type { TeamStrengthAverages } from "../queries/team-context-queries";
import {
  SKATER_ASSIST_SHARE_MAX,
  SKATER_ASSIST_SHARE_MIN,
  SKATER_ASSIST_SHARE_PRIORS,
  SKATER_GOAL_CONVERSION_PRIORS,
  SKATER_SHOT_RATE_PRIORS,
} from "../constants/projection-weights";
import { clamp, finiteOrNull } from "../utils/number-utils";

/**
 * Exclusive skater strength buckets (decisions 24, 59, 70). ES, PP and PK follow the penalty
 * context: a pulled goalie (extra attacker) is an overlapping attribute inside whichever bucket the
 * manpower puts it in, so ES + PP + PK is the all-situation line. Empty-net goals are inside these
 * buckets too; FORGE has no separate empty-net estimator, so the named empty-net bucket is reported
 * as unknown (never added on top, which would count those goals twice).
 */
export const SKATER_STRENGTH_ACCOUNTING_VERSION = "forge-skater-strength-buckets-v1";

/** PK conversion has no fitted league prior yet: each player's own PK record shrinks toward his
 * ES rate with the ES prior strengths. These are labelled hypotheses (rule 12), not fitted values. */
export const SKATER_PK_PRIOR_BASIS = "player_es_rates_with_es_prior_strengths_unfitted" as const;

export type TeamSkaterBudget = {
  totalSeconds: number;
  toiEsTarget: number;
  toiPpTarget: number;
  /** Null when the team's PK exposure is unknown; ES then still holds the non-PP remainder. */
  toiPkTarget: number | null;
  shotsPkTarget: number | null;
  pkShare: number | null;
  pkStatus: "modeled" | "unknown_team_pk_exposure";
  esDefinition: "even_strength" | "all_non_pp_time";
};

/**
 * Split one team's skater-second budget into exclusive ES, PP and PK targets. PP keeps its share
 * source; PK takes its share of all-situation skater time from the team's strength table. The
 * three targets add to the budget, so physical rates applied to their sum count PK time once.
 */
export function splitTeamSkaterBudget(args: {
  totalSeconds: number;
  ppShare: number;
  strengthAverages: TeamStrengthAverages;
}): TeamSkaterBudget {
  const total = Math.max(0, args.totalSeconds);
  const toiPpTarget = Math.round(clamp(args.ppShare, 0, 0.5) * total);
  const es = finiteOrNull(args.strengthAverages.toiEsSecondsAvg);
  const pp = finiteOrNull(args.strengthAverages.toiPpSecondsAvg);
  const pk = finiteOrNull(args.strengthAverages.toiPkSecondsAvg);
  const shotsPk = finiteOrNull(args.strengthAverages.shotsPkAvg);
  const all = es != null && pp != null && pk != null ? es + pp + pk : null;
  if (all == null || !(all > 0) || pk! < 0 || es! < 0 || pp! < 0 || shotsPk == null || shotsPk < 0) {
    return { totalSeconds: total, toiEsTarget: total - toiPpTarget, toiPpTarget, toiPkTarget: null,
      shotsPkTarget: null, pkShare: null, pkStatus: "unknown_team_pk_exposure", esDefinition: "all_non_pp_time" };
  }
  const pkShare = pk! / all;
  const toiPkTarget = Math.min(total - toiPpTarget, Math.round(pkShare * total));
  return { totalSeconds: total, toiEsTarget: total - toiPpTarget - toiPkTarget, toiPpTarget, toiPkTarget,
    shotsPkTarget: shotsPk, pkShare, pkStatus: "modeled", esDefinition: "even_strength" };
}

/**
 * Allocate the team PK target in proportion to each player's recent PK seconds. A player with no
 * PK rolling row has unknown PK history: he gets no PK time and is listed, never given a guess.
 * With no known PK history on the roster the allocation is infeasible and returns null.
 */
export function allocateTeamPkToi(args: {
  players: ReadonlyArray<{ playerId: number; weightSeconds: number | null }>;
  targetSeconds: number;
}): { perPlayer: Map<number, number>; playersWithoutPkHistory: number[] } | null {
  const known = args.players.filter((p) => p.weightSeconds != null && Number.isFinite(p.weightSeconds) && p.weightSeconds >= 0);
  const weightSum = known.reduce((sum, p) => sum + p.weightSeconds!, 0);
  if (!(args.targetSeconds >= 0) || !(weightSum > 0)) return null;
  const perPlayer = new Map<number, number>();
  for (const p of args.players) {
    const weight = known.includes(p) ? p.weightSeconds! : 0;
    perPlayer.set(p.playerId, (weight / weightSum) * args.targetSeconds);
  }
  return { perPlayer, playersWithoutPkHistory: args.players.filter((p) => !known.includes(p)).map((p) => p.playerId) };
}

/** Recent PK seconds per game from the PK rolling row; null when the row or value is missing. */
export function skaterPkWeightSeconds(pk: RollingRow | undefined): number | null {
  const value = finiteOrNull(pk?.toi_seconds_avg_last5) ?? finiteOrNull(pk?.toi_seconds_avg_all);
  return value != null && value >= 0 ? value : null;
}

/**
 * Per-player PK shot rate, goals per shot and assist share. Counts use their matched seconds
 * (toi_seconds_total_all), so a known zero keeps its exposure and moves the rate toward zero.
 */
export function computeSkaterPkConversion(args: {
  pk: RollingRow | undefined;
  position: string | null | undefined;
  teamPkShotsPer60: number;
  esGoalRate: number;
  esAssistShare: number;
}): { shotsPer60: number; goalRate: number; assistShare: number; basis: typeof SKATER_PK_PRIOR_BASIS } {
  const group = args.position === "D" ? "D" : "F";
  const kHours = SKATER_SHOT_RATE_PRIORS[group].es.kHours;
  const kShots = SKATER_GOAL_CONVERSION_PRIORS[group].es.k;
  const kGoals = SKATER_ASSIST_SHARE_PRIORS[group].es.k;
  const teamRate = Math.max(0, args.teamPkShotsPer60);
  const seconds = finiteOrNull(args.pk?.toi_seconds_total_all);
  const shots = finiteOrNull(args.pk?.shots_total_all);
  const goals = finiteOrNull(args.pk?.goals_total_all);
  const assists = finiteOrNull(args.pk?.assists_total_all);
  const ipp = finiteOrNull(args.pk?.ipp_all);
  const hours = seconds != null && seconds > 0 && shots != null && shots >= 0 ? seconds / 3600 : 0;
  const shotsPer60 = ((hours > 0 ? shots! : 0) + kHours * teamRate) / (hours + kHours);
  const knownShots = shots != null && shots >= 0 && goals != null && goals >= 0 ? shots : 0;
  const goalRate = ((knownShots > 0 ? Math.min(goals!, knownShots) : 0) + kShots * args.esGoalRate) / (knownShots + kShots);
  let onIceGoals = 0;
  let assisted = 0;
  if (goals != null && assists != null && ipp != null && goals >= 0 && assists >= 0 && ipp > 0) {
    onIceGoals = (goals + assists) / (ipp / 100);
    assisted = Math.min(assists, onIceGoals);
  }
  const assistShare = (assisted + kGoals * args.esAssistShare) / (onIceGoals + kGoals);
  return {
    shotsPer60,
    goalRate: clamp(goalRate, 0, 1),
    assistShare: clamp(assistShare, SKATER_ASSIST_SHARE_MIN, SKATER_ASSIST_SHARE_MAX),
    basis: SKATER_PK_PRIOR_BASIS,
  };
}
