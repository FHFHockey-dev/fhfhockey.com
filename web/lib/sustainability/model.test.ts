import { describe, expect, it } from "vitest";

import {
  createTrainingTarget,
  deriveSustainabilityLabel,
  extractFeatureImportance,
  generateExplanationText,
  predictSustainabilityProbabilities,
  trainSustainabilityProbabilityModel
} from "./model";

describe("sustainability model training targets", () => {
  it("labels hot, normal, and cold examples from z-scores", () => {
    expect(deriveSustainabilityLabel({ zScore: 1.3 })).toBe("hot");
    expect(deriveSustainabilityLabel({ zScore: 0.2 })).toBe("normal");
    expect(deriveSustainabilityLabel({ zScore: -1.4 })).toBe("cold");
  });

  it("supports quantile-based labels", () => {
    expect(
      deriveSustainabilityLabel(
        { quantile: 0.92 },
        { method: "quantile", hotThreshold: 0.85, coldThreshold: 0.15 }
      )
    ).toBe("hot");

    expect(
      deriveSustainabilityLabel(
        { quantile: 0.5 },
        { method: "quantile", hotThreshold: 0.85, coldThreshold: 0.15 }
      )
    ).toBe("normal");

    expect(
      deriveSustainabilityLabel(
        { quantile: 0.08 },
        { method: "quantile", hotThreshold: 0.85, coldThreshold: 0.15 }
      )
    ).toBe("cold");
  });

  it("defaults missing source values to normal", () => {
    expect(deriveSustainabilityLabel({ zScore: null })).toBe("normal");
    expect(
      deriveSustainabilityLabel({ quantile: null }, { method: "quantile" })
    ).toBe("normal");
  });

  it("creates a training target with a stable class index", () => {
    expect(
      createTrainingTarget(
        {
          playerId: 8478402,
          snapshotDate: "2026-03-08",
          metricKey: "shots_per_60",
          zScore: 1.18
        },
        { method: "zscore", hotThreshold: 1, coldThreshold: -1 }
      )
    ).toEqual({
      playerId: 8478402,
      snapshotDate: "2026-03-08",
      metricKey: "shots_per_60",
      label: "hot",
      classIndex: 2,
      sourceValue: 1.18,
      method: "zscore"
    });
  });

  it("rejects inverted threshold configurations", () => {
    expect(() =>
      deriveSustainabilityLabel(
        { zScore: 0.4 },
        { method: "zscore", hotThreshold: 0, coldThreshold: 1 }
      )
    ).toThrow("Invalid z-score thresholds");

    expect(() =>
      deriveSustainabilityLabel(
        { quantile: 0.4 },
        { method: "quantile", hotThreshold: 0.2, coldThreshold: 0.8 }
      )
    ).toThrow("Invalid quantile thresholds");
  });

  it("fits a logistic probability model and returns normalized class probabilities", () => {
    const model = trainSustainabilityProbabilityModel(
      [
        { features: [-2, -1.8], label: "cold" },
        { features: [-1.5, -1.2], label: "cold" },
        { features: [-0.2, 0.1], label: "normal" },
        { features: [0.1, -0.1], label: "normal" },
        { features: [1.4, 1.7], label: "hot" },
        { features: [1.8, 2.2], label: "hot" }
      ],
      {
        iterations: 800,
        learningRate: 0.15,
        calibrationIterations: 300
      }
    );

    const hotPrediction = predictSustainabilityProbabilities(model, [1.6, 1.9]);
    const coldPrediction = predictSustainabilityProbabilities(model, [-1.8, -1.4]);
    const neutralPrediction = predictSustainabilityProbabilities(model, [0, 0]);

    expect(hotPrediction.label).toBe("hot");
    expect(coldPrediction.label).toBe("cold");
    expect(neutralPrediction.label).toBe("normal");

    expect(
      hotPrediction.probabilities.hot +
        hotPrediction.probabilities.normal +
        hotPrediction.probabilities.cold
    ).toBeCloseTo(1, 6);

    expect(hotPrediction.probabilities.hot).toBeGreaterThan(0.6);
    expect(coldPrediction.probabilities.cold).toBeGreaterThan(0.6);
    expect(neutralPrediction.probabilities.normal).toBeGreaterThan(0.34);
  });

  it("rejects inconsistent training shapes or prediction feature counts", () => {
    expect(() =>
      trainSustainabilityProbabilityModel([
        { features: [1, 2], label: "hot" },
        { features: [1], label: "cold" }
      ])
    ).toThrow("same feature count");

    const model = trainSustainabilityProbabilityModel([
      { features: [1, 2], label: "hot" },
      { features: [0, 0], label: "normal" },
      { features: [-1, -2], label: "cold" }
    ]);

    expect(() => predictSustainabilityProbabilities(model, [1])).toThrow(
      "Expected 2 features"
    );
  });

  it("extracts ranked feature importance and explanation text", () => {
    const model = trainSustainabilityProbabilityModel(
      [
        { features: [-1.8, -1.5, -1.2], label: "cold" },
        { features: [-1.4, -1.1, -0.8], label: "cold" },
        { features: [0.1, 0, 0.2], label: "normal" },
        { features: [0, 0.2, -0.1], label: "normal" },
        { features: [1.4, 1.1, 1.6], label: "hot" },
        { features: [1.8, 1.5, 2], label: "hot" }
      ],
      {
        iterations: 900,
        learningRate: 0.12,
        calibrationIterations: 350
      }
    );

    const prediction = predictSustainabilityProbabilities(model, [1.7, 1.2, 1.8]);
    const importance = extractFeatureImportance(
      model,
      [1.7, 1.2, 1.8],
      prediction.label,
      ["shots_per_60", "ixg_per_60", "pp_toi_pct"]
    );

    expect(prediction.label).toBe("hot");
    expect(importance).toHaveLength(3);
    expect(Math.abs(importance[0].contribution)).toBeGreaterThanOrEqual(
      Math.abs(importance[1].contribution)
    );
    expect(importance[0]?.featureLabel).toBeTruthy();

    const explanation = generateExplanationText(importance, prediction.label, {
      topN: 2
    });

    expect(explanation).toHaveLength(2);
    expect(explanation[0]).toContain("weight");
    expect(explanation.join(" ")).toMatch(/Shots \/ 60|ixG \/ 60|PP TOI %/);
  });
});
