import { describe, expect, it } from "vitest";

import { ROLLING_ROW_SELECT_CLAUSE } from "./skater-queries";

describe("fetchRollingRows compatibility select clause", () => {
  it("includes both canonical and legacy fallback columns for promised /60 consumers", () => {
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("sog_per_60_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("sog_per_60_all");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("sog_per_60_avg_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("sog_per_60_avg_all");

    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("hits_per_60_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("hits_per_60_all");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("hits_per_60_avg_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("hits_per_60_avg_all");

    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("blocks_per_60_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("blocks_per_60_all");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("blocks_per_60_avg_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("blocks_per_60_avg_all");
  });

  it("keeps weighted-rate fields canonical-first while leaving TOI and additive totals on their authoritative legacy surfaces", () => {
    expect(ROLLING_ROW_SELECT_CLAUSE.indexOf("sog_per_60_last5")).toBeLessThan(
      ROLLING_ROW_SELECT_CLAUSE.indexOf("sog_per_60_avg_last5")
    );
    expect(ROLLING_ROW_SELECT_CLAUSE.indexOf("hits_per_60_last5")).toBeLessThan(
      ROLLING_ROW_SELECT_CLAUSE.indexOf("hits_per_60_avg_last5")
    );
    expect(ROLLING_ROW_SELECT_CLAUSE.indexOf("blocks_per_60_last5")).toBeLessThan(
      ROLLING_ROW_SELECT_CLAUSE.indexOf("blocks_per_60_avg_last5")
    );

    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("toi_seconds_avg_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("toi_seconds_avg_all");
    expect(ROLLING_ROW_SELECT_CLAUSE).not.toContain("toi_seconds_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).not.toContain("toi_seconds_all");

    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("goals_total_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("shots_total_last5");
    expect(ROLLING_ROW_SELECT_CLAUSE).toContain("assists_total_last5");
  });
});
