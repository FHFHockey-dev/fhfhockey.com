// Utility helpers for projection math primitives (decay weights, count distributions, clipping, goalie multipliers).

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

export type CountDistributionSelection =
  | {
      model: "poisson";
      mean: number;
      fanoFactor: number | null;
      dispersionSize: null;
    }
  | {
      model: "negative-binomial";
      mean: number;
      fanoFactor: number;
      dispersionSize: number;
    };

export const DEFAULT_OVERDISPERSION_FANO_THRESHOLD = 1.25;

/**
 * Exponential decay weighted blend of samples where weights are exp(-daysAgo / tauDays).
 * Returns the weighted mean along with weight bookkeeping for downstream shrinkage.
 */
export function decayBlend(
  samples: DecaySample[],
  tauDays: number,
): DecayBlendResult {
  if (!Array.isArray(samples) || samples.length === 0) {
    return {
      mean: null,
      totalWeight: 0,
      effectiveSampleSize: 0,
      sampleCount: 0,
    };
  }
  const tau = tauDays > 0 ? tauDays : 1;
  let weightedSum = 0;
  let weightTotal = 0;
  let weightSquaredTotal = 0;
  let count = 0;

  for (const sample of samples) {
    if (
      sample?.value === null ||
      sample?.value === undefined ||
      !Number.isFinite(sample.value)
    ) {
      continue;
    }
    const delta = Number.isFinite(sample.daysAgo)
      ? Math.max(sample.daysAgo, 0)
      : 0;
    const baseWeight = Math.exp(-delta / tau);
    const weightMultiplier =
      sample.weight === undefined ? 1 : Math.max(sample.weight, 0);
    const weight = baseWeight * weightMultiplier;
    if (!Number.isFinite(weight) || weight <= 0) continue;

    weightedSum += sample.value * weight;
    weightTotal += weight;
    weightSquaredTotal += weight * weight;
    count += 1;
  }

  if (weightTotal <= 0) {
    return {
      mean: null,
      totalWeight: 0,
      effectiveSampleSize: 0,
      sampleCount: 0,
    };
  }

  const effectiveSampleSize =
    weightSquaredTotal > 0
      ? (weightTotal * weightTotal) / weightSquaredTotal
      : count;

  return {
    mean: weightedSum / weightTotal,
    totalWeight: weightTotal,
    effectiveSampleSize,
    sampleCount: count,
  };
}

/**
 * Exponentially weighted population standard deviation.
 * Uses the same decay and optional sample multipliers as decayBlend.
 */
export function ewsd(samples: DecaySample[], tauDays: number): number | null {
  const blend = decayBlend(samples, tauDays);
  if (blend.mean === null || blend.totalWeight <= 0) return null;

  const tau = tauDays > 0 ? tauDays : 1;
  let weightedSquaredDeviation = 0;

  for (const sample of samples) {
    if (
      sample?.value === null ||
      sample?.value === undefined ||
      !Number.isFinite(sample.value)
    ) {
      continue;
    }
    const delta = Number.isFinite(sample.daysAgo)
      ? Math.max(sample.daysAgo, 0)
      : 0;
    const baseWeight = Math.exp(-delta / tau);
    const weightMultiplier =
      sample.weight === undefined ? 1 : Math.max(sample.weight, 0);
    const weight = baseWeight * weightMultiplier;
    if (!Number.isFinite(weight) || weight <= 0) continue;

    weightedSquaredDeviation += weight * (sample.value - blend.mean) ** 2;
  }

  return Math.sqrt(Math.max(weightedSquaredDeviation / blend.totalWeight, 0));
}

/**
 * Ordinary least-squares slope over observation order.
 * Missing/non-finite observations are skipped without collapsing their indexes.
 */
export function slope(values: Array<number | null | undefined>): number | null {
  const points = values
    .map((value, index) => ({ index, value }))
    .filter(
      (point): point is { index: number; value: number } =>
        typeof point.value === "number" && Number.isFinite(point.value),
    );
  if (points.length < 2) return null;

  const meanIndex =
    points.reduce((sum, point) => sum + point.index, 0) / points.length;
  const meanValue =
    points.reduce((sum, point) => sum + point.value, 0) / points.length;
  let covariance = 0;
  let indexVariance = 0;

  for (const point of points) {
    const centeredIndex = point.index - meanIndex;
    covariance += centeredIndex * (point.value - meanValue);
    indexVariance += centeredIndex * centeredIndex;
  }

  return indexVariance > 0 ? covariance / indexVariance : null;
}

