import {
  FantasyScoringConfig,
  LeagueConfig,
  DEFAULT_SCORING_CONFIG,
  DEFAULT_LEAGUE_CONFIG
} from "./types";
import { getPlayerFantasyStats } from "./core";
import { GameLogEntry } from "./vudu";
import { calculateFPAR, FPARResult } from "./fpar";
import { calculatePSV, PSVResult } from "./psv";
import { calculateVUDu, VUDuResult, getPlayerGameLogs } from "./vudu";

// ============================================================================
// BUST RATE CALCULATION SYSTEM
// ============================================================================

// Types for Bust Rate calculations
export interface ADPData {
  player_id: number;
  player_name: string;
  position_code: string;
  adp: number; // Average Draft Position
  draft_round: number;
  draft_pick_in_round: number;
  games_expected: number; // Expected games based on ADP
  points_expected: number; // Expected fantasy points based on ADP
  source: "yahoo" | "espn" | "sleeper" | "composite";
  season: string;
  date_collected: string;
}

export interface BustGameData {
  game_date: string;
  fantasy_points: number;
  expected_points: number; // Based on ADP expectations
  is_bust_game: boolean; // Below 50% of expected points
  is_severe_bust: boolean; // Below 25% of expected points
  points_vs_expectation: number; // Actual - Expected
  expectation_percentage: number; // (Actual / Expected) * 100
}

export interface BustRateMetrics {
  total_games: number;
  bust_games: number; // Games below 50% expectation
  severe_bust_games: number; // Games below 25% of expectation
  bust_rate: number; // Percentage of games that were busts
  severe_bust_rate: number; // Percentage of games that were severe busts
  avg_expectation_percentage: number; // Average % of expectation met
  worst_game_percentage: number; // Worst single game vs expectation
  consecutive_bust_streaks: number; // Number of 3+ game bust streaks
  longest_bust_streak: number; // Longest consecutive bust games
  reliability_score: number; // 0-100, higher = more reliable (inverse of bust rate)
}

export interface BustRateResult {
  player_id: number;
  player_name: string;
  position_code: string;
  games_played: number;
  adp: number;
  draft_round: number;
  expected_fantasy_points: number;
  actual_fantasy_points: number;
  expectation_percentage: number; // (Actual / Expected) * 100
  bust_rate_metrics: BustRateMetrics;
  bust_rate_score: number; // 0-100, higher = more likely to bust
  reliability_tier: "Elite" | "Reliable" | "Inconsistent" | "High Risk";
  draft_value: "Excellent" | "Good" | "Fair" | "Poor" | "Terrible";
  fpar_total: number; // Include FPAR for comparison
  psv_score: number; // Include PSV for comparison
  vudu_score: number; // Include VUDu for comparison
}

/**
 * Generate expected performance based on ADP
 */
