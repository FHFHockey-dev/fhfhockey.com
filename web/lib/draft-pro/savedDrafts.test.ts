import { describe, expect, it } from "vitest";

import { assertPrivateImportBounds, parseBrowserSnapshot, restoreBrowserSnapshot, serializeSavedDraft, toNormalizedPrivateImports } from "./savedDrafts";

const snapshot = {
  v: 2 as const,
  draftSettings: { teamCount: 2, rosterConfig: { C: 1, bench: 0, utility: 0 }, scoringCategories: { G: 1 }, draftOrder: ["A", "B"] },
  draftedPlayers: [], keepers: [], pickOwnerOverrides: {}, positionOverrides: {}, customTeamNames: {}, currentPick: 1, isSnakeDraft: true, myTeamId: "A",
  baselineMode: "remaining" as const, needWeightEnabled: false, needAlpha: 0.5, forwardGrouping: "split" as const, personalizeReplacement: false,
  goaliePointValues: {}, sourceControls: { custom_csv_1: { isSelected: true, weight: 1 } }, goalieSourceControls: { custom_csv_1: { isSelected: true, weight: 1 } },
  customCsvList: [{ id: "custom_csv_1", label: "My CSV", playerType: "skater" as const, headers: [{ original: "Player", standardized: "name", selected: true }], rows: [{ Player: "A" }] }],
  favorites: ["player-1"], notes: [{ id: "n1", text: "watch deployment" }], tiers: { elite: ["player-1"] },
};

describe("saved draft serialization", () => {
  it("keeps private rows out of the snapshot and restores them only when present", () => {
    const saved = serializeSavedDraft(snapshot);
    expect(JSON.stringify(saved)).not.toContain('"Player":"A"');
    const imports = toNormalizedPrivateImports(snapshot.customCsvList);
    expect(restoreBrowserSnapshot(saved, imports).customCsvList[0].playerType).toBe("skater");
    expect(restoreBrowserSnapshot(saved, imports).customCsvList[0].rows).toEqual([{ Player: "A" }]);
    expect(restoreBrowserSnapshot(saved, imports)).toMatchObject({ favorites: ["player-1"], notes: [{ id: "n1", text: "watch deployment" }], tiers: { elite: ["player-1"] } });
    expect(() => restoreBrowserSnapshot(saved, [])).toThrow("Private import data is missing");
  });

  it("round trips partial position weights while preserving other settings and legacy drafts", () => {
    const weighted = {
      ...snapshot,
      draftSettings: { ...snapshot.draftSettings, positionWeights: { D: 0.7, G: 1.2 }, categoryWeights: { GOALS: 2 } },
    };
    const saved = serializeSavedDraft(weighted);
    const restored = restoreBrowserSnapshot(saved, toNormalizedPrivateImports(weighted.customCsvList));
    expect(restored.draftSettings).toEqual(weighted.draftSettings);
    expect(restored.sourceControls).toEqual(weighted.sourceControls);
    expect(restored.goalieSourceControls).toEqual(weighted.goalieSourceControls);
    expect(restored.goaliePointValues).toEqual(weighted.goaliePointValues);

    const legacy = restoreBrowserSnapshot(serializeSavedDraft(snapshot), toNormalizedPrivateImports(snapshot.customCsvList));
    expect(legacy.draftSettings).toEqual(snapshot.draftSettings);
    expect(legacy.draftSettings).not.toHaveProperty("positionWeights");
  });

  it("rejects malformed position weights when parsing, saving, or restoring", () => {
    const imports = toNormalizedPrivateImports(snapshot.customCsvList);
    const saved = serializeSavedDraft(snapshot);
    for (const positionWeights of [null, [], { F: 1 }, { D: NaN }, { D: Infinity }, { D: -0.1 }, { G: 2.1 }, { C: "1" }]) {
      const malformed = { ...snapshot, draftSettings: { ...snapshot.draftSettings, positionWeights } };
      expect(() => parseBrowserSnapshot(malformed)).toThrow("Invalid position weights");
      expect(() => serializeSavedDraft(malformed)).toThrow("Invalid position weights");
      expect(() => restoreBrowserSnapshot({ ...saved, settings: { ...(saved.settings as object), draftSettings: malformed.draftSettings } }, imports)).toThrow();
    }
  });

  it("rejects oversized normalized import payloads", () => {
    expect(() => assertPrivateImportBounds([{ name: "x", sourceId: "custom_csv_1", mapping: [], rows: [{ data: "x".repeat(11 * 1024 * 1024) }] }])).toThrow("10 MiB");
  });

  it("does not turn missing browser import rows into an empty private import", () => {
    expect(() => toNormalizedPrivateImports([{ ...snapshot.customCsvList[0], rows: undefined }])).toThrow("rows are missing");
  });
});
