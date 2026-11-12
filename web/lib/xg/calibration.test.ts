import { describe, expect, it } from "vitest";

import {
  assessCalibration,
  evaluateProbabilityMetrics,
  fitProbabilityCalibrator,
  type CalibrationExample,
} from "./calibration";

function createExample(
  rowId: string,
  label: 0 | 1,
  prediction: number
): CalibrationExample {
  return { rowId, label, prediction };
}

describe("calibration helpers", () => {
  it("computes probability metrics", () => {
    const metrics = evaluateProbabilityMetrics([
      createExample("a", 1, 0.8),
      createExample("b", 0, 0.2),
    ]);

    expect(metrics).toMatchObject({
      exampleCount: 2,
      goalCount: 1,
      goalRate: 0.5,
      averagePrediction: 0.5,
      brierScore: 0.04,
    });
    expect(metrics.logLoss).toBeCloseTo(0.223144, 6);
  });

  it("flags leakage warnings and evaluates calibration methods", () => {
    const examples: CalibrationExample[] = [];
    for (let index = 0; index < 24; index += 1) {
      const label = index % 6 === 0 ? 1 : 0;
      const prediction = label === 1 ? 0.55 : 0.45;
      examples.push(createExample(`row-${index}`, label, prediction));
    }

    const assessment = assessCalibration(examples, {
      featureKeys: ["shotDistanceFeet", "shotEventType:goal"],
      splitCounts: { test: 0 },
      sliceCoverage: {
        reboundPositiveCount: 0,
        rushPositiveCount: 0,
      },
    });

    expect(assessment.requiresPostCalibration).toBe(true);
    expect(assessment.trustWarnings).toContain(
      "Label leakage remains present because the feature set still includes shotEventType:goal."
    );
    expect(assessment.trustWarnings).toContain(
      "No dedicated test split is available; calibration comparison is holdout cross-validation only."
    );
    expect(assessment.trustWarnings).toContain(
      "Positive rebound holdout coverage is absent, so rebound-slice calibration is not approval-grade."
    );
    expect(assessment.trustWarnings).toContain(
      "Positive rush holdout coverage is absent, so rush-slice calibration is not approval-grade."
    );
    expect(assessment.adoptabilityBlockingReasons).toContain(
      "No dedicated test split is available; calibration cannot be treated as adoptable."
    );
    expect(assessment.methods.find((method) => method.method === "platt")?.applicable).toBe(true);
    expect(assessment.methods.find((method) => method.method === "isotonic")?.applicable).toBe(true);
    expect(assessment.adoptableMethod).toBeNull();
  });

  it("allows adoptable calibration only when acceptance rules are satisfied", () => {
    const examples: CalibrationExample[] = [];
    for (let index = 0; index < 60; index += 1) {
      const label = index % 6 === 0 ? 1 : 0;
      const prediction = label === 1 ? 0.55 : 0.45;
      examples.push(createExample(`row-${index}`, label, prediction));
    }

    const assessment = assessCalibration(examples, {
      featureKeys: ["shotDistanceFeet"],
      splitCounts: { test: 5 },
      sliceCoverage: {
        reboundPositiveCount: 1,
        rushPositiveCount: 1,
      },
    });

    expect(assessment.holdoutPositiveCount).toBeGreaterThanOrEqual(10);
    expect(assessment.adoptabilityBlockingReasons).toEqual([]);
    expect(assessment.adoptableMethod).not.toBeNull();
  });

  it("falls back to raw calibration when a preferred fitted calibrator cannot be trained", () => {
    const calibrator = fitProbabilityCalibrator(
      [createExample("only-positive", 1, 0.8)],
      "platt"
    );

    expect(calibrator.method).toBe("raw");
    expect(calibrator.predict(1.4)).toBeLessThan(1);
    expect(calibrator.predict(-0.4)).toBeGreaterThan(0);
  });
});

describe("isotonic calibration ties (BA W1-1 A)", () => {
  // Ten predictions of 0.2 (seven misses, three goals) plus anchors around them.
  const tied = Array.from({ length: 10 }, (_, index) => ({ label: (index >= 7 ? 1 : 0) as 0 | 1, prediction: 0.2 }));
  const anchors: Array<{ label: 0 | 1; prediction: number }> = [
    { label: 0, prediction: 0.05 }, { label: 0, prediction: 0.06 },
    { label: 1, prediction: 0.6 }, { label: 1, prediction: 0.7 },
  ];
  const withRowIds = (order: "forward" | "reverse") => {
    const rows = [...tied, ...anchors];
    const ids = rows.map((_, index) => `row-${String(index).padStart(2, "0")}`);
    if (order === "reverse") ids.reverse();
    return rows.map((row, index) => createExample(ids[index]!, row.label, row.prediction));
  };

  it("pools equal inputs: the tied block predicts its pooled goal rate", () => {
    const calibrator = fitProbabilityCalibrator(withRowIds("forward"), "isotonic");
    expect(calibrator.method).toBe("isotonic");
    expect(calibrator.predict(0.2)).toBeCloseTo(0.3, 9);
  });

  it("does not depend on row-id order", () => {
    const forward = fitProbabilityCalibrator(withRowIds("forward"), "isotonic");
    const reverse = fitProbabilityCalibrator(withRowIds("reverse"), "isotonic");
    for (const prediction of [0.01, 0.05, 0.1, 0.2, 0.3, 0.6, 0.9]) {
      expect(reverse.predict(prediction)).toBeCloseTo(forward.predict(prediction), 12);
    }
  });
});
