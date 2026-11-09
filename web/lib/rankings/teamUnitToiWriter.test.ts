import { describe, expect, it } from "vitest";

import { buildTeamUnitToiSnapshotRows, createTeamUnitToiBuildRequest } from "./teamUnitToiWriter";

// Records the ORDER BY of every paged read. Offset paging (range) over a non-unique order lets
// Postgres repeat rows on one page and skip them on another, so each read must end on a unique key.
function recordingClient() {
  const orders: Record<string, string[]> = {};
  const shift = { game_id: 1, season_id: 20252026, game_date: "2025-10-07", team_id: 10, team_abbrev: "AAA", player_id: 100, period: 1, start_seconds: 0, end_seconds: 40, duration_seconds: 40 };
  const data: Record<string, unknown[]> = {
    nhl_api_shift_rows: [shift],
    players: [{ id: 100, position: "C" }],
    powerPlayCombinations: [],
    games: [{ id: 1, homeTeamId: 10, awayTeamId: 20 }],
  };
  const client = {
    from(table: string) {
      orders[table] = [];
      const query: any = {
        select: () => query,
        eq: () => query,
        not: () => query,
        in: () => query,
        gte: () => query,
        lte: () => query,
        order: (column: string) => (orders[table].push(column), query),
        range: () => query,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve({ data: data[table] ?? [], error: null }).then(resolve, reject),
      };
      return query;
    },
  };
  return { client, orders };
}

describe("buildTeamUnitToiSnapshotRows paging", () => {
  it("orders every paged read by a unique key", async () => {
    const { client, orders } = recordingClient();
    await buildTeamUnitToiSnapshotRows(client as any, createTeamUnitToiBuildRequest({ season: 20252026, gameIds: [1], snapshotDate: "2026-11-08" }));

    // nhl_api_shift_rows primary key is (game_id, shift_id).
    expect(orders.nhl_api_shift_rows[0]).toBe("game_id");
    expect(orders.nhl_api_shift_rows.at(-1)).toBe("shift_id");
    // powerPlayCombinations primary key is (gameId, playerId).
    expect(orders.powerPlayCombinations).toEqual(["gameId", "playerId"]);
    expect(orders.players).toEqual(["id"]);
    expect(orders.games).toEqual(["id"]);
  });
});
