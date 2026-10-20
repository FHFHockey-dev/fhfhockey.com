import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auditRecordMock, getScheduleDailyMock, seasonWindowMock, serviceClient, tables } = vi.hoisted(() => {
  const tables: Record<string, Array<Record<string, any>>> = {};
  let nextId = 1;
  // In-memory PostgREST stand-in: filters, exact counts, limit/range paging and
  // upsert on the cache's (game_key, source_game_id, team_id) identity.
  const query = (table: string) => {
    const filters: Array<(row: Record<string, any>) => boolean> = [];
    let counted = false;
    let limit = Number.POSITIVE_INFINITY;
    let range: [number, number] | null = null;
    const builder: Record<string, any> = {
      select(_columns: string, options?: { count?: string }) { counted = options?.count === "exact"; return builder; },
      eq(column: string, value: unknown) { filters.push(row => row[column] === value); return builder; },
      gt(column: string, value: any) { filters.push(row => row[column] > value); return builder; },
      gte(column: string, value: any) { filters.push(row => row[column] >= value); return builder; },
      lte(column: string, value: any) { filters.push(row => row[column] <= value); return builder; },
      in(column: string, values: unknown[]) { filters.push(row => values.includes(row[column])); return builder; },
      order() { return builder; },
      limit(value: number) { limit = value; return builder; },
      range(from: number, to: number) { range = [from, to]; return builder; },
      abortSignal() { return builder; },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        const matched = (tables[table] ?? []).filter(row => filters.every(filter => filter(row)))
          .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
        const data = range ? matched.slice(range[0], range[1] + 1) : matched.slice(0, limit);
        return Promise.resolve({ data, error: null, count: counted ? matched.length : null }).then(resolve, reject);
      },
    };
    return builder;
  };
  const serviceClient = {
    from: (table: string) => ({
      select: (columns: string, options?: { count?: string }) => query(table).select(columns, options),
      upsert: (rows: Array<Record<string, any>>) => {
        const stored = (tables[table] ??= []);
        for (const row of rows) {
          const index = stored.findIndex(existing => existing.game_key === row.game_key
            && existing.source_game_id === row.source_game_id && existing.team_id === row.team_id);
          if (index >= 0) stored[index] = { ...row, id: stored[index].id };
          else stored.push({ ...row, id: nextId++ });
        }
        return Promise.resolve({ error: null });
      },
      delete: () => ({ in: () => Promise.resolve({ error: null }) }),
    }),
  };
  return { auditRecordMock: vi.fn(), getScheduleDailyMock: vi.fn(), seasonWindowMock: vi.fn(), serviceClient, tables };
});

vi.mock("lib/supabase/server", () => ({ default: serviceClient }));
vi.mock("lib/NHL/base", () => ({ get: vi.fn() }));
vi.mock("lib/NHL/server/scheduleDaily", () => ({ getScheduleDaily: getScheduleDailyMock }));
vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: (req: unknown, res: unknown) => unknown) => async (req: unknown, res: unknown) => {
    await handler(req, res);
    await auditRecordMock();
  },
}));
vi.mock("lib/cron/nhlOffSeason", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lib/cron/nhlOffSeason")>();
  return {
    ...actual,
    withNhlOffSeasonSkip: (handler: Parameters<typeof actual.withNhlOffSeasonSkip>[0]) =>
      actual.withNhlOffSeasonSkip(handler, { loadWindow: seasonWindowMock }),
  };
});

import handler from "../../../../../pages/api/v1/db/cron/update-roster-optimizer-schedule-daily";

const NOW = "2026-10-21T09:50:00.000Z"; // Wednesday; New York date 2026-10-21

