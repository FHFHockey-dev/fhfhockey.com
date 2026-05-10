export const CANONICAL_ROLLING_GAME_WINDOWS = [3, 5, 10, 20] as const;
export type CanonicalRollingGameWindow = (typeof CANONICAL_ROLLING_GAME_WINDOWS)[number];

export const CANONICAL_SUSTAINABILITY_WINDOW_CODES = ["l3", "l5", "l10", "l20"] as const;
export type CanonicalSustainabilityWindowCode =
  (typeof CANONICAL_SUSTAINABILITY_WINDOW_CODES)[number];

export const CANONICAL_HISTORICAL_BASELINE_WINDOWS = [
  "season",
  "three_year",
  "career",
] as const;

export const NON_PERSISTED_ROLLING_WINDOW_DECISIONS = [
  {
    games: 1,
    decision: "Use the game row itself for single-game validation; do not add last1 columns.",
  },
  {
    games: 25,
    decision: "Not currently persisted; use last20 plus season/career baselines until a model proves value.",
  },
  {
    games: 50,
    decision: "Not currently persisted; use season/three-year/career baselines until a model proves value.",
  },
] as const;

export const FORGE_TREND_ADJUSTMENT_WINDOW_PRIORITY = ["l5", "l10"] as const;
