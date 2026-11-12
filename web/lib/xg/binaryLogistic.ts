export type BinaryLabel = 0 | 1;

export type BinaryTrainingExample = {
  features: number[];
  label: BinaryLabel;
  weight?: number;
};

export type BinaryLogisticFitOptions = {
  iterations?: number;
  learningRate?: number;
  l1?: number;
  l2?: number;
};

export type BinaryLogisticModel = {
  featureCount: number;
  weights: number[];
  bias: number;
};

const EPSILON = 1e-9;

function dotProduct(left: number[], right: number[]): number {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += left[index] * (right[index] ?? 0);
  }
  return sum;
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const exp = Math.exp(-value);
    return 1 / (1 + exp);
  }

  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function validateExamples(examples: BinaryTrainingExample[]): number {
  if (!examples.length) {
    throw new Error("At least one binary training example is required.");
  }

  const featureCount = examples[0]?.features.length ?? 0;
  if (featureCount <= 0) {
    throw new Error("Binary training examples must include at least one feature.");
  }

  for (const example of examples) {
    if (example.features.length !== featureCount) {
      throw new Error("All binary training examples must use the same feature count.");
    }

    if (example.label !== 0 && example.label !== 1) {
      throw new Error("Binary training labels must be 0 or 1.");
    }

    if (
      example.weight != null &&
      (!Number.isFinite(example.weight) || example.weight <= 0)
    ) {
      throw new Error("Binary training example weights must be positive finite numbers.");
    }

    for (const feature of example.features) {
      if (!Number.isFinite(feature)) {
        throw new Error("Binary training features must be finite numbers.");
      }
    }
  }

  return featureCount;
}

function sign(value: number): number {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

export function trainBinaryLogisticModel(
  examples: BinaryTrainingExample[],
  options: BinaryLogisticFitOptions = {}
): BinaryLogisticModel {
  const featureCount = validateExamples(examples);
  const iterations = options.iterations ?? 800;
  const learningRate = options.learningRate ?? 0.05;
  const l1 = options.l1 ?? 0;
  const l2 = options.l2 ?? 0;
  const totalWeight = examples.reduce(
    (sum, example) => sum + (example.weight ?? 1),
    0,
  );

  const weights = Array.from({ length: featureCount }, () => 0);
  let bias = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const gradient = Array.from({ length: featureCount }, () => 0);
    let biasGradient = 0;

    for (const example of examples) {
      const score = dotProduct(weights, example.features) + bias;
      const prediction = sigmoid(score);
      const error = prediction - example.label;
      const exampleWeight = example.weight ?? 1;

      for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
        gradient[featureIndex] +=
          error * example.features[featureIndex] * exampleWeight;
      }

      biasGradient += error * exampleWeight;
    }

    for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
      const penalty = l1 * sign(weights[featureIndex]) + l2 * weights[featureIndex];
      weights[featureIndex] -=
        learningRate * (gradient[featureIndex] / totalWeight + penalty);
    }

    bias -= learningRate * (biasGradient / totalWeight);
  }

  return {
    featureCount,
    weights,
    bias,
  };
}

export function predictBinaryLogisticProbability(
  model: BinaryLogisticModel,
  features: number[]
): number {
  if (features.length !== model.featureCount) {
    throw new Error(
      `Expected ${model.featureCount} features but received ${features.length}.`
    );
  }

  return Math.min(
    1 - EPSILON,
    Math.max(EPSILON, sigmoid(dotProduct(model.weights, features) + model.bias))
  );
}

export type BinaryLogisticFitDiagnostics = {
  /** Mean log loss + l1|w| + (l2/2)||w||^2: the objective the fit minimizes. */
  objective: number;
  /** Euclidean norm of the objective's (sub)gradient, intercept included. */
  gradientNorm: number;
  /** With an unpenalized intercept these are equal at the optimum. */
  meanPrediction: number;
  meanLabel: number;
  tolerance: number;
  converged: boolean;
};

/**
 * Convergence check for a fitted model: a fixed iteration count is not proof
 * of an optimum. The intercept's stationarity condition means the weighted
 * mean prediction must equal the weighted mean label at convergence.
 */
