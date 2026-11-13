import supabase from "lib/supabase/server";
import { fetchRecentTeamLineCombinations } from "lib/projections/queries/line-combo-queries";
import type { GoalieEvidence } from "lib/projections/goalieModel";
import { LINE_COMBO_RECENCY_DECAY } from "../constants/projection-weights";
import type {
  GoalieGameHistoryRow,
  GoalieRestSplitProfile,
  GoalieWorkloadContext,
  LineCombinationWithGameDateRow,
  OpponentGoalieContext,
  TeamGoalieStarterContext
} from "../types/run-forge-projections.types";
import { daysBetweenDates } from "../utils/date-utils";
import { clamp, safeNumber, safeStdDev } from "../utils/number-utils";
import { toFiniteNumberArray } from "../utils/collection-utils";
import { resolveOfficialStarter } from "../goalie/historyLedger";

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

export async function fetchTeamLineComboGoaliePrior(
  teamId: number,
  asOfDate: string
): Promise<Map<number, number>> {
  let rows: LineCombinationWithGameDateRow[];
  try {
    rows = await fetchRecentTeamLineCombinations({
      teamId,
      asOfDate,
      limit: 12
    });
  } catch (error) {
    console.warn(
      `Error fetching line-combo goalie prior for team ${teamId} before ${asOfDate}:`,
      error
    );
    return new Map();
  }
  if (rows.length === 0) return new Map();
  const weightedByGoalie = new Map<number, number>();
  let totalWeight = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const goalies = toFiniteNumberArray(row.goalies);
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

export async function fetchLatestGoalieForTeam(
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
    .maybeSingle<{ goalie_id: number | null }>();
  if (error) {
    console.warn(
      `Error fetching latest goalie game for team ${teamId} before ${asOfDate}:`,
      error
    );
    return null;
  }
  const goalieId = data?.goalie_id;
  return Number.isFinite(goalieId) ? Number(goalieId) : null;
}

/** Starter context with each history kept apart (W1-5): credited starts, appearances and unknown labels. */
export type CreditedStarterContext = TeamGoalieStarterContext & {
  /** Last credited start (official games_started = 1) per goalie. */
  lastCreditedStartDateByGoalie: Map<number, string>;
  /** Team-games in the L10 window whose credited starter is unknown (label missing or contradictory). */
  unknownStartGames: number;
  /** Completed team-games in the L10 window, known or not; totalGames counts only the known ones. */
  windowGames: number;
  startLabelSource: "wgo_goalie_stats.games_started";
};

type CreditedStartLabel = { gameId: number; gameDate: string; starterGoalieId: number | null };

/**
 * One official credited-start label per completed team-game, keyed by game id (W1-5, decision 40).
 * The starter is the single appearing goalie with games_started = 1. No such goalie, or more than
 * one, is unknown: never the first row or the most minutes (a starter pulled at 600 s is still the
 * credited starter over a reliever at 3,000 s).
 */
export function creditedStartLabels(
  appearances: Array<{ game_id: number | null; game_date: string | null; goalie_id: number | null }>,
  labels: Array<{ game_id: number | null; goalie_id: number | null; games_started: number | null }>
): CreditedStartLabel[] {
  const started = new Map<string, boolean | null>();
  for (const row of labels) {
    if (!Number.isFinite(row.game_id) || !Number.isFinite(row.goalie_id)) continue;
    const key = `${row.game_id}:${row.goalie_id}`;
    started.set(key, started.has(key) ? null : row.games_started === 1 ? true : row.games_started === 0 ? false : null);
  }
  const byGame = new Map<number, { gameDate: string; goalieIds: Set<number> }>();
  for (const row of appearances) {
    if (!Number.isFinite(row.game_id) || !Number.isFinite(row.goalie_id) || !row.game_date) continue;
    const game = byGame.get(Number(row.game_id)) ?? { gameDate: row.game_date, goalieIds: new Set<number>() };
    game.goalieIds.add(Number(row.goalie_id));
    byGame.set(Number(row.game_id), game);
  }
  return [...byGame.entries()]
    .map(([gameId, game]) => {
      const starterGoalieId = resolveOfficialStarter([...game.goalieIds].map(goalieId => ({
        goalieId, started: started.get(`${gameId}:${goalieId}`) ?? null
      })));
      return { gameId, gameDate: game.gameDate, starterGoalieId };
    })
    .sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
}

export async function fetchTeamGoalieStarterContext(
  teamId: number,
  asOfDate: string
): Promise<CreditedStarterContext> {
  assertSupabase();
  const [goalieGamesRes, previousTeamGameRes] = await Promise.all([
    supabase
      .from("forge_goalie_game")
      .select("game_id,game_date,goalie_id")
      .eq("team_id", teamId)
      .lt("game_date", asOfDate)
      .order("game_date", { ascending: false })
      .limit(80),
    supabase
      .from("games")
      .select("id,date")
      .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
      .lt("date", asOfDate)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (goalieGamesRes.error) throw goalieGamesRes.error;
  if (previousTeamGameRes.error) throw previousTeamGameRes.error;

  const appearances = (goalieGamesRes.data ?? []) as Array<{ game_id: number | null; game_date: string | null; goalie_id: number | null }>;
  const gameIds = [...new Set(appearances.map((row) => Number(row.game_id)).filter(Number.isFinite))];
  const goalieIds = [...new Set(appearances.map((row) => Number(row.goalie_id)).filter(Number.isFinite))];
  let labelRows: Array<{ game_id: number | null; goalie_id: number | null; games_started: number | null }> = [];
  if (gameIds.length > 0) {
    const labelsRes = await supabase
      .from("wgo_goalie_stats")
      .select("game_id,goalie_id,games_started")
      .in("game_id", gameIds)
      .in("goalie_id", goalieIds);
    if (labelsRes.error) throw labelsRes.error;
    labelRows = (labelsRes.data ?? []) as typeof labelRows;
  }
  const games = creditedStartLabels(appearances, labelRows);

  const window = games.slice(0, 10);
  const startsByGoalie = new Map<number, number>();
  let knownGames = 0;
  for (const game of window) {
    if (game.starterGoalieId == null) continue;
    knownGames += 1;
    startsByGoalie.set(game.starterGoalieId, (startsByGoalie.get(game.starterGoalieId) ?? 0) + 1);
  }
  const lastCreditedStartDateByGoalie = new Map<number, string>();
  for (const game of games) {
    if (game.starterGoalieId != null && !lastCreditedStartDateByGoalie.has(game.starterGoalieId)) {
      lastCreditedStartDateByGoalie.set(game.starterGoalieId, game.gameDate);
    }
  }
  // Staleness reads the last appearance (start or relief), which is what "played" means.
  const lastPlayedDateByGoalie = new Map<number, string>();
  for (const row of [...appearances].sort((a, b) => String(b.game_date).localeCompare(String(a.game_date)))) {
    const goalieId = Number(row.goalie_id);
    if (Number.isFinite(goalieId) && row.game_date && !lastPlayedDateByGoalie.has(goalieId)) {
      lastPlayedDateByGoalie.set(goalieId, row.game_date);
    }
  }

  const previousGame = previousTeamGameRes.data as { id?: number | null; date?: string | null } | null;
  const previousGameDate = previousGame?.date ?? null;
  // The previous team game by game id; an unknown label stays unknown (no B2B starter assumed).
  const previousGameStarterGoalieId =
    previousGame?.id != null
      ? (games.find((game) => game.gameId === Number(previousGame.id))?.starterGoalieId ?? null)
      : null;

  return {
    startsByGoalie,
    lastPlayedDateByGoalie,
    lastCreditedStartDateByGoalie,
    totalGames: knownGames,
    windowGames: window.length,
    unknownStartGames: window.length - knownGames,
    previousGameDate,
    previousGameStarterGoalieId,
    startLabelSource: "wgo_goalie_stats.games_started"
  };
}

export async function fetchCurrentTeamGoalieIds(
  teamId: number
): Promise<Set<number>> {
  assertSupabase();
  const { data, error } = await supabase
    .from("players")
    .select("id")
    .eq("team_id", teamId)
    .eq("position", "G");
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => Number(r.id)).filter((n) => Number.isFinite(n)));
}

export async function fetchGoalieWorkloadContext(
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

export async function fetchGoalieRestSplitProfile(
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
    // Pregame: a row dated on the slate already contains that night's game (rule 25).
    .lt("date", asOfDate)
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

export async function fetchGoalieEvidence(
  goalieId: number,
  asOfDate: string,
  /** The season's league save % (decision 10); null leaves the residual spread unknown. */
  leagueSavePct: number | null
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
      .lt("date", asOfDate)
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

  // Per-game residual against the season's league save % (decision 10), not a fixed .900.
  const residuals = leagueSavePct == null ? [] : recentRows.map((row) => {
    const shots = safeNumber(row.shots_against, 0);
    const goals = safeNumber(row.goals_allowed, 0);
    const expectedGoals = shots * (1 - leagueSavePct);
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

export async function fetchOpponentGoalieContextForGame(args: {
  gameId: number;
  opponentTeamId: number;
  confirmedGoalieId?: number;
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

  const rows = ((data ?? []) as Array<any>).filter((row) => args.confirmedGoalieId == null || row.player_id === args.confirmedGoalieId)
    .map((row) => args.confirmedGoalieId == null ? row : { ...row, start_probability: 1, confirmed_status: true });
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
    const gsaa = row?.projected_gsaa_per_60 == null ? null : Number(row.projected_gsaa_per_60);
    if (gsaa != null && Number.isFinite(gsaa)) {
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
