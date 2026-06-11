import { describe, expect, it } from "vitest";

import {
  DEFAULT_SUPABASE_PAGE_SIZE,
  fetchAllSupabasePages,
  fetchSupabasePage,
  getSupabaseRange,
} from "./pagination";

describe("supabase pagination helpers", () => {
  it("builds zero-based inclusive ranges", () => {
    expect(getSupabaseRange()).toEqual({
      from: 0,
      to: DEFAULT_SUPABASE_PAGE_SIZE - 1,
      pageIndex: 0,
      pageSize: DEFAULT_SUPABASE_PAGE_SIZE,
    });

    expect(
      getSupabaseRange({ pageIndex: 2, pageSize: 50, start: 10 })
    ).toEqual({
      from: 110,
      to: 159,
      pageIndex: 2,
      pageSize: 50,
    });
  });

  it("fetches a single page", async () => {
    const rows = await fetchSupabasePage(
      async ({ from, to }) => ({
        data: [{ from, to }],
        error: null,
      }),
      { pageIndex: 1, pageSize: 25 }
    );

    expect(rows).toEqual([{ from: 25, to: 49 }]);
  });

  it("fetches pages until Supabase returns a short page", async () => {
    const requestedRanges: Array<[number, number]> = [];
    const rows = await fetchAllSupabasePages(
      async ({ from, to, pageIndex }) => {
        requestedRanges.push([from, to]);

        return {
          data:
            pageIndex === 0
              ? [{ id: 1 }, { id: 2 }]
              : [{ id: 3 }],
          error: null,
        };
      },
      { pageSize: 2 }
    );

    expect(requestedRanges).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("caps the final request when a caller provides a limit", async () => {
    const requestedRanges: Array<[number, number]> = [];
    const rows = await fetchAllSupabasePages(
      async ({ from, to, pageSize }) => {
        requestedRanges.push([from, to]);

        return {
          data: Array.from({ length: pageSize }, (_, index) => ({
            id: from + index,
          })),
          error: null,
        };
      },
      { pageSize: 2, limit: 3 }
    );

    expect(requestedRanges).toEqual([
      [0, 1],
      [2, 2],
    ]);
    expect(rows).toEqual([{ id: 0 }, { id: 1 }, { id: 2 }]);
  });

  it("throws Supabase errors", async () => {
    await expect(
      fetchAllSupabasePages(async () => ({
        data: null,
        error: new Error("db failed"),
      }))
    ).rejects.toThrow("db failed");
  });

  it("retries page errors when configured", async () => {
    let calls = 0;

    const rows = await fetchAllSupabasePages(
      async () => {
        calls += 1;

        if (calls === 1) {
          return { data: null, error: new Error("temporary") };
        }

        return { data: [{ id: 1 }], error: null };
      },
      { pageSize: 2, retry: { attempts: 2 } }
    );

    expect(calls).toBe(2);
    expect(rows).toEqual([{ id: 1 }]);
  });
});
