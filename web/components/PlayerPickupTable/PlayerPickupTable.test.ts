import { describe, expect, it } from "vitest";

import {
  getNhlSeasonIdFromYahooSeasonYear,
  getYahooSeasonStartYear,
} from "./PlayerPickupTable";

describe("Player Pickup season identity", () => {
  it("keeps the Yahoo start year stable after the NHL season ends", () => {
    expect(getYahooSeasonStartYear(20252026)).toBe(2025);
    expect(getYahooSeasonStartYear("20252026")).toBe(2025);
    expect(getNhlSeasonIdFromYahooSeasonYear(2025)).toBe("20252026");
  });

  it("fails closed for missing or malformed season identities", () => {
    expect(getYahooSeasonStartYear(null)).toBeNull();
    expect(getYahooSeasonStartYear("2025")).toBeNull();
    expect(getYahooSeasonStartYear("2025-2026")).toBeNull();
  });
});
