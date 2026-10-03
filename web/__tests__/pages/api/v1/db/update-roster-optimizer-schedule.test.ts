import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchBoundedMock,
  deleteInMock,
  fetchFullSeasonMock,
  scheduleRead,
  serviceClient,
  tableData,
  upsertMock,
} = vi.hoisted(() => {
  const tableData: Record<string, unknown[]> = {
    yahoo_matchup_weeks: [
      {
        id: 10,
        game_key: "477",
        season: "2026",
        week: 1,
        start_date: "2026-10-05",
        end_date: "2026-10-11",
      },
    ],
    seasons: [
      {
        id: 20262027,
        startDate: "2026-09-20",
        endDate: "2027-06-30",
      },
    ],
    team_season: [{ teamId: 3 }, { teamId: 4 }],
    teams: [
      { id: 3, abbreviation: "NYR" },
      { id: 4, abbreviation: "PHI" },
    ],
  };
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const deleteInMock = vi.fn().mockResolvedValue({ error: null });
  const scheduleRead = { cap: 1_000, calls: 0, emptyAt: 0, failAt: 0, missingCount: false };
  const client = {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => {
        const builder: Record<string, unknown> = {};
        const equalities: Array<[string, unknown]> = [];
        let afterId = 0;
        let limit = Number.POSITIVE_INFINITY;
        for (const method of ["gte", "in", "lte", "order"]) {
          builder[method] = vi.fn(() => builder);
        }
        builder.eq = vi.fn((column: string, value: unknown) => { equalities.push([column, value]); return builder; });
        builder.gt = vi.fn((column: string, value: number) => { if (column === "id") afterId = value; return builder; });
        builder.limit = vi.fn((value: number) => { limit = value; return builder; });
        builder.then = (resolve: (value: unknown) => unknown) => {
          if (table !== "roster_optimizer_team_games") return Promise.resolve({ data: tableData[table] ?? [], error: null }).then(resolve);
          scheduleRead.calls++;
          if (scheduleRead.failAt === scheduleRead.calls) return Promise.resolve({ data: null, error: { message: "read failed" } }).then(resolve);
          const rows = (tableData[table] ?? []).filter((row) => {
            const record = row as Record<string, unknown>;
            return equalities.every(([column, value]) => record[column] === value) && Number(record.id) > afterId;
          }).sort((a, b) => Number((a as { id: number }).id) - Number((b as { id: number }).id));
          return Promise.resolve({ data: scheduleRead.emptyAt === scheduleRead.calls ? [] : rows.slice(0, Math.min(limit, scheduleRead.cap)), error: null,
            count: scheduleRead.missingCount ? null : rows.length }).then(resolve);
        };
        return builder;
      }),
      upsert: upsertMock,
      delete: vi.fn(() => ({ in: deleteInMock })),
    })),
  };
  return {
    deleteInMock,
    fetchBoundedMock: vi.fn(),
    fetchFullSeasonMock: vi.fn(),
    scheduleRead,
    serviceClient: client,
    tableData,
    upsertMock,
  };
});

vi.mock("lib/supabase/server", () => ({ default: serviceClient }));
vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler,
}));
vi.mock("lib/rosterScheduleData/source", () => ({
  fetchBoundedNhlSchedule: fetchBoundedMock,
  fetchFullSeasonNhlSchedule: fetchFullSeasonMock,
}));

import handler, {
  parseRosterScheduleSyncRequest,
} from "../../../../../pages/api/v1/db/update-roster-optimizer-schedule";

