import { describe, expect, it } from "vitest";
import { resolveHomepageSeason } from "./homepageSeason";
import type { Season } from "lib/NHL/types";
const season = {
  regularSeasonStartDate: "2026-10-01", seasonEndDate: "2027-06-30",
  lastRegularSeasonStartDate: "2025-10-01", lastRegularSeasonEndDate: "2026-04-15", lastSeasonEndDate: "2026-06-30",
} as Season;
describe("homepage season reuse", () => {
  it("uses the current dates during the season", () => {
    expect(resolveHomepageSeason(season, new Date("2026-11-10T12:00:00Z"))).toEqual({ startDate: "2026-10-01", endDate: "2027-06-30", isOffseason: false });
  });
  it("preserves previous-season selection before opening night", () => {
    expect(resolveHomepageSeason(season, new Date("2026-08-10T12:00:00Z"))).toEqual({ startDate: "2025-10-01", endDate: "2026-06-30", isOffseason: true });
  });
  it("does not mark the playoffs as offseason", () => {
    expect(resolveHomepageSeason(season, new Date("2026-05-10T12:00:00Z")).isOffseason).toBe(false);
  });
});
