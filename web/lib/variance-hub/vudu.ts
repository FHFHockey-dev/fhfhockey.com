import {
  FantasyScoringConfig,
  LeagueConfig,
  DEFAULT_SCORING_CONFIG,
  DEFAULT_LEAGUE_CONFIG
} from "./types";
import { getPlayerFantasyStats } from "./core";
import { calculateFPAR, FPARResult } from "./fpar";
import { calculatePSV, PSVResult } from "./psv";

// ============================================================================
// VOLATILITY SCORE (VUDu) CALCULATION SYSTEM
// ============================================================================

// Types for VUDu calculations
export interface GameLogEntry {
  game_date: string;
  opponent?: string;
  fantasy_points: number;
  goals?: number;
  assists?: number;
  shots?: number;
  hits?: number;
  blocks?: number;
  pim?: number;
  pp_points?: number;
  sh_points?: number;
  gwg?: number;
  otg?: number;
  saves?: number;
  goals_against?: number;
  wins?: number;
  losses?: number;
  otl?: number;
  shutouts?: number;
}

export interface VolatilityMetrics {
  standard_deviation: number;
  coefficient_of_variation: number;
  range: number;
  quartile_deviation: number;
  frequency_of_outliers: number;
  hot_streak_frequency: number;
  cold_streak_frequency: number;
  consistency_score: number; // 0-100, higher = more consistent
}

export interface VUDuResult {
  player_id: number;
  player_name: string;
  position_code: string;
  games_played: number;
  avg_fantasy_points: number;
  volatility_metrics: VolatilityMetrics;
  vudu_score: number; // Higher = more volatile/unpredictable
  risk_level: "Low" | "Medium" | "High" | "Extreme";
  fpar_total: number; // Include FPAR for comparison
  psv_score: number; // Include PSV for comparison
}

export interface StreakAnalysis {
  hot_streaks: Array<{
    start_game: number;
    end_game: number;
    length: number;
    avg_points: number;
  }>;
  cold_streaks: Array<{
    start_game: number;
    end_game: number;
    length: number;
    avg_points: number;
  }>;
  longest_hot_streak: number;
  longest_cold_streak: number;
  total_hot_games: number;
  total_cold_games: number;
}

/**
 * Calculate standard deviation for an array of numbers
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate quartile deviation (semi-interquartile range)
 */
function calculateQuartileDeviation(values: number[]): number {
  if (values.length < 4) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);

  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];

  return (q3 - q1) / 2;
}

// Fix streak tracking types
interface StreakInfo {
  start: number;
  games: Array<{
    game_number: number;
    fantasy_points: number;
    date: string;
  }>;
}

/**
 * Analyze boom/bust patterns and streaks
 */
