import {
  FantasyScoringConfig,
  LeagueConfig,
  DEFAULT_SCORING_CONFIG,
  DEFAULT_LEAGUE_CONFIG
} from "./types";
import { getPlayerFantasyStats } from "./core";
import { calculateFPAR, FPARResult } from "./fpar"; // Import FPAR calculations
import { calculatePSV, PSVResult } from "./psv"; // Import PSV calculations
import { calculateVUDu, VUDuResult } from "./vudu"; // Import VUDu calculations
import { calculateBustRate, BustRateResult, getADPData } from "./bust"; // Import Bust Rate calculations

// ============================================================================
// PERFORMANCE OVER EXPECTATION (POE) CALCULATION SYSTEM
// ============================================================================

// Types for POE calculations
export interface RegressionModel {
  slope: number; // m in y = mx + b
  intercept: number; // b in y = mx + b

  r_squared: number; // Coefficient of determination
  standard_error: number; // Standard error of estimate
  sample_size: number; // Number of data points used
  position: string; // Position this model applies to
  season: string; // Season this model was trained on
}

export interface POEResult {
  player_id: number;
  player_name: string;
  position_code: string;
  games_played: number;
  adp: number;
  draft_round: number;
  expected_fantasy_points: number; // From regression model
  poe_score: number; // Actual - Expected (positive = overperformed)
  poe_percentage: number; // (Actual / Expected - 1) * 100
  percentile_rank: number; // Where this POE ranks among all players (0-100)
  performance_tier:
    | "Elite Overperformer"
    | "Solid Overperformer"
    | "Met Expectations"
    | "Underperformer"
    | "Major Bust";
  regression_confidence: number; // How confident we are in the expectation (based on R²)
  z_score: number; // How many standard deviations from expected
  fpar_total: number; // Include FPAR for comparison
  psv_score: number; // Include PSV for comparison
  vudu_score: number; // Include VUDu for comparison
  bust_rate_score: number; // Include Bust Rate for comparison
}

export interface PositionalRegressionData {
  position: string;
  data_points: Array<{
    player_id: number;
    player_name: string;
    adp: number;
    expected_points: number; // From regression model
    actual_points: number; // Actual fantasy points scored
    fantasy_points: number;
  }>;
  model: RegressionModel;
  outliers: Array<{
    player_id: number;
    player_name: string;
    adp: number;
    actual_points: number;
    expected_points: number;
    residual: number;
  }>;
}

/**
 * Calculate linear regression for ADP vs Fantasy Points
 */
function calculateLinearRegression(
  xValues: number[], // ADP values
  yValues: number[] // Fantasy Points values
): {
  slope: number;
  intercept: number;
  rSquared: number;
  standardError: number;
} {
  if (xValues.length !== yValues.length || xValues.length < 3) {
    throw new Error("Invalid data for regression analysis");
  }

  const n = xValues.length;

  // Calculate means
  const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
  const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;

  // Calculate slope (m) and intercept (b)
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = xValues[i] - xMean;
    const yDiff = yValues[i] - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  if (denominator === 0) {
    throw new Error("Cannot calculate regression - no variance in ADP values");
  }

  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;

  // Calculate R-squared
  let totalSumSquares = 0;
  let residualSumSquares = 0;

  for (let i = 0; i < n; i++) {
    const predicted = slope * xValues[i] + intercept;
    const actualDiffFromMean = yValues[i] - yMean;
    const residual = yValues[i] - predicted;

    totalSumSquares += actualDiffFromMean * actualDiffFromMean;
    residualSumSquares += residual * residual;
  }

  const rSquared =
    totalSumSquares > 0 ? 1 - residualSumSquares / totalSumSquares : 0;

  // Calculate standard error
  const standardError = Math.sqrt(residualSumSquares / (n - 2));

  return {
    slope: Math.round(slope * 10000) / 10000,
    intercept: Math.round(intercept * 100) / 100,
    rSquared: Math.round(rSquared * 10000) / 10000,
    standardError: Math.round(standardError * 100) / 100
  };
}

/**
 * Build regression models for each position
 */
