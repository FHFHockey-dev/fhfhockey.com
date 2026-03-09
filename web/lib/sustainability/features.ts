import type { WindowCode } from "./windows";
import { METRIC_SPECS } from "./bands";

export type NumericLike = number | null | undefined;

export type RateMap<TMetric extends string> = Partial<Record<TMetric, NumericLike>>;

export type Per60Input<TMetric extends string> = {
  totals: RateMap<TMetric>;
  toiSeconds: NumericLike;
  precision?: number;
};

export type PerGameInput<TMetric extends string> = {
  totals: RateMap<TMetric>;
  gamesPlayed: NumericLike;
  precision?: number;
};

export type ZScoreResult = {
  raw: number | null;
  baseline: number | null;
  delta: number | null;
  zScore: number | null;
};

export type ZScoreMapInput<TMetric extends string> = {
  recent: RateMap<TMetric>;
  baseline: RateMap<TMetric>;
  standardDeviation: RateMap<TMetric>;
  precision?: number;
  clip?: number | null;
  sdFloor?: number;
};

export type WindowWeightMap = Partial<Record<WindowCode, number>>;

export type EmpiricalBayesRateMetric =
  | "goals_per_60"
  | "assists_per_60"
  | "shots_per_60"
  | "ixg_per_60"
  | "scf_per_60"
  | "hdcf_per_60"
  | "ipp";

export type EBGammaShrinkInput = {
  observedCount: NumericLike;
  observedExposure: NumericLike;
  priorMean: NumericLike;
  priorStrength: NumericLike;
  precision?: number;
};

export type EBBetaShrinkInput = {
  successes: NumericLike;
  trials: NumericLike;
  priorMean: NumericLike;
  priorStrength: NumericLike;
  precision?: number;
};

export type EBShrinkResult = {
  observed: number | null;
  shrunk: number | null;
  priorMean: number | null;
  priorStrength: number;
  sampleWeight: number;
};

export type UsageMetric = "toi" | "es_toi" | "pp_toi" | "sh_toi";

export type UsageDeltaResult = {
  recent: number | null;
  baseline: number | null;
  absoluteDelta: number | null;
  percentDelta: number | null;
};

export type UsageDeltaMap = Partial<Record<UsageMetric, UsageDeltaResult>>;

export type ContextMetric = "pdo" | "on_ice_sh_pct" | "ozs_pct";

export type ContextFeatureResult = {
  recent: number | null;
  baseline: number | null;
  absoluteDelta: number | null;
  percentDelta: number | null;
};

export type ContextFeatureMap = Partial<Record<ContextMetric, ContextFeatureResult>>;

export type OpponentAdjustmentInput = {
  gamesPlayed: NumericLike;
  xgaPer60: NumericLike;
  caPer60: NumericLike;
  hdcaPer60: NumericLike;
  svPct: NumericLike;
  pkTier: NumericLike;
};

export type OpponentAdjustmentResult = {
  sampleWeight: number;
  shotRateMultiplier: number;
  goalRateMultiplier: number;
  assistRateMultiplier: number;
  defenseScore: number;
};

export type CountDistributionModel = "poisson" | "negbin";

export type CountDistributionSummary = {
  model: CountDistributionModel;
  mean: number;
  variance: number;
  p10: number;
  p50: number;
  p90: number;
};

export type QuantileBand = {
  lower: number;
  median: number;
  upper: number;
};

export type ForecastBands = {
  band50: QuantileBand;
  band80: QuantileBand;
};

export type BacktestCoverageSummary = {
  samples: number;
  hitRate50: number;
  hitRate80: number;
};

const DEFAULT_WINDOW_WEIGHT_ORDER: Record<WindowCode, number> = {
  l3: 1,
  l5: 0.8,
  l10: 0.55,
  l20: 0.35
};

const DEFAULT_EB_PRIOR_STRENGTH: Record<EmpiricalBayesRateMetric, number> = {
  goals_per_60: 180,
  assists_per_60: 220,
  shots_per_60: METRIC_SPECS.shots_per_60.priorStrength,
  ixg_per_60: METRIC_SPECS.ixg_per_60.priorStrength,
  scf_per_60: 360,
  hdcf_per_60: 360,
  ipp: METRIC_SPECS.ipp.priorStrength
};

