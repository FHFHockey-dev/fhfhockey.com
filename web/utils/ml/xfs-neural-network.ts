// utils/ml/xfs-neural-network.ts
// Advanced xFS (Expected Fantasy Score) Neural Network Implementation

import * as tf from "@tensorflow/tfjs-node";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Types for neural network input/output
export interface XFSFeatures {
  // Recent Performance (10 games rolling)
  recent_goals_per_game: number;
  recent_assists_per_game: number;
  recent_shots_per_game: number;
  recent_hits_per_game: number;
  recent_blocks_per_game: number;
  recent_toi_per_game: number;
  recent_pp_toi_per_game: number;
  recent_shooting_pct: number;
  recent_fantasy_score_per_game: number;
  performance_trend_slope: number; // Linear regression slope of last 10 games

  // Seasonal Context
  games_played: number;
  season_progress_pct: number; // How far through season (0-1)
  home_away_split_diff: number; // Home fantasy score - away fantasy score
  back_to_back_performance_ratio: number; // B2B fantasy score / normal fantasy score
  rest_days_avg: number;

  // Opponent Strength Metrics
  opponent_goals_against_per_game: number;
  opponent_shots_against_per_game: number;
  opponent_penalty_kill_pct: number;
  opponent_defensive_rating: number; // Composite defensive metric
  opponent_allow_pp_opportunities: number;

  // Linemate Quality (weighted by TOI together)
  linemate_avg_fantasy_score: number;
  pp_unit_total_fantasy_score: number;
  line_chemistry_stability: number; // Games together / total games
  linemate_injury_impact: number; // Reduction due to injured linemates

  // Player-Specific Factors
  position_multiplier: number; // Position-specific fantasy scoring tendency
  age_factor: number; // Age-based performance curve
  injury_games_missed_this_season: number;
  games_since_last_injury: number;
  recent_ice_time_trend: number; // TOI trend over last 10 games

  // Advanced Metrics
  corsi_for_pct: number;
  fenwick_for_pct: number;
  zone_start_pct: number;
  pdo: number; // On-ice shooting% + on-ice save%
  relative_corsi: number;

  // Scheduling Factors
  games_in_next_week: number;
  upcoming_opponent_strength_avg: number;
  travel_fatigue_factor: number; // Based on upcoming travel distance
}

export interface XFSPrediction {
  xfs_score: number;
  min_xfs: number;
  max_xfs: number;
  confidence_interval: number;
  feature_importance: Record<string, number>;
}

export class XFSNeuralNetwork {
  private model: tf.Sequential | null = null;
  private featureScaler: { mean: number[]; std: number[] } | null = null;
  private isTraining = false;

  constructor() {
    this.initializeModel();
  }

