// /utils/calculatePercentiles.ts

interface RankablePlayerData {
  player_id: number;
  value: number; // The specific stat value being ranked
}

export interface RankingResult {
  percentile: number;
  rank: number;
}

export function calculateRankingResult(
  data: ReadonlyArray<RankablePlayerData>,
  targetPlayerId: number,
  higherIsBetter: boolean
): RankingResult | null {
  if (data.length === 0) {
    return null;
  }

  const targetPlayerData = data.find((player) => player.player_id === targetPlayerId);

  if (!targetPlayerData) {
    return null;
  }

  const targetScore = targetPlayerData.value;
  let betterCount = 0;
  let equalCount = 0;
  let worseCount = 0;

  for (const player of data) {
    const score = player.value;

    if (score === targetScore) {
      equalCount++;
      continue;
    }

    const isBetterScore = higherIsBetter ? score > targetScore : score < targetScore;

    if (isBetterScore) {
      betterCount++;
    } else {
      worseCount++;
    }
  }

  const percentile =
    (worseCount + 0.5 * equalCount) / data.length;

  return {
    percentile: Math.max(0, Math.min(1, percentile)),
    rank: betterCount + 1
  };
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
  const rankingData = data.map((player) => ({
    player_id: player.player_id,
    value: player[valueKey] as number
  }));
  const result = calculateRankingResult(
    rankingData,
    targetPlayerId,
    higherIsBetter
  );

  return result?.percentile ?? null;
}

// --- Helper Function to Calculate Rank ---
// Moved calculation logic into a reusable function within the component scope
// This could also be moved to the `calculatePercentiles.ts` utils file
export const calculatePlayerRank = (
  data: ReadonlyArray<{ player_id: number; value: number }>,
  targetPlayerId: number,
  higherIsBetter: boolean
): number | null => {
  const result = calculateRankingResult(data, targetPlayerId, higherIsBetter);
  return result?.rank ?? null;
};
