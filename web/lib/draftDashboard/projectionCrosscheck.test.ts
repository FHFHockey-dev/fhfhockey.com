import { describe, expect, it } from "vitest";

import { findMissingProjectionPlayers } from "./projectionCrosscheck";

describe("findMissingProjectionPlayers", () => {
  it("compares every ordered page and merges source ownership", async () => {
    const rowsByTable: Record<string, Array<Record<string, unknown>>> = {
      skaters: [
        { player_id: 1, Player_Name: "One" },
        { player_id: 2, Player_Name: "Two" },
        { player_id: 3, Player_Name: "Three" },
        { player_id: 4, Player_Name: "Four" },
        { player_id: 5, Player_Name: "Five" },
      ],
    };
    const ranges: Array<[number, number]> = [];

    const missing = await findMissingProjectionPlayers(
      [
        {
          id: "source-a",
          tableName: "skaters",
          primaryPlayerIdKey: "player_id",
          originalPlayerNameKey: "Player_Name",
        },
        {
          id: "source-b",
          tableName: "skaters",
          primaryPlayerIdKey: "player_id",
          originalPlayerNameKey: "Player_Name",
        },
      ],
      new Set(["1", "3"]),
      async ({ tableName, from, to }) => {
        ranges.push([from, to]);
        return {
          data: rowsByTable[tableName].slice(from, to + 1),
          error: null,
        };
      },
      { pageSize: 2 },
    );

    expect(ranges).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
    expect(missing).toEqual([
      { player_id: 2, name: "Two", sourceIds: ["source-a", "source-b"] },
      { player_id: 4, name: "Four", sourceIds: ["source-a", "source-b"] },
      { player_id: 5, name: "Five", sourceIds: ["source-a", "source-b"] },
    ]);
  });

  it("throws a page error instead of returning a partial comparison", async () => {
    await expect(
      findMissingProjectionPlayers(
        [
          {
            id: "source-a",
            tableName: "skaters",
            primaryPlayerIdKey: "player_id",
            originalPlayerNameKey: "Player_Name",
          },
        ],
        new Set(),
        async () => ({ data: null, error: new Error("page failed") }),
      ),
    ).rejects.toThrow("page failed");
  });
});
