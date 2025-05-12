import { RoundSummaryValue } from "contexts/RoundSummaryContext";
import { CHART_COLORS, WIGO_COLORS, addAlpha } from "styles/wigoColors";

export interface PerformanceTier {
  name: string;
  minFP: number; // Inclusive lower bound
  maxFP: number; // Exclusive upper bound (can be Infinity for the top tier)
  color: string;
}

// Helper to get actualPerGame for a specific round, ensuring it's a valid number
const getRoundAvg = (
  roundSummaries: RoundSummaryValue[],
  roundNumber: number
): number | null => {
  const summary = roundSummaries.find((s) => s.roundNumber === roundNumber);
  // Check if actualPerGame is a number and not NaN
  if (
    summary &&
    typeof summary.actualPerGame === "number" &&
    !isNaN(summary.actualPerGame)
  ) {
    return summary.actualPerGame;
  }
  return null;
};

export const calculateTierThresholds = (
  roundSummaries: RoundSummaryValue[]
): PerformanceTier[] => {
  const tiers: PerformanceTier[] = [];

  const avgR1 = getRoundAvg(roundSummaries, 1);
  const avgR2 = getRoundAvg(roundSummaries, 2);
  const avgR3 = getRoundAvg(roundSummaries, 3);
  const avgR6 = getRoundAvg(roundSummaries, 6);
  const avgR9 = getRoundAvg(roundSummaries, 9);
  const avgR13 = getRoundAvg(roundSummaries, 13);

  // Tier 1: [avgR1, Infinity)
  if (avgR1 !== null) {
    tiers.push({
      name: "Tier 1",
      minFP: avgR1,
      maxFP: Infinity,
      color: CHART_COLORS.BAR_PRIMARY
    });
  }

  // Tier 2: [avgR2, avgR1)
  // Only add if avgR1 is defined (so maxFP is valid) and avgR2 is less than avgR1
  if (avgR1 !== null && avgR2 !== null && avgR2 < avgR1) {
    tiers.push({
      name: "Tier 2",
      minFP: avgR2,
      maxFP: avgR1,
      color: WIGO_COLORS.ORANGE
    });
  }

  // Tier 3: [avgR3, avgR2)
  if (avgR2 !== null && avgR3 !== null && avgR3 < avgR2) {
    tiers.push({
      name: "Tier 3",
      minFP: avgR3,
      maxFP: avgR2,
      color: WIGO_COLORS.SOFT_GREEN
    });
  }

  // Strong: [avgR6, avgR3)
  if (avgR3 !== null && avgR6 !== null && avgR6 < avgR3) {
    tiers.push({
      name: "Strong",
      minFP: avgR6,
      maxFP: avgR3,
      color: "#07aae2" // $secondary-color
    });
  }

  // Mid: [avgR9, avgR6)
  if (avgR6 !== null && avgR9 !== null && avgR9 < avgR6) {
    tiers.push({
      name: "Mid",
      minFP: avgR9,
      maxFP: avgR6,
      color: "#ffcc33" // $warning-color
    });
  }

  // Average: [avgR13, avgR9)
  if (avgR9 !== null && avgR13 !== null && avgR13 < avgR9) {
    tiers.push({
      name: "Average",
      minFP: avgR13,
      maxFP: avgR9,
      color: "#ff9f40" // $color-orange
    });
  }

  // Determine the upper bound for the "Replacement Level" tier.
  // This will be avgR13 if available, otherwise the lowest minFP of the tiers defined above.
  let replacementLevelMaxFP: number | null = null;

  if (avgR13 !== null) {
    replacementLevelMaxFP = avgR13;
  } else {
    // Find the minimum of all defined lower bounds (minFP) from the tiers already added.
    // These tiers are [Tier 1, Tier 2, ..., Average].
    // We need the lowest minFP among them to cap the Replacement Level.
    const lowerBoundsOfExistingTiers = tiers
      .map((t) => t.minFP)
      .filter((fp) => fp !== Infinity); // Filter out Infinity if Tier 1 was the only one

    if (lowerBoundsOfExistingTiers.length > 0) {
      replacementLevelMaxFP = Math.min(...lowerBoundsOfExistingTiers);
    }
    // If no tiers were formed AND avgR13 is null, replacementLevelMaxFP remains null.
    // In this scenario, the Replacement Level tier might not be created, or could span [0, Infinity).
  }

  // Replacement Level: [0, replacementLevelMaxFP)
  // Only add if the upper bound is determined and valid (greater than 0).
  if (replacementLevelMaxFP !== null && 0 < replacementLevelMaxFP) {
    tiers.push({
      name: "Replacement Level",
      minFP: 0,
      maxFP: replacementLevelMaxFP,
      color: "#505050" // $color-grey-dark
    });
  } else if (replacementLevelMaxFP === null && tiers.length === 0) {
    // Case: No round averages were found at all (all avgRx were null).
    // We can create a default "catch-all" tier from 0 to Infinity.
    // This ensures there's always at least one tier definition if the function is called.
    tiers.push({
      name: "All Performance Levels", // Or "Undefined Tiers"
      minFP: 0,
      maxFP: Infinity,
      color: "#505050" // Default color
    });
  }

  // Sort tiers by minFP descending. This is important for chart layering or sequential processing.
  tiers.sort((a, b) => {
    // Handle Infinity correctly: A tier with minFP: Infinity is the "top" if maxFP is also Infinity (should not happen here)
    // For sorting, if a.minFP is Infinity, it should be considered "larger" than any number.
    // However, our top tier has a numeric minFP and maxFP: Infinity.
    // Standard sort treats Infinity as largest.
    if (a.maxFP === Infinity && b.maxFP !== Infinity) return -1; // Tier 1 (maxFP: Inf) comes first
    if (b.maxFP === Infinity && a.maxFP !== Infinity) return 1;
    if (a.maxFP === Infinity && b.maxFP === Infinity) return b.minFP - a.minFP; // Should be only one such tier

    return b.minFP - a.minFP; // Sort by lower bound, descending
  });

  return tiers;
};
