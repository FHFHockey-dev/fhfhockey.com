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

  it("values GAA by goals prevented over the goalie's own minutes, not starts", () => {
    // Pool GAA = 250 GA x 3600 / 360000 s = 2.5. Goals prevented at the pool
    // GAA: g1 125 - 100 = +25, g2 125 - 150 = -25 (TOI decides, not starts).
    const scores = calculateCategoryScores(
      [
        {
          id: "g1",
          role: "goalie",
          values: { GOALS_AGAINST_AVERAGE: 2, GOALS_AGAINST_GOALIE: 100, TOTAL_TOI: 180000, GAMES_STARTED: 10 },
        },
        {
          id: "g2",
          role: "goalie",
          values: { GOALS_AGAINST_AVERAGE: 3, GOALS_AGAINST_GOALIE: 150, TOTAL_TOI: 180000, GAMES_STARTED: 60 },
        },
      ],
      { GOALS_AGAINST_AVERAGE: 1 },
    );

    expect(scores.get("g1")).toBeCloseTo(25 / Math.sqrt(1250));
    expect(scores.get("g2")).toBeCloseTo(-25 / Math.sqrt(1250));
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

  it("values SV% by saves above the pool rate on the goalie's own shots, with no second shrink", () => {
    // Pool SV% = 3660 / 4000 = .915. Impacts: 1840 - 1830 = 10,
    // 470 - 457.5 = 12.5, 1350 - 1372.5 = -22.5; mean 0, SD sqrt(381.25).
    const scores = calculateCategoryScores(
      [
        { id: "a", role: "goalie", values: { SAVE_PERCENTAGE: 0.92, SAVES_GOALIE: 1840, SHOTS_AGAINST_GOALIE: 2000 } },
        { id: "b", role: "goalie", values: { SAVE_PERCENTAGE: 0.94, SAVES_GOALIE: 470, SHOTS_AGAINST_GOALIE: 500 } },
        { id: "c", role: "goalie", values: { SAVE_PERCENTAGE: 0.9, SAVES_GOALIE: 1350, SHOTS_AGAINST_GOALIE: 1500 } },
      ],
      { SAVE_PERCENTAGE: 1 },
    );
    const sd = Math.sqrt(381.25);
    expect(scores.get("a")).toBeCloseTo(10 / sd);
    expect(scores.get("b")).toBeCloseTo(12.5 / sd);
    expect(scores.get("c")).toBeCloseTo(-22.5 / sd);
  });

  it("a one-shot goalie outside the league pool does not move other goalies' SV% value", () => {
    const regulars = [
      { id: "a", role: "goalie" as const, values: { SAVE_PERCENTAGE: 0.92, SAVES_GOALIE: 1840, SHOTS_AGAINST_GOALIE: 2000, WINS_GOALIE: 30 } },
      { id: "b", role: "goalie" as const, values: { SAVE_PERCENTAGE: 0.94, SAVES_GOALIE: 470, SHOTS_AGAINST_GOALIE: 500, WINS_GOALIE: 8 } },
      { id: "c", role: "goalie" as const, values: { SAVE_PERCENTAGE: 0.9, SAVES_GOALIE: 1350, SHOTS_AGAINST_GOALIE: 1500, WINS_GOALIE: 20 } },
    ];
    const oneShot = { id: "d", role: "goalie" as const, values: { SAVE_PERCENTAGE: 0, SAVES_GOALIE: 0, SHOTS_AGAINST_GOALIE: 1, WINS_GOALIE: 0 } };
    const options = { referencePool: { goalie: 3 } };
    const without = calculateCategoryScores(regulars, { SAVE_PERCENTAGE: 1, WINS_GOALIE: 1 }, options);
    const withOneShot = calculateCategoryScores([...regulars, oneShot], { SAVE_PERCENTAGE: 1, WINS_GOALIE: 1 }, options);
    for (const id of ["a", "b", "c"]) {
      expect(withOneShot.get(id)).toBeCloseTo(without.get(id) as number, 12);
    }
  });

  it("keeps a missing category or missing exposure unknown instead of average", () => {
    const scores = calculateCategoryScores(
      [
        { id: "s1", role: "skater", values: { GOALS: 1 } },
        { id: "s2", role: "skater", values: { GOALS: 3 } },
        { id: "s3", role: "skater", values: {} },
        { id: "g1", role: "goalie", values: { SAVE_PERCENTAGE: 0.92, SAVES_GOALIE: 1840, SHOTS_AGAINST_GOALIE: 2000 } },
        { id: "g2", role: "goalie", values: { SAVE_PERCENTAGE: 0.9, SAVES_GOALIE: 1350, SHOTS_AGAINST_GOALIE: 1500 } },
        { id: "g3", role: "goalie", values: { SAVE_PERCENTAGE: 0.93 } },
      ],
      { GOALS: 1, SAVE_PERCENTAGE: 1 },
    );

    expect(scores.has("s3")).toBe(false);
    expect(scores.has("g3")).toBe(false);
    expect(scores.get("s1")).toBeCloseTo(-1 / Math.sqrt(2));
  });

  it("takes direction from the registry and the league override", () => {
    const players = [
      { id: "s1", role: "skater" as const, values: { FACEOFFS_LOST: 100 } },
      { id: "s2", role: "skater" as const, values: { FACEOFFS_LOST: 300 } },
    ];
    const byDefault = calculateCategoryScores(players, { FACEOFFS_LOST: 1 });
    expect(byDefault.get("s1")!).toBeGreaterThan(byDefault.get("s2")!);
    const reversed = calculateCategoryScores(players, { FACEOFFS_LOST: 1 }, { directions: { FACEOFFS_LOST: "higher" } });
    expect(reversed.get("s2")!).toBeGreaterThan(reversed.get("s1")!);
  });

  it("does not depend on input order", () => {
    const players = [
      { id: "a", role: "goalie" as const, values: { SAVES_GOALIE: 1840, SHOTS_AGAINST_GOALIE: 2000, WINS_GOALIE: 30 } },
      { id: "b", role: "goalie" as const, values: { SAVES_GOALIE: 470, SHOTS_AGAINST_GOALIE: 500, WINS_GOALIE: 8 } },
      { id: "c", role: "goalie" as const, values: { SAVES_GOALIE: 1350, SHOTS_AGAINST_GOALIE: 1500, WINS_GOALIE: 20 } },
    ];
    const forward = calculateCategoryScores(players, { SAVE_PERCENTAGE: 1, WINS_GOALIE: 1 }, { referencePool: { goalie: 2 } });
    const backward = calculateCategoryScores([...players].reverse(), { SAVE_PERCENTAGE: 1, WINS_GOALIE: 1 }, { referencePool: { goalie: 2 } });
    for (const id of ["a", "b", "c"]) expect(backward.get(id)).toBeCloseTo(forward.get(id) as number, 12);
  });
});
