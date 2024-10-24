import { describe, test, expect } from "vitest";
import calcWeekScore from "./calcWeekScore";

// Carolina Hurricanes week score | startDate=2022-05-23&endDate=2022-05-29
describe("Carolina Hurricanes week score | startDate=2022-05-23&endDate=2022-05-29", () => {
  const gameScores = [null, 0.53, null, 0.53, null, 0.53, null];

  test("test week score", () => {
    // No toggle
    expect(calcWeekScore(gameScores, 3, 9, 3)).toBeCloseTo(26.7045, 4);

    // Turn off a day (e.g., Tue)
    const adjustedGameScores = [null, null, null, 0.53, null, 0.53, null];
    expect(calcWeekScore(adjustedGameScores, 2, 7, 2)).toBeCloseTo(17.4545, 4);

    // Turn off all days
    expect(calcWeekScore([], 0, 0, 0)).toBe(-100);
  });
});