/**
 * Shrink a recent estimate toward a career/archetype prior.
 * Implements (nEff / (nEff + k)) * recent + (k / (nEff + k)) * prior.
 */
export function shrinkage(
  recent: number | null | undefined,
  prior: number | null | undefined,
  effectiveSampleSize: number,
  priorStrength: number,
): number | null {
  const hasRecent = typeof recent === "number" && Number.isFinite(recent);
  const hasPrior = typeof prior === "number" && Number.isFinite(prior);
  if (!hasRecent) return hasPrior ? (prior as number) : null;
  if (!hasPrior) return recent as number;

  const nEff = Number.isFinite(effectiveSampleSize)
    ? Math.max(effectiveSampleSize, 0)
    : 0;
  const k = Number.isFinite(priorStrength) ? Math.max(priorStrength, 0) : 0;
  const denominator = nEff + k;
  if (denominator <= 0) return recent as number;

  return (
    (nEff / denominator) * (recent as number) +
    (k / denominator) * (prior as number)
  );
}

/**
 * Convert a non-negative per-60 rate and relevant minutes into a Poisson mean.
 * The optional combined context multiplier must already be owned by the caller's
 * versioned projection contract.
 */
export function poissonMeanFromRate(
  ratePer60: number,
  toiMinutes: number,
  contextMultiplier = 1,
): number | null {
  if (
    !Number.isFinite(ratePer60) ||
    ratePer60 < 0 ||
    !Number.isFinite(toiMinutes) ||
    toiMinutes < 0 ||
    !Number.isFinite(contextMultiplier) ||
    contextMultiplier < 0
  ) {
    return null;
  }

  return (ratePer60 / 60) * toiMinutes * contextMultiplier;
}

/**
 * Select a count distribution only when recent sample evidence proves
 * overdispersion. Missing or unusable dispersion evidence stays Poisson.
 *
 * Negative-binomial size uses r = sampleMean² / (sampleVariance - sampleMean).
 */
export function selectCountDistribution(
  projectedMean: number,
  recentSampleMean: number | null | undefined,
  recentSampleVariance: number | null | undefined,
  fanoThreshold = DEFAULT_OVERDISPERSION_FANO_THRESHOLD,
): CountDistributionSelection | null {
  if (!Number.isFinite(projectedMean) || projectedMean < 0) return null;

  const hasSampleEvidence =
    typeof recentSampleMean === "number" &&
    Number.isFinite(recentSampleMean) &&
    recentSampleMean > 0 &&
    typeof recentSampleVariance === "number" &&
    Number.isFinite(recentSampleVariance) &&
    recentSampleVariance >= 0;
  if (!hasSampleEvidence) {
    return {
      model: "poisson",
      mean: projectedMean,
      fanoFactor: null,
      dispersionSize: null,
    };
  }

  const threshold =
    Number.isFinite(fanoThreshold) && fanoThreshold > 1
      ? fanoThreshold
      : DEFAULT_OVERDISPERSION_FANO_THRESHOLD;
  const sampleMean = recentSampleMean as number;
  const sampleVariance = recentSampleVariance as number;
  const fanoFactor = sampleVariance / sampleMean;
  const dispersionSize =
    sampleVariance > sampleMean
      ? (sampleMean * sampleMean) / (sampleVariance - sampleMean)
      : null;

  if (
    fanoFactor <= threshold ||
    dispersionSize === null ||
    !Number.isFinite(dispersionSize) ||
    dispersionSize <= 0
  ) {
    return {
      model: "poisson",
      mean: projectedMean,
      fanoFactor,
      dispersionSize: null,
    };
  }

  return {
    model: "negative-binomial",
    mean: projectedMean,
    fanoFactor,
    dispersionSize,
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
  leagueSv: number | null | undefined,
): number {
  if (!Number.isFinite(svProj) || !Number.isFinite(leagueSv)) {
    return 1;
  }
  const delta = (svProj as number) - (leagueSv as number);
  const raw = 1 - delta / 0.07;
  return clip(raw, 0.8, 1.2);
}
