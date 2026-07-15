import { describe, expect, it } from "vitest";

import { deriveShortHandedAssists } from "./derivedProjectionStats";
import { STATS_MASTER_LIST } from "../projectionsConfig/statsMasterList";
import { PROJECTION_SOURCES_CONFIG } from "../projectionsConfig/projectionSourcesConfig";

describe("deriveShortHandedAssists", () => {
  it("subtracts short-handed goals from short-handed points", () => {
    expect(deriveShortHandedAssists(7, 3)).toBe(4);
    expect(deriveShortHandedAssists(3, 3)).toBe(0);
  });

  it("fails closed when either source value is unavailable", () => {
    expect(deriveShortHandedAssists(null, 2)).toBeNull();
    expect(deriveShortHandedAssists(2, undefined)).toBeNull();
    expect(deriveShortHandedAssists(Number.NaN, 1)).toBeNull();
  });

  it("clamps inconsistent source data instead of exposing negative assists", () => {
    expect(deriveShortHandedAssists(1, 2)).toBe(0);
  });

  it("registers SHA as a derived skater stat backed by paired raw inputs", () => {
    expect(
      STATS_MASTER_LIST.find((stat) => stat.key === "SH_ASSISTS"),
    ).toMatchObject({
      displayName: "SHA",
      isSkaterStat: true,
      isGoalieStat: false,
      derivedFrom: ["SH_POINTS", "SH_GOALS"],
    });

    const shortHandedSources = PROJECTION_SOURCES_CONFIG.filter((source) =>
      source.statMappings.some((mapping) => mapping.key === "SH_POINTS"),
    );
    expect(shortHandedSources.length).toBeGreaterThan(0);
    expect(
      shortHandedSources.every((source) =>
        source.statMappings.some((mapping) => mapping.key === "SH_GOALS"),
      ),
    ).toBe(true);
  });
});
