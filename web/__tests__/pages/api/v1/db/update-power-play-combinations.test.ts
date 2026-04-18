import { beforeEach, describe, expect, it, vi } from "vitest";

const { updatePowerPlayCombinationsMock } = vi.hoisted(() => ({
  updatePowerPlayCombinationsMock: vi.fn()
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => async (req: any, res: any) => {
    req.supabase = req.mockSupabase;
    return handler(req, res);
  }
}));

vi.mock("../../../../../pages/api/v1/db/update-power-play-combinations/[gameId]", () => ({
  updatePowerPlayCombinations: updatePowerPlayCombinationsMock
}));

import handler from "../../../../../pages/api/v1/db/update-power-play-combinations";

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

function createGamesQueryBuilder(games: Array<{ id: number; date: string }>) {
  const builder: any = {
    gte() {
      return builder;
    },
    lte() {
      return builder;
    },
    in() {
      return builder;
    },
    order() {
      return {
        throwOnError: vi.fn().mockResolvedValue({
          data: games
        })
      };
    }
  };
  return builder;
}

describe("/api/v1/db/update-power-play-combinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    updatePowerPlayCombinationsMock.mockResolvedValue(undefined);
  });

  it("repairs power-play combinations across a date range", async () => {
    const req: any = {
      method: "GET",
      query: {
        startDate: "2026-03-14",
        endDate: "2026-03-15"
      },
      mockSupabase: {
        from: vi.fn(() => ({
          select: vi.fn(() =>
            createGamesQueryBuilder([
              { id: 101, date: "2026-03-14" },
              { id: 102, date: "2026-03-15" }
            ])
          )
        }))
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(updatePowerPlayCombinationsMock).toHaveBeenCalledTimes(2);
    expect(updatePowerPlayCombinationsMock.mock.calls[0]?.[0]).toBe(101);
    expect(updatePowerPlayCombinationsMock.mock.calls[1]?.[0]).toBe(102);
    expect(res.body).toMatchObject({
      success: true,
      gameIds: [101, 102],
      processed: 2,
      failed: 0,
      requestedScope: {
        startDate: "2026-03-14",
        endDate: "2026-03-15"
      }
    });
  });

  it("supports explicit gameIds and reports partial failures", async () => {
    updatePowerPlayCombinationsMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("pp fetch failed"));

    const req: any = {
      method: "GET",
      query: {
        gameIds: "201,202"
      },
      mockSupabase: {
        from: vi.fn(() => ({
          select: vi.fn(() =>
            createGamesQueryBuilder([
              { id: 201, date: "2026-03-14" },
              { id: 202, date: "2026-03-15" }
            ])
          )
        }))
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      gameIds: [201, 202],
      processed: 1,
      failed: 1,
      requestedScope: {
        gameIds: [201, 202]
      },
      failures: [
        {
          gameId: 202,
          message: "pp fetch failed"
        }
      ]
    });
  });

  it("treats pregame FUT game-state failures as skipped instead of blocking the batch", async () => {
    updatePowerPlayCombinationsMock
      .mockRejectedValueOnce(new Error("The gameState for the game 301 is FUT"))
      .mockRejectedValueOnce(new Error("The gameState for the game 302 is PRE"));

    const req: any = {
      method: "GET",
      query: {
        startDate: "2026-04-15",
        endDate: "2026-04-15"
      },
      mockSupabase: {
        from: vi.fn(() => ({
          select: vi.fn(() =>
            createGamesQueryBuilder([
              { id: 301, date: "2026-04-15" },
              { id: 302, date: "2026-04-15" }
            ])
          )
        }))
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      gameIds: [301, 302],
      processed: 0,
      skipped: 2,
      failed: 0,
      requestedScope: {
        startDate: "2026-04-15",
        endDate: "2026-04-15"
      },
      skips: [
        {
          gameId: 301,
          message: "The gameState for the game 301 is FUT"
        },
        {
          gameId: 302,
          message: "The gameState for the game 302 is PRE"
        }
      ]
    });
  });

  it("requires either gameIds or a date range", async () => {
    const req: any = {
      method: "GET",
      query: {},
      mockSupabase: {
        from: vi.fn()
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message:
        "Provide gameIds or a startDate/endDate range for bulk power-play combination repair."
    });
  });
});
