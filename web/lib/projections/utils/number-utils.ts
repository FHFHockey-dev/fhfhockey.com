export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function safeNumber(
  n: number | null | undefined,
  fallback: number
): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export function finiteOrNull(
  n: number | null | undefined
): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function computeShotsFromRate(
  toiSeconds: number,
  sogPer60: number
): number {
  const toiMinutes = toiSeconds / 60;
  return (sogPer60 / 60) * toiMinutes;
}

export function computeRate(
  numerator: number,
  denom: number,
  fallback: number
): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denom) || denom <= 0) {
    return fallback;
  }
  return numerator / denom;
}

export function blendOnlineRate(opts: {
  recentNumerator: number;
  recentDenom: number;
  baseNumerator: number;
  baseDenom: number;
  fallback: number;
  priorStrength: number;
  minRate: number;
  maxRate: number;
}): number {
  const baseRate = computeRate(
    opts.baseNumerator + opts.fallback * opts.priorStrength,
    opts.baseDenom + opts.priorStrength,
    opts.fallback
  );
  const recentRate = computeRate(opts.recentNumerator, opts.recentDenom, baseRate);
  const weight = clamp(
    opts.recentDenom / (opts.recentDenom + opts.priorStrength),
    0,
    1
  );
  const blended = baseRate + weight * (recentRate - baseRate);
  return clamp(blended, opts.minRate, opts.maxRate);
}

export function safeStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((acc, n) => acc + n, 0) / values.length;
  const variance =
    values.reduce((acc, n) => acc + (n - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