function calculateADPExpectations(
  adp: number,
  position: string,
  gamesPlayed: number,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): { expectedPoints: number; expectedPointsPerGame: number } {
  // ADP-based expectation curves by position
  // These are empirical formulas based on historical ADP vs performance analysis

  let baseExpectedFPPG: number;

  // Position-specific ADP expectation curves
  switch (position) {
    case "C":
      // Centers: Higher scoring ceiling, more linear ADP curve
      if (adp <= 12)
        baseExpectedFPPG = 18 - (adp - 1) * 0.8; // Elite: 18-9.2 FPPG
      else if (adp <= 36)
        baseExpectedFPPG = 9.2 - (adp - 12) * 0.25; // Mid: 9.2-3.2 FPPG
      else if (adp <= 72)
        baseExpectedFPPG = 3.2 - (adp - 36) * 0.05; // Deep: 3.2-1.4 FPPG
      else baseExpectedFPPG = Math.max(0.5, 1.4 - (adp - 72) * 0.01); // Waiver: 1.4+ FPPG
      break;

    case "LW":
    case "RW":
      // Wingers: Similar to centers but slightly lower ceiling
      if (adp <= 12)
        baseExpectedFPPG = 17 - (adp - 1) * 0.75; // Elite: 17-8.75 FPPG
      else if (adp <= 36)
        baseExpectedFPPG = 8.75 - (adp - 12) * 0.23; // Mid: 8.75-3.23 FPPG
      else if (adp <= 72)
        baseExpectedFPPG = 3.23 - (adp - 36) * 0.05; // Deep: 3.23-1.43 FPPG
      else baseExpectedFPPG = Math.max(0.5, 1.43 - (adp - 72) * 0.01); // Waiver: 1.43+ FPPG
      break;

    case "D":
      // Defensemen: Lower scoring, flatter curve, more scarcity at top
      if (adp <= 6)
        baseExpectedFPPG = 14 - (adp - 1) * 1.2; // Elite: 14-8 FPPG
      else if (adp <= 24)
        baseExpectedFPPG = 8 - (adp - 6) * 0.15; // Mid: 8-5.3 FPPG
      else if (adp <= 60)
        baseExpectedFPPG = 5.3 - (adp - 24) * 0.08; // Deep: 5.3-2.42 FPPG
      else baseExpectedFPPG = Math.max(0.3, 2.42 - (adp - 60) * 0.02); // Waiver: 2.42+ FPPG
      break;

    case "G":
      // Goalies: Unique scoring pattern, very top-heavy
      if (adp <= 3)
        baseExpectedFPPG = 12 - (adp - 1) * 1.5; // Elite: 12-9 FPPG
      else if (adp <= 12)
        baseExpectedFPPG = 9 - (adp - 3) * 0.4; // Starter: 9-5.4 FPPG
      else if (adp <= 24)
        baseExpectedFPPG = 5.4 - (adp - 12) * 0.2; // Backup: 5.4-3 FPPG
      else baseExpectedFPPG = Math.max(0.1, 3 - (adp - 24) * 0.05); // Deep: 3+ FPPG
      break;

    default:
      // Default case (treat as center)
      if (adp <= 12) baseExpectedFPPG = 18 - (adp - 1) * 0.8;
      else if (adp <= 36) baseExpectedFPPG = 9.2 - (adp - 12) * 0.25;
      else if (adp <= 72) baseExpectedFPPG = 3.2 - (adp - 36) * 0.05;
      else baseExpectedFPPG = Math.max(0.5, 1.4 - (adp - 72) * 0.01);
  }

  // Adjust for league size (12-team is baseline)
  const leagueSizeMultiplier = 12 / leagueConfig.num_teams;
  const adjustedFPPG = baseExpectedFPPG * leagueSizeMultiplier;

  // Calculate total expected points
  const expectedPointsPerGame = Math.round(adjustedFPPG * 100) / 100;
  const expectedPoints =
    Math.round(expectedPointsPerGame * gamesPlayed * 100) / 100;

  return {
    expectedPoints,
    expectedPointsPerGame
  };
}

/**
 * Analyze bust games from game log data
 */
