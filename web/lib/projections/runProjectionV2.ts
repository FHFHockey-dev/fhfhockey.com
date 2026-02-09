import supabase from "lib/supabase/server";
import { reconcileTeamToPlayers } from "lib/projections/reconcile";
import {
  buildGoalieUncertainty,
  buildPlayerUncertainty,
  buildTeamUncertainty
} from "lib/projections/uncertainty";
import { computeGoalieProjectionModel, type GoalieEvidence } from "lib/projections/goalieModel";

type GameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

type LineCombinationRow = {
  gameId: number;
  teamId: number;
  forwards: number[] | null;
  defensemen: number[] | null;
  goalies: number[] | null;
};

type LineCombinationContext = {
  lineCombination: LineCombinationRow | null;
  sourceGameDate: string | null;
};

type RollingRow = {
  player_id: number;
  strength_state: string;
  game_date: string;
  toi_seconds_avg_last5: number | null;
  toi_seconds_avg_all: number | null;
  sog_per_60_avg_last5: number | null;
  sog_per_60_avg_all: number | null;
  goals_total_last5: number | null;
  shots_total_last5: number | null;
  assists_total_last5: number | null;
  goals_total_all: number | null;
  shots_total_all: number | null;
  assists_total_all: number | null;
  hits_per_60_avg_last5: number | null;
  hits_per_60_avg_all: number | null;
  blocks_per_60_avg_last5: number | null;
  blocks_per_60_avg_all: number | null;
};

type RosterEventRow = {
  event_id: number;
  team_id: number | null;
  player_id: number | null;
  event_type: string;
  confidence: number;
  payload: any;
  effective_from: string;
  effective_to: string | null;
};

type GoalieGameHistoryRow = {
  shots_against: number | null;
  goals_allowed: number | null;
  saves: number | null;
  game_date?: string | null;
  goalie_id?: number | null;
  toi_seconds?: number | null;
  game_id?: number | null;
};

type PlayerTeamPositionRow = {
  id: number;
  team_id: number | null;
  position: string | null;
};

type WgoSkaterDeploymentProfile = {
  toiPerGameSec: number | null;
  esToiPerGameSec: number | null;
  ppToiPerGameSec: number | null;
};

type SkaterShotQualityProfile = {
  sourceDate: string | null;
  nstShotsPer60: number | null;
  nstIxgPer60: number | null;
  nstRushAttemptsPer60: number | null;
  nstReboundsCreatedPer60: number | null;
};

type SkaterOnIceContextProfile = {
  sourceDate: string | null;
  nstOiXgfPer60: number | null;
  nstOiXgaPer60: number | null;
  nstOiCfPct: number | null;
  possessionPctSafe: number | null;
};

type SkaterTeamLevelContextAdjustment = {
  sampleWeight: number;
  shotRateMultiplier: number;
  goalRateMultiplier: number;
  assistRateMultiplier: number;
  paceEdge: number;
  opponentDefenseEdge: number;
};

type OpponentGoalieContext = {
  source: "goalie_start_projections";
  weightedProjectedGsaaPer60: number | null;
  topStarterProbability: number;
  probabilityMass: number;
  isConfirmedStarter: boolean;
};

type SkaterRestScheduleAdjustment = {
  sampleWeight: number;
  toiMultiplier: number;
  shotRateMultiplier: number;
  goalRateMultiplier: number;
  assistRateMultiplier: number;
  restDelta: number;
  teamRestDays: number | null;
  opponentRestDays: number | null;
};

type SkaterSampleShrinkageAdjustment = {
  sampleWeight: number;
  isLowSample: boolean;
  usedCallupFallback: boolean;
  evidenceToiSeconds: number;
  evidenceShots: number;
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function pickLatestByPlayer(rows: RollingRow[]): Map<number, RollingRow> {
  const byPlayer = new Map<number, RollingRow>();
  for (const r of rows) {
    const existing = byPlayer.get(r.player_id);
    if (!existing || r.game_date > existing.game_date)
      byPlayer.set(r.player_id, r);
  }
  return byPlayer;
}

function safeNumber(n: number | null | undefined, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function finiteOrNull(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function computeShotsFromRate(toiSeconds: number, sogPer60: number): number {
  const toiMinutes = toiSeconds / 60;
  return (sogPer60 / 60) * toiMinutes;
}

export function normalizeWgoToiToSeconds(value: number | null | undefined): number | null {
  const n = finiteOrNull(value);
  if (n == null || n <= 0) return null;
  // WGO TOI/game fields are typically in minutes, but tolerate second-like values.
  if (n <= 60) return Number((n * 60).toFixed(3));
  if (n <= 3600) return Number(n.toFixed(3));
  return 3600;
}

export function blendToiSecondsWithDeploymentPrior(args: {
  rollingSeconds: number | null;
  deploymentPriorSeconds: number | null;
  rollingWeight: number;
}): number | null {
  const rolling = finiteOrNull(args.rollingSeconds);
  const prior = finiteOrNull(args.deploymentPriorSeconds);
  const rollingWeight = clamp(args.rollingWeight, 0, 1);
  if (rolling == null && prior == null) return null;
  if (rolling == null) return prior;
  if (prior == null) return rolling;
  return Number((rollingWeight * rolling + (1 - rollingWeight) * prior).toFixed(3));
}

function computeRate(
  numerator: number,
  denom: number,
  fallback: number
): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denom) || denom <= 0)
    return fallback;
  return numerator / denom;
}

function blendOnlineRate(opts: {
  recentNumerator: number;
  recentDenom: number;
  baseNumerator: number;
  baseDenom: number;
  fallback: number;
  priorStrength: number;
  minRate: number;
  maxRate: number;
}): number {
  const baseRate = computeRate(
    opts.baseNumerator + opts.fallback * opts.priorStrength,
    opts.baseDenom + opts.priorStrength,
    opts.fallback
  );
  const recentRate = computeRate(
    opts.recentNumerator,
    opts.recentDenom,
    baseRate
  );
  const weight = clamp(
    opts.recentDenom / (opts.recentDenom + opts.priorStrength),
    0,
    1
  );
  const blended = baseRate + weight * (recentRate - baseRate);
  return clamp(blended, opts.minRate, opts.maxRate);
}

type TeamStrengthAverages = {
  toiEsSecondsAvg: number | null;
  toiPpSecondsAvg: number | null;
  shotsEsAvg: number | null;
  shotsPpAvg: number | null;
};

function meanOrNull(nums: Array<number | null | undefined>): number | null {
  const vals = nums.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n)
  );
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

async function fetchTeamStrengthAverages(
  teamId: number,
  cutoffDate: string
): Promise<TeamStrengthAverages> {
  assertSupabase();
  const { data, error } = await supabase
    .from("forge_team_game_strength")
    .select("game_date,toi_es_seconds,toi_pp_seconds,shots_es,shots_pp")
    .eq("team_id", teamId)
    .lt("game_date", cutoffDate)
    .order("game_date", { ascending: false })
    .limit(10);
  if (error) throw error;

  const rows = (data ?? []) as any[];
  return {
    toiEsSecondsAvg: meanOrNull(
      rows.map((r) =>
        r?.toi_es_seconds == null ? null : Number(r.toi_es_seconds)
      )
    ),
    toiPpSecondsAvg: meanOrNull(
      rows.map((r) =>
        r?.toi_pp_seconds == null ? null : Number(r.toi_pp_seconds)
      )
    ),
    shotsEsAvg: meanOrNull(
      rows.map((r) => (r?.shots_es == null ? null : Number(r.shots_es)))
    ),
    shotsPpAvg: meanOrNull(
      rows.map((r) => (r?.shots_pp == null ? null : Number(r.shots_pp)))
    )
  };
}

function toDayBoundsUtc(dateOnly: string): { startTs: string; endTs: string } {
  return {
    startTs: `${dateOnly}T00:00:00.000Z`,
    endTs: `${dateOnly}T23:59:59.999Z`
  };
}

export function availabilityMultiplierForEvent(
  eventType: string,
  confidence: number
): number | null {
  const c =
    typeof confidence === "number" && Number.isFinite(confidence)
      ? confidence
      : 0.5;
  switch (eventType) {
    case "INJURY_OUT":
    case "INJURY_IR":
    case "IR":
    case "LTIR":
    case "SUSPENSION":
    case "NON_ROSTER":
    case "SENDDOWN":
      return 0;
    case "DTD":
      return clamp(1 - 0.6 * c, 0.2, 1);
    case "BENCHING":
      return clamp(1 - 0.45 * c, 0.35, 1);
    case "SCRATCH":
      return clamp(1 - 0.8 * c, 0.05, 1);
    case "RETURN":
    case "CALLUP":
      return 1;
    default:
      return null;
  }
}

async function hasPbpGame(gameId: number): Promise<boolean> {
  assertSupabase();
  const { data, error } = await supabase
    .from("pbp_games")
    .select("id")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw error;
  return Boolean((data as any)?.id);
}

