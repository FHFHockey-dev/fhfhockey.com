import { describe, expect, it } from "vitest";

import { buildDraftConfigurationSummary } from "./summaryConfiguration";

describe("draft summary configuration", () => {
  it("captures source state and custom metadata without retaining CSV contents", () => {
    const summary = buildDraftConfigurationSummary({
      projectionSources: [
        {
          id: "official_skaters",
          displayName: "Official",
          playerType: "skater",
        },
      ],
      sourceControls: {
        official_skaters: { isSelected: true, weight: 1.25 },
        custom_csv_1: { isSelected: false, weight: 0.4 },
      },
      goalieSourceControls: {
        custom_csv_1: { isSelected: true, weight: 0.7 },
      },
      customCsvEntries: [
        {
          id: "custom_csv_1",
          label: "Private rankings",
          headers: [
            { original: "secret", standardized: "PLAYER_NAME", selected: true },
          ],
          rows: [{ secret: "do-not-export" }],
          resolution: {
            totalRows: 2,
            idMatched: 1,
            nameMatched: 1,
            unresolved: 0,
            coverage: 1,
            lastUpdated: 1,
            unresolvedNames: [],
          },
        },
      ],
      forwardGrouping: "fwd",
      baselineMode: "remaining",
      personalizeReplacement: true,
      needWeightEnabled: true,
      needAlpha: 0.35,
    });

    expect(summary.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "official_skaters",
          enabled: true,
          weight: 1.25,
        }),
        expect.objectContaining({
          id: "custom_csv_1",
          playerType: "goalie",
          enabled: true,
          weight: 0.7,
        }),
      ]),
    );
    expect(summary.customSources).toEqual([
      {
        id: "custom_csv_1",
        label: "Private rankings",
        totalRows: 2,
        coverage: 1,
      },
    ]);
    expect(JSON.stringify(summary)).not.toContain("do-not-export");
    expect(JSON.stringify(summary)).not.toContain("secret");
  });
});
