import { describe, expect, it } from "vitest";
import { toRankMaps } from "./metricRanks";

describe("metric color ranks", () => {
  it("keeps reordered ties equal and all-equal samples neutral", () => {
    const entries = Array.from({ length: 32 }, (_, i) => ({ teamId: i, value: 3 }));
    expect(toRankMaps(entries, "asc")).toEqual({ best: new Map(), worst: new Map() });
    const tied = [{ teamId: 1, value: 1 }, { teamId: 2, value: 1 }, { teamId: 3, value: 9 }, { teamId: 4, value: 9 }];
    const ranks = toRankMaps(tied, "asc");
    expect(toRankMaps([...tied].reverse(), "asc")).toEqual(ranks);
    expect(ranks.best.get(1)).toBe(ranks.best.get(2));
    expect(ranks.worst.get(3)).toBe(ranks.worst.get(4));
  });
  it("gives the worst observation the strongest bad rank in either direction", () => {
    const entries = Array.from({ length: 32 }, (_, i) => ({ teamId: i + 1, value: i + 1 }));
    expect(toRankMaps(entries, "asc").worst.get(32)).toBe(1);
    expect(toRankMaps(entries, "asc").worst.get(23)).toBe(10);
    expect(toRankMaps(entries, "desc").worst.get(1)).toBe(1);
  });
  it("keeps small samples disjoint and ignores nonfinite values", () => {
    const ranks = toRankMaps([{ teamId: 1, value: 1 }, { teamId: 2, value: 2 }, { teamId: 3, value: 3 }, { teamId: 4, value: NaN }], "asc");
    expect([...ranks.best]).toEqual([[1, 1]]);
    expect([...ranks.worst]).toEqual([[3, 1]]);
    expect(toRankMaps([{ teamId: 1, value: 1 }], "asc").best.size).toBe(0);
  });
});
