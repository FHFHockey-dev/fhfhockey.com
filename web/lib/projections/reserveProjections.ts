import { resolveNullableCompatibilityValue } from "lib/rollingPlayerMetricCompatibility";
import {
  computeSkaterAssistShare,
  computeSkaterPhysicalEventRates,
  computeSkaterSampleShrinkageAdjustments,
  computeSkaterShotRatePer60,
  computeStrengthSplitConversionRates,
} from "./calculators/skater-adjustments";
import { SKATER_GOAL_CONVERSION_PRIORS } from "./constants/projection-weights";
import type { LeaguePhysicalTotals, RollingRow } from "./types/run-forge-projections.types";
import { clamp, computeShotsFromRate, finiteOrNull } from "./utils/number-utils";

/**
 * FORGE reserve pass (plan B′, tasks/artifacts/forge-week-coverage-2026-10-26/DIAGNOSIS.md). After a team's lineup is
 * projected and reconciled, every other current-roster skater gets an "if he dresses" line and every goalie other than
 * the selected starter an "if he starts" line. They are written to forge_reserve_projections only, never to the
 * lineup tables, so team TOI, goals, Start Chart, accuracy and game revisions are unchanged. A reserve line carries no
 * participation chance: whether he dresses or starts is evidence the reader resolves per game, unknown by default.
 */
export const FORGE_RESERVE_MODEL_VERSION = "forge-reserve-v1";
/** Rollout switch (default off): the run writes, resumes and the RSO bridge reads reserve rows only when it is "true".
 * Off keeps every path exactly as before, so a release can ship before forge_reserve_projections is applied. */
export function forgeReservePassEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.FORGE_RESERVE_PASS_ENABLED === "true";
}
/** Even-strength seconds for a skater with no recorded even-strength time: a 4th-line forward or 3rd-pair defenceman. */
export const RESERVE_ROLE_DEFAULT_TOI_ES_SECONDS = { F: 620, D: 900 } as const;

/** Why the run left him out of its lineup (skaters) or starter slot (goalies). Evidence, not a probability. */
export type ReserveReason = "not_in_lineup" | "ruled_out" | "hard_stale" | "missing_recent_metrics" | "backup_goalie";

/** The lineup pass's own even-strength and power-play scoring environment for this team and game (per game, before
 * horizon scaling). A reserve's assists come from it as they do for lineup skaters, but it is never changed. */
export type ReserveTeamEnvironment = { goalsEs: number; goalsPp: number; toiEs: number; toiPp: number; assistScaleEs: number; assistScalePp: number };
/** Team-level, opponent-goalie and rest multipliers the lineup pass applied to this team and game. */
export type ReserveGameContext = { toiMultiplier: number; shotRateMultiplier: number; goalRateMultiplier: number; assistRateMultiplier: number };

export type ReserveSkaterLine = {
  toiEs: number; toiPp: number; shotsEs: number; shotsPp: number; goalsEs: number; goalsPp: number;
  assistsEs: number; assistsPp: number; hits: number; blocks: number;
  toiBasis: { es: "recent" | "season" | "role_default"; pp: "recent" | "season" | "none_recorded" };
  sampleWeight: number;
};

const pick = (recent: number | null | undefined, season: number | null | undefined) => {
  const r = finiteOrNull(recent), s = finiteOrNull(season);
  return r !== null && r >= 0 ? { value: r, basis: "recent" as const } : s !== null && s >= 0 ? { value: s, basis: "season" as const } : null;
};

/** One skater's per-game line if he dresses: the lineup pass's rate model on his own recent usage. Null without any
 * even-strength or power-play rolling row (no NHL usage to project from). */
