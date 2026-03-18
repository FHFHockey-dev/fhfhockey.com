import { describe, expect, it } from "vitest";

import {
  isTruthyQueryFlag,
  resolveSkaterIncrementalWindow
} from "../../../../../pages/api/v1/db/update-sko-stats";

describe("/api/v1/db/update-sko-stats helpers", () => {
  it("treats common full-refresh flags as truthy", () => {
    expect(isTruthyQueryFlag("1")).toBe(true);
    expect(isTruthyQueryFlag("true")).toBe(true);
    expect(isTruthyQueryFlag("full")).toBe(true);
    expect(isTruthyQueryFlag(["no", "yes"])).toBe(true);
    expect(isTruthyQueryFlag(undefined)).toBe(false);
  });

  it("starts from the season start when no current-season snapshot exists", () => {
    expect(
      resolveSkaterIncrementalWindow({
        seasonStartDate: "2025-10-07",
        seasonEndDate: "2026-04-15",
        latestStoredDate: null,
        today: "2026-03-14"
      })
    ).toEqual({
      startDate: "2025-10-07",
      endDate: "2026-03-14",
      upToDate: false
    });
  });

  it("resumes from the day after the latest stored snapshot", () => {
    expect(
      resolveSkaterIncrementalWindow({
        seasonStartDate: "2025-10-07",
        seasonEndDate: "2026-04-15",
        latestStoredDate: "2026-03-10",
        today: "2026-03-14"
      })
    ).toEqual({
      startDate: "2026-03-11",
      endDate: "2026-03-14",
      upToDate: false
    });
  });

  it("reports up-to-date when the latest stored snapshot already reaches the bounded end date", () => {
    expect(
      resolveSkaterIncrementalWindow({
        seasonStartDate: "2025-10-07",
        seasonEndDate: "2026-04-15",
        latestStoredDate: "2026-03-14",
        today: "2026-03-14"
      })
    ).toEqual({
      startDate: null,
      endDate: "2026-03-14",
      upToDate: true
    });
  });
});