function analyzeStreaks(gameLog: GameLogEntry[]): StreakAnalysis {
  if (gameLog.length === 0) {
    return {
      hot_streaks: [],
      cold_streaks: [],
      longest_hot_streak: 0,
      longest_cold_streak: 0,
      total_hot_games: 0,
      total_cold_games: 0
    };
  }

  // Sort games by date
  const sortedGames = gameLog
    .slice()
    .sort(
      (a, b) =>
        new Date(a.game_date).getTime() - new Date(b.game_date).getTime()
    );

  // Calculate average for boom/bust thresholds
  const avgPoints =
    sortedGames.reduce((sum, game) => sum + game.fantasy_points, 0) /
    sortedGames.length;
  const boomThreshold = avgPoints * 1.5;
  const bustThreshold = avgPoints * 0.5;

  const hotStreaks: Array<{
    start_game: number;
    end_game: number;
    length: number;
    avg_points: number;
  }> = [];
  const coldStreaks: Array<{
    start_game: number;
    end_game: number;
    length: number;
    avg_points: number;
  }> = [];

  let currentHotStreak: number | null = null;
  let currentColdStreak: number | null = null;
  let totalHotGames = 0;
  let totalColdGames = 0;

  for (let i = 0; i < sortedGames.length; i++) {
    const game = sortedGames[i];
    const isHotGame = game.fantasy_points >= boomThreshold;
    const isColdGame = game.fantasy_points <= bustThreshold;

    if (isHotGame) {
      totalHotGames++;

      // End cold streak if active
      if (currentColdStreak !== null) {
        const streakGames = sortedGames.slice(currentColdStreak, i);
        const avgPoints =
          streakGames.reduce((sum, g) => sum + g.fantasy_points, 0) /
          streakGames.length;
        coldStreaks.push({
          start_game: currentColdStreak + 1,
          end_game: i,
          length: i - currentColdStreak,
          avg_points: Math.round(avgPoints * 100) / 100
        });
        currentColdStreak = null;
      }

      // Start or continue hot streak
      if (currentHotStreak === null) {
        currentHotStreak = i;
      }
    } else if (isColdGame) {
      totalColdGames++;

      // End hot streak if active
      if (currentHotStreak !== null) {
        const streakGames = sortedGames.slice(currentHotStreak, i);
        const avgPoints =
          streakGames.reduce((sum, g) => sum + g.fantasy_points, 0) /
          streakGames.length;
        hotStreaks.push({
          start_game: currentHotStreak + 1,
          end_game: i,
          length: i - currentHotStreak,
          avg_points: Math.round(avgPoints * 100) / 100
        });
        currentHotStreak = null;
      }

      // Start or continue cold streak
      if (currentColdStreak === null) {
        currentColdStreak = i;
      }
    } else {
      // End any active streaks
      if (currentHotStreak !== null) {
        const streakGames = sortedGames.slice(currentHotStreak, i);
        const avgPoints =
          streakGames.reduce((sum, g) => sum + g.fantasy_points, 0) /
          streakGames.length;
        hotStreaks.push({
          start_game: currentHotStreak + 1,
          end_game: i,
          length: i - currentHotStreak,
          avg_points: Math.round(avgPoints * 100) / 100
        });
        currentHotStreak = null;
      }

      if (currentColdStreak !== null) {
        const streakGames = sortedGames.slice(currentColdStreak, i);
        const avgPoints =
          streakGames.reduce((sum, g) => sum + g.fantasy_points, 0) /
          streakGames.length;
        coldStreaks.push({
          start_game: currentColdStreak + 1,
          end_game: i,
          length: i - currentColdStreak,
          avg_points: Math.round(avgPoints * 100) / 100
        });
        currentColdStreak = null;
      }
    }
  }

  // Handle streaks that extend to the end of the log
  if (currentHotStreak !== null) {
    const streakGames = sortedGames.slice(currentHotStreak);
    const avgPoints =
      streakGames.reduce((sum, g) => sum + g.fantasy_points, 0) /
      streakGames.length;
    hotStreaks.push({
      start_game: currentHotStreak + 1,
      end_game: sortedGames.length,
      length: sortedGames.length - currentHotStreak,
      avg_points: Math.round(avgPoints * 100) / 100
    });
  }

  if (currentColdStreak !== null) {
    const streakGames = sortedGames.slice(currentColdStreak);
    const avgPoints =
      streakGames.reduce((sum, g) => sum + g.fantasy_points, 0) /
      streakGames.length;
    coldStreaks.push({
      start_game: currentColdStreak + 1,
      end_game: sortedGames.length,
      length: sortedGames.length - currentColdStreak,
      avg_points: Math.round(avgPoints * 100) / 100
    });
  }

  // Find longest streaks
  const longestHotStreak =
    hotStreaks.length > 0 ? Math.max(...hotStreaks.map((s) => s.length)) : 0;
  const longestColdStreak =
    coldStreaks.length > 0 ? Math.max(...coldStreaks.map((s) => s.length)) : 0;

  return {
    hot_streaks: hotStreaks,
    cold_streaks: coldStreaks,
    longest_hot_streak: longestHotStreak,
    longest_cold_streak: longestColdStreak,
    total_hot_games: totalHotGames,
    total_cold_games: totalColdGames
  };
}

/**
 * Calculate comprehensive volatility metrics for a player
 */
