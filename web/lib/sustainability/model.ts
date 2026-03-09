import { METRIC_SPECS } from "./bands";
import {
  aggregateCountDistributions,
  buildCountDistribution,
  deriveOpponentAdjustmentFactors,
  emitForecastBands,
  type CountDistributionModel,
  type CountDistributionSummary,
  type ForecastBands,
  type OpponentAdjustmentInput
} from "./features";

export type SustainabilityLabel = "hot" | "normal" | "cold";

export type LabelingMethod = "zscore" | "quantile";

export type ZScoreLabelingConfig = {
  method: "zscore";
  hotThreshold?: number;
  coldThreshold?: number;
};

export type QuantileLabelingConfig = {
  method: "quantile";
  hotThreshold?: number;
  coldThreshold?: number;
};

export type LabelingConfig = ZScoreLabelingConfig | QuantileLabelingConfig;

export type TrainingTargetInput = {
  playerId?: number | null;
  snapshotDate?: string | null;
  metricKey?: string | null;
  zScore?: number | null;
  quantile?: number | null;
};

export type TrainingTarget = {
  playerId: number | null;
  snapshotDate: string | null;
  metricKey: string | null;
  label: SustainabilityLabel;
  classIndex: 0 | 1 | 2;
  sourceValue: number | null;
  method: LabelingMethod;
};

export type LogisticTrainingExample = {
  features: number[];
  label: SustainabilityLabel;
};

export type PlattScaler = {
  slope: number;
  intercept: number;
};

export type BinaryLogisticModel = {
  label: SustainabilityLabel;
  weights: number[];
  bias: number;
  platt: PlattScaler;
};

export type SustainabilityProbabilityModel = {
  featureCount: number;
  classOrder: SustainabilityLabel[];
  models: BinaryLogisticModel[];
};

export type SustainabilityProbabilityResult = {
  label: SustainabilityLabel;
  probabilities: Record<SustainabilityLabel, number>;
  logits: Record<SustainabilityLabel, number>;
};

export type FeatureImportance = {
  featureIndex: number;
  featureKey: string;
  featureLabel: string;
  featureValue: number;
  weight: number;
  contribution: number;
  direction: "positive" | "negative";
};

export type ExplanationOptions = {
  topN?: number;
  featureLabels?: string[];
};

export type ProjectableCountMetric =
  | "goals"
  | "assists"
  | "shots"
  | "points"
  | "pp_points"
  | "hits"
  | "blocks";

export type CountProjectionInput = {
  metric: ProjectableCountMetric;
  ratePer60: number | null | undefined;
  toiSeconds: number | null | undefined;
  distribution?: CountDistributionModel;
  overdispersion?: number | null;
  precision?: number;
  horizons?: number[];
  opponentAdjustment?: OpponentAdjustmentInput | null;
};

export type CountProjectionResult = {
  metric: ProjectableCountMetric;
  expectedPerGame: number;
  adjustedRatePer60: number;
  adjustedToiSeconds: number;
  opponentAdjustment: ReturnType<typeof deriveOpponentAdjustmentFactors>;
  perGame: CountDistributionSummary;
  horizons: Record<number, CountDistributionSummary & ForecastBands>;
};

export type FaceoffRateProjectionInput = {
  winPct: number | null | undefined;
  attemptsPerGame: number | null | undefined;
  precision?: number;
  horizons?: number[];
};

export type FaceoffRateBand = {
  lower: number;
  mean: number;
  upper: number;
};

export type FaceoffRateProjectionResult = {
  expectedWinPct: number;
  attemptsPerGame: number;
  expectedWinsPerGame: number;
  perGameBand80: FaceoffRateBand;
  horizons: Record<
    number,
    {
      attempts: number;
      expectedWins: number;
      expectedWinPct: number;
      band50: FaceoffRateBand;
      band80: FaceoffRateBand;
    }
  >;
};

export type LogisticFitOptions = {
  iterations?: number;
  learningRate?: number;
  l2?: number;
  calibrationIterations?: number;
};

