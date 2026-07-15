import { describe, expect, it } from "vitest";
import { recalculateFantasyPoints } from "./fantasyPointRecalculation";

const player = {
  playerId: 1,
  fullName: "Test Player",
  displayTeam: "CAR",
  displayPosition: "C",
  combinedStats: {
    GAMES_PLAYED: { projected: 10, actual: 5 },
    GOALS: { projected: 4, actual: 1 },
    ASSISTS: { projected: 6, actual: null }
  },
  fantasyPoints: {
    projected: 0,
    actual: 0,
    diffPercentage: 0,
    projectedPerGame: 0,
    actualPerGame: 0
  }
} as any;

describe("cached fantasy-point recalculation", () => {
  it("recalculates totals, per-game values, and differences from combined stats", () => {
    const [result] = recalculateFantasyPoints([player], {
      GOALS: 2,
      ASSISTS: 1
    });
    expect(result.fantasyPoints).toEqual({
      projected: 14,
      actual: 2,
      diffPercentage: ((2 - 14) / 14) * 100,
      projectedPerGame: 1.4,
      actualPerGame: 0.4
    });
  });

  it("does not fabricate actual zero when only projected data exists", () => {
    const [result] = recalculateFantasyPoints(
      [{ ...player, combinedStats: { GOALS: { projected: 4, actual: null } } }],
      { GOALS: 2 }
    );
    expect(result.fantasyPoints.projected).toBe(8);
    expect(result.fantasyPoints.actual).toBeNull();
    expect(result.fantasyPoints.diffPercentage).toBeNull();
  });

  it("changes cached scores when scoring settings change", () => {
    const first = recalculateFantasyPoints([player], { GOALS: 1 })[0];
    const second = recalculateFantasyPoints([player], { GOALS: 3 })[0];
    expect(first.fantasyPoints.projected).toBe(4);
    expect(second.fantasyPoints.projected).toBe(12);
  });
});
