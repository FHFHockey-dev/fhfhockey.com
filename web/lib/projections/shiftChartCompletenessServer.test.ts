import { describe, expect, it, vi } from "vitest";

const { orMock, rangeMock, rows } = vi.hoisted(() => {
  const gameId = 2025020001;
  const generatedRows = Array.from({ length: 1001 }, (_, index) => {
    const home = index % 2 === 0;
    return {
      id: index + 1,
      game_id: gameId,
      player_id: index + 1,
      team_id: home ? 1 : 2,
      opponent_team_id: home ? 2 : 1,
      season_id: 20252026,
      game_date: "2025-10-07",
      game_type: "2",
      home_or_away: home ? "home" : "away",
      team_abbreviation: home ? "AAA" : "BBB",
      opponent_team_abbreviation: home ? "BBB" : "AAA",
      total_es_toi: "10:00",
      total_pp_toi: "0:00",
      total_pk_toi: index === 1000 ? null : "0:00",
    };
  });
  return {
    rows: generatedRows,
    orMock: vi.fn(),
    rangeMock: vi.fn(async (from: number, to: number) => ({
      data: generatedRows.slice(from, to + 1),
      error: null,
    })),
  };
});

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn(() => {
      const query: any = {
        select: vi.fn(() => query),
        in: vi.fn(() => query),
        eq: vi.fn(() => query),
        or: vi.fn((filter: string) => {
          orMock(filter);
          return query;
        }),
        order: vi.fn(() => query),
        range: rangeMock,
      };
      return query;
    }),
  },
}));

import {
  buildNhlApiShiftPlayerManifest,
  classifyStoredShiftChartStrengthGames,
} from "./shiftChartCompletenessServer";

describe("stored shift strength pagination", () => {
  it("reads every ordered page and exposes a later-page partial row", async () => {
    const gameId = rows[0].game_id;
    const classifications = await classifyStoredShiftChartStrengthGames([
      gameId,
    ]);

    expect(rangeMock.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(orMock).toHaveBeenCalledWith(
      "total_es_toi.not.is.null,total_pp_toi.not.is.null,total_pk_toi.not.is.null",
    );
    expect(classifications.get(gameId)).toMatchObject({
      status: "partial",
      rowCount: 1001,
    });
  });

  it("requires a durable two-team raw-player manifest and deduplicates shifts", () => {
    const gameId = 2025020001;
    const manifestRows = [
      ...Array.from({ length: 5 }, (_, index) => ({
        shift_id: index + 1,
        game_id: gameId,
        player_id: 10 + index,
        team_id: 1,
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        shift_id: index + 6,
        game_id: gameId,
        player_id: 20 + index,
        team_id: 2,
      })),
      {
        shift_id: 11,
        game_id: gameId,
        player_id: 10,
        team_id: 1,
      },
    ];

    expect(
      buildNhlApiShiftPlayerManifest([gameId], manifestRows).get(gameId),
    ).toEqual([10, 11, 12, 13, 14, 20, 21, 22, 23, 24]);
    expect(() =>
      buildNhlApiShiftPlayerManifest([gameId], manifestRows.slice(0, 2)),
    ).toThrow("Incomplete NHL API shift player manifest");
    expect(() =>
      buildNhlApiShiftPlayerManifest(
        [gameId],
        [
          ...manifestRows,
          {
            shift_id: 12,
            game_id: gameId,
            player_id: 10,
            team_id: 2,
          },
        ],
      ),
    ).toThrow("Contradictory NHL API shift player team");
  });
});
