import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();

  try {
    console.log("Starting xFS audit log update job...");

    // Get audit log entries that need actual performance data
    // Look for entries where game_date is in the past but actual_fantasy_score is null
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const cutoffDate = yesterday.toISOString().split("T")[0];

    const { data: auditEntries, error: auditError } = await supabase
      .from("xfs_audit_log")
      .select("*")
      .lte("game_date", cutoffDate)
      .is("actual_fantasy_score", null)
      .order("game_date", { ascending: false })
      .limit(1000); // Process up to 1000 entries at a time

    if (auditError) {
      console.error("Error fetching audit entries:", auditError);
      throw auditError;
    }

    if (!auditEntries || auditEntries.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No audit entries requiring updates found",
        updatedEntries: 0,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)} s`
      });
    }

    console.log(`Found ${auditEntries.length} audit entries to update`);

    let updatedEntries = 0;
    let errors = [];

    // Process entries in batches
    const batchSize = 25;
    for (let i = 0; i < auditEntries.length; i += batchSize) {
      const batch = auditEntries.slice(i, i + batchSize);
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(auditEntries.length / batchSize)}`
      );

      for (const entry of batch) {
        try {
          // Calculate actual fantasy score for the prediction period
          const actualScore = await calculateActualFantasyScore(
            entry.player_id,
            entry.game_date,
            entry.prediction_horizon
          );

          if (actualScore !== null) {
            // Calculate accuracy score (1 - (|predicted - actual| / max(predicted, actual, 1)))
            const accuracyScore = calculateAccuracyScore(
              entry.predicted_xfs,
              actualScore
            );

            // Update the audit entry
            const { error: updateError } = await supabase
              .from("xfs_audit_log")
              .update({
                actual_fantasy_score: actualScore,
                accuracy_score: accuracyScore
              })
              .eq("id", entry.id);

            if (updateError) {
              console.error(
                `Error updating audit entry ${entry.id}:`,
                updateError
              );
              errors.push(`Entry ${entry.id}: ${updateError.message}`);
            } else {
              updatedEntries++;
            }
          } else {
            // No game data available yet - skip this entry
            console.log(
              `No game data available for player ${entry.player_id} on ${entry.game_date}`
            );
          }
        } catch (entryError: any) {
          console.error(
            `Error processing audit entry ${entry.id}:`,
            entryError
          );
          errors.push(`Entry ${entry.id}: ${entryError.message}`);
        }
      }

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(
      `xFS audit update job completed. Updated ${updatedEntries} entries with ${errors.length} errors in ${durationSec}s`
    );

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${updatedEntries} audit entries`,
      updatedEntries,
      errorCount: errors.length,
      errors: errors.slice(0, 10), // Return first 10 errors for debugging
      duration: `${durationSec} s`
    });
  } catch (error: any) {
    console.error("Fatal error in xFS audit update job:", error.message);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    return res.status(500).json({
      success: false,
      message: error.message,
      duration: `${durationSec} s`
    });
  }
}

/**
 * Calculate actual fantasy score for a player over a prediction horizon
 * Uses the same scoring system as the neural network for consistency
 */
async function calculateActualFantasyScore(
  playerId: number,
  gameDate: string,
  predictionHorizon: number
): Promise<number | null> {
  // Calculate the date range for the prediction horizon
  const targetDate = new Date(gameDate);
  const startDate = new Date(targetDate);
  startDate.setDate(targetDate.getDate() - predictionHorizon);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = gameDate;

  // Get actual game log data for the prediction period
  const { data: gameLogData, error } = await supabase
    .from("wgo_skater_stats")
    .select(
      `
      goals,
      assists,
      shots,
      hits,
      blocked_shots,
      penalty_minutes,
      pp_goals,
      pp_assists,
      sh_goals,
      sh_assists,
      plus_minus
    `
    )
    .eq("player_id", playerId)
    .gte("date", startDateStr)
    .lte("date", endDateStr)
    .order("date", { ascending: true });

  if (error) {
    console.error(`Error fetching game log for player ${playerId}:`, error);
    return null;
  }

  if (!gameLogData || gameLogData.length === 0) {
    // No game data available yet
    return null;
  }

  // Calculate total fantasy score across all games in the period
  // Using standard fantasy scoring: goals=6, assists=4, shots=0.9, hits=0.5, blocks=1
  // PP goals/assists get bonus points, SH goals/assists get bigger bonus
  let totalFantasyScore = 0;

  for (const game of gameLogData) {
    const regularGoals =
      (game.goals || 0) - (game.pp_goals || 0) - (game.sh_goals || 0);
    const regularAssists =
      (game.assists || 0) - (game.pp_assists || 0) - (game.sh_assists || 0);

    const gameScore =
      // Regular scoring
      regularGoals * 6 +
      regularAssists * 4 +
      (game.shots || 0) * 0.9 +
      (game.hits || 0) * 0.5 +
      (game.blocked_shots || 0) * 1 +
      // Power play bonuses
      (game.pp_goals || 0) * 7 + // PP goals worth more
      (game.pp_assists || 0) * 5 + // PP assists worth more
      // Short handed bonuses
      (game.sh_goals || 0) * 8 + // SH goals worth even more
      (game.sh_assists || 0) * 6 + // SH assists worth more
      // Plus/minus (can be negative)
      (game.plus_minus || 0) * 0.5 +
      // Penalty minutes (negative impact)
      (game.penalty_minutes || 0) * -0.5;

    totalFantasyScore += gameScore;
  }

  return Math.round(totalFantasyScore * 100) / 100;
}

/**
 * Enhanced accuracy score calculation using multiple metrics
 */
function calculateAccuracyScore(predicted: number, actual: number): number {
  if (predicted === 0 && actual === 0) return 1.0;
  if (predicted === 0 || actual === 0) return 0.1; // Penalize completely wrong predictions

  // Mean Absolute Percentage Error (MAPE) based accuracy
  const mape = Math.abs(predicted - actual) / Math.abs(actual);
  const mapeAccuracy = Math.max(0, 1 - mape);

  // Relative error accuracy
  const maxValue = Math.max(Math.abs(predicted), Math.abs(actual), 1);
  const relativeAccuracy = 1 - Math.abs(predicted - actual) / maxValue;

  // Directional accuracy (bonus for getting the trend right)
  const avgScore = 12; // Approximate average fantasy score
  const predictedDirection = predicted > avgScore ? 1 : -1;
  const actualDirection = actual > avgScore ? 1 : -1;
  const directionalBonus = predictedDirection === actualDirection ? 0.1 : 0;

  // Combine accuracies with weights
  const combinedAccuracy =
    mapeAccuracy * 0.5 + relativeAccuracy * 0.4 + directionalBonus;

  return Math.max(0, Math.min(1, combinedAccuracy));
}