  /**
   * Initialize the neural network architecture
   */
  private initializeModel(): void {
    this.model = tf.sequential({
      layers: [
        // Input layer - 35 features
        tf.layers.dense({
          inputShape: [35],
          units: 64,
          activation: "relu",
          kernelInitializer: "heNormal",
          name: "input_layer"
        }),

        // Dropout for regularization
        tf.layers.dropout({ rate: 0.3 }),

        // Hidden layer 1
        tf.layers.dense({
          units: 32,
          activation: "relu",
          kernelInitializer: "heNormal",
          name: "hidden_layer_1"
        }),

        // Dropout for regularization
        tf.layers.dropout({ rate: 0.2 }),

        // Hidden layer 2
        tf.layers.dense({
          units: 16,
          activation: "relu",
          kernelInitializer: "heNormal",
          name: "hidden_layer_2"
        }),

        // Output layer - 3 outputs: [mean_xfs, uncertainty, trend]
        tf.layers.dense({
          units: 3,
          activation: "linear",
          name: "output_layer"
        })
      ]
    });

    // Compile the model with appropriate loss function and optimizer
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "meanSquaredError",
      metrics: ["meanAbsoluteError"]
    });
  }

  /**
   * Extract features for a specific player and prediction horizon
   */
  async extractFeatures(
    playerId: number,
    predictionDate: string,
    predictionHorizon: number
  ): Promise<XFSFeatures | null> {
    try {
      // Get recent game logs (last 15 games for trend analysis)
      const { data: recentGames } = await supabase
        .from("wgo_skater_stats")
        .select("*")
        .eq("player_id", playerId)
        .lte("date", predictionDate)
        .order("date", { ascending: false })
        .limit(15);

      if (!recentGames || recentGames.length < 5) {
        console.log(`Insufficient game data for player ${playerId}`);
        return null;
      }

      // Get season totals for context
      const currentSeason = "20242025";
      const { data: seasonStats } = await supabase
        .from("wgo_skater_stats_totals")
        .select("*")
        .eq("player_id", playerId)
        .eq("season", currentSeason)
        .single();

      if (!seasonStats) {
        console.log(`No season stats found for player ${playerId}`);
        return null;
      }

      // Calculate recent performance metrics (last 10 games)
      const last10Games = recentGames.slice(0, 10);
      const recentPerformance = this.calculateRecentPerformance(last10Games);

      // Calculate seasonal context
      const seasonalContext = this.calculateSeasonalContext(
        seasonStats,
        predictionDate
      );

      // Get opponent strength (simplified for now - would need upcoming schedule data)
      const opponentStrength = await this.calculateOpponentStrength(
        playerId,
        predictionDate
      );

      // Calculate linemate quality (simplified - would need line combination data)
      const linemateQuality = await this.calculateLinemateQuality(
        playerId,
        predictionDate
      );

      // Calculate player-specific factors
      const playerFactors = this.calculatePlayerFactors(
        seasonStats,
        recentGames
      );

      // Get advanced metrics from NST data if available
      const advancedMetrics = await this.getAdvancedMetrics(
        playerId,
        predictionDate
      );

      // Combine all features with defaults for any undefined values
      const features: XFSFeatures = {
        // Recent Performance defaults
        recent_goals_per_game: 0,
        recent_assists_per_game: 0,
        recent_shots_per_game: 0,
        recent_hits_per_game: 0,
        recent_blocks_per_game: 0,
        recent_toi_per_game: 0,
        recent_pp_toi_per_game: 0,
        recent_shooting_pct: 0,
        recent_fantasy_score_per_game: 0,
        performance_trend_slope: 0,

        // Seasonal Context defaults
        games_played: 0,
        season_progress_pct: 0,
        home_away_split_diff: 0,
        back_to_back_performance_ratio: 1.0,
        rest_days_avg: 1.5,

        // Opponent Strength defaults
        opponent_goals_against_per_game: 3.0,
        opponent_shots_against_per_game: 30.0,
        opponent_penalty_kill_pct: 0.8,
        opponent_defensive_rating: 0.5,
        opponent_allow_pp_opportunities: 3.5,

        // Linemate Quality defaults
        linemate_avg_fantasy_score: 12.0,
        pp_unit_total_fantasy_score: 45.0,
        line_chemistry_stability: 0.7,
        linemate_injury_impact: 1.0,

        // Player-Specific defaults
        position_multiplier: 1.0,
        age_factor: 1.0,
        injury_games_missed_this_season: 0,
        games_since_last_injury: 100,
        recent_ice_time_trend: 0,

        // Advanced Metrics defaults
        corsi_for_pct: 0.5,
        fenwick_for_pct: 0.5,
        zone_start_pct: 0.5,
        pdo: 1.0,
        relative_corsi: 0,

        // Scheduling factors
        games_in_next_week: predictionHorizon <= 7 ? predictionHorizon : 7,
        upcoming_opponent_strength_avg: 0.5,
        travel_fatigue_factor: 1.0,

        // Override defaults with actual calculated values
        ...recentPerformance,
        ...seasonalContext,
        ...opponentStrength,
        ...linemateQuality,
        ...playerFactors,
        ...advancedMetrics
      };

      return features;
    } catch (error) {
      console.error(`Error extracting features for player ${playerId}:`, error);
      return null;
    }
  }

  /**
   * Calculate recent performance metrics from game logs
   */
  private calculateRecentPerformance(recentGames: any[]): Partial<XFSFeatures> {
    if (recentGames.length === 0) {
      return {};
    }

    const games = recentGames.slice(0, 10); // Last 10 games
    const fantasyScores = games.map(
      (game) =>
        (game.goals || 0) * 6 +
        (game.assists || 0) * 4 +
        (game.shots || 0) * 0.9 +
        (game.hits || 0) * 0.5 +
        (game.blocked_shots || 0) * 1
    );

    // Calculate trend using linear regression
    const trend = this.calculateTrendSlope(fantasyScores);

    return {
      recent_goals_per_game:
        games.reduce((sum, g) => sum + (g.goals || 0), 0) / games.length,
      recent_assists_per_game:
        games.reduce((sum, g) => sum + (g.assists || 0), 0) / games.length,
      recent_shots_per_game:
        games.reduce((sum, g) => sum + (g.shots || 0), 0) / games.length,
      recent_hits_per_game:
        games.reduce((sum, g) => sum + (g.hits || 0), 0) / games.length,
      recent_blocks_per_game:
        games.reduce((sum, g) => sum + (g.blocked_shots || 0), 0) /
        games.length,
      recent_toi_per_game:
        games.reduce((sum, g) => sum + (g.toi_per_game || 0), 0) / games.length,
      recent_pp_toi_per_game:
        games.reduce((sum, g) => sum + (g.pp_toi_per_game || 0), 0) /
        games.length,
      recent_shooting_pct:
        games.reduce((sum, g) => sum + (g.shooting_percentage || 0), 0) /
        games.length,
      recent_fantasy_score_per_game:
        fantasyScores.reduce((sum, score) => sum + score, 0) /
        fantasyScores.length,
      performance_trend_slope: trend
    };
  }

  /**
   * Calculate seasonal context metrics
   */
  private calculateSeasonalContext(
    seasonStats: any,
    predictionDate: string
  ): Partial<XFSFeatures> {
    const seasonStart = new Date("2024-10-01");
    const seasonEnd = new Date("2025-04-30");
    const currentDate = new Date(predictionDate);

    const seasonProgress =
      (currentDate.getTime() - seasonStart.getTime()) /
      (seasonEnd.getTime() - seasonStart.getTime());

    return {
      games_played: seasonStats.games_played || 0,
      season_progress_pct: Math.max(0, Math.min(1, seasonProgress)),
      home_away_split_diff: 0, // Would need home/away splits data
      back_to_back_performance_ratio: 1.0, // Would need B2B analysis
      rest_days_avg: 1.5 // Placeholder average
    };
  }

  /**
   * Calculate opponent strength metrics
   */
  private async calculateOpponentStrength(
    playerId: number,
    predictionDate: string
  ): Promise<Partial<XFSFeatures>> {
    // This would require upcoming schedule data and opponent team stats
    // For now, returning placeholders
    return {
      opponent_goals_against_per_game: 3.0,
      opponent_shots_against_per_game: 30.0,
      opponent_penalty_kill_pct: 0.8,
      opponent_defensive_rating: 0.5,
      opponent_allow_pp_opportunities: 3.5
    };
  }

  /**
   * Calculate linemate quality metrics
   */
  private async calculateLinemateQuality(
    playerId: number,
    predictionDate: string
  ): Promise<Partial<XFSFeatures>> {
    // This would require line combination data
    // For now, returning placeholders
    return {
      linemate_avg_fantasy_score: 12.0,
      pp_unit_total_fantasy_score: 45.0,
      line_chemistry_stability: 0.7,
      linemate_injury_impact: 1.0
    };
  }

  /**
   * Calculate player-specific factors
   */
  private calculatePlayerFactors(
    seasonStats: any,
    recentGames: any[]
  ): Partial<XFSFeatures> {
    const position = seasonStats.position_code || "C";
    const positionMultiplier = this.getPositionMultiplier(position);

    // Age factor (would need birth date data)
    const ageFactor = 1.0; // Placeholder

    return {
      position_multiplier: positionMultiplier,
      age_factor: ageFactor,
      injury_games_missed_this_season: 0, // Would need injury data
      games_since_last_injury: 100, // Placeholder
      recent_ice_time_trend: this.calculateIceTimeTrend(recentGames)
    };
  }

  /**
   * Get advanced metrics from NST data
   */
  private async getAdvancedMetrics(
    playerId: number,
    predictionDate: string
  ): Promise<Partial<XFSFeatures>> {
    // Would integrate with NST advanced stats tables
    return {
      corsi_for_pct: 0.52,
      fenwick_for_pct: 0.51,
      zone_start_pct: 0.55,
      pdo: 1.01,
      relative_corsi: 2.5
    };
  }

  /**
   * Helper function to calculate trend slope using linear regression
   */
  private calculateTrendSlope(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }

  /**
   * Get position-specific multiplier for fantasy scoring
   */
  private getPositionMultiplier(position: string): number {
    const multipliers: Record<string, number> = {
      C: 1.1, // Centers typically score more
      LW: 1.05, // Wings score well
      RW: 1.05,
      D: 0.8, // Defensemen score less but get more hits/blocks
      G: 0.3 // Goalies have different scoring entirely
    };
    return multipliers[position] || 1.0;
  }

  /**
   * Calculate ice time trend over recent games
   */
  private calculateIceTimeTrend(recentGames: any[]): number {
    if (recentGames.length < 3) return 0;

    const toiValues = recentGames
      .slice(0, 10)
      .map((game) => game.toi_per_game || 0)
      .filter((toi) => toi > 0);

    return this.calculateTrendSlope(toiValues);
  }

  /**
   * Normalize features for neural network input
   */
  private normalizeFeatures(features: XFSFeatures): number[] {
    const featureArray = Object.values(features);

    if (!this.featureScaler) {
      // Would load pre-computed scaler parameters in production
      // For now, using placeholder normalization
      return featureArray.map((val) => Math.max(-2, Math.min(2, val / 10)));
    }

    // Apply learned normalization
    return featureArray.map(
      (val, i) =>
        (val - this.featureScaler!.mean[i]) / this.featureScaler!.std[i]
    );
  }

  /**
   * Make xFS prediction using the neural network
   */
  async predict(
    playerId: number,
    predictionDate: string,
    predictionHorizon: number
  ): Promise<XFSPrediction | null> {
    if (!this.model) {
      console.error("Neural network model not initialized");
      return null;
    }

    try {
      // Extract features
      const features = await this.extractFeatures(
        playerId,
        predictionDate,
        predictionHorizon
      );
      if (!features) {
        return null;
      }

      // Normalize features
      const normalizedFeatures = this.normalizeFeatures(features);

      // Create tensor and make prediction
      const inputTensor = tf.tensor2d([normalizedFeatures]);
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const predictionData = await prediction.data();

      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();

      // Extract outputs: [mean_xfs, uncertainty, trend]
      const meanXFS = predictionData[0];
      const uncertainty = Math.abs(predictionData[1]);
      const trend = predictionData[2];

      // Calculate min/max based on uncertainty
      const minXFS = Math.max(0, meanXFS - uncertainty * 1.96); // 95% confidence interval
      const maxXFS = meanXFS + uncertainty * 1.96;

      // Calculate confidence based on data quality and model uncertainty
      const confidence = Math.max(
        0.5,
        Math.min(0.95, 1 - uncertainty / meanXFS)
      );

      // Feature importance would require additional analysis (SHAP values, etc.)
      const featureImportance: Record<string, number> = {
        recent_performance: 0.3,
        opponent_strength: 0.2,
        linemate_quality: 0.15,
        seasonal_context: 0.15,
        advanced_metrics: 0.1,
        player_factors: 0.1
      };

      return {
        xfs_score: Math.round(meanXFS * 100) / 100,
        min_xfs: Math.round(minXFS * 100) / 100,
        max_xfs: Math.round(maxXFS * 100) / 100,
        confidence_interval: Math.round(confidence * 100) / 100,
        feature_importance: featureImportance
      };
    } catch (error) {
      console.error(
        `Error making xFS prediction for player ${playerId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Train the neural network on historical data
   */
  async train(trainingData: {
    features: XFSFeatures[];
    targets: number[][];
  }): Promise<void> {
    if (!this.model || this.isTraining) {
      console.error("Model not ready for training or already training");
      return;
    }

    this.isTraining = true;

    try {
      console.log(
        `Training neural network on ${trainingData.features.length} samples...`
      );

      // Normalize features and create tensors
      const normalizedFeatures = trainingData.features.map((f) =>
        this.normalizeFeatures(f)
      );
      const featuresTensor = tf.tensor2d(normalizedFeatures);
      const targetsTensor = tf.tensor2d(trainingData.targets);

      // Train the model
      const history = await this.model.fit(featuresTensor, targetsTensor, {
        epochs: 100,
        batchSize: 32,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              console.log(
                `Epoch ${epoch}: loss = ${logs?.loss?.toFixed(4)}, val_loss = ${logs?.val_loss?.toFixed(4)}`
              );
            }
          }
        }
      });

      // Clean up tensors
      featuresTensor.dispose();
      targetsTensor.dispose();

      console.log("Neural network training completed");
    } catch (error) {
      console.error("Error training neural network:", error);
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Save the trained model
   */
  async saveModel(path: string): Promise<void> {
    if (!this.model) {
      console.error("No model to save");
      return;
    }

    try {
      await this.model.save(`file://${path}`);
      console.log(`Model saved to ${path}`);
    } catch (error) {
      console.error("Error saving model:", error);
    }
  }

  /**
   * Load a pre-trained model
   */
  async loadModel(path: string): Promise<void> {
    try {
      this.model = (await tf.loadLayersModel(
        `file://${path}`
      )) as tf.Sequential;
      console.log(`Model loaded from ${path}`);
    } catch (error) {
      console.error("Error loading model:", error);
      // Fall back to initializing a new model
      this.initializeModel();
    }
  }
}
