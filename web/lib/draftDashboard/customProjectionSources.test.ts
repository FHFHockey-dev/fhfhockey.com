import { describe, expect, it } from "vitest";
import type { ProjectionSourceConfig } from "lib/projectionsConfig/projectionSourcesConfig";
import {
  buildActiveProjectionSources,
  buildProjectionInputCacheKey,
  type CustomAdditionalProjectionSource
} from "./customProjectionSources";

const official: ProjectionSourceConfig = {
  id: "official_skater",
  displayName: "Official",
  tableName: "official_table",
  playerType: "skater",
  primaryPlayerIdKey: "player_id",
  originalPlayerNameKey: "Player_Name",
  statMappings: []
};

function custom(
  id: string,
  playerType: "skater" | "goalie" = "skater"
): CustomAdditionalProjectionSource {
  return {
    id,
    displayName: id,
    playerType,
    rows: [{ player_id: 8478427, Goals: 30 }],
    primaryPlayerIdKey: "player_id",
    originalPlayerNameKey: "Player_Name",
    statMappings: [{ key: "GOALS", dbColumnName: "Goals" }]
  };
}

describe("custom projection-source registration", () => {
  it("registers a selected custom CSV beside selected official sources", () => {
    const source = custom("custom_csv_1");
    const result = buildActiveProjectionSources({
      baseSources: [official],
      playerType: "skater",
      sourceControls: {
        official_skater: { isSelected: true, weight: 1 },
        custom_csv_1: { isSelected: true, weight: 0.8 }
      },
      customSources: [source]
    });

    expect(result.activeSources.map((item) => item.id)).toEqual([
      "official_skater",
      "custom_csv_1"
    ]);
    expect(result.activeSources[1].tableName).toBe("__custom_session__");
    expect(result.customById.get("custom_csv_1")?.rows).toBe(source.rows);
  });

  it("keeps disabled, wrong-player-type, and non-CSV session sources inactive", () => {
    const result = buildActiveProjectionSources({
      baseSources: [official],
      playerType: "skater",
      sourceControls: {
        official_skater: { isSelected: false, weight: 1 },
        custom_csv_1: { isSelected: false, weight: 1 },
        custom_csv_2: { isSelected: true, weight: 1 },
        arbitrary_memory: { isSelected: true, weight: 1 }
      },
      customSources: [
        custom("custom_csv_1"),
        custom("custom_csv_2", "goalie"),
        custom("arbitrary_memory")
      ]
    });

    expect(result.activeSources).toEqual([]);
    expect(result.customById.has("arbitrary_memory")).toBe(false);
  });

  it("keys raw inputs by membership/data identity rather than scalar weights", () => {
    const base = {
      playerType: "skater" as const,
      activeSources: [official],
      season: "20252026",
      customFingerprint: "none"
    };
    const key = buildProjectionInputCacheKey(base);

    expect(buildProjectionInputCacheKey(base)).toBe(key);
    expect(buildProjectionInputCacheKey({ ...base, refreshKey: 1 })).not.toBe(key);
    expect(
      buildProjectionInputCacheKey({
        ...base,
        activeSources: [official, { ...official, id: "second" }]
      })
    ).not.toBe(key);
  });

  it("removes an imported source when its session entry is absent", () => {
    const controls = {
      official_skater: { isSelected: true, weight: 1 },
      custom_csv_1: { isSelected: true, weight: 1 }
    };
    const withImport = buildActiveProjectionSources({
      baseSources: [official],
      playerType: "skater",
      sourceControls: controls,
      customSources: [custom("custom_csv_1")]
    });
    const afterRemoval = buildActiveProjectionSources({
      baseSources: [official],
      playerType: "skater",
      sourceControls: controls,
      customSources: []
    });

    expect(withImport.activeSources.map((source) => source.id)).toContain(
      "custom_csv_1"
    );
    expect(afterRemoval.activeSources.map((source) => source.id)).not.toContain(
      "custom_csv_1"
    );
  });
});
