import { findForbiddenBaselineFeatureKeys } from "./baselineDataset";

/**
 * xG approval gate (owner decision 88, W3-1 D6/C2).
 *
 * A model is approval-grade only when the exact artifact that would be
 * served, with its calibration applied, is evaluated on a separate, untouched,
 * chronologically later test split and
 * - the holdout is large enough: the relative standard error of the observed
 *   goal rate, sqrt((1 - p) / (n p)), is at most 5% (a minimum, computed from
 *   the actual holdout, never a fixed goal count);
 * - it beats the base-rate benchmark on proper scores (log loss and Brier
 *   against the constant prediction at the holdout's own rate, the best
 *   possible constant, so it also beats any training-rate constant);
 * - it passes calibration checks (calibration-in-the-large and Spiegelhalter
 *   z within the stated limit; reliability bins are reported) and the same
 *   calibration-in-the-large check in every relevant subgroup cell with
 *   enough evidence (Bonferroni-adjusted);
 * - it shows no outcome leakage: no forbidden post-event feature and no
 *   feature that looks forward in the sequence (`isFlurryShot`);
 * - any required calibration was fitted on the validation split only and
 *   applied in the artifact.
 * With insufficient evidence it stays unapproved. Only an eligibility record
 * written by this gate version counts as approval
 * (`isAffirmativelyApprovedXgEligibility`).
 */
export const XG_APPROVAL_GATE_VERSION = "xg_approval_gate_v2_decision88";

/** Decision 88 minimum: relative SE of the holdout goal rate. */
export const XG_APPROVAL_MAX_RELATIVE_STANDARD_ERROR = 0.05;
/** Validation choice: two-sided 5% level for each calibration z test. */
export const XG_APPROVAL_CALIBRATION_Z_LIMIT = 1.959964;
/** Validation choice: a subgroup cell is judged only when its own relative SE is at most 20%. */
export const XG_APPROVAL_SUBGROUP_MAX_RELATIVE_STANDARD_ERROR = 0.2;
/** Features that use information from after the shot within its sequence. */
export const XG_FORWARD_LOOKING_FEATURE_KEYS: readonly string[] = ["isFlurryShot"];

export type XgApprovalScore = {
  label: 0 | 1;
  /** Served probability: raw model output with the artifact's calibration applied. */
  probability: number;
  /** Subgroup values, e.g. { strengthState: "5v5", rebound: "yes" }. */
  subgroups?: Record<string, string | null>;
};

type DateRange = { startDate: string | null; endDate: string | null };

export type XgApprovalGateInput = {
  /** Every scored example of the untouched test split, scored as served. */
  testScores: XgApprovalScore[];
  splitDateRanges: Record<"train" | "validation" | "test", DateRange> | null | undefined;
  /** Calibration as stored in the artifact. */
  calibration:
    | { applied: boolean; fitSplit: string; method?: string | null }
    | null
    | undefined;
  calibrationRequired: boolean;
  /** Raw selected inputs and encoded feature keys of the artifact. */
  featureKeys: string[];
  featureCoverageBlockingReasons?: string[];
  relevantSubgroups?: string[];
};

export type XgReliabilityBin = {
  count: number;
  goals: number;
  meanPrediction: number;
  observedRate: number;
};

export type XgSubgroupCalibration = {
  subgroup: string;
  value: string;
  count: number;
  goals: number;
  relativeStandardError: number | null;
  calibrationInTheLargeZ: number | null;
  judged: boolean;
  passed: boolean | null;
};

export type XgApprovalChecks = {
  holdoutPresent: boolean;
  chronologicalUntouchedTest: boolean;
  sufficientEvidence: boolean;
  beatsBaseRateLogLoss: boolean;
  beatsBaseRateBrier: boolean;
  calibrationInTheLarge: boolean;
  spiegelhalter: boolean;
  subgroupCalibration: boolean;
  noOutcomeLeakage: boolean;
  calibrationAppliedFromValidation: boolean;
  featureCoverage: boolean;
};

export type XgApprovalEvidence = {
  testExampleCount: number;
  testGoalCount: number;
  goalRate: number | null;
  relativeStandardError: number | null;
  maxRelativeStandardError: number;
  logLoss: number | null;
  baseRateLogLoss: number | null;
  brierScore: number | null;
  baseRateBrierScore: number | null;
  calibrationInTheLargeZ: number | null;
  spiegelhalterZ: number | null;
  zLimit: number;
  reliabilityBins: XgReliabilityBin[];
  subgroups: XgSubgroupCalibration[];
  forbiddenFeatures: string[];
  checks: XgApprovalChecks;
};

