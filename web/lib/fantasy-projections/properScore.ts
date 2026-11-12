import { nullableProjectionNumber } from "./contracts";

/**
 * One proper scoring path shared by season settlement
 * (`fantasy-projections/settlement.ts`) and per-game settlement
 * (`player-forecasts/settlement.ts`) (decision 65; W3-5 F7, PR4; BC W1-6 A3).
 *
 * Each forecast row records its own losses only. Skill is never computed per
 * row: losses are aggregated over a cohort first and skill is
 * 1 − Σ model loss / Σ baseline loss, so a forecast of 0 cannot beat the true
 * mean merely by winning most individual zero outcomes. Squared error (the
 * Brier score for probabilities) is the primary loss; absolute error is
 * reported as a secondary diagnostic only.
 */

export type ProperForecastMetrics = Record<string, number | boolean>;

export type ProperForecastScore = {
  metrics: ProperForecastMetrics;
  /** Empty when no valid baseline forecast exists (baseline unavailable). */
  baselineMetrics: Record<string, number>;
};

export type ProperSkillAggregate = {
  /** Rows with both a model and a baseline loss. */
  evaluated: number;
  /** Rows without a paired baseline loss (excluded, never zeroed). */
  excluded: number;
  meanModelSquaredError: number | null;
  meanBaselineSquaredError: number | null;
  /** Secondary diagnostic (decision 65): mean absolute errors on the same rows. */
  meanModelAbsoluteError: number | null;
  meanBaselineAbsoluteError: number | null;
  /** 1 − Σ model loss / Σ baseline loss; null when undefined. */
  skill: number | null;
};

const LOG_LOSS_EPSILON = 1e-15;

/** A probability in [0, 1], or null for anything else (1.2, −0.1, NaN, null). */
export function properProbability(value: unknown): number | null {
  const parsed = nullableProjectionNumber(value);
  return parsed !== null && parsed >= 0 && parsed <= 1 ? parsed : null;
}

/**
 * The 10th–90th percentile interval, or null when either bound is null,
 * absent, empty, non-finite or the bounds are reversed. An unavailable
 * interval is never counted covered and never has width 0.
 */
export function properInterval(
  p10: unknown,
  p90: unknown,
): { lower: number; upper: number } | null {
  const lower = nullableProjectionNumber(p10);
  const upper = nullableProjectionNumber(p90);
  return lower !== null && upper !== null && lower <= upper ? { lower, upper } : null;
}

function binaryLogLoss(actual: number, probability: number): number {
  const clipped = Math.min(1 - LOG_LOSS_EPSILON, Math.max(LOG_LOSS_EPSILON, probability));
  return -(actual * Math.log(clipped) + (1 - actual) * Math.log(1 - clipped));
}

function forecastLosses(
  actual: number,
  forecast: number,
  probability: boolean,
): Record<string, number> {
  const error = forecast - actual;
  const losses: Record<string, number> = {
    forecast,
    squaredError: error * error,
    absoluteError: Math.abs(error),
  };
  if (probability) {
    losses.brier = error * error;
    losses.logLoss = binaryLogLoss(actual, forecast);
  }
  return losses;
}

/**
 * Scores one forecast against one outcome. Returns null when the outcome or
 * the model forecast is unknown or invalid (a probability outside [0, 1], or
 * a probability outcome other than 0 or 1); such rows are excluded, never
 * scored as 0.
 */
export function scoreProperForecast(args: {
  actual: unknown;
  forecast: unknown;
  baselineForecast?: unknown;
  probability: boolean;
  p10?: unknown;
  p90?: unknown;
}): ProperForecastScore | null {
  const actual = nullableProjectionNumber(args.actual);
  if (actual === null) return null;
  if (args.probability && actual !== 0 && actual !== 1) return null;
  const forecast = args.probability
    ? properProbability(args.forecast)
    : nullableProjectionNumber(args.forecast);
  if (forecast === null) return null;

  const metrics: ProperForecastMetrics = {
    actual,
    ...forecastLosses(actual, forecast, args.probability),
  };
  const interval = properInterval(args.p10, args.p90);
  metrics.interval80Available = interval !== null;
  if (interval) {
    metrics.interval80Covered = interval.lower <= actual && actual <= interval.upper;
    metrics.intervalWidth = interval.upper - interval.lower;
  }

  const baseline = args.probability
    ? properProbability(args.baselineForecast)
    : nullableProjectionNumber(args.baselineForecast);
  return {
    metrics,
    baselineMetrics: baseline === null ? {} : forecastLosses(actual, baseline, args.probability),
  };
}

function finiteLoss(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Aggregated proper skill over a cohort (decision 65): losses are summed over
 * the rows that have both a model and a baseline loss, then
 * skill = 1 − Σ model squared error / Σ baseline squared error.
 */
export function aggregateProperSkill(
  scores: ReadonlyArray<ProperForecastScore | null | undefined>,
): ProperSkillAggregate {
  let evaluated = 0;
  let excluded = 0;
  let modelSquared = 0;
  let baselineSquared = 0;
  let modelAbsolute = 0;
  let baselineAbsolute = 0;
  for (const score of scores) {
    const model = finiteLoss(score?.metrics.squaredError);
    const baseline = finiteLoss(score?.baselineMetrics.squaredError);
    const modelAbs = finiteLoss(score?.metrics.absoluteError);
    const baselineAbs = finiteLoss(score?.baselineMetrics.absoluteError);
    if (model === null || baseline === null || modelAbs === null || baselineAbs === null) {
      excluded += 1;
      continue;
    }
    evaluated += 1;
    modelSquared += model;
    baselineSquared += baseline;
    modelAbsolute += modelAbs;
    baselineAbsolute += baselineAbs;
  }
  const mean = (total: number) => (evaluated > 0 ? total / evaluated : null);
  return {
    evaluated,
    excluded,
    meanModelSquaredError: mean(modelSquared),
    meanBaselineSquaredError: mean(baselineSquared),
    meanModelAbsoluteError: mean(modelAbsolute),
    meanBaselineAbsoluteError: mean(baselineAbsolute),
    skill: evaluated > 0 && baselineSquared > 0 ? 1 - modelSquared / baselineSquared : null,
  };
}
