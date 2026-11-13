import { describe, expect, it } from "vitest";

import {
  allSituationCount,
  PENALTY_SHOT_SPLIT_VERSION,
  penaltyShotsBeyondStrength,
} from "./penaltyShotSplit";

// One team-game where the team scored on one penalty shot, had another saved,
// missed a third and scored in the shootout. Official totals: 2 shots of
// which 1 goal from penalty shots; the miss and the shootout goal count
// nowhere. Strength events: 20 ES shots (1 ES goal), 3 PP shots (1 PP goal).
const legacy = {
  shots: { es: 22, pp: 3, pk: 0, ps: null, splitVersion: null },
  goals: { es: 2, pp: 1, pk: 0, ps: null, splitVersion: null },
};
const split = {
  shots: { es: 20, pp: 3, pk: 0, ps: 2, splitVersion: PENALTY_SHOT_SPLIT_VERSION },
  goals: { es: 1, pp: 1, pk: 0, ps: 1, splitVersion: PENALTY_SHOT_SPLIT_VERSION },
};

describe("penalty-shot split readers (decision 149, Astra AF-07)", () => {
  it("gives the same official all-situation totals for a legacy and a split row", () => {
    expect(allSituationCount(legacy.shots)).toBe(25);
    expect(allSituationCount(split.shots)).toBe(25);
    expect(allSituationCount(legacy.goals)).toBe(3);
    expect(allSituationCount(split.goals)).toBe(3);
  });

  it("never adds a PS value to a legacy row, whose ES already holds it", () => {
    expect(allSituationCount({ ...legacy.shots, ps: 2 })).toBe(25);
    expect(penaltyShotsBeyondStrength(2, null)).toBe(0);
  });

  it("fails closed on a missing bucket, a missing split PS count or an unknown marker", () => {
    expect(allSituationCount({ ...split.shots, pp: null })).toBeNull();
    expect(allSituationCount({ ...split.shots, ps: null })).toBeNull();
    expect(allSituationCount({ ...split.shots, ps: -1 })).toBeNull();
    expect(allSituationCount({ ...split.shots, splitVersion: 2 })).toBeNull();
  });

  it("lets a lenient reader add the split row's PS and nothing else", () => {
    const lenientTotal = (row: typeof split.goals | typeof legacy.goals) =>
      row.es + row.pp + row.pk + penaltyShotsBeyondStrength(row.ps, row.splitVersion);
    expect(lenientTotal(split.goals)).toBe(3);
    expect(lenientTotal(legacy.goals)).toBe(3);
    expect(penaltyShotsBeyondStrength(null, PENALTY_SHOT_SPLIT_VERSION)).toBe(0);
    expect(penaltyShotsBeyondStrength(1, 2)).toBe(0);
  });
});
