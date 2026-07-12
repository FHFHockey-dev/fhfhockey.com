import { describe, expect, it } from "vitest";

import { buildEdgeUnavailableReason } from "pages/api/v1/db/update-nhl-edge-stats";

describe("update-nhl-edge-stats diagnostics", () => {
  it("names the failed endpoint family in unavailable reasons", () => {
    expect(buildEdgeUnavailableReason("team-zone-time-details")).toBe(
      "team-zone-time-details not available"
    );
    expect(buildEdgeUnavailableReason("goalie-save-percentage-detail")).toBe(
      "goalie-save-percentage-detail not available"
    );
  });
});
