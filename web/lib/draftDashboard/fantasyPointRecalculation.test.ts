import { describe, expect, it } from "vitest";
import { recalculateFantasyPoints } from "./fantasyPointRecalculation";
import { computeProratedFantasyPoints } from "lib/projectionsConfig/proration";

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

  it("uses defense-only hits and blocks as overrides without double counting", () => {
    const scoring = { HITS: 0.3, HITS_D: 0.32, BLOCKED_SHOTS: 0.3, BLOCKED_SHOTS_D: 0.32, PP_POINTS: 1, SH_POINTS: 1 };
    const combinedStats = {
      GAMES_PLAYED: { projected: 10, actual: null },
      HITS: { projected: 10, actual: null },
      BLOCKED_SHOTS: { projected: 5, actual: null },
      PP_POINTS: { projected: 2, actual: null },
      SH_POINTS: { projected: 1, actual: null },
    };
    const defense = recalculateFantasyPoints([{ ...player, displayPosition: "D", combinedStats }], scoring)[0];
    const forward = recalculateFantasyPoints([{ ...player, displayPosition: "LW", combinedStats }], scoring)[0];
    expect(defense.fantasyPoints.projected).toBeCloseTo(10 * 0.32 + 5 * 0.32 + 3);
    expect(forward.fantasyPoints.projected).toBeCloseTo(10 * 0.3 + 5 * 0.3 + 3);
    expect(computeProratedFantasyPoints(defense, true, scoring)).toBeCloseTo((10 * 0.32 + 5 * 0.32 + 3) * 84 / 10);
  });
});