const DEFAULT_ZSCORE_HOT_THRESHOLD = 1;
const DEFAULT_ZSCORE_COLD_THRESHOLD = -1;
const DEFAULT_QUANTILE_HOT_THRESHOLD = 0.8;
const DEFAULT_QUANTILE_COLD_THRESHOLD = 0.2;
const DEFAULT_EXPLANATION_COUNT = 3;
const DEFAULT_PROJECTION_HORIZONS = [5, 10];
const GOAL_LIKE_METRICS = new Set<ProjectableCountMetric>([
  "goals",
  "points",
  "pp_points"
]);
const ASSIST_LIKE_METRICS = new Set<ProjectableCountMetric>(["assists"]);
const SHOT_LIKE_METRICS = new Set<ProjectableCountMetric>([
  "shots",
  "hits",
  "blocks"
]);

function toFiniteNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function clampQuantile(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampRate(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function labelToClassIndex(label: SustainabilityLabel): 0 | 1 | 2 {
  if (label === "cold") return 0;
  if (label === "normal") return 1;
  return 2;
}

const CLASS_ORDER: SustainabilityLabel[] = ["cold", "normal", "hot"];
const EPSILON = 1e-9;

function dotProduct(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const exp = Math.exp(-value);
    return 1 / (1 + exp);
  }
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function softmax(scores: number[]): number[] {
  const maxScore = Math.max(...scores);
  const shifted = scores.map((score) => Math.exp(score - maxScore));
  const normalizer = shifted.reduce((sum, value) => sum + value, 0);
  return shifted.map((value) => value / Math.max(normalizer, EPSILON));
}

function validateExamples(examples: LogisticTrainingExample[]): number {
  if (!examples.length) {
    throw new Error("At least one training example is required");
  }

  const featureCount = examples[0]?.features.length ?? 0;
  if (!featureCount) {
    throw new Error("Training examples must include at least one feature");
  }

  for (const example of examples) {
    if (example.features.length !== featureCount) {
      throw new Error("All training examples must use the same feature count");
    }

    for (const feature of example.features) {
      if (!Number.isFinite(feature)) {
        throw new Error("Training features must be finite numbers");
      }
    }
  }

  return featureCount;
}

function fitBinaryLogisticModel(
  examples: LogisticTrainingExample[],
  positiveLabel: SustainabilityLabel,
  featureCount: number,
  options: Required<LogisticFitOptions>
): { weights: number[]; bias: number; logits: number[]; targets: number[] } {
  const weights = Array.from({ length: featureCount }, () => 0);
  let bias = 0;
  const targets = examples.map((example) =>
    example.label === positiveLabel ? 1 : 0
  );

  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const gradient = Array.from({ length: featureCount }, () => 0);
    let biasGradient = 0;

    for (let index = 0; index < examples.length; index += 1) {
      const example = examples[index];
      const target = targets[index] ?? 0;
      const score = dotProduct(weights, example.features) + bias;
      const prediction = sigmoid(score);
      const error = prediction - target;

      for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
        gradient[featureIndex] += error * example.features[featureIndex];
      }
      biasGradient += error;
    }

    for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
      const penalty = options.l2 * weights[featureIndex];
      weights[featureIndex] -=
        options.learningRate * (gradient[featureIndex] / examples.length + penalty);
    }
    bias -= options.learningRate * (biasGradient / examples.length);
  }

  const logits = examples.map(
    (example) => dotProduct(weights, example.features) + bias
  );

  return { weights, bias, logits, targets };
}

function fitPlattScaler(
  logits: number[],
  targets: number[],
  options: Required<LogisticFitOptions>
): PlattScaler {
  let slope = 1;
  let intercept = 0;

  for (
    let iteration = 0;
    iteration < options.calibrationIterations;
    iteration += 1
  ) {
    let slopeGradient = 0;
    let interceptGradient = 0;

    for (let index = 0; index < logits.length; index += 1) {
      const logit = logits[index] ?? 0;
      const target = targets[index] ?? 0;
      const probability = sigmoid(slope * logit + intercept);
      const error = probability - target;
      slopeGradient += error * logit;
      interceptGradient += error;
    }

    slope -= options.learningRate * (slopeGradient / Math.max(logits.length, 1));
    intercept -=
      options.learningRate * (interceptGradient / Math.max(logits.length, 1));
  }

  return { slope, intercept };
}

