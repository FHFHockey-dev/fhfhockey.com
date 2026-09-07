import { describe, expect, it } from "vitest";

import { buildPersonalizedRecommendations, estimateAvailability, normalizeRecommendationPreferences } from "./recommendations";

const skater = (id: string, rankValue: number, values: Record<string, number> = {}) => ({
  id,
  name: id,
  role: "skater" as const,
  eligiblePositions: ["C"],
  globalVorp: rankValue + 10,
  rankValue,
  categoryValues: values,
});

describe("personalized draft recommendations", () => {
  it("changes suggestion rank for roster needs without changing global VORP", () => {
    const result = buildPersonalizedRecommendations([
      { ...skater("center", 10), eligiblePositions: ["C"] },
      { ...skater("defender", 10), eligiblePositions: ["D"] },
    ], { leagueType: "points", positionNeeds: { D: 1, C: 0 }, needAlpha: 1 });

    expect(result.map((entry) => entry.candidate.id)).toEqual(["defender", "center"]);
    expect(result.find((entry) => entry.candidate.id === "defender")?.globalVorp).toBe(20);
    expect(result.find((entry) => entry.candidate.id === "defender")?.rankScore).toBe(10);
  });

  it("averages a multi-position player's filled-slot need and preserves legacy preferences", () => {
    const result = buildPersonalizedRecommendations([
      { ...skater("flex", 10), eligiblePositions: ["C", "D"] },
      { ...skater("wing", 10), eligiblePositions: ["LW"] },
    ], { leagueType: "points", positionNeeds: { C: 0, D: 1, LW: 0 }, needAlpha: 1 });

    expect(result[0].candidate.id).toBe("flex");
    expect(normalizeRecommendationPreferences({ needWeightEnabled: true, personalizeReplacement: true })).toEqual({ prioritizeRosterNeeds: true, personalizeReplacement: true });
    expect(normalizeRecommendationPreferences({ prioritizeRosterNeeds: false, needWeightEnabled: true })).toMatchObject({ prioritizeRosterNeeds: false });
  });

  it("improves zero and negative ranks instead of multiplying them in the wrong direction", () => {
    const result = buildPersonalizedRecommendations([
      { ...skater("needed", -2), eligiblePositions: ["D"], baselineScore: -2 },
      { ...skater("neutral", 0), eligiblePositions: ["C"], baselineScore: 0 },
    ], { leagueType: "points", positionNeeds: { D: 1, C: 0 }, needAlpha: 1 });
    expect(result.find((entry) => entry.candidate.id === "needed")?.recommendationScore).toBeGreaterThan(-2);
    expect(result.find((entry) => entry.candidate.id === "neutral")?.recommendationScore).toBe(0);
  });

  it("uses enabled category weights and reports missing ratio analysis", () => {
    const result = buildPersonalizedRecommendations([
      { id: "g1", name: "g1", role: "goalie", eligiblePositions: ["G"], globalVorp: 4, rankValue: 4, categoryValues: { SAVES_GOALIE: 90, GOALS_AGAINST_GOALIE: 10 } },
      { id: "g2", name: "g2", role: "goalie", eligiblePositions: ["G"], globalVorp: 3, rankValue: 3, categoryValues: { SAVES_GOALIE: 80, GOALS_AGAINST_GOALIE: 20 } },
      { id: "g3", name: "g3", role: "goalie", eligiblePositions: ["G"], globalVorp: 2, rankValue: 2, categoryValues: { SAVES_GOALIE: 0, GOALS_AGAINST_GOALIE: 0 } },
    ], { leagueType: "categories", categoryWeights: { SAVE_PERCENTAGE: 1, WINS_GOALIE: 0 }, categoryNeeds: { SAVE_PERCENTAGE: 1 }, needAlpha: 1 });

    expect(result[0].candidate.id).toBe("g1");
    expect(result.find((entry) => entry.candidate.id === "g3")?.missingCategories).toEqual(["SAVE_PERCENTAGE"]);
  });

  it("keeps availability as one bounded ADP estimate", () => {
    expect(estimateAvailability(120, 80, 12)).toBeGreaterThan(0.9);
    expect(estimateAvailability(null, 80, 12)).toBeNull();
  });
});
