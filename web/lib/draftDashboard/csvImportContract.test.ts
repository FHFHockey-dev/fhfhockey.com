import { describe, expect, it } from "vitest";

import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";
import { standardizeColumnName } from "lib/standardization/columnStandardization";
import {
  CSV_IDENTITY_COLUMNS,
  getRequiredCsvColumns,
  MINIMUM_GOALIE_CSV_STATS,
  MINIMUM_SKATER_CSV_STATS
} from "./csvImportContract";

describe("CSV import minimum projection contract", () => {
  it.each([
    ["skater", MINIMUM_SKATER_CSV_STATS],
    ["goalie", MINIMUM_GOALIE_CSV_STATS]
  ] as const)(
    "keeps the %s baseline within every official source's supported stat intersection",
    (playerType, requiredStats) => {
      const configs = PROJECTION_SOURCES_CONFIG.filter(
        (source) => source.playerType === playerType
      );
      expect(configs.length).toBeGreaterThan(0);

      for (const config of configs) {
        const supportedKeys = new Set(
          config.statMappings.map((mapping) => mapping.key)
        );
        for (const stat of requiredStats) {
          expect(supportedKeys.has(stat.key), `${config.id} lacks ${stat.key}`).toBe(
            true
          );
        }
      }
    }
  );

  it("requires identity columns plus the canonical source intersection", () => {
    expect(getRequiredCsvColumns("skater")).toEqual([
      ...CSV_IDENTITY_COLUMNS,
      ...MINIMUM_SKATER_CSV_STATS.map((stat) => stat.column)
    ]);
    expect(getRequiredCsvColumns("goalie")).toEqual([
      ...CSV_IDENTITY_COLUMNS,
      ...MINIMUM_GOALIE_CSV_STATS.map((stat) => stat.column)
    ]);
  });

  it("normalizes common source headers into the required canonical columns", () => {
    expect(
      [
        "Player Name",
        "team",
        "pos",
        "gp",
        "g",
        "a",
        "pts",
        "ppp",
        "sog",
        "hits",
        "blocks"
      ].map((header) => standardizeColumnName(header))
    ).toEqual(getRequiredCsvColumns("skater"));
  });
});
