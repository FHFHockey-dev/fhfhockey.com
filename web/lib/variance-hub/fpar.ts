// lib/variance-hub/fpar.ts

import {
  FantasyScoringConfig,
  LeagueConfig,
  PlayerFantasyStats,
  DEFAULT_SCORING_CONFIG,
  DEFAULT_LEAGUE_CONFIG
} from "./types";
import { getPlayerFantasyStats } from "./core";

// Types for FPAR calculations
export interface ReplacementPlayerData {
  position: string;
  replacement_rank: number;
  replacement_fppg: number;
  replacement_player_id?: number;
  replacement_player_name?: string;
}

export interface FPARResult extends PlayerFantasyStats {
  replacement_fppg: number;
  fpar_total: number;
  fpar_per_game: number;
  replacement_rank: number;
}

/**
 * Calculate replacement player FPPG for each position based on league configuration
 */
export function calculateReplacementPlayers(
  playerStats: PlayerFantasyStats[],
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): ReplacementPlayerData[] {
  const replacementData: ReplacementPlayerData[] = [];

  // Group players by position
  const playersByPosition = playerStats.reduce(
    (acc, player) => {
      const position = player.position_code;
      if (!acc[position]) {
        acc[position] = [];
      }
      acc[position].push(player);
      return acc;
    },
    {} as Record<string, PlayerFantasyStats[]>
  );

  // Calculate replacement rank for each position
  Object.entries(leagueConfig.position_slots).forEach(
    ([position, slotsPerTeam]) => {
      if (position === "BENCH") return; // Skip bench slots for now

      const positionPlayers = playersByPosition[position] || [];

      if (positionPlayers.length === 0) {
        console.warn(`No players found for position ${position}`);
        return;
      }

      // Sort by FPPG descending
      positionPlayers.sort(
        (a, b) => b.fantasy_points_per_game - a.fantasy_points_per_game
      );

      // Calculate replacement rank
      // Example: 12 teams × 2 centers = 24 starters, so 25th ranked center is replacement
      const startersCount = leagueConfig.num_teams * slotsPerTeam;
      const replacementRank = startersCount + 1;

      if (positionPlayers.length >= replacementRank) {
        const replacementPlayer = positionPlayers[replacementRank - 1]; // Array is 0-indexed

        replacementData.push({
          position,
          replacement_rank: replacementRank,
          replacement_fppg: replacementPlayer.fantasy_points_per_game,
          replacement_player_id: replacementPlayer.player_id,
          replacement_player_name: replacementPlayer.player_name
        });
      } else {
        // Not enough players at this position - use the worst available player
        const worstPlayer = positionPlayers[positionPlayers.length - 1];

        replacementData.push({
          position,
          replacement_rank: positionPlayers.length,
          replacement_fppg: worstPlayer.fantasy_points_per_game,
          replacement_player_id: worstPlayer.player_id,
          replacement_player_name: worstPlayer.player_name
        });
      }
    }
  );

  return replacementData;
}

/**
 * Calculate FPAR (Fantasy Points Above Replacement) for all players
 */
export async function calculateFPAR(
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG,
  minGamesPlayed: number = 10
): Promise<FPARResult[]> {
  try {
    console.log(`Calculating FPAR for season ${season}...`);

    // Get all player fantasy stats
    const playerStats = await getPlayerFantasyStats(
      season,
      scoringConfig,
      minGamesPlayed
    );

    if (playerStats.length === 0) {
      console.warn("No player stats found for FPAR calculation");
      return [];
    }

    // Calculate replacement players for each position
    const replacementData = calculateReplacementPlayers(
      playerStats,
      leagueConfig
    );

    // Create a lookup map for replacement FPPG by position
    const replacementLookup = replacementData.reduce(
      (acc, replacement) => {
        acc[replacement.position] = replacement;
        return acc;
      },
      {} as Record<string, ReplacementPlayerData>
    );

    // Calculate FPAR for each player
    const fparResults: FPARResult[] = playerStats.map((player) => {
      const positionReplacement = replacementLookup[player.position_code];

      if (!positionReplacement) {
        console.warn(
          `No replacement data found for position ${player.position_code}`
        );
        return {
          ...player,
          replacement_fppg: 0,
          fpar_total: player.fantasy_points_total,
          fpar_per_game: player.fantasy_points_per_game,
          replacement_rank: 0
        };
      }

      // FPAR = (Player FPPG - Replacement FPPG) × Games Played
      const fparPerGame =
        player.fantasy_points_per_game - positionReplacement.replacement_fppg;
      const fparTotal = fparPerGame * player.games_played;

      return {
        ...player,
        replacement_fppg: positionReplacement.replacement_fppg,
        fpar_total: Math.round(fparTotal * 100) / 100,
        fpar_per_game: Math.round(fparPerGame * 100) / 100,
        replacement_rank: positionReplacement.replacement_rank
      };
    });

    // Sort by FPAR total descending
    fparResults.sort((a, b) => b.fpar_total - a.fpar_total);

    console.log(`FPAR calculation completed for ${fparResults.length} players`);
    console.log("Replacement players by position:", replacementData);

    return fparResults;
  } catch (error) {
    console.error("Error calculating FPAR:", error);
    throw error;
  }
}

/**
 * Get FPAR results for specific players
 */
export async function getFPARForPlayers(
  playerIds: number[],
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): Promise<FPARResult[]> {
  try {
    // Get full FPAR results
    const allFparResults = await calculateFPAR(
      season,
      scoringConfig,
      leagueConfig
    );

    // Filter to requested players
    const requestedResults = allFparResults.filter((result) =>
      playerIds.includes(result.player_id)
    );

    return requestedResults;
  } catch (error) {
    console.error("Error getting FPAR for specific players:", error);
    throw error;
  }
}

/**
 * Get top N players by FPAR
 */
export async function getTopPlayersByFPAR(
  limit: number = 50,
  season: string = "20242025",
  position?: string,
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): Promise<FPARResult[]> {
  try {
    // Get full FPAR results
    const allFparResults = await calculateFPAR(
      season,
      scoringConfig,
      leagueConfig
    );

    // Filter by position if specified
    let filteredResults = allFparResults;
    if (position) {
      filteredResults = allFparResults.filter(
        (result) => result.position_code === position
      );
    }

    // Return top N players
    return filteredResults.slice(0, limit);
  } catch (error) {
    console.error("Error getting top players by FPAR:", error);
    throw error;
  }
}
