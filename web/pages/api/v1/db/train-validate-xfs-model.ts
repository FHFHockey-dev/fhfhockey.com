import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import { getCurrentSeason } from "lib/NHL/client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();

  try {
    // Verify authorization header - TEMPORARILY DISABLED FOR TESTING
    // const authHeader = req.headers.authorization;
    // if (!authHeader || authHeader !== "Bearer fhfh-cron-mima-233") {
    //   return res.status(401).json({
    //     success: false,
    //     message: "Unauthorized"
    //   });
    // }

    // Only allow POST requests - TEMPORARILY ALLOW GET FOR TESTING
    if (!["GET", "POST"].includes(req.method || "")) {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    console.log("Starting xFS training/validation job...");

    // Use the current season (2024-2025) which has data available
    const currentSeason = "20242025"; // For wgo_skater_stats_totals (text format)
    const nstSeasonId = 20242025; // For nst_gamelog_as_counts (integer format)

    console.log(
      `Using current season: ${currentSeason} (NST season: ${nstSeasonId})`
    );

    // Set season dates for 2024-2025 season (corrected for current date July 2025)
    const seasonStart = new Date("2024-10-09"); // 2024-25 season start
    const seasonEnd = new Date("2025-04-17"); // 2024-25 regular season end
    const currentDate = new Date("2025-07-08"); // Current date context

    // Since we're past the season end, use the completed season for training
    const trainingEndDate = "2025-01-12"; // Midpoint of completed season
    const validationStart = "2025-01-13"; // Second half for validation

    console.log(
      `Training period: ${seasonStart.toISOString().split("T")[0]} to ${trainingEndDate}`
    );
    console.log(
      `Validation period: ${validationStart} to ${seasonEnd.toISOString().split("T")[0]}`
    );

    // Get all active players from the season with sufficient games in training period
    // Use wgo_skater_stats_totals to get players, then filter by actual training games
    const { data: allPlayers, error: playersError } = await supabase
      .from("wgo_skater_stats_totals")
      .select("player_id, player_name, position_code, games_played")
      .eq("season", currentSeason)
      .gte("games_played", 15) // Minimum games for the full season
      .order("games_played", { ascending: false });

    if (playersError) {
      console.error("Error fetching players:", playersError);
      throw playersError;
    }

    if (!allPlayers || allPlayers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No players found for training/validation"
      });
    }

    console.log(
      `Found ${allPlayers.length} total players for training/validation`
    );

    // Filter players who have sufficient training period data
    const players = [];

    // Optional limit for testing (can be set via query parameter)
    const limit = req.query.limit
      ? parseInt(req.query.limit as string)
      : undefined;
    const playersToProcess = limit ? allPlayers.slice(0, limit) : allPlayers;

    console.log(
      `Processing ${playersToProcess.length} players${limit ? ` (limited for testing)` : ""}`
    );

    for (const player of playersToProcess) {
      const { data: trainingGames } = await supabase
        .from("nst_gamelog_as_counts")
        .select("id")
        .eq("player_id", player.player_id)
        .eq("season", nstSeasonId)
        .lte("date_scraped", trainingEndDate);

      if (trainingGames && trainingGames.length >= 10) {
        players.push({
          ...player,
          training_games: trainingGames.length
        });
      }
    }

    console.log(
      `Found ${players.length} players with sufficient training data`
    );

    let totalPredictions = 0;
    let totalValidations = 0;
    let errors = [];

    // Process players in batches
    const batchSize = 25;
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
          players.length / batchSize
        )}`
      );

      for (const player of batch) {
        try {
          // Generate training predictions using only data up to the midpoint
          const trainingPredictions = await generateTrainingPredictions(
            player,
            nstSeasonId,
            trainingEndDate,
            validationStart
          );

          if (trainingPredictions.length > 0) {
            // Insert training predictions
            const { error: predictionError } = await supabase
              .from("xfs_predictions_5_game")
              .upsert(trainingPredictions, {
                onConflict: "player_id,prediction_date,game_date"
              });

            if (predictionError) {
              console.error(
                `Error inserting training predictions for player ${player.player_id}:`,
                predictionError
              );
              errors.push(
                `Player ${player.player_id} (training): ${predictionError.message}`
              );
            } else {
              totalPredictions += trainingPredictions.length;
            }

            // Calculate actual outcomes for validation
            const validationResults = await calculateValidationOutcomes(
              player,
              nstSeasonId,
              trainingPredictions,
              validationStart
            );

            if (validationResults.length > 0) {
              // Insert validation audit logs with actual outcomes
              const { error: auditError } = await supabase
                .from("xfs_audit_log")
                .upsert(validationResults, {
                  onConflict:
                    "player_id,prediction_date,game_date,prediction_horizon"
                });

              if (auditError) {
                console.error(
                  `Error inserting validation results for player ${player.player_id}:`,
                  auditError
                );
                errors.push(
                  `Player ${player.player_id} (validation): ${auditError.message}`
                );
              } else {
                totalValidations += validationResults.length;
              }
            }
          }
        } catch (playerError: any) {
          console.error(
            `Error processing player ${player.player_id}:`,
            playerError
          );
          errors.push(`Player ${player.player_id}: ${playerError.message}`);
        }
      }

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(
      `Training/validation job completed. Generated ${totalPredictions} predictions and ${totalValidations} validations with ${errors.length} errors in ${durationSec}s`
    );

    return res.status(200).json({
      success: true,
      message: `Successfully generated training predictions and validation data`,
      totalPredictions,
      totalValidations,
      errorCount: errors.length,
      errors: errors.slice(0, 10),
      trainingPeriod: `${seasonStart.toISOString().split("T")[0]} to ${trainingEndDate}`,
      validationPeriod: `${validationStart} to ${seasonEnd.toISOString().split("T")[0]}`,
      duration: `${durationSec} s`
    });
  } catch (error: any) {
    console.error("Fatal error in training/validation job:", error.message);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    return res.status(500).json({
      success: false,
      message: error.message,
      duration: `${durationSec} s`
    });
  }
}

/**
 * Generate training predictions using only data up to the training cutoff
 */
async function generateTrainingPredictions(
  player: any,
  nstSeasonId: number,
  trainingEndDate: string,
  validationStartDate: string
): Promise<any[]> {
  // Get training period game log data (only up to midpoint)
  const { data: trainingGameLog } = await supabase
    .from("nst_gamelog_as_counts")
    .select("*")
    .eq("player_id", player.player_id)
    .eq("season", nstSeasonId) // Use full season ID
    .lte("date_scraped", trainingEndDate)
    .order("date_scraped", { ascending: false })
    .limit(15);

  if (!trainingGameLog || trainingGameLog.length < 5) {
    // Not enough training data
    return [];
  }

  // Calculate xFS prediction based on training data only
  const recentGames = trainingGameLog.slice(0, 5);
  const avgPoints =
    recentGames.reduce((sum, game) => sum + (game.total_points || 0), 0) /
    recentGames.length;
  const avgShots =
    recentGames.reduce((sum, game) => sum + (game.shots || 0), 0) /
    recentGames.length;
  const avgHits =
    recentGames.reduce((sum, game) => sum + (game.hits || 0), 0) /
    recentGames.length;
  const avgBlocks =
    recentGames.reduce((sum, game) => sum + (game.shots_blocked || 0), 0) /
    recentGames.length;

  // Calculate fantasy score using common scoring system
  const baseFantasyScore =
    avgPoints * 6 + // Points are typically 6 in fantasy
    avgShots * 0.9 +
    avgHits * 0.5 +
    avgBlocks * 1.0;

  const variance = Math.max(1, baseFantasyScore * 0.25);
  const confidence = Math.min(0.95, Math.max(0.6, recentGames.length / 10));

  // Create predictions for multiple dates in validation period
  const predictions = [];
  const predictionDate = trainingEndDate; // Prediction made at end of training period

  // Generate predictions for first few games of validation period
  for (let dayOffset = 1; dayOffset <= 10; dayOffset += 2) {
    const targetDate = new Date(validationStartDate);
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const gameDate = targetDate.toISOString().split("T")[0];

    predictions.push({
      player_id: player.player_id,
      player_name: player.player_name,
      prediction_date: predictionDate,
      game_date: gameDate,
      xfs_score: Math.round(baseFantasyScore * 100) / 100,
      min_xfs: Math.round((baseFantasyScore - variance) * 100) / 100,
      max_xfs: Math.round((baseFantasyScore + variance) * 100) / 100,
      confidence_interval: confidence
    });
  }

  return predictions;
}

/**
 * Calculate actual outcomes for validation period
 */
async function calculateValidationOutcomes(
  player: any,
  nstSeasonId: number,
  predictions: any[],
  validationStartDate: string
): Promise<any[]> {
  // Get actual game log data from validation period
  const validationEndDate = new Date(validationStartDate);
  validationEndDate.setDate(validationEndDate.getDate() + 30); // Look ahead 30 days
  const endDate = validationEndDate.toISOString().split("T")[0];

  const { data: validationGameLog } = await supabase
    .from("nst_gamelog_as_counts")
    .select("*")
    .eq("player_id", player.player_id)
    .eq("season", nstSeasonId) // Use full season ID
    .gte("date_scraped", validationStartDate)
    .lte("date_scraped", endDate)
    .order("date_scraped", { ascending: true });

  if (!validationGameLog || validationGameLog.length === 0) {
    return [];
  }

  const auditEntries = [];

  for (const prediction of predictions) {
    // Find the closest actual game to the predicted date
    const targetDate = new Date(prediction.game_date);
    let closestGame = null;
    let minDateDiff = Infinity;

    for (const game of validationGameLog) {
      const gameDate = new Date(game.date_scraped);
      const dateDiff = Math.abs(gameDate.getTime() - targetDate.getTime());
      if (dateDiff < minDateDiff) {
        minDateDiff = dateDiff;
        closestGame = game;
      }
    }

    if (closestGame && minDateDiff <= 3 * 24 * 60 * 60 * 1000) {
      // Within 3 days
      // Calculate actual fantasy score for this game
      const actualFantasyScore =
        (closestGame.total_points || 0) * 6 +
        (closestGame.shots || 0) * 0.9 +
        (closestGame.hits || 0) * 0.5 +
        (closestGame.shots_blocked || 0) * 1.0;

      // Calculate accuracy score
      const accuracyScore = calculateAccuracyScore(
        prediction.xfs_score,
        actualFantasyScore
      );

      auditEntries.push({
        player_id: player.player_id,
        player_name: player.player_name,
        prediction_date: prediction.prediction_date,
        game_date: prediction.game_date,
        predicted_xfs: prediction.xfs_score,
        actual_fantasy_score: Math.round(actualFantasyScore * 100) / 100,
        accuracy_score: accuracyScore,
        prediction_horizon: 5
      });
    }
  }

  return auditEntries;
}

/**
 * Calculate accuracy score for prediction vs actual performance
 */
function calculateAccuracyScore(predicted: number, actual: number): number {
  if (predicted === 0 && actual === 0) return 1.0;

  const maxValue = Math.max(Math.abs(predicted), Math.abs(actual), 1);
  const accuracy = 1 - Math.abs(predicted - actual) / maxValue;

  return Math.max(0, Math.min(1, Math.round(accuracy * 1000) / 1000));
}
