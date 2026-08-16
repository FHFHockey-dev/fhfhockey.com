import { describe, expect, it } from "vitest";

import { calculateCategoryScores } from "./categoryScores";

describe("shared category-value scoring", () => {
  it("uses full-pool role-specific sample standard deviations", () => {
    const scores = calculateCategoryScores(
      [
        { id: "s1", role: "skater", values: { GOALS: 1 } },
        { id: "s2", role: "skater", values: { GOALS: 3 } },
        { id: "g1", role: "goalie", values: { WINS_GOALIE: 10 } },
        { id: "g2", role: "goalie", values: { WINS_GOALIE: 14 } },
      ],
      { GOALS: 1, WINS_GOALIE: 1 },
    );

    expect(scores.get("s1")).toBeCloseTo(-1 / Math.sqrt(2));
    expect(scores.get("s2")).toBeCloseTo(1 / Math.sqrt(2));
    expect(scores.get("g1")).toBeCloseTo(-1 / Math.sqrt(2));
    expect(scores.get("g2")).toBeCloseTo(1 / Math.sqrt(2));
  });

  it("inverts lower-is-better categories after workload regression", () => {
    const scores = calculateCategoryScores(
      [
        {
          id: "g1",
          role: "goalie",
          values: { GOALS_AGAINST_AVERAGE: 2, GAMES_STARTED: 25 },
        },
        {
          id: "g2",
          role: "goalie",
          values: { GOALS_AGAINST_AVERAGE: 4, GAMES_STARTED: 25 },
        },
      ],
      { GOALS_AGAINST_AVERAGE: 1 },
    );

    expect(scores.get("g1")).toBeCloseTo(0.5 / Math.sqrt(2));
    expect(scores.get("g2")).toBeCloseTo(-0.5 / Math.sqrt(2));
  });

  it("keeps shared workload categories separate by role and honors zero weights", () => {
    const scores = calculateCategoryScores(
      [
        { id: "s1", role: "skater", values: { GAMES_PLAYED: 1, GOALS: 1 } },
        { id: "s2", role: "skater", values: { GAMES_PLAYED: 3, GOALS: 3 } },
        { id: "g1", role: "goalie", values: { GAMES_PLAYED: 10 } },
        { id: "g2", role: "goalie", values: { GAMES_PLAYED: 14 } },
      ],
      { GAMES_PLAYED: 1, GOALS: 0 },
    );

    expect(scores.get("s1")).toBeCloseTo(-1 / Math.sqrt(2));
    expect(scores.get("s2")).toBeCloseTo(1 / Math.sqrt(2));
    expect(scores.get("g1")).toBeCloseTo(-1 / Math.sqrt(2));
    expect(scores.get("g2")).toBeCloseTo(1 / Math.sqrt(2));
  });

  it("treats goalie starts as goalie-only workload", () => {
    const scores = calculateCategoryScores(
      [
        { id: "s1", role: "skater", values: { GAMES_STARTED: 82 } },
        { id: "s2", role: "skater", values: { GAMES_STARTED: 1 } },
        { id: "g1", role: "goalie", values: { GAMES_STARTED: 20 } },
        { id: "g2", role: "goalie", values: { GAMES_STARTED: 40 } },
      ],
      { GAMES_STARTED: 1 },
    );

    expect(scores.get("s1")).toBe(0);
    expect(scores.get("s2")).toBe(0);
    expect(scores.get("g1")).toBeCloseTo(-1 / Math.sqrt(2));
    expect(scores.get("g2")).toBeCloseTo(1 / Math.sqrt(2));
  });
});
