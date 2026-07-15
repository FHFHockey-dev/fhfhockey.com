import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_CSV_SESSION_KEY,
  clearCustomCsvSession,
  loadCustomCsvSession,
  saveCustomCsvSession
} from "./csvImportSession";

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

  it("migrates the v2 list and clears legacy keys", () => {
    const storage = memoryStorage({
      "draft.customCsvList.v2": JSON.stringify([entry])
    });

    expect(loadCustomCsvSession(storage)).toEqual([entry]);
    expect(storage.getItem("draft.customCsvList.v2")).toBeNull();
    expect(storage.getItem(CUSTOM_CSV_SESSION_KEY)).toBe(JSON.stringify([entry]));
  });

  it("clears current and legacy session payloads", () => {
    saveCustomCsvSession([entry]);
    window.sessionStorage.setItem("draft.customCsvList.v2", JSON.stringify([entry]));
    clearCustomCsvSession();

    expect(loadCustomCsvSession()).toEqual([]);
  });
});
