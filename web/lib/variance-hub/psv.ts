// lib/variance-hub/psv.ts

import {
  FantasyScoringConfig,
  LeagueConfig,
  PlayerFantasyStats,
  DEFAULT_SCORING_CONFIG,
  DEFAULT_LEAGUE_CONFIG
} from "./types";
import { getPlayerFantasyStats } from "./core";
import { calculateFPAR, FPARResult } from "./fpar";

// Types for PSV calculations
export interface PositionalDepthData {
  position: string;
  total_players: number;
  avg_fppg: number;
  median_fppg: number;
  std_dev_fppg: number;
  top_25_percent_avg: number;
  bottom_25_percent_avg: number;
  talent_depth_score: number; // Higher = more depth
  scarcity_multiplier: number; // Higher = more scarce
}

export interface PSVResult {
  player_id: number;
  player_name: string;
  position_code: string;
  games_played: number;
  fantasy_points_per_game: number;
  position_rank: number;
  position_percentile: number;
  positional_depth_score: number;
  scarcity_multiplier: number;
  psv_score: number;
  fpar_total: number; // Include FPAR for comparison
  fpar_per_game: number;
}

/**
 * Calculate positional depth and scarcity metrics
 */
export function calculatePositionalDepth(
  playerStats: PlayerFantasyStats[],
  minGamesPlayed: number = 20
): PositionalDepthData[] {
  const positionData: PositionalDepthData[] = [];

  // Group players by position
  const playersByPosition = playerStats.reduce(
    (acc, player) => {
      if (player.games_played >= minGamesPlayed) {
        const position = player.position_code;
        if (!acc[position]) {
          acc[position] = [];
        }
        acc[position].push(player);
      }
      return acc;
    },
    {} as Record<string, PlayerFantasyStats[]>
  );

  // Calculate depth metrics for each position
  Object.entries(playersByPosition).forEach(([position, players]) => {
    if (players.length === 0) return;

    // Sort by FPPG descending
    const sortedPlayers = [...players].sort(
      (a, b) => b.fantasy_points_per_game - a.fantasy_points_per_game
    );

    // Calculate basic statistics
    const fppgValues = sortedPlayers.map((p) => p.fantasy_points_per_game);
    const totalPlayers = players.length;
    const avgFppg =
      fppgValues.reduce((sum, val) => sum + val, 0) / totalPlayers;

    // Calculate median
    const medianIndex = Math.floor(totalPlayers / 2);
    const medianFppg =
      totalPlayers % 2 === 0
        ? (fppgValues[medianIndex - 1] + fppgValues[medianIndex]) / 2
        : fppgValues[medianIndex];

    // Calculate standard deviation
    const variance =
      fppgValues.reduce((sum, val) => sum + Math.pow(val - avgFppg, 2), 0) /
      totalPlayers;
    const stdDevFppg = Math.sqrt(variance);

    // Calculate quartile averages
    const q1Index = Math.floor(totalPlayers * 0.25);
    const q3Index = Math.floor(totalPlayers * 0.75);

    const top25PercentAvg =
      fppgValues.slice(0, q1Index).reduce((sum, val) => sum + val, 0) /
      Math.max(q1Index, 1);

    const bottom25PercentAvg =
      fppgValues.slice(q3Index).reduce((sum, val) => sum + val, 0) /
      Math.max(fppgValues.length - q3Index, 1);

    // Calculate talent depth score
    // Higher score = more depth (more consistent talent throughout position)
    const talentDepthScore = calculateTalentDepthScore(
      fppgValues,
      avgFppg,
      stdDevFppg,
      totalPlayers
    );

    // Calculate scarcity multiplier
    // Higher multiplier = more scarce position
    const scarcityMultiplier = calculateScarcityMultiplier(
      talentDepthScore,
      totalPlayers,
      top25PercentAvg,
      bottom25PercentAvg
    );

    positionData.push({
      position,
      total_players: totalPlayers,
      avg_fppg: Math.round(avgFppg * 100) / 100,
      median_fppg: Math.round(medianFppg * 100) / 100,
      std_dev_fppg: Math.round(stdDevFppg * 100) / 100,
      top_25_percent_avg: Math.round(top25PercentAvg * 100) / 100,
      bottom_25_percent_avg: Math.round(bottom25PercentAvg * 100) / 100,
      talent_depth_score: Math.round(talentDepthScore * 100) / 100,
      scarcity_multiplier: Math.round(scarcityMultiplier * 100) / 100
    });
  });

  return positionData.sort(
    (a, b) => b.scarcity_multiplier - a.scarcity_multiplier
  );
}

