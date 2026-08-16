export const FANTASY_PROJECTION_SCORING_VERSION =
  "player-forecast-season-accountability-v1";

function finite(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function clippedProbability(value: number): number {
  return Math.min(1 - 1e-15, Math.max(1e-15, value));
}

export function seasonSkillIndex(modelLoss: number, baselineLoss: number): number {
  const denominator = Math.max(baselineLoss, 1e-9);
  return Math.max(
    0,
    Math.min(100, 50 + 50 * ((baselineLoss - modelLoss) / denominator)),
  );
}

export function scoreSeasonPrimitive(args: {
  actual: number;
  forecast: number;
  baselineForecast: number;
  p10?: number | null;
  p90?: number | null;
  probability?: boolean;
}) {
  const error = args.forecast - args.actual;
  const baselineError = args.baselineForecast - args.actual;
  const absoluteError = Math.abs(error);
  const baselineAbsoluteError = Math.abs(baselineError);
  const result: Record<string, number | boolean> = {
    actual: args.actual,
    forecast: args.forecast,
    absoluteError,
    squaredError: error * error,
    baselineForecast: args.baselineForecast,
    baselineAbsoluteError,
    baselineSquaredError: baselineError * baselineError,
    skillIndex: seasonSkillIndex(absoluteError, baselineAbsoluteError),
  };
  if (args.probability) {
    const probability = clippedProbability(args.forecast);
    const baselineProbability = clippedProbability(args.baselineForecast);
    result.brier = error * error;
    result.logLoss = -(
      args.actual * Math.log(probability) +
      (1 - args.actual) * Math.log(1 - probability)
    );
    result.baselineBrier = baselineError * baselineError;
    result.baselineLogLoss = -(
      args.actual * Math.log(baselineProbability) +
      (1 - args.actual) * Math.log(1 - baselineProbability)
    );
  }
  const p10 = finite(args.p10);
  const p90 = finite(args.p90);
  if (p10 != null && p90 != null) {
    result.interval80Covered = p10 <= args.actual && args.actual <= p90;
    result.intervalWidth = Math.max(0, p90 - p10);
  }
  return result;
}

export function allocateSeasonTotalAdjustment(args: {
  modelGameForecast: number;
  modelRemainingTotal: number;
  adjustmentDelta: number;
  remainingGames: number;
}): number {
  if (!Number.isFinite(args.adjustmentDelta) || args.adjustmentDelta === 0) {
    return args.modelGameForecast;
  }
  const share = Math.abs(args.modelRemainingTotal) > 1e-9
    ? args.modelGameForecast / args.modelRemainingTotal
    : 1 / Math.max(1, args.remainingGames);
  return args.modelGameForecast + args.adjustmentDelta * share;
}
