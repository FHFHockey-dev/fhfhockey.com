import { describe, expect, it } from "vitest";
import { calculateTierThresholds, type PerformanceTier } from "./tierUtils";

const summaries = (byRound: Record<number, number>) =>
  Object.entries(byRound).map(([round, actualPerGame]) => ({
    roundNumber: Number(round),
    projectedPerGame: null,
    actualPerGame,
    diffPercentagePerGame: null
  })) as any;

const tiersContaining = (tiers: PerformanceTier[], value: number) =>
  tiers.filter((t) => value >= t.minFP && value < t.maxFP).map((t) => t.name);

describe("calculateTierThresholds (W3-1 D10)", () => {
  it("places every value in exactly one band when round averages are not monotone", () => {
    const tiers = calculateTierThresholds(summaries({ 1: 5, 2: 5.4, 3: 4.1 }));
    expect(tiersContaining(tiers, 5.2)).toEqual(["Tier 1"]);
    for (const value of [-3, 0, 4, 4.1, 4.99, 5, 5.4, 9]) {
      expect(tiersContaining(tiers, value)).toHaveLength(1);
    }
  });

  it("covers negative values and the gap left by a missing round", () => {
    const tiers = calculateTierThresholds(summaries({ 1: 10, 3: 6, 13: 1 }));
    expect(tiersContaining(tiers, -2)).toEqual(["Replacement Level"]);
    expect(tiersContaining(tiers, 8)).toEqual(["Tier 3"]);
    for (const value of [-100, -0.5, 0, 0.99, 1, 5.9, 6, 9.99, 10, 50]) {
      expect(tiersContaining(tiers, value)).toHaveLength(1);
    }
  });

  it("keeps each band tied to its round average", () => {
    const tiers = calculateTierThresholds(
      summaries({ 1: 4, 2: 3.5, 3: 3, 6: 2.5, 9: 2, 13: 1.5 })
    );
    expect(tiers.map((t) => [t.name, t.minFP, t.maxFP])).toEqual([
      ["Tier 1", 4, Infinity],
      ["Tier 2", 3.5, 4],
      ["Tier 3", 3, 3.5],
      ["Strong", 2.5, 3],
      ["Mid", 2, 2.5],
      ["Average", 1.5, 2],
      ["Replacement Level", -Infinity, 1.5]
    ]);
  });
});