const OPPONENT_BASELINES = {
  xgaPer60: 2.6,
  caPer60: 55,
  hdcaPer60: 10,
  svPct: 0.905,
  pkTier: 16
} as const;

const Z_P10 = -1.2815515655446004;
const Z_P25 = -0.6744897501960817;
const Z_P75 = 0.6744897501960817;
const Z_P90 = 1.2815515655446004;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function toFiniteNumber(value: NumericLike): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function roundRate(value: number, precision: number): number {
  return Number(value.toFixed(precision));
}

function normalizePercentageLike(value: NumericLike): number | null {
  const numericValue = toFiniteNumber(value);
  if (numericValue === null) return null;
  return numericValue > 1 ? numericValue / 100 : numericValue;
}

function poissonQuantilesApprox(lambda: number, precision: number) {
  const mean = clampNonNegative(lambda);
  const sd = Math.sqrt(Math.max(mean, 1e-9));
  return {
    p10: roundRate(clampNonNegative(mean + Z_P10 * sd), precision),
    p50: roundRate(mean, precision),
    p90: roundRate(clampNonNegative(mean + Z_P90 * sd), precision)
  };
}

function normalQuantilesApprox(mean: number, variance: number, precision: number) {
  const safeMean = clampNonNegative(mean);
  const sd = Math.sqrt(Math.max(variance, 1e-9));
  return {
    p10: roundRate(clampNonNegative(safeMean + Z_P10 * sd), precision),
    p50: roundRate(safeMean, precision),
    p90: roundRate(clampNonNegative(safeMean + Z_P90 * sd), precision)
  };
}

function symmetricBandFromMeanVariance(
  mean: number,
  variance: number,
  precision: number
): ForecastBands {
  const safeMean = clampNonNegative(mean);
  const sd = Math.sqrt(Math.max(variance, 1e-9));
  return {
    band50: {
      lower: roundRate(clampNonNegative(safeMean + Z_P25 * sd), precision),
      median: roundRate(safeMean, precision),
      upper: roundRate(clampNonNegative(safeMean + Z_P75 * sd), precision)
    },
    band80: {
      lower: roundRate(clampNonNegative(safeMean + Z_P10 * sd), precision),
      median: roundRate(safeMean, precision),
      upper: roundRate(clampNonNegative(safeMean + Z_P90 * sd), precision)
    }
  };
}

export function calculatePer60Rate(
  total: NumericLike,
  toiSeconds: NumericLike,
  precision = 6
): number | null {
  const totalValue = toFiniteNumber(total);
  const toiValue = toFiniteNumber(toiSeconds);
  if (totalValue === null || toiValue === null || toiValue <= 0) return null;
  return roundRate((totalValue * 3600) / toiValue, precision);
}

export function calculatePerGameRate(
  total: NumericLike,
  gamesPlayed: NumericLike,
  precision = 6
): number | null {
  const totalValue = toFiniteNumber(total);
  const gamesValue = toFiniteNumber(gamesPlayed);
  if (totalValue === null || gamesValue === null || gamesValue <= 0) return null;
  return roundRate(totalValue / gamesValue, precision);
}

export function calculatePer60Rates<TMetric extends string>(
  input: Per60Input<TMetric>
): Partial<Record<TMetric, number | null>> {
  const output: Partial<Record<TMetric, number | null>> = {};
  for (const [metric, total] of Object.entries(input.totals) as Array<
    [TMetric, NumericLike]
  >) {
    output[metric] = calculatePer60Rate(total, input.toiSeconds, input.precision);
  }
  return output;
}

export function calculatePerGameRates<TMetric extends string>(
  input: PerGameInput<TMetric>
): Partial<Record<TMetric, number | null>> {
  const output: Partial<Record<TMetric, number | null>> = {};
  for (const [metric, total] of Object.entries(input.totals) as Array<
    [TMetric, NumericLike]
  >) {
    output[metric] = calculatePerGameRate(
      total,
      input.gamesPlayed,
      input.precision
    );
  }
  return output;
}

