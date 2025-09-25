// Utility helpers for projection math primitives (decay weights, clipping, goalie multipliers).

export interface DecaySample {
  /** Stat observation value */
  value: number | null | undefined;
  /** Days between the observation date and the target projection date */
  daysAgo: number;
  /** Optional scalar multiplier applied in addition to the exponential decay weight */
  weight?: number;
}

export interface DecayBlendResult {
  mean: number | null;
  totalWeight: number;
  effectiveSampleSize: number;
  sampleCount: number;
}

/**
 * Exponential decay weighted blend of samples where weights are exp(-daysAgo / tauDays).
 * Returns the weighted mean along with weight bookkeeping for downstream shrinkage.
 */
export function decayBlend(
  samples: DecaySample[],
  tauDays: number
): DecayBlendResult {
  if (!Array.isArray(samples) || samples.length === 0) {
    return { mean: null, totalWeight: 0, effectiveSampleSize: 0, sampleCount: 0 };
  }
  const tau = tauDays > 0 ? tauDays : 1;
  let weightedSum = 0;
  let weightTotal = 0;
  let weightSquaredTotal = 0;
  let count = 0;

  for (const sample of samples) {
    if (sample?.value === null || sample?.value === undefined) continue;
    const delta = Number.isFinite(sample.daysAgo) ? Math.max(sample.daysAgo, 0) : 0;
    const baseWeight = Math.exp(-delta / tau);
    const weightMultiplier = sample.weight === undefined ? 1 : Math.max(sample.weight, 0);
    const weight = baseWeight * weightMultiplier;
    if (!Number.isFinite(weight) || weight <= 0) continue;

    weightedSum += sample.value * weight;
    weightTotal += weight;
    weightSquaredTotal += weight * weight;
    count += 1;
  }

  if (weightTotal <= 0) {
    return { mean: null, totalWeight: 0, effectiveSampleSize: 0, sampleCount: 0 };
  }

  const effectiveSampleSize =
    weightSquaredTotal > 0 ? (weightTotal * weightTotal) / weightSquaredTotal : count;

  return {
    mean: weightedSum / weightTotal,
    totalWeight: weightTotal,
    effectiveSampleSize,
    sampleCount: count,
  };
}

/** Clamp x to the [lo, hi] interval (order-agnostic, swallows NaN) */
export function clip(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return Number.isFinite(lo) ? lo : hi;
  if (!Number.isFinite(lo) && !Number.isFinite(hi)) return x;
  const lower = Math.min(lo, hi);
  const upper = Math.max(lo, hi);
  if (Number.isFinite(lower) && x < lower) return lower;
  if (Number.isFinite(upper) && x > upper) return upper;
  return x;
}

/**
 * Goalie finishing multiplier accounting for opposing save percentage vs league baseline.
 * Implements clip(1 - (sv_proj - league_sv)/0.070, 0.80, 1.20).
 */
export function goalieFinishMult(
  svProj: number | null | undefined,
  leagueSv: number | null | undefined
): number {
  if (!Number.isFinite(svProj) || !Number.isFinite(leagueSv)) {
    return 1;
  }
  const delta = (svProj as number) - (leagueSv as number);
  const raw = 1 - delta / 0.07;
  return clip(raw, 0.8, 1.2);
}
