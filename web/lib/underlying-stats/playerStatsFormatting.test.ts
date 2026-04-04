import { describe, expect, it } from "vitest";

import {
  formatPlayerStatsDecimal,
  formatPlayerStatsDistance,
  formatPlayerStatsInteger,
  formatPlayerStatsPercentage,
  formatPlayerStatsPer60,
  formatPlayerStatsText,
  formatPlayerStatsToi,
  formatPlayerStatsValue,
  PLAYER_STATS_EMPTY_VALUE,
} from "./playerStatsFormatting";

describe("formatPlayerStatsToi", () => {
  it("formats TOI in total minutes and seconds", () => {
    expect(formatPlayerStatsToi(0)).toBe("0:00");
    expect(formatPlayerStatsToi(61)).toBe("1:01");
    expect(formatPlayerStatsToi(3723)).toBe("62:03");
  });

  it("returns the null-safe placeholder for invalid TOI values", () => {
    expect(formatPlayerStatsToi(null)).toBe(PLAYER_STATS_EMPTY_VALUE);
    expect(formatPlayerStatsToi(undefined)).toBe(PLAYER_STATS_EMPTY_VALUE);
    expect(formatPlayerStatsToi(-1)).toBe(PLAYER_STATS_EMPTY_VALUE);
  });
});

describe("numeric formatting helpers", () => {
  it("formats percentages from decimal fractions", () => {
    expect(formatPlayerStatsPercentage(0.5274)).toBe("52.7%");
  });

  it("formats per-60 and decimal metrics with two decimals", () => {
    expect(formatPlayerStatsPer60(2.345)).toBe("2.35");
    expect(formatPlayerStatsDecimal(12.3)).toBe("12.30");
  });

  it("formats distances with one decimal", () => {
    expect(formatPlayerStatsDistance(34.44)).toBe("34.4");
  });

  it("formats integers with rounding and grouping", () => {
    expect(formatPlayerStatsInteger(12.6)).toBe("13");
    expect(formatPlayerStatsInteger(1234)).toBe("1,234");
  });
});

describe("formatPlayerStatsText", () => {
  it("returns a null-safe placeholder for blank text values", () => {
    expect(formatPlayerStatsText(null)).toBe(PLAYER_STATS_EMPTY_VALUE);
    expect(formatPlayerStatsText("")).toBe(PLAYER_STATS_EMPTY_VALUE);
  });

  it("returns the raw text value when present", () => {
    expect(formatPlayerStatsText("FLA / CGY")).toBe("FLA / CGY");
    expect(formatPlayerStatsText("G")).toBe("G");
  });
});

describe("formatPlayerStatsValue", () => {
  it("dispatches to the correct formatter by column token", () => {
    expect(formatPlayerStatsValue(0.612, "percentage")).toBe("61.2%");
    expect(formatPlayerStatsValue(255, "toi")).toBe("4:15");
    expect(formatPlayerStatsValue(1.789, "per60")).toBe("1.79");
    expect(formatPlayerStatsValue(27.35, "distance")).toBe("27.4");
    expect(formatPlayerStatsValue("ANA", "team")).toBe("ANA");
  });

  it("stays null-safe across all formatter tokens", () => {
    expect(formatPlayerStatsValue(null, "percentage")).toBe(PLAYER_STATS_EMPTY_VALUE);
    expect(formatPlayerStatsValue(undefined, "integer")).toBe(
      PLAYER_STATS_EMPTY_VALUE
    );
    expect(formatPlayerStatsValue("", "text")).toBe(PLAYER_STATS_EMPTY_VALUE);
  });
});