export function calculateZScore(
  raw: NumericLike,
  baseline: NumericLike,
  standardDeviation: NumericLike,
  options: {
    precision?: number;
    clip?: number | null;
    sdFloor?: number;
  } = {}
): ZScoreResult {
  const rawValue = toFiniteNumber(raw);
  const baselineValue = toFiniteNumber(baseline);
  const standardDeviationValue = toFiniteNumber(standardDeviation);

  if (rawValue === null || baselineValue === null) {
    return {
      raw: rawValue,
      baseline: baselineValue,
      delta: null,
      zScore: null
    };
  }

  const precision = options.precision ?? 6;
  const delta = roundRate(rawValue - baselineValue, precision);
  if (standardDeviationValue === null) {
    return {
      raw: rawValue,
      baseline: baselineValue,
      delta,
      zScore: null
    };
  }

  const denominator = Math.max(
    standardDeviationValue,
    options.sdFloor ?? 1e-6
  );
  let zScore = delta / denominator;
  if (options.clip != null) {
    zScore = Math.max(-options.clip, Math.min(options.clip, zScore));
  }

  return {
    raw: rawValue,
    baseline: baselineValue,
    delta,
    zScore: roundRate(zScore, precision)
  };
}

export function calculateZScores<TMetric extends string>(
  input: ZScoreMapInput<TMetric>
): Partial<Record<TMetric, ZScoreResult>> {
  const output: Partial<Record<TMetric, ZScoreResult>> = {};
  const metricKeys = new Set<TMetric>([
    ...(Object.keys(input.recent) as TMetric[]),
    ...(Object.keys(input.baseline) as TMetric[]),
    ...(Object.keys(input.standardDeviation) as TMetric[])
  ]);

  for (const metric of metricKeys) {
    output[metric] = calculateZScore(
      input.recent[metric],
      input.baseline[metric],
      input.standardDeviation[metric],
      {
        precision: input.precision,
        clip: input.clip,
        sdFloor: input.sdFloor
      }
    );
  }

  return output;
}

export function normalizeWindowWeights(
  weights: WindowWeightMap
): Partial<Record<WindowCode, number>> {
  const entries = Object.entries(weights).filter(
    ([, value]) => typeof value === "number" && Number.isFinite(value) && value > 0
  ) as Array<[WindowCode, number]>;

  if (!entries.length) return {};

  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let allocated = 0;
  return entries.reduce<Partial<Record<WindowCode, number>>>(
    (acc, [window, value], index) => {
      if (index === entries.length - 1) {
        acc[window] = roundRate(Math.max(1 - allocated, 0), 6);
        return acc;
      }
      const normalized = roundRate(value / total, 6);
      acc[window] = normalized;
      allocated += normalized;
      return acc;
    },
    {}
  );
}

export function getDefaultWindowWeights(
  windows: WindowCode[]
): Partial<Record<WindowCode, number>> {
  const requested = windows.reduce<WindowWeightMap>((acc, window) => {
    acc[window] = DEFAULT_WINDOW_WEIGHT_ORDER[window];
    return acc;
  }, {});
  return normalizeWindowWeights(requested);
}

export function calculateWeightedRate<TWindow extends string>(args: {
  rates: Partial<Record<TWindow, NumericLike>>;
  weights: Partial<Record<TWindow, NumericLike>>;
  precision?: number;
}): {
  value: number | null;
  appliedWeight: number;
} {
  let weightedSum = 0;
  let appliedWeight = 0;

  for (const [window, rate] of Object.entries(args.rates) as Array<
    [TWindow, NumericLike]
  >) {
    const rateValue = toFiniteNumber(rate);
    const weightValue = toFiniteNumber(args.weights[window]);
    if (rateValue === null || weightValue === null || weightValue <= 0) continue;
    weightedSum += rateValue * weightValue;
    appliedWeight += weightValue;
  }

  if (appliedWeight <= 0) {
    return { value: null, appliedWeight: 0 };
  }

  return {
    value: roundRate(weightedSum / appliedWeight, args.precision ?? 6),
    appliedWeight: roundRate(appliedWeight, 6)
  };
}

