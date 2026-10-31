import { describe, expect, it } from "vitest";
import { bsh, competitionRanks, lastN, ownershipInRange, ownershipLabel, ownershipOf, per60, pooledGaa, pooledSavePct, previousN, strictlyAbove, versusSeason } from "./definitions";

describe("shared definitions", () => {
  it("keeps 0% ownership known and unknown separate", () => {
    expect(ownershipOf(0, "2026-10-31")).toEqual({ state: "known", pct: 0, asOf: "2026-10-31" });
    for (const value of [null, undefined, NaN, -1, 101]) expect(ownershipOf(value).state).toBe("unknown");
    expect(ownershipLabel(ownershipOf(0))).toBe("0%");
    expect(ownershipLabel(ownershipOf(null))).toBe("—");
    expect(ownershipInRange(ownershipOf(0), 0, 50)).toBe(true);
    expect(ownershipInRange(ownershipOf(null), 0, 50)).toBe(false);
    expect(ownershipInRange(ownershipOf(null), 0, 50, true)).toBe(true);
  });
  it("windows disclose short samples and never share games", () => {
    const games = [1, 2, 3, 4, 5, 6, 7];
    expect(lastN(games, 5)).toMatchObject({ rows: [3, 4, 5, 6, 7], actual: 5, short: false });
    expect(previousN(games, 5, 5)).toMatchObject({ rows: [1, 2], requested: 5, actual: 2, short: true });
    expect(lastN([1, 2], 5).short).toBe(true);
    const versus = versusSeason(games, 5);
    expect(versus.overlap).toBe(5);
    expect(versus.season.actual).toBe(7);
    expect(versus.seasonExcludingRecent.rows).toEqual([1, 2]);
  });
  it("strict thresholds fail at exactly X and missing is neither", () => {
    expect(strictlyAbove(3, 2)).toBe(true);
    expect(strictlyAbove(2, 2)).toBe(false);
    expect(strictlyAbove(0, 0)).toBe(false);
    expect(strictlyAbove(null, 2)).toBeNull();
  });
  it("BSH needs all three components, and a real zero counts", () => {
    expect(bsh({ blocks: 1, shots: 2, hits: 3 })).toBe(6);
    expect(bsh({ blocks: 0, shots: 0, hits: 0 })).toBe(0);
    expect(bsh({ blocks: null, shots: 2, hits: 3 })).toBeNull();
  });
  it("pools rates from parts and refuses empty denominators", () => {
    expect(pooledSavePct(27 + 9, 30 + 10)).toBe(0.9);
    expect(pooledSavePct(0, 0)).toBeNull();
    expect(pooledSavePct(11, 10)).toBeNull();
    expect(pooledGaa(2, 3600)).toBe(2);
    expect(pooledGaa(0, 3600)).toBe(0);
    expect(pooledGaa(1, 0)).toBeNull();
    expect(per60(3, 1800)).toBe(6);
    expect(per60(null, 1800)).toBeNull();
  });
  it("ties share a rank and unknown values get none", () => {
    const rows = [{ id: 3, v: 5 }, { id: 1, v: 9 }, { id: 2, v: 5 }, { id: 4, v: null }, { id: 5, v: 1 }];
    expect(competitionRanks(rows, row => row.v, row => row.id).map(item => [item.row.id, item.rank])).toEqual([[1, 1], [2, 2], [3, 2], [5, 4]]);
    expect(competitionRanks(rows, row => row.v, row => row.id, "low")[0].row.id).toBe(5);
  });
});
