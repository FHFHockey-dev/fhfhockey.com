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

function computeShotsFromRate(toiSeconds: number, sogPer60: number): number {
  const toiMinutes = toiSeconds / 60;
  return (sogPer60 / 60) * toiMinutes;
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

function availabilityMultiplierForEvent(
  eventType: string,
  confidence: number
): number | null {
  const c =
    typeof confidence === "number" && Number.isFinite(confidence)
      ? confidence
      : 0.5;
  switch (eventType) {
    case "INJURY_OUT":
    case "SENDDOWN":
      return 0;
    case "DTD":
      return clamp(1 - 0.6 * c, 0.2, 1);
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
): Promise<LineCombinationRow | null> {
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
    return null;
  }

  if (!data) return null;

  return {
    gameId: data.gameId,
    teamId: data.teamId,
    forwards: data.forwards,
    defensemen: data.defensemen,
    goalies: data.goalies
  };
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

type GoalieWorkloadContext = {
  startsLast7Days: number;
  startsLast14Days: number;
  daysSinceLastStart: number | null;
  isGoalieBackToBack: boolean;
};

const GOALIE_STALE_SOFT_DAYS = 30;
const GOALIE_STALE_HARD_DAYS = 75;
const B2B_REPEAT_STARTER_PENALTY = 2.75;
const B2B_ALTERNATE_GOALIE_BOOST = 0.65;
const TEAM_STRENGTH_WEAKER_GAP = 0.35;
const WEAK_OPPONENT_GF_THRESHOLD = 2.6;
const WEAKER_TEAM_B2B_PRIMARY_PENALTY = 1.1;
const WEAKER_TEAM_B2B_BACKUP_BOOST = 0.45;
const WEAK_OPPONENT_PRIMARY_REST_PENALTY = 0.7;
const WEAK_OPPONENT_BACKUP_BOOST = 0.3;
const OPPONENT_RESTED_BOOST = 0.03;
const OPPONENT_B2B_PENALTY = 0.04;
const DEFENSE_B2B_FATIGUE_BOOST = 0.02;
const OPPONENT_HOME_BOOST = 0.02;
const OPPONENT_AWAY_PENALTY = 0.01;
const GOALIE_HEAVY_WORKLOAD_PENALTY = 0.025;
const GOALIE_VERY_HEAVY_WORKLOAD_PENALTY = 0.04;
const GOALIE_BACK_TO_BACK_PENALTY = 0.03;

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
  const [recentRes, seasonRes, baselineRes] = await Promise.all([
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
      .limit(200)
  ]);

  if (recentRes.error) throw recentRes.error;
  if (seasonRes.error) throw seasonRes.error;
  if (baselineRes.error) throw baselineRes.error;

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
    residualStdDev: safeStdDev(residuals)
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
  opts?: { deadlineMs?: number }
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
      empty_skater_rosters: 0,
      missing_ev_metrics_players: 0,
      missing_pp_metrics_players: 0,
      toi_scaled_teams: 0,
      toi_scale_min: null as number | null,
      toi_scale_max: null as number | null
    },
    warnings: [] as string[]
  };

  try {
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

    const playerAvailabilityMultiplier = new Map<number, number>();
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
        if (mult != null) playerAvailabilityMultiplier.set(playerId, mult);
      }
    }

    const deadlineMs = safeNumber(opts?.deadlineMs, Number.POSITIVE_INFINITY);
    let timedOut = false;

    let playerRowsUpserted = 0;
    let teamRowsUpserted = 0;
    let goalieRowsUpserted = 0;

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
      const goalieWorkloadContextCache = new Map<number, GoalieWorkloadContext>();
      const currentTeamGoalieIdsCache = new Map<number, Set<number>>();
      const goalieCandidates: Array<{
        teamId: number;
        opponentTeamId: number;
        candidateGoalieIds: number[];
        priorStartProbByGoalieId: Map<number, number>;
        override: { goalieId: number; starterProb: number } | null;
      }> = [];

      for (const teamId of [game.homeTeamId, game.awayTeamId]) {
        if (Date.now() > deadlineMs) {
          timedOut = true;
          break gamesLoop;
        }

        // Use the most recent line combination for this team (prior to today)
        const lc = await fetchLatestLineCombinationForTeam(teamId, asOfDate);

        const opponentTeamId =
          teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
        if (!lc) {
          metrics.warnings.push(
            `missing lineCombinations for game=${game.id} team=${teamId} (using latest before ${asOfDate})`
          );
          metrics.data_quality.missing_line_combos += 1;
          continue;
        }

        const rawSkaterIds = [
          ...(lc.forwards ?? []),
          ...(lc.defensemen ?? [])
        ].filter((n) => typeof n === "number");

        const skaterIds = rawSkaterIds.filter(
          (playerId) => (playerAvailabilityMultiplier.get(playerId) ?? 1) > 0
        );

        if (skaterIds.length === 0) {
          metrics.warnings.push(
            `empty skaterIds for game=${game.id} team=${teamId}`
          );
          metrics.data_quality.empty_skater_rosters += 1;
          continue;
        }

        const evRows = await fetchRollingRows(skaterIds, "ev", asOfDate);
        const ppRows = await fetchRollingRows(skaterIds, "pp", asOfDate);
        const evLatest = pickLatestByPlayer(evRows);
        const ppLatest = pickLatestByPlayer(ppRows);

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

          const sogPer60Ev = safeNumber(
            ev?.sog_per_60_avg_last5,
            safeNumber(ev?.sog_per_60_avg_all, 6)
          );
          const sogPer60Pp = safeNumber(
            pp?.sog_per_60_avg_last5,
            safeNumber(pp?.sog_per_60_avg_all, 8)
          );

          const hitsPer60 = safeNumber(
            ev?.hits_per_60_avg_last5,
            safeNumber(ev?.hits_per_60_avg_all, 1)
          );
          const blocksPer60 = safeNumber(
            ev?.blocks_per_60_avg_last5,
            safeNumber(ev?.blocks_per_60_avg_all, 0.5)
          );

          const shotsEs = computeShotsFromRate(toiEs, sogPer60Ev);
          const shotsPp = computeShotsFromRate(toiPp, sogPer60Pp);

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

          const goalRate = blendOnlineRate({
            recentNumerator: goalsRecent,
            recentDenom: shotsRecent,
            baseNumerator: goalsTotal,
            baseDenom: shotsTotal,
            fallback: 0.1,
            priorStrength: 40,
            minRate: 0.03,
            maxRate: 0.25
          });

          const assistRate = blendOnlineRate({
            recentNumerator: assistsRecent,
            recentDenom: goalsRecent * 2,
            baseNumerator: assistsTotal,
            baseDenom: goalsTotal * 2,
            fallback: 0.7,
            priorStrength: 20,
            minRate: 0.2,
            maxRate: 1.4
          });

          const availabilityMultiplier =
            playerAvailabilityMultiplier.get(playerId) ?? 1;
          projected.set(playerId, {
            toiEs: toiEs * availabilityMultiplier,
            toiPp: toiPp * availabilityMultiplier,
            shotsEs: shotsEs * availabilityMultiplier,
            shotsPp: shotsPp * availabilityMultiplier,
            goalRate,
            assistRate,
            hitsRate: hitsPer60,
            blocksRate: blocksPer60
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
          });

          playerUpserts.push({
            run_id: runId,
            as_of_date: asOfDate,
            horizon_games: 1,
            game_id: game.id,
            player_id: playerId,
            team_id: teamId,
            opponent_team_id: opponentTeamId,
            proj_toi_es_seconds: p.toiEs,
            proj_toi_pp_seconds: p.toiPp,
            proj_toi_pk_seconds: null,
            proj_shots_es: Number(shotsEs.toFixed(3)),
            proj_shots_pp: Number(shotsPp.toFixed(3)),
            proj_shots_pk: null,
            proj_goals_es: Number(goalsEs.toFixed(3)),
            proj_goals_pp: Number(goalsPp.toFixed(3)),
            proj_goals_pk: null,
            proj_assists_es: Number(assistsEs.toFixed(3)),
            proj_assists_pp: Number(assistsPp.toFixed(3)),
            proj_assists_pk: null,
            proj_hits: Number(projHits.toFixed(3)),
            proj_blocks: Number(projBlocks.toFixed(3)),
            uncertainty,
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
          horizon_games: 1,
          game_id: game.id,
          team_id: teamId,
          opponent_team_id: opponentTeamId,
          proj_toi_es_seconds: teamTotals.toiEsSeconds,
          proj_toi_pp_seconds: teamTotals.toiPpSeconds,
          proj_toi_pk_seconds: null,
          proj_shots_es: Number(teamTotals.shotsEs.toFixed(3)),
          proj_shots_pp: Number(teamTotals.shotsPp.toFixed(3)),
          proj_shots_pk: null,
          proj_goals_es: Number(teamTotals.goalsEs.toFixed(3)),
          proj_goals_pp: Number(teamTotals.goalsPp.toFixed(3)),
          proj_goals_pk: null,
          uncertainty: buildTeamUncertainty({
            toiEsSeconds: teamTotals.toiEsSeconds,
            toiPpSeconds: teamTotals.toiPpSeconds,
            shotsEs: teamTotals.shotsEs,
            shotsPp: teamTotals.shotsPp,
            goalsEs: teamTotals.goalsEs,
            goalsPp: teamTotals.goalsPp
          }),
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
          Number(teamTotals.goalsEs + teamTotals.goalsPp)
        );

        // Goalie: pick the highest probability starter from goalie_start_projections if available.
        const goalieOverride = goalieOverrideByTeamId.get(teamId);
        const { data: goalieStarts, error: gsErr } = await supabase
          .from("goalie_start_projections")
          .select("player_id,start_probability,confirmed_status,l10_start_pct")
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
        const context = teamGoalieStarterContextCache.get(
          teamId
        ) as TeamGoalieStarterContext;
        const currentTeamGoalieIds = currentTeamGoalieIdsCache.get(teamId) as Set<number>;

        const priorStartProbByGoalieId = new Map<number, number>();
        const confirmedStarterByGoalieId = new Map<number, boolean>();
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
        }

        const contextGoalies = Array.from(context.startsByGoalie.keys()).slice(0, 4);
        const rawCandidateGoalieIds = Array.from(
          new Set(
            [
              goalieOverride?.goalieId ?? null,
              ...(goalieStarts ?? []).map((r: any) => Number(r.player_id)),
              ...(lc.goalies ?? []),
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
        const baseShotsAgainst = Number(Math.max(0, blendedShotsAgainst).toFixed(3));
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
        contextPct = clamp(contextPct, -0.15, 0.2);

        const shotsAgainst = Number(
          Math.max(0, baseShotsAgainst * (1 + contextPct)).toFixed(3)
        );
        const leagueSavePct = clamp(0.9 - contextPct * 0.04, 0.88, 0.92);

        let selectedGoalieId: number | null = null;
        let starterProb = 0.5;
        let starterModelMeta: any = {};
        if (c.override) {
          selectedGoalieId = c.override.goalieId;
          starterProb = c.override.starterProb;
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
            ]
          };
        } else {
          const starterContext =
            teamGoalieStarterContextCache.get(c.teamId) ??
            (await fetchTeamGoalieStarterContext(c.teamId, asOfDate));
          teamGoalieStarterContextCache.set(c.teamId, starterContext);
          const opponentGoalsFor = teamGoalsByTeamId.get(c.opponentTeamId) ?? 0;
          const teamIsWeaker =
            teamGoalsFor + TEAM_STRENGTH_WEAKER_GAP < opponentGoalsFor;
          const opponentIsWeak = opponentGoalsFor <= WEAK_OPPONENT_GF_THRESHOLD;
          const isB2B =
            starterContext.previousGameDate != null &&
            daysBetweenDates(asOfDate, starterContext.previousGameDate) === 1;
          const probs = computeStarterProbabilities({
            asOfDate,
            candidateGoalieIds: c.candidateGoalieIds,
            starterContext,
            priorStartProbByGoalieId: c.priorStartProbByGoalieId,
            teamGoalsFor,
            opponentGoalsFor
          });
          const ranked = Array.from(probs.entries()).sort((a, b) => b[1] - a[1]);
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
              l10_starts: starterContext.startsByGoalie.get(goalieId) ?? 0
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
        const evidence = goalieEvidenceCache.get(selectedGoalieId) as GoalieEvidence;
        const workload = goalieWorkloadContextCache.get(
          selectedGoalieId
        ) as GoalieWorkloadContext;
        let workloadSavePctPenalty = 0;
        if (workload.startsLast14Days >= 6) {
          workloadSavePctPenalty += GOALIE_VERY_HEAVY_WORKLOAD_PENALTY;
        } else if (workload.startsLast14Days >= 5) {
          workloadSavePctPenalty += GOALIE_HEAVY_WORKLOAD_PENALTY;
        }
        if (workload.isGoalieBackToBack) {
          workloadSavePctPenalty += GOALIE_BACK_TO_BACK_PENALTY;
        }
        const adjustedLeagueSavePct = clamp(
          leagueSavePct - workloadSavePctPenalty,
          0.86,
          0.92
        );
        const goalieModel = computeGoalieProjectionModel({
          projectedShotsAgainst: shotsAgainst,
          starterProbability: starterProb,
          projectedGoalsFor: teamGoalsFor,
          evidence,
          leagueSavePct: adjustedLeagueSavePct
        });

        const goalsAllowed = goalieModel.projectedGoalsAllowed;
        const saves = goalieModel.projectedSaves;
        const winProb = goalieModel.winProbability;
        const shutoutProb = goalieModel.shutoutProbability;
        const goalieUncertainty = {
          ...buildGoalieUncertainty({
            shotsAgainst,
            goalsAllowed,
            saves
          }),
          model: {
            save_pct: Number(goalieModel.modeledSavePct.toFixed(4)),
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
              baseline_shots: evidence.baselineShotsAgainst
            },
            workload_context: {
              starts_last_7_days: workload.startsLast7Days,
              starts_last_14_days: workload.startsLast14Days,
              days_since_last_start: workload.daysSinceLastStart,
              goalie_back_to_back: workload.isGoalieBackToBack,
              workload_save_pct_penalty: Number(workloadSavePctPenalty.toFixed(4)),
              league_save_pct_used: Number(adjustedLeagueSavePct.toFixed(4))
            },
            starter_selection: starterModelMeta
          }
        };

        const goalieUpsert = {
          run_id: runId,
          as_of_date: asOfDate,
          horizon_games: 1,
          game_id: game.id,
          goalie_id: selectedGoalieId,
          team_id: c.teamId,
          opponent_team_id: c.opponentTeamId,
          starter_probability: Number(starterProb.toFixed(4)),
          proj_shots_against: shotsAgainst,
          proj_goals_allowed: Number(goalsAllowed.toFixed(3)),
          proj_saves: Number(saves.toFixed(3)),
          proj_win_prob: Number(winProb.toFixed(4)),
          proj_shutout_prob: Number(shutoutProb.toFixed(4)),
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