function toFeatureLabel(featureKey: string): string {
  if (featureKey in METRIC_SPECS) {
    return METRIC_SPECS[featureKey as keyof typeof METRIC_SPECS].label;
  }

  return featureKey
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function roundProjectionValue(value: number, precision: number): number {
  return Number(value.toFixed(precision));
}

function toNonNegativeFinite(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, value);
}

function getMetricMultiplier(
  metric: ProjectableCountMetric,
  opponentAdjustment: ReturnType<typeof deriveOpponentAdjustmentFactors>
): number {
  if (SHOT_LIKE_METRICS.has(metric)) {
    return opponentAdjustment.shotRateMultiplier;
  }
  if (ASSIST_LIKE_METRICS.has(metric)) {
    return opponentAdjustment.assistRateMultiplier;
  }
  if (GOAL_LIKE_METRICS.has(metric)) {
    return opponentAdjustment.goalRateMultiplier;
  }
  return 1;
}

function buildRateBand(
  mean: number,
  variance: number,
  zScore: number,
  precision: number
): FaceoffRateBand {
  const sd = Math.sqrt(Math.max(variance, 0));
  return {
    lower: roundProjectionValue(clampRate(mean - zScore * sd), precision),
    mean: roundProjectionValue(clampRate(mean), precision),
    upper: roundProjectionValue(clampRate(mean + zScore * sd), precision)
  };
}

export function deriveSustainabilityLabel(
  input: TrainingTargetInput,
  config: LabelingConfig = { method: "zscore" }
): SustainabilityLabel {
  if (config.method === "quantile") {
    const quantile = toFiniteNumber(input.quantile);
    if (quantile === null) return "normal";

    const hotThreshold = clampQuantile(
      config.hotThreshold ?? DEFAULT_QUANTILE_HOT_THRESHOLD
    );
    const coldThreshold = clampQuantile(
      config.coldThreshold ?? DEFAULT_QUANTILE_COLD_THRESHOLD
    );

    if (coldThreshold > hotThreshold) {
      throw new Error(
        `Invalid quantile thresholds: coldThreshold (${coldThreshold}) cannot exceed hotThreshold (${hotThreshold})`
      );
    }

    if (quantile >= hotThreshold) return "hot";
    if (quantile <= coldThreshold) return "cold";
    return "normal";
  }

  const zScore = toFiniteNumber(input.zScore);
  if (zScore === null) return "normal";

  const hotThreshold = config.hotThreshold ?? DEFAULT_ZSCORE_HOT_THRESHOLD;
  const coldThreshold = config.coldThreshold ?? DEFAULT_ZSCORE_COLD_THRESHOLD;

  if (coldThreshold > hotThreshold) {
    throw new Error(
      `Invalid z-score thresholds: coldThreshold (${coldThreshold}) cannot exceed hotThreshold (${hotThreshold})`
    );
  }

  if (zScore >= hotThreshold) return "hot";
  if (zScore <= coldThreshold) return "cold";
  return "normal";
}

export function createTrainingTarget(
  input: TrainingTargetInput,
  config: LabelingConfig = { method: "zscore" }
): TrainingTarget {
  const label = deriveSustainabilityLabel(input, config);
  const sourceValue =
    config.method === "quantile"
      ? toFiniteNumber(input.quantile)
      : toFiniteNumber(input.zScore);

  return {
    playerId: input.playerId ?? null,
    snapshotDate: input.snapshotDate ?? null,
    metricKey: input.metricKey ?? null,
    label,
    classIndex: labelToClassIndex(label),
    sourceValue,
    method: config.method
  };
}

export function trainSustainabilityProbabilityModel(
  examples: LogisticTrainingExample[],
  options: LogisticFitOptions = {}
): SustainabilityProbabilityModel {
  const featureCount = validateExamples(examples);
  const resolvedOptions: Required<LogisticFitOptions> = {
    iterations: options.iterations ?? 600,
    learningRate: options.learningRate ?? 0.1,
    l2: options.l2 ?? 0.0005,
    calibrationIterations: options.calibrationIterations ?? 250
  };

  const models = CLASS_ORDER.map((label) => {
    const { weights, bias, logits, targets } = fitBinaryLogisticModel(
      examples,
      label,
      featureCount,
      resolvedOptions
    );
    return {
      label,
      weights,
      bias,
      platt: fitPlattScaler(logits, targets, resolvedOptions)
    };
  });

  return {
    featureCount,
    classOrder: [...CLASS_ORDER],
    models
  };
}