/**
 * Calculate talent depth score for a position
 * Higher score = more depth (consistent talent distribution)
 */
function calculateTalentDepthScore(
  fppgValues: number[],
  avgFppg: number,
  stdDevFppg: number,
  totalPlayers: number
): number {
  // Factor 1: Coefficient of variation (lower = more consistent)
  const coefficientOfVariation = stdDevFppg / avgFppg;
  const consistencyScore = Math.max(0, 1 - coefficientOfVariation);

  // Factor 2: Player pool size (normalized)
  const poolSizeScore = Math.min(1, totalPlayers / 100); // Cap at 100 players

  // Factor 3: Median vs average ratio (closer to 1 = more even distribution)
  const medianIndex = Math.floor(totalPlayers / 2);
  const median = fppgValues[medianIndex];
  const distributionScore = 1 - Math.abs(median - avgFppg) / avgFppg;

  // Factor 4: Top-heavy penalty (penalize positions where only top players are good)
  const top10Percent = Math.max(1, Math.floor(totalPlayers * 0.1));
  const top10Avg =
    fppgValues.slice(0, top10Percent).reduce((sum, val) => sum + val, 0) /
    top10Percent;
  const topHeavyPenalty = Math.min(1, avgFppg / top10Avg);

  // Combine factors with weights
  const depthScore =
    consistencyScore * 0.3 +
    poolSizeScore * 0.25 +
    distributionScore * 0.25 +
    topHeavyPenalty * 0.2;

  return Math.max(0, Math.min(1, depthScore));
}

/**
 * Calculate scarcity multiplier for a position
 * Higher multiplier = more scarce/valuable position
 */
function calculateScarcityMultiplier(
  talentDepthScore: number,
  totalPlayers: number,
  top25PercentAvg: number,
  bottom25PercentAvg: number
): number {
  // Factor 1: Inverse of talent depth (less depth = more scarcity)
  const depthScarcity = 1 - talentDepthScore;

  // Factor 2: Player pool scarcity (fewer players = more scarcity)
  const poolScarcity = Math.max(0, (150 - totalPlayers) / 150); // Normalized to 150 players

  // Factor 3: Elite vs replacement gap (bigger gap = more scarcity)
  const eliteGap = top25PercentAvg - bottom25PercentAvg;
  const gapScarcity = Math.min(1, eliteGap / 10); // Normalized to 10 FPPG gap

  // Base multiplier starts at 1.0 (no scarcity bonus)
  const baseMultiplier = 1.0;

  // Additional scarcity bonus (up to 0.5 additional multiplier)
  const scarcityBonus =
    (depthScarcity * 0.4 + poolScarcity * 0.3 + gapScarcity * 0.3) * 0.5;

  return baseMultiplier + scarcityBonus;
}

/**
 * Calculate PSV (Positional Scarcity Value) for all players
 */
