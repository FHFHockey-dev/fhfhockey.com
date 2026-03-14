import supabase from "lib/supabase/server";
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

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

export async function fetchTeamLineComboGoaliePrior(
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

  const rows = (data ?? []) as LineCombinationWithGameDateRow[];
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

export async function fetchTeamGoalieStarterContext(
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

export async function fetchGoalieEvidence(
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

export async function fetchOpponentGoalieContextForGame(args: {
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
