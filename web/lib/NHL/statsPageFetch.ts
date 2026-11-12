// /lib/NHL/statsPageFetch.ts

import supabase from "lib/supabase";
import { getCurrentSeason } from "lib/NHL/server";
import type { Season } from "lib/NHL/types";
import {
  DEFAULT_SUPABASE_FILTER_CHUNK_SIZE,
  fetchAllSupabasePages
} from "lib/supabase/pagination";
import { SkaterStat, GoalieStat, StatsProps, SkaterLeaderboards } from "./statsPageTypes";

const GOALIE_TOTALS_SELECT = `
  goalie_id,
  goalie_name,
  team_abbrevs,
  current_team_abbreviation,
  season_id,
  wins,
  save_pct,
  goals_against_avg,
  quality_starts_pct,
  games_played
`;

// Player identity lookups, chunked to keep URLs short; chunks run together.
async function fetchPlayersByIds(ids: number[], columns: string) {
  const chunks: number[][] = [];
  for (let index = 0; index < ids.length; index += DEFAULT_SUPABASE_FILTER_CHUNK_SIZE) {
    chunks.push(ids.slice(index, index + DEFAULT_SUPABASE_FILTER_CHUNK_SIZE));
  }
  const pages = await Promise.all(
    chunks.map((idChunk) =>
      fetchAllSupabasePages<any>(({ from, to }) =>
        supabase
          .from("players")
          .select(columns)
          .in("id", idChunk)
          .order("id", { ascending: true })
          .range(from, to)
      )
    )
  );
  return pages.flat();
}

function formatSeasonLabel(seasonId: number | string | null | undefined) {
  const season = String(seasonId ?? "");
  if (!/^\d{8}$/.test(season)) return "Season";
  return `${season.slice(0, 4)}-${season.slice(6, 8)}`;
}

function goalieRatio(value: unknown, maximum = Infinity): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum
    ? value
    : null;
}

export const LEADERBOARD_SIZE = 5;

/**
 * Tie policy (decision 89, rule 20): the top five by value, plus every row
 * tied with the fifth value, so no tied player is dropped by input order.
 * Within a tie rows are listed by name, then id; tied rows share a rank.
 */
export function topWithTies<T>(
  rows: T[],
  value: (row: T) => number,
  direction: "desc" | "asc",
  identity: (row: T) => { name: string; id: number },
  size = LEADERBOARD_SIZE
): T[] {
  const sign = direction === "desc" ? -1 : 1;
  const sorted = [...rows].sort((a, b) => {
    const byValue = sign * (value(a) - value(b));
    if (byValue !== 0) return byValue;
    const left = identity(a);
    const right = identity(b);
    return left.name.localeCompare(right.name) || left.id - right.id;
  });
  if (sorted.length <= size) return sorted;
  const cut = value(sorted[size - 1]);
  return sorted.filter((row, index) => index < size || value(row) === cut);
}

const skaterIdentity = (row: SkaterStat) => ({ name: row.fullName, id: row.player_id });
const goalieIdentity = (row: GoalieStat) => ({ name: row.fullName, id: row.goalie_id });

function buildSkaterLeaderboards(skaters: SkaterStat[]): SkaterLeaderboards {
  const top = (value: (row: SkaterStat) => number) =>
    topWithTies(skaters, value, "desc", skaterIdentity);
  return {
    pointsLeaders: top((row) => row.points),
    goalsLeaders: top((row) => row.goals),
    pppLeaders: top((row) => row.pp_points),
    bshLeaders: top((row) => row.bsh)
  };
}

/**
 * Goalie qualifier (decision 89): appearances of at least a quarter of the
 * mean team games played, from the standings of the season the boards show.
 * Unknown when standings cannot be read; then rate leaders are withheld.
 */
export type GoalieQualifier =
  | { status: "known"; seasonId: number; minGames: number; meanTeamGames: number }
  | { status: "unknown"; seasonId: number };