export async function calculatePSV(
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG,
  minGamesPlayed: number = 20
): Promise<PSVResult[]> {
  try {
    console.log(`Calculating PSV for season ${season}...`);

    // Get all player fantasy stats
    const playerStats = await getPlayerFantasyStats(
      season,
      scoringConfig,
      minGamesPlayed
    );

    if (playerStats.length === 0) {
      console.warn("No player stats found for PSV calculation");
      return [];
    }

    // Calculate FPAR for comparison
    const fparResults = await calculateFPAR(
      season,
      scoringConfig,
      leagueConfig,
      minGamesPlayed
    );

    // Create FPAR lookup
    const fparLookup = fparResults.reduce(
      (acc, fpar) => {
        acc[fpar.player_id] = fpar;
        return acc;
      },
      {} as Record<number, FPARResult>
    );

    // Calculate positional depth data
    const positionalDepth = calculatePositionalDepth(
      playerStats,
      minGamesPlayed
    );

    // Create position depth lookup
    const depthLookup = positionalDepth.reduce(
      (acc, depth) => {
        acc[depth.position] = depth;
        return acc;
      },
      {} as Record<string, PositionalDepthData>
    );

    // Calculate PSV for each player
    const psvResults: PSVResult[] = [];

    // Group players by position for ranking
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

    // Calculate PSV for each position
    Object.entries(playersByPosition).forEach(([position, players]) => {
      const positionDepth = depthLookup[position];
      if (!positionDepth) return;

      // Sort players by FPPG descending
      const sortedPlayers = [...players].sort(
        (a, b) => b.fantasy_points_per_game - a.fantasy_points_per_game
      );

      sortedPlayers.forEach((player, index) => {
        const positionRank = index + 1;
        const positionPercentile =
          ((players.length - index) / players.length) * 100;

        // Get FPAR data for this player
        const fparData = fparLookup[player.player_id];

        // Calculate PSV score
        // PSV = (Player FPPG × Position Percentile × Scarcity Multiplier) / 100
        const psvScore =
          (player.fantasy_points_per_game *
            positionPercentile *
            positionDepth.scarcity_multiplier) /
          100;

        psvResults.push({
          player_id: player.player_id,
          player_name: player.player_name,
          position_code: player.position_code,
          games_played: player.games_played,
          fantasy_points_per_game: player.fantasy_points_per_game,
          position_rank: positionRank,
          position_percentile: Math.round(positionPercentile * 100) / 100,
          positional_depth_score: positionDepth.talent_depth_score,
          scarcity_multiplier: positionDepth.scarcity_multiplier,
          psv_score: Math.round(psvScore * 100) / 100,
          fpar_total: fparData?.fpar_total || 0,
          fpar_per_game: fparData?.fpar_per_game || 0
        });
      });
    });

    // Sort by PSV score descending
    psvResults.sort((a, b) => b.psv_score - a.psv_score);

    console.log(`PSV calculation completed for ${psvResults.length} players`);
    console.log("Positional depth analysis:", positionalDepth);

    return psvResults;
  } catch (error) {
    console.error("Error calculating PSV:", error);
    throw error;
  }
}

/**
 * Get PSV results for specific players
 */
export async function getPSVForPlayers(
  playerIds: number[],
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): Promise<PSVResult[]> {
  try {
    // Get full PSV results
    const allPsvResults = await calculatePSV(
      season,
      scoringConfig,
      leagueConfig
    );

    // Filter to requested players
    const requestedResults = allPsvResults.filter((result) =>
      playerIds.includes(result.player_id)
    );

    return requestedResults;
  } catch (error) {
    console.error("Error getting PSV for specific players:", error);
    throw error;
  }
}

/**
 * Get positional depth analysis
 */
export async function getPositionalDepthAnalysis(
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  minGamesPlayed: number = 20
): Promise<PositionalDepthData[]> {
  try {
    // Get all player fantasy stats
    const playerStats = await getPlayerFantasyStats(
      season,
      scoringConfig,
      minGamesPlayed
    );

    if (playerStats.length === 0) {
      console.warn("No player stats found for positional depth analysis");
      return [];
    }

    // Calculate and return positional depth data
    return calculatePositionalDepth(playerStats, minGamesPlayed);
  } catch (error) {
    console.error("Error getting positional depth analysis:", error);
    throw error;
  }
}

/**
 * Get top N players by PSV
 */
export async function getTopPlayersByPSV(
  limit: number = 50,
  season: string = "20242025",
  position?: string,
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): Promise<PSVResult[]> {
  try {
    // Get full PSV results
    const allPsvResults = await calculatePSV(
      season,
      scoringConfig,
      leagueConfig
    );

    // Filter by position if specified
    let filteredResults = allPsvResults;
    if (position) {
      filteredResults = allPsvResults.filter(
        (result) => result.position_code === position
      );
    }

    // Return top N players
    return filteredResults.slice(0, limit);
  } catch (error) {
    console.error("Error getting top players by PSV:", error);
    throw error;
  }
}
