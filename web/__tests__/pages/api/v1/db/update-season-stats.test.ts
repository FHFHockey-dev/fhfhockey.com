import { describe, expect, it } from "vitest";

import {
  isTruthyQueryFlag,
  resolveSeasonStatsRunMode
} from "../../../../../pages/api/v1/db/update-season-stats";

describe("/api/v1/db/update-season-stats helpers", () => {
  it("treats common full-refresh flags as truthy", () => {
    expect(isTruthyQueryFlag("1")).toBe(true);
    expect(isTruthyQueryFlag("true")).toBe(true);
    expect(isTruthyQueryFlag("full")).toBe(true);
    expect(isTruthyQueryFlag(["false", "yes"])).toBe(true);
    expect(isTruthyQueryFlag(undefined)).toBe(false);
  });

  it("defaults to incremental mode without an explicit full signal", () => {
    expect(resolveSeasonStatsRunMode({})).toBe("incremental");
    expect(
      resolveSeasonStatsRunMode({
        runMode: "incremental"
      })
    ).toBe("incremental");
  });

  it("switches to full mode for explicit full flags", () => {
    expect(
      resolveSeasonStatsRunMode({
        runMode: "full"
      })
    ).toBe("full");
    expect(
      resolveSeasonStatsRunMode({
        fullFlag: "1"
      })
    ).toBe("full");
  });
});