export type XgApprovalEligibility = {
  gateVersion: typeof XG_APPROVAL_GATE_VERSION;
  isEligible: boolean;
  blockingReasons: string[];
  evidence: XgApprovalEvidence;
};

const EPSILON = 1e-15;

function clip(probability: number): number {
  return Math.min(1 - EPSILON, Math.max(EPSILON, probability));
}

function relativeStandardError(count: number, goals: number): number | null {
  if (count <= 0 || goals <= 0 || goals >= count) return null;
  const rate = goals / count;
  return Math.sqrt((1 - rate) / (count * rate));
}

/** (observed goals - expected goals) / sqrt(sum p(1-p)). */
function calibrationInTheLargeZ(scores: XgApprovalScore[]): number | null {
  let observed = 0;
  let expected = 0;
  let variance = 0;
  for (const score of scores) {
    const probability = clip(score.probability);
    observed += score.label;
    expected += probability;
    variance += probability * (1 - probability);
  }
  return variance > 0 ? (observed - expected) / Math.sqrt(variance) : null;
}

/** Spiegelhalter (1986) z statistic for calibration of probability forecasts. */
function spiegelhalterZ(scores: XgApprovalScore[]): number | null {
  let numerator = 0;
  let variance = 0;
  for (const score of scores) {
    const probability = clip(score.probability);
    numerator += (score.label - probability) * (1 - 2 * probability);
    variance += (1 - 2 * probability) ** 2 * probability * (1 - probability);
  }
  return variance > 0 ? numerator / Math.sqrt(variance) : null;
}

function reliabilityBins(scores: XgApprovalScore[], binCount = 10): XgReliabilityBin[] {
  // Equal-count bins over predictions; ties are kept together by sorting on
  // probability then label so the bins do not depend on input order.
  const sorted = [...scores].sort((left, right) =>
    left.probability !== right.probability
      ? left.probability - right.probability
      : left.label - right.label
  );
  const bins: XgReliabilityBin[] = [];
  for (let bin = 0; bin < binCount; bin += 1) {
    const slice = sorted.slice(
      Math.floor((bin * sorted.length) / binCount),
      Math.floor(((bin + 1) * sorted.length) / binCount)
    );
    if (!slice.length) continue;
    const goals = slice.reduce((sum, score) => sum + score.label, 0);
    bins.push({
      count: slice.length,
      goals,
      meanPrediction: slice.reduce((sum, score) => sum + score.probability, 0) / slice.length,
      observedRate: goals / slice.length,
    });
  }
  return bins;
}

function isoDateAfter(later: string | null | undefined, earlier: string | null | undefined): boolean {
  if (!later || !earlier) return false;
  return later.slice(0, 10) > earlier.slice(0, 10);
}

