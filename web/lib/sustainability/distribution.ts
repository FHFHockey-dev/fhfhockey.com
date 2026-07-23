export type SustainabilityDistributionSnapshot = {
  count: number;
  minimum: number;
  maximum: number;
  mean: number;
  stdev: number;
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
};

function round(value: number) {
  return Number(value.toFixed(4));
}

function percentile(sorted: number[], fraction: number) {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function buildSustainabilityDistributionSnapshot(
  scores: number[]
): SustainabilityDistributionSnapshot | null {
  const sorted = scores.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance =
    sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sorted.length;
  return {
    count: sorted.length,
    minimum: sorted[0],
    maximum: sorted.at(-1)!,
    mean: round(mean),
    stdev: round(Math.sqrt(variance)),
    percentiles: {
      p10: round(percentile(sorted, 0.1)),
      p25: round(percentile(sorted, 0.25)),
      p50: round(percentile(sorted, 0.5)),
      p75: round(percentile(sorted, 0.75)),
      p90: round(percentile(sorted, 0.9))
    }
  };
}
