import { describe, expect, it } from "vitest";
import { PROJECTION_SOURCES_CONFIG, type ProjectionSourceConfig } from "lib/projectionsConfig/projectionSourcesConfig";
import {
  buildCustomProjectionSources,
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
  it.each(["skater", "goalie"] as const)("excludes retired sources from %s fetch and blending inputs even with stale controls", (playerType) => {
    const sourceControls = Object.fromEntries(PROJECTION_SOURCES_CONFIG.map(source => [source.id, { isSelected: true, weight: 1 }]));
    sourceControls.lineupexperts_skaters = { isSelected: true, weight: 2 };
    sourceControls.lineupexperts_goalies = { isSelected: true, weight: 2 };
    const { activeSources } = buildActiveProjectionSources({ baseSources: PROJECTION_SOURCES_CONFIG, playerType, sourceControls });
    expect(activeSources.length).toBeGreaterThan(0);
    expect(activeSources.some(source => /lineupexperts/i.test(source.id + source.tableName))).toBe(false);
  });

  it("builds a stable, player-type-specific source from normalized CSV rows", () => {
    const rows = [{ player_id: 1002, Player_Name: "Fixture Center Two", Team_Abbreviation: "CCC", Position: "C", Goals: 65 }];
    const sources = buildCustomProjectionSources(
      [{ id: "custom_csv_1", label: "Fixture CSV", rows }],
      "skater",
      [{ key: "GOALS", dbColumnName: "Goals" }],
    );
    expect(sources).toEqual([expect.objectContaining({
      id: "custom_csv_1",
      playerType: "skater",
      rows,
      statMappings: [{ key: "GOALS", dbColumnName: "Goals" }],
    })]);
    expect(buildCustomProjectionSources(
      [{ id: "custom_csv_1", label: "Fixture CSV", rows }],
      "goalie",
      [{ key: "WINS_GOALIE", dbColumnName: "Wins_Goalie" }],
    )).toEqual([]);
  });

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

it("respects the explicit import player type even with mixed rows", () => {
  const entry = { id: "custom_csv_1", label: "Private", rows: [{ Position: "C" }, { Position: "G" }] };
  expect(buildCustomProjectionSources([{ ...entry, playerType: "skater" }], "goalie", [])).toEqual([]);
  expect(buildCustomProjectionSources([{ ...entry, playerType: "goalie" }], "skater", [])).toEqual([]);
  expect(buildCustomProjectionSources([{ ...entry, playerType: "both" }], "goalie", [])[0].rows).toEqual([{ Position: "G" }]);
});

it("restores legacy goalie column names and thousands separators without mutating imports", () => {
  const row = { Position: "G", Saves_Goalie: "1,579", Goals_Against_Goalie: 156, Games_Started_Goalie: 60 };
  const source = buildCustomProjectionSources([{ id: "custom_csv_1", label: "Private", rows: [row] }], "goalie", [])[0];
  expect(source.rows[0]).toMatchObject({ Saves_Goalie: 1579, Ga: 156, Games_Played: 60 });
  expect(row.Saves_Goalie).toBe("1,579");
});
