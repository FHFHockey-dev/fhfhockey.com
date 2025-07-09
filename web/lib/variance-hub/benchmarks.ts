import {
  FantasyScoringConfig,
  LeagueConfig,
  DEFAULT_SCORING_CONFIG,
  DEFAULT_LEAGUE_CONFIG,
  PlayerFantasyStats
} from "./types";
import { getPlayerFantasyStats } from "./core";
import { calculateFPAR, FPARResult } from "./fpar";
import { calculatePSV, PSVResult } from "./psv";
import { calculateVUDu, VUDuResult } from "./vudu";
import { calculateBustRate, BustRateResult } from "./bust";
import { calculatePOE, POEResult } from "./poe";

// ============================================================================
// METRICS AGGREGATION SYSTEM
// ============================================================================

// Types for aggregated metrics
export interface PositionalAverages {
  position: string;
  total_players: number;
  avg_games_played: number;
  avg_fantasy_points_total: number;
  avg_fantasy_points_per_game: number;
  avg_fpar_total: number;
  avg_fpar_per_game: number;
  avg_psv_score: number;
  avg_vudu_score: number;
  avg_bust_rate_score: number;
  avg_poe_score: number;
  avg_expectation_percentage: number;
  top_10_percent_fppg: number;
  median_fppg: number;
  bottom_10_percent_fppg: number;
  std_dev_fppg: number;
  season: string;
  scoring_config_hash: string; // Hash of scoring configuration for caching
}

export interface LeagueAverages {
  total_players: number;
  avg_games_played: number;
  avg_fantasy_points_total: number;
  avg_fantasy_points_per_game: number;
  avg_fpar_total: number;
  avg_fpar_per_game: number;
  avg_psv_score: number;
  avg_vudu_score: number;
  avg_bust_rate_score: number;
  avg_poe_score: number;
  avg_expectation_percentage: number;
  top_10_percent_fppg: number;
  median_fppg: number;
  bottom_10_percent_fppg: number;
  std_dev_fppg: number;
  season: string;
  scoring_config_hash: string;
}

export interface MetricsBenchmark {
  league_averages: LeagueAverages;
  positional_averages: PositionalAverages[];
  tier_thresholds: {
    fpar: {
      elite: number; // Top 10%
      great: number; // Top 25%
      good: number; // Top 50%
      average: number; // Top 75%
      below_average: number; // Bottom 25%
    };
    psv: {
      elite: number;
      great: number;
      good: number;
      average: number;
      below_average: number;
    };
    vudu: {
      very_consistent: number; // Bottom 10% (low volatility)
      consistent: number; // Bottom 25%
      average: number; // Middle 50%
      volatile: number; // Top 25%
      very_volatile: number; // Top 10%
    };
    bust_rate: {
      very_reliable: number; // Bottom 10% (low bust rate)
      reliable: number; // Bottom 25%
      average: number; // Middle 50%
      risky: number; // Top 25%
      very_risky: number; // Top 10%
    };
    poe: {
      major_overperformer: number; // Top 10%
      overperformer: number; // Top 25%
      met_expectations: number; // Middle 50%
      underperformer: number; // Bottom 25%
      major_underperformer: number; // Bottom 10%
    };
  };
  last_updated: string;
}

/**
 * Generate a hash for the scoring configuration to use for caching
 */
