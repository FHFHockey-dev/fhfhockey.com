import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import { useRosterScheduleOptimizer } from "hooks/useRosterScheduleOptimizer";

function player(
  playerId: number,
  fullName: string,
  displayTeam: string,
): ProcessedPlayer {
  return {
    playerId,
    fullName,
    displayTeam,
    displayPosition: "RW",
    eligiblePositions: ["RW"],
    combinedStats: {},
    fantasyPoints: {
      projected: 100 - playerId,
      actual: null,
      diffPercentage: null,
      projectedPerGame: null,
      actualPerGame: null,
    },
  } as ProcessedPlayer;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useRosterScheduleOptimizer", () => {
  it("includes keepers and reacts to draft and undo roster changes", async () => {
    const players = [
      player(1, "Keeper Wing", "CAR"),
      player(2, "Candidate Wing", "TOR"),
    ];
    const fetchedAt = new Date().toISOString();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          gameKey: "477",
          startWeek: 1,
          endWeek: 30,
          version: "roster-team-games.v1",
          freshness: {
            latestFetchedAt: fetchedAt,
            oldestFetchedAt: fetchedAt,
            rowCount: 2,
          },
          games: [
            {
              source_game_id: 1,
              game_date: "2026-10-12",
              game_status: "FUT",
              team_abbreviation: "CAR",
              week: 1,
            },
            {
              source_game_id: 2,
              game_date: "2026-10-12",
              game_status: "FUT",
              team_abbreviation: "TOR",
              week: 1,
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ rosterAssignments }) =>
        useRosterScheduleOptimizer({
          players,
          rosterAssignments,
          myTeamId: "Team 1",
          rosterConfig: { RW: 1, bench: 1 },
        }),
      {
        initialProps: {
          rosterAssignments: [
            { playerId: "1", teamId: "Team 1" },
          ],
        },
      },
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.baseline?.totalBenchGames).toBe(0);
    expect(result.current.insights.get("2")?.marginalDustGames).toBe(1);
    expect(result.current.insights.get("2")?.activeGamesAdded).toBe(0);

    rerender({
      rosterAssignments: [
        { playerId: "1", teamId: "Team 1" },
        { playerId: "2", teamId: "Team 1" },
      ],
    });
    expect(result.current.baseline?.totalBenchGames).toBe(1);
    expect(result.current.insights.has("2")).toBe(false);

    rerender({
      rosterAssignments: [{ playerId: "1", teamId: "Team 1" }],
    });
    expect(result.current.baseline?.totalBenchGames).toBe(0);
    expect(result.current.insights.get("2")?.marginalDustGames).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender({ rosterAssignments: [] });
    expect(result.current.baseline?.totalScheduledGames).toBe(0);
    expect(result.current.insights.get("1")?.marginalDustGames).toBe(0);
    expect(result.current.insights.get("1")?.activeGamesAdded).toBe(1);
  });

  it("does not present zero-DUST insights when the schedule cache is empty", async () => {
    const fetchedAt = new Date().toISOString();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            gameKey: "477",
            startWeek: 1,
            endWeek: 30,
            version: "roster-team-games.v1",
            freshness: {
              latestFetchedAt: fetchedAt,
              oldestFetchedAt: fetchedAt,
              rowCount: 0,
            },
            games: [],
          },
        }),
      }),
    );

    const { result } = renderHook(() =>
      useRosterScheduleOptimizer({
        players: [player(2, "Candidate Wing", "TOR")],
        rosterAssignments: [],
        myTeamId: "Team 1",
        rosterConfig: { RW: 1, bench: 1 },
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("empty"));
    expect(result.current.insights.size).toBe(0);
  });

  it("skips unresolved candidate data instead of showing a false zero", async () => {
    const fetchedAt = new Date().toISOString();
    const unresolved = {
      ...player(2, "Unknown Eligibility", "TOR"),
      eligiblePositions: ["ALIEN"],
      displayPosition: "ALIEN",
    } as ProcessedPlayer;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            gameKey: "477",
            startWeek: 1,
            endWeek: 30,
            version: "roster-team-games.v1",
            freshness: {
              latestFetchedAt: fetchedAt,
              oldestFetchedAt: fetchedAt,
              rowCount: 1,
            },
            games: [
              {
                source_game_id: 1,
                game_date: "2026-10-12",
                game_status: "FUT",
                team_abbreviation: "TOR",
                week: 1,
              },
            ],
          },
        }),
      }),
    );

    const { result } = renderHook(() =>
      useRosterScheduleOptimizer({
        players: [unresolved],
        rosterAssignments: [],
        myTeamId: "Team 1",
        rosterConfig: { RW: 1, bench: 1 },
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.insights.size).toBe(0);
    expect(result.current.skippedCandidates).toBe(1);
  });
});
