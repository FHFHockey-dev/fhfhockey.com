import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProcessedPlayer } from "./useProcessedProjectionsData";
import { useVORPCalculations } from "./useVORPCalculations";
import {
  KEEPER_CONTRACT_VERSION,
  materializeKeeperPicks
} from "../lib/draftDashboard/keepers";

function player(
  playerId: number,
  position: string,
  value: number,
  yahooAvgPick = playerId
): ProcessedPlayer {
  return {
    playerId,
    fullName: `Player ${playerId}`,
    displayTeam: "TST",
    displayPosition: position,
    eligiblePositions: position.split(","),
    combinedStats: {},
    fantasyPoints: {
      projected: value,
      actual: null,
      diffPercentage: null,
      projectedPerGame: null,
      actualPerGame: null
    },
    yahooAvgPick
  } as ProcessedPlayer;
}

const players = [
  player(1, "C,LW", 100, 1),
  player(2, "C", 90, 2),
  player(3, "LW", 80, 3),
  player(4, "RW", 70, 4),
  player(5, "RW", 60, 5),
  player(6, "D", 50, 6),
  player(7, "D", 40, 7),
  player(8, "G", 30, 8),
  player(9, "G", 20, 9)
];

const rosterConfig = { C: 1, LW: 1, RW: 1, D: 1, G: 1, utility: 0 };

describe("useVORPCalculations grouped forwards", () => {
  it("deduplicates multi-position forwards and uses one FWD contract throughout", () => {
    const { result } = renderHook(() =>
      useVORPCalculations({
        players,
        availablePlayers: players,
        draftSettings: { teamCount: 1, rosterConfig },
        picksUntilNext: 1,
        forwardGrouping: "fwd"
      })
    );

    expect(Object.keys(result.current.replacementByPos)).toEqual([
      "FWD",
      "D",
      "G"
    ]);
    // Rank four is 70 only when C/LW eligibility for player 1 is deduplicated.
    expect(result.current.replacementByPos.FWD.vorp).toBe(70);
    expect(result.current.expectedTakenByPos).toEqual({ FWD: 1, D: 0, G: 0 });
    expect(result.current.playerMetrics.get("1")).toMatchObject({
      bestPos: "FWD",
      eligible: ["FWD"],
      vorp: 30
    });
  });

  it("keeps split pools independent and allocates utility without changing D/G", () => {
    const { result } = renderHook(() =>
      useVORPCalculations({
        players,
        availablePlayers: players,
        draftSettings: {
          teamCount: 1,
          rosterConfig: { ...rosterConfig, utility: 1 }
        },
        picksUntilNext: 0,
        forwardGrouping: "split"
      })
    );

    expect(Object.keys(result.current.replacementByPos)).toEqual([
      "C",
      "LW",
      "RW",
      "D",
      "G"
    ]);
    expect(result.current.replacementByPos.D.vorp).toBe(40);
    expect(result.current.replacementByPos.G.vorp).toBe(20);
    expect(result.current.playerMetrics.get("1")?.eligible).toEqual(["C", "LW"]);
  });

  it("uses grouped personalized fills to move the FWD replacement baseline", () => {
    const { result } = renderHook(() =>
      useVORPCalculations({
        players,
        availablePlayers: players,
        draftSettings: { teamCount: 1, rosterConfig },
        picksUntilNext: 0,
        forwardGrouping: "fwd",
        personalizeReplacement: true,
        myFilledSlots: { FWD: 1 }
      })
    );

    expect(result.current.replacementByPos.FWD.vorp).toBe(80);
    expect(result.current.replacementByPos.D.vorp).toBe(40);
    expect(result.current.replacementByPos.G.vorp).toBe(20);
  });

  it("changes only the remaining baseline when a keeper leaves availability", () => {
    const draftedPlayers = materializeKeeperPicks([], [
      {
        version: KEEPER_CONTRACT_VERSION,
        status: "valid",
        playerId: "1",
        teamId: "Team 1",
        round: 1,
        pickInRound: 1,
        pickNumber: 1
      }
    ]);
    const draftedIds = new Set(draftedPlayers.map((pick) => pick.playerId));
    const availablePlayers = players.filter(
      (player) => !draftedIds.has(String(player.playerId))
    );
    expect(availablePlayers.some((player) => player.playerId === 1)).toBe(false);
    const { result, rerender } = renderHook(
      ({ baselineMode }: { baselineMode: "remaining" | "full" }) =>
        useVORPCalculations({
          players,
          availablePlayers,
          draftSettings: { teamCount: 1, rosterConfig },
          picksUntilNext: 0,
          forwardGrouping: "fwd",
          baselineMode
        }),
      {
        initialProps: {
          baselineMode: "remaining"
        } as { baselineMode: "remaining" | "full" }
      }
    );

    expect(result.current.replacementByPos.FWD.vorp).toBe(60);
    rerender({ baselineMode: "full" });
    expect(result.current.replacementByPos.FWD.vorp).toBe(70);
  });
});