export async function buildPositionalRegressionModels(
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  minPlayersForModel: number = 20
): Promise<PositionalRegressionData[]> {
  try {
    console.log(
      `Building positional regression models for season ${season}...`
    );

    // Get player stats and ADP data
    const [playerStats, adpDataMap] = await Promise.all([
      getPlayerFantasyStats(season, scoringConfig, 20),
      getADPData(season)
    ]);

    if (playerStats.length === 0) {
      console.warn("No player stats found for regression modeling");
      return [];
    }

    // Group players by position with ADP data
    const playersByPosition: Record<
      string,
      Array<{
        player_id: number;
        player_name: string;
        adp: number;
        fantasy_points: number;
      }>
    > = {};

    playerStats.forEach((player) => {
      const adpData = adpDataMap.get(player.player_id);
      if (!adpData) return; // Skip players without ADP data

      const position = player.position_code;
      if (!playersByPosition[position]) {
        playersByPosition[position] = [];
      }

      playersByPosition[position].push({
        player_id: player.player_id,
        player_name: player.player_name,
        adp: adpData.adp,
        fantasy_points: player.fantasy_points_total
      });
    });

    const regressionData: PositionalRegressionData[] = [];

    // Build regression model for each position
    Object.entries(playersByPosition).forEach(([position, players]) => {
      if (players.length < minPlayersForModel) {
        console.warn(
          `Not enough players for ${position} regression model (${players.length} < ${minPlayersForModel})`
        );
        return;
      }

      // Sort by ADP for better analysis
      players.sort((a, b) => a.adp - b.adp);

      // Extract data for regression
      const adpValues = players.map((p) => p.adp);
      const fantasyPointsValues = players.map((p) => p.fantasy_points);

      try {
        // Calculate regression model
        const regression = calculateLinearRegression(
          adpValues,
          fantasyPointsValues
        );

        const model: RegressionModel = {
          slope: regression.slope,
          intercept: regression.intercept,
          r_squared: regression.rSquared,
          standard_error: regression.standardError,
          sample_size: players.length,
          position: position,
          season: season
        };

        // Identify outliers (players with large residuals)
        const outliers = players
          .map((player) => {
            const expectedPoints = model.slope * player.adp + model.intercept;
            const residual = player.fantasy_points - expectedPoints;
            return {
              player_id: player.player_id,
              player_name: player.player_name,
              adp: player.adp,
              actual_points: player.fantasy_points,
              expected_points: Math.round(expectedPoints * 100) / 100,
              residual: Math.round(residual * 100) / 100
            };
          })
          .filter(
            (player) => Math.abs(player.residual) > model.standard_error * 2
          ) // 2+ standard deviations
          .sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual)); // Sort by absolute residual

        regressionData.push({
          position,
          data_points: players.map((player) => ({
            player_id: player.player_id,
            player_name: player.player_name,
            adp: player.adp,
            expected_points: model.slope * player.adp + model.intercept,
            actual_points: player.fantasy_points,
            fantasy_points: player.fantasy_points
          })),
          model,
          outliers
        });

        console.log(
          `${position} regression model: y = ${model.slope.toFixed(4)}x + ${model.intercept.toFixed(2)}, R² = ${model.r_squared.toFixed(4)}`
        );
      } catch (error) {
        console.error(
          `Error building regression model for position ${position}:`,
          error
        );
      }
    });

    console.log(`Built ${regressionData.length} positional regression models`);
    return regressionData;
  } catch (error) {
    console.error("Error building positional regression models:", error);
    throw error;
  }
}

/**
 * Calculate POE score percentile rank
 */
function calculatePOEPercentile(
  playerPOE: number,
  allPOEScores: number[]
): number {
  if (allPOEScores.length === 0) return 50;

  const sortedScores = [...allPOEScores].sort((a, b) => a - b);
  let rank = 0;

  for (let i = 0; i < sortedScores.length; i++) {
    if (sortedScores[i] < playerPOE) {
      rank = i + 1;
    } else {
      break;
    }
  }

  return Math.round((rank / sortedScores.length) * 100 * 100) / 100;
}

/**
 * Determine performance tier based on POE metrics
 */
