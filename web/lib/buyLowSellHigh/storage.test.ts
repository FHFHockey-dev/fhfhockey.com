import { describe, expect, it } from "vitest";
import { BLSH_FIXTURE_STORAGE_KEY, BLSH_STORAGE_KEY, LEGACY_BLSH_STORAGE_KEY, emptyBlshState, loadBlshState,
  resetBlshState, saveBlshState, updateBlshState } from "./storage";
const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), data };
};
const watch = { kind: "research_identity" as const, playerId: "8478402", addedAt: "2026-11-07T15:00:00.000Z" };
const legacyWatch = { playerId: "old-id", target: "POINTS", horizon: 10, addedAt: "2026-10-18T15:00:00.000Z", gapAtAdd: -0.15 };
const reference = { source: "Entered reference", kind: "manager_entered" as const, capturedAt: "2026-11-01T12:00:00Z",
  horizonGames: 10, scoringBasis: "points:custom", unit: "fantasy_points" as const, value: 17, note: "Preserve" };
describe("device-local state", () => {
  it("round-trips versioned identities/selections/references without touching RSO", () => {
    const storage = memory(), state = { ...emptyBlshState(), watchlist: [watch], draft: { give: ["missing-id"], receive: ["8478402"] }, marketReferences: { id: reference } };
    storage.setItem("rso-workspace", "leave alone");
    expect(saveBlshState(storage, state)).toBe(true);
    expect(loadBlshState(storage)).toEqual({ state, status: "ready", present: true });
    expect(resetBlshState(storage)).toBe(true);
    expect(loadBlshState(storage).state).toEqual(emptyBlshState());
    expect(storage.getItem("rso-workspace")).toBe("leave alone");
  });
  it("reads v1 without writes, migrates on explicit mutation, and never resurrects cleared entries after reset/reload", () => {
    const storage = memory(), legacy = { version: 1, watchlist: [legacyWatch], draft: { give: ["older-id"], receive: [] }, marketReferences: { id: reference } };
    const raw = JSON.stringify(legacy);
    storage.setItem(LEGACY_BLSH_STORAGE_KEY, raw);
    expect(loadBlshState(storage).state).toEqual({ ...legacy, version: 2 });
    expect(storage.getItem(BLSH_STORAGE_KEY)).toBeNull();
    expect(updateBlshState(storage, current => ({ ...current, watchlist: [...current.watchlist, watch] })).saved).toBe(true);
    expect(loadBlshState(storage).state).toEqual({ ...legacy, version: 2, watchlist: [legacyWatch, watch] });
    updateBlshState(storage, current => ({ ...current, watchlist: [] }));
    expect(loadBlshState(storage).state.watchlist).toEqual([]);
    expect(loadBlshState(storage).state.draft).toEqual(legacy.draft);
    expect(resetBlshState(storage)).toBe(true);
    expect(loadBlshState(storage).state).toEqual(emptyBlshState());
    expect(storage.getItem(BLSH_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem(LEGACY_BLSH_STORAGE_KEY)).toBe(raw);
  });
  it.each([
    ["corrupt JSON", "{"], ["empty string", ""], ["wrong version", JSON.stringify({ ...emptyBlshState(), version: 3 })],
    ["bad watch entry", JSON.stringify({ ...emptyBlshState(), watchlist: [{ playerId: 1 }] })],
    ["invalid timestamp", JSON.stringify({ ...emptyBlshState(), watchlist: [{ ...watch, addedAt: "yesterday" }] })],
    ["overloaded research semantics", JSON.stringify({ ...emptyBlshState(), watchlist: [{ ...watch, gapAtAdd: 4 }] })],
    ["invalid market reference", JSON.stringify({ ...emptyBlshState(), marketReferences: { id: { value: "wrong" } } })],
    ["invalid draft", JSON.stringify({ ...emptyBlshState(), draft: { give: [null], receive: [] } })],
  ])("leaves %s untouched on reads and attempted mutations/resets", (_, raw) => {
    const storage = memory(); storage.setItem(BLSH_STORAGE_KEY, raw);
    expect(loadBlshState(storage).status).toBe("invalid");
    expect(updateBlshState(storage, () => emptyBlshState()).saved).toBe(false);
    expect(resetBlshState(storage)).toBe(false);
    expect(storage.getItem(BLSH_STORAGE_KEY)).toBe(raw);
  });
  it("does not bypass invalid current data using valid legacy data", () => {
    const storage = memory(); storage.setItem(BLSH_STORAGE_KEY, "{");
    storage.setItem(LEGACY_BLSH_STORAGE_KEY, JSON.stringify({ ...emptyBlshState(), version: 1 }));
    expect(loadBlshState(storage).status).toBe("invalid");
  });
  it("merges latest unrelated sections and rejects conflicting draft edits", () => {
    const storage = memory(); saveBlshState(storage, { ...emptyBlshState(), marketReferences: { id: reference } });
    updateBlshState(storage, current => ({ ...current, draft: { give: ["missing"], receive: ["other"] } }));
    updateBlshState(storage, current => ({ ...current, watchlist: [watch] }));
    expect(loadBlshState(storage).state).toEqual({ version: 2, watchlist: [watch], draft: { give: ["missing"], receive: ["other"] }, marketReferences: { id: reference } });
    const before = storage.getItem(BLSH_STORAGE_KEY);
    expect(updateBlshState(storage, () => null).failure).toBe("conflict");
    expect(storage.getItem(BLSH_STORAGE_KEY)).toBe(before);
    updateBlshState(storage, current => ({ ...current, watchlist: [] }));
    expect(loadBlshState(storage).state.draft.give).toEqual(["missing"]);
    updateBlshState(storage, current => ({ ...current, draft: { give: [], receive: [] } }));
    expect(loadBlshState(storage).state.marketReferences).toEqual({ id: reference });
  });
  it("isolates fixture data from both real and legacy drafts", () => {
    const storage = memory(), real = { ...emptyBlshState(), draft: { give: ["real"], receive: [] } };
    saveBlshState(storage, real); storage.setItem(LEGACY_BLSH_STORAGE_KEY, JSON.stringify({ ...real, version: 1 }));
    expect(loadBlshState(storage, BLSH_FIXTURE_STORAGE_KEY).present).toBe(false);
    updateBlshState(storage, current => ({ ...current, draft: { give: ["fx-f1"], receive: [] } }), BLSH_FIXTURE_STORAGE_KEY);
    expect(loadBlshState(storage).state).toEqual(real);
    expect(loadBlshState(storage, BLSH_FIXTURE_STORAGE_KEY).state.draft.give).toEqual(["fx-f1"]);
  });
  it("never throws or claims saving success for absent, blocked or full storage", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadBlshState(blocked).status).toBe("blocked");
    expect(saveBlshState(blocked, emptyBlshState())).toBe(false);
    expect(resetBlshState(blocked)).toBe(false);
    expect(loadBlshState(null).status).toBe("blocked");
    expect(saveBlshState(null, emptyBlshState())).toBe(false);
    const storage = memory(); saveBlshState(storage, { ...emptyBlshState(), watchlist: [watch] });
    const before = storage.getItem(BLSH_STORAGE_KEY), full = { ...storage, setItem: () => { throw new Error("quota"); } };
    expect(updateBlshState(full, () => emptyBlshState()).failure).toBe("write_failed");
    expect(storage.getItem(BLSH_STORAGE_KEY)).toBe(before);
  });
});
