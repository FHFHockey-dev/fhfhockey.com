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

function toFiniteNumber(value: NumericLike): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function roundRate(value: number, precision: number): number {
  return Number(value.toFixed(precision));
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