export function determinePerformanceTier(
  poeScore: number,
  poePercentage: number,
  percentileRank: number,
  zScore: number
):
  | "Elite Overperformer"
  | "Solid Overperformer"
  | "Met Expectations"
  | "Underperformer"
  | "Major Bust" {
  // Elite Overperformer: Top 10% and significantly exceeded expectations
  if (percentileRank >= 90 && poePercentage >= 25 && zScore >= 1.5) {
    return "Elite Overperformer";
  }

  // Solid Overperformer: Top 25% and exceeded expectations
  if (percentileRank >= 75 && poePercentage >= 10 && zScore >= 0.5) {
    return "Solid Overperformer";
  }

  // Met Expectations: Within reasonable range of expectations
  if (
    percentileRank >= 25 &&
    percentileRank <= 75 &&
    Math.abs(poePercentage) <= 15 &&
    Math.abs(zScore) <= 0.75
  ) {
    return "Met Expectations";
  }

  // Major Bust: Bottom 10% and significantly underperformed
  if (percentileRank <= 10 && poePercentage <= -25 && zScore <= -1.5) {
    return "Major Bust";
  }

  // Default to Underperformer
  return "Underperformer";
}

/**
 * Calculate Performance over Expectation (POE) for all players
 */
export async function calculatePOE(
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG,
  minGamesPlayed: number = 20
): Promise<POEResult[]> {
  try {
    console.log(
      `Calculating Performance over Expectation (POE) for season ${season}...`
    );

    // Build regression models for each position
    const regressionModels = await buildPositionalRegressionModels(
      season,
      scoringConfig,
      20 // Minimum players needed for reliable regression
    );

    if (regressionModels.length === 0) {
      console.warn("No regression models built - insufficient data");
      return [];
    }

    // Create model lookup by position
    const modelLookup = regressionModels.reduce(
      (acc, data) => {
        acc[data.position] = data.model;
        return acc;
      },
      {} as Record<string, RegressionModel>
    );

    // Get player stats and ADP data
    const [playerStats, adpDataMap] = await Promise.all([
      getPlayerFantasyStats(season, scoringConfig, minGamesPlayed),
      getADPData(season)
    ]);

    // Get comparison metrics
    const [fparResults, psvResults, vuduResults, bustRateResults] =
      await Promise.all([
        calculateFPAR(season, scoringConfig, leagueConfig, minGamesPlayed),
        calculatePSV(season, scoringConfig, leagueConfig, minGamesPlayed),
        calculateVUDu(season, scoringConfig, leagueConfig, minGamesPlayed),
        calculateBustRate(season, scoringConfig, leagueConfig, minGamesPlayed)
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

    const bustRateLookup = bustRateResults.reduce(
      (acc, bust) => {
        acc[bust.player_id] = bust;
        return acc;
      },
      {} as Record<number, BustRateResult>
    );

    // Calculate POE for each player with ADP and model data
    const poeResults: POEResult[] = [];
    const allPOEScores: number[] = [];

    playerStats.forEach((player) => {
      const adpData = adpDataMap.get(player.player_id);
      const model = modelLookup[player.position_code];

      // Skip players without ADP data or position model
      if (!adpData || !model) {
        return;
      }

      // Calculate expected fantasy points using regression model
      const expectedFantasyPoints = model.slope * adpData.adp + model.intercept;

      // Calculate POE metrics
      const poeScore = player.fantasy_points_total - expectedFantasyPoints;
      const poePercentage =
        expectedFantasyPoints > 0
          ? (player.fantasy_points_total / expectedFantasyPoints - 1) * 100
          : 0;
      const zScore =
        model.standard_error > 0 ? poeScore / model.standard_error : 0;

      allPOEScores.push(poeScore);

      // Get comparison metrics
      const fparData = fparLookup[player.player_id];
      const psvData = psvLookup[player.player_id];
      const vuduData = vuduLookup[player.player_id];
      const bustRateData = bustRateLookup[player.player_id];

      poeResults.push({
        player_id: player.player_id,
        player_name: player.player_name,
        position_code: player.position_code,
        games_played: player.games_played,
        adp: adpData.adp,
        draft_round: adpData.draft_round,
        expected_fantasy_points: Math.round(expectedFantasyPoints * 100) / 100,
        poe_score: Math.round(poeScore * 100) / 100,
        poe_percentage: Math.round(poePercentage * 100) / 100,
        percentile_rank: 0, // Will be calculated after we have all POE scores
        performance_tier: "Met Expectations", // Will be determined after percentile calculation
        regression_confidence: model.r_squared,
        z_score: Math.round(zScore * 100) / 100,
        fpar_total: fparData?.fpar_total || 0,
        psv_score: psvData?.psv_score || 0,
        vudu_score: vuduData?.vudu_score || 0,
        bust_rate_score: bustRateData?.bust_rate_score || 0
      });
    });

    // Calculate percentile ranks and performance tiers
    poeResults.forEach((result) => {
      result.percentile_rank = calculatePOEPercentile(
        result.poe_score,
        allPOEScores
      );
      result.performance_tier = determinePerformanceTier(
        result.poe_score,
        result.poe_percentage,
        result.percentile_rank,
        result.z_score
      );
    });

    // Sort by POE score descending (best overperformers first)
    poeResults.sort((a, b) => b.poe_score - a.poe_score);

    console.log(`POE calculation completed for ${poeResults.length} players`);
    console.log("Regression models used:", Object.keys(modelLookup));

    return poeResults;
  } catch (error) {
    console.error("Error calculating POE:", error);
    throw error;
  }
}

/**
 * Get POE results for specific players
 */
export async function getPOEForPlayers(
  playerIds: number[],
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): Promise<POEResult[]> {
  try {
    // Get full POE results
    const allPOEResults = await calculatePOE(
      season,
      scoringConfig,
      leagueConfig
    );

    // Filter to requested players
    const requestedResults = allPOEResults.filter((result) =>
      playerIds.includes(result.player_id)
    );

    return requestedResults;
  } catch (error) {
    console.error("Error getting POE for specific players:", error);
    throw error;
  }
}

/**
 * Get players by performance tier
 */
export async function getPlayersByPerformanceTier(
  performanceTier:
    | "Elite Overperformer"
    | "Solid Overperformer"
    | "Met Expectations"
    | "Underperformer"
    | "Major Bust",
  season: string = "20242025",
  position?: string,
  limit: number = 50,
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): Promise<POEResult[]> {
  try {
    // Get full POE results
    const allPOEResults = await calculatePOE(
      season,
      scoringConfig,
      leagueConfig
    );

    // Filter by performance tier and position
    let filteredResults = allPOEResults.filter(
      (result) => result.performance_tier === performanceTier
    );

    if (position) {
      filteredResults = filteredResults.filter(
        (result) => result.position_code === position
      );
    }

    // Return top N players (already sorted by POE score)
    return filteredResults.slice(0, limit);
  } catch (error) {
    console.error("Error getting players by performance tier:", error);
    throw error;
  }
}

/**
 * Get top overperformers and underperformers
 */
export async function getTopPlayersByPOE(
  limit: number = 50,
  overperformers: boolean = true,
  season: string = "20242025",
  position?: string,
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG
): Promise<POEResult[]> {
  try {
    // Get full POE results
    const allPOEResults = await calculatePOE(
      season,
      scoringConfig,
      leagueConfig
    );

    // Filter by position if specified
    let filteredResults = allPOEResults;
    if (position) {
      filteredResults = allPOEResults.filter(
        (result) => result.position_code === position
      );
    }

    // Sort by POE score
    if (overperformers) {
      filteredResults.sort((a, b) => b.poe_score - a.poe_score); // Highest POE first
    } else {
      filteredResults.sort((a, b) => a.poe_score - b.poe_score); // Lowest POE first (biggest underperformers)
    }

    // Return top N players
    return filteredResults.slice(0, limit);
  } catch (error) {
    console.error("Error getting top players by POE:", error);
    throw error;
  }
}

/**
 * Get positional regression analysis
 */
export async function getPositionalRegressionAnalysis(
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG
): Promise<PositionalRegressionData[]> {
  try {
    return await buildPositionalRegressionModels(season, scoringConfig);
  } catch (error) {
    console.error("Error getting positional regression analysis:", error);
    throw error;
  }
}