function analyzeBustGames(
  gameLog: GameLogEntry[],
  expectedPointsPerGame: number
): { bustGameData: BustGameData[]; bustMetrics: BustRateMetrics } {
  if (gameLog.length === 0) {
    return {
      bustGameData: [],
      bustMetrics: {
        total_games: 0,
        bust_games: 0,
        severe_bust_games: 0,
        bust_rate: 0,
        severe_bust_rate: 0,
        avg_expectation_percentage: 100,
        worst_game_percentage: 100,
        consecutive_bust_streaks: 0,
        longest_bust_streak: 0,
        reliability_score: 100
      }
    };
  }

  // Analyze each game
  const bustGameData: BustGameData[] = gameLog.map((game) => {
    const actualPoints = game.fantasy_points;
    const expectedPoints = expectedPointsPerGame;
    const pointsVsExpectation = actualPoints - expectedPoints;
    const expectationPercentage =
      expectedPoints > 0 ? (actualPoints / expectedPoints) * 100 : 100;

    // Bust thresholds
    const isBustGame = expectationPercentage < 50; // Below 50% of expectation
    const isSevereBust = expectationPercentage < 25; // Below 25% of expectation

    return {
      game_date: game.game_date,
      fantasy_points: actualPoints,
      expected_points: expectedPoints,
      is_bust_game: isBustGame,
      is_severe_bust: isSevereBust,
      points_vs_expectation: Math.round(pointsVsExpectation * 100) / 100,
      expectation_percentage: Math.round(expectationPercentage * 100) / 100
    };
  });

  // Calculate bust metrics
  const totalGames = bustGameData.length;
  const bustGames = bustGameData.filter((g) => g.is_bust_game).length;
  const severeBustGames = bustGameData.filter((g) => g.is_severe_bust).length;

  const bustRate = (bustGames / totalGames) * 100;
  const severeBustRate = (severeBustGames / totalGames) * 100;

  const avgExpectationPercentage =
    bustGameData.reduce((sum, g) => sum + g.expectation_percentage, 0) /
    totalGames;
  const worstGamePercentage = Math.min(
    ...bustGameData.map((g) => g.expectation_percentage)
  );

  // Analyze consecutive bust streaks
  let consecutiveBustStreaks = 0;
  let longestBustStreak = 0;
  let currentStreak = 0;

  bustGameData.forEach((game) => {
    if (game.is_bust_game) {
      currentStreak++;
      longestBustStreak = Math.max(longestBustStreak, currentStreak);
    } else {
      if (currentStreak >= 3) {
        consecutiveBustStreaks++;
      }
      currentStreak = 0;
    }
  });

  // Check if final streak was 3+ games
  if (currentStreak >= 3) {
    consecutiveBustStreaks++;
  }

  // Reliability score (inverse of bust rate with bonuses/penalties)
  let reliabilityScore = 100 - bustRate;
  reliabilityScore -= severeBustRate * 0.5; // Extra penalty for severe busts
  reliabilityScore -= consecutiveBustStreaks * 5; // Penalty for consecutive bust streaks
  reliabilityScore = Math.max(0, Math.min(100, reliabilityScore));

  const bustMetrics: BustRateMetrics = {
    total_games: totalGames,
    bust_games: bustGames,
    severe_bust_games: severeBustGames,
    bust_rate: Math.round(bustRate * 100) / 100,
    severe_bust_rate: Math.round(severeBustRate * 100) / 100,
    avg_expectation_percentage:
      Math.round(avgExpectationPercentage * 100) / 100,
    worst_game_percentage: Math.round(worstGamePercentage * 100) / 100,
    consecutive_bust_streaks: consecutiveBustStreaks,
    longest_bust_streak: longestBustStreak,
    reliability_score: Math.round(reliabilityScore * 100) / 100
  };

  return { bustGameData, bustMetrics };
}

/**
 * Calculate overall bust rate score
 */
export function calculateBustRateScore(
  bustMetrics: BustRateMetrics,
  expectationPercentage: number
): number {
  // Bust Rate Score components (0-100, higher = more likely to bust)

  // Factor 1: Overall bust rate (40% weight)
  const bustRateScore = bustMetrics.bust_rate;

  // Factor 2: Severe bust rate (25% weight)
  const severeBustScore = bustMetrics.severe_bust_rate * 2; // Double weight for severe busts

  // Factor 3: Consecutive bust streaks (20% weight)
  const streakScore = Math.min(100, bustMetrics.consecutive_bust_streaks * 15);

  // Factor 4: Overall underperformance (15% weight)
  const underperformanceScore = Math.max(0, 100 - expectationPercentage);

  const bustScore =
    bustRateScore * 0.4 +
    severeBustScore * 0.25 +
    streakScore * 0.2 +
    underperformanceScore * 0.15;

  return Math.min(100, Math.round(bustScore * 100) / 100);
}

/**
 * Determine reliability tier based on bust metrics
 */
