export type NumericSettings = Record<string, number>;

/** Applies valuation-only Draft Pro boosts without mutating league scoring. */
export function applyCategoryBoosts(
  scoring: NumericSettings,
  boosts: NumericSettings = {},
): NumericSettings {
  return Object.fromEntries(
    Object.entries(scoring).map(([key, value]) => {
      const boost = Number(boosts[key]);
      const normalizedBoost = Number.isFinite(boost)
        ? Math.max(0, Math.min(100, boost))
        : 0;
      return [key, value * (1 + normalizedBoost / 100)];
    }),
  );
}
