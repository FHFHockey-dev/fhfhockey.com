// /lib/NHL/statsPageFetch.ts

import supabase from "lib/supabase";
import { getCurrentSeason } from "lib/NHL/server";
import {
  fetchAllSupabaseFilterChunks,
  fetchAllSupabasePages
} from "lib/supabase/pagination";
import { SkaterStat, GoalieStat } from "./statsPageTypes";

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

function formatSeasonLabel(seasonId: number | string | null | undefined) {
  const season = String(seasonId ?? "");
  if (!/^\d{8}$/.test(season)) return "Season";
  return `${season.slice(0, 4)}-${season.slice(6, 8)}`;
}

export async function fetchStatsData(): Promise<{
  skaterSeasonLabel: string;
  goalieSeasonLabel: string;
  pointsLeaders: SkaterStat[];
  goalsLeaders: SkaterStat[];
  pppLeaders: SkaterStat[];
  bshLeaders: SkaterStat[];
  goalieLeadersWins: GoalieStat[];
  goalieLeadersSavePct: GoalieStat[];
  goalieLeadersGAA: GoalieStat[];
  goalieLeadersQS: GoalieStat[];
}> {
  const currentSeason = await getCurrentSeason();
  const skaterSeasonLabel = formatSeasonLabel(currentSeason.seasonId);
  let goalieSeasonLabel = skaterSeasonLabel;

  let skaterData: any[];
  try {
    skaterData = await fetchAllSupabasePages<any>(({ from, to }) =>
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
  } catch (skaterError) {
    console.error("Error fetching skater stats:", skaterError);
    return {
      skaterSeasonLabel,
      goalieSeasonLabel,
      pointsLeaders: [],
      goalsLeaders: [],
      pppLeaders: [],
      bshLeaders: [],
      goalieLeadersWins: [],
      goalieLeadersSavePct: [],
      goalieLeadersGAA: [],
      goalieLeadersQS: []
    };
  }

  // Fetch player info for skaters
  const playerIds = Array.from(
    new Set(skaterData.map((row: any) => row.player_id))
  );
  let playersData: any[] = [];
  try {
    playersData = await fetchAllSupabaseFilterChunks<any, number>(
      playerIds,
      (idChunk, { from, to }) =>
        supabase
          .from("players")
          .select("id, sweater_number, position, image_url")
          .in("id", idChunk)
          .order("id", { ascending: true })
          .range(from, to)
    );
  } catch (playersError) {
    console.error("Error fetching player info:", playersError);
  }
  const playersMap = new Map<number, any>();
  playersData.forEach((p: any) => playersMap.set(p.id, p));

  const skaters: SkaterStat[] = skaterData.map((row: any) => {
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

  const pointsLeaders = [...skaters]
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);
  const goalsLeaders = [...skaters]
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 5);
  const pppLeaders = [...skaters]
    .sort((a, b) => b.pp_points - a.pp_points)
    .slice(0, 5);
  const bshLeaders = [...skaters].sort((a, b) => b.bsh - a.bsh).slice(0, 5);

  // --- Fetch Goalie Stats (including games_played) ---
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
    console.error("Error fetching goalie stats:", goalieError);
    return {
      skaterSeasonLabel,
      goalieSeasonLabel,
      pointsLeaders,
      goalsLeaders,
      pppLeaders,
      bshLeaders,
      goalieLeadersWins: [],
      goalieLeadersSavePct: [],
      goalieLeadersGAA: [],
      goalieLeadersQS: []
    };
  }

  const goalieSeasonId = goalieData[0]?.season_id ?? currentSeason.seasonId;
  goalieSeasonLabel = formatSeasonLabel(goalieSeasonId);

  // Fetch player info for goalies
  const goalieIds = Array.from(
    new Set(goalieData.map((row: any) => row.goalie_id))
  );
  let goaliePlayersData: any[] = [];
  try {
    goaliePlayersData = await fetchAllSupabaseFilterChunks<any, number>(
      goalieIds,
      (idChunk, { from, to }) =>
        supabase
          .from("players")
          .select("id, image_url, sweater_number")
          .in("id", idChunk)
          .order("id", { ascending: true })
          .range(from, to)
    );
  } catch (goaliePlayersError) {
    console.error("Error fetching goalie player info:", goaliePlayersError);
  }
  const goaliePlayersMap = new Map<number, any>();
  goaliePlayersData.forEach((p: any) => goaliePlayersMap.set(p.id, p));

  // Determine minimum games played threshold
  const latestStandingsDate = await supabase
    .from("nhl_standings_details")
    .select("date")
    .eq("season_id", currentSeason.seasonId)
    .order("date", { ascending: false })
    .limit(1);

  let standingsData: any[] = [];
  let standingsError: unknown = latestStandingsDate.error;
  const latestDate = latestStandingsDate.data?.[0]?.date;
  if (!standingsError && latestDate) {
    try {
      standingsData = await fetchAllSupabasePages<any>(({ from, to }) =>
        supabase
          .from("nhl_standings_details")
          .select("date, team_abbrev, games_played")
          .eq("season_id", currentSeason.seasonId)
          .eq("date", latestDate)
          .order("team_abbrev", { ascending: true })
          .range(from, to)
      );
    } catch (error) {
      standingsError = error;
    }
  }

  let minGamesThreshold = 0;
  if (!standingsError && standingsData.length > 0) {
    const totalGames = standingsData.reduce(
      (sum: number, row: any) => sum + (row.games_played || 0),
      0
    );
    const avgGames = totalGames / standingsData.length;
    if (avgGames > 10) {
      minGamesThreshold = Math.floor(avgGames * 0.25);
    }
  }

  const goalieStats: GoalieStat[] = goalieData
    .map((row: any) => ({
      goalie_id: row.goalie_id,
      fullName: row.goalie_name || "Unknown",
      current_team_abbreviation:
        row.team_abbrevs || row.current_team_abbreviation || "",
      wins: row.wins || 0,
      save_pct: row.save_pct || 0,
      goals_against_avg: row.goals_against_avg || 0,
      quality_starts_pct: row.quality_starts_pct || 0,
      games_played: row.games_played || 0,
      image_url: goaliePlayersMap.get(row.goalie_id)?.image_url || "",
      sweater_number:
        goaliePlayersMap.get(row.goalie_id)?.sweater_number || null,
      season_id: row.season_id.toString()
    }))
    .filter((goalie: GoalieStat) =>
      minGamesThreshold > 0 ? goalie.games_played >= minGamesThreshold : true
    );

  const goalieLeadersWins = [...goalieStats]
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 5);
  const goalieLeadersSavePct = [...goalieStats]
    .sort((a, b) => b.save_pct - a.save_pct)
    .slice(0, 5);
  const goalieLeadersGAA = [...goalieStats]
    .sort((a, b) => a.goals_against_avg - b.goals_against_avg)
    .slice(0, 5);
  const goalieLeadersQS = [...goalieStats]
    .sort((a, b) => b.quality_starts_pct - a.quality_starts_pct)
    .slice(0, 5);

  return {
    skaterSeasonLabel,
    goalieSeasonLabel,
    pointsLeaders,
    goalsLeaders,
    pppLeaders,
    bshLeaders,
    goalieLeadersWins,
    goalieLeadersSavePct,
    goalieLeadersGAA,
    goalieLeadersQS
  };
}