function generateScoringConfigHash(config: FantasyScoringConfig): string {
  const configString = JSON.stringify(config);
  // Simple hash function - in production, use a proper hash library
  let hash = 0;
  for (let i = 0; i < configString.length; i++) {
    const char = configString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Calculate statistical percentiles for an array of values
 */
function calculatePercentiles(
  values: number[],
  percentiles: number[]
): number[] {
  if (values.length === 0) return percentiles.map(() => 0);

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  return percentiles.map((p) => {
    const index = (p / 100) * (n - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sorted[lower];
    } else {
      const weight = index - lower;
      return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
  });
}

/**
 * Calculate positional averages for all metrics
 */
export async function calculatePositionalAverages(
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG,
  minGamesPlayed: number = 20
): Promise<PositionalAverages[]> {
  try {
    console.log(`Calculating positional averages for season ${season}...`);

    // Get all metrics data
    const [
      playerStats,
      fparResults,
      psvResults,
      vuduResults,
      bustRateResults,
      poeResults
    ] = await Promise.all([
      getPlayerFantasyStats(season, scoringConfig, 20),
      calculateFPAR(season, scoringConfig, leagueConfig, minGamesPlayed),
      calculatePSV(season, scoringConfig, leagueConfig, minGamesPlayed),
      calculateVUDu(season, scoringConfig, leagueConfig, minGamesPlayed),
      calculateBustRate(season, scoringConfig, leagueConfig, minGamesPlayed),
      calculatePOE(season, scoringConfig, leagueConfig, minGamesPlayed)
    ]);

    // Create lookup maps for each metric
    const fparLookup = fparResults.reduce(
      (acc, item) => {
        acc[item.player_id] = item;
        return acc;
      },
      {} as Record<number, FPARResult>
    );

    const psvLookup = psvResults.reduce(
      (acc, item) => {
        acc[item.player_id] = item;
        return acc;
      },
      {} as Record<number, PSVResult>
    );

    const vuduLookup = vuduResults.reduce(
      (acc, item) => {
        acc[item.player_id] = item;
        return acc;
      },
      {} as Record<number, VUDuResult>
    );

    const bustRateLookup = bustRateResults.reduce(
      (acc, item) => {
        acc[item.player_id] = item;
        return acc;
      },
      {} as Record<number, BustRateResult>
    );

    const poeLookup = poeResults.reduce(
      (acc, item) => {
        acc[item.player_id] = item;
        return acc;
      },
      {} as Record<number, POEResult>
    );

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

    const positionalAverages: PositionalAverages[] = [];
    const configHash = generateScoringConfigHash(scoringConfig);

    // Calculate averages for each position
    Object.entries(playersByPosition).forEach(([position, players]) => {
      if (players.length === 0) return;

      // Collect all values for this position
      const gamesPlayed = players.map((p) => p.games_played);
      const fantasyPointsTotal = players.map((p) => p.fantasy_points_total);
      const fantasyPointsPerGame = players.map(
        (p) => p.fantasy_points_per_game
      );

      const fparTotal = players.map(
        (p) => fparLookup[p.player_id]?.fpar_total || 0
      );
      const fparPerGame = players.map(
        (p) => fparLookup[p.player_id]?.fpar_per_game || 0
      );
      const psvScores = players.map(
        (p) => psvLookup[p.player_id]?.psv_score || 0
      );
      const vuduScores = players.map(
        (p) => vuduLookup[p.player_id]?.vudu_score || 0
      );
      const bustRateScores = players.map(
        (p) => bustRateLookup[p.player_id]?.bust_rate_score || 0
      );
      const poeScores = players.map(
        (p) => poeLookup[p.player_id]?.poe_score || 0
      );
      const expectationPercentages = players.map(
        (p) => bustRateLookup[p.player_id]?.expectation_percentage || 100
      );

      // Calculate averages
      const avgGamesPlayed =
        gamesPlayed.reduce((sum, val) => sum + val, 0) / players.length;
      const avgFantasyPointsTotal =
        fantasyPointsTotal.reduce((sum, val) => sum + val, 0) / players.length;
      const avgFantasyPointsPerGame =
        fantasyPointsPerGame.reduce((sum, val) => sum + val, 0) /
        players.length;
      const avgFparTotal =
        fparTotal.reduce((sum, val) => sum + val, 0) / players.length;
      const avgFparPerGame =
        fparPerGame.reduce((sum, val) => sum + val, 0) / players.length;
      const avgPsvScore =
        psvScores.reduce((sum, val) => sum + val, 0) / players.length;
      const avgVuduScore =
        vuduScores.reduce((sum, val) => sum + val, 0) / players.length;
      const avgBustRateScore =
        bustRateScores.reduce((sum, val) => sum + val, 0) / players.length;
      const avgPoeScore =
        poeScores.reduce((sum, val) => sum + val, 0) / players.length;
      const avgExpectationPercentage =
        expectationPercentages.reduce((sum, val) => sum + val, 0) /
        players.length;

      // Calculate percentiles and standard deviation for FPPG
      const [top10, median, bottom10] = calculatePercentiles(
        fantasyPointsPerGame,
        [90, 50, 10]
      );

      // Calculate standard deviation
      const meanFppg = avgFantasyPointsPerGame;
      const variance =
        fantasyPointsPerGame.reduce(
          (sum, val) => sum + Math.pow(val - meanFppg, 2),
          0
        ) / players.length;
      const stdDev = Math.sqrt(variance);

      positionalAverages.push({
        position,
        total_players: players.length,
        avg_games_played: Math.round(avgGamesPlayed * 100) / 100,
        avg_fantasy_points_total: Math.round(avgFantasyPointsTotal * 100) / 100,
        avg_fantasy_points_per_game:
          Math.round(avgFantasyPointsPerGame * 100) / 100,
        avg_fpar_total: Math.round(avgFparTotal * 100) / 100,
        avg_fpar_per_game: Math.round(avgFparPerGame * 100) / 100,
        avg_psv_score: Math.round(avgPsvScore * 100) / 100,
        avg_vudu_score: Math.round(avgVuduScore * 100) / 100,
        avg_bust_rate_score: Math.round(avgBustRateScore * 100) / 100,
        avg_poe_score: Math.round(avgPoeScore * 100) / 100,
        avg_expectation_percentage:
          Math.round(avgExpectationPercentage * 100) / 100,
        top_10_percent_fppg: Math.round(top10 * 100) / 100,
        median_fppg: Math.round(median * 100) / 100,
        bottom_10_percent_fppg: Math.round(bottom10 * 100) / 100,
        std_dev_fppg: Math.round(stdDev * 100) / 100,
        season,
        scoring_config_hash: configHash
      });
    });

    console.log(
      `Positional averages calculated for ${positionalAverages.length} positions`
    );
    return positionalAverages;
  } catch (error) {
    console.error("Error calculating positional averages:", error);
    throw error;
  }
}

/**
 * Calculate league-wide averages for all metrics
 */
export async function calculateLeagueAverages(
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG,
  minGamesPlayed: number = 20
): Promise<LeagueAverages> {
  try {
    console.log(`Calculating league averages for season ${season}...`);

    // Get all metrics data
    const [
      playerStats,
      fparResults,
      psvResults,
      vuduResults,
      bustRateResults,
      poeResults
    ] = await Promise.all([
      getPlayerFantasyStats(season, scoringConfig, minGamesPlayed),
      calculateFPAR(season, scoringConfig, leagueConfig, minGamesPlayed),
      calculatePSV(season, scoringConfig, leagueConfig, minGamesPlayed),
      calculateVUDu(season, scoringConfig, leagueConfig, minGamesPlayed),
      calculateBustRate(season, scoringConfig, leagueConfig, minGamesPlayed),
      calculatePOE(season, scoringConfig, leagueConfig, minGamesPlayed)
    ]);

    // Create lookup maps for each metric
    const fparLookup = fparResults.reduce(
      (acc, item) => {
        acc[item.player_id] = item;
        return acc;
      },
      {} as Record<number, FPARResult>
    );

    const psvLookup = psvResults.reduce(
      (acc, item) => {
        acc[item.player_id] = item;
        return acc;
      },
      {} as Record<number, PSVResult>
    );

    const vuduLookup = vuduResults.reduce(
      (acc, item) => {
        acc[item.player_id] = item;
        return acc;
      },
      {} as Record<number, VUDuResult>
    );

    const bustRateLookup = bustRateResults.reduce(
      (acc, item) => {
        acc[item.player_id] = item;
        return acc;
      },
      {} as Record<number, BustRateResult>
    );

    const poeLookup = poeResults.reduce(
      (acc, item) => {
        acc[item.player_id] = item;
        return acc;
      },
      {} as Record<number, POEResult>
    );

    // Collect all values league-wide
    const gamesPlayed = playerStats.map((p) => p.games_played);
    const fantasyPointsTotal = playerStats.map((p) => p.fantasy_points_total);
    const fantasyPointsPerGame = playerStats.map(
      (p) => p.fantasy_points_per_game
    );

    const fparTotal = playerStats.map(
      (p) => fparLookup[p.player_id]?.fpar_total || 0
    );
    const fparPerGame = playerStats.map(
      (p) => fparLookup[p.player_id]?.fpar_per_game || 0
    );
    const psvScores = playerStats.map(
      (p) => psvLookup[p.player_id]?.psv_score || 0
    );
    const vuduScores = playerStats.map(
      (p) => vuduLookup[p.player_id]?.vudu_score || 0
    );
    const bustRateScores = playerStats.map(
      (p) => bustRateLookup[p.player_id]?.bust_rate_score || 0
    );
    const poeScores = playerStats.map(
      (p) => poeLookup[p.player_id]?.poe_score || 0
    );
    const expectationPercentages = playerStats.map(
      (p) => bustRateLookup[p.player_id]?.expectation_percentage || 100
    );

    // Calculate league averages
    const avgGamesPlayed =
      gamesPlayed.reduce((sum, val) => sum + val, 0) / playerStats.length;
    const avgFantasyPointsTotal =
      fantasyPointsTotal.reduce((sum, val) => sum + val, 0) /
      playerStats.length;
    const avgFantasyPointsPerGame =
      fantasyPointsPerGame.reduce((sum, val) => sum + val, 0) /
      playerStats.length;
    const avgFparTotal =
      fparTotal.reduce((sum, val) => sum + val, 0) / playerStats.length;
    const avgFparPerGame =
      fparPerGame.reduce((sum, val) => sum + val, 0) / playerStats.length;
    const avgPsvScore =
      psvScores.reduce((sum, val) => sum + val, 0) / playerStats.length;
    const avgVuduScore =
      vuduScores.reduce((sum, val) => sum + val, 0) / playerStats.length;
    const avgBustRateScore =
      bustRateScores.reduce((sum, val) => sum + val, 0) / playerStats.length;
    const avgPoeScore =
      poeScores.reduce((sum, val) => sum + val, 0) / playerStats.length;
    const avgExpectationPercentage =
      expectationPercentages.reduce((sum, val) => sum + val, 0) /
      playerStats.length;

    // Calculate percentiles and standard deviation for FPPG
    const [top10, median, bottom10] = calculatePercentiles(
      fantasyPointsPerGame,
      [90, 50, 10]
    );

    // Calculate standard deviation
    const meanFppg = avgFantasyPointsPerGame;
    const variance =
      fantasyPointsPerGame.reduce(
        (sum, val) => sum + Math.pow(val - meanFppg, 2),
        0
      ) / playerStats.length;
    const stdDev = Math.sqrt(variance);

    const configHash = generateScoringConfigHash(scoringConfig);

    const leagueAverages: LeagueAverages = {
      total_players: playerStats.length,
      avg_games_played: Math.round(avgGamesPlayed * 100) / 100,
      avg_fantasy_points_total: Math.round(avgFantasyPointsTotal * 100) / 100,
      avg_fantasy_points_per_game:
        Math.round(avgFantasyPointsPerGame * 100) / 100,
      avg_fpar_total: Math.round(avgFparTotal * 100) / 100,
      avg_fpar_per_game: Math.round(avgFparPerGame * 100) / 100,
      avg_psv_score: Math.round(avgPsvScore * 100) / 100,
      avg_vudu_score: Math.round(avgVuduScore * 100) / 100,
      avg_bust_rate_score: Math.round(avgBustRateScore * 100) / 100,
      avg_poe_score: Math.round(avgPoeScore * 100) / 100,
      avg_expectation_percentage:
        Math.round(avgExpectationPercentage * 100) / 100,
      top_10_percent_fppg: Math.round(top10 * 100) / 100,
      median_fppg: Math.round(median * 100) / 100,
      bottom_10_percent_fppg: Math.round(bottom10 * 100) / 100,
      std_dev_fppg: Math.round(stdDev * 100) / 100,
      season,
      scoring_config_hash: configHash
    };

    console.log(`League averages calculated for ${playerStats.length} players`);
    return leagueAverages;
  } catch (error) {
    console.error("Error calculating league averages:", error);
    throw error;
  }
}

/**
 * Calculate tier thresholds for all metrics
 */
export async function calculateTierThresholds(
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG,
  minGamesPlayed: number = 20
): Promise<MetricsBenchmark["tier_thresholds"]> {
  try {
    console.log(`Calculating tier thresholds for season ${season}...`);

    // Get all metrics data
    const [fparResults, psvResults, vuduResults, bustRateResults, poeResults] =
      await Promise.all([
        calculateFPAR(season, scoringConfig, leagueConfig, minGamesPlayed),
        calculatePSV(season, scoringConfig, leagueConfig, minGamesPlayed),
        calculateVUDu(season, scoringConfig, leagueConfig, minGamesPlayed),
        calculateBustRate(season, scoringConfig, leagueConfig, minGamesPlayed),
        calculatePOE(season, scoringConfig, leagueConfig, minGamesPlayed)
      ]);

    // Extract metric values
    const fparTotals = fparResults.map((r) => r.fpar_total);
    const psvScores = psvResults.map((r) => r.psv_score);
    const vuduScores = vuduResults.map((r) => r.vudu_score);
    const bustRateScores = bustRateResults.map((r) => r.bust_rate_score);
    const poeScores = poeResults.map((r) => r.poe_score);

    // Calculate percentile thresholds
    const fparThresholds = calculatePercentiles(
      fparTotals,
      [90, 75, 50, 25, 10]
    );
    const psvThresholds = calculatePercentiles(psvScores, [90, 75, 50, 25, 10]);
    const vuduThresholds = calculatePercentiles(
      vuduScores,
      [10, 25, 50, 75, 90]
    ); // Reversed (lower = better)
    const bustRateThresholds = calculatePercentiles(
      bustRateScores,
      [10, 25, 50, 75, 90]
    ); // Reversed (lower = better)
    const poeThresholds = calculatePercentiles(poeScores, [90, 75, 50, 25, 10]);

    const tierThresholds: MetricsBenchmark["tier_thresholds"] = {
      fpar: {
        elite: fparThresholds[0],
        great: fparThresholds[1],
        good: fparThresholds[2],
        average: fparThresholds[3],
        below_average: fparThresholds[4]
      },
      psv: {
        elite: psvThresholds[0],
        great: psvThresholds[1],
        good: psvThresholds[2],
        average: psvThresholds[3],
        below_average: psvThresholds[4]
      },
      vudu: {
        very_consistent: vuduThresholds[0],
        consistent: vuduThresholds[1],
        average: vuduThresholds[2],
        volatile: vuduThresholds[3],
        very_volatile: vuduThresholds[4]
      },
      bust_rate: {
        very_reliable: bustRateThresholds[0],
        reliable: bustRateThresholds[1],
        average: bustRateThresholds[2],
        risky: bustRateThresholds[3],
        very_risky: bustRateThresholds[4]
      },
      poe: {
        major_overperformer: poeThresholds[0],
        overperformer: poeThresholds[1],
        met_expectations: poeThresholds[2],
        underperformer: poeThresholds[3],
        major_underperformer: poeThresholds[4]
      }
    };

    console.log("Tier thresholds calculated");
    return tierThresholds;
  } catch (error) {
    console.error("Error calculating tier thresholds:", error);
    throw error;
  }
}

/**
 * Generate comprehensive metrics benchmark with all aggregated data
 */
export async function generateMetricsBenchmark(
  season: string = "20242025",
  scoringConfig: FantasyScoringConfig = DEFAULT_SCORING_CONFIG,
  leagueConfig: LeagueConfig = DEFAULT_LEAGUE_CONFIG,
  minGamesPlayed: number = 20
): Promise<MetricsBenchmark> {
  try {
    console.log(`Generating metrics benchmark for season ${season}...`);

    // Calculate all components in parallel
    const [leagueAverages, positionalAverages, tierThresholds] =
      await Promise.all([
        calculateLeagueAverages(
          season,
          scoringConfig,
          leagueConfig,
          minGamesPlayed
        ),
        calculatePositionalAverages(
          season,
          scoringConfig,
          leagueConfig,
          minGamesPlayed
        ),
        calculateTierThresholds(
          season,
          scoringConfig,
          leagueConfig,
          minGamesPlayed
        )
      ]);

    const benchmark: MetricsBenchmark = {
      league_averages: leagueAverages,
      positional_averages: positionalAverages,
      tier_thresholds: tierThresholds,
      last_updated: new Date().toISOString()
    };

    console.log(`Metrics benchmark generated successfully`);
    return benchmark;
  } catch (error) {
    console.error("Error generating metrics benchmark:", error);
    throw error;
  }
}

/**
 * Get player tier classification for a specific metric
 */
export function getPlayerTier(
  playerValue: number,
  metric: "fpar" | "psv" | "vudu" | "bust_rate" | "poe",
  tierThresholds: MetricsBenchmark["tier_thresholds"]
): string {
  switch (metric) {
    case "fpar": {
      const thresholds = tierThresholds.fpar;
      if (playerValue >= thresholds.elite) return "Elite";
      if (playerValue >= thresholds.great) return "Great";
      if (playerValue >= thresholds.good) return "Good";
      if (playerValue >= thresholds.average) return "Average";
      return "Below Average";
    }
    case "psv": {
      const thresholds = tierThresholds.psv;
      if (playerValue >= thresholds.elite) return "Elite";
      if (playerValue >= thresholds.great) return "Great";
      if (playerValue >= thresholds.good) return "Good";
      if (playerValue >= thresholds.average) return "Average";
      return "Below Average";
    }
    case "poe": {
      const thresholds = tierThresholds.poe;
      if (playerValue >= thresholds.major_overperformer)
        return "Major Overperformer";
      if (playerValue >= thresholds.overperformer) return "Overperformer";
      if (playerValue >= thresholds.met_expectations) return "Met Expectations";
      if (playerValue >= thresholds.underperformer) return "Underperformer";
      return "Major Underperformer";
    }
    case "vudu": {
      const thresholds = tierThresholds.vudu;
      if (playerValue <= thresholds.very_consistent) return "Very Consistent";
      if (playerValue <= thresholds.consistent) return "Consistent";
      if (playerValue <= thresholds.average) return "Average";
      if (playerValue <= thresholds.volatile) return "Volatile";
      return "Very Volatile";
    }
    case "bust_rate": {
      const thresholds = tierThresholds.bust_rate;
      if (playerValue <= thresholds.very_reliable) return "Very Reliable";
      if (playerValue <= thresholds.reliable) return "Reliable";
      if (playerValue <= thresholds.average) return "Average";
      if (playerValue <= thresholds.risky) return "Risky";
      return "Very Risky";
    }
    default:
      return "Unknown";
  }
}

/**
 * Get positional ranking for a player in a specific metric
 */
export function getPositionalRanking(
  playerValue: number,
  position: string,
  metric:
    | "fantasy_points_per_game"
    | "fpar_total"
    | "psv_score"
    | "vudu_score"
    | "bust_rate_score"
    | "poe_score",
  positionalAverages: PositionalAverages[]
): {
  percentile: number;
  rank_description: string;
  position_average: number;
} {
  const positionData = positionalAverages.find((p) => p.position === position);

  if (!positionData) {
    return {
      percentile: 50,
      rank_description: "Unknown Position",
      position_average: 0
    };
  }

  let positionAverage: number;
  let rankDescription: string;

  // Get the appropriate average and calculate rough percentile
  switch (metric) {
    case "fantasy_points_per_game":
      positionAverage = positionData.avg_fantasy_points_per_game;
      break;
    case "fpar_total":
      positionAverage = positionData.avg_fpar_total;
      break;
    case "psv_score":
      positionAverage = positionData.avg_psv_score;
      break;
    case "vudu_score":
      positionAverage = positionData.avg_vudu_score;
      break;
    case "bust_rate_score":
      positionAverage = positionData.avg_bust_rate_score;
      break;
    case "poe_score":
      positionAverage = positionData.avg_poe_score;
      break;
    default:
      positionAverage = 0;
  }

  // Calculate rough percentile based on standard deviation
  const stdDev = positionData.std_dev_fppg; // Using FPPG std dev as proxy
  const zScore = (playerValue - positionAverage) / stdDev;

  // Convert z-score to percentile (approximate)
  let percentile = 50;
  if (zScore >= 2) percentile = 97;
  else if (zScore >= 1.5) percentile = 93;
  else if (zScore >= 1) percentile = 84;
  else if (zScore >= 0.5) percentile = 69;
  else if (zScore >= 0) percentile = 50;
  else if (zScore >= -0.5) percentile = 31;
  else if (zScore >= -1) percentile = 16;
  else if (zScore >= -1.5) percentile = 7;
  else percentile = 3;

  // Generate rank description
  if (percentile >= 90) rankDescription = "Elite";
  else if (percentile >= 75) rankDescription = "Great";
  else if (percentile >= 60) rankDescription = "Good";
  else if (percentile >= 40) rankDescription = "Average";
  else if (percentile >= 25) rankDescription = "Below Average";
  else rankDescription = "Poor";

  return {
    percentile: Math.round(percentile),
    rank_description: rankDescription,
    position_average: Math.round(positionAverage * 100) / 100
  };
}
