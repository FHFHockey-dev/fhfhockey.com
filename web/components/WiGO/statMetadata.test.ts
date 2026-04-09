import { describe, expect, it } from "vitest";

import {
  WIGO_STAT_ORDER,
  formatWigoStatValue,
  getWigoStatMetadata,
  normalizeWigoAggregateValue
} from "./statMetadata";

describe("WIGO_STAT_METADATA", () => {
  it("defines metadata for every ordered WiGO stat", () => {
    expect(WIGO_STAT_ORDER).toHaveLength(36);

    for (const label of WIGO_STAT_ORDER) {
      expect(getWigoStatMetadata(label)).toBeDefined();
    }
  });

  it("normalizes fraction percentages into display percentages", () => {
    expect(normalizeWigoAggregateValue("S%", 0.15463)).toBeCloseTo(15.463);
    expect(normalizeWigoAggregateValue("IPP", 0.5862)).toBeCloseTo(58.62);
    expect(normalizeWigoAggregateValue("PP%", 0.211)).toBeCloseTo(21.1);
  });

  it("normalizes ATOI from minutes to seconds but keeps PPTOI in seconds", () => {
    expect(normalizeWigoAggregateValue("ATOI", 15.55)).toBeCloseTo(933);
    expect(normalizeWigoAggregateValue("PPTOI", 79.4)).toBeCloseTo(79.4);
  });

  it("formats values according to the stat contract", () => {
    expect(formatWigoStatValue("GP", 79)).toBe("79");
    expect(formatWigoStatValue("ixG", 10.44)).toBe("10.4");
    expect(formatWigoStatValue("PTS/60", 2.456)).toBe("2.46");
    expect(formatWigoStatValue("IPP", 58.62)).toBe("58.6%");
    expect(formatWigoStatValue("ATOI", 930)).toBe("15:30");
    expect(formatWigoStatValue("PPTOI", 75)).toBe("01:15");
  });
});