function offset(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

// Every third date is an off day; other dates have one NYR–PHI game.
function schedulePage(cursor: string) {
  return {
    gameWeek: Array.from({ length: 7 }, (_, index) => {
      const date = offset(cursor, index);
      const day = Math.round((Date.parse(date) - Date.parse("2026-10-01")) / 86400000);
      return {
        date,
        games: day % 3 === 0 ? [] : [{
          id: 2026020000 + day, season: 20262027, gameType: 2, startTimeUTC: `${date}T23:00:00Z`,
          gameState: "FUT", gameScheduleState: "OK",
          homeTeam: { id: 3, abbrev: "NYR" }, awayTeam: { id: 4, abbrev: "PHI" },
        }],
      };
    }),
  };
}

function response() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, unknown>,
    setHeader(key: string, value: unknown) { this.headers[key] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

async function invoke(query: Record<string, string> = {}, headers: Record<string, string> = { authorization: "Bearer schedule-secret" },
  method = "GET") {
  const res = response();
  await handler({ method, headers, query } as never, res as never);
  return res;
}

describe("daily roster optimizer schedule cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
    process.env.CRON_SECRET = "schedule-secret";
    tables.yahoo_matchup_weeks = [
      ["2026-10-06", "2026-10-18"], ["2026-10-19", "2026-10-25"], ["2026-10-26", "2026-11-01"], ["2026-11-02", "2026-11-08"],
    ].map(([start_date, end_date], index) => ({ id: index + 10, game_key: "477", season: "2026", week: index + 1, start_date, end_date }));
    tables.seasons = [{ id: 20262027, startDate: "2026-09-20", endDate: "2027-06-30" }];
    tables.team_season = [{ seasonId: 20262027, teamId: 3 }, { seasonId: 20262027, teamId: 4 }];
    tables.teams = [{ id: 3, abbreviation: "NYR" }, { id: 4, abbreviation: "PHI" }];
    tables.roster_optimizer_team_games = [];
    getScheduleDailyMock.mockImplementation(async (date: string) => schedulePage(date));
    seasonWindowMock.mockResolvedValue({ state: "in_season", today: "2026-10-21", seasonId: 20262027,
      activeFrom: "2026-10-06", activeUntil: "2027-06-20" });
  });

  afterEach(() => { delete process.env.CRON_SECRET; vi.useRealTimers(); });

  it("refreshes the current and next week plus padding and confirms coverage", async () => {
    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(getScheduleDailyMock.mock.calls.map(([date]) => date)).toEqual(["2026-10-18", "2026-10-25", "2026-11-01"]);
    expect(res.body).toMatchObject({
      success: true,
      writeOutcome: "acknowledged",
      data: {
        window: { startDate: "2026-10-18", endDate: "2026-11-02" },
        sourceSeasonId: 20262027,
        fetchedAt: NOW,
        coverage: { status: "complete", validUntil: "2026-10-22T21:50:00.000Z" },
        gamesFetched: 11,
        unmappedGames: 0,
        ignoredGames: 0,
        rowsRead: 22,
      },
    });
    expect(res.body.rowsUpserted).toBe(22);
    expect(tables.roster_optimizer_team_games[0].source_metadata.scheduleCoverage).toMatchObject({
      version: "nhl-source-days-v1",
      emptyDates: ["2026-10-19", "2026-10-22", "2026-10-25", "2026-10-28", "2026-10-31"],
    });
    expect(auditRecordMock).toHaveBeenCalledTimes(1);
  });

  it("reports incomplete coverage when a cached game left the source window", async () => {
    // A vanished game stays cached (bounded mode never deletes), so its date has
    // more sides than the new witness lists and the reader would not count it.
    tables.roster_optimizer_team_games.push(...["away", "home"].map((side, index) => ({
      id: 900 + index, game_key: "477", season: "2026", source_game_id: 2026029999, team_id: index ? 3 : 4,
      source_season_id: 20262027, game_type: 2, game_date: "2026-10-20", start_time: "2026-10-20T23:00:00Z",
      game_status: "FUT", schedule_status: "OK", mapping_status: "mapped", is_countable: true, week: 2,
      team_abbreviation: index ? "NYR" : "PHI", opponent_abbreviation: index ? "PHI" : "NYR", home_away: side,
      fetched_at: "2026-10-20T09:50:00.000Z", source_metadata: {},
    })));

    const res = await invoke();

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      writeOutcome: "acknowledged",
      error: { code: "SCHEDULE_COVERAGE_INCOMPLETE" },
      data: { coverage: { status: "incomplete" }, rowsRead: 24 },
    });
    expect(auditRecordMock).toHaveBeenCalledTimes(1);
  });

  it("passes a source failure through without writing", async () => {
    getScheduleDailyMock.mockImplementation(async (date: string) => {
      const page = schedulePage(date);
      return date === "2026-10-25" ? { gameWeek: page.gameWeek.slice(1) } : page;
    });

    const res = await invoke();

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, error: { code: "SCHEDULE_SYNC_FAILED" } });
    expect(tables.roster_optimizer_team_games).toEqual([]);
  });

  it("stops waiting on a hung source read before the function limit", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(NOW));
    getScheduleDailyMock.mockImplementation(() => new Promise(() => undefined));

    const pending = invoke();
    await vi.waitFor(() => expect(getScheduleDailyMock).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(120_000);
    const res = await pending;

    expect(res).toMatchObject({ statusCode: 504, body: { success: false, writeOutcome: "unknown",
      error: { code: "DAILY_SCHEDULE_REFRESH_TIMEOUT" } } });
    expect(tables.roster_optimizer_team_games).toEqual([]);
  });

  it("skips between Yahoo periods without fetching the source", async () => {
    vi.setSystemTime(new Date("2026-10-04T09:50:00.000Z"));

    const res = await invoke();

    expect(res).toMatchObject({ statusCode: 200, body: { success: true, skipped: true, reason: "no_active_yahoo_period" } });
    expect(getScheduleDailyMock).not.toHaveBeenCalled();
  });

  it("fails visibly once the pinned game key's season is long over", async () => {
    vi.setSystemTime(new Date("2027-10-12T09:50:00.000Z"));
    tables.yahoo_matchup_weeks = tables.yahoo_matchup_weeks.filter(week => week.week < 3);

    const res = await invoke();

    expect(res).toMatchObject({ statusCode: 409, body: { success: false, error: { code: "PROFILE_RENEWAL_REQUIRED" } } });
    expect(getScheduleDailyMock).not.toHaveBeenCalled();
  });

  it("skips the NHL off-season", async () => {
    seasonWindowMock.mockResolvedValue({ state: "off_season", today: "2026-07-15", lastSeasonId: 20252026,
      lastActiveUntil: "2026-06-25", nextSeasonId: 20262027, resumesOn: "2026-09-20" });

    const res = await invoke();

    expect(res).toMatchObject({ statusCode: 200, body: { skipped: true, reason: "nhl_off_season" } });
    expect(getScheduleDailyMock).not.toHaveBeenCalled();
  });

  it("rejects caller-chosen windows", async () => {
    const res = await invoke({ startDate: "2026-10-01" });

    expect(res).toMatchObject({ statusCode: 400, body: { success: false, error: { code: "INVALID_QUERY" } } });
    expect(getScheduleDailyMock).not.toHaveBeenCalled();
  });

  it("rejects other methods", async () => {
    const res = await invoke({}, undefined, "PUT");

    expect(res).toMatchObject({ statusCode: 405, headers: { Allow: ["GET", "POST"] } });
    expect(getScheduleDailyMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated calls before any work", async () => {
    const res = await invoke({}, {});

    expect(res).toMatchObject({ statusCode: 401, body: { success: false } });
    expect(seasonWindowMock).not.toHaveBeenCalled();
    expect(getScheduleDailyMock).not.toHaveBeenCalled();
  });
});
