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
});
