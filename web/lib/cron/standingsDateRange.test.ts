import { describe, expect, it } from "vitest";

import {
  boundStandingsEndDate,
  MAX_STANDINGS_DATES_PER_RUN,
  parseBooleanQuery,
} from "./standingsDateRange";

describe("standings date range guard", () => {
  it("caps a long range at the configured inclusive date count", () => {
    const start = new Date("2025-10-07T00:00:00Z");
    const requestedEnd = new Date("2026-04-17T00:00:00Z");

    const result = boundStandingsEndDate(
      start,
      requestedEnd,
      MAX_STANDINGS_DATES_PER_RUN,
    );

    expect(result.bounded).toBe(true);
    expect(result.endDate.toISOString()).toBe("2025-10-20T00:00:00.000Z");
  });

  it("leaves short and explicitly full ranges unchanged", () => {
    const start = new Date("2026-04-17T00:00:00Z");
    const end = new Date("2026-04-17T00:00:00Z");

    expect(boundStandingsEndDate(start, end, 14)).toEqual({
      endDate: end,
      bounded: false,
    });
    expect(boundStandingsEndDate(start, end)).toEqual({
      endDate: end,
      bounded: false,
    });
  });

  it("accepts only the documented truthy query values", () => {
    expect(parseBooleanQuery("true")).toBe(true);
    expect(parseBooleanQuery(["yes"])).toBe(true);
    expect(parseBooleanQuery("false")).toBe(false);
    expect(parseBooleanQuery(undefined)).toBe(false);
  });
});
