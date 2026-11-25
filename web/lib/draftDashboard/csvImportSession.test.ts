import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_CSV_SESSION_KEY,
  clearCustomCsvSession,
  createCustomCsvId,
  loadCustomCsvSession,
  loadCustomCsvSessionResult,
  saveCustomCsvSession
} from "./csvImportSession";
import { persistRecoveredDraft, recoverCustomCsvEntries } from "./recovery";

function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
}

const entry = {
  id: "custom_csv_1",
  label: "My projections",
  rows: [{ Player_Name: "Sebastian Aho" }]
};

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("custom CSV session storage", () => {
  it("persists only to the supplied tab-scoped session store", () => {
    const localWrite = vi.spyOn(window.localStorage, "setItem");
    saveCustomCsvSession([entry]);

    expect(loadCustomCsvSession()).toEqual([entry]);
    expect(window.sessionStorage.getItem(CUSTOM_CSV_SESSION_KEY)).toContain(
      "Sebastian Aho"
    );
    expect(localWrite).not.toHaveBeenCalled();
  });

  it("does not leak entries into a separate tab session", () => {
    const tabA = memoryStorage();
    const tabB = memoryStorage();
    saveCustomCsvSession([entry], tabA);

    expect(loadCustomCsvSession(tabA)).toEqual([entry]);
    expect(loadCustomCsvSession(tabB)).toEqual([]);
  });

  it("does not attach an unrelated new import to a retained bookmark", () => {
    const originalId = createCustomCsvId([], () => "first-source");
    const bookmark = { customSourceMetadata: [{ id: originalId, label: "Original" }] };

    const replacementId = createCustomCsvId([], () => "replacement-source");
    const replacement = { ...entry, id: replacementId };
    expect(recoverCustomCsvEntries(bookmark, [replacement])).toEqual([
      { id: originalId, label: "Original", playerType: "skater", rows: [] },
    ]);

    const randomId = vi.fn()
      .mockReturnValueOnce("replacement-source")
      .mockReturnValueOnce("third-source");
    expect(createCustomCsvId([replacement], randomId)).toBe("custom_csv_third-source");
  });

  it("migrates the v2 list and clears legacy keys", () => {
    const storage = memoryStorage({
      "draft.customCsvList.v2": JSON.stringify([entry])
    });

    expect(loadCustomCsvSession(storage)).toEqual([entry]);
    expect(storage.getItem("draft.customCsvList.v2")).toBeNull();
    expect(storage.getItem(CUSTOM_CSV_SESSION_KEY)).toBe(JSON.stringify([entry]));
  });

  it.each([CUSTOM_CSV_SESSION_KEY, "draft.customCsvList.v2"])(
    "preserves a conflicting %s without importing or migrating either row set",
    (key) => {
      const raw = JSON.stringify([entry, { ...entry, label: "Conflicting source" }]);
      const previous = JSON.stringify({ v: 2, currentPick: 2 });
      const storage = memoryStorage({
        [key]: raw,
        "draft.customCsv.v1": "older single import",
        "draft.snapshot.v2": previous,
      });

      expect(loadCustomCsvSessionResult(storage)).toEqual({ duplicateId: entry.id });
      expect(storage.getItem(key)).toBe(raw);
      expect(storage.getItem("draft.customCsv.v1")).toBe("older single import");

      expect(() => saveCustomCsvSession([entry, entry], storage)).toThrow(entry.id);
      expect(persistRecoveredDraft([entry, entry], "replacement snapshot", storage)).toBe(false);
      expect(storage.getItem(key)).toBe(raw);
      expect(storage.getItem(CUSTOM_CSV_SESSION_KEY)).toBe(key === CUSTOM_CSV_SESSION_KEY ? raw : null);
      expect(storage.getItem("draft.snapshot.v2")).toBe(previous);
    },
  );

  it("clears current and legacy session payloads", () => {
    saveCustomCsvSession([entry]);
    window.sessionStorage.setItem("draft.customCsvList.v2", JSON.stringify([entry]));
    clearCustomCsvSession();

    expect(loadCustomCsvSession()).toEqual([]);
  });
});
