import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  deleteInMock,
  fetchFullSeasonMock,
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
  const client = {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => {
        const builder: Record<string, unknown> = {};
        for (const method of ["eq", "gte", "in", "lte", "order"]) {
          builder[method] = vi.fn(() => builder);
        }
        builder.then = (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: tableData[table] ?? [], error: null }).then(
            resolve,
          );
        return builder;
      }),
      upsert: upsertMock,
      delete: vi.fn(() => ({ in: deleteInMock })),
    })),
  };
  return {
    deleteInMock,
    fetchFullSeasonMock: vi.fn(),
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
  fetchBoundedNhlSchedule: vi.fn(),
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

describe("update roster optimizer schedule route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableData.roster_optimizer_team_games = [];
    process.env.CRON_SECRET = "schedule-secret";
    fetchFullSeasonMock.mockResolvedValue({
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
    });
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
});
