import { describe, expect, it } from "vitest";

import { POSTGREST_PAGE_SIZE, fetchPaginatedRows } from "./power-ratings";

describe("power-ratings PostgREST pagination", () => {
  it("continues after a full 1,000-row page with deterministic ordering", async () => {
    const rows = Array.from(
      { length: POSTGREST_PAGE_SIZE + 7 },
      (_, index) => ({ id: index + 1 }),
    );
    const ranges: Array<[number, number]> = [];
    const orders: string[][] = [];

    const result = await fetchPaginatedRows<{ id: number }>(() => {
      const pageOrders: string[] = [];
      orders.push(pageOrders);

      return {
        order(column: string) {
          pageOrders.push(column);
          return this;
        },
        range(from: number, to: number) {
          ranges.push([from, to]);
          return Promise.resolve({
            data: rows.slice(from, to + 1),
            error: null,
          });
        },
      };
    }, ["date", "team_abbreviation"]);

    expect(result).toHaveLength(POSTGREST_PAGE_SIZE + 7);
    expect(result.at(-1)).toEqual({ id: POSTGREST_PAGE_SIZE + 7 });
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(orders).toEqual([
      ["date", "team_abbreviation"],
      ["date", "team_abbreviation"],
    ]);
  });

  it("surfaces a page error without retrying indefinitely", async () => {
    await expect(
      fetchPaginatedRows(
        () => ({
          order() {
            return this;
          },
          range() {
            return Promise.resolve({
              data: null,
              error: new Error("page failed"),
            });
          },
        }),
        ["date"],
      ),
    ).rejects.toThrow("page failed");
  });
});
