import {
  predictBinaryLogisticProbability,
  trainBinaryLogisticModel,
  type BinaryLabel,
} from "./binaryLogistic";

export type ProbabilityLabel = BinaryLabel;

export type CalibrationExample = {
  rowId: string;
  label: ProbabilityLabel;
  prediction: number;
};

export type ProbabilityMetrics = {
  exampleCount: number;
  goalCount: number;
  goalRate: number | null;
  averagePrediction: number | null;
  logLoss: number | null;
  brierScore: number | null;
};

export type CalibrationMethodResult = {
  method: "raw" | "platt" | "isotonic";
  applicable: boolean;
  metrics: ProbabilityMetrics;
};

export type CalibrationAssessment = {
  requiresPostCalibration: boolean;
  requirementReason: string;
  validationStrategy: "cross_validated_holdout";
  holdoutExampleCount: number;
  holdoutPositiveCount: number;
  reboundPositiveCount: number;
  rushPositiveCount: number;
  trustWarnings: string[];
  adoptabilityBlockingReasons: string[];
  methods: CalibrationMethodResult[];
  bestObservedMethod: "raw" | "platt" | "isotonic" | null;
  adoptableMethod: "raw" | "platt" | "isotonic" | null;
};

const MIN_ADOPTABLE_HOLDOUT_POSITIVES = 10;
const MIN_ADOPTABLE_REBOUND_POSITIVES = 1;
const MIN_ADOPTABLE_RUSH_POSITIVES = 1;

type IsotonicBlock = {
  maxPrediction: number;
  weight: number;
  averageLabel: number;
};

type IsotonicModel = {
  blocks: IsotonicBlock[];
};

const EPSILON = 1e-9;

function clipProbability(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.min(1 - EPSILON, Math.max(EPSILON, value));
}

function roundMetric(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(6));
}

function logit(probability: number): number {
  const clipped = clipProbability(probability);
  return Math.log(clipped / (1 - clipped));
}

export function evaluateProbabilityMetrics(
  examples: Array<{ label: ProbabilityLabel; prediction: number }>
): ProbabilityMetrics {
  if (!examples.length) {
    return {
      exampleCount: 0,
      goalCount: 0,
      goalRate: null,
      averagePrediction: null,
      logLoss: null,
      brierScore: null,
    };
  }

  let goalCount = 0;
  let predictionSum = 0;
  let logLossSum = 0;
  let brierSum = 0;

  for (const example of examples) {
    const prediction = clipProbability(example.prediction);
    goalCount += example.label;
    predictionSum += prediction;
    logLossSum += example.label === 1 ? -Math.log(prediction) : -Math.log(1 - prediction);
    brierSum += (prediction - example.label) ** 2;
  }

  return {
    exampleCount: examples.length,
    goalCount,
    goalRate: roundMetric(goalCount / examples.length),
    averagePrediction: roundMetric(predictionSum / examples.length),
    logLoss: roundMetric(logLossSum / examples.length),
    brierScore: roundMetric(brierSum / examples.length),
  };
}

function buildHoldoutWarningList(
  examples: CalibrationExample[],
  featureKeys: string[],
  splitCounts: { test: number },
  sliceCoverage: { reboundPositiveCount: number; rushPositiveCount: number }
): string[] {
  const warnings: string[] = [];
  const positiveCount = examples.reduce((sum, example) => sum + example.label, 0);

  if (featureKeys.includes("shotEventType:goal")) {
    warnings.push(
      "Label leakage remains present because the feature set still includes shotEventType:goal."
    );
  }

  if (splitCounts.test === 0) {
    warnings.push("No dedicated test split is available; calibration comparison is holdout cross-validation only.");
  }

  if (positiveCount < 10) {
    warnings.push("Holdout positive-goal coverage is sparse, so calibration comparisons are unstable.");
  }

  if (sliceCoverage.reboundPositiveCount < MIN_ADOPTABLE_REBOUND_POSITIVES) {
    warnings.push("Positive rebound holdout coverage is absent, so rebound-slice calibration is not approval-grade.");
  }

  if (sliceCoverage.rushPositiveCount < MIN_ADOPTABLE_RUSH_POSITIVES) {
    warnings.push("Positive rush holdout coverage is absent, so rush-slice calibration is not approval-grade.");
  }

  return warnings;
}

