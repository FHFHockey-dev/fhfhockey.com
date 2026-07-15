import { describe, expect, it } from "vitest";
import {
  allocateGroupedRosterSlots,
  buildPositionPools,
  FORWARD_GROUPING_STORAGE_KEY,
  getEffectiveRosterConfig,
  groupPlayerEligibility,
  loadForwardGroupingPreference,
  normalizePlayerEligibility,
  saveForwardGroupingPreference,
  setForwardRosterTotal
} from "./forwardGrouping";

describe("grouped forward contract", () => {
  it("normalizes multi-position eligibility and collapses forwards once", () => {
    const eligibility = normalizePlayerEligibility("C,LW", ["C", "LW"]);
    expect(eligibility).toEqual(["C", "LW"]);
    expect(groupPlayerEligibility(eligibility, "fwd")).toEqual(["FWD"]);
    const pools = buildPositionPools(
      ["1"],
      new Map([["1", 10]]),
      new Map([["1", eligibility]]),
      "fwd"
    );
    expect(pools.FWD).toEqual([{ id: "1", value: 10 }]);
  });

  it("derives FWD without deleting or double-counting split roster counts", () => {
    const split = { C: 3, LW: 1, RW: 2, D: 4, G: 2, utility: 1, bench: 4 };
    expect(getEffectiveRosterConfig(split, "fwd")).toEqual({
      FWD: 6,
      D: 4,
      G: 2,
      utility: 1,
      bench: 4
    });
    expect(split).toMatchObject({ C: 3, LW: 1, RW: 2 });
  });

  it("edits a grouped total while preserving split proportions and total", () => {
    expect(setForwardRosterTotal({ C: 3, LW: 1, RW: 2 }, 9)).toEqual({
      C: 5,
      LW: 1,
      RW: 3
    });
    expect(setForwardRosterTotal({ C: 0, LW: 0, RW: 0 }, 7)).toEqual({
      C: 3,
      LW: 2,
      RW: 2
    });
  });

  it("allocates grouped forwards once, preserves D/G, and uses utility last", () => {
    const result = allocateGroupedRosterSlots({
      players: [
        { id: "f1", eligibility: ["C", "LW"] },
        { id: "f2", eligibility: ["RW"] },
        { id: "d1", eligibility: ["D"] },
        { id: "g1", eligibility: ["G"] }
      ],
      rosterConfig: { C: 1, LW: 0, RW: 0, D: 1, G: 1, utility: 1 },
      grouping: "fwd"
    });
    expect(result.assignments).toEqual({
      f1: "FWD",
      f2: "UTILITY",
      d1: "D",
      g1: "G"
    });
    expect(result.counts).toMatchObject({ FWD: 1, D: 1, G: 1, UTILITY: 1 });
  });

  it("persists only valid grouped-forward modes and safely defaults old values", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };

    expect(loadForwardGroupingPreference(storage)).toBe("split");
    saveForwardGroupingPreference(storage, "fwd");
    expect(values.get(FORWARD_GROUPING_STORAGE_KEY)).toBe("fwd");
    expect(loadForwardGroupingPreference(storage)).toBe("fwd");
    values.set(FORWARD_GROUPING_STORAGE_KEY, "legacy-combined");
    expect(loadForwardGroupingPreference(storage)).toBe("split");
  });
});
