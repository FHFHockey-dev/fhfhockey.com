import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryBuilder, serviceClient } = vi.hoisted(() => {
  const rows = [
    {
      id: 1,
      game_key: "477",
      week: 2,
      mapping_status: "mapped",
      is_countable: true,
      fetched_at: "2026-08-29T10:00:00.000Z",
    },
    {
      id: 2,
      game_key: "477",
      week: 2,
      mapping_status: "mapped",
      is_countable: true,
      fetched_at: "2026-08-29T11:00:00.000Z",
    },
  ];
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "gte", "lte", "order", "range"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return {
    queryBuilder: builder,
    serviceClient: {
      from: vi.fn(() => ({ select: vi.fn(() => builder) })),
    },
  };
});

vi.mock("lib/supabase/server", () => ({ default: serviceClient }));

import handler from "../../../../../pages/api/v1/roster-schedule-optimizer/schedule";

function response() {
  return {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, unknown>,
    setHeader(key: string, value: unknown) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

describe("GET roster optimizer schedule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the filtered bulk matrix with cache version and freshness", async () => {
    const res = response();
    await handler(
      {
        method: "GET",
        query: { gameKey: "477", startWeek: "2", endWeek: "4" },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        gameKey: "477",
        startWeek: 2,
        endWeek: 4,
        version: "roster-team-games.v1",
        freshness: {
          latestFetchedAt: "2026-08-29T11:00:00.000Z",
          oldestFetchedAt: "2026-08-29T10:00:00.000Z",
          rowCount: 2,
        },
      },
    });
    expect(queryBuilder.eq).toHaveBeenCalledWith("is_countable", true);
    expect(queryBuilder.gte).toHaveBeenCalledWith("week", 2);
    expect(queryBuilder.lte).toHaveBeenCalledWith("week", 4);
    expect(queryBuilder.range).toHaveBeenCalledWith(0, 999);
  });

  it("returns structured method and validation errors", async () => {
    const methodRes = response();
    await handler({ method: "POST", query: {} } as never, methodRes as never);
    expect(methodRes).toMatchObject({
      statusCode: 405,
      body: { success: false, error: { code: "METHOD_NOT_ALLOWED" } },
    });

    const queryRes = response();
    await handler(
      {
        method: "GET",
        query: { startWeek: "7", endWeek: "2" },
      } as never,
      queryRes as never,
    );
    expect(queryRes).toMatchObject({
      statusCode: 400,
      body: { success: false, error: { code: "INVALID_QUERY" } },
    });
  });
});