export function determineReliabilityTier(
  bustRateScore: number,
  reliabilityScore: number
): "Elite" | "Reliable" | "Inconsistent" | "High Risk" {
  if (reliabilityScore >= 85 && bustRateScore <= 15) return "Elite";
  if (reliabilityScore >= 70 && bustRateScore <= 30) return "Reliable";
  if (reliabilityScore >= 50 && bustRateScore <= 50) return "Inconsistent";
  return "High Risk";
}

/**
 * Determine draft value based on expectation percentage
 */
export function determineDraftValue(
  expectationPercentage: number
): "Excellent" | "Good" | "Fair" | "Poor" | "Terrible" {
  if (expectationPercentage >= 120) return "Excellent";
  if (expectationPercentage >= 100) return "Good";
  if (expectationPercentage >= 80) return "Fair";
  if (expectationPercentage >= 60) return "Poor";
  return "Terrible";
}

/**
 * Get ADP data from database (mock implementation for now)
 */
export async function getADPData(
  season: string = "20242025"
): Promise<Map<number, ADPData>> {
  try {
    console.log(`Getting ADP data for season ${season}...`);

    // Mock implementation - in real version, this would query ADP tables
    // This would need to be integrated with Yahoo/ESPN/Sleeper ADP data

    // For now, return empty map - would need actual ADP data integration
    return new Map<number, ADPData>();
  } catch (error) {
    console.error("Error fetching ADP data:", error);
    throw error;
  }
}

/**
 * Calculate Bust Rate for all players
 */
