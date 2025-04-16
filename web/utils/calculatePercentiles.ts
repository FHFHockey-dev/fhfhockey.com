// /utils/calculatePercentiles.ts

interface RankablePlayerData {
  player_id: number;
  value: number; // The specific stat value being ranked
}

/**
 * Calculates the percentile rank for a specific player within a dataset for a given stat.
 * Handles ties using the method: (players_below + 0.5 * players_equal) / total_count
 *
 * @param data Array of objects, each with player_id and the stat value. Assumes nulls are pre-filtered.
 * @param targetPlayerId The ID of the player whose percentile rank is needed.
 * @param valueKey The key in the data objects holding the stat value (should always be 'value' based on usage).
 * @param higherIsBetter True if a higher stat value is better (ranks descending), false otherwise (ranks ascending).
 * @returns Percentile rank (0-1) or null if the player is not in the dataset or dataset is empty.
 */
export function calculatePercentileRank(
  data: ReadonlyArray<RankablePlayerData>, // Use ReadonlyArray for safety
  targetPlayerId: number,
  valueKey: keyof RankablePlayerData = "value", // Should always be 'value' here
  higherIsBetter: boolean
): number | null {
  if (data.length === 0) {
    return null; // Cannot calculate percentile with no data
  }

  // Find the target player's data point
  const targetPlayerData = data.find((p) => p.player_id === targetPlayerId);

  if (!targetPlayerData) {
    // console.log(`Target player ${targetPlayerId} not found in the filtered dataset for this stat.`);
    return null; // Target player doesn't meet criteria or wasn't found
  }

  const targetScore = targetPlayerData[valueKey];
  const totalCount = data.length;

  let lowerCount = 0;
  let equalCount = 0;

  // Iterate through the data to count players below and equal to the target score
  for (const player of data) {
    const score = player[valueKey];
    if (score < targetScore) {
      lowerCount++;
    } else if (score === targetScore) {
      equalCount++;
    }
  }

  // Calculate percentile based on ranking method
  // (Count Below + 0.5 * Count Equal) / Total Count
  // This gives the proportion of players *at or below* the target score (with adjustment for ties)
  let percentile = (lowerCount + 0.5 * equalCount) / totalCount;

  // If lower is better, we invert the percentile
  if (!higherIsBetter) {
    percentile = 1 - percentile;
  }

  // Clamp result between 0 and 1 (floating point math might slightly exceed bounds)
  return Math.max(0, Math.min(1, percentile));
}
