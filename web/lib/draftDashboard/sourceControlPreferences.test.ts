import { describe, expect, it } from "vitest";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";
import {
  LEGACY_SOURCE_CONTROL_KEYS,
  SOURCE_CONTROL_PREFERENCES_KEY,
  createDefaultSourceControls,
  loadSourceControlPreferences,
  sanitizeControls,
  saveSourceControlPreferences
} from "./sourceControlPreferences";

function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
}

const defaults = {
  skater: createDefaultSourceControls(PROJECTION_SOURCES_CONFIG, "skater"),
  goalie: createDefaultSourceControls(PROJECTION_SOURCES_CONFIG, "goalie")
};

describe("source-control preferences", () => {
  it("defaults to public independent sources without double-weighting A&G", () => {
    const loaded = loadSourceControlPreferences(defaults, memoryStorage());
    expect(Object.keys(loaded.skater).length).toBeGreaterThan(0);
    expect(Object.values(loaded.skater)).toEqual(
      expect.arrayContaining([{ isSelected: true, weight: 1 }])
    );
    expect(loaded.skater.ag_skaters.isSelected).toBe(true);
    expect(loaded.skater.blake_ag_skaters.isSelected).toBe(false);
    expect(loaded.skater.nate_ag_skaters.isSelected).toBe(false);
    expect(Object.values(loaded.skater).filter((s) => s.isSelected)).toHaveLength(4);
    expect(Object.values(loaded.goalie).filter((s) => s.isSelected)).toHaveLength(3);
    expect(PROJECTION_SOURCES_CONFIG).toHaveLength(9);
    for (const source of PROJECTION_SOURCES_CONFIG) {
      expect(source.tableName).toMatch(/^PROJECTIONS_20262027_/);
      expect(source.id).not.toMatch(/dom_|dobber_|master|cullen|dfo|fhfh|kubota|laidlaw/);
    }
  });

  it("persists only known official IDs and clamps the scalar domain", () => {
    const storage = memoryStorage();
    const firstSkaterId = Object.keys(defaults.skater)[0];
    saveSourceControlPreferences(
      {
        version: 4,
        skater: {
          ...defaults.skater,
          [firstSkaterId]: { isSelected: true, weight: 4 },
          custom_csv_1: { isSelected: true, weight: 0.7 }
        },
        goalie: defaults.goalie
      },
      defaults,
      storage
    );

    const persisted = JSON.parse(storage.getItem(SOURCE_CONTROL_PREFERENCES_KEY)!);
    expect(persisted.skater[firstSkaterId].weight).toBe(2);
    expect(persisted.skater.custom_csv_1).toBeUndefined();
  });

  it("migrates percent-style v3 weights while preserving effective shares", () => {
    const [first, second] = Object.keys(defaults.skater);
    const storage = memoryStorage({
      [LEGACY_SOURCE_CONTROL_KEYS[0]]: JSON.stringify([
        { id: first, enabled: true, weight: 75 },
        { id: second, enabled: true, weight: 25 },
        { id: "custom_csv_1", enabled: true, weight: 50 }
      ])
    });
    const loaded = loadSourceControlPreferences(defaults, storage);

    expect(loaded.skater[first].weight).toBe(0.5);
    expect(loaded.skater[second].weight).toBeCloseTo(1 / 6, 3);
    expect(loaded.skater.custom_csv_1).toBeUndefined();
    expect(storage.getItem(LEGACY_SOURCE_CONTROL_KEYS[0])).toBeNull();
  });

  it("fails invalid payloads back to official defaults", () => {
    const loaded = loadSourceControlPreferences(
      defaults,
      memoryStorage({ [SOURCE_CONTROL_PREFERENCES_KEY]: "not-json" })
    );
    expect(loaded.skater).toEqual(defaults.skater);
    expect(loaded.goalie).toEqual(defaults.goalie);
  });

  it("drops retired and paid sources from restored snapshots while keeping known custom uploads", () => {
    const restored = sanitizeControls(defaults.skater, {
      cullen_skaters: { isSelected: true, weight: 1 },
      dom_skaters: { isSelected: true, weight: 1 },
      dobber_skaters: { isSelected: true, weight: 1 },
      custom_csv_1: { isSelected: true, weight: 0.5 },
      unknown_custom: { isSelected: true, weight: 1 },
    }, ["custom_csv_1"]);
    expect(restored).toEqual({
      ...defaults.skater,
      custom_csv_1: { isSelected: true, weight: 0.5 },
    });
  });
});
