import { describe, test, expect } from "vitest";
import calcWeekScore, { calculateMatchupBonus, formatWeekScore } from "./calcWeekScore";

describe("schedule-first Week Score", () => {
  test("uses percentage-scale odds and displayed off-night counts", () => {
    expect(calcWeekScore([null, 53, null, 53, null, 53, null], 3, 9, 3))
      .toBeCloseTo(26.655, 4);
    expect(calcWeekScore([null, null, null, 53, null, 53, null], 2, 7, 2))
      .toBeCloseTo(17.405, 4);
    expect(calculateMatchupBonus([0.53], 1)).toBeCloseTo(-0.4947);
    expect(calcWeekScore([], 0, 0, 0)).toBe(-100);
    expect(formatWeekScore(18.18289375)).toBe("18.2");
  });

  test.each([0, 25, 50, 75, 100])("retains a monotone, capped matchup term at %s%%", (odds) => {
    expect(calculateMatchupBonus(Array(4).fill(odds), 4)).toBeCloseTo(odds / 100 - .5);
    expect(calcWeekScore(Array(4).fill(odds), 3, 47, 4))
      .toBeCloseTo(18.375 + odds / 100 - .5);
  });

  test("preserves both strict schedule comparisons at the full matchup endpoints", () => {
    const worst4GP3ON = calcWeekScore([0, 0, 0, 0], 3, 47, 4);
    const best4GP1ON = calcWeekScore([100, 100, 100, 100], 1, 47, 4);
    const worst4GP1ON = calcWeekScore([0, 0, 0, 0], 1, 47, 4);
    const best3GP2ON = calcWeekScore([100, 100, 100], 2, 47, 3);
    expect(worst4GP3ON - best4GP1ON).toBe(7);
    expect(worst4GP1ON - best3GP2ON).toBe(1);
  });

  test("one extra off night always wins at equal GP, even at opposite odds extremes", () => {
    for (let gp = 1; gp <= 10; gp++) {
      for (let off = 0; off < gp; off++) {
        const extraOffNight = calcWeekScore(Array(gp).fill(0), off + 1, 47, gp);
        const fewerOffNights = calcWeekScore(Array(gp).fill(100), off, 47, gp);
        expect(extraOffNight - fewerOffNights).toBe(3);
      }
    }
  });

  test("gives equal schedules a small edge for higher current odds", () => {
    expect(calcWeekScore([100, 100, 100, 100], 3, 47, 4)
      - calcWeekScore([0, 0, 0, 0], 3, 47, 4)).toBe(1);
  });

  test("keeps missing and nonfinite odds neutral, including partially covered schedules", () => {
    expect(calculateMatchupBonus([null, undefined, NaN, Infinity, -Infinity], 5)).toBe(0);
    expect(calculateMatchupBonus([], 4)).toBe(0);
    expect(calculateMatchupBonus([100, null], 2)).toBe(.25);
    expect(calculateMatchupBonus([0, NaN], 2)).toBe(-.25);
    // Null entries for non-game days do not dilute known games.
    expect(calculateMatchupBonus([null, 100, null, 100, null, null, null], 2)).toBe(.5);
    expect(calcWeekScore([NaN, Infinity], 2, 47, 2)).toBe(2.375);
  });

  test("clamps finite percentages without mistaking nonfinite values for endpoints", () => {
    expect(calculateMatchupBonus([-10], 1)).toBe(-.5);
    expect(calculateMatchupBonus([110], 1)).toBe(.5);
    expect(calculateMatchupBonus([Infinity], 1)).toBe(0);
    expect(calculateMatchupBonus([100, 100], 1)).toBe(.5);
  });
});
