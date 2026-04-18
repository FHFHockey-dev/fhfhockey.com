import { describe, expect, it } from "vitest";

import { sortLineCombinationsByGameDate } from "./line-combo-queries";

describe("sortLineCombinationsByGameDate", () => {
  it("orders unsorted line-combo rows by most recent game date first", () => {
    const sorted = sortLineCombinationsByGameDate([
      {
        gameId: 2022010019,
        teamId: 25,
        games: { date: "2022-09-26" }
      },
      {
        gameId: 2025021268,
        teamId: 25,
        games: { date: "2026-04-11" }
      },
      {
        gameId: 2025021285,
        teamId: 25,
        games: { date: "2026-04-13" }
      }
    ]);

    expect(sorted.map((row) => row.gameId)).toEqual([
      2025021285,
      2025021268,
      2022010019
    ]);
  });

  it("breaks same-day ties by higher game id first", () => {
    const sorted = sortLineCombinationsByGameDate([
      {
        gameId: 2,
        teamId: 25,
        games: { date: "2026-04-11" }
      },
      {
        gameId: 3,
        teamId: 25,
        games: { date: "2026-04-11" }
      }
    ]);

    expect(sorted.map((row) => row.gameId)).toEqual([3, 2]);
  });
});
