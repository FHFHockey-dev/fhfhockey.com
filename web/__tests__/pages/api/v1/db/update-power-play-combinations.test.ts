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

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler
}));

vi.mock("lib/cron/nhlOffSeason", () => ({
  withNhlOffSeasonSkip: (handler: any) => handler
}));

vi.mock("../../../../../pages/api/v1/db/update-power-play-combinations/[gameId]", () => ({
  updatePowerPlayCombinations: updatePowerPlayCombinationsMock
}));

import handler, {
  MAX_CONCURRENT_GAMES,
  MAX_GAMES_PER_CALL
} from "../../../../../pages/api/v1/db/update-power-play-combinations";

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
      return builder;
    },
    limit() {
      return builder;
    },
    throwOnError: vi.fn().mockResolvedValue({
      data: games
    })
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

  const gamesOf = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: 1000 + index,
      date: "2026-03-14"
    }));
  const requestFor = (query: object, games: Array<{ id: number; date: string }>): any => ({
    method: "GET",
    query,
    mockSupabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => createGamesQueryBuilder(games))
      }))
    }
  });

  it("refuses a date range over the game limit before touching any game", async () => {
    const res = createMockRes();

    await handler(
      requestFor(
        { startDate: "2026-01-01", endDate: "2026-04-01" },
        gamesOf(MAX_GAMES_PER_CALL + 1)
      ),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain(`limit of ${MAX_GAMES_PER_CALL} games per call`);
    expect(updatePowerPlayCombinationsMock).not.toHaveBeenCalled();
  });

  it("refuses a game id list over the limit before reading games", async () => {
    const res = createMockRes();
    const req = requestFor(
      { gameIds: gamesOf(MAX_GAMES_PER_CALL + 1).map((game) => game.id).join(",") },
      []
    );

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(req.mockSupabase.from).not.toHaveBeenCalled();
    expect(updatePowerPlayCombinationsMock).not.toHaveBeenCalled();
  });

  it("accepts a call at the limit and never runs more than the concurrency bound", async () => {
    let running = 0;
    let peak = 0;
    updatePowerPlayCombinationsMock.mockImplementation(async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running--;
    });
    const res = createMockRes();

    await handler(
      requestFor(
        { startDate: "2026-03-14", endDate: "2026-03-20" },
        gamesOf(MAX_GAMES_PER_CALL)
      ),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.processed).toBe(MAX_GAMES_PER_CALL);
    expect(peak).toBe(MAX_CONCURRENT_GAMES);
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
