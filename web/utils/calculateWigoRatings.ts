// web/utils/calculateWigoRatings.ts (or similar file)

import {
  PlayerStrengthStats,
  RawStatsCollection,
  Strength,
  CalculatedPlayerRatings,
  RatingWeightsConfig,
  RegressionConfig
} from "components/WiGO/types"; // Adjust path
import {
  RATING_WEIGHTS,
  REGRESSION_CONFIG
} from "components/WiGO/ratingWeights"; // Adjust path
import { calculateRankingResult } from "./calculatePercentiles";

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

interface ComparisonRow {
  player_id: number;
  gp: number;
  value: number;
}

function buildComparisonRows(
  playerDataArray: PlayerStrengthStats[],
  statKey: string,
  targetPlayerId: number,
  cohortMinGp: number
): ComparisonRow[] {
  return playerDataArray
    .filter((player) => {
      const playerGp = player.gp ?? 0;
      return player.player_id === targetPlayerId || playerGp >= cohortMinGp;
    })
    .map((player) => ({
      player_id: player.player_id,
      gp: player.gp ?? 0,
      value: player[statKey] as number | null
    }))
    .filter(
      (player): player is ComparisonRow =>
        typeof player.value === "number" &&
        !isNaN(player.value) &&
        isFinite(player.value)
    );
}

// --- Main Calculation Function ---
export function calculatePlayerRatings(
  playerId: number,
  rawStats: RawStatsCollection,
  weightsConfig: RatingWeightsConfig = RATING_WEIGHTS,
  regressionConfig: RegressionConfig = REGRESSION_CONFIG,
  cohortMinGp = 0
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
        const comparisonRows = buildComparisonRows(
          playerDataArray,
          String(statKey),
          playerId,
          cohortMinGp
        );

        const targetRanking = calculateRankingResult(
          comparisonRows,
          playerId,
          higherIsBetter
        );
        const percentile =
          targetRanking !== null ? targetRanking.percentile * 100 : null;
        intermediatePercentiles[strength]![String(statKey)] = percentile;

        let finalPercentileValue = percentile;

        if (
          regressionConfig.enabled &&
          percentile !== null &&
          targetPlayerRow &&
          targetPlayerGP < regressionConfig.minGPThreshold
        ) {
          const cohortPercentiles = comparisonRows
            .map((row) => ({
              player_id: row.player_id,
              gp: row.gp,
              result: calculateRankingResult(
                comparisonRows,
                row.player_id,
                higherIsBetter
              )
            }))
            .filter(
              (row): row is {
                player_id: number;
                gp: number;
                result: NonNullable<ReturnType<typeof calculateRankingResult>>;
              } => row.result !== null
            );

          const regressionTargets = cohortPercentiles.filter(
            (row) =>
              row.player_id !== playerId &&
              row.gp >= regressionConfig.minGPThreshold
          );

          const regressionMeanPercentile =
            regressionTargets.length > 0
              ? regressionTargets.reduce(
                  (sum, row) => sum + row.result.percentile * 100,
                  0
                ) / regressionTargets.length
              : 50;

          finalPercentileValue = applyRegression(
            percentile,
            targetPlayerGP,
            regressionMeanPercentile,
            regressionConfig.minGPThreshold
          );
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
