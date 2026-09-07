import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  estimateAvailability,
  usePlayerRecommendations,
} from "./usePlayerRecommendations";

const player = (playerId: number, position: string) =>
  ({
    playerId,
    fullName: `Player ${playerId}`,
    displayTeam: "TST",
    displayPosition: position,
    eligiblePositions: position.split(","),
    combinedStats: {},
    fantasyPoints: { projected: 10 }
  }) as any;

describe("usePlayerRecommendations", () => {
  it("combines VBD and VONA and applies grouped FWD need", () => {
    const players = [player(1, "C,LW"), player(2, "D")];
    const metrics = new Map([
      ["1", { vbd: 10, vorp: 10, vona: 0 } as any],
      ["2", { vbd: 9, vorp: 9, vona: 10 } as any]
    ]);
    const { result, rerender } = renderHook(
      ({ needWeightEnabled }) =>
        usePlayerRecommendations({
          players,
          vorpMetrics: metrics,
          posNeeds: { FWD: 1, D: 0 },
          needWeightEnabled,
          needAlpha: 1,
          forwardGrouping: "fwd",
          baselineMode: "remaining"
        }),
      { initialProps: { needWeightEnabled: false } }
    );

    expect(result.current.recommendations[0].player.playerId).toBe(2);
    rerender({ needWeightEnabled: true });
    expect(result.current.recommendations[0].player.playerId).toBe(1);
    expect(result.current.recommendations[0].reasonTags).toEqual(
      expect.arrayContaining([
        "VBD 10.0",
        "VONA 0.0",
        "Roster need 100%",
        "Remaining pool"
      ])
    );
  });

  it("returns an honest empty recommendation list", () => {
    const { result } = renderHook(() =>
      usePlayerRecommendations({ players: [] })
    );
    expect(result.current.recommendations).toEqual([]);
  });

  it("uses the shared bounded availability estimate", () => {
    expect(estimateAvailability(30, 30, 12)).toBeCloseTo(0.5, 3);
    expect(estimateAvailability(undefined, 30)).toBeUndefined();
    expect(estimateAvailability(30, undefined)).toBeUndefined();
    expect(estimateAvailability(34, 30, 1)).toBeCloseTo(
      estimateAvailability(34, 30, 2)!,
      8,
    );
    expect(estimateAvailability(34, 30, 100)).toBeCloseTo(
      estimateAvailability(34, 30, 40)!,
      8,
    );
  });

  it("fits configured goalie categories using lower-is-better direction", () => {
    const strongGoalie = {
      ...player(1, "G"),
      fullName: "Strong Goalie",
      combinedStats: {
        GOALS_AGAINST_AVERAGE: { projected: 2 },
        GOALS: { projected: 0 },
      },
    };
    const weakGoalie = {
      ...player(2, "G"),
      fullName: "Weak Goalie",
      combinedStats: {
        GOALS_AGAINST_AVERAGE: { projected: 3.5 },
        GOALS: { projected: 0 },
      },
    };
    const skater = {
      ...player(3, "C"),
      combinedStats: { GOALS: { projected: 80 } },
    };
    const metrics = new Map([
      ["1", { vbd: 10, vorp: 10, vona: 0 } as any],
      ["2", { vbd: 10, vorp: 10, vona: 0 } as any],
      ["3", { vbd: 10, vorp: 10, vona: 0 } as any],
    ]);
    const args = {
      players: [strongGoalie, weakGoalie, skater],
      categoryPlayerPool: [strongGoalie, weakGoalie, skater],
      vorpMetrics: metrics,
      leagueType: "categories" as const,
      categoryWeights: { GOALS_AGAINST_AVERAGE: 1, GOALS: 0 },
      categoryTeamTotals: [
        { GOALS_AGAINST_AVERAGE: 3 },
        { GOALS_AGAINST_AVERAGE: 2 },
        { GOALS_AGAINST_AVERAGE: 2.5 },
      ],
      myCategoryTotals: { GOALS_AGAINST_AVERAGE: 3 },
      needWeightEnabled: true,
      needAlpha: 1,
    };
    const { result, rerender } = renderHook(
      ({ weights }) => usePlayerRecommendations({ ...args, categoryWeights: weights }),
      { initialProps: { weights: args.categoryWeights } },
    );

    expect(result.current.recommendations[0].player.playerId).toBe(1);
    expect(result.current.recommendations.find((item) => item.player.playerId === 1)?.fitScore)
      .toBeGreaterThan(0);
    expect(result.current.recommendations.find((item) => item.player.playerId === 3)?.fitScore)
      .toBe(0);

    rerender({ weights: { GOALS_AGAINST_AVERAGE: 0, GOALS: 0 } });
    expect(result.current.recommendations.every((item) => item.fitScore === 0)).toBe(true);
    expect(result.current.recommendations.every((item) => item.score === 7)).toBe(true);
  });

  it("reverses a category's normal direction for a negative weight", () => {
    const lowGoalPlayer = {
      ...player(1, "C"),
      fullName: "Low Goal Player",
      combinedStats: { GOALS: { projected: 5 } },
    };
    const highGoalPlayer = {
      ...player(2, "C"),
      fullName: "High Goal Player",
      combinedStats: { GOALS: { projected: 15 } },
    };
    const { result } = renderHook(() =>
      usePlayerRecommendations({
        players: [lowGoalPlayer, highGoalPlayer],
        categoryPlayerPool: [lowGoalPlayer, highGoalPlayer],
        vorpMetrics: new Map([
          ["1", { vbd: 10, vorp: 10, vona: 0 } as any],
          ["2", { vbd: 10, vorp: 10, vona: 0 } as any],
        ]),
        leagueType: "categories",
        categoryWeights: { GOALS: -1 },
        categoryTeamTotals: [{ GOALS: 20 }, { GOALS: 10 }, { GOALS: 0 }],
        myCategoryTotals: { GOALS: 20 },
        needWeightEnabled: true,
        needAlpha: 1,
      }),
    );

    expect(result.current.recommendations[0].player.playerId).toBe(1);
    expect(result.current.recommendations[0].fitScore).toBeGreaterThan(0);
    expect(result.current.recommendations[1].fitScore).toBe(0);
  });
});
