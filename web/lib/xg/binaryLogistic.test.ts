import { describe, expect, it } from "vitest";

import {
  diagnoseBinaryLogisticFit,
  predictBinaryLogisticProbability,
  selectL2ByValidation,
  trainBinaryLogisticModel,
  type BinaryTrainingExample,
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

  it("honors positive sample weights without changing the unweighted contract", () => {
    const weighted = trainBinaryLogisticModel(
      [
        { features: [0], label: 0 as const, weight: 1 },
        { features: [0], label: 1 as const, weight: 9 },
      ],
      { iterations: 300, learningRate: 0.1 },
    );
    const unweighted = trainBinaryLogisticModel(
      [
        { features: [0], label: 0 as const },
        { features: [0], label: 1 as const },
      ],
      { iterations: 300, learningRate: 0.1 },
    );

    expect(predictBinaryLogisticProbability(weighted, [0])).toBeGreaterThan(0.8);
    expect(predictBinaryLogisticProbability(unweighted, [0])).toBeCloseTo(0.5, 2);
  });
});

describe("binaryLogistic convergence and L2 selection (BA W1-1 B)", () => {
  // Frozen rare-event data like shots: a 7% base rate and one real signal.
  function rareEventExamples(count: number, seed: number): BinaryTrainingExample[] {
    let state = seed;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    return Array.from({ length: count }, () => {
      const signal = random() * 2 - 1;
      const noise = random() * 2 - 1;
      const probability = 1 / (1 + Math.exp(-(-2.7 + 1.2 * signal)));
      return { features: [signal, noise], label: (random() < probability ? 1 : 0) as 0 | 1 };
    });
  }

  it("flags an unconverged fit: the mean prediction misses the mean label", () => {
    const train = rareEventExamples(4000, 3);
    const options = { iterations: 50, learningRate: 0.05, l2: 0.0005 };
    const diagnostics = diagnoseBinaryLogisticFit(trainBinaryLogisticModel(train, options), train, options);
    expect(diagnostics.converged).toBe(false);
    expect(Math.abs(diagnostics.meanPrediction - diagnostics.meanLabel)).toBeGreaterThan(0.01);
  });

  it("at convergence the unpenalized intercept makes mean prediction equal mean label", () => {
    const train = rareEventExamples(4000, 3);
    const options = { iterations: 6000, learningRate: 1, l2: 0.0005, tolerance: 1e-5 };
    const diagnostics = diagnoseBinaryLogisticFit(trainBinaryLogisticModel(train, options), train, options);
    expect(diagnostics.converged).toBe(true);
    expect(diagnostics.meanPrediction).toBeCloseTo(diagnostics.meanLabel, 5);
  });

  it("selects L2 by validation log loss, independent of grid order", () => {
    const train = rareEventExamples(3000, 5);
    const validation = rareEventExamples(3000, 11);
    const options = { iterations: 3000, learningRate: 1 };
    const forward = selectL2ByValidation(train, validation, [0, 0.0005, 0.01, 1], options);
    const reverse = selectL2ByValidation(train, validation, [1, 0.01, 0.0005, 0], options);
    expect(reverse.selectedL2).toBe(forward.selectedL2);
    const best = Math.min(...forward.candidates.map((candidate) => candidate.validationLogLoss));
    expect(forward.candidates.find((candidate) => candidate.l2 === forward.selectedL2)?.validationLogLoss).toBe(best);
    // A penalty that erases the real signal loses on validation.
    expect(forward.selectedL2).not.toBe(1);
  });
});