function buildAdoptabilityBlockingReasons(args: {
  featureKeys: string[];
  splitCounts: { test: number };
  holdoutPositiveCount: number;
  sliceCoverage: { reboundPositiveCount: number; rushPositiveCount: number };
}): string[] {
  const reasons: string[] = [];

  if (args.featureKeys.includes("shotEventType:goal")) {
    reasons.push(
      "Label leakage remains present because the feature set still includes shotEventType:goal."
    );
  }

  if (args.splitCounts.test <= 0) {
    reasons.push(
      "No dedicated test split is available; calibration cannot be treated as adoptable."
    );
  }

  if (args.holdoutPositiveCount < MIN_ADOPTABLE_HOLDOUT_POSITIVES) {
    reasons.push(
      `Holdout positive-goal coverage is below the adoptability minimum of ${MIN_ADOPTABLE_HOLDOUT_POSITIVES}.`
    );
  }

  if (args.sliceCoverage.reboundPositiveCount < MIN_ADOPTABLE_REBOUND_POSITIVES) {
    reasons.push(
      `Positive rebound holdout coverage is below the adoptability minimum of ${MIN_ADOPTABLE_REBOUND_POSITIVES}.`
    );
  }

  if (args.sliceCoverage.rushPositiveCount < MIN_ADOPTABLE_RUSH_POSITIVES) {
    reasons.push(
      `Positive rush holdout coverage is below the adoptability minimum of ${MIN_ADOPTABLE_RUSH_POSITIVES}.`
    );
  }

  return reasons;
}

function estimateMaximumCalibrationGap(examples: CalibrationExample[], binCount = 10): number {
  if (!examples.length) return 0;

  const bins = Array.from({ length: binCount }, () => [] as CalibrationExample[]);

  for (const example of examples) {
    const clipped = clipProbability(example.prediction);
    const rawIndex = Math.floor(clipped * binCount);
    const binIndex = Math.min(binCount - 1, Math.max(0, rawIndex));
    bins[binIndex]?.push(example);
  }

  let maxGap = 0;
  for (const bin of bins) {
    if (bin.length < 5) continue;

    const metrics = evaluateProbabilityMetrics(bin);
    if (metrics.goalRate == null || metrics.averagePrediction == null) continue;
    maxGap = Math.max(maxGap, Math.abs(metrics.goalRate - metrics.averagePrediction));
  }

  return maxGap;
}

function determineCalibrationRequirement(examples: CalibrationExample[]): {
  requiresPostCalibration: boolean;
  requirementReason: string;
} {
  const metrics = evaluateProbabilityMetrics(examples);
  const averageGap =
    metrics.goalRate != null && metrics.averagePrediction != null
      ? Math.abs(metrics.goalRate - metrics.averagePrediction)
      : 0;
  const maxGap = estimateMaximumCalibrationGap(examples);

  if (averageGap >= 0.02) {
    return {
      requiresPostCalibration: true,
      requirementReason: `Average prediction differs from observed goal rate by ${roundMetric(averageGap)}.`,
    };
  }

  if (maxGap >= 0.1) {
    return {
      requiresPostCalibration: true,
      requirementReason: `At least one populated calibration bin differs from observed rate by ${roundMetric(maxGap)}.`,
    };
  }

  return {
    requiresPostCalibration: false,
    requirementReason: "Average prediction and populated calibration bins stay within the current baseline tolerance.",
  };
}

function assignFoldIndices(examples: CalibrationExample[], foldCount: number): Map<string, number> {
  const foldByRowId = new Map<string, number>();
  const positives = examples
    .filter((example) => example.label === 1)
    .sort((left, right) => left.rowId.localeCompare(right.rowId));
  const negatives = examples
    .filter((example) => example.label === 0)
    .sort((left, right) => left.rowId.localeCompare(right.rowId));

  positives.forEach((example, index) => {
    foldByRowId.set(example.rowId, index % foldCount);
  });
  negatives.forEach((example, index) => {
    foldByRowId.set(example.rowId, index % foldCount);
  });

  return foldByRowId;
}

function fitPlattCalibrator(examples: CalibrationExample[]): { predict: (prediction: number) => number } | null {
  const labels = new Set(examples.map((example) => example.label));
  if (examples.length < 10 || labels.size < 2) {
    return null;
  }

  const trainingExamples = examples.map((example) => ({
    features: [logit(example.prediction)],
    label: example.label,
  }));
  const model = trainBinaryLogisticModel(trainingExamples, {
    iterations: 400,
    learningRate: 0.05,
    l1: 0,
    l2: 0.001,
  });

  return {
    predict: (prediction: number) =>
      predictBinaryLogisticProbability(model, [logit(prediction)]),
  };
}

function fitIsotonicCalibrator(examples: CalibrationExample[]): { predict: (prediction: number) => number } | null {
  const labels = new Set(examples.map((example) => example.label));
  if (examples.length < 10 || labels.size < 2) {
    return null;
  }

  const sorted = [...examples].sort((left, right) => {
    if (left.prediction !== right.prediction) {
      return left.prediction - right.prediction;
    }

    return left.rowId.localeCompare(right.rowId);
  });

  const blocks: IsotonicBlock[] = sorted.map((example) => ({
    maxPrediction: clipProbability(example.prediction),
    weight: 1,
    averageLabel: example.label,
  }));

  let index = 0;
  while (index < blocks.length - 1) {
    if (blocks[index]!.averageLabel <= blocks[index + 1]!.averageLabel) {
      index += 1;
      continue;
    }

    const left = blocks[index]!;
    const right = blocks[index + 1]!;
    const mergedWeight = left.weight + right.weight;
    blocks.splice(index, 2, {
      maxPrediction: right.maxPrediction,
      weight: mergedWeight,
      averageLabel:
        (left.averageLabel * left.weight + right.averageLabel * right.weight) / mergedWeight,
    });

    if (index > 0) {
      index -= 1;
    }
  }

  const model: IsotonicModel = { blocks };
  return {
    predict: (prediction: number) => predictIsotonicProbability(model, prediction),
  };
}

