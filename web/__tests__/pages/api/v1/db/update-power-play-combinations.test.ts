import { beforeEach, describe, expect, it, vi } from "vitest";

const { updatePowerPlayCombinationsMock, auditState, auditInsertMock } = vi.hoisted(() => ({
  updatePowerPlayCombinationsMock: vi.fn(),
  auditState: { opts: undefined as any },
  auditInsertMock: vi.fn()
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => async (req: any, res: any) => {
    req.supabase = req.mockSupabase;
    return handler(req, res);
  }
}));

// The route's own audit options are captured so the audit tests can run the real wrapper with them.
vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any, opts: any) => {
    auditState.opts = opts;
    return handler;
  }
}));

vi.mock("lib/supabase/server", () => ({
  default: { from: vi.fn(() => ({ insert: auditInsertMock })) }
}));

vi.mock("lib/cron/nhlOffSeason", () => ({
  withNhlOffSeasonSkip: (handler: any) => handler
}));

vi.mock("../../../../../pages/api/v1/db/update-power-play-combinations/[gameId]", async (importOriginal) => ({
  isSuccessfulDryRunBody: (await importOriginal<any>()).isSuccessfulDryRunBody,
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

  it("adds up the rows each game kept without proof", async () => {
    updatePowerPlayCombinationsMock
      .mockResolvedValueOnce({ keptUnproven: 2 })
      .mockResolvedValueOnce({ keptUnproven: 1 });
    const res = createMockRes();

    await handler(
      requestFor({ startDate: "2026-03-14", endDate: "2026-03-14" }, gamesOf(2)),
      res
    );

    expect(res.body.keptUnproven).toBe(3);
  });

  describe("decision 152 dry run and concurrency", () => {
    const summaryFor = (gameId: number, diff: { deleted: number; updated: number; inserted: number; unchanged: number }) => ({
      gameId,
      dryRun: true,
      keptUnproven: 0,
      clock: [
        { game_id: gameId, team_id: 1, availability: "available", clock_seconds: 120, unavailable_reason: null },
        { game_id: gameId, team_id: 2, availability: "not_applicable", clock_seconds: 0, unavailable_reason: null }
      ],
      rows: Array.from({ length: diff.updated + diff.inserted + diff.unchanged }, (_, i) => ({
        gameId, playerId: gameId * 100 + i, team_id: 1, unit: 1, PPTOI: 60, pp_share_of_team: 0.5
      })),
      diff: {
        deleted: Array.from({ length: diff.deleted }, (_, i) => ({ playerId: gameId * 100 + 90 + i, unit: 3, PPTOI: 34 })),
        updated: Array.from({ length: diff.updated }, (_, i) => ({
          playerId: gameId * 100 + i, changes: { PPTOI: { before: 16, after: 60 } }
        })),
        inserted: [],
        unchanged: diff.unchanged
      }
    });

    it("the nightly call is unchanged: two-argument writes at the default concurrency, today's response shape", async () => {
      let running = 0;
      let peak = 0;
      updatePowerPlayCombinationsMock.mockImplementation(async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 1));
        running--;
        return { keptUnproven: 0 };
      });
      const req = requestFor({ startDate: "2026-11-11", endDate: "2026-11-13" }, gamesOf(8));
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(peak).toBe(MAX_CONCURRENT_GAMES);
      for (const call of updatePowerPlayCombinationsMock.mock.calls) {
        expect(call).toEqual([expect.any(Number), req.mockSupabase]);
      }
      expect(Object.keys(res.body).sort()).toEqual(["failed", "failures", "gameIds", "keptUnproven", "message",
        "processed", "requestedScope", "skipped", "skips", "success"]);
      expect(res.body.message).toMatch(/^Successfully updated power-play combinations/);
    });

    it("dryRun=true passes the flag to every game and returns each game's full diff, clock rows and totals", async () => {
      updatePowerPlayCombinationsMock
        .mockResolvedValueOnce(summaryFor(1000, { deleted: 2, updated: 1, inserted: 0, unchanged: 9 }))
        .mockResolvedValueOnce(summaryFor(1001, { deleted: 0, updated: 0, inserted: 0, unchanged: 11 }));
      const req = requestFor({ gameIds: "1000,1001", dryRun: "true", concurrency: "1" }, gamesOf(2));
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(updatePowerPlayCombinationsMock.mock.calls).toEqual([
        [1000, req.mockSupabase, { dryRun: true }],
        [1001, req.mockSupabase, { dryRun: true }]
      ]);
      expect(res.body).toMatchObject({
        success: true,
        dryRun: true,
        processed: 2,
        failed: 0,
        message: "Dry run: computed power-play combinations for games [1000, 1001]; nothing was written.",
        totals: { games: 2, clockRows: 4, available: 2, notApplicable: 2, unavailable: 0, playerRows: 21,
          deleted: 2, updated: 1, inserted: 0, unchanged: 20 }
      });
      expect(res.body.games).toHaveLength(2);
      expect(res.body.games[0]).toEqual({
        gameId: 1000,
        clock: summaryFor(1000, { deleted: 2, updated: 1, inserted: 0, unchanged: 9 }).clock,
        rows: summaryFor(1000, { deleted: 2, updated: 1, inserted: 0, unchanged: 9 }).rows,
        diff: summaryFor(1000, { deleted: 2, updated: 1, inserted: 0, unchanged: 9 }).diff
      });
    });

    it("concurrency=1 runs one game at a time", async () => {
      let running = 0;
      let peak = 0;
      updatePowerPlayCombinationsMock.mockImplementation(async (gameId: number) => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 1));
        running--;
        return summaryFor(gameId, { deleted: 0, updated: 0, inserted: 0, unchanged: 1 });
      });
      const res = createMockRes();

      await handler(requestFor({ gameIds: gamesOf(10).map((g) => g.id).join(","), dryRun: "true", concurrency: "1" },
        gamesOf(10)), res);

      expect(res.statusCode).toBe(200);
      expect(peak).toBe(1);
      expect(res.body.totals.games).toBe(10);
    });

    it.each(["0", "5", "1.5", "two"])("refuses concurrency=%s before reading games", async (concurrency) => {
      const req = requestFor({ gameIds: "1000", dryRun: "true", concurrency }, gamesOf(1));
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe(`concurrency must be a whole number from 1 to ${MAX_CONCURRENT_GAMES}.`);
      expect(req.mockSupabase.from).not.toHaveBeenCalled();
      expect(updatePowerPlayCombinationsMock).not.toHaveBeenCalled();
    });

    it("keeps the 60-game cap for a dry run with gameIds", async () => {
      const req = requestFor({ gameIds: gamesOf(MAX_GAMES_PER_CALL + 1).map((g) => g.id).join(","), dryRun: "true" }, []);
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain(`limit of ${MAX_GAMES_PER_CALL} games per call`);
      expect(updatePowerPlayCombinationsMock).not.toHaveBeenCalled();
    });

    describe("audit rows: a successful dry run writes nothing", () => {
      const audited = async () => {
        const actual = await vi.importActual<typeof import("lib/cron/withCronJobAudit")>("lib/cron/withCronJobAudit");
        return actual.withCronJobAudit(handler, auditState.opts);
      };
      beforeEach(() => {
        auditInsertMock.mockResolvedValue({ error: null });
      });

      it("a complete, successful dry run inserts no cron_job_audit row and still answers", async () => {
        updatePowerPlayCombinationsMock
          .mockResolvedValueOnce(summaryFor(1000, { deleted: 2, updated: 1, inserted: 0, unchanged: 9 }))
          .mockResolvedValueOnce(summaryFor(1001, { deleted: 0, updated: 0, inserted: 0, unchanged: 11 }));
        const res = createMockRes();

        await (await audited())(requestFor({ gameIds: "1000,1001", dryRun: "true", concurrency: "1" }, gamesOf(2)), res);

        expect(auditInsertMock).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({ success: true, dryRun: true, processed: 2 });
      });

      it("a failed dry run keeps its audit row", async () => {
        updatePowerPlayCombinationsMock
          .mockResolvedValueOnce(summaryFor(1000, { deleted: 0, updated: 0, inserted: 0, unchanged: 3 }))
          .mockRejectedValueOnce(new Error("Game 1001 is not in games."));
        const res = createMockRes();

        await (await audited())(requestFor({ gameIds: "1000,1001", dryRun: "true", concurrency: "1" }, gamesOf(2)), res);

        expect(res.statusCode).toBe(500);
        expect(auditInsertMock).toHaveBeenCalledOnce();
        expect(auditInsertMock.mock.calls[0][0].status).toBe("failure");
      });

      it("a write keeps its audit row, as the nightly cron does today", async () => {
        updatePowerPlayCombinationsMock.mockResolvedValue({ keptUnproven: 0 });
        const res = createMockRes();

        await (await audited())(requestFor({ startDate: "2026-11-12", endDate: "2026-11-13" }, gamesOf(3)), res);

        expect(res.statusCode).toBe(200);
        expect(auditInsertMock).toHaveBeenCalledOnce();
        expect(auditInsertMock.mock.calls[0][0].status).toBe("success");
      });

      it("only a complete dry run counts: a skipped or missing game keeps the audit row", async () => {
        // The predicate the route hands to withCronJobAudit.
        const isSuccessfulDryRunBody = auditState.opts.skipAuditWhenNoOp as (body: unknown) => boolean;
        const complete = { success: true, dryRun: true, failed: 0, skipped: 0, processed: 2, gameIds: [1, 2],
          games: [{}, {}] };
        expect(isSuccessfulDryRunBody(complete)).toBe(true);
        expect(isSuccessfulDryRunBody({ ...complete, skipped: 1 })).toBe(false);
        expect(isSuccessfulDryRunBody({ ...complete, games: [{}] })).toBe(false);
        expect(isSuccessfulDryRunBody({ ...complete, dryRun: undefined })).toBe(false);
        expect(isSuccessfulDryRunBody({ ...complete, success: false })).toBe(false);
      });
    });

    it("a failed game in a dry run is reported and the call returns 500", async () => {
      updatePowerPlayCombinationsMock
        .mockResolvedValueOnce(summaryFor(1000, { deleted: 0, updated: 0, inserted: 0, unchanged: 3 }))
        .mockRejectedValueOnce(new Error("Game 1001 is not in games."));
      const res = createMockRes();

      await handler(requestFor({ gameIds: "1000,1001", dryRun: "true", concurrency: "1" }, gamesOf(2)), res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toMatchObject({ success: false, dryRun: true, processed: 1, failed: 1,
        failures: [{ gameId: 1001, message: "Game 1001 is not in games." }] });
      expect(res.body.games.map((game: any) => game.gameId)).toEqual([1000]);
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