export function evaluateXgApprovalGate(input: XgApprovalGateInput): XgApprovalEligibility {
  const blockingReasons: string[] = [];
  const scores = input.testScores.filter(
    (score) => (score.label === 0 || score.label === 1) && Number.isFinite(score.probability)
  );
  const count = scores.length;
  const goals = scores.reduce((sum, score) => sum + score.label, 0);
  const goalRate = count > 0 ? goals / count : null;
  const relSe = relativeStandardError(count, goals);

  const holdoutPresent = count > 0 && count === input.testScores.length;
  if (count === 0) blockingReasons.push("The untouched test split has no scored examples.");
  if (count !== input.testScores.length) {
    blockingReasons.push(
      `${input.testScores.length - count} test examples have no valid label or served probability.`
    );
  }

  const ranges = input.splitDateRanges;
  const chronologicalUntouchedTest =
    !!ranges &&
    isoDateAfter(ranges.test?.startDate, ranges.validation?.endDate) &&
    isoDateAfter(ranges.test?.startDate, ranges.train?.endDate);
  if (!chronologicalUntouchedTest) {
    blockingReasons.push(
      "The test split is not proven to start after the train and validation splits end; approval needs an untouched chronological holdout."
    );
  }

  const sufficientEvidence = relSe != null && relSe <= XG_APPROVAL_MAX_RELATIVE_STANDARD_ERROR;
  if (!sufficientEvidence) {
    blockingReasons.push(
      relSe == null
        ? "The test split has no goals or no non-goals; its goal-rate standard error is undefined."
        : `The test goal rate's relative standard error is ${relSe.toFixed(4)} (${goals} goals in ${count} shots); decision 88 requires at most ${XG_APPROVAL_MAX_RELATIVE_STANDARD_ERROR}.`
    );
  }

  let logLoss: number | null = null;
  let brierScore: number | null = null;
  let baseRateLogLoss: number | null = null;
  let baseRateBrierScore: number | null = null;
  if (count > 0 && goalRate != null) {
    logLoss = -scores.reduce((sum, score) => {
      const probability = clip(score.probability);
      return sum + (score.label === 1 ? Math.log(probability) : Math.log(1 - probability));
    }, 0) / count;
    brierScore = scores.reduce((sum, score) => sum + (score.probability - score.label) ** 2, 0) / count;
    const base = clip(goalRate);
    baseRateLogLoss = -(goalRate * Math.log(base) + (1 - goalRate) * Math.log(1 - base));
    baseRateBrierScore = goalRate * (1 - goalRate);
  }
  const beatsBaseRateLogLoss = logLoss != null && baseRateLogLoss != null && logLoss < baseRateLogLoss;
  const beatsBaseRateBrier = brierScore != null && baseRateBrierScore != null && brierScore < baseRateBrierScore;
  if (!beatsBaseRateLogLoss) {
    blockingReasons.push(
      `Test log loss ${logLoss?.toFixed(6) ?? "n/a"} does not beat the base-rate benchmark ${baseRateLogLoss?.toFixed(6) ?? "n/a"}.`
    );
  }
  if (!beatsBaseRateBrier) {
    blockingReasons.push(
      `Test Brier score ${brierScore?.toFixed(6) ?? "n/a"} does not beat the base-rate benchmark ${baseRateBrierScore?.toFixed(6) ?? "n/a"}.`
    );
  }

  const zLarge = calibrationInTheLargeZ(scores);
  const zSpiegelhalter = spiegelhalterZ(scores);
  const calibrationInTheLarge = zLarge != null && Math.abs(zLarge) <= XG_APPROVAL_CALIBRATION_Z_LIMIT;
  const spiegelhalter = zSpiegelhalter != null && Math.abs(zSpiegelhalter) <= XG_APPROVAL_CALIBRATION_Z_LIMIT;
  if (!calibrationInTheLarge) {
    blockingReasons.push(
      `Calibration-in-the-large z is ${zLarge?.toFixed(3) ?? "n/a"}; the limit is ±${XG_APPROVAL_CALIBRATION_Z_LIMIT}.`
    );
  }
  if (!spiegelhalter) {
    blockingReasons.push(
      `Spiegelhalter calibration z is ${zSpiegelhalter?.toFixed(3) ?? "n/a"}; the limit is ±${XG_APPROVAL_CALIBRATION_Z_LIMIT}.`
    );
  }

  const subgroups: XgSubgroupCalibration[] = [];
  for (const subgroup of input.relevantSubgroups ?? []) {
    const byValue = new Map<string, XgApprovalScore[]>();
    for (const score of scores) {
      const value = score.subgroups?.[subgroup];
      if (value == null) continue;
      const cell = byValue.get(value);
      if (cell) cell.push(score);
      else byValue.set(value, [score]);
    }
    for (const [value, cell] of [...byValue.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const cellGoals = cell.reduce((sum, score) => sum + score.label, 0);
      const cellRelSe = relativeStandardError(cell.length, cellGoals);
      subgroups.push({
        subgroup,
        value,
        count: cell.length,
        goals: cellGoals,
        relativeStandardError: cellRelSe,
        calibrationInTheLargeZ: calibrationInTheLargeZ(cell),
        judged: cellRelSe != null && cellRelSe <= XG_APPROVAL_SUBGROUP_MAX_RELATIVE_STANDARD_ERROR,
        passed: null,
      });
    }
  }
  const judged = subgroups.filter((cell) => cell.judged);
  const subgroupZLimit = judged.length > 0 ? bonferroniZ(judged.length) : XG_APPROVAL_CALIBRATION_Z_LIMIT;
  for (const cell of judged) {
    cell.passed = cell.calibrationInTheLargeZ != null && Math.abs(cell.calibrationInTheLargeZ) <= subgroupZLimit;
    if (!cell.passed) {
      blockingReasons.push(
        `Subgroup ${cell.subgroup}=${cell.value} is miscalibrated (z ${cell.calibrationInTheLargeZ?.toFixed(3) ?? "n/a"}, limit ±${subgroupZLimit.toFixed(3)} over ${judged.length} cells).`
      );
    }
  }
  const subgroupCalibration = judged.every((cell) => cell.passed === true);

  const forbiddenFeatures = Array.from(
    new Set([
      ...findForbiddenBaselineFeatureKeys(input.featureKeys),
      ...input.featureKeys.filter((key) =>
        XG_FORWARD_LOOKING_FEATURE_KEYS.some((forward) => key === forward || key.startsWith(`${forward}:`))
      ),
    ])
  ).sort();
  const noOutcomeLeakage = forbiddenFeatures.length === 0;
  if (!noOutcomeLeakage) {
    blockingReasons.push(
      `The artifact uses features that are not backward-only or are post-event: ${forbiddenFeatures.join(", ")}.`
    );
  }

  const calibration = input.calibration ?? null;
  const calibrationAppliedFromValidation = input.calibrationRequired
    ? calibration?.applied === true && calibration.fitSplit === "validation"
    : calibration == null || calibration.applied !== true || calibration.fitSplit === "validation";
  if (!calibrationAppliedFromValidation) {
    blockingReasons.push(
      input.calibrationRequired
        ? "Post-calibration is required but the artifact does not carry a calibration fitted on the validation split and applied."
        : "An applied calibration was not fitted on the validation split."
    );
  }

  const coverageReasons = input.featureCoverageBlockingReasons ?? [];
  for (const reason of coverageReasons) if (!blockingReasons.includes(reason)) blockingReasons.push(reason);
  const featureCoverage = coverageReasons.length === 0;

  const checks: XgApprovalChecks = {
    holdoutPresent,
    chronologicalUntouchedTest,
    sufficientEvidence,
    beatsBaseRateLogLoss,
    beatsBaseRateBrier,
    calibrationInTheLarge,
    spiegelhalter,
    subgroupCalibration,
    noOutcomeLeakage,
    calibrationAppliedFromValidation,
    featureCoverage,
  };
  const isEligible = Object.values(checks).every(Boolean) && blockingReasons.length === 0;

  return {
    gateVersion: XG_APPROVAL_GATE_VERSION,
    isEligible,
    blockingReasons,
    evidence: {
      testExampleCount: count,
      testGoalCount: goals,
      goalRate,
      relativeStandardError: relSe,
      maxRelativeStandardError: XG_APPROVAL_MAX_RELATIVE_STANDARD_ERROR,
      logLoss,
      baseRateLogLoss,
      brierScore,
      baseRateBrierScore,
      calibrationInTheLargeZ: zLarge,
      spiegelhalterZ: zSpiegelhalter,
      zLimit: XG_APPROVAL_CALIBRATION_Z_LIMIT,
      reliabilityBins: reliabilityBins(scores),
      subgroups,
      forbiddenFeatures,
      checks,
    },
  };
}

/** Two-sided z critical value at family-wise 5% over `cells` tests (Bonferroni). */
function bonferroniZ(cells: number): number {
  return inverseStandardNormal(1 - 0.05 / (2 * cells));
}

/** Acklam's rational approximation of the standard normal quantile. */
function inverseStandardNormal(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

/**
 * Affirmative eligibility: only a record written by this gate version, with
 * isEligible true, no blocking reasons, real test evidence and every check
 * passed. `{ isEligible: false, blockingReasons: [] }`, an older schema, or a
 * missing record is not approval.
 */
export function isAffirmativelyApprovedXgEligibility(eligibility: unknown): boolean {
  if (!eligibility || typeof eligibility !== "object") return false;
  const record = eligibility as Partial<XgApprovalEligibility>;
  if (record.gateVersion !== XG_APPROVAL_GATE_VERSION) return false;
  if (record.isEligible !== true) return false;
  if (!Array.isArray(record.blockingReasons) || record.blockingReasons.length !== 0) return false;
  const evidence = record.evidence;
  if (!evidence || typeof evidence !== "object") return false;
  if (!(typeof evidence.testExampleCount === "number" && evidence.testExampleCount > 0)) return false;
  if (!(typeof evidence.relativeStandardError === "number" &&
    evidence.relativeStandardError <= XG_APPROVAL_MAX_RELATIVE_STANDARD_ERROR)) return false;
  const checks = evidence.checks as Record<string, unknown> | undefined;
  if (!checks || typeof checks !== "object") return false;
  const required: Array<keyof XgApprovalChecks> = [
    "holdoutPresent", "chronologicalUntouchedTest", "sufficientEvidence", "beatsBaseRateLogLoss",
    "beatsBaseRateBrier", "calibrationInTheLarge", "spiegelhalter", "subgroupCalibration",
    "noOutcomeLeakage", "calibrationAppliedFromValidation", "featureCoverage",
  ];
  return required.every((key) => checks[key] === true);
}