export function predictSustainabilityProbabilities(
  model: SustainabilityProbabilityModel,
  features: number[]
): SustainabilityProbabilityResult {
  if (features.length !== model.featureCount) {
    throw new Error(
      `Expected ${model.featureCount} features but received ${features.length}`
    );
  }

  const calibratedLogits = model.models.map((classModel) => {
    const rawScore = dotProduct(classModel.weights, features) + classModel.bias;
    const calibratedProbability = sigmoid(
      classModel.platt.slope * rawScore + classModel.platt.intercept
    );
    return Math.log(Math.max(calibratedProbability, EPSILON));
  });

  const probabilities = softmax(calibratedLogits);

  const probabilityMap = {
    cold: probabilities[0] ?? 0,
    normal: probabilities[1] ?? 0,
    hot: probabilities[2] ?? 0
  } satisfies Record<SustainabilityLabel, number>;

  const logitMap = {
    cold: calibratedLogits[0] ?? 0,
    normal: calibratedLogits[1] ?? 0,
    hot: calibratedLogits[2] ?? 0
  } satisfies Record<SustainabilityLabel, number>;

  const label = CLASS_ORDER.reduce<SustainabilityLabel>(
    (bestLabel, candidate) =>
      probabilityMap[candidate] > probabilityMap[bestLabel] ? candidate : bestLabel,
    "normal"
  );

  return {
    label,
    probabilities: probabilityMap,
    logits: logitMap
  };
}

export function extractFeatureImportance(
  model: SustainabilityProbabilityModel,
  features: number[],
  predictedLabel: SustainabilityLabel,
  featureKeys: string[],
  options: ExplanationOptions = {}
): FeatureImportance[] {
  if (features.length !== model.featureCount) {
    throw new Error(
      `Expected ${model.featureCount} features but received ${features.length}`
    );
  }

  if (featureKeys.length !== model.featureCount) {
    throw new Error(
      `Expected ${model.featureCount} feature keys but received ${featureKeys.length}`
    );
  }

  const classModel = model.models.find(
    (candidate) => candidate.label === predictedLabel
  );

  if (!classModel) {
    throw new Error(`Missing model weights for label ${predictedLabel}`);
  }

  const labels =
    options.featureLabels ??
    featureKeys.map((featureKey) => toFeatureLabel(featureKey));

  return featureKeys
    .map((featureKey, featureIndex) => {
      const featureValue = features[featureIndex] ?? 0;
      const weight = classModel.weights[featureIndex] ?? 0;
      const contribution = featureValue * weight;
      const label = labels[featureIndex] ?? toFeatureLabel(featureKey);
      return {
        featureIndex,
        featureKey,
        featureLabel: label,
        featureValue,
        weight,
        contribution,
        direction: contribution >= 0 ? "positive" : "negative"
      } satisfies FeatureImportance;
    })
    .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution));
}

export function generateExplanationText(
  importances: FeatureImportance[],
  predictedLabel: SustainabilityLabel,
  options: ExplanationOptions = {}
): string[] {
  const topN = options.topN ?? DEFAULT_EXPLANATION_COUNT;
  const selected = importances
    .filter((importance) => Math.abs(importance.contribution) > EPSILON)
    .slice(0, topN);

  return selected.map((importance) => {
    const directionWord =
      predictedLabel === "cold"
        ? importance.direction === "negative"
          ? "dragging"
          : "buffering"
        : importance.direction === "positive"
          ? "leading"
          : "lagging";

    const signedValue =
      importance.featureValue > 0
        ? `+${importance.featureValue.toFixed(2)}`
        : importance.featureValue.toFixed(2);

    return `${importance.featureLabel} ${directionWord} (${signedValue}, weight ${importance.weight.toFixed(2)})`;
  });
}

