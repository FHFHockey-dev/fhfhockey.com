import { beforeEach, describe, expect, it, vi } from "vitest";

const { orMock, rangeMock, rawRangeMock, rows } = vi.hoisted(() => {
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
    rawRangeMock: vi.fn(async (from: number, to: number, gameIds: number[]) => ({
      data: generatedRows.filter(row => gameIds.includes(row.game_id)).map(row => ({
        shift_id: row.id, game_id: row.game_id, player_id: row.player_id, team_id: row.team_id,
      })).slice(from, to + 1), error: null as Error | null,
    })),
    orMock: vi.fn(),
    rangeMock: vi.fn(async (from: number, to: number) => ({
      data: generatedRows.slice(from, to + 1),
      error: null,
    })),
  };
});

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn((table: string) => {
      let gameIds: number[] = [];
      const query: any = {
        select: vi.fn(() => query),
        in: vi.fn((_column: string, ids: number[]) => { gameIds = ids; return query; }),
        eq: vi.fn(() => query),
        or: vi.fn((filter: string) => {
          orMock(filter);
          return query;
        }),
        order: vi.fn(() => query),
        range: table === "nhl_api_shift_rows" ? (from: number, to: number) => rawRangeMock(from, to, gameIds) : rangeMock,
      };
      return query;
    }),
  },
}));

import {
  buildNhlApiShiftPlayerManifest,
  classifyStoredShiftChartStrengthGames,
  classifyStoredShiftChartStrengthGamesAgainstRawSource,
  fetchNhlApiShiftPlayerManifest,
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


const completeRows = rows.slice(0, 10);
const completeRawRows = completeRows.map(row => ({ shift_id: row.id, game_id: row.game_id, player_id: row.player_id, team_id: row.team_id }));
beforeEach(() => { vi.clearAllMocks(); });

describe("raw-manifest preflight classification", () => {
  it("reports an empty raw source as partial without inventing a zero-player roster", async () => {
    const gameId = 2026010048;
    const classifications = await classifyStoredShiftChartStrengthGamesAgainstRawSource([gameId]);
    expect(classifications.get(gameId)).toMatchObject({ status: "partial", rowCount: 0,
      expectedPlayerCount: null, reasons: ["missing:rows", "missing:raw_shift_player_manifest"] });
    await expect(fetchNhlApiShiftPlayerManifest([gameId])).rejects.toThrow("Incomplete NHL API shift player manifest");
  });

  it("never admits complete-looking strength rows without a verified raw manifest", async () => {
    rawRangeMock.mockResolvedValueOnce({ data: [], error: null });
    rangeMock.mockResolvedValueOnce({ data: completeRows, error: null });
    const classifications = await classifyStoredShiftChartStrengthGamesAgainstRawSource([rows[0].game_id]);
    expect(classifications.get(rows[0].game_id)).toMatchObject({ status: "partial", rowCount: 10,
      expectedPlayerCount: null, reasons: ["missing:raw_shift_player_manifest"] });
  });

  it("keeps independently complete games usable while another game has no raw coverage", async () => {
    const gameId = rows[0].game_id;
    rawRangeMock.mockResolvedValueOnce({ data: completeRawRows, error: null });
    rangeMock.mockResolvedValueOnce({ data: completeRows, error: null });
    const classifications = await classifyStoredShiftChartStrengthGamesAgainstRawSource([gameId, 2026010048]);
    expect(classifications.get(gameId)).toMatchObject({ status: "complete", expectedPlayerCount: 10, rowCount: 10 });
    expect(classifications.get(2026010048)).toMatchObject({ status: "partial", expectedPlayerCount: null });
  });

  it("preserves contradictory identity and database errors rather than reclassifying them as missing", async () => {
    rawRangeMock.mockResolvedValueOnce({ data: [...completeRawRows, { ...completeRawRows[0], shift_id: 9999, team_id: 2 }], error: null });
    await expect(classifyStoredShiftChartStrengthGamesAgainstRawSource([rows[0].game_id])).rejects.toThrow("Contradictory NHL API shift player team");
    rawRangeMock.mockResolvedValueOnce({ data: [], error: new Error("database unavailable") });
    await expect(classifyStoredShiftChartStrengthGamesAgainstRawSource([rows[0].game_id])).rejects.toThrow("database unavailable");
  });

  it("keeps invalid persisted strength rows invalid when the raw manifest is missing", async () => {
    rawRangeMock.mockResolvedValueOnce({ data: [], error: null });
    rangeMock.mockResolvedValueOnce({ data: [{ ...completeRows[0], total_es_toi: "bad-clock" }], error: null });
    const classifications = await classifyStoredShiftChartStrengthGamesAgainstRawSource([rows[0].game_id]);
    expect(classifications.get(rows[0].game_id)).toMatchObject({ status: "invalid", expectedPlayerCount: null });
    expect(classifications.get(rows[0].game_id)?.reasons).toContain("missing:raw_shift_player_manifest");
  });
});
