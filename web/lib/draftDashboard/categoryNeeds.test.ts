import { describe, expect, it } from "vitest";

import { categoryNeedPressures } from "./categoryNeeds";

describe("category need pressures (audit W2-5 D5)", () => {
  const teams = [
    { teamId: "me", totals: { GOALS: 20, HITS: 100, GOALS_AGAINST_AVERAGE: 3.0 } },
    { teamId: "b", totals: { GOALS: 30, HITS: 140, GOALS_AGAINST_AVERAGE: 2.5 } },
    { teamId: "c", totals: { GOALS: 40, HITS: 180, GOALS_AGAINST_AVERAGE: 2.0 } },
  ];

  it("is unitless: doubling the units of hits does not change the need", () => {
    const base = categoryNeedPressures(teams, "me", { GOALS: 1, HITS: 1 });
    const doubled = categoryNeedPressures(
      teams.map((team) => ({ ...team, totals: { ...team.totals, HITS: team.totals.HITS * 2 } })),
      "me",
      { GOALS: 1, HITS: 1 },
    );
    expect(doubled.HITS).toBeCloseTo(base.HITS, 12);
    expect(base.GOALS).toBeCloseTo(1, 12);
  });

  it("covers every enabled category in its direction and omits unknown totals", () => {
    const needs = categoryNeedPressures(
      [...teams.slice(0, 2), { teamId: "c", totals: { GOALS: 40, HITS: null, GOALS_AGAINST_AVERAGE: 2.0 } }],
      "me",
      { GOALS: 1, HITS: 1, GOALS_AGAINST_AVERAGE: 1 },
    );
    expect(needs.GOALS_AGAINST_AVERAGE).toBeCloseTo(1, 12);
    expect("HITS" in needs).toBe(false);
  });
});