export function empiricalBayesGammaShrink(
  input: EBGammaShrinkInput
): EBShrinkResult {
  const observedCount = toFiniteNumber(input.observedCount);
  const observedExposure = toFiniteNumber(input.observedExposure);
  const priorMean = toFiniteNumber(input.priorMean);
  const priorStrength = Math.max(toFiniteNumber(input.priorStrength) ?? 0, 0);
  const precision = input.precision ?? 6;

  if (
    observedCount === null ||
    observedExposure === null ||
    observedExposure <= 0 ||
    priorMean === null
  ) {
    return {
      observed: null,
      shrunk: null,
      priorMean,
      priorStrength,
      sampleWeight: 0
    };
  }

  const observed = (observedCount / observedExposure) * 60;
  const sampleWeight = observedExposure / (observedExposure + priorStrength);
  const shrunk = sampleWeight * observed + (1 - sampleWeight) * priorMean;

  return {
    observed: roundRate(observed, precision),
    shrunk: roundRate(shrunk, precision),
    priorMean,
    priorStrength,
    sampleWeight: roundRate(sampleWeight, precision)
  };
}

export function empiricalBayesBetaShrink(
  input: EBBetaShrinkInput
): EBShrinkResult {
  const successes = toFiniteNumber(input.successes);
  const trials = toFiniteNumber(input.trials);
  const priorMean = toFiniteNumber(input.priorMean);
  const priorStrength = Math.max(toFiniteNumber(input.priorStrength) ?? 0, 0);
  const precision = input.precision ?? 6;

  if (
    successes === null ||
    trials === null ||
    trials <= 0 ||
    priorMean === null
  ) {
    return {
      observed: null,
      shrunk: null,
      priorMean,
      priorStrength,
      sampleWeight: 0
    };
  }

  const observed = successes / trials;
  const sampleWeight = trials / (trials + priorStrength);
  const shrunk = sampleWeight * observed + (1 - sampleWeight) * priorMean;

  return {
    observed: roundRate(observed, precision),
    shrunk: roundRate(shrunk, precision),
    priorMean,
    priorStrength,
    sampleWeight: roundRate(sampleWeight, precision)
  };
}

export function empiricalBayesShrinkForMetric(
  metric: EmpiricalBayesRateMetric,
  input:
    | {
        observedCount: NumericLike;
        observedExposure: NumericLike;
        priorMean: NumericLike;
        priorStrength?: NumericLike;
      }
    | {
        successes: NumericLike;
        trials: NumericLike;
        priorMean: NumericLike;
        priorStrength?: NumericLike;
      }
): EBShrinkResult {
  const priorStrength =
    toFiniteNumber((input as { priorStrength?: NumericLike }).priorStrength) ??
    DEFAULT_EB_PRIOR_STRENGTH[metric];

  if (metric === "ipp") {
    const betaInput = input as {
      successes: NumericLike;
      trials: NumericLike;
      priorMean: NumericLike;
    };
    return empiricalBayesBetaShrink({
      successes: betaInput.successes,
      trials: betaInput.trials,
      priorMean: betaInput.priorMean,
      priorStrength
    });
  }

  const gammaInput = input as {
    observedCount: NumericLike;
    observedExposure: NumericLike;
    priorMean: NumericLike;
  };
  return empiricalBayesGammaShrink({
    observedCount: gammaInput.observedCount,
    observedExposure: gammaInput.observedExposure,
    priorMean: gammaInput.priorMean,
    priorStrength
  });
}

export function calculateUsageDelta(
  recent: NumericLike,
  baseline: NumericLike,
  precision = 6
): UsageDeltaResult {
  const recentValue = toFiniteNumber(recent);
  const baselineValue = toFiniteNumber(baseline);

  if (recentValue === null || baselineValue === null) {
    return {
      recent: recentValue,
      baseline: baselineValue,
      absoluteDelta: null,
      percentDelta: null
    };
  }

  const absoluteDelta = recentValue - baselineValue;
  const percentDelta =
    baselineValue === 0 ? null : (absoluteDelta / Math.abs(baselineValue)) * 100;

  return {
    recent: roundRate(recentValue, precision),
    baseline: roundRate(baselineValue, precision),
    absoluteDelta: roundRate(absoluteDelta, precision),
    percentDelta:
      percentDelta === null ? null : roundRate(percentDelta, precision)
  };
}

export function calculateUsageDeltas(input: {
  recent: Partial<Record<UsageMetric, NumericLike>>;
  baseline: Partial<Record<UsageMetric, NumericLike>>;
  precision?: number;
}): UsageDeltaMap {
  const output: UsageDeltaMap = {};
  const metricKeys = new Set<UsageMetric>([
    ...(Object.keys(input.recent) as UsageMetric[]),
    ...(Object.keys(input.baseline) as UsageMetric[])
  ]);

  for (const metric of metricKeys) {
    output[metric] = calculateUsageDelta(
      input.recent[metric],
      input.baseline[metric],
      input.precision
    );
  }

  return output;
}

