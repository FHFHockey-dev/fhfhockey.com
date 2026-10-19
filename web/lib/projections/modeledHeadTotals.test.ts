import { describe, expect, it } from "vitest";

import {
  buildSkaterModeledHeadTotals,
  hasKnownModeledHeadTotals,
  sumModeledHeads,
} from "./modeledHeadTotals";

describe("modeled-head totals", () => {
  it("sums known ES and PP heads, with PK adding nothing while unmodeled", () => {
    expect(sumModeledHeads(0.4, 0.2, 0)).toBeCloseTo(0.6, 6);
    expect(sumModeledHeads(0.4, 0.2, null)).toBeCloseTo(0.6, 6);
    expect(sumModeledHeads(0.4, 0.2)).toBeCloseTo(0.6, 6);
    // A withheld ES or PP head makes the total unknown, never a partial sum.
    expect(sumModeledHeads(0.4, null, 0)).toBeNull();
    expect(sumModeledHeads(null, 0.2, null)).toBeNull();
    expect(sumModeledHeads(undefined, 0.2)).toBeNull();
    expect(sumModeledHeads(null, null, null)).toBeNull();
  });

  it("makes every total that needs a withheld head unknown (ES 0.2, PP null)", () => {
    const totals = buildSkaterModeledHeadTotals({
      proj_goals_es: 0.2,
      proj_goals_pp: null,
      proj_goals_pk: null,
      proj_assists_es: 0.3,
      proj_assists_pp: 0.1,
      proj_assists_pk: null,
      proj_shots_es: 2,
      proj_shots_pp: 0.5,
      proj_shots_pk: null,
    });

    expect(totals.goals).toBeNull();
    expect(totals.points).toBeNull();
    expect(totals.ppPoints).toBeNull();
    expect(totals.assists).toBeCloseTo(0.4, 6);
    expect(totals.shots).toBeCloseTo(2.5, 6);
    expect(hasKnownModeledHeadTotals(totals)).toBe(false);
  });

  it("keeps a fully known row's totals unchanged", () => {
    const totals = buildSkaterModeledHeadTotals({
      proj_goals_es: 0.4,
      proj_goals_pp: 0.2,
      proj_goals_pk: 0,
      proj_assists_es: 0.5,
      proj_assists_pp: 0.1,
      proj_assists_pk: 0,
      proj_shots_es: 2.7,
      proj_shots_pp: 0.8,
      proj_shots_pk: 0,
    });

    expect(totals.goals).toBeCloseTo(0.6, 6);
    expect(totals.assists).toBeCloseTo(0.6, 6);
    expect(totals.points).toBeCloseTo(1.2, 6);
    expect(totals.ppPoints).toBeCloseTo(0.3, 6);
    expect(totals.shots).toBeCloseTo(3.5, 6);
    expect(hasKnownModeledHeadTotals(totals)).toBe(true);
  });
});
