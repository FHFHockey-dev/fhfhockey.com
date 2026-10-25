import { describe, expect, it } from "vitest";
import { rankMetric, type PoolValue } from "./ranking";

const key = "same-source:season:cutoff:own-L10:all:metric";
const coverage = { fullEligiblePopulationVerified: true, definitionKey: key };
const rows = (values: (number | null)[]): PoolValue[] => values.map((value, i) => ({ playerId: String(i), value, state: value === null ? "undefined" : "valid", definitionKey: key }));

describe("proposed all-valid competition rank and empirical midrank", () => {
  it("matches the hand-calculated [10,8,8,2] fixture", () => {
    const pool = rows([10, 8, 8, 2]);
    expect(pool.map(row => rankMetric(row.playerId, pool, coverage).rank)).toEqual([
      { ordinal: 1, population: 4, percentile: 87.5, tied: false },
      { ordinal: 2, population: 4, percentile: 50, tied: true },
      { ordinal: 2, population: 4, percentile: 50, tied: true },
      { ordinal: 4, population: 4, percentile: 12.5, tied: false },
    ]);
  });
  it("keeps observed zero and excludes a known undefined ratio", () => {
    expect(rankMetric("1", rows([8, 0, null]), coverage).rank).toEqual({ ordinal: 2, population: 2, percentile: 25, tied: false });
    expect(rankMetric("2", rows([8, 0, null]), coverage).rank).toBeNull();
  });
  it("handles all ties, one observation and no observations", () => {
    expect(rankMetric("0", rows([2, 2, 2]), coverage).rank).toEqual({ ordinal: 1, population: 3, percentile: 50, tied: true });
    expect(rankMetric("0", rows([0]), coverage).rank?.percentile).toBe(50);
    expect(rankMetric("0", [], coverage).rank).toBeNull();
  });
  it("does not manufacture ties from display rounding", () => {
    expect(rankMetric("1", rows([1.2341, 1.2342]), coverage).rank?.ordinal).toBe(1);
    expect(rankMetric("1", rows([1.2341, 1.2342]), coverage).rank?.tied).toBe(false);
  });
  it("withholds ranks for unknown coverage, missing data and incompatible pools", () => {
    expect(rankMetric("0", rows([8, 2]), { ...coverage, fullEligiblePopulationVerified: false }).rank).toBeNull();
    expect(rankMetric("0", [{ ...rows([8])[0], state: "missing" }], coverage).rank).toBeNull();
    expect(rankMetric("0", [{ ...rows([8])[0], definitionKey: "other" }], coverage).rank).toBeNull();
    expect(rankMetric("0", [rows([8])[0], rows([4])[0]], coverage).rank).toBeNull();
    expect(rankMetric("0", rows([Infinity, 2]), coverage).rank).toBeNull();
  });
});