export function calculateContextDelta(
  recent: NumericLike,
  baseline: NumericLike,
  options: {
    precision?: number;
    normalizePercent?: boolean;
  } = {}
): ContextFeatureResult {
  const precision = options.precision ?? 6;
  const normalize = options.normalizePercent ?? false;
  const recentValue = normalize
    ? normalizePercentageLike(recent)
    : toFiniteNumber(recent);
  const baselineValue = normalize
    ? normalizePercentageLike(baseline)
    : toFiniteNumber(baseline);

  if (recentValue === null || baselineValue === null) {
    return {
      recent: recentValue,
      baseline: baselineValue,
      absoluteDelta: null,
      percentDelta: null
    };
  }

  const absoluteDelta = recentValue - baselineValue;
  const percentDelta =
    baselineValue === 0 ? null : (absoluteDelta / Math.abs(baselineValue)) * 100;

  return {
    recent: roundRate(recentValue, precision),
    baseline: roundRate(baselineValue, precision),
    absoluteDelta: roundRate(absoluteDelta, precision),
    percentDelta:
      percentDelta === null ? null : roundRate(percentDelta, precision)
  };
}

export function calculateContextFeatures(input: {
  recent: {
    pdo?: NumericLike;
    onIceShPct?: NumericLike;
    ozsPct?: NumericLike;
  };
  baseline: {
    pdo?: NumericLike;
    onIceShPct?: NumericLike;
    ozsPct?: NumericLike;
  };
  precision?: number;
}): ContextFeatureMap {
  return {
    pdo: calculateContextDelta(input.recent.pdo, input.baseline.pdo, {
      precision: input.precision
    }),
    on_ice_sh_pct: calculateContextDelta(
      input.recent.onIceShPct,
      input.baseline.onIceShPct,
      {
        precision: input.precision,
        normalizePercent: true
      }
    ),
    ozs_pct: calculateContextDelta(input.recent.ozsPct, input.baseline.ozsPct, {
      precision: input.precision,
      normalizePercent: true
    })
  };
}

export function deriveOpponentAdjustmentFactors(
  input: OpponentAdjustmentInput,
  precision = 6
): OpponentAdjustmentResult {
  const gamesPlayed = Math.max(toFiniteNumber(input.gamesPlayed) ?? 0, 0);
  const xgaPer60 = toFiniteNumber(input.xgaPer60) ?? OPPONENT_BASELINES.xgaPer60;
  const caPer60 = toFiniteNumber(input.caPer60) ?? OPPONENT_BASELINES.caPer60;
  const hdcaPer60 =
    toFiniteNumber(input.hdcaPer60) ?? OPPONENT_BASELINES.hdcaPer60;
  const svPct = toFiniteNumber(input.svPct) ?? OPPONENT_BASELINES.svPct;
  const pkTier = toFiniteNumber(input.pkTier) ?? OPPONENT_BASELINES.pkTier;

  const sampleWeight = clamp(gamesPlayed / (gamesPlayed + 25), 0, 1);
  const xgaEdge = clamp(
    (xgaPer60 - OPPONENT_BASELINES.xgaPer60) / OPPONENT_BASELINES.xgaPer60,
    -0.25,
    0.25
  );
  const caEdge = clamp(
    (caPer60 - OPPONENT_BASELINES.caPer60) / OPPONENT_BASELINES.caPer60,
    -0.2,
    0.2
  );
  const hdcaEdge = clamp(
    (hdcaPer60 - OPPONENT_BASELINES.hdcaPer60) / OPPONENT_BASELINES.hdcaPer60,
    -0.25,
    0.25
  );
  const saveEdge = clamp(
    (OPPONENT_BASELINES.svPct - svPct) / OPPONENT_BASELINES.svPct,
    -0.04,
    0.04
  );
  const pkEdge = clamp(
    (OPPONENT_BASELINES.pkTier - pkTier) / OPPONENT_BASELINES.pkTier,
    -1,
    1
  );

  const defenseScore = sampleWeight * (
    xgaEdge * 0.35 +
      caEdge * 0.15 +
      hdcaEdge * 0.25 +
      saveEdge * 1.4 +
      pkEdge * 0.08
  );

  return {
    sampleWeight: roundRate(sampleWeight, precision),
    shotRateMultiplier: roundRate(clamp(1 + sampleWeight * (xgaEdge * 0.18 + caEdge * 0.14), 0.85, 1.15), precision),
    goalRateMultiplier: roundRate(clamp(1 + sampleWeight * (xgaEdge * 0.16 + hdcaEdge * 0.22 + saveEdge * 1.8 + pkEdge * 0.05), 0.8, 1.2), precision),
    assistRateMultiplier: roundRate(clamp(1 + sampleWeight * (xgaEdge * 0.12 + caEdge * 0.08 + pkEdge * 0.04), 0.85, 1.15), precision),
    defenseScore: roundRate(defenseScore, precision)
  };
}

