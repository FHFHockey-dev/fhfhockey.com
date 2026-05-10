import type { SustainabilityMetricKey } from "./bands";
import { SUSTAINABILITY_SCORE_MODEL_VERSION } from "./runtimeContract";

export type SustainabilityBacktestVariant =
  | "sustainability_score"
  | "career_only"
  | "season_only"
  | "recent_only"
  | "naive";

export type SustainabilityBacktestExample = {
  playerId?: number | null;
  snapshotDate?: string | null;
  metricKey: SustainabilityMetricKey | string;
  actual: number | null | undefined;
  sustainabilityPrediction?: number | null | undefined;
  careerBaseline?: number | null | undefined;
  seasonBaseline?: number | null | undefined;
  recentValue?: number | null | undefined;
};

export type SustainabilityBacktestMetric = {
  variant: SustainabilityBacktestVariant;
  sampleCount: number;
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  meanActual: number | null;
  meanPrediction: number | null;
};

export type SustainabilityBacktestResult = {
  modelVersion: string;
  variants: SustainabilityBacktestMetric[];
  bestByMae: SustainabilityBacktestVariant | null;
};

const VARIANT_ORDER: SustainabilityBacktestVariant[] = [
  "sustainability_score",
  "career_only",
  "season_only",
  "recent_only",
  "naive"
];

function toFiniteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundMetric(value: number, precision: number): number {
  return Number(value.toFixed(precision));
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function resolveNaivePrediction(example: SustainabilityBacktestExample): number | null {
  return mean(
    [
      toFiniteNumber(example.careerBaseline),
      toFiniteNumber(example.seasonBaseline),
      toFiniteNumber(example.recentValue)
    ].filter((value): value is number => value !== null)
  );
}

function resolvePrediction(
  variant: SustainabilityBacktestVariant,
  example: SustainabilityBacktestExample
): number | null {
  if (variant === "sustainability_score") {
    return toFiniteNumber(example.sustainabilityPrediction);
  }
  if (variant === "career_only") return toFiniteNumber(example.careerBaseline);
  if (variant === "season_only") return toFiniteNumber(example.seasonBaseline);
  if (variant === "recent_only") return toFiniteNumber(example.recentValue);
  return resolveNaivePrediction(example);
}

export function runSustainabilityBaselineBacktest(
  examples: SustainabilityBacktestExample[],
  options: {
    variants?: SustainabilityBacktestVariant[];
    precision?: number;
    modelVersion?: string;
  } = {}
): SustainabilityBacktestResult {
  const variants = options.variants?.length ? options.variants : VARIANT_ORDER;
  const precision = options.precision ?? 6;

  const metrics = variants.map<SustainabilityBacktestMetric>((variant) => {
    let sampleCount = 0;
    let absoluteError = 0;
    let squaredError = 0;
    let signedError = 0;
    let actualTotal = 0;
    let predictionTotal = 0;

    for (const example of examples) {
      const actual = toFiniteNumber(example.actual);
      const prediction = resolvePrediction(variant, example);
      if (actual === null || prediction === null) continue;

      const error = prediction - actual;
      sampleCount += 1;
      absoluteError += Math.abs(error);
      squaredError += error ** 2;
      signedError += error;
      actualTotal += actual;
      predictionTotal += prediction;
    }

    if (sampleCount === 0) {
      return {
        variant,
        sampleCount: 0,
        mae: null,
        rmse: null,
        bias: null,
        meanActual: null,
        meanPrediction: null
      };
    }

    return {
      variant,
      sampleCount,
      mae: roundMetric(absoluteError / sampleCount, precision),
      rmse: roundMetric(Math.sqrt(squaredError / sampleCount), precision),
      bias: roundMetric(signedError / sampleCount, precision),
      meanActual: roundMetric(actualTotal / sampleCount, precision),
      meanPrediction: roundMetric(predictionTotal / sampleCount, precision)
    };
  });

  const bestByMae =
    metrics
      .filter((metric) => metric.mae !== null)
      .sort((left, right) => (left.mae ?? Infinity) - (right.mae ?? Infinity))[0]
      ?.variant ?? null;

  return {
    modelVersion: options.modelVersion ?? SUSTAINABILITY_SCORE_MODEL_VERSION,
    variants: metrics,
    bestByMae
  };
}
