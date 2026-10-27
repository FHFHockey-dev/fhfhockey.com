import { describe, expect, it } from "vitest";
import { recentPointsPerGame, recentTotals } from "./recentForm";

const points = (weights: Record<string, number>) => ({ mode: "points" as const, weights, categories: [] });

describe("recent form", () => {
  it("sums only played games, newest first, at most 10", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({ games_played: index === 1 ? 0 : 1, goals: 1, hits: index }));
    expect(recentTotals(rows, "skater")).toMatchObject({ games: 10, stats: { GOALS: 10, HITS: 54 } });
    expect(recentTotals([{ games_played: 0, goals: 2 }], "skater")).toBeNull();
  });

  it("scores the league's weights per game for the player's class only", () => {
    const skater = { playerClass: "skater" as const, recentTotals: { games: 10, stats: { GOALS: 4, SHOTS_ON_GOAL: 30 } } };
    // A goalie weight never scores a skater; an absent mapped key summed to 0.
    expect(recentPointsPerGame(skater, points({ GOALS: 3, SHOTS_ON_GOAL: 0.5, HITS: 1, SAVES_GOALIE: 0.2 }))).toBeCloseTo((12 + 15) / 10);
    const goalie = { playerClass: "goalie" as const, recentTotals: { games: 2, stats: { WINS_GOALIE: 1, SAVES_GOALIE: 60 } } };
    expect(recentPointsPerGame(goalie, points({ GOALS: 3, WINS_GOALIE: 4, SAVES_GOALIE: 0.2 }))).toBeCloseTo((4 + 12) / 2);
  });

  it("is unknown when a weighted stat is missing or can't be scored per game, and outside points leagues", () => {
    const skater = { playerClass: "skater" as const, recentTotals: { games: 10, stats: { GOALS: 4, FACEOFFS_WON: null } } };
    expect(recentPointsPerGame(skater, points({ GOALS: 1, FACEOFFS_WON: 0.1 }))).toBeNull();
    expect(recentPointsPerGame(skater, points({ GOALS: 1, SHOOTING_PERCENTAGE: 1 }))).toBeNull();
    expect(recentPointsPerGame(skater, { mode: "categories", weights: { GOALS: 1 }, categories: [] })).toBeNull();
    expect(recentPointsPerGame({ playerClass: "skater" }, points({ GOALS: 1 }))).toBeNull();
  });
});