function response() {
  return {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, unknown>,
    headersSent: false,
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

function existingRow(id: number, overrides: Record<string, unknown> = {}) {
  return { id, game_key: "477", season: "2026", source_game_id: 2026029000 + id,
    team_id: 3, game_date: "2026-10-06", week: 1, game_status: "FUT",
    schedule_status: "OK", mapping_status: "mapped", is_countable: true, ...overrides };
}

describe("update roster optimizer schedule route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableData.roster_optimizer_team_games = [];
    Object.assign(scheduleRead, { cap: 1_000, calls: 0, emptyAt: 0, failAt: 0, missingCount: false });
    process.env.CRON_SECRET = "schedule-secret";
    const source = {
      complete: true,
      warnings: [],
      games: [
        {
          sourceUrl: "https://api-web.nhle.com/v1/club-schedule-season/NYR/20262027",
          game: {
            id: 2026020001,
            season: 20262027,
            gameType: 2,
            gameDate: "2026-10-05",
            startTimeUTC: "2026-10-05T23:00:00Z",
            gameState: "FUT",
            gameScheduleState: "OK",
            awayTeam: { id: 4, abbrev: "PHI" },
            homeTeam: { id: 3, abbrev: "NYR" },
          },
        },
      ],
    };
    fetchFullSeasonMock.mockResolvedValue(source);
    fetchBoundedMock.mockResolvedValue(source);
  });

  afterEach(() => delete process.env.CRON_SECRET);

  it("defaults to a bounded refresh with a centralized game key", () => {
    expect(
      parseRosterScheduleSyncRequest(
        {},
        new Date("2026-08-29T12:00:00.000Z"),
      ),
    ).toEqual({
      mode: "bounded",
      gameKey: "477",
      startDate: "2026-08-27",
      endDate: "2026-09-19",
    });
  });

  it("rejects unauthenticated calls before schedule work", async () => {
    const res = response();
    await handler(
      { method: "POST", headers: {}, query: { mode: "full" } } as never,
      res as never,
    );
    expect(res).toMatchObject({
      statusCode: 401,
      body: { success: false, message: "Unauthorized." },
    });
    expect(fetchFullSeasonMock).not.toHaveBeenCalled();
  });

  it("authenticates cron, resolves season from Yahoo dates, and upserts two rows", async () => {
    const res = response();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer schedule-secret" },
        query: { mode: "full", gameKey: "477" },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        mode: "full",
        gameKey: "477",
        yahooSeason: "2026",
        sourceSeasonId: 20262027,
        gamesFetched: 1,
        mappedGames: 1,
        unmappedGames: 0,
        rowsUpserted: 2,
        rowsDeleted: 0,
        reconciliation: {
          status: "complete",
          staleRowsFound: 0,
        },
        changes: {
          newRows: 2,
          rescheduledRows: 0,
          rescheduledSourceGameIds: [],
          statusChangedRows: 0,
          unchangedRows: 0,
        },
      },
    });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          source_game_id: 2026020001,
          team_id: 4,
          week: 1,
          is_countable: true,
        }),
        expect.objectContaining({
          source_game_id: 2026020001,
          team_id: 3,
          week: 1,
          is_countable: true,
        }),
      ]),
      { onConflict: "game_key,source_game_id,team_id" },
    );
  });

  it("removes stale cache identities only after a complete full refresh", async () => {
    tableData.roster_optimizer_team_games = [
      {
        id: 99,
        game_key: "477",
        season: "2026",
        source_game_id: 2026029999,
        team_id: 3,
        game_date: "2026-10-06",
        week: 1,
        game_status: "FUT",
        schedule_status: "OK",
        mapping_status: "mapped",
        is_countable: true,
      },
    ];
    const res = response();

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer schedule-secret" },
        query: { mode: "full", gameKey: "477" },
      } as never,
      res as never,
    );

    expect(res.body).toMatchObject({
      success: true,
      data: {
        rowsDeleted: 1,
        reconciliation: { status: "complete", staleRowsFound: 1 },
      },
    });
    expect(deleteInMock).toHaveBeenCalledWith("id", [99]);
  });

  it("preserves stale rows when a full source refresh is incomplete", async () => {
    tableData.roster_optimizer_team_games = [
      {
        id: 99,
        game_key: "477",
        season: "2026",
        source_game_id: 2026029999,
        team_id: 3,
        game_date: "2026-10-06",
        week: 1,
        game_status: "FUT",
        schedule_status: "OK",
        mapping_status: "mapped",
        is_countable: true,
      },
    ];
    const current = await fetchFullSeasonMock();
    fetchFullSeasonMock.mockResolvedValue({
      ...current,
      complete: false,
      warnings: ["PHI: source unavailable"],
    });
    const res = response();

    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer schedule-secret" },
        query: { mode: "full", gameKey: "477" },
      } as never,
      res as never,
    );

    expect(res.body).toMatchObject({
      success: true,
      data: {
        rowsDeleted: 0,
        reconciliation: {
          status: "skipped_incomplete_source",
          staleRowsFound: 0,
        },
      },
    });
    expect(deleteInMock).not.toHaveBeenCalled();
  });

  it("reads every page beyond a capped response before full reconciliation", async () => {
    scheduleRead.cap = 250;
    tableData.roster_optimizer_team_games = Array.from({ length: 1_100 }, (_, index) => existingRow(index + 1));
    const res = response();
    await handler({ method: "POST", headers: { authorization: "Bearer schedule-secret" },
      query: { mode: "full", gameKey: "477" } } as never, res as never);
    expect(res.body).toMatchObject({ success: true, data: { rowsDeleted: 1_100,
      reconciliation: { status: "complete", staleRowsFound: 1_100 } } });
    expect(scheduleRead.calls).toBe(5);
    expect(deleteInMock.mock.calls.flatMap(([, ids]) => ids)).toHaveLength(1_100);
  });

  it("fails before writes if a later page errors, disappears, or exact completeness is unavailable", async () => {
    tableData.roster_optimizer_team_games = [existingRow(1), existingRow(2), existingRow(3)];
    scheduleRead.cap = 2;
    scheduleRead.failAt = 2;
    const failedPage = response();
    await handler({ method: "POST", headers: { authorization: "Bearer schedule-secret" },
      query: { mode: "full", gameKey: "477" } } as never, failedPage as never);
    expect(failedPage.statusCode).toBe(500);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(deleteInMock).not.toHaveBeenCalled();

    scheduleRead.calls = 0;
    scheduleRead.failAt = 0;
    scheduleRead.emptyAt = 2;
    const partialPage = response();
    await handler({ method: "POST", headers: { authorization: "Bearer schedule-secret" },
      query: { mode: "full", gameKey: "477" } } as never, partialPage as never);
    expect(partialPage.body).toMatchObject({ success: false,
      error: { code: "SCHEDULE_READ_INCOMPLETE" } });
    expect(upsertMock).not.toHaveBeenCalled();
    expect(deleteInMock).not.toHaveBeenCalled();

    scheduleRead.calls = 0;
    scheduleRead.emptyAt = 0;
    scheduleRead.missingCount = true;
    const missingCount = response();
    await handler({ method: "POST", headers: { authorization: "Bearer schedule-secret" },
      query: { mode: "full", gameKey: "477" } } as never, missingCount as never);
    expect(missingCount.body).toMatchObject({ success: false,
      error: { code: "SCHEDULE_READ_INCOMPLETE" } });
    expect(upsertMock).not.toHaveBeenCalled();
    expect(deleteInMock).not.toHaveBeenCalled();
  });

  it("reconciles only the requested game key and season and never deletes in bounded mode", async () => {
    tableData.roster_optimizer_team_games = [existingRow(10),
      existingRow(11, { game_key: "other" }), existingRow(12, { season: "2025" })];
    const full = response();
    await handler({ method: "POST", headers: { authorization: "Bearer schedule-secret" },
      query: { mode: "full", gameKey: "477" } } as never, full as never);
    expect(full.body).toMatchObject({ success: true, data: { rowsDeleted: 1 } });
    expect(deleteInMock).toHaveBeenCalledWith("id", [10]);

    vi.clearAllMocks();
    scheduleRead.calls = 0;
    const bounded = response();
    await handler({ method: "POST", headers: { authorization: "Bearer schedule-secret" },
      query: { mode: "bounded", gameKey: "477", startDate: "2026-10-05", endDate: "2026-10-06" } } as never,
    bounded as never);
    expect(bounded.body).toMatchObject({ success: true, data: { rowsDeleted: 0,
      reconciliation: { status: "not_applicable" } } });
    expect(deleteInMock).not.toHaveBeenCalled();
  });
});