export function projectCountMetric(
  input: CountProjectionInput
): CountProjectionResult {
  const precision = input.precision ?? 4;
  const baseRatePer60 = toNonNegativeFinite(input.ratePer60) ?? 0;
  const toiSeconds = toNonNegativeFinite(input.toiSeconds) ?? 0;
  const model = input.distribution ?? "poisson";
  const overdispersion = toNonNegativeFinite(input.overdispersion) ?? null;
  const horizons = input.horizons?.length
    ? [...new Set(input.horizons.filter((horizon) => Number.isFinite(horizon) && horizon > 0))]
    : DEFAULT_PROJECTION_HORIZONS;

  const opponentAdjustment = deriveOpponentAdjustmentFactors(
    input.opponentAdjustment ?? {
      gamesPlayed: null,
      xgaPer60: null,
      caPer60: null,
      hdcaPer60: null,
      svPct: null,
      pkTier: null
    }
  );

  const adjustedRatePer60 = roundProjectionValue(
    baseRatePer60 * getMetricMultiplier(input.metric, opponentAdjustment),
    precision
  );

  const expectedPerGame = roundProjectionValue(
    (adjustedRatePer60 * toiSeconds) / 3600,
    precision
  );

  const perGame = buildCountDistribution({
    mean: expectedPerGame,
    model,
    overdispersion,
    precision
  });

  const horizonMap = horizons.reduce<
    Record<number, CountDistributionSummary & ForecastBands>
  >((acc, horizon) => {
    const aggregate = aggregateCountDistributions({
      perGameMeans: Array.from({ length: horizon }, () => perGame.mean),
      model,
      dispersion: overdispersion,
      precision
    });
    acc[horizon] = {
      ...aggregate,
      ...emitForecastBands(aggregate, precision)
    };
    return acc;
  }, {});

  return {
    metric: input.metric,
    expectedPerGame,
    adjustedRatePer60,
    adjustedToiSeconds: roundProjectionValue(toiSeconds, precision),
    opponentAdjustment,
    perGame,
    horizons: horizonMap
  };
}

export function projectFaceoffWinPct(
  input: FaceoffRateProjectionInput
): FaceoffRateProjectionResult {
  const precision = input.precision ?? 4;
  const expectedWinPct = clampRate(toNonNegativeFinite(input.winPct) ?? 0);
  const attemptsPerGame = toNonNegativeFinite(input.attemptsPerGame) ?? 0;
  const expectedWinsPerGame = roundProjectionValue(
    expectedWinPct * attemptsPerGame,
    precision
  );
  const perGameVariance =
    attemptsPerGame > 0
      ? (expectedWinPct * (1 - expectedWinPct)) / attemptsPerGame
      : 0;
  const horizons = input.horizons?.length
    ? [...new Set(input.horizons.filter((horizon) => Number.isFinite(horizon) && horizon > 0))]
    : DEFAULT_PROJECTION_HORIZONS;

  const horizonMap = horizons.reduce<FaceoffRateProjectionResult["horizons"]>(
    (acc, horizon) => {
      const totalAttempts = attemptsPerGame * horizon;
      const totalExpectedWins = expectedWinPct * totalAttempts;
      const rateVariance =
        totalAttempts > 0
          ? (expectedWinPct * (1 - expectedWinPct)) / totalAttempts
          : 0;

      acc[horizon] = {
        attempts: roundProjectionValue(totalAttempts, precision),
        expectedWins: roundProjectionValue(totalExpectedWins, precision),
        expectedWinPct: roundProjectionValue(expectedWinPct, precision),
        band50: buildRateBand(expectedWinPct, rateVariance, 0.6744897501960817, precision),
        band80: buildRateBand(expectedWinPct, rateVariance, 1.2815515655446004, precision)
      };
      return acc;
    },
    {}
  );

  return {
    expectedWinPct: roundProjectionValue(expectedWinPct, precision),
    attemptsPerGame: roundProjectionValue(attemptsPerGame, precision),
    expectedWinsPerGame,
    perGameBand80: buildRateBand(
      expectedWinPct,
      perGameVariance,
      1.2815515655446004,
      precision
    ),
    horizons: horizonMap
  };
}
