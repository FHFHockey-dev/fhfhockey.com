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

  it("marks goalie rate categories unavailable without their real workloads", () => {
    const result = buildPersonalizedRecommendations([
      { id: "g1", name: "g1", role: "goalie", eligiblePositions: ["G"], globalVorp: 1, rankValue: 1, categoryValues: { SAVE_PERCENTAGE: .920, GOALS_AGAINST_AVERAGE: 2 } },
      { id: "g2", name: "g2", role: "goalie", eligiblePositions: ["G"], globalVorp: 0, rankValue: 0, categoryValues: { SAVES_GOALIE: 90, GOALS_AGAINST_GOALIE: 10, TOTAL_TOI: 36_000 } },
    ], { leagueType: "categories", categoryWeights: { SAVE_PERCENTAGE: 1, GOALS_AGAINST_AVERAGE: 1 }, categoryNeeds: { SAVE_PERCENTAGE: 1, GOALS_AGAINST_AVERAGE: 1 } });
    expect(result.find((entry) => entry.candidate.id === "g1")?.missingCategories).toEqual(["SAVE_PERCENTAGE", "GOALS_AGAINST_AVERAGE"]);
  });

  it("derives rate values only from consistent numerator and total-time denominators", () => {
    const result = buildPersonalizedRecommendations([
      { id: "bad", name: "bad", role: "goalie", eligiblePositions: ["G"], globalVorp: 1, rankValue: 1, categoryValues: { SAVES_GOALIE: 101, SHOTS_AGAINST_GOALIE: 100, SAVE_PERCENTAGE: .990, GOALS_AGAINST_GOALIE: 10, GAMES_STARTED: 10, TIME_ON_ICE_PER_GAME: 3600 } },
      { id: "good", name: "good", role: "goalie", eligiblePositions: ["G"], globalVorp: 0, rankValue: 0, categoryValues: { SAVES_GOALIE: 90, SHOTS_AGAINST_GOALIE: 100, GOALS_AGAINST_GOALIE: 10, TOTAL_TOI: 36_000 } },
    ], { leagueType: "categories", categoryWeights: { SAVE_PERCENTAGE: 1, GOALS_AGAINST_AVERAGE: 1, GAMES_PLAYED: 1 }, categoryNeeds: { SAVE_PERCENTAGE: 1, GOALS_AGAINST_AVERAGE: 1, GAMES_PLAYED: 1 } });
    expect(result.find((entry) => entry.candidate.id === "bad")?.missingCategories).toEqual(expect.arrayContaining(["SAVE_PERCENTAGE", "GOALS_AGAINST_AVERAGE", "GAMES_PLAYED"]));
    expect(result.find((entry) => entry.candidate.id === "good")?.missingCategories).toEqual(expect.arrayContaining(["GAMES_PLAYED"]));
  });
});
