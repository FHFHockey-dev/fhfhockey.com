import { describe, expect, it } from "vitest";

import {
  getNstTouchLevel,
  isDirectNstJob
} from "lib/cron/nstClassification";

describe("nstClassification", () => {
  it("classifies direct and indirect NST jobs", () => {
    expect(getNstTouchLevel("update-nst-gamelog")).toBe(
      "direct_remote_nst_fetch"
    );
    expect(getNstTouchLevel("update-nst-player-reports")).toBe(
      "direct_remote_nst_fetch"
    );
    expect(getNstTouchLevel("check-missing-goalie-data")).toBe(
      "direct_remote_nst_fetch"
    );
    expect(getNstTouchLevel("rebuild-sustainability-score")).toBe(
      "indirect_nst_derived"
    );
    expect(isDirectNstJob("update-nst-team-daily")).toBe(true);
  });

  it("classifies unknown and non-NST jobs", () => {
    expect(getNstTouchLevel("update-shift-charts")).toBe("nst_touch_unknown");
    expect(getNstTouchLevel("update-games")).toBe("no_nst_touch_observed");
  });
});
