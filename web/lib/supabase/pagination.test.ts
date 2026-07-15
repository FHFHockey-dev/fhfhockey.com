import { describe, expect, it } from "vitest";

import {
  DEFAULT_SUPABASE_FILTER_CHUNK_SIZE,
  DEFAULT_SUPABASE_PAGE_SIZE,
  fetchAllSupabaseFilterChunks,
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

    expect(getSupabaseRange({ pageIndex: 2, pageSize: 50, start: 10 })).toEqual(
      {
        from: 110,
        to: 159,
        pageIndex: 2,
        pageSize: 50,
      },
    );
  });

  it("fetches a single page", async () => {
    const rows = await fetchSupabasePage(
      async ({ from, to }) => ({
        data: [{ from, to }],
        error: null,
      }),
      { pageIndex: 1, pageSize: 25 },
    );

    expect(rows).toEqual([{ from: 25, to: 49 }]);
  });

  it("fetches pages until Supabase returns a short page", async () => {
    const requestedRanges: Array<[number, number]> = [];
    const rows = await fetchAllSupabasePages(
      async ({ from, to, pageIndex }) => {
        requestedRanges.push([from, to]);

        return {
          data: pageIndex === 0 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }],
          error: null,
        };
      },
      { pageSize: 2 },
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
      { pageSize: 2, limit: 3 },
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
      })),
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
      { pageSize: 2, retry: { attempts: 2 } },
    );

    expect(calls).toBe(2);
    expect(rows).toEqual([{ id: 1 }]);
  });

  it("chunks large filter sets and paginates every chunk to a short page", async () => {
    const requests: Array<{ chunk: number[]; from: number; to: number }> = [];

    const rows = await fetchAllSupabaseFilterChunks(
      [1, 2, 2, 3, 4, 5],
      async (chunk, { from, to, pageIndex }) => {
        requests.push({ chunk, from, to });
        return {
          data:
            pageIndex === 0
              ? chunk.slice(0, 2).map((id) => ({ id }))
              : chunk.slice(2).map((id) => ({ id })),
          error: null,
        };
      },
      { chunkSize: 3, pageSize: 2 },
    );

    expect(requests).toEqual([
      { chunk: [1, 2, 3], from: 0, to: 1 },
      { chunk: [1, 2, 3], from: 2, to: 3 },
      { chunk: [4, 5], from: 0, to: 1 },
      { chunk: [4, 5], from: 2, to: 3 },
    ]);
    expect(rows).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ]);
  });

  it("uses a bounded default filter chunk size", async () => {
    const chunkSizes: number[] = [];
    await fetchAllSupabaseFilterChunks(
      Array.from(
        { length: DEFAULT_SUPABASE_FILTER_CHUNK_SIZE + 1 },
        (_, index) => index,
      ),
      async (chunk) => {
        chunkSizes.push(chunk.length);
        return { data: [], error: null };
      },
    );

    expect(chunkSizes).toEqual([DEFAULT_SUPABASE_FILTER_CHUNK_SIZE, 1]);
  });
});