export function calculateVolatilityMetrics(
  gameLog: GameLogEntry[],
  playerAverage: number
): VolatilityMetrics {
  if (gameLog.length < 3) {
    return {
      standard_deviation: 0,
      coefficient_of_variation: 0,
      range: 0,
      quartile_deviation: 0,
      frequency_of_outliers: 0,
      hot_streak_frequency: 0,
      cold_streak_frequency: 0,
      consistency_score: 100
    };
  }

  const fantasyPoints = gameLog.map((g) => g.fantasy_points);

  // Basic volatility metrics
  const standardDeviation = calculateStandardDeviation(fantasyPoints);
  const coefficientOfVariation =
    playerAverage > 0 ? standardDeviation / playerAverage : 0;
  const range = Math.max(...fantasyPoints) - Math.min(...fantasyPoints);
  const quartileDeviation = calculateQuartileDeviation(fantasyPoints);

  // Outlier analysis (beyond 2 standard deviations)
  const outlierThreshold = 2 * standardDeviation;
  const outliers = fantasyPoints.filter(
    (fp) => Math.abs(fp - playerAverage) > outlierThreshold
  );
  const frequencyOfOutliers = (outliers.length / fantasyPoints.length) * 100;

  // Streak analysis
  const streakAnalysis = analyzeStreaks(gameLog);
  const hotStreakFrequency =
    (streakAnalysis.total_hot_games / fantasyPoints.length) * 100;
  const coldStreakFrequency =
    (streakAnalysis.total_cold_games / fantasyPoints.length) * 100;

  // Consistency score (inverse of volatility, 0-100 scale)
  // Lower CV and fewer outliers = higher consistency
  const cvPenalty = Math.min(100, coefficientOfVariation * 100);
  const outlierPenalty = Math.min(50, frequencyOfOutliers);
  const streakPenalty = Math.min(
    25,
    (hotStreakFrequency + coldStreakFrequency) / 4
  );

  const consistencyScore = Math.max(
    0,
    100 - cvPenalty - outlierPenalty - streakPenalty
  );

  return {
    standard_deviation: Math.round(standardDeviation * 100) / 100,
    coefficient_of_variation: Math.round(coefficientOfVariation * 100) / 100,
    range: Math.round(range * 100) / 100,
    quartile_deviation: Math.round(quartileDeviation * 100) / 100,
    frequency_of_outliers: Math.round(frequencyOfOutliers * 100) / 100,
    hot_streak_frequency: Math.round(hotStreakFrequency * 100) / 100,
    cold_streak_frequency: Math.round(coldStreakFrequency * 100) / 100,
    consistency_score: Math.round(consistencyScore * 100) / 100
  };
}

/**
 * Calculate VUDu (Volatility/Unpredictability) score
 */
export function calculateVUDuScore(metrics: VolatilityMetrics): number {
  // VUDu score combines multiple volatility factors
  // Higher score = more volatile/unpredictable

  // Factor 1: Coefficient of Variation (40% weight)
  const cvScore = Math.min(100, metrics.coefficient_of_variation * 100);

  // Factor 2: Outlier frequency (25% weight)
  const outlierScore = metrics.frequency_of_outliers;

  // Factor 3: Streak volatility (20% weight)
  const streakScore =
    (metrics.hot_streak_frequency + metrics.cold_streak_frequency) / 2;

  // Factor 4: Range relative to average (15% weight)
  const rangeScore = Math.min(100, (metrics.range / 10) * 25); // Normalized assuming reasonable ranges

  const vuduScore =
    cvScore * 0.4 + outlierScore * 0.25 + streakScore * 0.2 + rangeScore * 0.15;

  return Math.round(vuduScore * 100) / 100;
}

/**
 * Determine risk level based on VUDu score
 */
export function determineRiskLevel(
  vuduScore: number
): "Low" | "Medium" | "High" | "Extreme" {
  if (vuduScore <= 25) return "Low";
  if (vuduScore <= 50) return "Medium";
  if (vuduScore <= 75) return "High";
  return "Extreme";
}

/**
 * Get player game logs from database (mock implementation for now)
 */
export async function getPlayerGameLogs(
  season: string = "20242025",
  minGamesPlayed: number = 10,
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG
): Promise<Map<number, GameLogEntry[]>> {
  try {
    // This would typically query the nst_gamelog_as_counts table
    // For now, return empty map - would need actual database integration
    console.log(
      `Getting game logs for season ${season} with min ${minGamesPlayed} games`
    );

    // Mock implementation - in real version, this would query:
    // SELECT player_id, game_date, goals, assists, shots, hits, blocked_shots, etc.
    // FROM nst_gamelog_as_counts
    // WHERE season = season AND player_id IN (qualified players)
    // ORDER BY player_id, game_date

    return new Map<number, GameLogEntry[]>();
  } catch (error) {
    console.error("Error fetching game logs:", error);
    throw error;
  }
}

/**
 * Calculate VUDu (Volatility/Unpredictability) scores for all players
 */
