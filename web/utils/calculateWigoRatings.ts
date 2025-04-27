// web/utils/calculateWigoRatings.ts (or similar file)

import {
  PlayerStrengthStats,
  RawStatsCollection,
  Strength,
  CalculatedPlayerRatings,
  RatingWeightsConfig,
  RegressionConfig,
  StatWeight
} from "components/WiGO/types"; // Adjust path
import {
  RATING_WEIGHTS,
  REGRESSION_CONFIG
} from "components/WiGO/ratingWeights"; // Adjust path

// --- Helper: Calculate Percentile Rank ---
// (Keep this function as is)
function calculatePercentileRank(
  value: number,
  data: number[], // Array of valid, non-null numbers for the specific stat
  higherIsBetter: boolean
): number {
  if (data.length === 0) {
    return 50; // Default to average if no comparison data
  }
  let lowerCount = 0;
  let equalCount = 0;
  const totalCount = data.length;
  for (const score of data) {
    if (score < value) {
      lowerCount++;
    } else if (score === value) {
      equalCount++;
    }
  }
  let percentile = (lowerCount + 0.5 * equalCount) / totalCount;
  if (!higherIsBetter) {
    percentile = 1.0 - percentile;
  }
  return Math.max(0, Math.min(1, percentile)) * 100;
}

// --- Helper: Apply Regression ---
// (Keep this function as is - it receives the threshold)
function applyRegression(
  playerValue: number, // The value being regressed (in our case, the percentile)
  playerGP: number,
  regressionMean: number, // Mean value for players below threshold for THIS STAT
  gpThreshold: number // The threshold (now dynamic)
): number {
  // Formula: M’ = (GP * M + (P – GP) * mM) / P
  const regressedValue =
    (playerGP * playerValue + (gpThreshold - playerGP) * regressionMean) /
    gpThreshold;
  // Clamp the regressed value between 0 and 100 as it's applied to percentiles
  return Math.max(0, Math.min(100, regressedValue));
}

