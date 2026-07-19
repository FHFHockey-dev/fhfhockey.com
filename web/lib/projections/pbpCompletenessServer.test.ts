import { describe, expect, it, vi } from "vitest";

const { playRangeMock, gameRow, terminalRows } = vi.hoisted(() => {
  const gameId = 2025020001;
  const completeGame = {
    id: gameId,
    date: "2025-10-07",
    hometeamid: 1,
    awayteamid: 2,
    type: 2,
    season: "20252026",
    hometeamabbrev: "AAA",
    awayteamabbrev: "BBB",
    hometeamscore: 2,
    awayteamscore: 1,
  };
  const plays = Array.from({ length: 1001 }, (_, index) => ({
    id: index + 1,
    gameid: gameId,
    typedesckey: "game-end",
  }));
  return {
    gameRow: completeGame,
    terminalRows: plays,
    playRangeMock: vi.fn(async (from: number, to: number) => ({
      data: plays.slice(from, to + 1),
      error: null,
    })),
  };
});

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn((table: string) => {
      const query: any = {
        select: vi.fn(() => query),
        in: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
        range:
          table === "pbp_plays"
            ? playRangeMock
            : vi.fn(async (from: number) => ({
                data: from === 0 ? [gameRow] : [],
                error: null,
              })),
      };
      return query;
    }),
  },
}));

import {
  classifyStoredPbpGames,
  isCompleteStoredPbpEvidence,
  isStoredPbpSourceParity,
} from "./pbpCompletenessServer";

describe("stored PBP completeness", () => {
  it("requires exactly one terminal game-end event and complete metadata", () => {
    expect(isCompleteStoredPbpEvidence(gameRow, 2, 1)).toBe(true);
    expect(isCompleteStoredPbpEvidence(gameRow, 1, 1)).toBe(false);
    expect(isCompleteStoredPbpEvidence(gameRow, 2, 0)).toBe(false);
    expect(isCompleteStoredPbpEvidence(gameRow, 3, 2)).toBe(false);
    expect(
      isCompleteStoredPbpEvidence({ ...gameRow, date: "2025-02-30" }, 2, 1),
    ).toBe(false);
    expect(
      isCompleteStoredPbpEvidence({ ...gameRow, hometeamscore: -1 }, 2, 1),
    ).toBe(false);
  });

  it("paginates terminal-event evidence and rejects duplicates", async () => {
    const classifications = await classifyStoredPbpGames([gameRow.id]);

    expect(playRangeMock.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(terminalRows).toHaveLength(1001);
    expect(classifications.get(gameRow.id)).toBe(false);
  });

  it("requires exact source metadata and ordered event identity parity", () => {
    const storedPlays = [
      { id: 1, gameid: gameRow.id, typedesckey: "shot-on-goal" },
      { id: 2, gameid: gameRow.id, typedesckey: "game-end" },
    ];
    const expected = { game: gameRow, eventIds: [2, 1] };

    expect(isStoredPbpSourceParity(gameRow, storedPlays, expected)).toBe(true);
    expect(
      isStoredPbpSourceParity(gameRow, storedPlays, {
        ...expected,
        eventIds: [1, 3],
      }),
    ).toBe(false);
    expect(
      isStoredPbpSourceParity(
        { ...gameRow, hometeamscore: gameRow.hometeamscore + 1 },
        storedPlays,
        expected,
      ),
    ).toBe(false);
    expect(
      isStoredPbpSourceParity(gameRow, storedPlays, {
        ...expected,
        eventIds: [1, 1],
      }),
    ).toBe(false);
  });
});
