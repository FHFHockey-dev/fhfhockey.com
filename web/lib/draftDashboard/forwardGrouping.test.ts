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

  it("reserves open eligible slots for multi-position players", () => {
    const allocation = allocateGroupedRosterSlots({
      players: [
        { id: "marner", eligibility: ["C", "RW"] },
        { id: "center", eligibility: ["C"] },
        { id: "wing", eligibility: ["RW"] },
      ],
      rosterConfig: { C: 1, LW: 0, RW: 1, D: 0, G: 0, utility: 0, bench: 1 },
      grouping: "split",
    });

    expect(allocation.assignments).toEqual({
      center: "C",
      marner: "RW",
      wing: "BENCH",
    });
  });

  it.each([
    ["dual", "center1", "center2"],
    ["dual", "center2", "center1"],
    ["center1", "dual", "center2"],
    ["center2", "dual", "center1"],
    ["center1", "center2", "dual"],
    ["center2", "center1", "dual"],
  ])("fills all starters for draft order %s, %s, %s", (...order) => {
    const allocation = allocateGroupedRosterSlots({
      players: order.map((id) => ({ id, eligibility: id === "dual" ? ["C", "RW"] : ["C"] })),
      rosterConfig: { C: 2, RW: 1, utility: 0, bench: 1 },
      grouping: "split",
    });
    expect(allocation.assignments).toEqual({ dual: "RW", center1: "C", center2: "C" });
    expect(allocation.counts).toMatchObject({ C: 2, RW: 1, BENCH: 0 });
  });

  it("preserves an explicit reservation while relocating automatic assignments", () => {
    const allocation = allocateGroupedRosterSlots({
      players: [
        { id: "dual", eligibility: ["C", "RW"] },
        { id: "center1", eligibility: ["C"] },
        { id: "center2", eligibility: ["C"] },
      ],
      rosterConfig: { C: 2, RW: 1, utility: 0, bench: 1 },
      grouping: "split",
      overrides: { center1: "C" },
    });
    expect(allocation.assignments).toEqual({ dual: "RW", center1: "C", center2: "C" });
  });

  it("follows a relocation chain through every movable occupant", () => {
    const allocation = allocateGroupedRosterSlots({
      players: [
        { id: "dual", eligibility: ["C", "RW"] },
        { id: "center1", eligibility: ["C"] },
        { id: "wing", eligibility: ["RW", "LW"] },
        { id: "center2", eligibility: ["C"] },
      ],
      rosterConfig: { C: 2, RW: 1, LW: 1, utility: 0, bench: 0 },
      grouping: "split",
    });
    expect(allocation.assignments).toEqual({ dual: "RW", center1: "C", wing: "LW", center2: "C" });
    expect(allocation.counts.BENCH).toBe(0);
  });

  it("reserves explicit utility and position choices before automatic placement", () => {
    const input = {
      players: [{ id: "auto", eligibility: ["C", "LW"] }, { id: "pinned", eligibility: ["C", "LW"] }],
      rosterConfig: { C: 1, LW: 1, G: 0, utility: 1, bench: 0 },
      grouping: "split" as const,
    };
    expect(allocateGroupedRosterSlots({ ...input, overrides: { pinned: "UTILITY" } }).assignments).toEqual({ pinned: "UTILITY", auto: "C" });
    expect(allocateGroupedRosterSlots({ ...input, overrides: { pinned: "C" } }).assignments).toEqual({ pinned: "C", auto: "LW" });
    const goalie = allocateGroupedRosterSlots({ ...input, players: [{ id: "g", eligibility: ["G"] }], rosterConfig: { G: 1, utility: 1 }, overrides: { g: "UTILITY" } });
    expect(goalie.assignments.g).toBe("G");
  });

  it("supports an exact generic-forward flex alongside split forward slots", () => {
    const rosterConfig = {
      C: 1,
      LW: 0,
      RW: 0,
      FWD: 1,
      D: 0,
      G: 0,
      utility: 0,
      bench: 0
    };
    const eligibility = groupPlayerEligibility(["C"], "split", true);
    expect(eligibility).toEqual(["C", "FWD"]);
    const pools = buildPositionPools(
      ["f1"],
      new Map([["f1", 10]]),
      new Map([["f1", eligibility]]),
      "split",
      rosterConfig
    );
    expect(pools.C).toEqual([{ id: "f1", value: 10 }]);
    expect(pools.FWD).toEqual([{ id: "f1", value: 10 }]);

    const allocation = allocateGroupedRosterSlots({
      players: [
        { id: "f1", eligibility: ["C"] },
        { id: "f2", eligibility: ["C"] }
      ],
      rosterConfig,
      grouping: "split"
    });
    expect(allocation.assignments).toEqual({ f1: "C", f2: "FWD" });
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