function predictIsotonicProbability(model: IsotonicModel, prediction: number): number {
  const clipped = clipProbability(prediction);

  for (const block of model.blocks) {
    if (clipped <= block.maxPrediction) {
      return clipProbability(block.averageLabel);
    }
  }

  return clipProbability(model.blocks[model.blocks.length - 1]?.averageLabel ?? clipped);
}

function runCrossValidatedCalibrationMethod(
  examples: CalibrationExample[],
  foldCount: number,
  method: "platt" | "isotonic"
): CalibrationMethodResult {
  const foldByRowId = assignFoldIndices(examples, foldCount);
  const calibratedExamples: Array<{ label: ProbabilityLabel; prediction: number }> = [];

  for (let fold = 0; fold < foldCount; fold += 1) {
    const training = examples.filter((example) => foldByRowId.get(example.rowId) !== fold);
    const testing = examples.filter((example) => foldByRowId.get(example.rowId) === fold);
    if (!testing.length) {
      continue;
    }

    const calibrator =
      method === "platt" ? fitPlattCalibrator(training) : fitIsotonicCalibrator(training);
    if (!calibrator) {
      return {
        method,
        applicable: false,
        metrics: evaluateProbabilityMetrics([]),
      };
    }

    for (const example of testing) {
      calibratedExamples.push({
        label: example.label,
        prediction: calibrator.predict(example.prediction),
      });
    }
  }

  return {
    method,
    applicable: calibratedExamples.length === examples.length,
    metrics: evaluateProbabilityMetrics(calibratedExamples),
  };
}

function pickBestMethod(methods: CalibrationMethodResult[]): "raw" | "platt" | "isotonic" | null {
  const comparable = methods.filter(
    (method) => method.applicable && method.metrics.logLoss != null
  );
  if (!comparable.length) {
    return null;
  }

  comparable.sort((left, right) => {
    const leftLogLoss = left.metrics.logLoss ?? Number.POSITIVE_INFINITY;
    const rightLogLoss = right.metrics.logLoss ?? Number.POSITIVE_INFINITY;
    if (leftLogLoss !== rightLogLoss) {
      return leftLogLoss - rightLogLoss;
    }

    const leftBrier = left.metrics.brierScore ?? Number.POSITIVE_INFINITY;
    const rightBrier = right.metrics.brierScore ?? Number.POSITIVE_INFINITY;
    return leftBrier - rightBrier;
  });

  return comparable[0]?.method ?? null;
}

export function assessCalibration(
  examples: CalibrationExample[],
  args: {
    featureKeys: string[];
    splitCounts: { test: number };
    sliceCoverage: { reboundPositiveCount: number; rushPositiveCount: number };
  }
): CalibrationAssessment {
  const holdoutPositiveCount = examples.reduce((sum, example) => sum + example.label, 0);
  const trustWarnings = buildHoldoutWarningList(
    examples,
    args.featureKeys,
    args.splitCounts,
    args.sliceCoverage
  );
  const adoptabilityBlockingReasons = buildAdoptabilityBlockingReasons({
    featureKeys: args.featureKeys,
    splitCounts: args.splitCounts,
    holdoutPositiveCount,
    sliceCoverage: args.sliceCoverage,
  });
  const requirement = determineCalibrationRequirement(examples);

  const rawMethod: CalibrationMethodResult = {
    method: "raw",
    applicable: true,
    metrics: evaluateProbabilityMetrics(examples),
  };
  const foldCount = Math.min(5, Math.max(2, holdoutPositiveCount));
  const methods: CalibrationMethodResult[] = [
    rawMethod,
    runCrossValidatedCalibrationMethod(examples, foldCount, "platt"),
    runCrossValidatedCalibrationMethod(examples, foldCount, "isotonic"),
  ];
  const bestObservedMethod = pickBestMethod(methods);
  const adoptableMethod =
    adoptabilityBlockingReasons.length === 0 ? bestObservedMethod : null;

  return {
    requiresPostCalibration: requirement.requiresPostCalibration,
    requirementReason: requirement.requirementReason,
    validationStrategy: "cross_validated_holdout",
    holdoutExampleCount: examples.length,
    holdoutPositiveCount,
    reboundPositiveCount: args.sliceCoverage.reboundPositiveCount,
    rushPositiveCount: args.sliceCoverage.rushPositiveCount,
    trustWarnings,
    adoptabilityBlockingReasons,
    methods,
    bestObservedMethod,
    adoptableMethod,
  };
}
