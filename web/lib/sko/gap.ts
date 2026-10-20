export type RateBasis =
  | "per_scheduled_team_game"
  | "per_appearance"
  | "per_60"
  | "per_100_on_net_shots";

type MeasuredNumber = number | null | undefined;

export type ComparableRate = {
  value: MeasuredNumber;
  basis: RateBasis;
};

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
}

function validateOptional(value: MeasuredNumber, name: string): void {
  if (value != null) requireFinite(value, name);
}

/** Inputs must also describe the same target, horizon and strength state. */
export function sustainabilityGap({
  expected,
  recent,
  basis,
  lowerIsBetter = false
}: {
  expected: ComparableRate;
  recent: ComparableRate;
  basis: RateBasis;
  lowerIsBetter?: boolean;
}): { gap: number | null; orientedGap: number | null; basis: RateBasis } {
  if (expected.basis !== basis || recent.basis !== basis) {
    throw new Error("Expected and recent rates must use the requested basis");
  }
  validateOptional(expected.value, "expected");
  validateOptional(recent.value, "recent");
  if (expected.value == null || recent.value == null) {
    return { gap: null, orientedGap: null, basis };
  }
  const gap = expected.value - recent.value;
  requireFinite(gap, "gap");
  return { gap, orientedGap: lowerIsBetter && gap !== 0 ? -gap : gap, basis };
}

/** Display normalization only; scale is fixed per target, horizon and basis. */
export function displayScore(orientedGap: number, scale: number): number {
  requireFinite(orientedGap, "orientedGap");
  requireFinite(scale, "scale");
  if (scale <= 0) throw new Error("scale must be positive");
  return 100 * Math.tanh(orientedGap / scale);
}

/** Divide summed counts/exposure, never average individual ratios. */
export function rateFromTotals(
  numerator: MeasuredNumber,
  denominator: MeasuredNumber
): number | null {
  validateOptional(numerator, "numerator");
  validateOptional(denominator, "denominator");
  if (denominator != null && denominator < 0) {
    throw new Error("denominator must be nonnegative");
  }
  if (numerator == null || denominator == null || denominator === 0) return null;
  const rate = numerator / denominator;
  requireFinite(rate, "rate");
  return rate;
}

/** Additional saves per 100 on-net shots; expectedSaveProb is a 0..1 fraction. */
export function vuduSaveGap({
  expectedSaveProb,
  recentSaves,
  recentShotsOnNet
}: {
  expectedSaveProb: MeasuredNumber;
  recentSaves: MeasuredNumber;
  recentShotsOnNet: MeasuredNumber;
}): number | null {
  validateOptional(expectedSaveProb, "expectedSaveProb");
  validateOptional(recentSaves, "recentSaves");
  validateOptional(recentShotsOnNet, "recentShotsOnNet");
  if (expectedSaveProb != null && (expectedSaveProb < 0 || expectedSaveProb > 1)) {
    throw new Error("expectedSaveProb must be between 0 and 1");
  }
  if (recentSaves != null && recentSaves < 0) {
    throw new Error("recentSaves must be nonnegative");
  }
  if (recentShotsOnNet === 0) return null;
  if (recentSaves != null && recentShotsOnNet != null && recentSaves > recentShotsOnNet) {
    throw new Error("recentSaves cannot exceed recentShotsOnNet");
  }
  const recentRate = rateFromTotals(recentSaves, recentShotsOnNet);
  if (expectedSaveProb == null || recentRate == null) return null;
  return 100 * (expectedSaveProb - recentRate);
}

/** Inclusive threshold in native oriented-gap units; zero never implies a watch. */
export function watchLabel(
  orientedGap: MeasuredNumber,
  threshold: number
): "Rebound watch" | "Cooling watch" | null {
  requireFinite(threshold, "threshold");
  if (threshold < 0) throw new Error("threshold must be nonnegative");
  validateOptional(orientedGap, "orientedGap");
  if (orientedGap == null || orientedGap === 0) return null;
  if (orientedGap >= threshold) return "Rebound watch";
  if (orientedGap <= -threshold) return "Cooling watch";
  return null;
}
