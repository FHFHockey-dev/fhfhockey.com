import { describe, expect, it } from "vitest";
import { buildProjectionFreshnessNotices } from "./projectionFreshness";

describe("projection freshness notices", () => {
  it("labels retained official data as potentially stale after refresh failure", () => {
    expect(
      buildProjectionFreshnessNotices({
        hasLoadedPlayers: true,
        hasOfficialSources: true,
        refreshFailed: true,
        customSources: [],
      })[0],
    ).toContain("may be stale");
  });

  it("uses only real custom import timestamps and reports unknown timestamps honestly", () => {
    expect(
      buildProjectionFreshnessNotices({
        hasLoadedPlayers: true,
        hasOfficialSources: false,
        refreshFailed: false,
        customSources: [
          { label: "Timed", resolution: { lastUpdated: 123 } },
          { label: "Untimed" },
        ],
        formatTimestamp: (value) => `timestamp-${value}`,
      }),
    ).toEqual([
      "Custom source Timed was imported into this tab at timestamp-123.",
      "Custom source Untimed has no verified import timestamp; freshness is unknown.",
    ]);
  });
});
