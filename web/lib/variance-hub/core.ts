// lib/variance-hub/core.ts

import supabase from "lib/supabase";
import {
  FantasyScoringConfig,
  DEFAULT_SCORING_CONFIG,
  PlayerFantasyStats
} from "./types";

/**
 * Calculate fantasy points for a player based on their season stats
 */
export function calculateFantasyPoints(
  playerStats: any,
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG
): number {
  const goals = playerStats.goals || 0;
  const assists = playerStats.assists || 0;
  const shots = playerStats.shots || 0;
  const hits = playerStats.hits || 0;
  const blocks = playerStats.blocked_shots || 0;
  const pim = playerStats.penalty_minutes || 0;
  const plusMinus = playerStats.plus_minus || 0;
  const ppGoals = playerStats.pp_goals || 0;
  const ppAssists = playerStats.pp_assists || 0;
  const shGoals = playerStats.sh_goals || 0;
  const shAssists = playerStats.sh_assists || 0;

  let fantasyPoints =
    goals * scoringConfig.goals +
    assists * scoringConfig.assists +
    shots * scoringConfig.shots +
    hits * scoringConfig.hits +
    blocks * scoringConfig.blocks +
    pim * scoringConfig.penalty_minutes +
    plusMinus * scoringConfig.plus_minus +
    ppGoals * scoringConfig.pp_goals +
    ppAssists * scoringConfig.pp_assists +
    shGoals * scoringConfig.sh_goals +
    shAssists * scoringConfig.sh_assists;

  return Math.round(fantasyPoints * 100) / 100;
}

/**
 * Get all player fantasy stats for a given season
 */
export async function getPlayerFantasyStats(
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  minGamesPlayed: number = 10
): Promise<PlayerFantasyStats[]> {
  const { data: players, error } = await supabase
    .from("wgo_skater_stats_totals")
    .select(
      `player_id, player_name, position_code, games_played, goals, assists, shots, hits, blocked_shots, penalty_minutes, plus_minus, pp_goals, pp_assists, sh_goals, sh_assists`
    )
    .eq("season", season)
    .gte("games_played", minGamesPlayed);

  if (error) {
    console.error("Error fetching player stats:", error);
    throw error;
  }
  if (!players) return [];

  const playerFantasyStats: PlayerFantasyStats[] = players.map((player) => {
    const fantasyPointsTotal = calculateFantasyPoints(player, scoringConfig);
    const gamesPlayed = player.games_played || 0;
    const fantasyPointsPerGame =
      gamesPlayed > 0
        ? Math.round((fantasyPointsTotal / gamesPlayed) * 100) / 100
        : 0;

    return {
      player_id: player.player_id,
      player_name: player.player_name || `Player ${player.player_id}`,
      position_code: player.position_code || "C",
      games_played: gamesPlayed,
      fantasy_points_total: fantasyPointsTotal,
      fantasy_points_per_game: fantasyPointsPerGame
    };
  });

  return playerFantasyStats.sort(
    (a, b) => b.fantasy_points_per_game - a.fantasy_points_per_game
  );
}