async function hasShiftTotals(gameId: number): Promise<boolean> {
  assertSupabase();
  const { count, error } = await supabase
    .from("shift_charts")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function fetchLatestLineCombinationForTeam(
  teamId: number,
  asOfDate: string
): Promise<LineCombinationContext> {
  assertSupabase();
  // Find the most recent game with line combos for this team strictly before the asOfDate.
  const { data, error } = await supabase
    .from("lineCombinations")
    .select(
      `
      gameId,
      teamId,
      forwards,
      defensemen,
      goalies,
      games!inner (
        date
      )
    `
    )
    .eq("teamId", teamId)
    .lt("games.date", asOfDate)
    .order("date", { foreignTable: "games", ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(
      `Error fetching latest LC for team ${teamId} before ${asOfDate}:`,
      error
    );
    return { lineCombination: null, sourceGameDate: null };
  }

  if (!data) return { lineCombination: null, sourceGameDate: null };

  return {
    lineCombination: {
      gameId: data.gameId,
      teamId: data.teamId,
      forwards: data.forwards,
      defensemen: data.defensemen,
      goalies: data.goalies
    },
    sourceGameDate:
      typeof (data as any)?.games?.date === "string"
        ? (data as any).games.date
        : null
  };
}

async function fetchFallbackSkaterIdsForTeam(
  teamId: number,
  asOfDate: string,
  maxPlayers = 18
): Promise<number[]> {
  assertSupabase();
  const oneYearAgo = new Date(
    new Date(`${asOfDate}T00:00:00.000Z`).getTime() - 365 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("rolling_player_game_metrics")
    .select("player_id,game_date,toi_seconds_avg_last5,toi_seconds_avg_all")
    .eq("team_id", teamId)
    .eq("strength_state", "ev")
    .lt("game_date", asOfDate)
    .gt("game_date", oneYearAgo)
    .order("game_date", { ascending: false })
    .limit(1000);
  if (error) throw error;

  const latestByPlayer = new Map<number, { gameDate: string; toi: number }>();
  for (const row of (data ?? []) as Array<any>) {
    const playerId = Number(row?.player_id);
    const gameDate = typeof row?.game_date === "string" ? row.game_date : null;
    if (!Number.isFinite(playerId) || !gameDate) continue;
    const toi = safeNumber(
      row?.toi_seconds_avg_last5,
      safeNumber(row?.toi_seconds_avg_all, 0)
    );
    const existing = latestByPlayer.get(playerId);
    if (!existing || gameDate > existing.gameDate) {
      latestByPlayer.set(playerId, { gameDate, toi });
    }
  }

  return Array.from(latestByPlayer.entries())
    .sort((a, b) => {
      const toiDelta = b[1].toi - a[1].toi;
      if (Math.abs(toiDelta) > 1e-9) return toiDelta;
      return b[1].gameDate.localeCompare(a[1].gameDate);
    })
    .slice(0, Math.max(1, Math.floor(maxPlayers)))
    .map(([playerId]) => playerId);
}

async function fetchTeamSkaterRoleHistory(
  teamId: number,
  asOfDate: string,
  windowGames = SKATER_ROLE_HISTORY_WINDOW_GAMES
): Promise<Map<number, string[]>> {
  assertSupabase();
  const { data, error } = await supabase
    .from("lineCombinations")
    .select(
      `
      forwards,
      defensemen,
      games!inner (
        date
      )
    `
    )
    .eq("teamId", teamId)
    .lt("games.date", asOfDate)
    .order("date", { foreignTable: "games", ascending: false })
    .limit(windowGames);
  if (error) throw error;

  const roleHistoryByPlayer = new Map<number, string[]>();
  const rows = (data ?? []) as Array<any>;
  for (const row of rows) {
    const forwards = Array.isArray(row?.forwards)
      ? row.forwards.filter((id: any) => Number.isFinite(id)).map((id: any) => Number(id))
      : [];
    const defensemen = Array.isArray(row?.defensemen)
      ? row.defensemen.filter((id: any) => Number.isFinite(id)).map((id: any) => Number(id))
      : [];

    forwards.forEach((playerId: number, idx: number) => {
      const line = Math.floor(idx / 3) + 1;
      const role = `L${Math.min(4, Math.max(1, line))}`;
      const existing = roleHistoryByPlayer.get(playerId) ?? [];
      existing.push(role);
      roleHistoryByPlayer.set(playerId, existing);
    });
    defensemen.forEach((playerId: number, idx: number) => {
      const pair = Math.floor(idx / 2) + 1;
      const role = `D${Math.min(3, Math.max(1, pair))}`;
      const existing = roleHistoryByPlayer.get(playerId) ?? [];
      existing.push(role);
      roleHistoryByPlayer.set(playerId, existing);
    });
  }

  return roleHistoryByPlayer;
}

async function fetchTeamLineComboGoaliePrior(
  teamId: number,
  asOfDate: string
): Promise<Map<number, number>> {
  assertSupabase();
  const { data, error } = await supabase
    .from("lineCombinations")
    .select(
      `
      gameId,
      goalies,
      games!inner (
        date
      )
    `
    )
    .eq("teamId", teamId)
    .lt("games.date", asOfDate)
    .order("date", { foreignTable: "games", ascending: false })
    .limit(12);
  if (error) {
    console.warn(
      `Error fetching line-combo goalie prior for team ${teamId} before ${asOfDate}:`,
      error
    );
    return new Map();
  }

  const rows = (data ?? []) as Array<any>;
  if (rows.length === 0) return new Map();
  const weightedByGoalie = new Map<number, number>();
  let totalWeight = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const goalies = Array.isArray(row?.goalies)
      ? row.goalies.filter((n: any) => Number.isFinite(n)).map((n: any) => Number(n))
      : [];
    if (goalies.length === 0) continue;
    const weight = Math.pow(LINE_COMBO_RECENCY_DECAY, i);
    totalWeight += weight;
    for (const goalieId of goalies) {
      weightedByGoalie.set(goalieId, (weightedByGoalie.get(goalieId) ?? 0) + weight);
    }
  }
  if (totalWeight <= 0) return new Map();

  const prior = new Map<number, number>();
  for (const [goalieId, weightedMass] of weightedByGoalie.entries()) {
    const p = clamp(weightedMass / totalWeight, 0, 1);
    prior.set(goalieId, Number(p.toFixed(4)));
  }
  return prior;
}

async function fetchLatestGoalieForTeam(
  teamId: number,
  asOfDate: string
): Promise<number | null> {
  assertSupabase();
  const { data, error } = await supabase
    .from("forge_goalie_game")
    .select("goalie_id,game_date")
    .eq("team_id", teamId)
    .lt("game_date", asOfDate)
    .order("game_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn(
      `Error fetching latest goalie game for team ${teamId} before ${asOfDate}:`,
      error
    );
    return null;
  }
  return Number.isFinite((data as any)?.goalie_id)
    ? Number((data as any).goalie_id)
    : null;
}

function safeStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((acc, n) => acc + n, 0) / values.length;
  const variance =
    values.reduce((acc, n) => acc + (n - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

function toUtcDateMs(dateOnly: string): number {
  return new Date(`${dateOnly}T00:00:00.000Z`).getTime();
}

function daysBetweenDates(a: string, b: string): number {
  const aMs = toUtcDateMs(a);
  const bMs = toUtcDateMs(b);
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return 99;
  return Math.round((aMs - bMs) / (24 * 60 * 60 * 1000));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export type StarterContextForTest = TeamGoalieStarterContext;
export type StarterScenario = {
  goalieId: number;
  probability: number;
  rawProbability: number;
  rank: number;
};

type TeamGoalieStarterContext = {
  startsByGoalie: Map<number, number>;
  lastPlayedDateByGoalie: Map<number, string>;
  totalGames: number;
  previousGameDate: string | null;
  previousGameStarterGoalieId: number | null;
};

type TeamDefensiveEnvironment = {
  avgShotsAgainstLast10: number | null;
  avgShotsAgainstLast5: number | null;
};

type TeamOffenseEnvironment = {
  avgShotsForLast10: number | null;
  avgShotsForLast5: number | null;
  avgGoalsForLast10: number | null;
  avgGoalsForLast5: number | null;
};

type TeamStrengthPrior = {
  sourceDate: string | null;
  xga: number | null;
  xgaPerGame: number | null;
  xgfPerGame: number | null;
};

type TeamFiveOnFiveProfile = {
  sourceDate: string | null;
  gamesPlayed: number;
  savePct5v5: number | null;
  shootingPlusSavePct5v5: number | null;
};

type TeamNstExpectedGoalsProfile = {
  source: "nst_team_all" | "nst_team_stats";
  sourceDate: string | null;
  gamesPlayed: number;
  xga: number | null;
  xgaPer60: number | null;
};

type GoalieWorkloadContext = {
  startsLast7Days: number;
  startsLast14Days: number;
  daysSinceLastStart: number | null;
  isGoalieBackToBack: boolean;
};

type GoalieRestSplitBucket = "0" | "1" | "2" | "3" | "4_plus";

type GoalieRestSplitProfile = {
  sourceDate: string | null;
  savePctByBucket: Partial<Record<GoalieRestSplitBucket, number>>;
  gamesByBucket: Partial<Record<GoalieRestSplitBucket, number>>;
};

type StarterScenarioProjection = {
  goalie_id: number;
  rank: number;
  starter_probability_raw: number;
  starter_probability_top2_normalized: number;
  proj_shots_against: number;
  proj_saves: number;
  proj_goals_allowed: number;
  proj_win_prob: number;
  proj_shutout_prob: number;
  modeled_save_pct: number;
  workload_save_pct_penalty: number;
  rest_split_save_pct_adjustment?: number;
};

const GOALIE_STALE_SOFT_DAYS = 30;
const GOALIE_STALE_HARD_DAYS = 75;
const SKATER_STALE_SOFT_DAYS = 21;
const SKATER_STALE_HARD_DAYS = 45;
const SKATER_SOFT_STALE_MIN_MULTIPLIER = 0.15;
const LINE_COMBO_STALE_SOFT_DAYS = 10;
const LINE_COMBO_STALE_HARD_DAYS = 21;
const SKATER_ROLE_HISTORY_WINDOW_GAMES = 10;
const B2B_REPEAT_STARTER_PENALTY = 2.75;
const B2B_ALTERNATE_GOALIE_BOOST = 0.65;
const TEAM_STRENGTH_WEAKER_GAP = 0.35;
const WEAK_OPPONENT_GF_THRESHOLD = 2.6;
const WEAKER_TEAM_B2B_PRIMARY_PENALTY = 1.1;
const WEAKER_TEAM_B2B_BACKUP_BOOST = 0.45;
const WEAK_OPPONENT_PRIMARY_REST_PENALTY = 0.7;
const WEAK_OPPONENT_BACKUP_BOOST = 0.3;
const LINE_COMBO_RECENCY_DECAY = 0.82;
const LINE_COMBO_PRIOR_LOGIT_WEIGHT = 0.45;
const GOALIE_GSAA_PRIOR_MAX_ABS = 0.6;
const GOALIE_GSAA_PRIOR_WEIGHT = 0.5;
const GOALIE_SEASON_START_PCT_WEIGHT = 0.28;
const GOALIE_SEASON_START_PCT_BASELINE = 0.5;
const GOALIE_SEASON_GAMES_PLAYED_WEIGHT = 0.2;
const OPPONENT_RESTED_BOOST = 0.03;
const OPPONENT_B2B_PENALTY = 0.04;
const DEFENSE_B2B_FATIGUE_BOOST = 0.02;
const OPPONENT_HOME_BOOST = 0.02;
const OPPONENT_AWAY_PENALTY = 0.01;
const GOALIE_HEAVY_WORKLOAD_PENALTY = 0.025;
const GOALIE_VERY_HEAVY_WORKLOAD_PENALTY = 0.04;
const GOALIE_BACK_TO_BACK_PENALTY = 0.03;
const GOALIE_REST_SPLIT_MIN_GAMES = 2;
const GOALIE_REST_SPLIT_MAX_ADJUSTMENT = 0.012;
const TEAM_XG_BASELINE_PER_GAME = 2.95;
const TEAM_XG_SHOTS_AGAINST_MAX_PCT = 0.09;
const TEAM_XG_WIN_CONTEXT_MAX_PCT = 0.1;
const TEAM_5V5_SAVE_PCT_BASELINE = 0.922;
const TEAM_5V5_PDO_BASELINE = 1;
const TEAM_5V5_MIN_SAMPLE_GAMES = 8;
const TEAM_5V5_MAX_LEAGUE_SAVE_PCT_ADJ = 0.01;
const TEAM_5V5_MAX_CONTEXT_PCT_ADJ = 0.035;
const TEAM_NST_XGA_PER60_BASELINE = 2.5;
const TEAM_NST_MAX_CONTEXT_PCT_ADJ = 0.05;
const MAX_SUPPORTED_HORIZON_GAMES = 5;
const HORIZON_DECAY_PER_GAME = 0.015;
const HORIZON_B2B_PENALTY = 0.08;
const HORIZON_ZERO_REST_PENALTY = 0.12;
const HORIZON_LONG_REST_BOOST = 0.03;
const SKATER_IXG_PER_SHOT_BASELINE = 0.09;
const SKATER_RUSH_REBOUND_PER60_BASELINE = 1.1;
const SKATER_SHOT_QUALITY_MIN_MULTIPLIER = 0.82;
const SKATER_SHOT_QUALITY_MAX_MULTIPLIER = 1.2;
const SKATER_CONVERSION_MIN_MULTIPLIER = 0.78;
const SKATER_CONVERSION_MAX_MULTIPLIER = 1.3;
const SKATER_ON_ICE_XG_PER60_BASELINE = 2.45;
const SKATER_ON_ICE_POSSESSION_BASELINE = 0.5;
const SKATER_ON_ICE_SHOT_ENV_MIN_MULTIPLIER = 0.86;
const SKATER_ON_ICE_SHOT_ENV_MAX_MULTIPLIER = 1.16;
const SKATER_ON_ICE_GOAL_ENV_MIN_MULTIPLIER = 0.84;
const SKATER_ON_ICE_GOAL_ENV_MAX_MULTIPLIER = 1.2;
const SKATER_ON_ICE_ASSIST_ENV_MIN_MULTIPLIER = 0.82;
const SKATER_ON_ICE_ASSIST_ENV_MAX_MULTIPLIER = 1.22;
const SKATER_TEAM_LEVEL_SHOT_MIN_MULTIPLIER = 0.86;
const SKATER_TEAM_LEVEL_SHOT_MAX_MULTIPLIER = 1.18;
const SKATER_TEAM_LEVEL_GOAL_MIN_MULTIPLIER = 0.82;
const SKATER_TEAM_LEVEL_GOAL_MAX_MULTIPLIER = 1.2;
const SKATER_TEAM_LEVEL_ASSIST_MIN_MULTIPLIER = 0.84;
const SKATER_TEAM_LEVEL_ASSIST_MAX_MULTIPLIER = 1.2;
const SKATER_OPP_GOALIE_GOAL_MIN_MULTIPLIER = 0.82;
const SKATER_OPP_GOALIE_GOAL_MAX_MULTIPLIER = 1.22;
const SKATER_OPP_GOALIE_ASSIST_MIN_MULTIPLIER = 0.86;
const SKATER_OPP_GOALIE_ASSIST_MAX_MULTIPLIER = 1.18;
const SKATER_REST_TOI_MIN_MULTIPLIER = 0.88;
const SKATER_REST_TOI_MAX_MULTIPLIER = 1.1;
const SKATER_REST_SHOT_MIN_MULTIPLIER = 0.86;
const SKATER_REST_SHOT_MAX_MULTIPLIER = 1.14;
const SKATER_REST_GOAL_MIN_MULTIPLIER = 0.85;
const SKATER_REST_GOAL_MAX_MULTIPLIER = 1.16;
const SKATER_REST_ASSIST_MIN_MULTIPLIER = 0.86;
const SKATER_REST_ASSIST_MAX_MULTIPLIER = 1.15;
const SKATER_SMALL_SAMPLE_TOI_SECONDS_SCALE = 900;
const SKATER_SMALL_SAMPLE_SHOTS_SCALE = 45;
const SKATER_SMALL_SAMPLE_LOW_WEIGHT_THRESHOLD = 0.45;
const SKATER_SMALL_SAMPLE_CALLUP_WEIGHT_THRESHOLD = 0.22;

type ActiveSkaterFilterResult = {
  eligibleSkaterIds: number[];
  recencyMultiplierByPlayerId: Map<number, number>;
  stats: {
    filteredByTeamOrPosition: number;
    filteredMissingRecentMetrics: number;
    filteredHardStale: number;
    softStalePenalized: number;
  };
};

type LineCombinationRecencyAssessment = {
  isMissing: boolean;
  isSoftStale: boolean;
  isHardStale: boolean;
  daysStale: number | null;
};

type SkaterRoleTag = {
  esRole: string;
  unitTier: "TOP" | "MIDDLE" | "DEPTH";
  roleRank: number;
  source: "line_combination" | "fallback_toi_rank";
};

type SkaterRoleContinuitySummary = {
  windowGames: number;
  appearancesTracked: number;
  gamesInCurrentRole: number;
  continuityShare: number;
  roleChangeRate: number;
  volatilityIndex: number;
};

export function assessLineCombinationRecency(args: {
  asOfDate: string;
  sourceGameDate: string | null;
  softDays?: number;
  hardDays?: number;
}): LineCombinationRecencyAssessment {
  const softDays = Number.isFinite(args.softDays)
    ? Math.max(0, Math.floor(Number(args.softDays)))
    : LINE_COMBO_STALE_SOFT_DAYS;
  const hardDays = Number.isFinite(args.hardDays)
    ? Math.max(softDays + 1, Math.floor(Number(args.hardDays)))
    : LINE_COMBO_STALE_HARD_DAYS;

  if (!args.sourceGameDate) {
    return {
      isMissing: true,
      isSoftStale: false,
      isHardStale: true,
      daysStale: null
    };
  }

  const daysStale = Math.max(
    0,
    daysBetweenDates(args.asOfDate, args.sourceGameDate)
  );
  return {
    isMissing: false,
    isSoftStale: daysStale > softDays,
    isHardStale: daysStale > hardDays,
    daysStale
  };
}

function toSkaterPositionGroup(position: string | null | undefined): "F" | "D" | "OTHER" {
  const p = typeof position === "string" ? position.toUpperCase() : "";
  if (p === "D") return "D";
  if (p === "C" || p === "L" || p === "R" || p === "LW" || p === "RW") return "F";
  return "OTHER";
}

function tierFromRole(role: string): "TOP" | "MIDDLE" | "DEPTH" {
  if (role === "L1" || role === "D1") return "TOP";
  if (role === "L2" || role === "D2") return "MIDDLE";
  return "DEPTH";
}

export function buildSkaterRoleTags(args: {
  lineCombination: LineCombinationRow | null;
  useFallbackRoles: boolean;
  fallbackRankedSkaterIds: number[];
  playerMetaById: Map<number, PlayerTeamPositionRow>;
  teamId: number;
}): Map<number, SkaterRoleTag> {
  const roleByPlayerId = new Map<number, SkaterRoleTag>();
  const setRole = (
    playerId: number,
    esRole: string,
    roleRank: number,
    source: "line_combination" | "fallback_toi_rank"
  ) => {
    if (roleByPlayerId.has(playerId)) return;
    roleByPlayerId.set(playerId, {
      esRole,
      unitTier: tierFromRole(esRole),
      roleRank,
      source
    });
  };

  if (args.lineCombination && !args.useFallbackRoles) {
    const forwards = (args.lineCombination.forwards ?? []).filter((id) => {
      if (!Number.isFinite(id)) return false;
      const meta = args.playerMetaById.get(id);
      return (
        Boolean(meta) &&
        meta?.team_id === args.teamId &&
        toSkaterPositionGroup(meta?.position) === "F"
      );
    });
    const defensemen = (args.lineCombination.defensemen ?? []).filter((id) => {
      if (!Number.isFinite(id)) return false;
      const meta = args.playerMetaById.get(id);
      return (
        Boolean(meta) &&
        meta?.team_id === args.teamId &&
        toSkaterPositionGroup(meta?.position) === "D"
      );
    });

    forwards.forEach((playerId, idx) => {
      const line = Math.floor(idx / 3) + 1;
      const clampedLine = Math.min(4, Math.max(1, line));
      setRole(playerId, `L${clampedLine}`, idx + 1, "line_combination");
    });
    defensemen.forEach((playerId, idx) => {
      const pair = Math.floor(idx / 2) + 1;
      const clampedPair = Math.min(3, Math.max(1, pair));
      setRole(playerId, `D${clampedPair}`, idx + 1, "line_combination");
    });
  }

  if (roleByPlayerId.size === 0 || args.useFallbackRoles) {
    const fallbackIds = Array.from(new Set(args.fallbackRankedSkaterIds)).filter((id) => {
      const meta = args.playerMetaById.get(id);
      return Boolean(meta) && meta?.team_id === args.teamId && meta?.position !== "G";
    });
    const forwards: number[] = [];
    const defensemen: number[] = [];
    const other: number[] = [];
    for (const playerId of fallbackIds) {
      const group = toSkaterPositionGroup(args.playerMetaById.get(playerId)?.position);
      if (group === "F") forwards.push(playerId);
      else if (group === "D") defensemen.push(playerId);
      else other.push(playerId);
    }
    forwards.forEach((playerId, idx) => {
      const line = Math.floor(idx / 3) + 1;
      const clampedLine = Math.min(4, Math.max(1, line));
      setRole(playerId, `L${clampedLine}`, idx + 1, "fallback_toi_rank");
    });
    defensemen.forEach((playerId, idx) => {
      const pair = Math.floor(idx / 2) + 1;
      const clampedPair = Math.min(3, Math.max(1, pair));
      setRole(playerId, `D${clampedPair}`, idx + 1, "fallback_toi_rank");
    });
    other.forEach((playerId, idx) => {
      setRole(playerId, "L4", forwards.length + defensemen.length + idx + 1, "fallback_toi_rank");
    });
  }

  return roleByPlayerId;
}

export function summarizeSkaterRoleContinuity(args: {
  currentRole: string;
  recentRoles: string[];
  windowGames?: number;
}): SkaterRoleContinuitySummary {
  const windowGames = Number.isFinite(args.windowGames)
    ? Math.max(1, Math.floor(Number(args.windowGames)))
    : SKATER_ROLE_HISTORY_WINDOW_GAMES;
  const roles = args.recentRoles.slice(0, windowGames);
  const appearancesTracked = roles.length;
  if (appearancesTracked === 0) {
    return {
      windowGames,
      appearancesTracked: 0,
      gamesInCurrentRole: 0,
      continuityShare: 0,
      roleChangeRate: 0,
      volatilityIndex: 0
    };
  }

  const gamesInCurrentRole = roles.filter((r) => r === args.currentRole).length;
  const continuityShare = gamesInCurrentRole / appearancesTracked;
  let roleChanges = 0;
  for (let i = 0; i < roles.length - 1; i += 1) {
    if (roles[i] !== roles[i + 1]) roleChanges += 1;
  }
  const roleChangeRate =
    appearancesTracked > 1 ? roleChanges / (appearancesTracked - 1) : 0;
  const volatilityIndex = new Set(roles).size / appearancesTracked;

  return {
    windowGames,
    appearancesTracked,
    gamesInCurrentRole,
    continuityShare: Number(continuityShare.toFixed(4)),
    roleChangeRate: Number(roleChangeRate.toFixed(4)),
    volatilityIndex: Number(volatilityIndex.toFixed(4))
  };
}

export function computeSkaterRoleStabilityMultiplier(
  summary: SkaterRoleContinuitySummary
): number {
  if (summary.appearancesTracked <= 1) return 1;

  let penalty = 0;
  let bonus = 0;
  if (summary.continuityShare < 0.6) {
    penalty += (0.6 - summary.continuityShare) * 0.35;
  }
  penalty += summary.roleChangeRate * 0.12;
  if (summary.volatilityIndex > 0.5) {
    penalty += (summary.volatilityIndex - 0.5) * 0.2;
  }
  if (summary.appearancesTracked >= 4 && summary.continuityShare >= 0.75) {
    bonus += Math.min(0.05, (summary.continuityShare - 0.75) * 0.2);
  }

  return clamp(Number((1 - penalty + bonus).toFixed(4)), 0.7, 1.05);
}

function computeSkaterRecencyMultiplier(daysSinceLastMetric: number): number {
  if (daysSinceLastMetric <= SKATER_STALE_SOFT_DAYS) return 1;
  if (daysSinceLastMetric > SKATER_STALE_HARD_DAYS) return 0;
  const span = Math.max(1, SKATER_STALE_HARD_DAYS - SKATER_STALE_SOFT_DAYS);
  const progress = clamp((daysSinceLastMetric - SKATER_STALE_SOFT_DAYS) / span, 0, 1);
  return clamp(
    1 - progress * (1 - SKATER_SOFT_STALE_MIN_MULTIPLIER),
    SKATER_SOFT_STALE_MIN_MULTIPLIER,
    1
  );
}

export function filterActiveSkaterCandidateIds(args: {
  asOfDate: string;
  teamId: number;
  rawSkaterIds: number[];
  playerMetaById: Map<number, PlayerTeamPositionRow>;
  latestMetricDateByPlayerId: Map<number, string>;
}): ActiveSkaterFilterResult {
  const uniqueRaw = Array.from(new Set(args.rawSkaterIds)).filter((id) =>
    Number.isFinite(id)
  );
  const eligibleSkaterIds: number[] = [];
  const recencyMultiplierByPlayerId = new Map<number, number>();
  const stats = {
    filteredByTeamOrPosition: 0,
    filteredMissingRecentMetrics: 0,
    filteredHardStale: 0,
    softStalePenalized: 0
  };

  for (const playerId of uniqueRaw) {
    const meta = args.playerMetaById.get(playerId);
    const isSkater = Boolean(meta && meta.position != null && meta.position !== "G");
    const isOnTeam = Boolean(meta && meta.team_id != null && meta.team_id === args.teamId);
    if (!isSkater || !isOnTeam) {
      stats.filteredByTeamOrPosition += 1;
      continue;
    }

    const latestMetricDate = args.latestMetricDateByPlayerId.get(playerId) ?? null;
    if (!latestMetricDate) {
      stats.filteredMissingRecentMetrics += 1;
      continue;
    }

    const daysSinceLastMetric = Math.max(
      0,
      daysBetweenDates(args.asOfDate, latestMetricDate)
    );
    const recencyMultiplier = computeSkaterRecencyMultiplier(daysSinceLastMetric);
    if (recencyMultiplier <= 0) {
      stats.filteredHardStale += 1;
      continue;
    }

    if (recencyMultiplier < 1) stats.softStalePenalized += 1;
    recencyMultiplierByPlayerId.set(playerId, recencyMultiplier);
    eligibleSkaterIds.push(playerId);
  }

  return {
    eligibleSkaterIds,
    recencyMultiplierByPlayerId,
    stats
  };
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
  const reboundsPer60 = Math.max(
    0,
    finiteOrNull(profile.nstReboundsCreatedPer60) ?? 0
  );
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
    qualityPerShot:
      qualityPerShot == null ? null : Number(qualityPerShot.toFixed(4)),
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
    possessionPct:
      possessionPct == null ? null : Number(possessionPct.toFixed(4))
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

  if (
    !teamStrength &&
    !opponentStrength &&
    !teamFiveOnFive &&
    !opponentFiveOnFive &&
    !teamNst &&
    !opponentNst
  ) {
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
  const opponentXgaPerGame =
    opponentStrength?.xgaPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const teamPdo =
    normalizeRateOrPercent(teamFiveOnFive?.shootingPlusSavePct5v5) ??
    TEAM_5V5_PDO_BASELINE;
  const opponentSavePct5v5 =
    normalizeRateOrPercent(opponentFiveOnFive?.savePct5v5) ??
    TEAM_5V5_SAVE_PCT_BASELINE;
  const teamNstXgaPer60 = teamNst?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE;
  const opponentNstXgaPer60 =
    opponentNst?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE;
  const nstPaceProxy = (teamNstXgaPer60 + opponentNstXgaPer60) / 2;

  const strengthSampleRaw =
    Math.max(0, teamStrength?.xga ?? 0) + Math.max(0, opponentStrength?.xga ?? 0);
  const fiveOnFiveSampleRaw =
    Math.max(0, teamFiveOnFive?.gamesPlayed ?? 0) +
    Math.max(0, opponentFiveOnFive?.gamesPlayed ?? 0);
  const nstSampleRaw =
    Math.max(0, teamNst?.gamesPlayed ?? 0) + Math.max(0, opponentNst?.gamesPlayed ?? 0);
  const sampleWeight = clamp(
    strengthSampleRaw / (strengthSampleRaw + 260) * 0.35 +
      fiveOnFiveSampleRaw / (fiveOnFiveSampleRaw + 18) * 0.3 +
      nstSampleRaw / (nstSampleRaw + 40) * 0.35,
    0,
    1
  );

  const offenseEdge = clamp(
    (teamXgfPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.22,
    0.22
  );
  const defenseLiabilityEdge = clamp(
    (opponentXgaPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.22,
    0.22
  );
  const paceEdge = clamp(
    (nstPaceProxy - TEAM_NST_XGA_PER60_BASELINE) / TEAM_NST_XGA_PER60_BASELINE,
    -0.2,
    0.2
  );
  const pdoEdge = clamp(
    teamPdo - TEAM_5V5_PDO_BASELINE,
    -0.08,
    0.08
  );
  const opponentSaveEdge = clamp(
    TEAM_5V5_SAVE_PCT_BASELINE - opponentSavePct5v5,
    -0.03,
    0.03
  );

  const shotRateMultiplier = clamp(
    1 +
      sampleWeight *
        (offenseEdge * 0.14 +
          defenseLiabilityEdge * 0.18 +
          paceEdge * 0.2 +
          pdoEdge * 0.06),
    SKATER_TEAM_LEVEL_SHOT_MIN_MULTIPLIER,
    SKATER_TEAM_LEVEL_SHOT_MAX_MULTIPLIER
  );
  const goalRateMultiplier = clamp(
    1 +
      sampleWeight *
        (offenseEdge * 0.16 +
          defenseLiabilityEdge * 0.22 +
          opponentSaveEdge * 2.3 +
          paceEdge * 0.08),
    SKATER_TEAM_LEVEL_GOAL_MIN_MULTIPLIER,
    SKATER_TEAM_LEVEL_GOAL_MAX_MULTIPLIER
  );
  const assistRateMultiplier = clamp(
    1 +
      sampleWeight *
        (offenseEdge * 0.18 +
          defenseLiabilityEdge * 0.16 +
          paceEdge * 0.12 +
          pdoEdge * 0.08),
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
  const starterCertainty = context.isConfirmedStarter
    ? 1
    : clamp(context.topStarterProbability, 0, 1);
  const probabilityMass = clamp(context.probabilityMass, 0, 1);
  const sampleWeight = clamp(
    probabilityMass * (0.45 + 0.55 * starterCertainty),
    0,
    1
  );
  const qualityEdge =
    weightedGsaa != null ? clamp(weightedGsaa / GOALIE_GSAA_PRIOR_MAX_ABS, -1, 1) : 0;

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
    weightedProjectedGsaaPer60:
      weightedGsaa == null ? null : Number(weightedGsaa.toFixed(4)),
    starterCertainty: Number(starterCertainty.toFixed(4))
  };
}

export function computeSkaterRestScheduleAdjustments(args: {
  teamRestDays: number | null;
  opponentRestDays: number | null;
  isHome: boolean;
}): SkaterRestScheduleAdjustment {
  const teamRestDays =
    Number.isFinite(args.teamRestDays) && args.teamRestDays != null
      ? Math.max(0, Number(args.teamRestDays))
      : null;
  const opponentRestDays =
    Number.isFinite(args.opponentRestDays) && args.opponentRestDays != null
      ? Math.max(0, Number(args.opponentRestDays))
      : null;

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
    1 -
      teamFatiguePenalty +
      teamRecoveryBoost +
      restDelta * 0.03 +
      homeIceEdge * 0.6,
    SKATER_REST_TOI_MIN_MULTIPLIER,
    SKATER_REST_TOI_MAX_MULTIPLIER
  );
  const shotRateMultiplier = clamp(
    1 +
      opponentFatigueBoost -
      teamFatiguePenalty * 0.35 +
      restDelta * 0.045 +
      homeIceEdge * 0.45,
    SKATER_REST_SHOT_MIN_MULTIPLIER,
    SKATER_REST_SHOT_MAX_MULTIPLIER
  );
  const goalRateMultiplier = clamp(
    1 +
      opponentFatigueBoost * 0.72 -
      teamFatiguePenalty * 0.25 +
      restDelta * 0.035 +
      homeIceEdge * 0.8,
    SKATER_REST_GOAL_MIN_MULTIPLIER,
    SKATER_REST_GOAL_MAX_MULTIPLIER
  );
  const assistRateMultiplier = clamp(
    1 +
      opponentFatigueBoost * 0.5 -
      teamFatiguePenalty * 0.2 +
      restDelta * 0.04 +
      homeIceEdge * 0.55,
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
  const sampleWeight = Number(
    clamp(toiEvidenceWeight * 0.58 + shotEvidenceWeight * 0.42, 0, 1).toFixed(4)
  );
  return {
    sampleWeight,
    isLowSample: sampleWeight < SKATER_SMALL_SAMPLE_LOW_WEIGHT_THRESHOLD,
    usedCallupFallback: sampleWeight < SKATER_SMALL_SAMPLE_CALLUP_WEIGHT_THRESHOLD,
    evidenceToiSeconds: Number(evidenceToiSeconds.toFixed(3)),
    evidenceShots: Number(evidenceShots.toFixed(3))
  };
}

function computeWorkloadSavePctPenalty(workload: GoalieWorkloadContext): number {
  let penalty = 0;
  if (workload.startsLast14Days >= 6) {
    penalty += GOALIE_VERY_HEAVY_WORKLOAD_PENALTY;
  } else if (workload.startsLast14Days >= 5) {
    penalty += GOALIE_HEAVY_WORKLOAD_PENALTY;
  }
  if (workload.isGoalieBackToBack) {
    penalty += GOALIE_BACK_TO_BACK_PENALTY;
  }
  return penalty;
}

export function toGoalieRestSplitBucket(
  daysSinceLastStart: number | null
): GoalieRestSplitBucket {
  if (daysSinceLastStart == null) return "4_plus";
  if (daysSinceLastStart <= 0) return "0";
  if (daysSinceLastStart === 1) return "1";
  if (daysSinceLastStart === 2) return "2";
  if (daysSinceLastStart === 3) return "3";
  return "4_plus";
}

export function computeGoalieRestSplitSavePctAdjustment(args: {
  profile: GoalieRestSplitProfile | null;
  daysSinceLastStart: number | null;
}): number {
  const { profile, daysSinceLastStart } = args;
  if (!profile) return 0;

  const bucket = toGoalieRestSplitBucket(daysSinceLastStart);
  const bucketGames = profile.gamesByBucket[bucket] ?? 0;
  const bucketSavePct = profile.savePctByBucket[bucket];
  if (
    !Number.isFinite(bucketGames) ||
    bucketGames < GOALIE_REST_SPLIT_MIN_GAMES ||
    !Number.isFinite(bucketSavePct)
  ) {
    return 0;
  }

  let weightedSavePctSum = 0;
  let weightedGames = 0;
  const buckets: GoalieRestSplitBucket[] = ["0", "1", "2", "3", "4_plus"];
  for (const b of buckets) {
    const games = profile.gamesByBucket[b] ?? 0;
    const savePct = profile.savePctByBucket[b];
    if (
      Number.isFinite(games) &&
      games > 0 &&
      Number.isFinite(savePct) &&
      savePct != null
    ) {
      weightedSavePctSum += games * savePct;
      weightedGames += games;
    }
  }
  if (weightedGames <= 0) return 0;

  const baselineSavePct = weightedSavePctSum / weightedGames;
  const sampleWeight = clamp(bucketGames / (bucketGames + 6), 0, 1);
  const delta = (bucketSavePct as number) - baselineSavePct;
  return clamp(
    delta * sampleWeight,
    -GOALIE_REST_SPLIT_MAX_ADJUSTMENT,
    GOALIE_REST_SPLIT_MAX_ADJUSTMENT
  );
}

export function computeTeamStrengthContextAdjustment(args: {
  defendingTeamPrior: TeamStrengthPrior | null;
  opponentTeamPrior: TeamStrengthPrior | null;
}): {
  shotsAgainstPctAdjustment: number;
  teamGoalsForPctAdjustment: number;
  opponentGoalsForPctAdjustment: number;
  sampleWeight: number;
} {
  const defending = args.defendingTeamPrior;
  const opponent = args.opponentTeamPrior;
  if (!defending && !opponent) {
    return {
      shotsAgainstPctAdjustment: 0,
      teamGoalsForPctAdjustment: 0,
      opponentGoalsForPctAdjustment: 0,
      sampleWeight: 0
    };
  }

  const defendingXgaPerGame = defending?.xgaPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const defendingXgfPerGame = defending?.xgfPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const opponentXgaPerGame = opponent?.xgaPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const opponentXgfPerGame = opponent?.xgfPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const defendingXgaRaw = Math.max(0, defending?.xga ?? 0);
  const opponentXgaRaw = Math.max(0, opponent?.xga ?? 0);
  const sampleWeight = clamp((defendingXgaRaw + opponentXgaRaw) / 280, 0, 1);

  const defenseLiabilityEdge = clamp(
    (defendingXgaPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.2,
    0.2
  );
  const opponentOffenseEdge = clamp(
    (opponentXgfPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.2,
    0.2
  );
  const teamOffenseEdge = clamp(
    (defendingXgfPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.2,
    0.2
  );
  const opponentDefenseEdge = clamp(
    (opponentXgaPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.2,
    0.2
  );

  const shotsAgainstPctAdjustment = clamp(
    (defenseLiabilityEdge * 0.32 + opponentOffenseEdge * 0.36) * sampleWeight,
    -TEAM_XG_SHOTS_AGAINST_MAX_PCT,
    TEAM_XG_SHOTS_AGAINST_MAX_PCT
  );
  const teamGoalsForPctAdjustment = clamp(
    (teamOffenseEdge * 0.3 - opponentDefenseEdge * 0.24) * sampleWeight,
    -TEAM_XG_WIN_CONTEXT_MAX_PCT,
    TEAM_XG_WIN_CONTEXT_MAX_PCT
  );
  const opponentGoalsForPctAdjustment = clamp(
    (opponentOffenseEdge * 0.28 + defenseLiabilityEdge * 0.22) * sampleWeight,
    -TEAM_XG_WIN_CONTEXT_MAX_PCT,
    TEAM_XG_WIN_CONTEXT_MAX_PCT
  );

  return {
    shotsAgainstPctAdjustment,
    teamGoalsForPctAdjustment,
    opponentGoalsForPctAdjustment,
    sampleWeight
  };
}

function normalizeRateOrPercent(
  value: number | null | undefined
): number | null {
  if (!Number.isFinite(value)) return null;
  const raw = Number(value);
  if (raw < 0) return null;
  if (raw > 2 && raw <= 200) return raw / 100;
  return raw;
}

export function computeTeamFiveOnFiveContextAdjustment(args: {
  defendingTeamProfile: TeamFiveOnFiveProfile | null;
  opponentTeamProfile: TeamFiveOnFiveProfile | null;
}): {
  sampleWeight: number;
  leagueSavePctAdjustment: number;
  contextPctAdjustment: number;
} {
  const defending = args.defendingTeamProfile;
  const opponent = args.opponentTeamProfile;
  if (!defending && !opponent) {
    return {
      sampleWeight: 0,
      leagueSavePctAdjustment: 0,
      contextPctAdjustment: 0
    };
  }

  const defendingSavePct =
    normalizeRateOrPercent(defending?.savePct5v5) ?? TEAM_5V5_SAVE_PCT_BASELINE;
  const defendingSpsv =
    normalizeRateOrPercent(defending?.shootingPlusSavePct5v5) ?? TEAM_5V5_PDO_BASELINE;
  const opponentSpsv =
    normalizeRateOrPercent(opponent?.shootingPlusSavePct5v5) ?? TEAM_5V5_PDO_BASELINE;
  const defendingGames = Math.max(0, defending?.gamesPlayed ?? 0);
  const opponentGames = Math.max(0, opponent?.gamesPlayed ?? 0);
  const sampleWeight = clamp(
    (defendingGames + opponentGames) /
      (defendingGames + opponentGames + TEAM_5V5_MIN_SAMPLE_GAMES),
    0,
    1
  );

  const saveEdge = clamp(
    defendingSavePct - TEAM_5V5_SAVE_PCT_BASELINE,
    -0.03,
    0.03
  );
  const defendingPdoEdge = clamp(
    defendingSpsv - TEAM_5V5_PDO_BASELINE,
    -0.08,
    0.08
  );
  const opponentPdoEdge = clamp(
    opponentSpsv - TEAM_5V5_PDO_BASELINE,
    -0.08,
    0.08
  );

  const leagueSavePctAdjustment = clamp(
    (saveEdge * 0.75 + defendingPdoEdge * 0.2) * sampleWeight,
    -TEAM_5V5_MAX_LEAGUE_SAVE_PCT_ADJ,
    TEAM_5V5_MAX_LEAGUE_SAVE_PCT_ADJ
  );
  const contextPctAdjustment = clamp(
    (-saveEdge * 0.45 + opponentPdoEdge * 0.2) * sampleWeight,
    -TEAM_5V5_MAX_CONTEXT_PCT_ADJ,
    TEAM_5V5_MAX_CONTEXT_PCT_ADJ
  );

  return {
    sampleWeight,
    leagueSavePctAdjustment,
    contextPctAdjustment
  };
}

export function computeNstOpponentDangerAdjustment(args: {
  defendingTeamProfile: TeamNstExpectedGoalsProfile | null;
  opponentTeamProfile: TeamNstExpectedGoalsProfile | null;
}): { sampleWeight: number; contextPctAdjustment: number } {
  const defending = args.defendingTeamProfile;
  const opponent = args.opponentTeamProfile;
  if (!defending && !opponent) {
    return { sampleWeight: 0, contextPctAdjustment: 0 };
  }

  const defendingXgaPer60 =
    defending?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE;
  const opponentXgaPer60 = opponent?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE;
  const defendingGames = Math.max(0, defending?.gamesPlayed ?? 0);
  const opponentGames = Math.max(0, opponent?.gamesPlayed ?? 0);
  const sampleWeight = clamp(
    (defendingGames + opponentGames) / (defendingGames + opponentGames + 30),
    0,
    1
  );

  const defendingDangerEdge = clamp(
    (defendingXgaPer60 - TEAM_NST_XGA_PER60_BASELINE) /
      TEAM_NST_XGA_PER60_BASELINE,
    -0.25,
    0.25
  );
  const paceProxyEdge = clamp(
    (opponentXgaPer60 - TEAM_NST_XGA_PER60_BASELINE) /
      TEAM_NST_XGA_PER60_BASELINE,
    -0.2,
    0.2
  );

  const contextPctAdjustment = clamp(
    (defendingDangerEdge * 0.32 + paceProxyEdge * 0.12) * sampleWeight,
    -TEAM_NST_MAX_CONTEXT_PCT_ADJ,
    TEAM_NST_MAX_CONTEXT_PCT_ADJ
  );

  return {
    sampleWeight,
    contextPctAdjustment
  };
}

function clampHorizonGames(horizonGames: number): number {
  if (!Number.isFinite(horizonGames)) return 1;
  return clamp(Math.floor(horizonGames), 1, MAX_SUPPORTED_HORIZON_GAMES);
}

export function buildSequentialHorizonScalarsFromDates(
  gameDates: string[],
  horizonGames: number
): number[] {
  const horizon = clampHorizonGames(horizonGames);
  const uniqueSortedDates = Array.from(
    new Set(gameDates.filter((d) => typeof d === "string" && d.length >= 10))
  )
    .map((d) => d.slice(0, 10))
    .sort((a, b) => a.localeCompare(b));

  const scalars: number[] = [];
  let previousDate: string | null = null;
  for (let i = 0; i < horizon; i += 1) {
    const date = uniqueSortedDates[i] ?? null;
    const restDays =
      previousDate && date ? Math.max(0, daysBetweenDates(date, previousDate)) : null;
    let scalar = 1 - i * HORIZON_DECAY_PER_GAME;
    if (restDays === 0) scalar -= HORIZON_ZERO_REST_PENALTY;
    if (restDays === 1) scalar -= HORIZON_B2B_PENALTY;
    if (restDays != null && restDays >= 3) scalar += HORIZON_LONG_REST_BOOST;
    scalars.push(clamp(scalar, 0.75, 1.08));
    if (date) previousDate = date;
  }
  return scalars;
}

async function fetchTeamHorizonScalars(
  teamId: number,
  asOfDate: string,
  horizonGames: number
): Promise<number[]> {
  assertSupabase();
  const horizon = clampHorizonGames(horizonGames);
  if (horizon <= 1) return [1];

  const { data, error } = await supabase
    .from("games")
    .select("date")
    .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
    .gte("date", asOfDate)
    .order("date", { ascending: true })
    .limit(horizon);
  if (error) throw error;
  const dates = ((data ?? []) as Array<{ date: string | null }>)
    .map((r) => r.date)
    .filter((d): d is string => typeof d === "string");
  return buildSequentialHorizonScalarsFromDates(dates, horizon);
}

export function blendTopStarterScenarioOutputs(opts: {
  scenarioProjections: StarterScenarioProjection[];
  fallbackProjection: Omit<
    StarterScenarioProjection,
    "goalie_id" | "rank" | "starter_probability_raw" | "starter_probability_top2_normalized"
  >;
}) {
  const weighted = {
    proj_shots_against: 0,
    proj_saves: 0,
    proj_goals_allowed: 0,
    proj_win_prob: 0,
    proj_shutout_prob: 0,
    modeled_save_pct: 0
  };
  let probabilityMass = 0;
  for (const s of opts.scenarioProjections) {
    const w = clamp(s.starter_probability_raw, 0, 1);
    probabilityMass += w;
    weighted.proj_shots_against += w * s.proj_shots_against;
    weighted.proj_saves += w * s.proj_saves;
    weighted.proj_goals_allowed += w * s.proj_goals_allowed;
    weighted.proj_win_prob += w * s.proj_win_prob;
    weighted.proj_shutout_prob += w * s.proj_shutout_prob;
    weighted.modeled_save_pct += w * s.modeled_save_pct;
  }

  const clampedMass = clamp(probabilityMass, 0, 1);
  const residualMass = 1 - clampedMass;
  const fallback = opts.fallbackProjection;
  return {
    probability_mass: Number(clampedMass.toFixed(4)),
    residual_probability_mass: Number(residualMass.toFixed(4)),
    proj_shots_against: weighted.proj_shots_against + residualMass * fallback.proj_shots_against,
    proj_saves: weighted.proj_saves + residualMass * fallback.proj_saves,
    proj_goals_allowed:
      weighted.proj_goals_allowed + residualMass * fallback.proj_goals_allowed,
    proj_win_prob: weighted.proj_win_prob + residualMass * fallback.proj_win_prob,
    proj_shutout_prob:
      weighted.proj_shutout_prob + residualMass * fallback.proj_shutout_prob,
    modeled_save_pct:
      weighted.modeled_save_pct + residualMass * fallback.modeled_save_pct
  };
}

async function fetchTeamGoalieStarterContext(
  teamId: number,
  asOfDate: string
): Promise<TeamGoalieStarterContext> {
  assertSupabase();
  const [goalieGamesRes, previousTeamGameRes] = await Promise.all([
    supabase
      .from("forge_goalie_game")
      .select("game_date,goalie_id,toi_seconds")
      .eq("team_id", teamId)
      .lt("game_date", asOfDate)
      .order("game_date", { ascending: false })
      .limit(80),
    supabase
      .from("games")
      .select("date")
      .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
      .lt("date", asOfDate)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (goalieGamesRes.error) throw goalieGamesRes.error;
  if (previousTeamGameRes.error) throw previousTeamGameRes.error;

  const rows = (goalieGamesRes.data ?? []) as GoalieGameHistoryRow[];
  const byDate = new Map<string, { goalieId: number; toi: number }>();
  for (const row of rows) {
    const gameDate = row.game_date;
    const goalieId = row.goalie_id;
    if (!gameDate || !Number.isFinite(goalieId)) continue;
    const toi = safeNumber(row.toi_seconds, 0);
    const existing = byDate.get(gameDate);
    if (!existing || toi > existing.toi) {
      byDate.set(gameDate, { goalieId: Number(goalieId), toi });
    }
  }

  const lastDates = Array.from(byDate.keys()).sort().reverse().slice(0, 10);
  const startsByGoalie = new Map<number, number>();
  const lastPlayedDateByGoalie = new Map<number, string>();
  for (const d of lastDates) {
    const starter = byDate.get(d);
    if (!starter) continue;
    startsByGoalie.set(
      starter.goalieId,
      (startsByGoalie.get(starter.goalieId) ?? 0) + 1
    );
    if (!lastPlayedDateByGoalie.has(starter.goalieId)) {
      lastPlayedDateByGoalie.set(starter.goalieId, d);
    }
  }

  for (const [date, info] of byDate.entries()) {
    if (!lastPlayedDateByGoalie.has(info.goalieId)) {
      lastPlayedDateByGoalie.set(info.goalieId, date);
    }
  }

  const previousGameDate = (previousTeamGameRes.data as any)?.date ?? null;
  const previousGameStarterGoalieId =
    previousGameDate != null
      ? (byDate.get(previousGameDate)?.goalieId ?? null)
      : null;

  return {
    startsByGoalie,
    lastPlayedDateByGoalie,
    totalGames: lastDates.length,
    previousGameDate,
    previousGameStarterGoalieId
  };
}

async function fetchCurrentTeamGoalieIds(teamId: number): Promise<Set<number>> {
  assertSupabase();
  const { data, error } = await supabase
    .from("players")
    .select("id")
    .eq("team_id", teamId)
    .eq("position", "G");
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => Number(r.id)).filter((n) => Number.isFinite(n)));
}

async function fetchPlayerMetaByIds(
  playerIds: number[]
): Promise<Map<number, PlayerTeamPositionRow>> {
  assertSupabase();
  if (playerIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("players")
    .select("id,team_id,position")
    .in("id", playerIds);
  if (error) throw error;
  return new Map(
    ((data ?? []) as Array<any>)
      .map((row) => {
        const id = Number(row?.id);
        if (!Number.isFinite(id)) return null;
        return [
          id,
          {
            id,
            team_id: Number.isFinite(row?.team_id) ? Number(row.team_id) : null,
            position:
              typeof row?.position === "string"
                ? row.position
                : row?.position == null
                  ? null
                  : String(row.position)
          } satisfies PlayerTeamPositionRow
        ] as const;
      })
      .filter(
        (entry): entry is readonly [number, PlayerTeamPositionRow] => entry != null
      )
  );
}

async function fetchTeamAbbreviationMap(
  teamIds: number[]
): Promise<Map<number, string>> {
  assertSupabase();
  if (teamIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("teams")
    .select("id,abbreviation")
    .in("id", teamIds);
  if (error) throw error;
  return new Map(
    (data ?? [])
      .map((row: any) => {
        const id = Number(row?.id);
        const abbreviation =
          typeof row?.abbreviation === "string" ? row.abbreviation : null;
        if (!Number.isFinite(id) || !abbreviation) return null;
        return [id, abbreviation] as const;
      })
      .filter((entry): entry is readonly [number, string] => entry != null)
  );
}

async function fetchTeamStrengthPrior(
  teamAbbrev: string,
  asOfDate: string
): Promise<TeamStrengthPrior | null> {
  assertSupabase();
  const normalizedAbbrev = teamAbbrev.trim().toUpperCase();
  if (!normalizedAbbrev) return null;

  const historical = await supabase
    .from("nhl_team_data")
    .select("date,xga,xga_per_game,xgf_per_game")
    .eq("team_abbrev", normalizedAbbrev)
    .lte("date", asOfDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (historical.error) throw historical.error;

  let row = (historical.data as any) ?? null;
  if (!row) {
    const latest = await supabase
      .from("nhl_team_data")
      .select("date,xga,xga_per_game,xgf_per_game")
      .eq("team_abbrev", normalizedAbbrev)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.error) throw latest.error;
    row = (latest.data as any) ?? null;
  }
  if (!row) return null;

  const toFiniteOrNull = (value: any): number | null =>
    typeof value === "number" && Number.isFinite(value) ? Number(value) : null;

  return {
    sourceDate: typeof row.date === "string" ? row.date : null,
    xga: toFiniteOrNull(row.xga),
    xgaPerGame: toFiniteOrNull(row.xga_per_game),
    xgfPerGame: toFiniteOrNull(row.xgf_per_game)
  };
}

async function fetchTeamFiveOnFiveProfile(
  teamId: number,
  asOfDate: string
): Promise<TeamFiveOnFiveProfile | null> {
  assertSupabase();
  const { data, error } = await supabase
    .from("wgo_team_stats")
    .select("date,games_played,save_pct_5v5,shooting_plus_save_pct_5v5")
    .eq("team_id", teamId)
    .lte("date", asOfDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  return {
    sourceDate: typeof row.date === "string" ? row.date : null,
    gamesPlayed: Number.isFinite(row.games_played) ? Number(row.games_played) : 0,
    savePct5v5:
      typeof row.save_pct_5v5 === "number" && Number.isFinite(row.save_pct_5v5)
        ? Number(row.save_pct_5v5)
        : null,
    shootingPlusSavePct5v5:
      typeof row.shooting_plus_save_pct_5v5 === "number" &&
      Number.isFinite(row.shooting_plus_save_pct_5v5)
        ? Number(row.shooting_plus_save_pct_5v5)
        : null
  };
}

async function fetchTeamNstExpectedGoalsProfile(
  teamAbbrev: string,
  asOfDate: string
): Promise<TeamNstExpectedGoalsProfile | null> {
  assertSupabase();
  const normalizedAbbrev = teamAbbrev.trim().toUpperCase();
  if (!normalizedAbbrev) return null;
  const calcPer60 = (xga: number | null, toi: number | null): number | null => {
    if (!Number.isFinite(xga) || !Number.isFinite(toi) || (toi as number) <= 0) {
      return null;
    }
    return Number((Number(xga) * 60 / Number(toi)).toFixed(4));
  };
  const toFiniteOrNull = (value: any): number | null =>
    typeof value === "number" && Number.isFinite(value) ? Number(value) : null;

  const allRes = await supabase
    .from("nst_team_all")
    .select("date,gp,toi,xga")
    .eq("team_abbreviation", normalizedAbbrev)
    .eq("situation", "all")
    .lte("date", asOfDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (allRes.error) throw allRes.error;
  if (allRes.data) {
    const row = allRes.data as any;
    const xga = toFiniteOrNull(row.xga);
    const toi = toFiniteOrNull(row.toi);
    return {
      source: "nst_team_all",
      sourceDate: typeof row.date === "string" ? row.date : null,
      gamesPlayed: Number.isFinite(row.gp) ? Number(row.gp) : 0,
      xga,
      xgaPer60: calcPer60(xga, toi)
    };
  }

  const asOf = new Date(`${asOfDate}T00:00:00.000Z`);
  const year = asOf.getUTCFullYear();
  const month = asOf.getUTCMonth() + 1;
  const season = month >= 7 ? year : year - 1;
  const statsRes = await supabase
    .from("nst_team_stats")
    .select("season,gp,toi,xga")
    .eq("team_abbreviation", normalizedAbbrev)
    .eq("situation", "all")
    .lte("season", season)
    .order("season", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (statsRes.error) throw statsRes.error;
  if (!statsRes.data) return null;
  const row = statsRes.data as any;
  const xga = toFiniteOrNull(row.xga);
  const toi = toFiniteOrNull(row.toi);
  return {
    source: "nst_team_stats",
    sourceDate: Number.isFinite(row.season) ? String(row.season) : null,
    gamesPlayed: Number.isFinite(row.gp) ? Number(row.gp) : 0,
    xga,
    xgaPer60: calcPer60(xga, toi)
  };
}

async function fetchTeamDefensiveEnvironment(
  teamId: number,
  asOfDate: string
): Promise<TeamDefensiveEnvironment> {
  assertSupabase();
  const { data, error } = await supabase
    .from("forge_goalie_game")
    .select("game_id,game_date,shots_against")
    .eq("team_id", teamId)
    .lt("game_date", asOfDate)
    .order("game_date", { ascending: false })
    .limit(30);
  if (error) throw error;

  const byGameId = new Map<number, { gameDate: string; shotsAgainst: number }>();
  for (const row of (data ?? []) as GoalieGameHistoryRow[]) {
    const gameId = row.game_id;
    const gameDate = row.game_date;
    if (!Number.isFinite(gameId) || !gameDate) continue;
    const shotsAgainst = safeNumber(row.shots_against, 0);
    const existing = byGameId.get(gameId as number);
    if (!existing) {
      byGameId.set(gameId as number, { gameDate, shotsAgainst });
      continue;
    }
    // If multiple goalies appeared in one game, sum to team total SA.
    byGameId.set(gameId as number, {
      gameDate,
      shotsAgainst: existing.shotsAgainst + shotsAgainst
    });
  }

  const recentGames = Array.from(byGameId.values())
    .sort((a, b) => b.gameDate.localeCompare(a.gameDate))
    .slice(0, 10);
  const avg10 = meanOrNull(recentGames.map((g) => g.shotsAgainst));
  const avg5 = meanOrNull(recentGames.slice(0, 5).map((g) => g.shotsAgainst));
  return {
    avgShotsAgainstLast10: avg10,
    avgShotsAgainstLast5: avg5
  };
}

async function fetchTeamOffenseEnvironment(
  teamId: number,
  asOfDate: string
): Promise<TeamOffenseEnvironment> {
  assertSupabase();
  const { data, error } = await supabase
    .from("forge_team_game_strength")
    .select("game_date,shots_es,shots_pp,goals_es,goals_pp")
    .eq("team_id", teamId)
    .lt("game_date", asOfDate)
    .order("game_date", { ascending: false })
    .limit(10);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    game_date: string;
    shots_es: number | null;
    shots_pp: number | null;
    goals_es: number | null;
    goals_pp: number | null;
  }>;
  const shotsByGame = rows.map(
    (r) => safeNumber(r.shots_es, 0) + safeNumber(r.shots_pp, 0)
  );
  const goalsByGame = rows.map(
    (r) => safeNumber(r.goals_es, 0) + safeNumber(r.goals_pp, 0)
  );

  return {
    avgShotsForLast10: meanOrNull(shotsByGame),
    avgShotsForLast5: meanOrNull(shotsByGame.slice(0, 5)),
    avgGoalsForLast10: meanOrNull(goalsByGame),
    avgGoalsForLast5: meanOrNull(goalsByGame.slice(0, 5))
  };
}

async function fetchTeamRestDays(
  teamId: number,
  asOfDate: string
): Promise<number | null> {
  assertSupabase();
  const { data, error } = await supabase
    .from("games")
    .select("date")
    .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
    .lt("date", asOfDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const previousDate = (data as any)?.date as string | null;
  if (!previousDate) return null;
  return Math.max(0, daysBetweenDates(asOfDate, previousDate));
}

async function fetchGoalieWorkloadContext(
  goalieId: number,
  asOfDate: string
): Promise<GoalieWorkloadContext> {
  assertSupabase();
  const { data, error } = await supabase
    .from("forge_goalie_game")
    .select("game_date")
    .eq("goalie_id", goalieId)
    .lt("game_date", asOfDate)
    .order("game_date", { ascending: false })
    .limit(30);
  if (error) throw error;

  const uniqueDates = Array.from(
    new Set(
      ((data ?? []) as Array<{ game_date: string | null }>)
        .map((r) => r.game_date)
        .filter((d): d is string => typeof d === "string")
    )
  ).sort((a, b) => b.localeCompare(a));

  const startsLast7Days = uniqueDates.filter(
    (d) => daysBetweenDates(asOfDate, d) <= 7
  ).length;
  const startsLast14Days = uniqueDates.filter(
    (d) => daysBetweenDates(asOfDate, d) <= 14
  ).length;
  const lastStartDate = uniqueDates[0] ?? null;
  const daysSinceLastStart =
    lastStartDate != null ? Math.max(0, daysBetweenDates(asOfDate, lastStartDate)) : null;

  return {
    startsLast7Days,
    startsLast14Days,
    daysSinceLastStart,
    isGoalieBackToBack: daysSinceLastStart === 1
  };
}

async function fetchGoalieRestSplitProfile(
  goalieId: number,
  asOfDate: string
): Promise<GoalieRestSplitProfile | null> {
  assertSupabase();
  const { data, error } = await supabase
    .from("wgo_goalie_stats")
    .select(
      "date,save_pct_days_rest_0,save_pct_days_rest_1,save_pct_days_rest_2,save_pct_days_rest_3,save_pct_days_rest_4_plus,games_played_days_rest_0,games_played_days_rest_1,games_played_days_rest_2,games_played_days_rest_3,games_played_days_rest_4_plus"
    )
    .eq("goalie_id", goalieId)
    .lte("date", asOfDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  return {
    sourceDate: typeof row.date === "string" ? row.date : null,
    savePctByBucket: {
      "0": safeNumber(row.save_pct_days_rest_0, NaN),
      "1": safeNumber(row.save_pct_days_rest_1, NaN),
      "2": safeNumber(row.save_pct_days_rest_2, NaN),
      "3": safeNumber(row.save_pct_days_rest_3, NaN),
      "4_plus": safeNumber(row.save_pct_days_rest_4_plus, NaN)
    },
    gamesByBucket: {
      "0": safeNumber(row.games_played_days_rest_0, 0),
      "1": safeNumber(row.games_played_days_rest_1, 0),
      "2": safeNumber(row.games_played_days_rest_2, 0),
      "3": safeNumber(row.games_played_days_rest_3, 0),
      "4_plus": safeNumber(row.games_played_days_rest_4_plus, 0)
    }
  };
}

export function selectStarterCandidateGoalieIds(opts: {
  asOfDate: string;
  rawCandidateGoalieIds: number[];
  currentTeamGoalieIds: Set<number>;
  context: TeamGoalieStarterContext;
  goalieOverrideGoalieId?: number | null;
  limit?: number;
  priorStartProbByGoalieId?: Map<number, number>;
  confirmedStarterByGoalieId?: Map<number, boolean>;
}): number[] {
  const priorStartProbByGoalieId = opts.priorStartProbByGoalieId ?? new Map();
  const confirmedStarterByGoalieId = opts.confirmedStarterByGoalieId ?? new Map();
  const goalieOverrideGoalieId = opts.goalieOverrideGoalieId ?? null;
  const limit = Number.isFinite(opts.limit) ? Math.max(1, Number(opts.limit)) : 3;

  return Array.from(new Set(opts.rawCandidateGoalieIds))
    .filter((goalieId) => {
      if (!Number.isFinite(goalieId)) return false;
      if (goalieOverrideGoalieId === goalieId) return true;
      if (opts.currentTeamGoalieIds.size > 0 && !opts.currentTeamGoalieIds.has(goalieId)) {
        return false;
      }
      const lastPlayed = opts.context.lastPlayedDateByGoalie.get(goalieId);
      if (!lastPlayed) return true;
      const daysSinceLastPlayed = Math.max(0, daysBetweenDates(opts.asOfDate, lastPlayed));
      return daysSinceLastPlayed <= GOALIE_STALE_HARD_DAYS;
    })
    .sort((a, b) => {
      const score = (goalieId: number) => {
        const starts = opts.context.startsByGoalie.get(goalieId) ?? 0;
        const priorProb = priorStartProbByGoalieId.get(goalieId) ?? 0.5;
        const isConfirmed = confirmedStarterByGoalieId.get(goalieId) ?? false;
        const lastPlayed = opts.context.lastPlayedDateByGoalie.get(goalieId);
        const daysSinceLastPlayed =
          lastPlayed != null ? Math.max(0, daysBetweenDates(opts.asOfDate, lastPlayed)) : 999;
        const isOverride = goalieOverrideGoalieId === goalieId;

        let s = 0;
        if (isOverride) s += 100;
        if (isConfirmed) s += 25;
        s += priorProb * 10;
        s += starts * 1.5;
        s -= Math.min(daysSinceLastPlayed, 120) / 30;
        return s;
      };
      return score(b) - score(a);
    })
    .slice(0, limit);
}

export function computeStarterProbabilities(opts: {
  asOfDate: string;
  candidateGoalieIds: number[];
  starterContext: TeamGoalieStarterContext;
  priorStartProbByGoalieId: Map<number, number>;
  lineComboPriorByGoalieId?: Map<number, number>;
  projectedGsaaPer60ByGoalieId?: Map<number, number>;
  seasonStartPctByGoalieId?: Map<number, number>;
  seasonGamesPlayedByGoalieId?: Map<number, number>;
  teamGoalsFor: number;
  opponentGoalsFor: number;
}): Map<number, number> {
  const probs = new Map<number, number>();
  const candidates = Array.from(new Set(opts.candidateGoalieIds)).filter((id) =>
    Number.isFinite(id)
  );
  if (candidates.length === 0) return probs;
  if (candidates.length === 1) {
    probs.set(candidates[0], 1);
    return probs;
  }

  const starts = opts.starterContext.startsByGoalie;
  const lineComboPriorByGoalieId = opts.lineComboPriorByGoalieId ?? new Map();
  const projectedGsaaPer60ByGoalieId =
    opts.projectedGsaaPer60ByGoalieId ?? new Map();
  const seasonStartPctByGoalieId = opts.seasonStartPctByGoalieId ?? new Map();
  const seasonGamesPlayedByGoalieId =
    opts.seasonGamesPlayedByGoalieId ?? new Map();
  const totalGames = Math.max(1, opts.starterContext.totalGames);
  const teamIsWeaker =
    opts.teamGoalsFor + TEAM_STRENGTH_WEAKER_GAP < opts.opponentGoalsFor;
  const opponentIsWeak = opts.opponentGoalsFor <= WEAK_OPPONENT_GF_THRESHOLD;
  const previousGameDate = opts.starterContext.previousGameDate;
  const isB2B =
    previousGameDate != null &&
    daysBetweenDates(opts.asOfDate, previousGameDate) === 1;
  const previousStarter = opts.starterContext.previousGameStarterGoalieId;
  const lastPlayedMap = opts.starterContext.lastPlayedDateByGoalie;

  const scores = candidates.map((goalieId) => {
    const l10Starts = starts.get(goalieId) ?? 0;
    const l10Share = l10Starts / totalGames;
    const priorProb = clamp(opts.priorStartProbByGoalieId.get(goalieId) ?? 0.5, 0.01, 0.99);
    const lineComboPrior = clamp(
      lineComboPriorByGoalieId.get(goalieId) ?? 0.5,
      0.05,
      0.95
    );
    const projectedGsaaPer60 = clamp(
      projectedGsaaPer60ByGoalieId.get(goalieId) ?? 0,
      -GOALIE_GSAA_PRIOR_MAX_ABS,
      GOALIE_GSAA_PRIOR_MAX_ABS
    );
    const seasonStartPct = clamp(
      seasonStartPctByGoalieId.get(goalieId) ?? GOALIE_SEASON_START_PCT_BASELINE,
      0,
      1
    );
    const seasonGamesPlayed = Math.max(0, seasonGamesPlayedByGoalieId.get(goalieId) ?? 0);
    const seasonGamesWeight = clamp(seasonGamesPlayed / (seasonGamesPlayed + 10), 0, 1);
    const isPrimary = l10Share >= 0.6;
    const playedYesterday = isB2B && previousStarter === goalieId;
    const lastPlayed = lastPlayedMap.get(goalieId) ?? null;
    const daysSinceLastPlayed =
      lastPlayed != null ? Math.max(0, daysBetweenDates(opts.asOfDate, lastPlayed)) : 999;

    let score = 0;
    // Core usage signal: if a goalie started 7/10, this pushes probability up materially.
    score += 2.4 * (l10Share - 0.5);
    // Preserve external prior signal when available.
    score += 0.7 * Math.log(priorProb / (1 - priorProb));
    // Recency-weighted line-combo goalie tags as a soft prior only.
    score += LINE_COMBO_PRIOR_LOGIT_WEIGHT * Math.log(lineComboPrior / (1 - lineComboPrior));
    // Quality prior from projected GSAA/60 (bounded, soft).
    score += GOALIE_GSAA_PRIOR_WEIGHT * projectedGsaaPer60;
    // Season starter-share prior, weighted by sample size.
    score +=
      GOALIE_SEASON_START_PCT_WEIGHT *
      (seasonStartPct - GOALIE_SEASON_START_PCT_BASELINE) *
      seasonGamesWeight;
    // Mild trust boost for goalies with stronger season sample.
    score += GOALIE_SEASON_GAMES_PLAYED_WEIGHT * seasonGamesWeight;

    // Back-to-back: goalie from game 1 is heavily discounted for game 2.
    if (playedYesterday) {
      score -= B2B_REPEAT_STARTER_PENALTY;
    } else if (isB2B && previousStarter != null) {
      score += B2B_ALTERNATE_GOALIE_BOOST;
    }

    // Weaker teams on B2B tend to lean backup usage.
    if (isB2B && teamIsWeaker && isPrimary) {
      score -= WEAKER_TEAM_B2B_PRIMARY_PENALTY;
    }
    if (isB2B && teamIsWeaker && !isPrimary) {
      score += WEAKER_TEAM_B2B_BACKUP_BOOST;
    }

    // Starter on a soft matchup can be rested for backup.
    if (opponentIsWeak && isPrimary) {
      score -= WEAK_OPPONENT_PRIMARY_REST_PENALTY;
    }
    if (opponentIsWeak && !isPrimary) {
      score += WEAK_OPPONENT_BACKUP_BOOST;
    }

    // Recency guardrail: goalies inactive for long stretches should be near-eliminated.
    if (daysSinceLastPlayed > GOALIE_STALE_HARD_DAYS) score -= 6;
    else if (daysSinceLastPlayed > GOALIE_STALE_SOFT_DAYS) score -= 3;
    else if (daysSinceLastPlayed > 14) score -= 0.8;
    if (daysSinceLastPlayed <= 7) score += 0.2;

    return { goalieId, score, daysSinceLastPlayed, lastPlayed };
  });

  if (scores.length === 2) {
    const [a, b] = scores;
    const pA = clamp(sigmoid(a.score - b.score), 0.02, 0.98);
    probs.set(a.goalieId, pA);
    probs.set(b.goalieId, 1 - pA);
    return probs;
  }

  const maxScore = Math.max(...scores.map((s) => s.score));
  const exps = scores.map((s) => Math.exp(s.score - maxScore));
  const denom = exps.reduce((acc, v) => acc + v, 0) || 1;
  scores.forEach((s, i) => {
    probs.set(s.goalieId, clamp(exps[i] / denom, 0.01, 0.98));
  });
  return probs;
}

export function buildTopStarterScenarios(opts: {
  probabilitiesByGoalieId: Map<number, number>;
  maxScenarios?: number;
}): StarterScenario[] {
  const maxScenarios = Number.isFinite(opts.maxScenarios)
    ? Math.max(1, Number(opts.maxScenarios))
    : 2;
  const ranked = Array.from(opts.probabilitiesByGoalieId.entries())
    .filter(([goalieId, probability]) => Number.isFinite(goalieId) && Number.isFinite(probability))
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxScenarios);
  if (ranked.length === 0) return [];

  const rawMass = ranked.reduce((sum, [, probability]) => sum + Math.max(0, probability), 0);
  const denom = rawMass > 0 ? rawMass : ranked.length;
  return ranked.map(([goalieId, rawProbability], idx) => ({
    goalieId,
    rawProbability,
    probability: clamp(Math.max(0, rawProbability) / denom, 0, 1),
    rank: idx + 1
  }));
}

async function fetchGoalieEvidence(
  goalieId: number,
  asOfDate: string
): Promise<GoalieEvidence> {
  assertSupabase();
  const asOf = new Date(`${asOfDate}T00:00:00.000Z`);
  const year = asOf.getUTCFullYear();
  const month = asOf.getUTCMonth() + 1;
  const seasonStartYear = month >= 7 ? year : year - 1;
  const seasonStartDate = `${seasonStartYear}-07-01`;
  const [recentRes, seasonRes, baselineRes, qualityStartRes] = await Promise.all([
    supabase
      .from("forge_goalie_game")
      .select("shots_against,goals_allowed,saves")
      .eq("goalie_id", goalieId)
      .lt("game_date", asOfDate)
      .order("game_date", { ascending: false })
      .limit(20),
    supabase
      .from("forge_goalie_game")
      .select("shots_against,goals_allowed,saves")
      .eq("goalie_id", goalieId)
      .gte("game_date", seasonStartDate)
      .lt("game_date", asOfDate)
      .order("game_date", { ascending: false })
      .limit(120),
    supabase
      .from("forge_goalie_game")
      .select("shots_against,goals_allowed,saves")
      .eq("goalie_id", goalieId)
      .lt("game_date", asOfDate)
      .order("game_date", { ascending: false })
      .limit(200),
    supabase
      .from("wgo_goalie_stats")
      .select("date,quality_start,quality_starts_pct")
      .eq("goalie_id", goalieId)
      .lte("date", asOfDate)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (recentRes.error) throw recentRes.error;
  if (seasonRes.error) throw seasonRes.error;
  if (baselineRes.error) throw baselineRes.error;
  if (qualityStartRes.error) throw qualityStartRes.error;

  const recentRows = (recentRes.data ?? []) as GoalieGameHistoryRow[];
  const seasonRows = (seasonRes.data ?? []) as GoalieGameHistoryRow[];
  const baselineRows = (baselineRes.data ?? []) as GoalieGameHistoryRow[];

  const sumRecent = recentRows.reduce(
    (acc, row) => {
      acc.shots += safeNumber(row.shots_against, 0);
      acc.goals += safeNumber(row.goals_allowed, 0);
      return acc;
    },
    { shots: 0, goals: 0 }
  );

  const sumBaseline = baselineRows.reduce(
    (acc, row) => {
      acc.shots += safeNumber(row.shots_against, 0);
      acc.goals += safeNumber(row.goals_allowed, 0);
      return acc;
    },
    { shots: 0, goals: 0 }
  );
  const sumSeason = seasonRows.reduce(
    (acc, row) => {
      acc.shots += safeNumber(row.shots_against, 0);
      acc.goals += safeNumber(row.goals_allowed, 0);
      return acc;
    },
    { shots: 0, goals: 0 }
  );

  const leagueSvPct = 0.9;
  const residuals = recentRows.map((row) => {
    const shots = safeNumber(row.shots_against, 0);
    const goals = safeNumber(row.goals_allowed, 0);
    const expectedGoals = shots * (1 - leagueSvPct);
    return goals - expectedGoals;
  });
  const qualityStartRow = (qualityStartRes.data as any) ?? null;
  const qualityStarts = safeNumber(qualityStartRow?.quality_start, 0);
  const qualityStartsPctRaw = qualityStartRow?.quality_starts_pct;
  const qualityStartsPct =
    typeof qualityStartsPctRaw === "number" && Number.isFinite(qualityStartsPctRaw)
      ? Number(qualityStartsPctRaw)
      : null;

  return {
    recentStarts: recentRows.length,
    recentShotsAgainst: sumRecent.shots,
    recentGoalsAllowed: sumRecent.goals,
    seasonStarts: seasonRows.length,
    seasonShotsAgainst: sumSeason.shots,
    seasonGoalsAllowed: sumSeason.goals,
    baselineStarts: baselineRows.length,
    baselineShotsAgainst: sumBaseline.shots,
    baselineGoalsAllowed: sumBaseline.goals,
    residualStdDev: safeStdDev(residuals),
    qualityStarts,
    qualityStartsPct
  };
}

async function fetchRollingRows(
  playerIds: number[],
  strengthState: "ev" | "pp",
  cutoffDate: string
): Promise<RollingRow[]> {
  assertSupabase();
  if (playerIds.length === 0) return [];

  // Calculate a "recent" cutoff (e.g., 1 year ago) to filter out stale stats
  const oneYearAgo = new Date(
    new Date(cutoffDate).getTime() - 365 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("rolling_player_game_metrics")
    .select(
      "player_id,strength_state,game_date,toi_seconds_avg_last5,toi_seconds_avg_all,sog_per_60_avg_last5,sog_per_60_avg_all,goals_total_last5,shots_total_last5,assists_total_last5,goals_total_all,shots_total_all,assists_total_all,hits_per_60_avg_last5,hits_per_60_avg_all,blocks_per_60_avg_last5,blocks_per_60_avg_all"
    )
    .in("player_id", playerIds)
    .eq("strength_state", strengthState)
    .lt("game_date", cutoffDate)
    .gt("game_date", oneYearAgo) // Only fetch stats from the last year
    .order("game_date", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as any;
}

async function fetchLatestWgoSkaterDeploymentProfiles(
  playerIds: number[],
  cutoffDate: string
): Promise<Map<number, WgoSkaterDeploymentProfile>> {
  assertSupabase();
  if (playerIds.length === 0) return new Map();

  const oneYearAgo = new Date(
    new Date(cutoffDate).getTime() - 365 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("wgo_skater_stats")
    .select("player_id,date,toi_per_game,es_toi_per_game,pp_toi_per_game")
    .in("player_id", playerIds)
    .lt("date", cutoffDate)
    .gte("date", oneYearAgo)
    .order("date", { ascending: false })
    .limit(5000);
  if (error) throw error;

  const latestByPlayer = new Map<number, any>();
  for (const row of (data ?? []) as any[]) {
    const playerId = Number(row?.player_id);
    if (!Number.isFinite(playerId)) continue;
    if (!latestByPlayer.has(playerId)) latestByPlayer.set(playerId, row);
  }

  const profiles = new Map<number, WgoSkaterDeploymentProfile>();
  for (const [playerId, row] of latestByPlayer.entries()) {
    const totalToiSec = normalizeWgoToiToSeconds(row?.toi_per_game);
    const esToiSecRaw = normalizeWgoToiToSeconds(row?.es_toi_per_game);
    const ppToiSecRaw = normalizeWgoToiToSeconds(row?.pp_toi_per_game);
    const ppToiSec = ppToiSecRaw != null ? clamp(ppToiSecRaw, 0, 1200) : null;
    const esToiSec =
      esToiSecRaw != null
        ? clamp(esToiSecRaw, 0, 2400)
        : totalToiSec != null && ppToiSec != null
          ? clamp(totalToiSec - ppToiSec, 0, 2400)
          : null;

    profiles.set(playerId, {
      toiPerGameSec: totalToiSec,
      esToiPerGameSec: esToiSec,
      ppToiPerGameSec: ppToiSec
    });
  }

  return profiles;
}

async function fetchLatestSkaterShotQualityProfiles(
  playerIds: number[],
  cutoffDate: string
): Promise<Map<number, SkaterShotQualityProfile>> {
  assertSupabase();
  if (playerIds.length === 0) return new Map();

  const oneYearAgo = new Date(
    new Date(cutoffDate).getTime() - 365 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("player_stats_unified")
    .select(
      "player_id,date,nst_shots_per_60,nst_ixg_per_60,nst_rush_attempts_per_60,nst_rebounds_created_per_60"
    )
    .in("player_id", playerIds)
    .lte("date", cutoffDate)
    .gte("date", oneYearAgo)
    .order("date", { ascending: false })
    .limit(5000);
  if (error) throw error;

  const latestByPlayer = new Map<number, any>();
  for (const row of (data ?? []) as any[]) {
    const playerId = Number(row?.player_id);
    if (!Number.isFinite(playerId)) continue;
    if (!latestByPlayer.has(playerId)) latestByPlayer.set(playerId, row);
  }

  const profiles = new Map<number, SkaterShotQualityProfile>();
  for (const [playerId, row] of latestByPlayer.entries()) {
    profiles.set(playerId, {
      sourceDate: typeof row?.date === "string" ? row.date : null,
      nstShotsPer60: finiteOrNull(row?.nst_shots_per_60),
      nstIxgPer60: finiteOrNull(row?.nst_ixg_per_60),
      nstRushAttemptsPer60: finiteOrNull(row?.nst_rush_attempts_per_60),
      nstReboundsCreatedPer60: finiteOrNull(row?.nst_rebounds_created_per_60)
    });
  }
  return profiles;
}

async function fetchLatestSkaterOnIceContextProfiles(
  playerIds: number[],
  cutoffDate: string
): Promise<Map<number, SkaterOnIceContextProfile>> {
  assertSupabase();
  if (playerIds.length === 0) return new Map();

  const oneYearAgo = new Date(
    new Date(cutoffDate).getTime() - 365 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("player_stats_unified")
    .select(
      "player_id,date,nst_oi_xgf_per_60,nst_oi_xga_per_60,nst_oi_cf_pct_rates,nst_oi_cf_pct,possession_pct_safe"
    )
    .in("player_id", playerIds)
    .lte("date", cutoffDate)
    .gte("date", oneYearAgo)
    .order("date", { ascending: false })
    .limit(5000);
  if (error) throw error;

  const latestByPlayer = new Map<number, any>();
  for (const row of (data ?? []) as any[]) {
    const playerId = Number(row?.player_id);
    if (!Number.isFinite(playerId)) continue;
    if (!latestByPlayer.has(playerId)) latestByPlayer.set(playerId, row);
  }

  const profiles = new Map<number, SkaterOnIceContextProfile>();
  for (const [playerId, row] of latestByPlayer.entries()) {
    profiles.set(playerId, {
      sourceDate: typeof row?.date === "string" ? row.date : null,
      nstOiXgfPer60: finiteOrNull(row?.nst_oi_xgf_per_60),
      nstOiXgaPer60: finiteOrNull(row?.nst_oi_xga_per_60),
      nstOiCfPct:
        finiteOrNull(row?.nst_oi_cf_pct_rates) ?? finiteOrNull(row?.nst_oi_cf_pct),
      possessionPctSafe: finiteOrNull(row?.possession_pct_safe)
    });
  }
  return profiles;
}

async function fetchOpponentGoalieContextForGame(args: {
  gameId: number;
  opponentTeamId: number;
}): Promise<OpponentGoalieContext | null> {
  assertSupabase();
  const { data, error } = await supabase
    .from("goalie_start_projections")
    .select("player_id,start_probability,confirmed_status,projected_gsaa_per_60")
    .eq("game_id", args.gameId)
    .eq("team_id", args.opponentTeamId)
    .order("start_probability", { ascending: false })
    .limit(3);
  if (error) throw error;

  const rows = (data ?? []) as Array<any>;
  if (rows.length === 0) return null;

  let probabilityMass = 0;
  let weightedGsaa = 0;
  let weightedGsaaMass = 0;
  let topStarterProbability = 0;
  let isConfirmedStarter = false;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const p = clamp(Number(row?.start_probability ?? 0), 0, 1);
    if (i === 0) {
      topStarterProbability = p;
      isConfirmedStarter = Boolean(row?.confirmed_status);
    }
    probabilityMass += p;
    const gsaa = Number(row?.projected_gsaa_per_60);
    if (Number.isFinite(gsaa)) {
      weightedGsaa += p * gsaa;
      weightedGsaaMass += p;
    }
  }
  const weightedProjectedGsaaPer60 =
    weightedGsaaMass > 0 ? weightedGsaa / weightedGsaaMass : null;

  return {
    source: "goalie_start_projections",
    weightedProjectedGsaaPer60:
      weightedProjectedGsaaPer60 == null
        ? null
        : Number(weightedProjectedGsaaPer60.toFixed(4)),
    topStarterProbability: Number(clamp(topStarterProbability, 0, 1).toFixed(4)),
    probabilityMass: Number(clamp(probabilityMass, 0, 1).toFixed(4)),
    isConfirmedStarter
  };
}

async function createRun(asOfDate: string): Promise<string> {
  assertSupabase();
  const { data, error } = await supabase
    .from("forge_runs")
    .insert({
      as_of_date: asOfDate,
      status: "running",
      git_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? null,
      metrics: {}
    })
    .select("run_id")
    .single();
  if (error) throw error;
  return (data as any).run_id as string;
}

async function finalizeRun(
  runId: string,
  status: "succeeded" | "failed",
  metrics: any
) {
  assertSupabase();
  const { error } = await supabase
    .from("forge_runs")
    .update({ status, metrics, updated_at: new Date().toISOString() })
    .eq("run_id", runId);
  if (error) throw error;
}

type ProjectionTotals = {
  toiEsSeconds: number;
  toiPpSeconds: number;
  shotsEs: number;
  shotsPp: number;
  goalsEs: number;
  goalsPp: number;
  assistsEs: number;
  assistsPp: number;
};

export async function runProjectionV2ForDate(
  asOfDate: string,
  opts?: { deadlineMs?: number; horizonGames?: number }
): Promise<{
  runId: string;
  gamesProcessed: number;
  playerRowsUpserted: number;
  teamRowsUpserted: number;
  goalieRowsUpserted: number;
  timedOut: boolean;
}> {
  assertSupabase();
  const runId = await createRun(asOfDate);

  const metrics: any = {
    as_of_date: asOfDate,
    horizon_games: clampHorizonGames(opts?.horizonGames ?? 1),
    started_at: new Date().toISOString(),
    games: 0,
    player_rows: 0,
    team_rows: 0,
    goalie_rows: 0,
    learning: {
      recent_window_games: 5,
      goal_rate_prior_strength: 40,
      assist_rate_prior_strength: 20,
      players_considered: 0,
      goal_rate_recent_players: 0,
      assist_rate_recent_players: 0,
      goal_rate_recent_share: 0,
      assist_rate_recent_share: 0
    },
    data_quality: {
      missing_pbp_games: 0,
      missing_shift_totals: 0,
      missing_line_combos: 0,
      stale_line_combos_soft: 0,
      stale_line_combos_hard: 0,
      line_combo_fallbacks_used: 0,
      line_combo_hard_failures: 0,
      empty_skater_rosters: 0,
      filtered_skater_team_or_position: 0,
      filtered_skater_missing_metrics: 0,
      filtered_skater_hard_stale: 0,
      soft_stale_skater_penalties: 0,
      role_volatility_penalties_applied: 0,
      role_continuity_boosts_applied: 0,
      skater_availability_penalties_applied: 0,
      skater_unavailable_filtered: 0,
      missing_ev_metrics_players: 0,
      missing_pp_metrics_players: 0,
      deployment_prior_profiles_found: 0,
      deployment_prior_toi_blends_applied: 0,
      shot_quality_profiles_found: 0,
      shot_quality_adjustments_applied: 0,
      on_ice_context_profiles_found: 0,
      on_ice_context_adjustments_applied: 0,
      team_level_context_teams_with_signal: 0,
      team_level_context_adjustments_applied: 0,
      opponent_goalie_context_profiles_found: 0,
      opponent_goalie_context_adjustments_applied: 0,
      rest_schedule_teams_with_signal: 0,
      rest_schedule_adjustments_applied: 0,
      small_sample_players: 0,
      small_sample_shrinkage_applied: 0,
      small_sample_callup_fallbacks: 0,
      toi_scaled_teams: 0,
      toi_scale_min: null as number | null,
      toi_scale_max: null as number | null
    },
    warnings: [] as string[]
  };

  try {
    const horizonGames = clampHorizonGames(opts?.horizonGames ?? 1);
    const { data: games, error: gamesErr } = await supabase
      .from("games")
      .select("id,date,homeTeamId,awayTeamId")
      .eq("date", asOfDate);
    if (gamesErr) throw gamesErr;

    const teamStrengthCache = new Map<number, TeamStrengthAverages>();
    const { startTs, endTs } = toDayBoundsUtc(asOfDate);

    const teamIds = Array.from(
      new Set(
        ((games ?? []) as GameRow[])
          .flatMap((g) => [g.homeTeamId, g.awayTeamId])
          .filter((n) => n != null)
      )
    );
    const teamAbbreviationById = await fetchTeamAbbreviationMap(teamIds);

    const playerAvailabilityMultiplier = new Map<number, number>();
    const availabilityEventByPlayer = new Map<number, RosterEventRow>();
    const goalieEvidenceCache = new Map<number, GoalieEvidence>();
    const goalieOverrideByTeamId = new Map<
      number,
      { goalieId: number; starterProb: number }
    >();
    const learningCounters = {
      players: 0,
      goalRecent: 0,
      assistRecent: 0
    };

    if (teamIds.length > 0) {
      const { data: events, error: evErr } = await supabase
        .from("forge_roster_events")
        .select(
          "event_id,team_id,player_id,event_type,confidence,payload,effective_from,effective_to"
        )
        .in("team_id", teamIds)
        .lte("effective_from", endTs)
        .order("effective_from", { ascending: false })
        .limit(5000);
      if (evErr) throw evErr;

      const bestAvailabilityEventByPlayer = new Map<number, RosterEventRow>();

      for (const e of (events ?? []) as any[]) {
        const row = e as RosterEventRow;
        if (row.effective_to != null && row.effective_to < startTs) continue;
        if (row.player_id != null) {
          const mult = availabilityMultiplierForEvent(
            row.event_type,
            row.confidence
          );
          if (mult != null) {
            const existing = bestAvailabilityEventByPlayer.get(row.player_id);
            if (!existing || row.effective_from > existing.effective_from) {
              bestAvailabilityEventByPlayer.set(row.player_id, row);
            }
          }
        }

        if (
          row.team_id != null &&
          row.player_id != null &&
          (row.event_type === "GOALIE_START_CONFIRMED" ||
            row.event_type === "GOALIE_START_LIKELY")
        ) {
          const starterProb =
            row.event_type === "GOALIE_START_CONFIRMED"
              ? 1
              : clamp(row.confidence ?? 0.75, 0.5, 1);
          const existing = goalieOverrideByTeamId.get(row.team_id);
          if (!existing || starterProb > existing.starterProb) {
            goalieOverrideByTeamId.set(row.team_id, {
              goalieId: row.player_id,
              starterProb
            });
          }
        }
      }

      for (const [playerId, ev] of bestAvailabilityEventByPlayer.entries()) {
        const mult = availabilityMultiplierForEvent(
          ev.event_type,
          ev.confidence
        );
        if (mult != null) {
          playerAvailabilityMultiplier.set(playerId, mult);
          availabilityEventByPlayer.set(playerId, ev);
        }
      }
    }

    const deadlineMs = safeNumber(opts?.deadlineMs, Number.POSITIVE_INFINITY);
    let timedOut = false;

    let playerRowsUpserted = 0;
    let teamRowsUpserted = 0;
    let goalieRowsUpserted = 0;
    const teamHorizonScalarsCache = new Map<number, number[]>();
    const teamSkaterRoleHistoryCache = new Map<number, Map<number, string[]>>();

    gamesLoop: for (const game of (games ?? []) as GameRow[]) {
      if (Date.now() > deadlineMs) {
        timedOut = true;
        break gamesLoop;
      }
      if (!(await hasPbpGame(game.id)))
        metrics.data_quality.missing_pbp_games += 1;
      if (!(await hasShiftTotals(game.id)))
        metrics.data_quality.missing_shift_totals += 1;

      // Removed: const lineCombos = await fetchLineCombinations(game.id);
      // We now fetch per-team latest LCs inside the loop.

      const teamShotsByTeamId = new Map<
        number,
        { shotsEs: number; shotsPp: number }
      >();
      const teamGoalsByTeamId = new Map<number, number>();
      const fallbackGoalieByTeamId = new Map<number, number | null>();
      const teamGoalieStarterContextCache = new Map<number, TeamGoalieStarterContext>();
      const teamDefensiveEnvironmentCache = new Map<number, TeamDefensiveEnvironment>();
      const teamOffenseEnvironmentCache = new Map<number, TeamOffenseEnvironment>();
      const teamRestDaysCache = new Map<number, number | null>();
      const teamStrengthPriorCache = new Map<number, TeamStrengthPrior | null>();
      const teamFiveOnFiveProfileCache = new Map<number, TeamFiveOnFiveProfile | null>();
      const teamNstExpectedGoalsCache = new Map<
        number,
        TeamNstExpectedGoalsProfile | null
      >();
      const teamLineComboGoaliePriorCache = new Map<number, Map<number, number>>();
      const goalieWorkloadContextCache = new Map<number, GoalieWorkloadContext>();
      const goalieRestSplitProfileCache = new Map<number, GoalieRestSplitProfile | null>();
      const currentTeamGoalieIdsCache = new Map<number, Set<number>>();
      const goalieCandidates: Array<{
        teamId: number;
        opponentTeamId: number;
        candidateGoalieIds: number[];
        priorStartProbByGoalieId: Map<number, number>;
        lineComboPriorByGoalieId: Map<number, number>;
        projectedGsaaPer60ByGoalieId: Map<number, number>;
        seasonStartPctByGoalieId: Map<number, number>;
        seasonGamesPlayedByGoalieId: Map<number, number>;
        override: { goalieId: number; starterProb: number } | null;
      }> = [];

      for (const teamId of [game.homeTeamId, game.awayTeamId]) {
        if (Date.now() > deadlineMs) {
          timedOut = true;
          break gamesLoop;
        }

        // Use the most recent line combination for this team (prior to today).
        const lcContext = await fetchLatestLineCombinationForTeam(teamId, asOfDate);
        const lc = lcContext.lineCombination;
        const lcRecency = assessLineCombinationRecency({
          asOfDate,
          sourceGameDate: lcContext.sourceGameDate
        });

        const opponentTeamId =
          teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
        if (!teamHorizonScalarsCache.has(teamId)) {
          teamHorizonScalarsCache.set(
            teamId,
            await fetchTeamHorizonScalars(teamId, asOfDate, horizonGames)
          );
        }
        const teamHorizonScalars = teamHorizonScalarsCache.get(teamId) ?? [1];
        const teamHorizonTotalScalar = teamHorizonScalars.reduce((sum, v) => sum + v, 0);
        if (lcRecency.isSoftStale && !lcRecency.isHardStale) {
          metrics.data_quality.stale_line_combos_soft += 1;
          metrics.warnings.push(
            `stale lineCombinations for game=${game.id} team=${teamId}; source_date=${lcContext.sourceGameDate ?? "none"} days_stale=${lcRecency.daysStale ?? "unknown"}`
          );
        }
        if (lcRecency.isHardStale) {
          metrics.data_quality.stale_line_combos_hard += 1;
        }

        let rawSkaterIds = (
          lc
            ? [...(lc.forwards ?? []), ...(lc.defensemen ?? [])]
            : []
        ).filter((n) => typeof n === "number");
        let usedLineComboFallback = false;
        let lineComboFallbackReason: "missing" | "hard_stale" | "empty" | null = null;
        let fallbackCandidateCount = 0;

        if (lcRecency.isMissing || lcRecency.isHardStale || rawSkaterIds.length === 0) {
          if (lcRecency.isMissing) metrics.data_quality.missing_line_combos += 1;
          const fallbackSkaterIds = await fetchFallbackSkaterIdsForTeam(
            teamId,
            asOfDate,
            18
          );
          if (fallbackSkaterIds.length > 0) {
            rawSkaterIds = fallbackSkaterIds;
            usedLineComboFallback = true;
            lineComboFallbackReason = lcRecency.isMissing
              ? "missing"
              : lcRecency.isHardStale
                ? "hard_stale"
                : "empty";
            fallbackCandidateCount = fallbackSkaterIds.length;
            metrics.data_quality.line_combo_fallbacks_used += 1;
            metrics.warnings.push(
              `lineCombinations fallback used for game=${game.id} team=${teamId}; reason=${lcRecency.isMissing ? "missing" : lcRecency.isHardStale ? "hard_stale" : "empty"} source_date=${lcContext.sourceGameDate ?? "none"} days_stale=${lcRecency.daysStale ?? "unknown"} fallback_count=${fallbackSkaterIds.length}`
            );
          } else {
            metrics.data_quality.line_combo_hard_failures += 1;
            metrics.warnings.push(
              `lineCombinations hard-failure for game=${game.id} team=${teamId}; no usable line combos or fallback skaters`
            );
            continue;
          }
        }

        const playerMetaById = await fetchPlayerMetaByIds(rawSkaterIds);
        const skaterRoleTags = buildSkaterRoleTags({
          lineCombination: lc,
          useFallbackRoles: usedLineComboFallback,
          fallbackRankedSkaterIds: rawSkaterIds,
          playerMetaById,
          teamId
        });
        const teamPositionFilteredSkaterIds = Array.from(new Set(rawSkaterIds)).filter(
          (playerId) => {
            const meta = playerMetaById.get(playerId);
            if (!meta) return false;
            return meta.position !== "G" && meta.team_id === teamId;
          }
        );

        const evRows = await fetchRollingRows(teamPositionFilteredSkaterIds, "ev", asOfDate);
        const ppRows = await fetchRollingRows(teamPositionFilteredSkaterIds, "pp", asOfDate);
        const evLatest = pickLatestByPlayer(evRows);
        const ppLatest = pickLatestByPlayer(ppRows);
        const latestMetricDateByPlayerId = new Map<number, string>();
        for (const playerId of teamPositionFilteredSkaterIds) {
          const evDate = evLatest.get(playerId)?.game_date ?? null;
          const ppDate = ppLatest.get(playerId)?.game_date ?? null;
          const latestDate =
            evDate && ppDate ? (evDate > ppDate ? evDate : ppDate) : evDate ?? ppDate;
          if (latestDate) latestMetricDateByPlayerId.set(playerId, latestDate);
        }

        const activeSkaterFilter = filterActiveSkaterCandidateIds({
          asOfDate,
          teamId,
          rawSkaterIds,
          playerMetaById,
          latestMetricDateByPlayerId
        });
        if (
          usedLineComboFallback &&
          activeSkaterFilter.eligibleSkaterIds.length === 0
        ) {
          metrics.data_quality.line_combo_hard_failures += 1;
          metrics.warnings.push(
            `lineCombinations fallback produced no active skaters for game=${game.id} team=${teamId}`
          );
          continue;
        }
        metrics.data_quality.filtered_skater_team_or_position +=
          activeSkaterFilter.stats.filteredByTeamOrPosition;
        metrics.data_quality.filtered_skater_missing_metrics +=
          activeSkaterFilter.stats.filteredMissingRecentMetrics;
        metrics.data_quality.filtered_skater_hard_stale +=
          activeSkaterFilter.stats.filteredHardStale;
        metrics.data_quality.soft_stale_skater_penalties +=
          activeSkaterFilter.stats.softStalePenalized;

        const unavailableSkaters = activeSkaterFilter.eligibleSkaterIds.filter(
          (playerId) => (playerAvailabilityMultiplier.get(playerId) ?? 1) <= 0
        );
        metrics.data_quality.skater_unavailable_filtered += unavailableSkaters.length;
        const skaterIds = activeSkaterFilter.eligibleSkaterIds.filter(
          (playerId) => (playerAvailabilityMultiplier.get(playerId) ?? 1) > 0
        );

        if (skaterIds.length === 0) {
          metrics.warnings.push(
            `empty skaterIds for game=${game.id} team=${teamId}`
          );
          metrics.data_quality.empty_skater_rosters += 1;
          continue;
        }
        const teamAbbrev = teamAbbreviationById.get(teamId) ?? null;
        const opponentAbbrev = teamAbbreviationById.get(opponentTeamId) ?? null;
        if (!teamStrengthPriorCache.has(teamId)) {
          teamStrengthPriorCache.set(
            teamId,
            teamAbbrev
              ? await fetchTeamStrengthPrior(teamAbbrev, asOfDate)
              : null
          );
        }
        if (!teamStrengthPriorCache.has(opponentTeamId)) {
          teamStrengthPriorCache.set(
            opponentTeamId,
            opponentAbbrev
              ? await fetchTeamStrengthPrior(opponentAbbrev, asOfDate)
              : null
          );
        }
        if (!teamFiveOnFiveProfileCache.has(teamId)) {
          teamFiveOnFiveProfileCache.set(
            teamId,
            await fetchTeamFiveOnFiveProfile(teamId, asOfDate)
          );
        }
        if (!teamFiveOnFiveProfileCache.has(opponentTeamId)) {
          teamFiveOnFiveProfileCache.set(
            opponentTeamId,
            await fetchTeamFiveOnFiveProfile(opponentTeamId, asOfDate)
          );
        }
        if (!teamNstExpectedGoalsCache.has(teamId)) {
          teamNstExpectedGoalsCache.set(
            teamId,
            teamAbbrev
              ? await fetchTeamNstExpectedGoalsProfile(teamAbbrev, asOfDate)
              : null
          );
        }
        if (!teamNstExpectedGoalsCache.has(opponentTeamId)) {
          teamNstExpectedGoalsCache.set(
            opponentTeamId,
            opponentAbbrev
              ? await fetchTeamNstExpectedGoalsProfile(opponentAbbrev, asOfDate)
              : null
          );
        }
        const teamLevelContextAdjustment = computeSkaterTeamLevelContextAdjustments({
          teamStrengthPrior: teamStrengthPriorCache.get(teamId) ?? null,
          opponentStrengthPrior: teamStrengthPriorCache.get(opponentTeamId) ?? null,
          teamFiveOnFiveProfile: teamFiveOnFiveProfileCache.get(teamId) ?? null,
          opponentFiveOnFiveProfile:
            teamFiveOnFiveProfileCache.get(opponentTeamId) ?? null,
          teamNstProfile: teamNstExpectedGoalsCache.get(teamId) ?? null,
          opponentNstProfile: teamNstExpectedGoalsCache.get(opponentTeamId) ?? null
        });
        if (teamLevelContextAdjustment.sampleWeight > 0) {
          metrics.data_quality.team_level_context_teams_with_signal += 1;
          metrics.data_quality.team_level_context_adjustments_applied += 1;
        }
        const opponentGoalieContext = await fetchOpponentGoalieContextForGame({
          gameId: game.id,
          opponentTeamId
        });
        if (opponentGoalieContext != null) {
          metrics.data_quality.opponent_goalie_context_profiles_found += 1;
        }
        const opponentGoalieContextAdjustment =
          computeSkaterOpponentGoalieContextAdjustments({
            context: opponentGoalieContext
          });
        if (opponentGoalieContextAdjustment.sampleWeight > 0) {
          metrics.data_quality.opponent_goalie_context_adjustments_applied += 1;
        }
        if (!teamRestDaysCache.has(teamId)) {
          teamRestDaysCache.set(teamId, await fetchTeamRestDays(teamId, asOfDate));
        }
        if (!teamRestDaysCache.has(opponentTeamId)) {
          teamRestDaysCache.set(
            opponentTeamId,
            await fetchTeamRestDays(opponentTeamId, asOfDate)
          );
        }
        const restScheduleAdjustment = computeSkaterRestScheduleAdjustments({
          teamRestDays: teamRestDaysCache.get(teamId) ?? null,
          opponentRestDays: teamRestDaysCache.get(opponentTeamId) ?? null,
          isHome: teamId === game.homeTeamId
        });
        if (restScheduleAdjustment.sampleWeight > 0) {
          metrics.data_quality.rest_schedule_teams_with_signal += 1;
          metrics.data_quality.rest_schedule_adjustments_applied += 1;
        }
        const deploymentPriorByPlayerId =
          await fetchLatestWgoSkaterDeploymentProfiles(skaterIds, asOfDate);
        const shotQualityByPlayerId = await fetchLatestSkaterShotQualityProfiles(
          skaterIds,
          asOfDate
        );
        const onIceContextByPlayerId = await fetchLatestSkaterOnIceContextProfiles(
          skaterIds,
          asOfDate
        );
        metrics.data_quality.deployment_prior_profiles_found +=
          deploymentPriorByPlayerId.size;
        metrics.data_quality.shot_quality_profiles_found +=
          shotQualityByPlayerId.size;
        metrics.data_quality.on_ice_context_profiles_found +=
          onIceContextByPlayerId.size;
        if (!teamSkaterRoleHistoryCache.has(teamId)) {
          teamSkaterRoleHistoryCache.set(
            teamId,
            await fetchTeamSkaterRoleHistory(teamId, asOfDate)
          );
        }
        const roleHistoryByPlayerId =
          teamSkaterRoleHistoryCache.get(teamId) ?? new Map<number, string[]>();

        // Initial per-player TOI estimates (seconds)
        const projected = new Map<
          number,
          {
            toiEs: number;
            toiPp: number;
            shotsEs: number;
            shotsPp: number;
            goalRate: number;
            assistRate: number;
            hitsRate: number;
            blocksRate: number;
            roleTag: SkaterRoleTag | null;
            roleContinuity: SkaterRoleContinuitySummary | null;
            roleStabilityMultiplier: number;
            eventAvailabilityMultiplier: number;
            availabilityEvent: RosterEventRow | null;
            latestMetricDate: string | null;
            daysSinceLastMetric: number | null;
            recencyMultiplier: number;
            shotQualityProfileSourceDate: string | null;
            shotQualitySampleWeight: number;
            shotRateMultiplier: number;
            goalRateMultiplier: number;
            qualityPerShot: number | null;
            rushReboundPer60: number | null;
            onIceContextSourceDate: string | null;
            onIceContextSampleWeight: number;
            shotEnvironmentMultiplier: number;
            goalEnvironmentMultiplier: number;
            assistEnvironmentMultiplier: number;
            onIcePossessionPct: number | null;
            teamLevelSampleWeight: number;
            teamLevelShotRateMultiplier: number;
            teamLevelGoalRateMultiplier: number;
            teamLevelAssistRateMultiplier: number;
            teamLevelPaceEdge: number;
            teamLevelOpponentDefenseEdge: number;
            opponentGoalieSampleWeight: number;
            opponentGoalieGoalRateMultiplier: number;
            opponentGoalieAssistRateMultiplier: number;
            opponentGoalieWeightedGsaaPer60: number | null;
            opponentGoalieStarterCertainty: number;
            restScheduleSampleWeight: number;
            restScheduleToiMultiplier: number;
            restScheduleShotRateMultiplier: number;
            restScheduleGoalRateMultiplier: number;
            restScheduleAssistRateMultiplier: number;
            restScheduleRestDelta: number;
            restScheduleTeamRestDays: number | null;
            restScheduleOpponentRestDays: number | null;
            smallSampleWeight: number;
            smallSampleIsLow: boolean;
            smallSampleUsedCallupFallback: boolean;
            smallSampleEvidenceToiSeconds: number;
            smallSampleEvidenceShots: number;
          }
        >();

        for (const playerId of skaterIds) {
          const ev = evLatest.get(playerId);
          const pp = ppLatest.get(playerId);

          // Filter out players who have no recent EV stats (likely retired or inactive)
          // We check if they have ANY rolling stats. If not, we skip them.
          if (!ev && !pp) {
            // Double check if they are a goalie (sometimes goalies are in skater lists by mistake or emergency backup)
            // But for now, if no stats, we assume inactive.
            continue;
          }

          if (!ev) metrics.data_quality.missing_ev_metrics_players += 1;
          if (!pp) metrics.data_quality.missing_pp_metrics_players += 1;

          const toiEs = safeNumber(
            ev?.toi_seconds_avg_last5,
            safeNumber(ev?.toi_seconds_avg_all, 700)
          );
          const toiPp = safeNumber(
            pp?.toi_seconds_avg_last5,
            safeNumber(pp?.toi_seconds_avg_all, 120)
          );
          const deploymentPrior = deploymentPriorByPlayerId.get(playerId) ?? null;
          const shotQualityProfile = shotQualityByPlayerId.get(playerId) ?? null;
          const onIceContextProfile = onIceContextByPlayerId.get(playerId) ?? null;
          const toiEsDeploymentPrior = deploymentPrior?.esToiPerGameSec ?? null;
          const toiPpDeploymentPrior = deploymentPrior?.ppToiPerGameSec ?? null;
          const toiRollingWeightEs = ev != null ? 0.8 : 0.45;
          const toiRollingWeightPp = pp != null ? 0.8 : 0.45;
          const blendedToiEs =
            blendToiSecondsWithDeploymentPrior({
              rollingSeconds: toiEs,
              deploymentPriorSeconds: toiEsDeploymentPrior,
              rollingWeight: toiRollingWeightEs
            }) ?? toiEs;
          const blendedToiPp =
            blendToiSecondsWithDeploymentPrior({
              rollingSeconds: toiPp,
              deploymentPriorSeconds: toiPpDeploymentPrior,
              rollingWeight: toiRollingWeightPp
            }) ?? toiPp;
          const adjustedToiEs = clamp(
            blendedToiEs * restScheduleAdjustment.toiMultiplier,
            0,
            2600
          );
          const adjustedToiPp = clamp(
            blendedToiPp * restScheduleAdjustment.toiMultiplier,
            0,
            1300
          );
          if (toiEsDeploymentPrior != null || toiPpDeploymentPrior != null) {
            metrics.data_quality.deployment_prior_toi_blends_applied += 1;
          }
          const sampleShrinkage = computeSkaterSampleShrinkageAdjustments({
            evToiSecondsAll: finiteOrNull(ev?.toi_seconds_avg_all),
            ppToiSecondsAll: finiteOrNull(pp?.toi_seconds_avg_all),
            evShotsAll: finiteOrNull(ev?.shots_total_all),
            ppShotsAll: finiteOrNull(pp?.shots_total_all)
          });
          if (sampleShrinkage.isLowSample) {
            metrics.data_quality.small_sample_players += 1;
            metrics.data_quality.small_sample_shrinkage_applied += 1;
          }
          if (sampleShrinkage.usedCallupFallback) {
            metrics.data_quality.small_sample_callup_fallbacks += 1;
          }
          const sampleWeight = sampleShrinkage.sampleWeight;
          const shrunkToiEs = Number(
            (
              sampleWeight * adjustedToiEs +
              (1 - sampleWeight) * safeNumber(ev?.toi_seconds_avg_all, 700)
            ).toFixed(3)
          );
          const shrunkToiPp = Number(
            (
              sampleWeight * adjustedToiPp +
              (1 - sampleWeight) * safeNumber(pp?.toi_seconds_avg_all, 120)
            ).toFixed(3)
          );
          const shotQualityAdjustment =
            computeSkaterShotQualityAdjustments({ profile: shotQualityProfile });
          if (shotQualityProfile != null) {
            metrics.data_quality.shot_quality_adjustments_applied += 1;
          }
          const onIceContextAdjustment = computeSkaterOnIceContextAdjustments({
            profile: onIceContextProfile
          });
          if (onIceContextProfile != null) {
            metrics.data_quality.on_ice_context_adjustments_applied += 1;
          }

          const sogPer60EvRaw = safeNumber(
            ev?.sog_per_60_avg_last5,
            safeNumber(ev?.sog_per_60_avg_all, 6)
          );
          const sogPer60PpRaw = safeNumber(
            pp?.sog_per_60_avg_last5,
            safeNumber(pp?.sog_per_60_avg_all, 8)
          );
          const sogPer60Ev = clamp(
            (sogPer60EvRaw *
              shotQualityAdjustment.shotRateMultiplier *
              onIceContextAdjustment.shotEnvironmentMultiplier *
              teamLevelContextAdjustment.shotRateMultiplier *
              restScheduleAdjustment.shotRateMultiplier) *
              sampleWeight +
              (1 - sampleWeight) * 6,
            1.5,
            20
          );
          const sogPer60Pp = clamp(
            (sogPer60PpRaw *
              shotQualityAdjustment.shotRateMultiplier *
              onIceContextAdjustment.shotEnvironmentMultiplier *
              teamLevelContextAdjustment.shotRateMultiplier *
              restScheduleAdjustment.shotRateMultiplier) *
              sampleWeight +
              (1 - sampleWeight) * 8,
            2,
            28
          );

          const hitsPer60 = safeNumber(
            ev?.hits_per_60_avg_last5,
            safeNumber(ev?.hits_per_60_avg_all, 1)
          );
          const blocksPer60 = safeNumber(
            ev?.blocks_per_60_avg_last5,
            safeNumber(ev?.blocks_per_60_avg_all, 0.5)
          );

          const shotsEs = computeShotsFromRate(shrunkToiEs, sogPer60Ev);
          const shotsPp = computeShotsFromRate(shrunkToiPp, sogPer60Pp);

          // Online learning: blend recent and season-long conversion rates.
          const goalsTotal = safeNumber(ev?.goals_total_all, 0);
          const shotsTotal = safeNumber(ev?.shots_total_all, 0);
          const assistsTotal = safeNumber(ev?.assists_total_all, 0);
          const goalsRecent = safeNumber(ev?.goals_total_last5, 0);
          const shotsRecent = safeNumber(ev?.shots_total_last5, 0);
          const assistsRecent = safeNumber(ev?.assists_total_last5, 0);

          learningCounters.players += 1;
          if (shotsRecent > 0) learningCounters.goalRecent += 1;
          if (goalsRecent > 0) learningCounters.assistRecent += 1;

          const goalRateRaw = blendOnlineRate({
            recentNumerator: goalsRecent,
            recentDenom: shotsRecent,
            baseNumerator: goalsTotal,
            baseDenom: shotsTotal,
            fallback: 0.1,
            priorStrength: 40,
            minRate: 0.03,
            maxRate: 0.25
          });
          const goalRate = clamp(
            (goalRateRaw *
              shotQualityAdjustment.goalRateMultiplier *
              onIceContextAdjustment.goalEnvironmentMultiplier *
              teamLevelContextAdjustment.goalRateMultiplier *
              opponentGoalieContextAdjustment.goalRateMultiplier *
              restScheduleAdjustment.goalRateMultiplier) *
              sampleWeight +
              (1 - sampleWeight) * 0.1,
            0.03,
            0.3
          );

          const assistRateRaw = blendOnlineRate({
            recentNumerator: assistsRecent,
            recentDenom: goalsRecent * 2,
            baseNumerator: assistsTotal,
            baseDenom: goalsTotal * 2,
            fallback: 0.7,
            priorStrength: 20,
            minRate: 0.2,
            maxRate: 1.4
          });
          const assistRate = clamp(
            (assistRateRaw *
              onIceContextAdjustment.assistEnvironmentMultiplier *
              teamLevelContextAdjustment.assistRateMultiplier *
              opponentGoalieContextAdjustment.assistRateMultiplier *
              restScheduleAdjustment.assistRateMultiplier) *
              sampleWeight +
              (1 - sampleWeight) * 0.7,
            0.2,
            1.6
          );

          const roleTag = skaterRoleTags.get(playerId) ?? null;
          const roleContinuity =
            roleTag != null
              ? summarizeSkaterRoleContinuity({
                  currentRole: roleTag.esRole,
                  recentRoles: roleHistoryByPlayerId.get(playerId) ?? []
                })
              : null;
          const roleStabilityMultiplier =
            roleContinuity != null
              ? computeSkaterRoleStabilityMultiplier(roleContinuity)
              : 1;
          if (roleStabilityMultiplier < 1) {
            metrics.data_quality.role_volatility_penalties_applied += 1;
          } else if (roleStabilityMultiplier > 1) {
            metrics.data_quality.role_continuity_boosts_applied += 1;
          }

          const eventAvailabilityMultiplier =
            playerAvailabilityMultiplier.get(playerId) ?? 1;
          if (eventAvailabilityMultiplier < 1) {
            metrics.data_quality.skater_availability_penalties_applied += 1;
          }
          const latestMetricDate = latestMetricDateByPlayerId.get(playerId) ?? null;
          const daysSinceLastMetric =
            latestMetricDate != null
              ? Math.max(0, daysBetweenDates(asOfDate, latestMetricDate))
              : null;
          const recencyMultiplier =
            activeSkaterFilter.recencyMultiplierByPlayerId.get(playerId) ?? 1;
          const availabilityMultiplier =
            eventAvailabilityMultiplier *
            recencyMultiplier *
            roleStabilityMultiplier;
          if (availabilityMultiplier <= 0) continue;
          projected.set(playerId, {
            toiEs: shrunkToiEs * availabilityMultiplier,
            toiPp: shrunkToiPp * availabilityMultiplier,
            shotsEs: shotsEs * availabilityMultiplier,
            shotsPp: shotsPp * availabilityMultiplier,
            goalRate,
            assistRate,
            hitsRate: hitsPer60,
            blocksRate: blocksPer60,
            roleTag,
            roleContinuity,
            roleStabilityMultiplier,
            eventAvailabilityMultiplier,
            availabilityEvent: availabilityEventByPlayer.get(playerId) ?? null,
            latestMetricDate,
            daysSinceLastMetric,
            recencyMultiplier,
            shotQualityProfileSourceDate: shotQualityProfile?.sourceDate ?? null,
            shotQualitySampleWeight: shotQualityAdjustment.sampleWeight,
            shotRateMultiplier: shotQualityAdjustment.shotRateMultiplier,
            goalRateMultiplier: shotQualityAdjustment.goalRateMultiplier,
            qualityPerShot: shotQualityAdjustment.qualityPerShot,
            rushReboundPer60: shotQualityAdjustment.rushReboundPer60,
            onIceContextSourceDate: onIceContextProfile?.sourceDate ?? null,
            onIceContextSampleWeight: onIceContextAdjustment.sampleWeight,
            shotEnvironmentMultiplier: onIceContextAdjustment.shotEnvironmentMultiplier,
            goalEnvironmentMultiplier: onIceContextAdjustment.goalEnvironmentMultiplier,
            assistEnvironmentMultiplier:
              onIceContextAdjustment.assistEnvironmentMultiplier,
            onIcePossessionPct: onIceContextAdjustment.possessionPct,
            teamLevelSampleWeight: teamLevelContextAdjustment.sampleWeight,
            teamLevelShotRateMultiplier:
              teamLevelContextAdjustment.shotRateMultiplier,
            teamLevelGoalRateMultiplier:
              teamLevelContextAdjustment.goalRateMultiplier,
            teamLevelAssistRateMultiplier:
              teamLevelContextAdjustment.assistRateMultiplier,
            teamLevelPaceEdge: teamLevelContextAdjustment.paceEdge,
            teamLevelOpponentDefenseEdge:
              teamLevelContextAdjustment.opponentDefenseEdge,
            opponentGoalieSampleWeight:
              opponentGoalieContextAdjustment.sampleWeight,
            opponentGoalieGoalRateMultiplier:
              opponentGoalieContextAdjustment.goalRateMultiplier,
            opponentGoalieAssistRateMultiplier:
              opponentGoalieContextAdjustment.assistRateMultiplier,
            opponentGoalieWeightedGsaaPer60:
              opponentGoalieContextAdjustment.weightedProjectedGsaaPer60,
            opponentGoalieStarterCertainty:
              opponentGoalieContextAdjustment.starterCertainty,
            restScheduleSampleWeight: restScheduleAdjustment.sampleWeight,
            restScheduleToiMultiplier: restScheduleAdjustment.toiMultiplier,
            restScheduleShotRateMultiplier:
              restScheduleAdjustment.shotRateMultiplier,
            restScheduleGoalRateMultiplier:
              restScheduleAdjustment.goalRateMultiplier,
            restScheduleAssistRateMultiplier:
              restScheduleAdjustment.assistRateMultiplier,
            restScheduleRestDelta: restScheduleAdjustment.restDelta,
            restScheduleTeamRestDays: restScheduleAdjustment.teamRestDays,
            restScheduleOpponentRestDays: restScheduleAdjustment.opponentRestDays,
            smallSampleWeight: sampleShrinkage.sampleWeight,
            smallSampleIsLow: sampleShrinkage.isLowSample,
            smallSampleUsedCallupFallback: sampleShrinkage.usedCallupFallback,
            smallSampleEvidenceToiSeconds: sampleShrinkage.evidenceToiSeconds,
            smallSampleEvidenceShots: sampleShrinkage.evidenceShots
          });
        }

        // Task 3.6 reconciliation: hard constraints for team TOI + shots (by strength).
        const targetSkaterSeconds = 60 * 60 * 5;
        const strengthAverages =
          teamStrengthCache.get(teamId) ??
          (await fetchTeamStrengthAverages(teamId, asOfDate));
        teamStrengthCache.set(teamId, strengthAverages);

        const initialToiEs = Array.from(projected.values()).reduce(
          (acc, p) => acc + p.toiEs,
          0
        );
        const initialToiPp = Array.from(projected.values()).reduce(
          (acc, p) => acc + p.toiPp,
          0
        );
        const initialShotsEs = Array.from(projected.values()).reduce(
          (acc, p) => acc + p.shotsEs,
          0
        );
        const initialShotsPp = Array.from(projected.values()).reduce(
          (acc, p) => acc + p.shotsPp,
          0
        );

        const avgToiEs = strengthAverages.toiEsSecondsAvg;
        const avgToiPp = strengthAverages.toiPpSecondsAvg;
        const toiDenom =
          (typeof avgToiEs === "number" ? avgToiEs : 0) +
          (typeof avgToiPp === "number" ? avgToiPp : 0);
        const fallbackDenom = initialToiEs + initialToiPp;

        const ppShare =
          toiDenom > 0
            ? safeNumber(avgToiPp, 0) / toiDenom
            : fallbackDenom > 0
              ? initialToiPp / fallbackDenom
              : 0.1;

        const toiPpTarget = Math.round(
          clamp(ppShare, 0, 0.5) * targetSkaterSeconds
        );
        const toiEsTarget = targetSkaterSeconds - toiPpTarget;

        const shotsEsTarget = safeNumber(
          strengthAverages.shotsEsAvg,
          initialShotsEs
        );
        const shotsPpTarget = safeNumber(
          strengthAverages.shotsPpAvg,
          initialShotsPp
        );

        const { players: reconciledPlayers, report } = reconcileTeamToPlayers({
          players: Array.from(projected.entries()).map(([playerId, p]) => ({
            playerId,
            toiEsSeconds: p.toiEs,
            toiPpSeconds: p.toiPp,
            shotsEs: p.shotsEs,
            shotsPp: p.shotsPp
          })),
          targets: {
            toiEsSeconds: toiEsTarget,
            toiPpSeconds: toiPpTarget,
            shotsEs: shotsEsTarget,
            shotsPp: shotsPpTarget
          }
        });

        const totalToiBefore = initialToiEs + initialToiPp;
        const totalToiAfter = report.toiEs.after + report.toiPp.after;
        const toiScale =
          totalToiBefore > 0 ? totalToiAfter / totalToiBefore : 1;

        if (Math.abs(toiScale - 1) > 0.01) {
          metrics.data_quality.toi_scaled_teams += 1;
          metrics.data_quality.toi_scale_min =
            metrics.data_quality.toi_scale_min == null
              ? toiScale
              : Math.min(metrics.data_quality.toi_scale_min, toiScale);
          metrics.data_quality.toi_scale_max =
            metrics.data_quality.toi_scale_max == null
              ? toiScale
              : Math.max(metrics.data_quality.toi_scale_max, toiScale);
        }

        for (const rp of reconciledPlayers) {
          const cur = projected.get(rp.playerId);
          if (!cur) continue;
          cur.toiEs = rp.toiEsSeconds;
          cur.toiPp = rp.toiPpSeconds;
          cur.shotsEs = rp.shotsEs;
          cur.shotsPp = rp.shotsPp;
          projected.set(rp.playerId, cur);
        }

        const playerUpserts = [];
        const teamTotals: ProjectionTotals = {
          toiEsSeconds: 0,
          toiPpSeconds: 0,
          shotsEs: 0,
          shotsPp: 0,
          goalsEs: 0,
          goalsPp: 0,
          assistsEs: 0,
          assistsPp: 0
        };

        for (const [playerId, p] of projected.entries()) {
          const shotsEs = p.shotsEs;
          const shotsPp = p.shotsPp;
          const goalsEs = shotsEs * p.goalRate;
          const goalsPp = shotsPp * p.goalRate;
          const assistsEs = goalsEs * p.assistRate;
          const assistsPp = goalsPp * p.assistRate;

          const totalToiMinutes = (p.toiEs + p.toiPp) / 60;
          const projHits = (totalToiMinutes / 60) * p.hitsRate;
          const projBlocks = (totalToiMinutes / 60) * p.blocksRate;

          teamTotals.toiEsSeconds += p.toiEs;
          teamTotals.toiPpSeconds += p.toiPp;
          teamTotals.shotsEs += shotsEs;
          teamTotals.shotsPp += shotsPp;
          teamTotals.goalsEs += goalsEs;
          teamTotals.goalsPp += goalsPp;
          teamTotals.assistsEs += assistsEs;
          teamTotals.assistsPp += assistsPp;

          const uncertainty = buildPlayerUncertainty({
            toiEsSeconds: p.toiEs,
            toiPpSeconds: p.toiPp,
            shotsEs,
            shotsPp,
            goalsEs,
            goalsPp,
            assistsEs,
            assistsPp,
            hits: projHits,
            blocks: projBlocks
          }, horizonGames, teamHorizonScalars);
          const roleTag = p.roleTag;
          const uncertaintyWithRole = {
            ...uncertainty,
            model: {
              source: "heuristic_skater_role_model",
              skater_selection: {
                source: roleTag?.source ?? null,
                es_role: roleTag?.esRole ?? null,
                unit_tier: roleTag?.unitTier ?? null,
                role_rank: roleTag?.roleRank ?? null,
                used_line_combo_fallback: usedLineComboFallback,
                source_rows: {
                  line_combination_game_id: lc?.gameId ?? null,
                  line_combination_source_date: lcContext.sourceGameDate ?? null,
                  roster_event_id: p.availabilityEvent?.event_id ?? null
                },
                fallback_path: {
                  used: usedLineComboFallback,
                  reason: lineComboFallbackReason,
                  fallback_candidate_count: fallbackCandidateCount
                },
                line_combo_recency: {
                  days_stale: lcRecency.daysStale,
                  class: lcRecency.isMissing
                    ? "MISSING"
                    : lcRecency.isHardStale
                      ? "HARD_STALE"
                      : lcRecency.isSoftStale
                        ? "SOFT_STALE"
                        : "FRESH"
                },
                active_pool: {
                  raw_candidate_count: Array.from(new Set(rawSkaterIds)).length,
                  team_position_candidate_count: teamPositionFilteredSkaterIds.length,
                  eligible_candidate_count: activeSkaterFilter.eligibleSkaterIds.length
                },
                recency: {
                  latest_metric_date: p.latestMetricDate,
                  days_since_last_metric: p.daysSinceLastMetric,
                  recency_multiplier: Number(p.recencyMultiplier.toFixed(4))
                },
                role_continuity: p.roleContinuity
                  ? {
                      window_games: p.roleContinuity.windowGames,
                      appearances_tracked: p.roleContinuity.appearancesTracked,
                      games_in_current_role: p.roleContinuity.gamesInCurrentRole,
                      continuity_share: p.roleContinuity.continuityShare,
                      role_change_rate: p.roleContinuity.roleChangeRate,
                      volatility_index: p.roleContinuity.volatilityIndex,
                      stability_multiplier: p.roleStabilityMultiplier
                    }
                  : null,
                availability: p.availabilityEvent
                  ? {
                      event_type: p.availabilityEvent.event_type,
                      confidence:
                        typeof p.availabilityEvent.confidence === "number" &&
                        Number.isFinite(p.availabilityEvent.confidence)
                          ? Number(p.availabilityEvent.confidence)
                          : null,
                      effective_from: p.availabilityEvent.effective_from ?? null,
                      effective_to: p.availabilityEvent.effective_to ?? null,
                      event_multiplier: Number(
                        p.eventAvailabilityMultiplier.toFixed(4)
                      )
                    }
                  : null,
                shot_quality: {
                  source_date: p.shotQualityProfileSourceDate,
                  sample_weight: Number(p.shotQualitySampleWeight.toFixed(4)),
                  shot_rate_multiplier: Number(p.shotRateMultiplier.toFixed(4)),
                  goal_rate_multiplier: Number(p.goalRateMultiplier.toFixed(4)),
                  quality_per_shot: p.qualityPerShot,
                  rush_rebound_per_60: p.rushReboundPer60
                },
                on_ice_context: {
                  source_date: p.onIceContextSourceDate,
                  sample_weight: Number(p.onIceContextSampleWeight.toFixed(4)),
                  shot_environment_multiplier: Number(
                    p.shotEnvironmentMultiplier.toFixed(4)
                  ),
                  goal_environment_multiplier: Number(
                    p.goalEnvironmentMultiplier.toFixed(4)
                  ),
                  assist_environment_multiplier: Number(
                    p.assistEnvironmentMultiplier.toFixed(4)
                  ),
                  possession_pct: p.onIcePossessionPct
                },
                team_level_context: {
                  sample_weight: Number(p.teamLevelSampleWeight.toFixed(4)),
                  shot_rate_multiplier: Number(
                    p.teamLevelShotRateMultiplier.toFixed(4)
                  ),
                  goal_rate_multiplier: Number(
                    p.teamLevelGoalRateMultiplier.toFixed(4)
                  ),
                  assist_rate_multiplier: Number(
                    p.teamLevelAssistRateMultiplier.toFixed(4)
                  ),
                  pace_edge: Number(p.teamLevelPaceEdge.toFixed(4)),
                  opponent_defense_edge: Number(
                    p.teamLevelOpponentDefenseEdge.toFixed(4)
                  )
                },
                opponent_goalie_context: {
                  sample_weight: Number(p.opponentGoalieSampleWeight.toFixed(4)),
                  goal_rate_multiplier: Number(
                    p.opponentGoalieGoalRateMultiplier.toFixed(4)
                  ),
                  assist_rate_multiplier: Number(
                    p.opponentGoalieAssistRateMultiplier.toFixed(4)
                  ),
                  weighted_projected_gsaa_per_60:
                    p.opponentGoalieWeightedGsaaPer60,
                  starter_certainty: Number(
                    p.opponentGoalieStarterCertainty.toFixed(4)
                  )
                },
                rest_schedule: {
                  sample_weight: Number(p.restScheduleSampleWeight.toFixed(4)),
                  team_rest_days: p.restScheduleTeamRestDays,
                  opponent_rest_days: p.restScheduleOpponentRestDays,
                  rest_delta: Number(p.restScheduleRestDelta.toFixed(4)),
                  toi_multiplier: Number(p.restScheduleToiMultiplier.toFixed(4)),
                  shot_rate_multiplier: Number(
                    p.restScheduleShotRateMultiplier.toFixed(4)
                  ),
                  goal_rate_multiplier: Number(
                    p.restScheduleGoalRateMultiplier.toFixed(4)
                  ),
                  assist_rate_multiplier: Number(
                    p.restScheduleAssistRateMultiplier.toFixed(4)
                  )
                },
                small_sample: {
                  sample_weight: Number(p.smallSampleWeight.toFixed(4)),
                  is_low_sample: p.smallSampleIsLow,
                  used_callup_fallback: p.smallSampleUsedCallupFallback,
                  evidence_toi_seconds: Number(
                    p.smallSampleEvidenceToiSeconds.toFixed(3)
                  ),
                  evidence_shots: Number(p.smallSampleEvidenceShots.toFixed(3))
                }
              }
            }
          };

          playerUpserts.push({
            run_id: runId,
            as_of_date: asOfDate,
            horizon_games: horizonGames,
            game_id: game.id,
            player_id: playerId,
            team_id: teamId,
            opponent_team_id: opponentTeamId,
            proj_toi_es_seconds: Number((p.toiEs * teamHorizonTotalScalar).toFixed(3)),
            proj_toi_pp_seconds: Number((p.toiPp * teamHorizonTotalScalar).toFixed(3)),
            proj_toi_pk_seconds: null,
            proj_shots_es: Number((shotsEs * teamHorizonTotalScalar).toFixed(3)),
            proj_shots_pp: Number((shotsPp * teamHorizonTotalScalar).toFixed(3)),
            proj_shots_pk: null,
            proj_goals_es: Number((goalsEs * teamHorizonTotalScalar).toFixed(3)),
            proj_goals_pp: Number((goalsPp * teamHorizonTotalScalar).toFixed(3)),
            proj_goals_pk: null,
            proj_assists_es: Number((assistsEs * teamHorizonTotalScalar).toFixed(3)),
            proj_assists_pp: Number((assistsPp * teamHorizonTotalScalar).toFixed(3)),
            proj_assists_pk: null,
            proj_hits: Number((projHits * teamHorizonTotalScalar).toFixed(3)),
            proj_blocks: Number((projBlocks * teamHorizonTotalScalar).toFixed(3)),
            uncertainty: uncertaintyWithRole,
            updated_at: new Date().toISOString()
          });
        }

        const { error: playerErr } = await supabase
          .from("forge_player_projections")
          .upsert(playerUpserts, {
            onConflict: "run_id,game_id,player_id,horizon_games"
          });
        if (playerErr) throw playerErr;
        playerRowsUpserted += playerUpserts.length;

        const teamUpsert = {
          run_id: runId,
          as_of_date: asOfDate,
          horizon_games: horizonGames,
          game_id: game.id,
          team_id: teamId,
          opponent_team_id: opponentTeamId,
          proj_toi_es_seconds: Number(
            (teamTotals.toiEsSeconds * teamHorizonTotalScalar).toFixed(3)
          ),
          proj_toi_pp_seconds: Number(
            (teamTotals.toiPpSeconds * teamHorizonTotalScalar).toFixed(3)
          ),
          proj_toi_pk_seconds: null,
          proj_shots_es: Number((teamTotals.shotsEs * teamHorizonTotalScalar).toFixed(3)),
          proj_shots_pp: Number((teamTotals.shotsPp * teamHorizonTotalScalar).toFixed(3)),
          proj_shots_pk: null,
          proj_goals_es: Number((teamTotals.goalsEs * teamHorizonTotalScalar).toFixed(3)),
          proj_goals_pp: Number((teamTotals.goalsPp * teamHorizonTotalScalar).toFixed(3)),
          proj_goals_pk: null,
          uncertainty: buildTeamUncertainty({
            toiEsSeconds: teamTotals.toiEsSeconds,
            toiPpSeconds: teamTotals.toiPpSeconds,
            shotsEs: teamTotals.shotsEs,
            shotsPp: teamTotals.shotsPp,
            goalsEs: teamTotals.goalsEs,
            goalsPp: teamTotals.goalsPp
          }, horizonGames, teamHorizonScalars),
          updated_at: new Date().toISOString()
        };

        const { error: teamErr } = await supabase
          .from("forge_team_projections")
          .upsert(teamUpsert, {
            onConflict: "run_id,game_id,team_id,horizon_games"
          });
        if (teamErr) throw teamErr;
        teamRowsUpserted += 1;

        teamShotsByTeamId.set(teamId, {
          shotsEs: Number(teamUpsert.proj_shots_es ?? 0),
          shotsPp: Number(teamUpsert.proj_shots_pp ?? 0)
        });
        teamGoalsByTeamId.set(
          teamId,
          Number(
            ((teamTotals.goalsEs + teamTotals.goalsPp) * teamHorizonTotalScalar).toFixed(3)
          )
        );

        // Goalie: pick the highest probability starter from goalie_start_projections if available.
        const goalieOverride = goalieOverrideByTeamId.get(teamId);
        const { data: goalieStarts, error: gsErr } = await supabase
          .from("goalie_start_projections")
          .select(
            "player_id,start_probability,confirmed_status,l10_start_pct,season_start_pct,games_played,projected_gsaa_per_60"
          )
          .eq("game_id", game.id)
          .eq("team_id", teamId)
          .order("start_probability", { ascending: false })
          .limit(6);
        if (gsErr) throw gsErr;
        if (!fallbackGoalieByTeamId.has(teamId)) {
          fallbackGoalieByTeamId.set(
            teamId,
            await fetchLatestGoalieForTeam(teamId, asOfDate)
          );
        }
        const fallbackGoalieId = fallbackGoalieByTeamId.get(teamId) ?? null;
        if (!teamGoalieStarterContextCache.has(teamId)) {
          teamGoalieStarterContextCache.set(
            teamId,
            await fetchTeamGoalieStarterContext(teamId, asOfDate)
          );
        }
        if (!currentTeamGoalieIdsCache.has(teamId)) {
          currentTeamGoalieIdsCache.set(
            teamId,
            await fetchCurrentTeamGoalieIds(teamId)
          );
        }
        if (!teamLineComboGoaliePriorCache.has(teamId)) {
          teamLineComboGoaliePriorCache.set(
            teamId,
            await fetchTeamLineComboGoaliePrior(teamId, asOfDate)
          );
        }
        const context = teamGoalieStarterContextCache.get(
          teamId
        ) as TeamGoalieStarterContext;
        const currentTeamGoalieIds = currentTeamGoalieIdsCache.get(teamId) as Set<number>;
        const lineComboPriorByGoalieId =
          teamLineComboGoaliePriorCache.get(teamId) ?? new Map<number, number>();

        const priorStartProbByGoalieId = new Map<number, number>();
        const confirmedStarterByGoalieId = new Map<number, boolean>();
        const projectedGsaaPer60ByGoalieId = new Map<number, number>();
        const seasonStartPctByGoalieId = new Map<number, number>();
        const seasonGamesPlayedByGoalieId = new Map<number, number>();
        for (const row of goalieStarts ?? []) {
          const goalieId = Number((row as any)?.player_id);
          if (!Number.isFinite(goalieId)) continue;
          priorStartProbByGoalieId.set(
            goalieId,
            clamp(Number((row as any)?.start_probability ?? 0.5), 0.01, 0.99)
          );
          confirmedStarterByGoalieId.set(
            goalieId,
            Boolean((row as any)?.confirmed_status)
          );
          const projectedGsaaPer60 = Number((row as any)?.projected_gsaa_per_60);
          if (Number.isFinite(projectedGsaaPer60)) {
            projectedGsaaPer60ByGoalieId.set(goalieId, projectedGsaaPer60);
          }
          const seasonStartPct = Number((row as any)?.season_start_pct);
          if (Number.isFinite(seasonStartPct)) {
            seasonStartPctByGoalieId.set(
              goalieId,
              clamp(seasonStartPct, 0, 1)
            );
          }
          const gamesPlayed = Number((row as any)?.games_played);
          if (Number.isFinite(gamesPlayed) && gamesPlayed >= 0) {
            seasonGamesPlayedByGoalieId.set(goalieId, gamesPlayed);
          }
        }

        const contextGoalies = Array.from(context.startsByGoalie.keys()).slice(0, 4);
        const rawCandidateGoalieIds = Array.from(
          new Set(
            [
              goalieOverride?.goalieId ?? null,
              ...(goalieStarts ?? []).map((r: any) => Number(r.player_id)),
              ...(lc?.goalies ?? []),
              ...contextGoalies,
              fallbackGoalieId
            ].filter((n): n is number => Number.isFinite(n))
          )
        );
        const candidateGoalieIds = selectStarterCandidateGoalieIds({
          asOfDate,
          rawCandidateGoalieIds,
          currentTeamGoalieIds,
          context,
          goalieOverrideGoalieId: goalieOverride?.goalieId ?? null,
          priorStartProbByGoalieId,
          confirmedStarterByGoalieId,
          limit: 3
        });

        if (candidateGoalieIds.length > 0) {
          goalieCandidates.push({
            teamId,
            opponentTeamId,
            candidateGoalieIds,
            priorStartProbByGoalieId,
            lineComboPriorByGoalieId,
            projectedGsaaPer60ByGoalieId,
            seasonStartPctByGoalieId,
            seasonGamesPlayedByGoalieId,
            override: goalieOverride ?? null
          });
        }
      }

      // Create goalie projections after both teams are projected so we can use opponent shots.
      for (const c of goalieCandidates) {
        if (Date.now() > deadlineMs) {
          timedOut = true;
          break gamesLoop;
        }
        const oppShots = teamShotsByTeamId.get(c.opponentTeamId);
        if (!oppShots) {
          metrics.warnings.push(
            `missing opponent shots for game=${game.id} team=${c.teamId}`
          );
          continue;
        }
        const opponentProjectedShotsAgainst = Number(
          (oppShots.shotsEs + oppShots.shotsPp).toFixed(3)
        );
        const defendingTeamAbbrev = teamAbbreviationById.get(c.teamId) ?? null;
        const opponentTeamAbbrev = teamAbbreviationById.get(c.opponentTeamId) ?? null;
        if (!teamStrengthPriorCache.has(c.teamId)) {
          teamStrengthPriorCache.set(
            c.teamId,
            defendingTeamAbbrev
              ? await fetchTeamStrengthPrior(defendingTeamAbbrev, asOfDate)
              : null
          );
        }
        if (!teamStrengthPriorCache.has(c.opponentTeamId)) {
          teamStrengthPriorCache.set(
            c.opponentTeamId,
            opponentTeamAbbrev
              ? await fetchTeamStrengthPrior(opponentTeamAbbrev, asOfDate)
              : null
          );
        }
        const defendingStrengthPrior = teamStrengthPriorCache.get(c.teamId) ?? null;
        const opponentStrengthPrior =
          teamStrengthPriorCache.get(c.opponentTeamId) ?? null;
        const teamStrengthContextAdjustment = computeTeamStrengthContextAdjustment({
          defendingTeamPrior: defendingStrengthPrior,
          opponentTeamPrior: opponentStrengthPrior
        });
        if (!teamFiveOnFiveProfileCache.has(c.teamId)) {
          teamFiveOnFiveProfileCache.set(
            c.teamId,
            await fetchTeamFiveOnFiveProfile(c.teamId, asOfDate)
          );
        }
        if (!teamFiveOnFiveProfileCache.has(c.opponentTeamId)) {
          teamFiveOnFiveProfileCache.set(
            c.opponentTeamId,
            await fetchTeamFiveOnFiveProfile(c.opponentTeamId, asOfDate)
          );
        }
        const defendingFiveOnFiveProfile =
          teamFiveOnFiveProfileCache.get(c.teamId) ?? null;
        const opponentFiveOnFiveProfile =
          teamFiveOnFiveProfileCache.get(c.opponentTeamId) ?? null;
        const teamFiveOnFiveContextAdjustment =
          computeTeamFiveOnFiveContextAdjustment({
            defendingTeamProfile: defendingFiveOnFiveProfile,
            opponentTeamProfile: opponentFiveOnFiveProfile
          });
        if (!teamNstExpectedGoalsCache.has(c.teamId)) {
          teamNstExpectedGoalsCache.set(
            c.teamId,
            defendingTeamAbbrev
              ? await fetchTeamNstExpectedGoalsProfile(defendingTeamAbbrev, asOfDate)
              : null
          );
        }
        if (!teamNstExpectedGoalsCache.has(c.opponentTeamId)) {
          teamNstExpectedGoalsCache.set(
            c.opponentTeamId,
            opponentTeamAbbrev
              ? await fetchTeamNstExpectedGoalsProfile(opponentTeamAbbrev, asOfDate)
              : null
          );
        }
        const defendingNstExpectedGoalsProfile =
          teamNstExpectedGoalsCache.get(c.teamId) ?? null;
        const opponentNstExpectedGoalsProfile =
          teamNstExpectedGoalsCache.get(c.opponentTeamId) ?? null;
        const nstOpponentDangerAdjustment = computeNstOpponentDangerAdjustment({
          defendingTeamProfile: defendingNstExpectedGoalsProfile,
          opponentTeamProfile: opponentNstExpectedGoalsProfile
        });
        if (!teamDefensiveEnvironmentCache.has(c.teamId)) {
          teamDefensiveEnvironmentCache.set(
            c.teamId,
            await fetchTeamDefensiveEnvironment(c.teamId, asOfDate)
          );
        }
        const defensiveEnv = teamDefensiveEnvironmentCache.get(
          c.teamId
        ) as TeamDefensiveEnvironment;
        const teamSaAvg10 = defensiveEnv.avgShotsAgainstLast10;
        const teamSaAvg5 = defensiveEnv.avgShotsAgainstLast5;
        const trendAdj =
          teamSaAvg10 != null && teamSaAvg5 != null
            ? clamp((teamSaAvg5 - teamSaAvg10) * 0.25, -3, 3)
            : 0;
        const blendedShotsAgainst =
          teamSaAvg10 != null
            ? 0.65 * opponentProjectedShotsAgainst + 0.35 * teamSaAvg10 + trendAdj
            : opponentProjectedShotsAgainst;
        const adjustedBaseShotsAgainst = blendedShotsAgainst * (
          1 + teamStrengthContextAdjustment.shotsAgainstPctAdjustment
        );
        const baseShotsAgainst = Number(Math.max(0, adjustedBaseShotsAgainst).toFixed(3));
        const teamGoalsFor = teamGoalsByTeamId.get(c.teamId) ?? 0;
        if (!teamOffenseEnvironmentCache.has(c.opponentTeamId)) {
          teamOffenseEnvironmentCache.set(
            c.opponentTeamId,
            await fetchTeamOffenseEnvironment(c.opponentTeamId, asOfDate)
          );
        }
        if (!teamRestDaysCache.has(c.teamId)) {
          teamRestDaysCache.set(c.teamId, await fetchTeamRestDays(c.teamId, asOfDate));
        }
        if (!teamRestDaysCache.has(c.opponentTeamId)) {
          teamRestDaysCache.set(
            c.opponentTeamId,
            await fetchTeamRestDays(c.opponentTeamId, asOfDate)
          );
        }
        const opponentOffense = teamOffenseEnvironmentCache.get(
          c.opponentTeamId
        ) as TeamOffenseEnvironment;
        const defendingRestDays = teamRestDaysCache.get(c.teamId) ?? null;
        const opponentRestDays = teamRestDaysCache.get(c.opponentTeamId) ?? null;
        const opponentIsHome = c.opponentTeamId === game.homeTeamId;

        const oppShots10 = opponentOffense.avgShotsForLast10;
        const oppShots5 = opponentOffense.avgShotsForLast5;
        const oppGoals10 = opponentOffense.avgGoalsForLast10;
        const oppGoals5 = opponentOffense.avgGoalsForLast5;
        const shotsTrendPct =
          baseShotsAgainst > 0 && oppShots5 != null
            ? clamp((oppShots5 - baseShotsAgainst) / baseShotsAgainst, -0.12, 0.18)
            : 0;
        const goalsTrendPct =
          oppGoals10 != null && oppGoals5 != null && oppGoals10 > 0
            ? clamp((oppGoals5 - oppGoals10) / oppGoals10, -0.1, 0.15)
            : 0;

        let contextPct = 0;
        contextPct += shotsTrendPct * 0.45;
        contextPct += goalsTrendPct * 0.35;
        if (opponentRestDays != null && opponentRestDays >= 2) contextPct += OPPONENT_RESTED_BOOST;
        if (opponentRestDays === 1) contextPct -= OPPONENT_B2B_PENALTY;
        if (defendingRestDays === 1) contextPct += DEFENSE_B2B_FATIGUE_BOOST;
        contextPct += opponentIsHome ? OPPONENT_HOME_BOOST : -OPPONENT_AWAY_PENALTY;
        contextPct += teamFiveOnFiveContextAdjustment.contextPctAdjustment;
        contextPct += nstOpponentDangerAdjustment.contextPctAdjustment;
        contextPct = clamp(contextPct, -0.15, 0.2);

        const shotsAgainst = Number(
          Math.max(0, baseShotsAgainst * (1 + contextPct)).toFixed(3)
        );
        const leagueSavePct = clamp(
          0.9 -
            contextPct * 0.04 +
            teamFiveOnFiveContextAdjustment.leagueSavePctAdjustment,
          0.88,
          0.92
        );
        const adjustedTeamGoalsFor = Number(
          Math.max(
            0,
            teamGoalsFor * (1 + teamStrengthContextAdjustment.teamGoalsForPctAdjustment)
          ).toFixed(3)
        );

        let selectedGoalieId: number | null = null;
        let starterProb = 0.5;
        let starterModelMeta: any = {};
        let topStarterScenarios: StarterScenario[] = [];
        if (c.override) {
          selectedGoalieId = c.override.goalieId;
          starterProb = c.override.starterProb;
          topStarterScenarios = [
            {
              goalieId: selectedGoalieId,
              rank: 1,
              rawProbability: starterProb,
              probability: 1
            }
          ];
          starterModelMeta = {
            source: "roster_event_override",
            selected_goalie_id: selectedGoalieId,
            selected_goalie_probability: Number(starterProb.toFixed(4)),
            candidate_goalies: [
              {
                goalie_id: selectedGoalieId,
                probability: Number(starterProb.toFixed(4)),
                override: true
              }
            ],
            starter_scenarios_top2: topStarterScenarios.map((s) => ({
              goalie_id: s.goalieId,
              rank: s.rank,
              raw_probability: Number(s.rawProbability.toFixed(4)),
              probability: Number(s.probability.toFixed(4)),
              override: true
            })),
            top2_probability_mass: Number(starterProb.toFixed(4))
          };
        } else {
          const starterContext =
            teamGoalieStarterContextCache.get(c.teamId) ??
            (await fetchTeamGoalieStarterContext(c.teamId, asOfDate));
          teamGoalieStarterContextCache.set(c.teamId, starterContext);
          const opponentGoalsForRaw = teamGoalsByTeamId.get(c.opponentTeamId) ?? 0;
          const opponentGoalsFor = Number(
            Math.max(
              0,
              opponentGoalsForRaw *
                (1 + teamStrengthContextAdjustment.opponentGoalsForPctAdjustment)
            ).toFixed(3)
          );
          const teamIsWeaker =
            adjustedTeamGoalsFor + TEAM_STRENGTH_WEAKER_GAP < opponentGoalsFor;
          const opponentIsWeak = opponentGoalsFor <= WEAK_OPPONENT_GF_THRESHOLD;
          const isB2B =
            starterContext.previousGameDate != null &&
            daysBetweenDates(asOfDate, starterContext.previousGameDate) === 1;
          const probs = computeStarterProbabilities({
            asOfDate,
            candidateGoalieIds: c.candidateGoalieIds,
            starterContext,
            priorStartProbByGoalieId: c.priorStartProbByGoalieId,
            lineComboPriorByGoalieId: c.lineComboPriorByGoalieId,
            projectedGsaaPer60ByGoalieId: c.projectedGsaaPer60ByGoalieId,
            seasonStartPctByGoalieId: c.seasonStartPctByGoalieId,
            seasonGamesPlayedByGoalieId: c.seasonGamesPlayedByGoalieId,
            teamGoalsFor: adjustedTeamGoalsFor,
            opponentGoalsFor
          });
          const ranked = Array.from(probs.entries()).sort((a, b) => b[1] - a[1]);
          topStarterScenarios = buildTopStarterScenarios({
            probabilitiesByGoalieId: probs,
            maxScenarios: 2
          });
          if (ranked.length > 0) {
            selectedGoalieId = ranked[0][0];
            starterProb = ranked[0][1];
          }
          starterModelMeta = {
            source: "heuristic_starter_model",
            selected_goalie_id: selectedGoalieId,
            selected_goalie_probability: Number(starterProb.toFixed(4)),
            model_context: {
              as_of_date: asOfDate,
              previous_game_date: starterContext.previousGameDate,
              previous_game_starter_goalie_id:
                starterContext.previousGameStarterGoalieId,
              is_back_to_back: isB2B,
              team_is_weaker: teamIsWeaker,
              opponent_is_weak: opponentIsWeak,
              l10_games_available: starterContext.totalGames
            },
            shots_against_context: {
              opponent_projected_shots_against: opponentProjectedShotsAgainst,
              team_avg_shots_against_last10: teamSaAvg10,
              team_avg_shots_against_last5: teamSaAvg5,
              trend_adjustment: Number(trendAdj.toFixed(3)),
              nhl_team_data_pct_adjustment: Number(
                teamStrengthContextAdjustment.shotsAgainstPctAdjustment.toFixed(4)
              ),
              wgo_team_stats_5v5_context_pct_adjustment: Number(
                teamFiveOnFiveContextAdjustment.contextPctAdjustment.toFixed(4)
              ),
              nst_opponent_danger_context_pct_adjustment: Number(
                nstOpponentDangerAdjustment.contextPctAdjustment.toFixed(4)
              ),
              pre_context_projected_shots_against: baseShotsAgainst,
              blended_projected_shots_against: shotsAgainst
            },
            opponent_offense_context: {
              opponent_is_home: opponentIsHome,
              opponent_avg_shots_for_last10: oppShots10,
              opponent_avg_shots_for_last5: oppShots5,
              opponent_avg_goals_for_last10: oppGoals10,
              opponent_avg_goals_for_last5: oppGoals5,
              defending_team_rest_days: defendingRestDays,
              opponent_rest_days: opponentRestDays,
              nhl_team_data_sample_weight: Number(
                teamStrengthContextAdjustment.sampleWeight.toFixed(4)
              ),
              wgo_5v5_sample_weight: Number(
                teamFiveOnFiveContextAdjustment.sampleWeight.toFixed(4)
              ),
              nst_opponent_danger_sample_weight: Number(
                nstOpponentDangerAdjustment.sampleWeight.toFixed(4)
              ),
              defending_team_nst_xga:
                defendingNstExpectedGoalsProfile?.xga ?? null,
              defending_team_nst_xga_per_60:
                defendingNstExpectedGoalsProfile?.xgaPer60 ?? null,
              defending_team_nst_source:
                defendingNstExpectedGoalsProfile?.source ?? null,
              defending_team_nst_source_date:
                defendingNstExpectedGoalsProfile?.sourceDate ?? null,
              opponent_team_nst_xga: opponentNstExpectedGoalsProfile?.xga ?? null,
              opponent_team_nst_xga_per_60:
                opponentNstExpectedGoalsProfile?.xgaPer60 ?? null,
              opponent_team_nst_source:
                opponentNstExpectedGoalsProfile?.source ?? null,
              opponent_team_nst_source_date:
                opponentNstExpectedGoalsProfile?.sourceDate ?? null,
              defending_team_save_pct_5v5:
                defendingFiveOnFiveProfile?.savePct5v5 ?? null,
              defending_team_shooting_plus_save_pct_5v5:
                defendingFiveOnFiveProfile?.shootingPlusSavePct5v5 ?? null,
              opponent_team_shooting_plus_save_pct_5v5:
                opponentFiveOnFiveProfile?.shootingPlusSavePct5v5 ?? null,
              wgo_team_stats_5v5_league_save_pct_adjustment: Number(
                teamFiveOnFiveContextAdjustment.leagueSavePctAdjustment.toFixed(4)
              ),
              defending_team_xga: defendingStrengthPrior?.xga ?? null,
              defending_team_xga_per_game: defendingStrengthPrior?.xgaPerGame ?? null,
              defending_team_xgf_per_game: defendingStrengthPrior?.xgfPerGame ?? null,
              opponent_team_xga: opponentStrengthPrior?.xga ?? null,
              opponent_team_xga_per_game: opponentStrengthPrior?.xgaPerGame ?? null,
              opponent_team_xgf_per_game: opponentStrengthPrior?.xgfPerGame ?? null,
              team_goals_for_pre_strength_adjustment: Number(teamGoalsFor.toFixed(3)),
              team_goals_for_post_strength_adjustment: Number(
                adjustedTeamGoalsFor.toFixed(3)
              ),
              opponent_goals_for_post_strength_adjustment: Number(
                opponentGoalsFor.toFixed(3)
              ),
              context_adjustment_pct: Number(contextPct.toFixed(4)),
              league_save_pct_used: Number(leagueSavePct.toFixed(4))
            },
            candidate_goalies: ranked.map(([goalieId, probability]) => ({
              goalie_id: goalieId,
              probability: Number(probability.toFixed(4)),
              last_played_date:
                starterContext.lastPlayedDateByGoalie.get(goalieId) ?? null,
              days_since_last_played: (() => {
                const d = starterContext.lastPlayedDateByGoalie.get(goalieId);
                if (!d) return null;
                return Math.max(0, daysBetweenDates(asOfDate, d));
              })(),
              l10_starts: starterContext.startsByGoalie.get(goalieId) ?? 0,
              projected_gsaa_per_60:
                c.projectedGsaaPer60ByGoalieId.get(goalieId) ?? null,
              season_start_pct:
                c.seasonStartPctByGoalieId.get(goalieId) ?? null,
              season_games_played:
                c.seasonGamesPlayedByGoalieId.get(goalieId) ?? null,
              line_combinations_recency_prior:
                c.lineComboPriorByGoalieId.get(goalieId) ?? null
            })),
            starter_scenarios_top2: topStarterScenarios.map((s) => ({
              goalie_id: s.goalieId,
              rank: s.rank,
              raw_probability: Number(s.rawProbability.toFixed(4)),
              probability: Number(s.probability.toFixed(4)),
              last_played_date:
                starterContext.lastPlayedDateByGoalie.get(s.goalieId) ?? null,
              days_since_last_played: (() => {
                const d = starterContext.lastPlayedDateByGoalie.get(s.goalieId);
                if (!d) return null;
                return Math.max(0, daysBetweenDates(asOfDate, d));
              })(),
              l10_starts: starterContext.startsByGoalie.get(s.goalieId) ?? 0,
              projected_gsaa_per_60:
                c.projectedGsaaPer60ByGoalieId.get(s.goalieId) ?? null,
              season_start_pct:
                c.seasonStartPctByGoalieId.get(s.goalieId) ?? null,
              season_games_played:
                c.seasonGamesPlayedByGoalieId.get(s.goalieId) ?? null,
              line_combinations_recency_prior:
                c.lineComboPriorByGoalieId.get(s.goalieId) ?? null
            })),
            top2_probability_mass: Number(
              topStarterScenarios
                .reduce((sum, s) => sum + s.rawProbability, 0)
                .toFixed(4)
            ),
            line_combinations_prior: ranked
              .filter(([goalieId]) => c.lineComboPriorByGoalieId.has(goalieId))
              .map(([goalieId]) => ({
                goalie_id: goalieId,
                prior: Number(
                  (c.lineComboPriorByGoalieId.get(goalieId) ?? 0).toFixed(4)
                )
              })),
            projected_gsaa_per_60_prior: ranked
              .filter(([goalieId]) => c.projectedGsaaPer60ByGoalieId.has(goalieId))
              .map(([goalieId]) => ({
                goalie_id: goalieId,
                projected_gsaa_per_60: Number(
                  (c.projectedGsaaPer60ByGoalieId.get(goalieId) ?? 0).toFixed(4)
                )
              }))
          };
        }

        if (selectedGoalieId == null) continue;
        if (!goalieEvidenceCache.has(selectedGoalieId)) {
          goalieEvidenceCache.set(
            selectedGoalieId,
            await fetchGoalieEvidence(selectedGoalieId, asOfDate)
          );
        }
        if (!goalieWorkloadContextCache.has(selectedGoalieId)) {
          goalieWorkloadContextCache.set(
            selectedGoalieId,
            await fetchGoalieWorkloadContext(selectedGoalieId, asOfDate)
          );
        }
        if (!goalieRestSplitProfileCache.has(selectedGoalieId)) {
          goalieRestSplitProfileCache.set(
            selectedGoalieId,
            await fetchGoalieRestSplitProfile(selectedGoalieId, asOfDate)
          );
        }
        const evidence = goalieEvidenceCache.get(selectedGoalieId) as GoalieEvidence;
        const workload = goalieWorkloadContextCache.get(
          selectedGoalieId
        ) as GoalieWorkloadContext;
        const restSplitProfile = goalieRestSplitProfileCache.get(selectedGoalieId) ?? null;
        const workloadSavePctPenalty = computeWorkloadSavePctPenalty(workload);
        const restSplitSavePctAdjustment = computeGoalieRestSplitSavePctAdjustment({
          profile: restSplitProfile,
          daysSinceLastStart: workload.daysSinceLastStart
        });
        const adjustedLeagueSavePct = clamp(
          leagueSavePct - workloadSavePctPenalty + restSplitSavePctAdjustment,
          0.86,
          0.92
        );
        const goalieModel = computeGoalieProjectionModel({
          projectedShotsAgainst: shotsAgainst,
          starterProbability: starterProb,
          projectedGoalsFor: adjustedTeamGoalsFor,
          evidence,
          leagueSavePct: adjustedLeagueSavePct
        });
        const selectedGoalieFullStartModel = computeGoalieProjectionModel({
          projectedShotsAgainst: shotsAgainst,
          starterProbability: 1,
          projectedGoalsFor: adjustedTeamGoalsFor,
          evidence,
          leagueSavePct: adjustedLeagueSavePct
        });

        const scenarioProjections: StarterScenarioProjection[] = [];
        for (const scenario of topStarterScenarios) {
          if (!goalieEvidenceCache.has(scenario.goalieId)) {
            goalieEvidenceCache.set(
              scenario.goalieId,
              await fetchGoalieEvidence(scenario.goalieId, asOfDate)
            );
          }
          if (!goalieWorkloadContextCache.has(scenario.goalieId)) {
            goalieWorkloadContextCache.set(
              scenario.goalieId,
              await fetchGoalieWorkloadContext(scenario.goalieId, asOfDate)
            );
          }
          if (!goalieRestSplitProfileCache.has(scenario.goalieId)) {
            goalieRestSplitProfileCache.set(
              scenario.goalieId,
              await fetchGoalieRestSplitProfile(scenario.goalieId, asOfDate)
            );
          }
          const scenarioEvidence = goalieEvidenceCache.get(
            scenario.goalieId
          ) as GoalieEvidence;
          const scenarioWorkload = goalieWorkloadContextCache.get(
            scenario.goalieId
          ) as GoalieWorkloadContext;
          const scenarioRestSplitProfile =
            goalieRestSplitProfileCache.get(scenario.goalieId) ?? null;
          const scenarioWorkloadPenalty =
            computeWorkloadSavePctPenalty(scenarioWorkload);
          const scenarioRestSplitAdjustment =
            computeGoalieRestSplitSavePctAdjustment({
              profile: scenarioRestSplitProfile,
              daysSinceLastStart: scenarioWorkload.daysSinceLastStart
            });
          const scenarioLeagueSavePct = clamp(
            leagueSavePct - scenarioWorkloadPenalty + scenarioRestSplitAdjustment,
            0.86,
            0.92
          );
          const scenarioModel = computeGoalieProjectionModel({
            projectedShotsAgainst: shotsAgainst,
            starterProbability: 1,
            projectedGoalsFor: adjustedTeamGoalsFor,
            evidence: scenarioEvidence,
            leagueSavePct: scenarioLeagueSavePct
          });
          scenarioProjections.push({
            goalie_id: scenario.goalieId,
            rank: scenario.rank,
            starter_probability_raw: Number(scenario.rawProbability.toFixed(4)),
            starter_probability_top2_normalized: Number(scenario.probability.toFixed(4)),
            proj_shots_against: shotsAgainst,
            proj_saves: Number(scenarioModel.projectedSaves.toFixed(3)),
            proj_goals_allowed: Number(scenarioModel.projectedGoalsAllowed.toFixed(3)),
            proj_win_prob: Number(scenarioModel.winProbability.toFixed(4)),
            proj_shutout_prob: Number(scenarioModel.shutoutProbability.toFixed(4)),
            modeled_save_pct: Number(scenarioModel.modeledSavePct.toFixed(4)),
            workload_save_pct_penalty: Number(scenarioWorkloadPenalty.toFixed(4)),
            rest_split_save_pct_adjustment: Number(
              scenarioRestSplitAdjustment.toFixed(4)
            )
          });
        }
        const blendedProjection = blendTopStarterScenarioOutputs({
          scenarioProjections,
          fallbackProjection: {
            proj_shots_against: shotsAgainst,
            proj_saves: Number(selectedGoalieFullStartModel.projectedSaves.toFixed(3)),
            proj_goals_allowed: Number(
              selectedGoalieFullStartModel.projectedGoalsAllowed.toFixed(3)
            ),
            proj_win_prob: Number(selectedGoalieFullStartModel.winProbability.toFixed(4)),
            proj_shutout_prob: Number(
              selectedGoalieFullStartModel.shutoutProbability.toFixed(4)
            ),
            modeled_save_pct: Number(selectedGoalieFullStartModel.modeledSavePct.toFixed(4)),
            workload_save_pct_penalty: Number(workloadSavePctPenalty.toFixed(4)),
            rest_split_save_pct_adjustment: Number(
              restSplitSavePctAdjustment.toFixed(4)
            )
          }
        });

        const goalsAllowed = blendedProjection.proj_goals_allowed;
        const saves = blendedProjection.proj_saves;
        const winProb = blendedProjection.proj_win_prob;
        const shutoutProb = blendedProjection.proj_shutout_prob;
        const uncertaintyScenarioMixture = [
          ...scenarioProjections.map((s) => ({
            weight: s.starter_probability_raw,
            shotsAgainst: s.proj_shots_against,
            goalsAllowed: s.proj_goals_allowed,
            saves: s.proj_saves
          })),
          ...(blendedProjection.residual_probability_mass > 0
            ? [
                {
                  weight: blendedProjection.residual_probability_mass,
                  shotsAgainst,
                  goalsAllowed: Number(
                    selectedGoalieFullStartModel.projectedGoalsAllowed.toFixed(3)
                  ),
                  saves: Number(selectedGoalieFullStartModel.projectedSaves.toFixed(3))
                }
              ]
            : [])
        ];
        starterModelMeta.scenario_projections_top2 = scenarioProjections;
        starterModelMeta.scenario_projection_count = scenarioProjections.length;
        starterModelMeta.scenario_projection_blend = {
          probability_mass: blendedProjection.probability_mass,
          residual_probability_mass: blendedProjection.residual_probability_mass,
          proj_saves: Number(saves.toFixed(3)),
          proj_goals_allowed: Number(goalsAllowed.toFixed(3)),
          proj_win_prob: Number(winProb.toFixed(4)),
          proj_shutout_prob: Number(shutoutProb.toFixed(4)),
          modeled_save_pct: Number(blendedProjection.modeled_save_pct.toFixed(4))
        };
        const defendingTeamScalars = teamHorizonScalarsCache.get(c.teamId) ?? [1];
        const opponentTeamScalars = teamHorizonScalarsCache.get(c.opponentTeamId) ?? [1];
        const goalieHorizonScalars = Array.from({ length: horizonGames }, (_, idx) => {
          const d = defendingTeamScalars[idx] ?? 1;
          const o = opponentTeamScalars[idx] ?? 1;
          return Number(((d + o) / 2).toFixed(4));
        });
        const goalieHorizonTotalScalar = goalieHorizonScalars.reduce((sum, v) => sum + v, 0);
        const restSplitBucket = toGoalieRestSplitBucket(workload.daysSinceLastStart);
        const restSplitBucketGames =
          restSplitProfile?.gamesByBucket?.[restSplitBucket] ?? null;
        const restSplitBucketSavePct =
          restSplitProfile?.savePctByBucket?.[restSplitBucket] ?? null;
        const goalieUncertainty = {
          ...buildGoalieUncertainty({
            shotsAgainst,
            goalsAllowed,
            saves
          }, horizonGames, goalieHorizonScalars, uncertaintyScenarioMixture),
          model: {
            save_pct: Number(blendedProjection.modeled_save_pct.toFixed(4)),
            volatility_index: Number(goalieModel.volatilityIndex.toFixed(3)),
            blowup_risk: Number(goalieModel.blowupRisk.toFixed(4)),
            confidence_tier: goalieModel.confidenceTier,
            quality_tier: goalieModel.qualityTier,
            reliability_tier: goalieModel.reliabilityTier,
            recommendation: goalieModel.recommendation,
            evidence: {
              recent_starts: evidence.recentStarts,
              recent_shots: evidence.recentShotsAgainst,
              season_starts: evidence.seasonStarts,
              season_shots: evidence.seasonShotsAgainst,
              baseline_starts: evidence.baselineStarts,
              baseline_shots: evidence.baselineShotsAgainst,
              quality_starts: evidence.qualityStarts ?? null,
              quality_starts_pct: evidence.qualityStartsPct ?? null
            },
            workload_context: {
              starts_last_7_days: workload.startsLast7Days,
              starts_last_14_days: workload.startsLast14Days,
              days_since_last_start: workload.daysSinceLastStart,
              goalie_back_to_back: workload.isGoalieBackToBack,
              workload_save_pct_penalty: Number(workloadSavePctPenalty.toFixed(4)),
              rest_split_bucket: restSplitBucket,
              rest_split_games: Number.isFinite(restSplitBucketGames)
                ? Number(restSplitBucketGames)
                : null,
              rest_split_save_pct: Number.isFinite(restSplitBucketSavePct)
                ? Number(restSplitBucketSavePct)
                : null,
              rest_split_save_pct_adjustment: Number(
                restSplitSavePctAdjustment.toFixed(4)
              ),
              rest_split_source_date: restSplitProfile?.sourceDate ?? null,
              league_save_pct_used: Number(adjustedLeagueSavePct.toFixed(4))
            },
            scenario_metadata: {
              model_version: "starter-scenario-v1",
              horizon_games: horizonGames,
              horizon_scalars: goalieHorizonScalars,
              selected_goalie_id: selectedGoalieId,
              selected_goalie_starter_probability: Number(starterProb.toFixed(4)),
              top2_scenario_count: scenarioProjections.length,
              top2_probability_mass: Number(
                scenarioProjections
                  .reduce((sum, s) => sum + s.starter_probability_raw, 0)
                  .toFixed(4)
              ),
              residual_probability_mass: blendedProjection.residual_probability_mass,
              blended_projection: {
                proj_shots_against: Number(
                  (shotsAgainst * goalieHorizonTotalScalar).toFixed(3)
                ),
                proj_saves: Number(
                  (blendedProjection.proj_saves * goalieHorizonTotalScalar).toFixed(3)
                ),
                proj_goals_allowed: Number(
                  (blendedProjection.proj_goals_allowed * goalieHorizonTotalScalar).toFixed(3)
                ),
                proj_win_prob: Number(
                  (blendedProjection.proj_win_prob * goalieHorizonTotalScalar).toFixed(4)
                ),
                proj_shutout_prob: Number(
                  (blendedProjection.proj_shutout_prob * goalieHorizonTotalScalar).toFixed(4)
                ),
                modeled_save_pct: Number(blendedProjection.modeled_save_pct.toFixed(4))
              }
            },
            starter_selection: starterModelMeta
          }
        };

        const goalieUpsert = {
          run_id: runId,
          as_of_date: asOfDate,
          horizon_games: horizonGames,
          game_id: game.id,
          goalie_id: selectedGoalieId,
          team_id: c.teamId,
          opponent_team_id: c.opponentTeamId,
          starter_probability: Number(starterProb.toFixed(4)),
          proj_shots_against: Number((shotsAgainst * goalieHorizonTotalScalar).toFixed(3)),
          proj_goals_allowed: Number((goalsAllowed * goalieHorizonTotalScalar).toFixed(3)),
          proj_saves: Number((saves * goalieHorizonTotalScalar).toFixed(3)),
          proj_win_prob: Number((winProb * goalieHorizonTotalScalar).toFixed(4)),
          proj_shutout_prob: Number((shutoutProb * goalieHorizonTotalScalar).toFixed(4)),
          uncertainty: goalieUncertainty as any,
          updated_at: new Date().toISOString()
        };

        const { error: goalieErr } = await supabase
          .from("forge_goalie_projections")
          .upsert(goalieUpsert, {
            onConflict: "run_id,game_id,goalie_id,horizon_games"
          });
        if (goalieErr) throw goalieErr;
        goalieRowsUpserted += 1;
      }

      metrics.games += 1;
    }

    metrics.player_rows = playerRowsUpserted;
    metrics.team_rows = teamRowsUpserted;
    metrics.goalie_rows = goalieRowsUpserted;
    const learningPlayers = learningCounters.players;
    metrics.learning.players_considered = learningPlayers;
    metrics.learning.goal_rate_recent_players = learningCounters.goalRecent;
    metrics.learning.assist_rate_recent_players = learningCounters.assistRecent;
    metrics.learning.goal_rate_recent_share =
      learningPlayers > 0 ? learningCounters.goalRecent / learningPlayers : 0;
    metrics.learning.assist_rate_recent_share =
      learningPlayers > 0 ? learningCounters.assistRecent / learningPlayers : 0;
    metrics.finished_at = new Date().toISOString();
    metrics.timed_out = timedOut;

    await finalizeRun(runId, timedOut ? "failed" : "succeeded", metrics);
    return {
      runId,
      gamesProcessed: metrics.games,
      playerRowsUpserted,
      teamRowsUpserted,
      goalieRowsUpserted,
      timedOut
    };
  } catch (e) {
    metrics.finished_at = new Date().toISOString();
    metrics.error = (e as any)?.message ?? String(e);
    await finalizeRun(runId, "failed", metrics);
    throw e;
  }
}
