import { beforeEach, describe, expect, it, vi } from "vitest";

const { serverReadonlyClientMock } = vi.hoisted(() => ({
  serverReadonlyClientMock: { from: vi.fn() },
}));

vi.mock("../../../../../lib/supabase/serverReadonly", () => ({
  default: serverReadonlyClientMock,
}));

import handler from "../../../../../pages/api/v1/ml/get-predictions-sko";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as any;
}

function createQuery(result: {
  data: Array<Record<string, any>>;
  error: unknown;
  count: number | null;
}) {
  const query: any = {};
  for (const method of ["select", "order", "range", "eq", "gte", "lte", "in"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: (value: typeof result) => unknown, reject: unknown) =>
    Promise.resolve(result).then(resolve, reject as any);
  return query;
}

describe("/api/v1/ml/get-predictions-sko", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-GET methods before database work", async () => {
    const req: any = { method: "POST", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET");
    expect(serverReadonlyClientMock.from).not.toHaveBeenCalled();
  });

  it.each([
    [{ asOfDate: "2026-02-30" }, "asOfDate must be a real YYYY-MM-DD date."],
    [
      { since: "2026-03-02", until: "2026-03-01" },
      "since must be on or before until.",
    ],
    [{ limit: "2001" }, "pageSize/limit must be between 1 and 2000."],
    [{ page: "1000001" }, "page must be between 1 and 1000000."],
    [{ order: "sideways" }, "order must be asc or desc."],
    [
      { playerIds: "7,nope" },
      "playerId/playerIds must contain positive integer ids.",
    ],
  ])("rejects invalid query input %o", async (query, message) => {
    const req: any = { method: "GET", query };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: message });
    expect(serverReadonlyClientMock.from).not.toHaveBeenCalled();
  });

  it("returns a deterministic identity-complete page with honest partial freshness metadata", async () => {
    const rows = [
      {
        player_id: 8,
        as_of_date: "2026-03-19",
        horizon_games: 5,
        pred_points: 4,
        pred_points_per_game: 0.8,
        stability_cv: 0.5,
        stability_multiplier: 0.9,
        sko: 3.6,
        top_features: null,
        model_name: "baseline-moving-average",
        model_version: "v0.2",
        created_at: "2026-03-19T10:00:00Z",
        updated_at: "2026-03-19T10:00:00Z",
      },
    ];
    const query = createQuery({ data: rows, error: null, count: 3 });
    serverReadonlyClientMock.from.mockReturnValue(query);
    const req: any = {
      method: "GET",
      query: {
        page: "2",
        pageSize: "2",
        since: "2026-03-01",
        until: "2026-03-31",
        horizon: "5",
        playerIds: "8,7,8",
        order: "desc",
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(serverReadonlyClientMock.from).toHaveBeenCalledWith(
      "predictions_sko",
    );
    expect(query.select).toHaveBeenCalledWith(
      expect.stringContaining(
        "model_name, model_version, created_at, updated_at",
      ),
      { count: "exact" },
    );
    expect(query.order).toHaveBeenNthCalledWith(1, "as_of_date", {
      ascending: false,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, "player_id", {
      ascending: true,
    });
    expect(query.order).toHaveBeenNthCalledWith(3, "horizon_games", {
      ascending: true,
    });
    expect(query.range).toHaveBeenCalledWith(2, 3);
    expect(query.eq).toHaveBeenCalledWith("horizon_games", 5);
    expect(query.gte).toHaveBeenCalledWith("as_of_date", "2026-03-01");
    expect(query.lte).toHaveBeenCalledWith("as_of_date", "2026-03-31");
    expect(query.in).toHaveBeenCalledWith("player_id", [8, 7]);
    expect(res.body).toMatchObject({
      success: true,
      count: 1,
      rows,
      partial: true,
      coverage: { returned: 1, total: 3 },
      pagination: {
        page: 2,
        pageSize: 2,
        total: 3,
        hasPrevious: true,
        hasMore: false,
      },
      freshness: {
        scope: "page",
        earliestAsOfDate: "2026-03-19",
        latestAsOfDate: "2026-03-19",
        latestUpdatedAt: "2026-03-19T10:00:00Z",
        ageDaysFromToday: expect.any(Number),
      },
    });
    expect(res.headers["Cache-Control"]).toBe(
      "s-maxage=60, stale-while-revalidate=300",
    );
  });

  it("returns an explicit complete empty page", async () => {
    const query = createQuery({ data: [], error: null, count: 0 });
    serverReadonlyClientMock.from.mockReturnValue(query);
    const req: any = { method: "GET", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      count: 0,
      rows: [],
      partial: false,
      coverage: { returned: 0, total: 0 },
      pagination: {
        page: 1,
        pageSize: 500,
        total: 0,
        hasPrevious: false,
        hasMore: false,
      },
      freshness: {
        scope: "page",
        earliestAsOfDate: null,
        latestAsOfDate: null,
        latestUpdatedAt: null,
        ageDaysFromToday: null,
      },
    });
  });

  it("keeps raw dependency details out of the public error contract and sanitizes logs", async () => {
    const query = createQuery({
      data: [],
      error: {
        message:
          "select failed at https://example.supabase.co/rest/v1 with Bearer fake-token",
      },
      count: null,
    });
    serverReadonlyClientMock.from.mockReturnValue(query);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const req: any = { method: "GET", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      success: false,
      code: "prediction_data_unavailable",
      error: "Prediction data is temporarily unavailable.",
    });
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain("[redacted-url]");
    expect(logged).toContain("Bearer [redacted]");
    expect(logged).not.toContain("fake-token");
    expect(logged).not.toContain("example.supabase.co");
  });
});
