import { describe, expect, it } from "vitest";
import { BLSH_STORAGE_KEY, emptyBlshState, loadBlshState, resetBlshState, saveBlshState } from "./storage";

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key), data };
};

describe("device-local state", () => {
  it("round-trips a versioned state under its own key", () => {
    const storage = memory();
    const state = { ...emptyBlshState(), watchlist: [{ playerId: "fx-f1", target: "POINTS", horizon: 10, addedAt: "2026-10-18T15:00:00.000Z", gapAtAdd: -0.15 }] };
    expect(saveBlshState(storage, state)).toBe(true);
    expect([...storage.data.keys()]).toEqual([BLSH_STORAGE_KEY]);
    expect(loadBlshState(storage)).toEqual({ state, recovered: false });
    expect(resetBlshState(storage)).toBe(true);
    expect(loadBlshState(storage)).toEqual({ state: emptyBlshState(), recovered: false });
  });

  it.each([["corrupt JSON", "{"], ["wrong version", JSON.stringify({ ...emptyBlshState(), version: 2 })], ["bad watch entry", JSON.stringify({ ...emptyBlshState(), watchlist: [{ playerId: 1 }] })]])(
    "recovers to an empty state from %s", (_, raw) => {
      const storage = memory();
      storage.setItem(BLSH_STORAGE_KEY, raw);
      expect(loadBlshState(storage)).toEqual({ state: emptyBlshState(), recovered: true });
    });

  it("never throws when storage is unavailable or blocked", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(loadBlshState(blocked).recovered).toBe(true);
    expect(saveBlshState(blocked, emptyBlshState())).toBe(false);
    expect(resetBlshState(blocked)).toBe(false);
    expect(loadBlshState(null)).toEqual({ state: emptyBlshState(), recovered: false });
  });
});