export function describeGoalieQualifier(qualifier: GoalieQualifier): string {
  return qualifier.status === "known"
    ? `Rate leaders: min. ${qualifier.minGames} GP (a quarter of the ${qualifier.meanTeamGames.toFixed(1)}-game average team GP)`
    : "Qualifier unknown (standings unavailable): rate leaders withheld";
}

export type StatsPageData = StatsProps & { goalieQualifier: GoalieQualifier };

async function loadGoalieQualifier(seasonId: number): Promise<GoalieQualifier> {
  const unknown: GoalieQualifier = { status: "unknown", seasonId };
  const latestStandingsDate = await supabase
    .from("nhl_standings_details")
    .select("date")
    .eq("season_id", seasonId)
    .order("date", { ascending: false })
    .limit(1);
  const latestDate = latestStandingsDate.data?.[0]?.date;
  if (latestStandingsDate.error || !latestDate) return unknown;

  let standingsData: any[];
  try {
    standingsData = await fetchAllSupabasePages<any>(({ from, to }) =>
      supabase
        .from("nhl_standings_details")
        .select("date, team_abbrev, games_played")
        .eq("season_id", seasonId)
        .eq("date", latestDate)
        .order("team_abbrev", { ascending: true })
        .range(from, to)
    );
  } catch {
    return unknown;
  }
  if (standingsData.length === 0) return unknown;
  let totalGames = 0;
  for (const row of standingsData) {
    const games = row.games_played;
    if (typeof games !== "number" || !Number.isFinite(games) || games < 0) return unknown;
    totalGames += games;
  }
  const meanTeamGames = totalGames / standingsData.length;
  return {
    status: "known",
    seasonId,
    minGames: Math.floor(meanTeamGames * 0.25),
    meanTeamGames
  };
}