export function buildReserveSkaterLine(args: {
  position: string | null; ev: RollingRow | undefined; pp: RollingRow | undefined; all: RollingRow | undefined;
  currentSeasonId: number; league: LeaguePhysicalTotals | null; context: ReserveGameContext; team: ReserveTeamEnvironment;
}): ReserveSkaterLine | null {
  const { position, ev, pp, all, context, team } = args;
  if (!ev && !pp) return null;
  const group = position === "D" ? "D" : "F";
  const esToi = pick(ev?.toi_seconds_avg_last5, ev?.toi_seconds_avg_all);
  const ppToi = pick(pp?.toi_seconds_avg_last5, pp?.toi_seconds_avg_all);
  const toiEs = clamp((esToi?.value ?? RESERVE_ROLE_DEFAULT_TOI_ES_SECONDS[group]) * context.toiMultiplier, 0, 2600);
  const toiPp = clamp((ppToi?.value ?? 0) * context.toiMultiplier, 0, 1300);
  const sample = computeSkaterSampleShrinkageAdjustments({
    evToiSecondsAll: finiteOrNull(ev?.toi_seconds_avg_all), ppToiSecondsAll: finiteOrNull(pp?.toi_seconds_avg_all),
    evShotsAll: finiteOrNull(ev?.shots_total_all), ppShotsAll: finiteOrNull(pp?.shots_total_all),
  });
  const sogEs = clamp(computeSkaterShotRatePer60({ position, strength: "es", shotsAll: ev?.shots_total_all,
    ratePer60All: resolveNullableCompatibilityValue("weighted_rate", ev?.sog_per_60_all, ev?.sog_per_60_avg_all),
    shotsRecent: ev?.shots_total_last5, toiRecentSeconds: ev?.toi_seconds_total_last5 }) * context.shotRateMultiplier, 1.5, 20);
  const sogPp = clamp(computeSkaterShotRatePer60({ position, strength: "pp", shotsAll: pp?.shots_total_all,
    ratePer60All: resolveNullableCompatibilityValue("weighted_rate", pp?.sog_per_60_all, pp?.sog_per_60_avg_all),
    shotsRecent: pp?.shots_total_last5, toiRecentSeconds: pp?.toi_seconds_total_last5 }) * context.shotRateMultiplier, 2, 28);
  const shotsEs = computeShotsFromRate(toiEs, sogEs), shotsPp = computeShotsFromRate(toiPp, sogPp);
  const n = (value: number | null | undefined) => finiteOrNull(value) ?? 0;
  const split = computeStrengthSplitConversionRates({
    evGoalsRecent: n(ev?.goals_total_last5), evShotsRecent: n(ev?.shots_total_last5), evGoalsAll: n(ev?.goals_total_all),
    evShotsAll: n(ev?.shots_total_all), evAssistsRecent: n(ev?.assists_total_last5), evAssistsAll: n(ev?.assists_total_all),
    ppGoalsRecent: n(pp?.goals_total_last5), ppShotsRecent: n(pp?.shots_total_last5), ppGoalsAll: n(pp?.goals_total_all),
    ppShotsAll: n(pp?.shots_total_all), ppAssistsRecent: n(pp?.assists_total_last5), ppAssistsAll: n(pp?.assists_total_all),
    goalRateMultiplier: context.goalRateMultiplier, assistRateMultiplier: context.assistRateMultiplier, position,
  });
  const prior = SKATER_GOAL_CONVERSION_PRIORS[group], w = sample.sampleWeight;
  const goalRateEs = clamp(split.goalRateEs * w + (1 - w) * prior.es.perShot, 0.025, 0.3);
  const goalRatePp = clamp(split.goalRatePp * w + (1 - w) * prior.pp.perShot, 0.04, 0.45);
  // Assists as in the lineup pass: on-ice team goals for his share of the five skater slots x his assist share x the
  // team's assists-per-goal scale, all read from the lineup's environment.
  const onIce = (toi: number, teamToi: number, teamGoals: number) => teamToi > 0 ? teamGoals * 5 * toi / teamToi : 0;
  const shareEs = computeSkaterAssistShare({ goalsAll: ev?.goals_total_all, assistsAll: ev?.assists_total_all, ippAllPct: ev?.ipp_all, position, strength: "es" }).share;
  const sharePp = computeSkaterAssistShare({ goalsAll: pp?.goals_total_all, assistsAll: pp?.assists_total_all, ippAllPct: pp?.ipp_all, position, strength: "pp" }).share;
  const physical = computeSkaterPhysicalEventRates({ all, position, esPpToiSeconds: toiEs + toiPp, currentSeasonId: args.currentSeasonId, league: args.league });
  const physicalHours = (toiEs + toiPp) * physical.toiMultiplier / 3600;
  return {
    toiEs, toiPp, shotsEs, shotsPp, goalsEs: shotsEs * goalRateEs, goalsPp: shotsPp * goalRatePp,
    assistsEs: onIce(toiEs, team.toiEs, team.goalsEs) * shareEs * team.assistScaleEs,
    assistsPp: onIce(toiPp, team.toiPp, team.goalsPp) * sharePp * team.assistScalePp,
    hits: physicalHours * physical.hitsPer60, blocks: physicalHours * physical.blocksPer60,
    toiBasis: { es: esToi?.basis ?? "role_default", pp: ppToi?.basis ?? "none_recorded" }, sampleWeight: w,
  };
}

/** Current-roster skaters of this team the lineup pass did not project, each with the reason it left him out.
 * Goalies, players the players table puts on another team, and lineup players are never reserves. */
