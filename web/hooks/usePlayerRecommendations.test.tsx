import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePlayerRecommendations } from "./usePlayerRecommendations";

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
});
