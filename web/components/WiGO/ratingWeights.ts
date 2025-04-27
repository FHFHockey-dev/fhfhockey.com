// web/components/WiGO/ratingsWeights.ts
import {
  RatingWeightsConfig,
  RegressionConfig,
  PlayerStrengthStats,
  Strength
} from "./types"; // Added PlayerStrengthStats, Strength

// --- RATING WEIGHTS CONFIGURATION ---
// (Keep your existing RATING_WEIGHTS object here)
export const RATING_WEIGHTS: RatingWeightsConfig = {
  // --- All Strengths (AS) ---
  as: {
    offense: [
      // Core Production
      { stat: "total_points_per_60", weight: 25, higherIsBetter: true },
      { stat: "ixg_per_60", weight: 20, higherIsBetter: true }, // Individual Expected Goals
      // Shot Generation / Danger
      { stat: "shots_per_60", weight: 15, higherIsBetter: true },
      { stat: "iscfs_per_60", weight: 10, higherIsBetter: true }, // Indiv. Scoring Chances
      { stat: "i_hdcf_per_60", weight: 10, higherIsBetter: true }, // Indiv. High-Danger Chances
      // On-Ice Impact (Relative metrics might be better, but using % for now)
      { stat: "xgf_pct", weight: 10, higherIsBetter: true }, // Expected Goals For %
      { stat: "cf_pct", weight: 5, higherIsBetter: true }, // Corsi For %
      // Fantasy Relevant / Other
      { stat: "penalties_drawn_per_60", weight: 5, higherIsBetter: true }
    ],
    defense: [
      // Core Suppression
      { stat: "xga_per_60", weight: 30, higherIsBetter: false }, // Expected Goals Against
      { stat: "sca_per_60", weight: 20, higherIsBetter: false }, // Scoring Chances Against
      { stat: "hdca_per_60", weight: 15, higherIsBetter: false }, // High-Danger Chances Against
      // Individual Defensive Actions
      { stat: "shots_blocked_per_60", weight: 10, higherIsBetter: true }, // Fantasy relevant
      { stat: "takeaways_per_60", weight: 10, higherIsBetter: true },
      // Discipline / Mistakes
      { stat: "minor_penalties_per_60", weight: 5, higherIsBetter: false },
      { stat: "giveaways_per_60", weight: 10, higherIsBetter: false }
    ]
  },
  // --- Even Strength (ES) ---
  es: {
    offense: [
      { stat: "total_points_per_60", weight: 25, higherIsBetter: true },
      { stat: "ixg_per_60", weight: 20, higherIsBetter: true },
      { stat: "shots_per_60", weight: 15, higherIsBetter: true },
      { stat: "iscfs_per_60", weight: 10, higherIsBetter: true },
      { stat: "i_hdcf_per_60", weight: 10, higherIsBetter: true },
      { stat: "xgf_pct", weight: 10, higherIsBetter: true },
      { stat: "cf_pct", weight: 5, higherIsBetter: true },
      { stat: "penalties_drawn_per_60", weight: 5, higherIsBetter: true }
    ],
    defense: [
      { stat: "xga_per_60", weight: 30, higherIsBetter: false },
      { stat: "sca_per_60", weight: 20, higherIsBetter: false },
      { stat: "hdca_per_60", weight: 15, higherIsBetter: false },
      { stat: "shots_blocked_per_60", weight: 10, higherIsBetter: true },
      { stat: "takeaways_per_60", weight: 10, higherIsBetter: true },
      { stat: "minor_penalties_per_60", weight: 5, higherIsBetter: false },
      { stat: "giveaways_per_60", weight: 10, higherIsBetter: false }
    ]
  },
  // --- Power Play (PP) ---
  pp: {
    offense: [
      { stat: "gf_per_60", weight: 25, higherIsBetter: true }, // Actual Goals For
      { stat: "xgf_per_60", weight: 20, higherIsBetter: true }, // Expected Goals For
      { stat: "total_points_per_60", weight: 15, higherIsBetter: true }, // Fantasy relevant
      { stat: "scf_per_60", weight: 10, higherIsBetter: true }, // Scoring Chances For
      { stat: "shots_per_60", weight: 15, higherIsBetter: true }, // Fantasy relevant
      { stat: "hdgf_per_60", weight: 10, higherIsBetter: true }, // High-Danger Goals For
      { stat: "penalties_drawn_per_60", weight: 5, higherIsBetter: true } // Drawing penalties on PP? Less common but possible
    ],
    defense: [] // Typically no defensive rating for PP
  },
  // --- Penalty Kill (PK) ---
  pk: {
    offense: [], // Typically no offensive rating for PK
    defense: [
      { stat: "ga_per_60", weight: 25, higherIsBetter: false }, // Actual Goals Against
      { stat: "xga_per_60", weight: 20, higherIsBetter: false }, // Expected Goals Against
      { stat: "sca_per_60", weight: 15, higherIsBetter: false }, // Scoring Chances Against
      { stat: "sa_per_60", weight: 10, higherIsBetter: false }, // Shots Against
      { stat: "hdca_per_60", weight: 10, higherIsBetter: false }, // High-Danger Chances Against
      { stat: "shots_blocked_per_60", weight: 10, higherIsBetter: true }, // Fantasy relevant
      { stat: "takeaways_per_60", weight: 5, higherIsBetter: true }
      // Note: Penalties taken on PK are very bad, but might be captured by total PIMs elsewhere if needed.
      // minor_penalties_per_60 might be relevant if available in pk_defense table
    ]
  }
};

// --- REGRESSION CONFIGURATION ---
// (Keep your existing REGRESSION_CONFIG object here)
export const REGRESSION_CONFIG: RegressionConfig = {
  minGPThreshold: 10, // Regress players with fewer than 10 GP *at that strength*
  enabled: true // Enable/disable regression easily
};

// --- NEW HELPER FUNCTIONS ---

// Base columns always needed
const BASE_COLUMNS: (keyof PlayerStrengthStats)[] = [
  "player_id",
  "season",
  "gp",
  "toi_seconds"
];

// Helper to get unique offense stats used in weights
export function getOffenseStatsUsedInWeights(
  config: RatingWeightsConfig
): Set<keyof PlayerStrengthStats> {
  const stats = new Set<keyof PlayerStrengthStats>(BASE_COLUMNS); // Start with base columns
  for (const strengthKey in config) {
    const strength = strengthKey as Strength;
    const strengthConfig = config[strength];
    if (strengthConfig?.offense) {
      strengthConfig.offense.forEach((item) => stats.add(item.stat));
    }
  }
  return stats;
}

// Helper to get unique defense stats used in weights
export function getDefenseStatsUsedInWeights(
  config: RatingWeightsConfig
): Set<keyof PlayerStrengthStats> {
  const stats = new Set<keyof PlayerStrengthStats>(BASE_COLUMNS); // Start with base columns
  for (const strengthKey in config) {
    const strength = strengthKey as Strength;
    const strengthConfig = config[strength];
    if (strengthConfig?.defense) {
      strengthConfig.defense.forEach((item) => stats.add(item.stat));
    }
  }
  return stats;
}

// (Keep the old getAllStatsUsedInWeights function if needed elsewhere, or remove it)
// export function getAllStatsUsedInWeights(config: RatingWeightsConfig): Set<keyof PlayerStrengthStats> { ... }