export function selectReserveSkaters(args: {
  teamId: number; rosterPlayerIds: number[]; lineupPlayerIds: number[]; goalieIds: Iterable<number>;
  metaById: Map<number, { position: string | null; team_id: number | null }>;
  ruledOutIds: Iterable<number>; hardStaleIds: Iterable<number>; missingMetricIds: Iterable<number>;
}): Array<{ playerId: number; position: string | null; reason: ReserveReason }> {
  const excluded = new Set([...args.lineupPlayerIds, ...args.goalieIds]);
  const ruledOut = new Set(args.ruledOutIds), hardStale = new Set(args.hardStaleIds), missing = new Set(args.missingMetricIds);
  return [...new Set(args.rosterPlayerIds)].sort((a, b) => a - b).flatMap(playerId => {
    const meta = args.metaById.get(playerId);
    if (excluded.has(playerId) || !meta || meta.position === "G" || meta.team_id !== args.teamId) return [];
    const reason: ReserveReason = ruledOut.has(playerId) ? "ruled_out" : hardStale.has(playerId) ? "hard_stale"
      : missing.has(playerId) ? "missing_recent_metrics" : "not_in_lineup";
    return [{ playerId, position: meta.position, reason }];
  });
}

type RowScope = { runId: string; asOfDate: string; horizonGames: number; gameId: number; playerId: number; teamId: number; opponentTeamId: number };
const fixed = (value: number, digits = 3) => Number(value.toFixed(digits));

/** forge_reserve_projections row for a skater, scaled to the horizon like lineup rows. Never a lineup-table row. */
export function buildReserveSkaterRow(scope: RowScope & { reason: ReserveReason; line: ReserveSkaterLine; horizonScalar: number;
  evidence?: { availabilityEventId: number | string | null; latestMetricDate: string | null } }) {
  const { line, horizonScalar: k } = scope;
  return {
    run_id: scope.runId, as_of_date: scope.asOfDate, horizon_games: scope.horizonGames, game_id: scope.gameId,
    player_id: scope.playerId, team_id: scope.teamId, opponent_team_id: scope.opponentTeamId,
    player_class: "skater" as const, conditioning: "if_dressed" as const, reserve_reason: scope.reason, model_version: FORGE_RESERVE_MODEL_VERSION,
    proj_toi_es_seconds: Math.round(line.toiEs * k), proj_toi_pp_seconds: Math.round(line.toiPp * k),
    proj_shots_es: fixed(line.shotsEs * k), proj_shots_pp: fixed(line.shotsPp * k),
    proj_goals_es: fixed(line.goalsEs * k), proj_goals_pp: fixed(line.goalsPp * k),
    proj_assists_es: fixed(line.assistsEs * k), proj_assists_pp: fixed(line.assistsPp * k),
    proj_hits: fixed(line.hits * k), proj_blocks: fixed(line.blocks * k),
    proj_shots_against: null, proj_saves: null, proj_goals_allowed: null, proj_shutout_prob: null,
    uncertainty: { conditioning: "if_dressed", participation_probability: null, reserve_reason: scope.reason,
      toi_basis: line.toiBasis, sample_weight: line.sampleWeight, excluded_from_team_totals: true,
      availability_event_id: scope.evidence?.availabilityEventId ?? null, latest_metric_date: scope.evidence?.latestMetricDate ?? null },
    updated_at: new Date().toISOString(),
  };
}

/** forge_reserve_projections row for a goalie other than the selected starter: his own line if he starts. */
export function buildReserveGoalieRow(scope: RowScope & { reason: ReserveReason; horizonScalar: number;
  model: { shotsAgainst: number; projectedSaves: number; projectedGoalsAllowed: number; shutoutProbability: number; modeledSavePct: number } }) {
  const { model, horizonScalar: k } = scope;
  return {
    run_id: scope.runId, as_of_date: scope.asOfDate, horizon_games: scope.horizonGames, game_id: scope.gameId,
    player_id: scope.playerId, team_id: scope.teamId, opponent_team_id: scope.opponentTeamId,
    player_class: "goalie" as const, conditioning: "if_starts" as const, reserve_reason: scope.reason, model_version: FORGE_RESERVE_MODEL_VERSION,
    proj_toi_es_seconds: null, proj_toi_pp_seconds: null, proj_shots_es: null, proj_shots_pp: null, proj_goals_es: null, proj_goals_pp: null,
    proj_assists_es: null, proj_assists_pp: null, proj_hits: null, proj_blocks: null,
    proj_shots_against: fixed(model.shotsAgainst * k), proj_saves: fixed(model.projectedSaves * k),
    proj_goals_allowed: fixed(model.projectedGoalsAllowed * k), proj_shutout_prob: fixed(model.shutoutProbability, 4),
    uncertainty: { conditioning: "if_starts", start_probability: null, reserve_reason: scope.reason,
      modeled_save_pct: fixed(model.modeledSavePct, 4), excluded_from_team_totals: true },
    updated_at: new Date().toISOString(),
  };
}
export type ForgeReserveRow = ReturnType<typeof buildReserveSkaterRow> | ReturnType<typeof buildReserveGoalieRow>;
