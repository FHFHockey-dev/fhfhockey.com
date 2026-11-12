import { describe, expect, it } from "vitest";
import { likeForLikeStatDiff, recalculateFantasyPoints } from "./fantasyPointRecalculation";
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
      // Like with like (M-DRF-010): 0.4 actual FP/G vs 1.4 projected FP/G.
      diffPercentage: ((0.4 - 1.4) / 1.4) * 100,
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

  it("distinguishes authoritative zero weights from unavailable active stats and omitted scoring", () => {
    const current = { ...player, fantasyPoints: { ...player.fantasyPoints, projected: 450 } };
    expect(computeProratedFantasyPoints(current, true, { GOALS: 0 }, { mergeWithDefaults: false })).toBe(0);
    expect(computeProratedFantasyPoints(current, true, { HITS_D: 0.5 }, { mergeWithDefaults: false })).toBe(0);
    expect(computeProratedFantasyPoints(current, true, { HITS: 1 }, { mergeWithDefaults: false })).toBeNull();
    expect(computeProratedFantasyPoints(current, true)).toBeCloseTo((4 * 3 + 6 * 2) * 84 / 10);
    expect(current.fantasyPoints.projected).toBe(450);
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

  it("compares season-to-date fantasy points with the projection pro-rated to games played (M-DRF-010)", () => {
    // Exactly on pace: 41 goals over 82 projected GP; 7.5 goals in 15 games.
    const onPace = {
      ...player,
      combinedStats: {
        GAMES_PLAYED: { projected: 82, actual: 15 },
        GOALS: { projected: 41, actual: 7.5 },
      },
    };
    const [result] = recalculateFantasyPoints([onPace], { GOALS: 2 });
    expect(result.fantasyPoints.projected).toBe(82);
    expect(result.fantasyPoints.actual).toBe(15);
    expect(result.fantasyPoints.diffPercentage).toBe(0);
  });

  it("leaves the fantasy-point difference unknown when games played is unknown", () => {
    const [result] = recalculateFantasyPoints(
      [{ ...player, combinedStats: { GAMES_PLAYED: { projected: 82, actual: null }, GOALS: { projected: 41, actual: 7 } } }],
      { GOALS: 2 }
    );
    expect(result.fantasyPoints.actual).toBe(14);
    expect(result.fantasyPoints.diffPercentage).toBeNull();
  });
});

describe("like-for-like per-stat differences (M-DRF-010)", () => {
  it("pro-rates counting stats to actual games played", () => {
    expect(likeForLikeStatDiff("GOALS", 7.5, 41, 15, 82)).toBe(0);
    expect(likeForLikeStatDiff("GOALS", 15, 41, 15, 82)).toBeCloseTo(100);
  });

  it("compares rate stats directly", () => {
    expect(likeForLikeStatDiff("SAVE_PERCENTAGE", 0.9, 0.9, 3, 60)).toBe(0);
    expect(likeForLikeStatDiff("TIME_ON_ICE_PER_GAME", 1200, 1000, 10, 82)).toBeCloseTo(20);
  });

  it("returns unknown, never zero, without games played and gives GP itself no diff", () => {
    expect(likeForLikeStatDiff("GOALS", 5, 41, null, 82)).toBeNull();
    expect(likeForLikeStatDiff("GOALS", 0, 41, 0, 82)).toBeNull();
    expect(likeForLikeStatDiff("GOALS", 5, 41, 10, null)).toBeNull();
    expect(likeForLikeStatDiff("GAMES_PLAYED", 15, 82, 15, 82)).toBeNull();
  });
});