export function diagnoseBinaryLogisticFit(
  model: BinaryLogisticModel,
  examples: BinaryTrainingExample[],
  options: BinaryLogisticFitOptions & { tolerance?: number } = {}
): BinaryLogisticFitDiagnostics {
  const l1 = options.l1 ?? 0;
  const l2 = options.l2 ?? 0;
  const tolerance = options.tolerance ?? 1e-4;
  const gradient = Array.from({ length: model.featureCount }, () => 0);
  let biasGradient = 0;
  let totalWeight = 0;
  let logLoss = 0;
  let predictionSum = 0;
  let labelSum = 0;
  for (const example of examples) {
    const weight = example.weight ?? 1;
    const prediction = sigmoid(dotProduct(model.weights, example.features) + model.bias);
    const clipped = Math.min(1 - EPSILON, Math.max(EPSILON, prediction));
    totalWeight += weight;
    predictionSum += prediction * weight;
    labelSum += example.label * weight;
    logLoss -= weight * (example.label === 1 ? Math.log(clipped) : Math.log(1 - clipped));
    const error = prediction - example.label;
    for (let index = 0; index < model.featureCount; index += 1) {
      gradient[index] += error * example.features[index] * weight;
    }
    biasGradient += error * weight;
  }
  let squaredNorm = (biasGradient / totalWeight) ** 2;
  let penalty = 0;
  for (let index = 0; index < model.featureCount; index += 1) {
    const w = model.weights[index]!;
    penalty += l1 * Math.abs(w) + (l2 / 2) * w * w;
    const smooth = gradient[index]! / totalWeight + l2 * w;
    // Subgradient of l1|w| at w = 0 can cancel up to l1 of the smooth part.
    const component = w !== 0 ? smooth + l1 * sign(w) : Math.sign(smooth) * Math.max(0, Math.abs(smooth) - l1);
    squaredNorm += component * component;
  }
  const gradientNorm = Math.sqrt(squaredNorm);
  return {
    objective: logLoss / totalWeight + penalty,
    gradientNorm,
    meanPrediction: predictionSum / totalWeight,
    meanLabel: labelSum / totalWeight,
    tolerance,
    converged: gradientNorm <= tolerance,
  };
}

export type L2SweepResult = {
  candidates: Array<{ l2: number; validationLogLoss: number; diagnostics: BinaryLogisticFitDiagnostics }>;
  selectedL2: number;
};

/**
 * Chooses the L2 strength by validation log loss over a fixed grid (fit on
 * train only). Ties go to the larger penalty, so the choice does not depend
 * on grid order.
 */
export function selectL2ByValidation(
  train: BinaryTrainingExample[],
  validation: BinaryTrainingExample[],
  grid: number[],
  options: Omit<BinaryLogisticFitOptions, "l2"> & { tolerance?: number } = {}
): L2SweepResult {
  const values = Array.from(new Set(grid.filter((value) => Number.isFinite(value) && value >= 0))).sort((a, b) => a - b);
  if (!values.length || !validation.length) throw new Error("An L2 sweep needs a non-empty grid and validation split.");
  const candidates = values.map((l2) => {
    const model = trainBinaryLogisticModel(train, { ...options, l2 });
    const validationLogLoss =
      validation.reduce((sum, example) => {
        const probability = predictBinaryLogisticProbability(model, example.features);
        return sum - (example.label === 1 ? Math.log(probability) : Math.log(1 - probability));
      }, 0) / validation.length;
    return { l2, validationLogLoss, diagnostics: diagnoseBinaryLogisticFit(model, train, { ...options, l2 }) };
  });
  const best = candidates.reduce((winner, candidate) =>
    candidate.validationLogLoss < winner.validationLogLoss - 1e-12 ||
    (Math.abs(candidate.validationLogLoss - winner.validationLogLoss) <= 1e-12 && candidate.l2 > winner.l2)
      ? candidate
      : winner
  );
  return { candidates, selectedL2: best.l2 };
}
