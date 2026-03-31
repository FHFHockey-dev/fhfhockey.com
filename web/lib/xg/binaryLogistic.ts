export type BinaryLabel = 0 | 1;

export type BinaryTrainingExample = {
  features: number[];
  label: BinaryLabel;
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

  const weights = Array.from({ length: featureCount }, () => 0);
  let bias = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const gradient = Array.from({ length: featureCount }, () => 0);
    let biasGradient = 0;

    for (const example of examples) {
      const score = dotProduct(weights, example.features) + bias;
      const prediction = sigmoid(score);
      const error = prediction - example.label;

      for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
        gradient[featureIndex] += error * example.features[featureIndex];
      }

      biasGradient += error;
    }

    for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
      const penalty = l1 * sign(weights[featureIndex]) + l2 * weights[featureIndex];
      weights[featureIndex] -=
        learningRate * (gradient[featureIndex] / examples.length + penalty);
    }

    bias -= learningRate * (biasGradient / examples.length);
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