export async function calculateVUDu(
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG,
  minGamesPlayed: number = 20
): Promise<VUDuResult[]> {
  try {
    console.log(`Calculating VUDu for season ${season}...`);

    // Get all player fantasy stats
    const playerStats = await getPlayerFantasyStats(
      season,
      scoringConfig,
      minGamesPlayed
    );

    if (playerStats.length === 0) {
      console.warn("No player stats found for VUDu calculation");
      return [];
    }

    // Get FPAR and PSV for comparison
    const [fparResults, psvResults] = await Promise.all([
      calculateFPAR(season, scoringConfig, leagueConfig, minGamesPlayed),
      calculatePSV(season, scoringConfig, leagueConfig, minGamesPlayed)
    ]);

    // Create lookup maps
    const fparLookup = fparResults.reduce(
      (acc, fpar) => {
        acc[fpar.player_id] = fpar;
        return acc;
      },
      {} as Record<number, FPARResult>
    );

    const psvLookup = psvResults.reduce(
      (acc, psv) => {
        acc[psv.player_id] = psv;
        return acc;
      },
      {} as Record<number, PSVResult>
    );

    // Get game logs for volatility analysis
    const gameLogMap = await getPlayerGameLogs(
      season,
      minGamesPlayed,
      scoringConfig
    );

    // Calculate VUDu for each player
    const vuduResults: VUDuResult[] = playerStats.map((player) => {
      const gameLog = gameLogMap.get(player.player_id) || [];

      // Calculate volatility metrics
      const volatilityMetrics = calculateVolatilityMetrics(
        gameLog,
        player.fantasy_points_per_game
      );

      // Calculate VUDu score
      const vuduScore = calculateVUDuScore(volatilityMetrics);
      const riskLevel = determineRiskLevel(vuduScore);

      // Get FPAR and PSV data
      const fparData = fparLookup[player.player_id];
      const psvData = psvLookup[player.player_id];

      return {
        player_id: player.player_id,
        player_name: player.player_name,
        position_code: player.position_code,
        games_played: player.games_played,
        avg_fantasy_points: player.fantasy_points_per_game,
        volatility_metrics: volatilityMetrics,
        vudu_score: vuduScore,
        risk_level: riskLevel,
        fpar_total: fparData?.fpar_total || 0,
        psv_score: psvData?.psv_score || 0
      };
    });

    // Sort by VUDu score descending (most volatile first)
    vuduResults.sort((a, b) => b.vudu_score - a.vudu_score);

    console.log(`VUDu calculation completed for ${vuduResults.length} players`);

    return vuduResults;
  } catch (error) {
    console.error("Error calculating VUDu:", error);
    throw error;
  }
}

/**
 * Get VUDu results for specific players
 */
export async function getVUDuForPlayers(
  playerIds: number[],
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): Promise<VUDuResult[]> {
  try {
    // Get full VUDu results
    const allVuduResults = await calculateVUDu(
      season,
      scoringConfig,
      leagueConfig
    );

    // Filter to requested players
    const requestedResults = allVuduResults.filter((result) =>
      playerIds.includes(result.player_id)
    );

    return requestedResults;
  } catch (error) {
    console.error("Error getting VUDu for specific players:", error);
    throw error;
  }
}

/**
 * Get players by risk level
 */
export async function getPlayersByRiskLevel(
  riskLevel: "Low" | "Medium" | "High" | "Extreme",
  season: string = "20242025",
  position?: string,
  limit: number = 50,
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): Promise<VUDuResult[]> {
  try {
    // Get full VUDu results
    const allVuduResults = await calculateVUDu(
      season,
      scoringConfig,
      leagueConfig
    );

    // Filter by risk level and position
    let filteredResults = allVuduResults.filter(
      (result) => result.risk_level === riskLevel
    );

    if (position) {
      filteredResults = filteredResults.filter(
        (result) => result.position_code === position
      );
    }

    // Return top N players
    return filteredResults.slice(0, limit);
  } catch (error) {
    console.error("Error getting players by risk level:", error);
    throw error;
  }
}

/**
 * Get most/least volatile players
 */
export async function getTopPlayersByVolatility(
  limit: number = 50,
  mostVolatile: boolean = true,
  season: string = "20242025",
  position?: string,
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): Promise<VUDuResult[]> {
  try {
    // Get full VUDu results
    const allVuduResults = await calculateVUDu(
      season,
      scoringConfig,
      leagueConfig
    );

    // Filter by position if specified
    let filteredResults = allVuduResults;
    if (position) {
      filteredResults = allVuduResults.filter(
        (result) => result.position_code === position
      );
    }

    // Sort by volatility (VUDu score)
    if (mostVolatile) {
      filteredResults.sort((a, b) => b.vudu_score - a.vudu_score);
    } else {
      filteredResults.sort((a, b) => a.vudu_score - b.vudu_score);
    }

    // Return top N players
    return filteredResults.slice(0, limit);
  } catch (error) {
    console.error("Error getting top players by volatility:", error);
    throw error;
  }
}