export function buildCountDistribution(args: {
  mean: NumericLike;
  model?: CountDistributionModel;
  dispersion?: NumericLike;
  precision?: number;
}): CountDistributionSummary {
  const precision = args.precision ?? 6;
  const mean = clampNonNegative(toFiniteNumber(args.mean) ?? 0);
  const model = args.model ?? "poisson";

  if (model === "poisson") {
    const quantiles = poissonQuantilesApprox(mean, precision);
    return {
      model,
      mean: roundRate(mean, precision),
      variance: roundRate(mean, precision),
      ...quantiles
    };
  }

  const dispersion = Math.max(toFiniteNumber(args.dispersion) ?? 0, 0);
  const variance = mean + dispersion * mean * mean;
  const quantiles = normalQuantilesApprox(mean, variance, precision);
  return {
    model,
    mean: roundRate(mean, precision),
    variance: roundRate(variance, precision),
    ...quantiles
  };
}

export function aggregateCountDistributions(args: {
  perGameMeans: NumericLike[];
  model?: CountDistributionModel;
  dispersion?: NumericLike;
  precision?: number;
}): CountDistributionSummary {
  const precision = args.precision ?? 6;
  const model = args.model ?? "poisson";
  const means = args.perGameMeans.map((value) =>
    clampNonNegative(toFiniteNumber(value) ?? 0)
  );
  const totalMean = means.reduce((sum, value) => sum + value, 0);

  if (model === "poisson") {
    return buildCountDistribution({
      mean: totalMean,
      model,
      precision
    });
  }

  const dispersion = Math.max(toFiniteNumber(args.dispersion) ?? 0, 0);
  const totalVariance = means.reduce(
    (sum, mean) => sum + (mean + dispersion * mean * mean),
    0
  );
  const quantiles = normalQuantilesApprox(totalMean, totalVariance, precision);
  return {
    model,
    mean: roundRate(totalMean, precision),
    variance: roundRate(totalVariance, precision),
    ...quantiles
  };
}

export function emitForecastBands(
  distribution: CountDistributionSummary,
  precision = 6
): ForecastBands {
  return symmetricBandFromMeanVariance(
    distribution.mean,
    distribution.variance,
    precision
  );
}

export function evaluateBandCalibration(args: {
  forecasts: Array<ForecastBands | null | undefined>;
  actuals: NumericLike[];
  precision?: number;
}): BacktestCoverageSummary {
  let samples = 0;
  let hits50 = 0;
  let hits80 = 0;

  for (let i = 0; i < args.forecasts.length; i += 1) {
    const forecast = args.forecasts[i];
    const actual = toFiniteNumber(args.actuals[i]);
    if (!forecast || actual === null) continue;
    samples += 1;

    if (
      actual >= forecast.band50.lower &&
      actual <= forecast.band50.upper
    ) {
      hits50 += 1;
    }

    if (
      actual >= forecast.band80.lower &&
      actual <= forecast.band80.upper
    ) {
      hits80 += 1;
    }
  }

  if (samples === 0) {
    return {
      samples: 0,
      hitRate50: 0,
      hitRate80: 0
    };
  }

  const precision = args.precision ?? 6;
  return {
    samples,
    hitRate50: roundRate(hits50 / samples, precision),
    hitRate80: roundRate(hits80 / samples, precision)
  };
}
