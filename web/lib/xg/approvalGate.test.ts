import { describe, expect, it } from "vitest";

import {
  evaluateXgApprovalGate,
  isAffirmativelyApprovedXgEligibility,
  type XgApprovalGateInput,
  type XgApprovalScore,
} from "./approvalGate";

/** Deterministic PRNG (mulberry32) so the simulated holdouts are frozen. */
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shots whose labels are drawn from their own probabilities: calibrated by construction of the data, not of the gate. */
function calibratedHoldout(count: number, seed = 7): XgApprovalScore[] {
  const random = prng(seed);
  return Array.from({ length: count }, (_, index) => {
    const probability = 0.01 + 0.25 * random() ** 2.5;
    return {
      probability,
      label: random() < probability ? 1 : 0,
      subgroups: { strengthState: index % 5 === 0 ? "PP" : "EV" },
    };
  });
}

const goodRanges = {
  train: { startDate: "2025-10-07", endDate: "2026-01-31" },
  validation: { startDate: "2026-02-01", endDate: "2026-03-15" },
  test: { startDate: "2026-03-16", endDate: "2026-05-20" },
};

function input(overrides: Partial<XgApprovalGateInput> = {}): XgApprovalGateInput {
  return {
    testScores: calibratedHoldout(20000),
    splitDateRanges: goodRanges,
    calibration: { applied: true, fitSplit: "validation", method: "isotonic" },
    calibrationRequired: true,
    featureKeys: ["shotDistanceFeet", "shotAngleDegrees", "shotType:wrist", "isReboundShot"],
    relevantSubgroups: ["strengthState"],
    ...overrides,
  };
}

describe("xG approval gate (decision 88)", () => {
  it("approves a calibrated, discriminating served artifact on a large untouched chronological holdout", () => {
    const result = evaluateXgApprovalGate(input());
    expect(result.blockingReasons).toEqual([]);
    expect(result.isEligible).toBe(true);
    expect(result.evidence.relativeStandardError).toBeLessThanOrEqual(0.05);
    expect(isAffirmativelyApprovedXgEligibility(result)).toBe(true);
  });

  it("rejects Astra's C2 fixture: constant 0.5 on 140 test rows with 10 goals", () => {
    const testScores = Array.from({ length: 140 }, (_, index) => ({
      probability: 0.5,
      label: (index < 10 ? 1 : 0) as 0 | 1,
    }));
    const result = evaluateXgApprovalGate(input({ testScores, relevantSubgroups: [] }));
    expect(result.isEligible).toBe(false);
    expect(result.evidence.checks).toMatchObject({
      sufficientEvidence: false,
      beatsBaseRateLogLoss: false,
      beatsBaseRateBrier: false,
      calibrationInTheLarge: false,
    });
    // Brier 0.25 against the base rate's 10/140 x 130/140 = 0.0663.
    expect(result.evidence.brierScore).toBeCloseTo(0.25, 12);
    expect(result.evidence.baseRateBrierScore).toBeCloseTo((10 / 140) * (130 / 140), 12);
    expect(isAffirmativelyApprovedXgEligibility(result)).toBe(false);
  });

  it("keeps a calibrated model unapproved when the holdout is too small for a 5% relative SE", () => {
    const result = evaluateXgApprovalGate(input({ testScores: calibratedHoldout(2000) }));
    expect(result.evidence.checks.sufficientEvidence).toBe(false);
    expect(result.isEligible).toBe(false);
  });

  it("rejects systematically overconfident probabilities", () => {
    const testScores = calibratedHoldout(20000).map((score) => ({
      ...score,
      probability: Math.min(0.99, score.probability * 1.3),
    }));
    const result = evaluateXgApprovalGate(input({ testScores }));
    expect(result.evidence.checks.calibrationInTheLarge).toBe(false);
    expect(result.isEligible).toBe(false);
  });

  it("rejects a subgroup that is miscalibrated while the overall rate is right", () => {
    // Move probability mass from PP to EV shots so the totals still match.
    const testScores = calibratedHoldout(40000, 11).map((score) => ({
      ...score,
      probability: score.subgroups?.strengthState === "PP" ? score.probability * 0.6 : score.probability * 1.1,
    }));
    const result = evaluateXgApprovalGate(input({ testScores }));
    expect(result.evidence.checks.subgroupCalibration).toBe(false);
    expect(result.isEligible).toBe(false);
  });

  it("rejects forward-looking and post-event features", () => {
    for (const featureKeys of [["shotDistanceFeet", "isFlurryShot"], ["missReasonBucket:wide"]]) {
      const result = evaluateXgApprovalGate(input({ featureKeys }));
      expect(result.evidence.checks.noOutcomeLeakage).toBe(false);
      expect(result.isEligible).toBe(false);
    }
  });

  it("rejects a test split that overlaps validation or has unknown dates", () => {
    for (const splitDateRanges of [
      { ...goodRanges, test: { startDate: "2026-03-01", endDate: "2026-05-20" } },
      { ...goodRanges, test: { startDate: null, endDate: null } },
      null,
    ]) {
      expect(evaluateXgApprovalGate(input({ splitDateRanges })).evidence.checks.chronologicalUntouchedTest).toBe(false);
    }
  });

  it("requires a required calibration to be applied and fitted on validation, never test", () => {
    for (const calibration of [
      { applied: false, fitSplit: "validation" },
      { applied: true, fitSplit: "test" },
      null,
    ]) {
      const result = evaluateXgApprovalGate(input({ calibration }));
      expect(result.evidence.checks.calibrationAppliedFromValidation).toBe(false);
    }
  });
});

describe("isAffirmativelyApprovedXgEligibility", () => {
  it("does not treat a blank or old-schema record as approval", () => {
    expect(isAffirmativelyApprovedXgEligibility({ isEligible: false, blockingReasons: [] })).toBe(false);
    expect(isAffirmativelyApprovedXgEligibility({ isEligible: true, blockingReasons: [] })).toBe(false);
    expect(isAffirmativelyApprovedXgEligibility(undefined)).toBe(false);
    const approved = evaluateXgApprovalGate(input());
    expect(
      isAffirmativelyApprovedXgEligibility({ ...approved, evidence: { ...approved.evidence, testExampleCount: undefined } })
    ).toBe(false);
  });
});
