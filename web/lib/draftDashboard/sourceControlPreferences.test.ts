import { describe, expect, it } from "vitest";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";
import {
  LEGACY_SOURCE_CONTROL_KEYS,
  SOURCE_CONTROL_PREFERENCES_KEY,
  createDefaultSourceControls,
  loadSourceControlPreferences,
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
  it("defaults every official source to selected with scalar weight 1", () => {
    const loaded = loadSourceControlPreferences(defaults, memoryStorage());
    expect(Object.keys(loaded.skater).length).toBeGreaterThan(0);
    expect(Object.values(loaded.skater)).toEqual(
      expect.arrayContaining([{ isSelected: true, weight: 1 }])
    );
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
});
