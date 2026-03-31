import { describe, expect, it } from "vitest";

import {
  predictBinaryLogisticProbability,
  trainBinaryLogisticModel,
} from "./binaryLogistic";

describe("binaryLogistic", () => {
  it("supports L1/L2 fit options and returns finite predictions", () => {
    const examples = [
      { features: [0, 0], label: 0 as const },
      { features: [0, 1], label: 0 as const },
      { features: [1, 0], label: 1 as const },
      { features: [1, 1], label: 1 as const },
    ];

    const model = trainBinaryLogisticModel(examples, {
      iterations: 200,
      learningRate: 0.1,
      l1: 0.01,
      l2: 0.05,
    });

    expect(model.featureCount).toBe(2);
    expect(model.weights.every((weight) => Number.isFinite(weight))).toBe(true);
    expect(Number.isFinite(model.bias)).toBe(true);

    const probability = predictBinaryLogisticProbability(model, [1, 1]);
    expect(probability).toBeGreaterThan(0);
    expect(probability).toBeLessThan(1);
  });
});