export async function calculateBustRate(
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG,
  minGamesPlayed: number = 20
): Promise<BustRateResult[]> {
  try {
    console.log(`Calculating Bust Rate for season ${season}...`);

    // Get all player fantasy stats
    const playerStats = await getPlayerFantasyStats(
      season,
      scoringConfig,
      minGamesPlayed
    );

    if (playerStats.length === 0) {
      console.warn("No player stats found for Bust Rate calculation");
      return [];
    }

    // Get ADP data
    const adpData = await getADPData(season);

    // Get FPAR, PSV, and VUDu for comparison
    const [fparResults, psvResults, vuduResults] = await Promise.all([
      calculateFPAR(season, scoringConfig, leagueConfig, minGamesPlayed),
      calculatePSV(season, scoringConfig, leagueConfig, minGamesPlayed),
      calculateVUDu(season, scoringConfig, leagueConfig, minGamesPlayed)
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

    const vuduLookup = vuduResults.reduce(
      (acc, vudu) => {
        acc[vudu.player_id] = vudu;
        return acc;
      },
      {} as Record<number, VUDuResult>
    );

    // Get game logs for detailed bust analysis
    const gameLogMap = await getPlayerGameLogs(
      season,
      minGamesPlayed,
      scoringConfig
    );

    // Calculate Bust Rate for each player with ADP data
    const bustRateResults: BustRateResult[] = [];

    playerStats.forEach((player) => {
      const playerADP = adpData.get(player.player_id);

      // Skip players without ADP data (undrafted/late picks)
      if (!playerADP) {
        return;
      }

      // Calculate ADP-based expectations
      const expectations = calculateADPExpectations(
        playerADP.adp,
        player.position_code,
        player.games_played,
        leagueConfig
      );

      // Analyze bust games
      const gameLog = gameLogMap.get(player.player_id) || [];
      const { bustMetrics } = analyzeBustGames(
        gameLog,
        expectations.expectedPointsPerGame
      );

      // Calculate overall expectation percentage
      const expectationPercentage =
        expectations.expectedPoints > 0
          ? (player.fantasy_points_total / expectations.expectedPoints) * 100
          : 100;

      // Calculate bust rate score
      const bustRateScore = calculateBustRateScore(
        bustMetrics,
        expectationPercentage
      );

      // Determine tiers
      const reliabilityTier = determineReliabilityTier(
        bustRateScore,
        bustMetrics.reliability_score
      );
      const draftValue = determineDraftValue(expectationPercentage);

      // Get comparison metrics
      const fparData = fparLookup[player.player_id];
      const psvData = psvLookup[player.player_id];
      const vuduData = vuduLookup[player.player_id];

      bustRateResults.push({
        player_id: player.player_id,
        player_name: player.player_name,
        position_code: player.position_code,
        games_played: player.games_played,
        adp: playerADP.adp,
        draft_round: playerADP.draft_round,
        expected_fantasy_points: expectations.expectedPoints,
        actual_fantasy_points: player.fantasy_points_total,
        expectation_percentage: Math.round(expectationPercentage * 100) / 100,
        bust_rate_metrics: bustMetrics,
        bust_rate_score: bustRateScore,
        reliability_tier: reliabilityTier,
        draft_value: draftValue,
        fpar_total: fparData?.fpar_total || 0,
        psv_score: psvData?.psv_score || 0,
        vudu_score: vuduData?.vudu_score || 0
      });
    });

    // Sort by bust rate score descending (highest bust risk first)
    bustRateResults.sort((a, b) => b.bust_rate_score - a.bust_rate_score);

    console.log(
      `Bust Rate calculation completed for ${bustRateResults.length} players with ADP data`
    );

    return bustRateResults;
  } catch (error) {
    console.error("Error calculating Bust Rate:", error);
    throw error;
  }
}

/**
 * Get Bust Rate results for specific players
 */
export async function getBustRateForPlayers(
  playerIds: number[],
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): Promise<BustRateResult[]> {
  try {
    // Get full Bust Rate results
    const allBustRateResults = await calculateBustRate(
      season,
      scoringConfig,
      leagueConfig
    );

    // Filter to requested players
    const requestedResults = allBustRateResults.filter((result) =>
      playerIds.includes(result.player_id)
    );

    return requestedResults;
  } catch (error) {
    console.error("Error getting Bust Rate for specific players:", error);
    throw error;
  }
}

/**
 * Get players by reliability tier
 */
export async function getPlayersByReliabilityTier(
  reliabilityTier: "Elite" | "Reliable" | "Inconsistent" | "High Risk",
  season: string = "20242025",
  position?: string,
  limit: number = 50,
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): Promise<BustRateResult[]> {
  try {
    // Get full Bust Rate results
    const allBustRateResults = await calculateBustRate(
      season,
      scoringConfig,
      leagueConfig
    );

    // Filter by reliability tier and position
    let filteredResults = allBustRateResults.filter(
      (result) => result.reliability_tier === reliabilityTier
    );

    if (position) {
      filteredResults = filteredResults.filter(
        (result) => result.position_code === position
      );
    }

    // Return top N players
    return filteredResults.slice(0, limit);
  } catch (error) {
    console.error("Error getting players by reliability tier:", error);
    throw error;
  }
}

/**
 * Get players by draft value
 */
export async function getPlayersByDraftValue(
  draftValue: "Excellent" | "Good" | "Fair" | "Poor" | "Terrible",
  season: string = "20242025",
  position?: string,
  limit: number = 50,
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): Promise<BustRateResult[]> {
  try {
    // Get full Bust Rate results
    const allBustRateResults = await calculateBustRate(
      season,
      scoringConfig,
      leagueConfig
    );

    // Filter by draft value and position
    let filteredResults = allBustRateResults.filter(
      (result) => result.draft_value === draftValue
    );

    if (position) {
      filteredResults = filteredResults.filter(
        (result) => result.position_code === position
      );
    }

    // Sort by expectation percentage for draft value categories
    if (draftValue === "Excellent" || draftValue === "Good") {
      filteredResults.sort(
        (a, b) => b.expectation_percentage - a.expectation_percentage
      );
    } else {
      filteredResults.sort((a, b) => a.bust_rate_score - b.bust_rate_score);
    }

    // Return top N players
    return filteredResults.slice(0, limit);
  } catch (error) {
    console.error("Error getting players by draft value:", error);
    throw error;
  }
}
