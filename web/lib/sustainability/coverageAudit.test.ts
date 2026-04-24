import { describe, expect, it } from "vitest";

import {
  summarizeCoverageAudit,
  summarizeCoverageAuditRow
} from "./coverageAudit";

describe("coverageAudit", () => {
  it("identifies missing and extra dates for one player", () => {
    const summary = summarizeCoverageAuditRow({
      playerId: 97,
      playedDates: ["2025-10-08", "2025-10-10", "2025-10-12"],
      bandDates: ["2025-10-08", "2025-10-12", "2025-10-14"]
    });

    expect(summary).toMatchObject({
      playerId: 97,
      playedGameCount: 3,
      bandDateCount: 3,
      missingDateCount: 1,
      extraDateCount: 1,
      coveragePct: 66.67,
      missingDates: ["2025-10-10"],
      extraDates: ["2025-10-14"]
    });
  });

  it("computes aggregate gap counts across players", () => {
    const summary = summarizeCoverageAudit([
      {
        playerId: 97,
        playedDates: ["2025-10-08", "2025-10-10"],
        bandDates: ["2025-10-08"]
      },
      {
        playerId: 29,
        playedDates: ["2025-10-09"],
        bandDates: ["2025-10-09"]
      }
    ]);

    expect(summary).toMatchObject({
      playersAudited: 2,
      playersWithGaps: 1,
      totalPlayedDates: 3,
      totalMissingDates: 1,
      overallCoveragePct: 66.67
    });
    expect(summary.playerSummaries[0]?.missingDates).toEqual(["2025-10-10"]);
  });
});
