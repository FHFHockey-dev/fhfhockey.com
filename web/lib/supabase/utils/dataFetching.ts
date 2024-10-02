// utils/dataFetching.ts

import supabase from "lib/supabase";
import { CombinedGameLog, PlayerGameLog } from "./types";

/**
 * Fetch the most recent season for a given player.
 *
 * @param player_id - The ID of the player
 * @returns The most recent season as a number or null if not found
 */
export const fetchMostRecentSeason = async (
  player_id: number
): Promise<number | null> => {
  const { data: seasonsData, error: seasonsError } = await supabase
    .from("sko_skater_years")
    .select("season")
    .eq("player_id", player_id)
    .order("season", { ascending: false })
    .limit(1);

  if (seasonsError || !seasonsData || seasonsData.length === 0) {
    console.error("Error fetching player's seasons:", seasonsError);
    return null;
  }

  return seasonsData[0].season;
};

/**
 * Fetch and combine game logs for a player from wgo_skater_stats and sko_skater_stats tables.
 *
 * @param player_id - The ID of the player
 * @param season_id - The season ID
 * @returns An object containing combined game logs and any error message
 */
export const fetchGameLogs = async (
  player_id: number,
  season_id: number
): Promise<{
  combinedGameLogs: CombinedGameLog[] | null;
  error: string | null;
}> => {
  try {
    // Fetch game logs from wgo_skater_stats
    const { data: wgoGameLogs, error: wgoError } = await supabase
      .from("wgo_skater_stats")
      .select("*")
      .eq("player_id", player_id)
      .eq("season_id", season_id)
      .order("date", { ascending: true });

    if (wgoError) {
      console.error("Error fetching wgo game logs:", wgoError);
      return { combinedGameLogs: null, error: "Error fetching wgo game logs." };
    }

    // Fetch game logs from sko_skater_stats
    const { data: skoGameLogs, error: skoError } = await supabase
      .from("sko_skater_stats")
      .select("*")
      .eq("player_id", player_id)
      .eq("season_id", season_id)
      .order("date", { ascending: true });

    if (skoError) {
      console.error("Error fetching sko game logs:", skoError);
      return { combinedGameLogs: null, error: "Error fetching sko game logs." };
    }

    // Combine game logs from wgo_skater_stats and sko_skater_stats if both have data
    if (
      wgoGameLogs &&
      skoGameLogs &&
      wgoGameLogs.length > 0 &&
      skoGameLogs.length > 0
    ) {
      const combinedLogs: CombinedGameLog[] = wgoGameLogs.map((wgoGame) => {
        const skoGame = skoGameLogs.find(
          (sko) =>
            new Date(sko.date).getTime() === new Date(wgoGame.date).getTime()
        );

        // Return a combined game log
        return {
          // Fields from wgo_skater_stats
          player_id: wgoGame.player_id,
          player_name: wgoGame.player_name,
          season_id: season_id, // from the passed season_id
          date: wgoGame.date,
          goals: wgoGame.goals ?? 0,
          assists: wgoGame.assists ?? 0,
          points: wgoGame.points ?? 0,
          shots: wgoGame.shots ?? 0,
          blocked_shots: wgoGame.blocked_shots ?? 0,
          hits: wgoGame.hits ?? 0,
          total_faceoffs: wgoGame.total_faceoffs ?? 0,
          total_fow: wgoGame.total_fow ?? 0,
          total_fol: wgoGame.total_fol ?? 0,
          penalties_drawn: wgoGame.penalties_drawn ?? 0,
          penalties: wgoGame.penalties ?? 0,
          penalty_minutes: wgoGame.penalty_minutes ?? 0,
          usat_for: wgoGame.usat_for ?? 0,
          usat_against: wgoGame.usat_against ?? 0,
          usat_percentage: wgoGame.usat_percentage ?? 0,
          pp_goals: wgoGame.pp_goals ?? 0,
          pp_assists: wgoGame.pp_assists ?? 0,
          pp_points: wgoGame.pp_points ?? 0,
          toi_per_game: wgoGame.toi_per_game ?? 0,
          shooting_percentage: wgoGame.shooting_percentage ?? 0,

          // Fields from sko_skater_stats
          ipp: skoGame?.ipp ?? null,
          sog_per_60: skoGame?.sog_per_60 ?? null,
          total_primary_assists: skoGame?.total_primary_assists ?? 0,
          total_secondary_assists: skoGame?.total_secondary_assists ?? 0,
          es_goals_for: skoGame?.es_goals_for ?? 0,
          pp_goals_for: skoGame?.pp_goals_for ?? 0,
          sh_goals_for: skoGame?.sh_goals_for ?? 0,
          es_goals_against: skoGame?.es_goals_against ?? 0,
          pp_goals_against: skoGame?.pp_goals_against ?? 0,
          sh_goals_against: skoGame?.sh_goals_against ?? 0,

          // Calculated fields (initialized, to be calculated later)
          gameScore: undefined,
          rollingCV: undefined,
          confidenceMultiplier: undefined,
          predictedGameScore: undefined,
        } as CombinedGameLog;
      });

      return { combinedGameLogs: combinedLogs, error: null };
    } else {
      return {
        combinedGameLogs: null,
        error: "No game logs available for this player.",
      };
    }
  } catch (err) {
    console.error("Fetch Game Logs Error:", err);
    return { combinedGameLogs: null, error: "Error fetching game logs." };
  }
};
