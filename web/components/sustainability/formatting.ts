export type SustainabilityThresholds = {
  lower: number;
  upper: number;
};

export function formatSustainabilityScore(score: number | null | undefined) {
  return score == null || !Number.isFinite(score) ? "—" : score.toFixed(1);
}

function quantile(sorted: number[], fraction: number) {
  if (sorted.length === 0) return fraction * 100;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

export function buildSustainabilityThresholds(
  scores: number[]
): SustainabilityThresholds {
  const sorted = scores.filter(Number.isFinite).sort((a, b) => a - b);
  return {
    lower: quantile(sorted, 1 / 3),
    upper: quantile(sorted, 2 / 3)
  };
}

export function getSustainabilityTier(
  score: number,
  thresholds: SustainabilityThresholds
) {
  if (score >= thresholds.upper) return "durable" as const;
  if (score <= thresholds.lower) return "volatile" as const;
  return "balanced" as const;
}
