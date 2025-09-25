// utils/statistics.ts

import {
  PlayerYearData,
  PerGameAverages,
  PlayerGameLog,
  PerGameStatSummaries,
  CharacteristicResult
} from "./types";
import {
  STAT_FIELDS,
  StatField,
  STAT_WEIGHTS,
  RATED_STAT_FIELDS
} from "./constants";

/**
 * Computes mean and standard deviation for each stat from game logs.
 */
export const computeStatSummaries = (
  gameLogs: PlayerGameLog[]
): PerGameStatSummaries => {
  const summaries: PerGameStatSummaries = {} as PerGameStatSummaries;

  // Compute 'pa_to_sa_ratio' for each game
  gameLogs.forEach((game) => {
    const primaryAssists = game[StatField.TotalPrimaryAssists] ?? 0;
    const secondaryAssists = game[StatField.TotalSecondaryAssists] ?? 0;
    let paToSaRatio = 0;
    if (secondaryAssists === 0) {
      paToSaRatio = primaryAssists > 0 ? Number.POSITIVE_INFINITY : 0;
    } else {
      paToSaRatio = primaryAssists / secondaryAssists;
    }
    game[StatField.PAtoSARatio] = paToSaRatio;
  });

  for (const stat of RATED_STAT_FIELDS) {
    const values = gameLogs.map((game) => game[stat] ?? 0);

    // Filter out invalid numbers
    const finiteValues = values.filter((v) => Number.isFinite(v));

    const mean =
      finiteValues.reduce((acc, val) => acc + val, 0) / finiteValues.length ||
      0;

    const variance =
      finiteValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
        finiteValues.length || 0;

    const stdDev = Math.sqrt(variance) || 1;

    summaries[stat] = { mean, stdDev };
  }

  return summaries;
};

/**
 * Determines if each game is characteristic based on weighted squared z-scores.
 */
export const computeCharacteristicResults = (
  gameLogs: PlayerGameLog[],
  statSummaries: PerGameStatSummaries
): {
  results: CharacteristicResult[];
  T1: number;
  T2: number;
} => {
  const weights = RATED_STAT_FIELDS.map((stat) => STAT_WEIGHTS[stat]!);
  const sumOfWeights = weights.reduce((a, b) => a + b, 0);
  const sumOfSquares = weights.reduce((a, b) => a + b * b, 0);

  // Calculate expected value and variance for thresholds
  const expectedValue = sumOfWeights;
  const variance = 2 * sumOfSquares;
  const stdDev = Math.sqrt(variance);

  // Define thresholds
  const T1 = expectedValue;
  const T2 = expectedValue + 2 * stdDev;

  const results = gameLogs.map((game) => {
    const statResults: Record<StatField, string> = {} as Record<
      StatField,
      string
    >;
    let sumOfWeightedSquaredZScores = 0;

    // Compute 'pa_to_sa_ratio' for the game
    const primaryAssists = game.total_primary_assists ?? 0;
    const secondaryAssists = game.total_secondary_assists ?? 0;
    let paToSaRatio = 0;

    if (secondaryAssists === 0) {
      if (primaryAssists === 0) {
        paToSaRatio = 0; // No assists
      } else {
        paToSaRatio = 10; // Assign a high finite value instead of Infinity
      }
    } else {
      paToSaRatio = primaryAssists / secondaryAssists;
    }

    // Limit paToSaRatio to a maximum value
    paToSaRatio = Math.min(paToSaRatio, 10);

    game.pa_to_sa_ratio = paToSaRatio;

    for (const stat of RATED_STAT_FIELDS) {
      const value = game[stat] ?? 0;
      const statSummary = statSummaries[stat];
      const mean = statSummary.mean;
      const stdDev = statSummary.stdDev;

      // Validate mean and stdDev
      const validMean = Number.isFinite(mean) ? mean : 0;
      const validStdDev = Number.isFinite(stdDev) && stdDev > 0 ? stdDev : 1;

      const zScore = (value - validMean) / validStdDev;

      // Cap zScore to prevent extreme values
      const cappedZScore = Math.max(Math.min(zScore, 5), -5);

      const weight = STAT_WEIGHTS[stat]!;
      sumOfWeightedSquaredZScores += weight * cappedZScore * cappedZScore;

      if (Math.abs(zScore) <= 1) {
        statResults[stat] = "Highly Characteristic";
      } else if (Math.abs(zScore) <= 2) {
        statResults[stat] = "Moderately Characteristic";
      } else {
        statResults[stat] = "Uncharacteristic";
      }
    }

    // Determine overall characteristic status
    let overallStatus = "";
    if (sumOfWeightedSquaredZScores <= T1) {
      overallStatus = "Highly Characteristic";
    } else if (sumOfWeightedSquaredZScores <= T2) {
      overallStatus = "Moderately Characteristic";
    } else {
      overallStatus = "Uncharacteristic";
    }

    return {
      gameDate: game.date,
      statResults,
      gameStats: game,
      sumOfWeightedSquaredZScores,
      overallStatus
    } as CharacteristicResult;
  });

  return { results, T1, T2 };
};

/**
 * Computes a simple rolling average for a numeric series.
 */
export const computeRollingAverage = (
  values: number[],
  windowSize: number
): number[] => {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const slice = values.slice(start, i + 1);
    const avg =
      slice.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0) /
      (slice.length || 1);
    out.push(avg);
  }
  return out;
};

/**
 * Maps rolling CV to a confidence multiplier in [min,max] using a smoothstep curve.
 * - At or below T1 => ~max
 * - At or above T2 => ~min
 * - Between T1 and T2 => smooth decay
 */
export const computeConfidenceMultiplierSmooth = (
  rollingCV: number,
  T1: number,
  T2: number,
  options?: { min?: number; max?: number }
): number => {
  const min = options?.min ?? 0.8;
  const max = options?.max ?? 1.0;
  if (
    !Number.isFinite(rollingCV) ||
    !Number.isFinite(T1) ||
    !Number.isFinite(T2) ||
    T2 <= T1
  ) {
    return 1; // fallback safe default
  }
  // Normalize to [0,1] where 0 => T1, 1 => T2
  const xRaw = (rollingCV - T1) / (T2 - T1);
  const x = Math.max(0, Math.min(1, xRaw));
  // Smoothstep s(x) = 3x^2 - 2x^3; we want 1 at x=0 and 0 at x=1
  const smooth = 1 - (3 * x * x - 2 * x * x * x);
  return min + (max - min) * smooth;
};

/**
 * Derive empirical thresholds (e.g., med/90th) from characteristic results.
 */
export const computeEmpiricalThresholds = (
  results: CharacteristicResult[],
  p1: number = 0.5,
  p2: number = 0.9
): { T1: number; T2: number } => {
  const vals = results
    .map((r) => r.sumOfWeightedSquaredZScores)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (vals.length === 0) return { T1: 0, T2: 0 };
  const q = (p: number) => {
    const idx = Math.min(
      vals.length - 1,
      Math.max(0, Math.floor(p * vals.length))
    );
    return vals[idx];
  };
  return { T1: q(p1), T2: q(p2) };
};
