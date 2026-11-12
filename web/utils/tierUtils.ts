import { RoundSummaryValue } from "contexts/RoundSummaryContext";
import { CHART_COLORS, WIGO_COLORS, addAlpha } from "styles/wigoColors";

export interface PerformanceTier {
  name: string;
  minFP: number; // Inclusive lower bound (-Infinity for the bottom tier)
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

const ROUND_TIERS: Array<{ round: number; name: string; color: string }> = [
  { round: 1, name: "Tier 1", color: CHART_COLORS.BAR_PRIMARY },
  { round: 2, name: "Tier 2", color: WIGO_COLORS.ORANGE },
  { round: 3, name: "Tier 3", color: WIGO_COLORS.SOFT_GREEN },
  { round: 6, name: "Strong", color: "#07aae2" }, // $secondary-color
  { round: 9, name: "Mid", color: "#ffcc33" }, // $warning-color
  { round: 13, name: "Average", color: "#ff9f40" } // $color-orange
];

/**
 * Performance bands from round-average actual FP per game (W3-1 D10).
 * Each band keeps its round meaning: a tier starts at its round's average and
 * ends where the band above starts. Bands never overlap and cover every value
 * from -Infinity to Infinity: a round whose average is not below the band
 * above adds no band (the higher tier already covers it), a missing round
 * leaves no gap, and Replacement Level takes everything below the lowest
 * band, negatives included. Sorted highest first.
 */
export const calculateTierThresholds = (
  roundSummaries: RoundSummaryValue[]
): PerformanceTier[] => {
  const tiers: PerformanceTier[] = [];
  let upper = Infinity;

  for (const { round, name, color } of ROUND_TIERS) {
    const average = getRoundAvg(roundSummaries, round);
    if (average === null || !Number.isFinite(average) || average >= upper) {
      continue;
    }
    tiers.push({ name, minFP: average, maxFP: upper, color });
    upper = average;
  }

  tiers.push({
    name: tiers.length ? "Replacement Level" : "All Performance Levels",
    minFP: -Infinity,
    maxFP: upper,
    color: "#505050" // $color-grey-dark
  });

  return tiers;
};
