import { describe, test, expect } from "vitest";
import calcWeekScore, { calculateMatchupBonus, calculateSlateCrowding, formatWeekScore } from "./calcWeekScore";

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

describe("one horizon-wide slate crowding adjustment", () => {
  test("is strictly monotone across valid integer slates with centered endpoints", () => {
    expect(calculateSlateCrowding([1], 1).adjustment).toBe(.25);
    expect(calculateSlateCrowding([16], 1).adjustment).toBe(-.25);
    expect(calculateSlateCrowding([1, 16], 2).adjustment).toBe(0);
    for (let n = 1; n < 16; n++) {
      expect(calculateSlateCrowding([n], 1).adjustment)
        .toBeGreaterThan(calculateSlateCrowding([n + 1], 1).adjustment);
    }
    expect(calculateSlateCrowding([2], 1).adjustment).toBeCloseTo(13 / 60);
    expect(calculateSlateCrowding([7], 1).adjustment).toBeCloseTo(.05);
    expect(calculateSlateCrowding([8], 1).adjustment).toBeCloseTo(1 / 60);
  });
  test("unknown, inconsistent, fractional and out-of-range slates receive a disclosed neutral fallback", () => {
    for (const invalid of [null, undefined, NaN, Infinity, 0, -1, 17, 7.5]) {
      expect(calculateSlateCrowding([2, invalid], 2)).toMatchObject({
        adjustment: 0, meanGrade: null, knownGames: 1, expectedGames: 2, status: "unavailable"
      });
    }
    expect(calculateSlateCrowding([2], 2).status).toBe("unavailable");
    expect(calculateSlateCrowding([2, 2], 1).status).toBe("unavailable");
    expect(calculateSlateCrowding([2, 2], 2, false).adjustment).toBe(0);
    expect(calculateSlateCrowding([], 0).status).toBe("no_games");
  });
  test.each([7, 10, 14, 35])("keeps one budget and both comparisons for any common %s-day horizon", (horizon) => {
    for (const leagueGames of [0, horizon, 16 * horizon]) {
      const score = (gp, on, odds, slate, complete = true) =>
        calcWeekScore(Array(gp).fill(odds), on, leagueGames, gp, Array(gp).fill(slate), complete);
      expect(score(4, 3, 0, 16) - score(4, 1, 100, 1)).toBeCloseTo(6.5);
      expect(score(4, 1, 0, 16) - score(3, 2, 100, 1)).toBeCloseTo(.5);
      expect(score(4, 1, 0, 16, false) - score(3, 2, 100, 1, false)).toBeCloseTo(1);
      expect(calculateSlateCrowding(Array(horizon).fill(1), horizon).adjustment).toBe(.25);
    }
  });
  test("averages once regardless of game count or ordering", () => {
    expect(calculateSlateCrowding([2, 7, 8, 16], 4).adjustment)
      .toBeCloseTo(calculateSlateCrowding([16, 8, 7, 2], 4).adjustment);
    expect(calculateSlateCrowding(Array(10).fill(2), 10).adjustment)
      .toBe(calculateSlateCrowding([2], 1).adjustment);
  });
  test("retains both margins for every seven/ten-day exclusion mask with four included dates", () => {
    let assertions = 0;
    for (const horizon of [7, 10]) {
      for (let mask = 0; mask < 2 ** horizon; mask++) {
        const included = Array.from({ length: horizon }, (_, i) => (mask & (1 << i)) === 0);
        if (included.filter(Boolean).length < 4) continue;
        const leagueGames = included.reduce((sum, keep, i) => sum + (keep ? (i % 16) + 1 : 0), 0);
        const score = (gp, on, odds, slate) => calcWeekScore(Array(gp).fill(odds), on, leagueGames, gp, Array(gp).fill(slate));
        expect(score(4, 3, 0, 16) - score(4, 1, 100, 1)).toBeCloseTo(6.5);
        expect(score(4, 1, 0, 16) - score(3, 2, 100, 1)).toBeCloseTo(.5);
        assertions += 2;
      }
    }
    expect(assertions).toBe(1824);
  });
});
