import { describe, expect, it } from "vitest";
import { calculateRollingAverage } from "./formattingUtils";

describe("calculateRollingAverage", () => {
  const value = (item: number | null | undefined) => item;

  it("starts each series only after five or ten actual observations", () => {
    const games = Array.from({ length: 10 }, (_, index) => index + 1);
    const five = calculateRollingAverage(games, 5, value);
    const ten = calculateRollingAverage(games, 10, value);
    expect(five.slice(0, 4)).toEqual([null, null, null, null]);
    expect(five[4]).toBe(3);
    expect(five[8]).toBe(7);
    expect(five[9]).toBe(8);
    expect(ten.slice(0, 9)).toEqual(Array(9).fill(null));
    expect(ten[9]).toBe(5.5);
  });

  it.each([null, undefined, NaN, Infinity, -Infinity])(
    "keeps a gap for missing or invalid observation %s until it leaves the window",
    (missing) => {
      expect(calculateRollingAverage([1, 2, missing, 4, 5, 6, 7, 8], 5, value))
        .toEqual([null, null, null, null, null, null, null, 6]);
    }
  );

  it("includes real zeros, negative scores and outliers without clipping", () => {
    expect(calculateRollingAverage([0, 0, 0, 0, 0], 5, value)[4]).toBe(0);
    expect(calculateRollingAverage([-2, -1, 0, 1, 12], 5, value)[4]).toBe(2);
  });

  it.each([0, -1, 1.5, Infinity, NaN])("rejects invalid window %s", (window) => {
    expect(calculateRollingAverage([1, 2], window, value)).toEqual([]);
  });
});
