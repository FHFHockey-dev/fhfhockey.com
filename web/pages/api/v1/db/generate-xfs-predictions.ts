import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import { XFSNeuralNetwork } from "utils/ml/xfs-neural-network";

// Initialize the neural network
const xfsModel = new XFSNeuralNetwork();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();

  try {
    console.log("Starting daily xFS prediction job with neural network...");

    // Get current date for prediction calculations
    const today = new Date();
    const predictionDate = today.toISOString().split("T")[0]; // YYYY-MM-DD format

    // Calculate target dates for 5-game and 10-game predictions
    const fiveGameTargetDate = new Date(today);
    fiveGameTargetDate.setDate(today.getDate() + 5);
    const tenGameTargetDate = new Date(today);
    tenGameTargetDate.setDate(today.getDate() + 10);

    const fiveGameTarget = fiveGameTargetDate.toISOString().split("T")[0];
    const tenGameTarget = tenGameTargetDate.toISOString().split("T")[0];

    // Get all active players from the current season
    const currentSeason = "20242025"; // Update this for the current season
    const { data: players, error: playersError } = await supabase
      .from("wgo_skater_stats_totals")
      .select("player_id, player_name, position_code, games_played")
      .eq("season", currentSeason)
      .gte("games_played", 10) // Only include players with at least 10 games
      .order("games_played", { ascending: false });

    if (playersError) {
      console.error("Error fetching players:", playersError);
      throw playersError;
    }

    if (!players || players.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active players found for prediction generation"
      });
    }

    console.log(
      `Found ${players.length} active players for neural network prediction generation`
    );

    let totalPredictions = 0;
    let successfulPredictions = 0;
    let errors = [];

    // Process players in batches to avoid overwhelming the database
    const batchSize = 25; // Reduced batch size for neural network processing
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(players.length / batchSize)} with neural network`
      );

      for (const player of batch) {
        try {
          // Use neural network to generate 5-game prediction
          const fiveGamePrediction = await xfsModel.predict(
            player.player_id,
            predictionDate,
            5
          );

          // Use neural network to generate 10-game prediction
          const tenGamePrediction = await xfsModel.predict(
            player.player_id,
            predictionDate,
            10
          );

          if (!fiveGamePrediction || !tenGamePrediction) {
            console.log(
              `Neural network could not generate predictions for player ${player.player_id} - insufficient data`
            );
            continue;
          }

          // Prepare prediction records
          const fiveGameRecord = {
            player_id: player.player_id,
            player_name: player.player_name,
            prediction_date: predictionDate,
            game_date: fiveGameTarget,
            xfs_score: fiveGamePrediction.xfs_score,
            min_xfs: fiveGamePrediction.min_xfs,
            max_xfs: fiveGamePrediction.max_xfs,
            confidence_interval: fiveGamePrediction.confidence_interval
          };

          const tenGameRecord = {
            player_id: player.player_id,
            player_name: player.player_name,
            prediction_date: predictionDate,
            game_date: tenGameTarget,
            xfs_score: tenGamePrediction.xfs_score,
            min_xfs: tenGamePrediction.min_xfs,
            max_xfs: tenGamePrediction.max_xfs,
            confidence_interval: tenGamePrediction.confidence_interval
          };

          // Insert 5-game prediction
          const { error: fiveGameError } = await supabase
            .from("xfs_predictions_5_game")
            .upsert([fiveGameRecord], {
              onConflict: "player_id,prediction_date,game_date"
            });

          if (fiveGameError) {
            console.error(
              `Error inserting 5-game prediction for player ${player.player_id}:`,
              fiveGameError
            );
            errors.push(
              `Player ${player.player_id} (5-game): ${fiveGameError.message}`
            );
            continue;
          }

          // Insert 10-game prediction
          const { error: tenGameError } = await supabase
            .from("xfs_predictions_10_game")
            .upsert([tenGameRecord], {
              onConflict: "player_id,prediction_date,game_date"
            });

          if (tenGameError) {
            console.error(
              `Error inserting 10-game prediction for player ${player.player_id}:`,
              tenGameError
            );
            errors.push(
              `Player ${player.player_id} (10-game): ${tenGameError.message}`
            );
            continue;
          }

          totalPredictions += 2; // 5-game + 10-game
          successfulPredictions++;

          // Create audit log entries
          await createAuditLogEntries(
            player.player_id,
            player.player_name || "Unknown Player",
            predictionDate,
            fiveGameTarget,
            tenGameTarget,
            fiveGamePrediction.xfs_score,
            tenGamePrediction.xfs_score
          );

          // Log feature importance for monitoring (sample every 10th player)
          if (successfulPredictions % 10 === 0) {
            console.log(
              `Feature importance for player ${player.player_id}:`,
              fiveGamePrediction.feature_importance
            );
          }
        } catch (playerError: any) {
          console.error(
            `Error processing player ${player.player_id} with neural network:`,
            playerError
          );
          errors.push(`Player ${player.player_id}: ${playerError.message}`);
        }
      }

      // Delay between batches to manage memory and database load
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(
      `Neural network xFS prediction job completed. Generated ${totalPredictions} predictions for ${successfulPredictions} players with ${errors.length} errors in ${durationSec}s`
    );

    return res.status(200).json({
      success: true,
      message: `Successfully generated neural network xFS predictions for ${successfulPredictions} players`,
      totalPredictions,
      successfulPredictions,
      errorCount: errors.length,
      errors: errors.slice(0, 5), // Return first 5 errors for debugging
      modelType: "neural_network",
      featuresUsed: 35,
      duration: `${durationSec} s`
    });
  } catch (error: any) {
    console.error(
      "Fatal error in neural network xFS prediction job:",
      error.message
    );
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    return res.status(500).json({
      success: false,
      message: error.message,
      modelType: "neural_network",
      duration: `${durationSec} s`
    });
  }
}

/**
 * Create audit log entries for tracking prediction accuracy
 */
async function createAuditLogEntries(
  playerId: number,
  playerName: string,
  predictionDate: string,
  fiveGameTarget: string,
  tenGameTarget: string,
  fiveGameXFS: number,
  tenGameXFS: number
) {
  const auditEntries = [
    {
      player_id: playerId,
      player_name: playerName,
      prediction_date: predictionDate,
      game_date: fiveGameTarget,
      predicted_xfs: fiveGameXFS,
      actual_fantasy_score: null,
      accuracy_score: null,
      prediction_horizon: 5
    },
    {
      player_id: playerId,
      player_name: playerName,
      prediction_date: predictionDate,
      game_date: tenGameTarget,
      predicted_xfs: tenGameXFS,
      actual_fantasy_score: null,
      accuracy_score: null,
      prediction_horizon: 10
    }
  ];

  const { error: auditError } = await supabase
    .from("xfs_audit_log")
    .upsert(auditEntries, {
      onConflict: "player_id,prediction_date,game_date,prediction_horizon"
    });

  if (auditError) {
    console.error(
      `Error creating audit log entries for player ${playerId}:`,
      auditError
    );
  }
}
