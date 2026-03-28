import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateLineCombosMock, getCurrentSeasonMock } = vi.hoisted(() => ({
  updateLineCombosMock: vi.fn(),
  getCurrentSeasonMock: vi.fn()
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => async (req: any, res: any) => {
    req.supabase = req.mockSupabase;
    return handler(req, res);
  }
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: getCurrentSeasonMock
}));

vi.mock("../../../../../pages/api/v1/db/update-line-combinations/[id]", () => ({
  updateLineCombos: updateLineCombosMock
}));

import handler from "../../../../../pages/api/v1/db/update-line-combinations";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

function createGamesQueryBuilder(games: Array<any>) {
  const builder: any = {
    eq() {
      return builder;
    },
    lte() {
      return builder;
    },
    gte() {
      return builder;
    },
    in() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return {
        throwOnError: vi.fn().mockResolvedValue({ data: games })
      };
    },
    throwOnError: vi.fn().mockResolvedValue({ data: games })
  };
  return builder;
}

function createLineCombosQueryBuilder(rows: Array<any>) {
  return {
    in: vi.fn(() => ({
      throwOnError: vi.fn().mockResolvedValue({ data: rows })
    }))
  };
}

describe("/api/v1/db/update-line-combinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20252026 });
    updateLineCombosMock.mockImplementation(async (gameId: number) => [
      { gameId, teamId: 1 },
      { gameId, teamId: 2 }
    ]);
  });

  it("keeps recent-gap healing as the default operator mode", async () => {
    const req: any = {
      method: "GET",
      query: {
        count: "2"
      },
      mockSupabase: {
        from: vi.fn((table: string) => {
          if (table === "games") {
            return {
              select: vi.fn(() =>
                createGamesQueryBuilder([
                  { id: 101, startTime: "2026-03-20T01:00:00.000Z" },
                  { id: 102, startTime: "2026-03-19T01:00:00.000Z" },
                  { id: 103, startTime: "2026-03-18T01:00:00.000Z" }
                ])
              )
            };
          }

          if (table === "lineCombinations") {
            return {
              select: vi.fn(() =>
                createLineCombosQueryBuilder([
                  { gameId: 101 },
                  { gameId: 101 },
                  { gameId: 102 }
                ])
              )
            };
          }

          throw new Error(`Unexpected table ${table}`);
        })
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(updateLineCombosMock).toHaveBeenCalledTimes(2);
    expect(updateLineCombosMock.mock.calls[0]?.[0]).toBe(102);
    expect(updateLineCombosMock.mock.calls[1]?.[0]).toBe(103);
    expect(res.body).toMatchObject({
      success: true,
      repairMode: "recent_gap",
      candidateWindow: 100,
      requestedScope: {
        count: 2,
        seasonId: 20252026
      }
    });
  });

  it("supports explicit historical backfill by date range", async () => {
    const req: any = {
      method: "GET",
      query: {
        repairMode: "historical_backfill",
        startDate: "2026-02-01",
        endDate: "2026-02-02"
      },
      mockSupabase: {
        from: vi.fn(() => ({
          select: vi.fn(() =>
            createGamesQueryBuilder([
              { id: 201, date: "2026-02-01" },
              { id: 202, date: "2026-02-02" }
            ])
          )
        }))
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(updateLineCombosMock).toHaveBeenCalledTimes(2);
    expect(res.body).toMatchObject({
      success: true,
      repairMode: "historical_backfill",
      gameIds: [201, 202],
      processed: 2,
      failed: 0,
      requestedScope: {
        startDate: "2026-02-01",
        endDate: "2026-02-02"
      }
    });
  });

  it("requires explicit scope for historical backfill", async () => {
    const req: any = {
      method: "GET",
      query: {
        repairMode: "historical_backfill"
      },
      mockSupabase: {
        from: vi.fn()
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      repairMode: "historical_backfill",
      message:
        "Historical line-combination backfill requires gameIds or a startDate/endDate range."
    });
  });
});
