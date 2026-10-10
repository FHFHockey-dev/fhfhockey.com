import { describe, expect, it } from "vitest";
import { toFourWeekMetricBands } from "./fourWeekMetricBands";

describe("four-week favorability bands", () => {
  it("ranks finite observations, shares tied bands, and reverses opponent strength", () => {
    const values = [14, 14, 12, 10, NaN, Infinity].map((value, teamId) => ({ teamId, value }));
    const bands = toFourWeekMetricBands(values, "desc");
    expect([...bands]).toEqual([[0, "high"], [1, "high"], [2, "middle"], [3, "low"]]);
    expect(toFourWeekMetricBands([...values].reverse(), "desc")).toEqual(bands);
    expect(toFourWeekMetricBands(values, "asc").get(3)).toBe("high");
  });
  it("handles empty, single, all-equal, two-observation and negative-score samples", () => {
    const band = (values: number[]) => toFourWeekMetricBands(values.map((value, teamId) => ({ teamId, value })), "desc");
    expect(band([]).size).toBe(0);
    expect([...band([0]).values()]).toEqual(["middle"]);
    expect([...band([3, 3, 3]).values()]).toEqual(["middle", "middle", "middle"]);
    expect([...band([-1, -5]).values()]).toEqual(["high", "low"]);
    expect([...band([-1, -3, -5]).values()]).toEqual(["high", "middle", "low"]);
  });
});
