import { describe, expect, it } from "vitest";

import { fetchSeasonSkaterRowsPage } from "./seasonSkaterRows";

type Call = Array<[string, ...unknown[]]>;

function fakeClient(rows: Array<Record<string, unknown>>, error: unknown = null) {
  const calls: Call[] = [];
  const client = {
    from: (table: string) => {
      const call: Call = [["from", table]];
      calls.push(call);
      const builder: any = {};
      for (const method of ["select", "eq", "gt", "gte", "lte", "or", "order", "limit"]) {
        builder[method] = (...args: unknown[]) => {
          call.push([method, ...args]);
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rows, error }).then(resolve);
      return builder;
    }
  };
  return { client, calls };
}

const row = (date: string, playerId: number) => ({ date, player_id: playerId });

describe("fetchSeasonSkaterRowsPage", () => {
  it("bounds the first page by the season's dates and orders by (date, player_id), never by id", async () => {
    const { client, calls } = fakeClient([row("2026-10-07", 1), row("2026-10-07", 2)]);

    const page = await fetchSeasonSkaterRowsPage(client, 20262027, null, 2);

    const call = calls[0];
    expect(call).toContainEqual(["from", "wgo_skater_stats"]);
    expect(call).toContainEqual(["eq", "season_id", 20262027]);
    expect(call).toContainEqual(["gt", "games_played", 0]);
    expect(call).toContainEqual(["gte", "date", "2026-09-01"]);
    expect(call).toContainEqual(["lte", "date", "2027-08-31"]);
    expect(call).toContainEqual(["order", "date", { ascending: true }]);
    expect(call).toContainEqual(["order", "player_id", { ascending: true }]);
    expect(call.some(([method, column]) => method === "order" && column === "id")).toBe(false);
    expect(call).toContainEqual(["limit", 2]);
    expect(call.some(([method]) => method === "or")).toBe(false);
    expect(page).toMatchObject({
      hasMore: true,
      nextCursor: { date: "2026-10-07", playerId: 2 }
    });
  });

  it("starts the next page strictly after the cursor", async () => {
    const { client, calls } = fakeClient([row("2026-10-09", 5)]);

    const page = await fetchSeasonSkaterRowsPage(
      client,
      20262027,
      { date: "2026-10-07", playerId: 8478402 },
      1000
    );

    expect(calls[0]).toContainEqual(["gte", "date", "2026-10-07"]);
    expect(calls[0]).toContainEqual(["or", "date.gt.2026-10-07,player_id.gt.8478402"]);
    expect(page).toEqual({ rows: [row("2026-10-09", 5)], hasMore: false, nextCursor: null });
  });

  it("throws the API error and skips an invalid season id", async () => {
    const failing = fakeClient([], { message: "timeout" });
    await expect(
      fetchSeasonSkaterRowsPage(failing.client, 20262027, null, 200)
    ).rejects.toEqual({ message: "timeout" });

    const invalid = fakeClient([]);
    await expect(
      fetchSeasonSkaterRowsPage(invalid.client, 2026, null, 200)
    ).resolves.toEqual({ rows: [], hasMore: false, nextCursor: null });
    expect(invalid.calls).toHaveLength(0);
  });
});