export async function fetchStatsData(season?: Season): Promise<StatsPageData> {
  const currentSeason = season ?? (await getCurrentSeason());
  const skaterSeasonLabel = formatSeasonLabel(currentSeason.seasonId);
  let goalieSeasonLabel = skaterSeasonLabel;

  // Skaters, goalies and the goalie qualification threshold are independent
  // reads; run the three pipelines together.
  const loadSkaters = async (): Promise<SkaterStat[]> => {
    const skaterData = await fetchAllSupabasePages<any>(({ from, to }) =>
      supabase
        .from("wgo_skater_stats_totals")
        .select(
          `
          player_id,
          player_name,
          current_team_abbreviation,
          points,
          goals,
          pp_points,
          blocked_shots,
          shots,
          hits,
          total_primary_assists,
          total_secondary_assists,
          pp_goals,
          pp_primary_assists,
          pp_secondary_assists,
          sh_goals
          `
        )
        .eq("season", String(currentSeason.seasonId))
        .order("player_id", { ascending: true })
        .range(from, to)
    );

    // Fetch player info for skaters
    const playerIds = Array.from(
      new Set(skaterData.map((row: any) => row.player_id))
    );
    let playersData: any[] = [];
    try {
      playersData = await fetchPlayersByIds(
        playerIds,
        "id, sweater_number, position, image_url"
      );
    } catch (playersError) {
      console.error("Error fetching player info:", playersError);
    }
    const playersMap = new Map<number, any>();
    playersData.forEach((p: any) => playersMap.set(p.id, p));

    return skaterData.map((row: any) => {
      const playerInfo = playersMap.get(row.player_id);
      const bsh = (row.blocked_shots || 0) + (row.shots || 0) + (row.hits || 0);
      return {
        player_id: row.player_id,
        fullName: row.player_name ?? "Unknown",
        current_team_abbreviation: row.current_team_abbreviation ?? "",
        points: row.points ?? 0,
        goals: row.goals ?? 0,
        pp_points: row.pp_points ?? 0,
        blocked_shots: row.blocked_shots ?? 0,
        shots: row.shots ?? 0,
        hits: row.hits ?? 0,
        bsh,
        total_primary_assists: row.total_primary_assists ?? 0,
        total_secondary_assists: row.total_secondary_assists ?? 0,
        pp_goals: row.pp_goals ?? 0,
        sh_goals: row.sh_goals ?? 0,
        pp_primary_assists: row.pp_primary_assists ?? 0,
        pp_secondary_assists: row.pp_secondary_assists ?? 0,
        image_url: playerInfo?.image_url || "",
        sweater_number: playerInfo?.sweater_number,
        position: playerInfo?.position
      };
    });
  };

  const loadGoalies = async () => {
    let goalieData: any[] = [];
    let goalieError: unknown = null;
    try {
      goalieData = await fetchAllSupabasePages<any>(({ from, to }) =>
        supabase
          .from("wgo_goalie_stats_totals")
          .select(GOALIE_TOTALS_SELECT)
          .eq("season_id", currentSeason.seasonId)
          .order("goalie_id", { ascending: true })
          .range(from, to)
      );
    } catch (error) {
      goalieError = error;
    }

    if (!goalieError && goalieData.length === 0) {
      const fallbackSeason = await supabase
        .from("wgo_goalie_stats_totals")
        .select("season_id")
        .lte("season_id", currentSeason.seasonId)
        .order("season_id", { ascending: false })
        .limit(1);

      if (fallbackSeason.error) {
        goalieError = fallbackSeason.error;
      } else {
        const fallbackSeasonId = fallbackSeason.data?.[0]?.season_id;
        if (fallbackSeasonId != null) {
          try {
            goalieData = await fetchAllSupabasePages<any>(({ from, to }) =>
              supabase
                .from("wgo_goalie_stats_totals")
                .select(GOALIE_TOTALS_SELECT)
                .eq("season_id", fallbackSeasonId)
                .order("goalie_id", { ascending: true })
                .range(from, to)
            );
          } catch (error) {
            goalieError = error;
          }
        }
      }
    }

    if (goalieError) {
      return { goalieData, goalieError, goaliePlayersMap: new Map<number, any>() };
    }

    // Fetch player info for goalies
    const goalieIds = Array.from(
      new Set(goalieData.map((row: any) => row.goalie_id))
    );
    let goaliePlayersData: any[] = [];
    try {
      goaliePlayersData = await fetchPlayersByIds(
        goalieIds,
        "id, image_url, sweater_number"
      );
    } catch (goaliePlayersError) {
      console.error("Error fetching goalie player info:", goaliePlayersError);
    }
    const goaliePlayersMap = new Map<number, any>();
    goaliePlayersData.forEach((p: any) => goaliePlayersMap.set(p.id, p));
    return { goalieData, goalieError, goaliePlayersMap };
  };

  const currentQualifier = loadGoalieQualifier(Number(currentSeason.seasonId)).catch(
    (): GoalieQualifier => ({ status: "unknown", seasonId: Number(currentSeason.seasonId) })
  );
  const [skaterResult, goalieResult] = await Promise.all([
    loadSkaters().then(
      (skaters) => ({ skaters, error: null as unknown }),
      (error: unknown) => ({ skaters: [] as SkaterStat[], error })
    ),
    loadGoalies()
  ]);

  if (skaterResult.error) {
    console.error("Error fetching skater stats:", skaterResult.error);
    return {
      goalieQualifier: await currentQualifier,
      skaterSeasonLabel,
      goalieSeasonLabel,
      pointsLeaders: [],
      goalsLeaders: [],
      pppLeaders: [],
      bshLeaders: [],
      skaterLeadersByPosition: {},
      goalieLeadersWins: [],
      goalieLeadersSavePct: [],
      goalieLeadersGAA: [],
      goalieLeadersQS: []
    };
  }
  const skaters = skaterResult.skaters;

  const { pointsLeaders, goalsLeaders, pppLeaders, bshLeaders } =
    buildSkaterLeaderboards(skaters);
  // Filter the full season dataset before taking each position's top five.
  // NHL player metadata uses L/R as well as LW/RW for wings.
  const skaterLeadersByPosition = Object.fromEntries(
    ["C", "LW", "RW", "D"].map((position) => [
      position,
      buildSkaterLeaderboards(skaters.filter((skater) => {
        const code = skater.position?.trim().toUpperCase();
        return (code === "L" ? "LW" : code === "R" ? "RW" : code) === position;
      }))
    ])
  );

  const { goalieData, goalieError, goaliePlayersMap } = goalieResult;
  if (goalieError) {
    console.error("Error fetching goalie stats:", goalieError);
    return {
      goalieQualifier: await currentQualifier,
      skaterSeasonLabel,
      goalieSeasonLabel,
      pointsLeaders,
      goalsLeaders,
      pppLeaders,
      bshLeaders,
      skaterLeadersByPosition,
      goalieLeadersWins: [],
      goalieLeadersSavePct: [],
      goalieLeadersGAA: [],
      goalieLeadersQS: []
    };
  }

  const goalieSeasonId = Number(goalieData[0]?.season_id ?? currentSeason.seasonId);
  goalieSeasonLabel = formatSeasonLabel(goalieSeasonId);
  // The qualifier comes from the season the boards show (a fallback season
  // uses its own standings, not the current season's).
  const goalieQualifier =
    goalieSeasonId === Number(currentSeason.seasonId)
      ? await currentQualifier
      : await loadGoalieQualifier(goalieSeasonId).catch(
          (): GoalieQualifier => ({ status: "unknown", seasonId: goalieSeasonId })
        );

  const goalieStats: GoalieStat[] = goalieData
    .map((row: any) => ({
      goalie_id: row.goalie_id,
      fullName: row.goalie_name || "Unknown",
      current_team_abbreviation:
        row.team_abbrevs || row.current_team_abbreviation || "",
      wins: row.wins || 0,
      save_pct: goalieRatio(row.save_pct, 1),
      goals_against_avg: goalieRatio(row.goals_against_avg),
      quality_starts_pct: goalieRatio(row.quality_starts_pct, 1),
      games_played: row.games_played || 0,
      image_url: goaliePlayersMap.get(row.goalie_id)?.image_url || "",
      sweater_number:
        goaliePlayersMap.get(row.goalie_id)?.sweater_number || null,
      season_id: row.season_id.toString()
    }));

  // Known qualifier: every board uses it. Unknown: wins (a count) is shown
  // unqualified and the rate boards are withheld.
  const qualified =
    goalieQualifier.status === "known"
      ? goalieStats.filter((goalie) => goalie.games_played >= goalieQualifier.minGames)
      : goalieStats;
  const rateBoard = (
    value: (goalie: GoalieStat) => number | null,
    direction: "desc" | "asc"
  ) =>
    goalieQualifier.status === "known"
      ? topWithTies(
          qualified.filter((goalie) => goalie.games_played > 0 && value(goalie) !== null),
          (goalie) => value(goalie)!,
          direction,
          goalieIdentity
        )
      : [];

  const goalieLeadersWins = topWithTies(qualified, (goalie) => goalie.wins, "desc", goalieIdentity);
  const goalieLeadersSavePct = rateBoard((goalie) => goalie.save_pct, "desc");
  const goalieLeadersGAA = rateBoard((goalie) => goalie.goals_against_avg, "asc");
  const goalieLeadersQS = rateBoard((goalie) => goalie.quality_starts_pct, "desc");

  return {
    goalieQualifier,
    skaterSeasonLabel,
    goalieSeasonLabel,
    pointsLeaders,
    goalsLeaders,
    pppLeaders,
    bshLeaders,
    skaterLeadersByPosition,
    goalieLeadersWins,
    goalieLeadersSavePct,
    goalieLeadersGAA,
    goalieLeadersQS
  };
}