// --- Main Calculation Function ---
export function calculatePlayerRatings(
  playerId: number,
  rawStats: RawStatsCollection,
  weightsConfig: RatingWeightsConfig = RATING_WEIGHTS,
  regressionConfig: RegressionConfig = REGRESSION_CONFIG // Keep config for the 'enabled' flag
): CalculatedPlayerRatings | null {
  const strengths: Strength[] = ["as", "es", "pp", "pk"];
  const finalRatings: Partial<CalculatedPlayerRatings> & {
    offense: any;
    defense: any;
    overall: any;
  } = {
    offense: { as: null, es: null, pp: null, pk: null },
    defense: { as: null, es: null, pp: null, pk: null },
    overall: { as: null, es: null, st: null, final: null },
    _debug: { percentiles: {}, regressedPercentiles: {} }
  };

  let foundPlayerData = false;

  const intermediatePercentiles: {
    [key in Strength]?: { [key: string]: number | null };
  } = {};
  const regressedPercentiles: {
    [key in Strength]?: { [key: string]: number | null };
  } = {};

  for (const strength of strengths) {
    const strengthData = rawStats[strength];
    const strengthWeights = weightsConfig[strength];
    if (!strengthData || !strengthWeights) continue;

    intermediatePercentiles[strength] = {};
    regressedPercentiles[strength] = {};

    const statTypes: ("offense" | "defense")[] = ["offense", "defense"];
    for (const type of statTypes) {
      const weights = strengthWeights[type];
      const playerDataArray = strengthData[type];

      if (
        !weights ||
        weights.length === 0 ||
        !playerDataArray ||
        playerDataArray.length === 0
      ) {
        continue;
      }

      const targetPlayerRow = playerDataArray.find(
        (p) => p.player_id === playerId
      );
      if (targetPlayerRow) foundPlayerData = true;

      const targetPlayerGP = targetPlayerRow?.gp ?? 0; // Player's GP for THIS strength

      for (const weightInfo of weights) {
        const statKey = weightInfo.stat;
        const higherIsBetter = weightInfo.higherIsBetter;

        // --- Percentile Calculation ---
        const targetPlayerValue = targetPlayerRow
          ? targetPlayerRow[statKey]
          : null;
        let percentile: number | null = null;

        if (
          typeof targetPlayerValue === "number" &&
          !isNaN(targetPlayerValue) &&
          isFinite(targetPlayerValue)
        ) {
          const comparisonData = playerDataArray
            .map((p) => p[statKey])
            .filter(
              (v): v is number =>
                typeof v === "number" && !isNaN(v) && isFinite(v)
            );
          percentile = calculatePercentileRank(
            targetPlayerValue,
            comparisonData,
            higherIsBetter
          );
        }
        intermediatePercentiles[strength]![String(statKey)] = percentile;

        // --- Regression (Optional & Dynamic Threshold) ---
        let finalPercentileValue = percentile; // Start with the raw percentile

        if (
          regressionConfig.enabled && // Check if regression is enabled globally
          percentile !== null && // Can only regress if percentile exists
          targetPlayerRow // Need player's row for GP
          // targetPlayerGP > 0          // Ensure GP is positive to avoid threshold of 0
        ) {
          // Calculate the dynamic threshold based on player's GP for this strength
          // Always round up (minimum threshold of 1)
          const dynamicGpThreshold = Math.max(
            1,
            Math.ceil(targetPlayerGP * 0.25)
          );

          // Apply regression only if the player's GP is strictly LESS than the calculated threshold
          if (targetPlayerGP < dynamicGpThreshold) {
            // Calculate the mean *percentile* for players below the DYNAMIC threshold for THIS STAT
            const lowGpPercentiles = playerDataArray
              // Filter for players strictly below the dynamic threshold
              .filter((p) => p.gp != null && p.gp < dynamicGpThreshold)
              // Get their already calculated raw percentile for this stat
              .map((p) => intermediatePercentiles[strength]?.[String(statKey)])
              .filter((p): p is number => p !== null); // Filter out nulls

            if (lowGpPercentiles.length > 0) {
              const regressionMeanPercentile =
                lowGpPercentiles.reduce((a, b) => a + b, 0) /
                lowGpPercentiles.length;

              // Apply regression formula to the *percentile* using the dynamic threshold
              finalPercentileValue = applyRegression(
                percentile, // Player's calculated percentile
                targetPlayerGP,
                regressionMeanPercentile, // Mean percentile for low GP players
                dynamicGpThreshold // Use the dynamic threshold
              );
              // console.log(`[Debug Regression - ${strength} ${String(statKey)}] GP: ${targetPlayerGP}, Threshold: ${dynamicGpThreshold}, Raw %: ${percentile.toFixed(1)}, Mean Low GP %: ${regressionMeanPercentile.toFixed(1)}, Regressed %: ${finalPercentileValue.toFixed(1)}`);
            }
            // else: No other players below the dynamic threshold had a valid percentile, cannot regress.
          }
          // else: Player GP meets or exceeds dynamic threshold, no regression needed.
        }
        regressedPercentiles[strength]![String(statKey)] = finalPercentileValue;
      }
    }
  }

  if (!foundPlayerData) {
    console.warn(
      `[calculatePlayerRatings] Player ${playerId} not found in any provided dataset.`
    );
    return null;
  }

  finalRatings._debug!.percentiles = intermediatePercentiles;
  finalRatings._debug!.regressedPercentiles = regressedPercentiles;

  // --- Step 3: Calculate Weighted Sums ---
  // (This part remains the same, using the values from regressedPercentiles)
  for (const strength of strengths) {
    const strengthWeights = weightsConfig[strength];
    if (!strengthWeights) continue;

    let totalOffenseWeight = 0;
    let weightedOffenseSum = 0;
    for (const weightInfo of strengthWeights.offense) {
      const percentile =
        regressedPercentiles[strength]?.[String(weightInfo.stat)];
      if (typeof percentile === "number") {
        weightedOffenseSum += percentile * weightInfo.weight;
        totalOffenseWeight += weightInfo.weight;
      }
    }
    finalRatings.offense[strength] =
      totalOffenseWeight > 0 ? weightedOffenseSum / totalOffenseWeight : null;

    let totalDefenseWeight = 0;
    let weightedDefenseSum = 0;
    for (const weightInfo of strengthWeights.defense) {
      const percentile =
        regressedPercentiles[strength]?.[String(weightInfo.stat)];
      if (typeof percentile === "number") {
        weightedDefenseSum += percentile * weightInfo.weight;
        totalDefenseWeight += weightInfo.weight;
      }
    }
    finalRatings.defense[strength] =
      totalDefenseWeight > 0 ? weightedDefenseSum / totalDefenseWeight : null;
  }

  // --- Step 4: Calculate Overall Ratings ---
  // (This part remains the same)
  const off = finalRatings.offense!;
  const def = finalRatings.defense!;
  const avg = (a: number | null, b: number | null): number | null => {
    if (a !== null && b !== null) return (a + b) / 2;
    if (a !== null) return a;
    if (b !== null) return b;
    return null;
  };

  finalRatings.overall.as = avg(off.as, def.as);
  finalRatings.overall.es = avg(off.es, def.es);
  const ppOffenseRow = rawStats.pp?.offense.find(
    (p) => p.player_id === playerId
  );
  const pkDefenseRow = rawStats.pk?.defense.find(
    (p) => p.player_id === playerId
  );
  const ppTOI = ppOffenseRow?.toi_seconds ?? 0;
  const pkTOI = pkDefenseRow?.toi_seconds ?? 0;
  const totalStTOI = ppTOI + pkTOI;
  let overallST: number | null = null;
  if (totalStTOI > 0 && (off.pp !== null || def.pk !== null)) {
    const ppWeight = ppTOI / totalStTOI;
    const pkWeight = pkTOI / totalStTOI;
    const weightedPP = off.pp !== null ? off.pp * ppWeight : 0;
    const weightedPK = def.pk !== null ? def.pk * pkWeight : 0;
    let divisor = 0;
    if (off.pp !== null && ppWeight > 0) divisor += ppWeight;
    if (def.pk !== null && pkWeight > 0) divisor += pkWeight;
    overallST =
      divisor > 0.0001
        ? (weightedPP + weightedPK) / divisor
        : avg(off.pp, def.pk);
  } else {
    overallST = avg(off.pp, def.pk);
  }
  finalRatings.overall.st = overallST;
  const finalComponents = [
    finalRatings.overall.as,
    finalRatings.overall.es,
    finalRatings.overall.st
  ];
  const validComponents = finalComponents.filter(
    (r): r is number => r !== null
  );
  finalRatings.overall.final =
    validComponents.length > 0
      ? validComponents.reduce((a, b) => a + b, 0) / validComponents.length
      : null;

  console.log(
    `[calculatePlayerRatings] Finished calculations for player ${playerId}.`
  );
  return finalRatings as CalculatedPlayerRatings;
}
