import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditRecordMock,
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
    auditRecordMock: vi.fn(),
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
  withCronJobAudit: (handler: (req: unknown, res: unknown) => unknown) => async (req: unknown, res: unknown) => {
    await handler(req, res);
    await auditRecordMock();
  },
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
    upsertMock.mockReset().mockResolvedValue({ error: null });
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

  afterEach(() => { delete process.env.CRON_SECRET; vi.useRealTimers(); });

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

  const guardedQuery = {
    mode: "bounded", gameKey: "477", startDate: "2026-10-05", endDate: "2026-10-11",
    seasonId: "20262027", gameIds: "2026020001", maxSides: "2", dryRun: "true",
  };
  async function guardedCall(query: Record<string, string | string[] | undefined> = {}) {
    const res = response();
    await handler({ method: "POST", headers: { authorization: "Bearer schedule-secret" },
      query: { ...guardedQuery, ...query } } as never, res as never);
    return res;
  }
  function scopeHash(res: ReturnType<typeof response>): string {
    return (res.body as { data: { scope: { scopeHash: string } } }).data.scope.scopeHash;
  }
  async function changedSource(overrides: Record<string, unknown> = {}) {
    const source = await fetchBoundedMock();
    fetchBoundedMock.mockClear();
    return { ...source, games: source.games.map((entry: { game: unknown }) =>
      ({ ...entry, game: { ...(entry.game as object), ...overrides } })) };
  }

  it("inspects an exact bounded scope without cache, delete or audit writes", async () => {
    const res = await guardedCall();
    expect(res.body).toMatchObject({ success: true, data: { dryRun: true, rowsPlanned: 2,
      rowsUpserted: 0, rowsDeleted: 0, writeOutcome: "not_attempted",
      scope: { seasonId: 20262027, gameIds: [2026020001], maxSides: 2, sides: 2, nonCountableGameIds: [] } } });
    expect(scopeHash(res)).toMatch(/^[a-f0-9]{64}$/);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(deleteInMock).not.toHaveBeenCalled();
    expect(auditRecordMock).not.toHaveBeenCalled();
  });

  it("writes only the refetched approved sides in one upsert and retains the normal audit", async () => {
    const inspection = await guardedCall();
    const res = await guardedCall({ dryRun: "false", expectedScopeHash: scopeHash(inspection) });
    expect(res.body).toMatchObject({ success: true, data: { dryRun: false, rowsUpserted: 2,
      rowsDeleted: 0, writeOutcome: "acknowledged", scope: { scopeHash: scopeHash(inspection) } } });
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toHaveLength(2);
    expect(upsertMock.mock.calls[0][0].map((row: Record<string, unknown>) =>
      [row.source_game_id, row.team_id, row.game_date, row.source_season_id, row.game_key]))
      .toEqual([[2026020001, 4, "2026-10-05", 20262027, "477"], [2026020001, 3, "2026-10-05", 20262027, "477"]]);
    expect(deleteInMock).not.toHaveBeenCalled();
    expect(auditRecordMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { gameIds: "" }, { gameIds: "2026020001,2026020001" }, { gameIds: "NaN" },
    { gameIds: "9007199254740992" }, { seasonId: "20262028" }, { maxSides: "0" },
    { maxSides: "1001" }, { maxSides: "1.5" }, { maxSides: "1" },
    { seasonId: ["20262027", "20252026"] }, { startDate: undefined }, { mode: "full" },
    { dryRun: "maybe" }, { dryRun: "false", expectedScopeHash: undefined },
    { expectedScopeHash: "bad" }, { gameKey: ["477", "other"] },
  ])("rejects invalid/overflowing explicit scope before fetching or writing: %j", async query => {
    const res = await guardedCall(query);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(fetchBoundedMock).not.toHaveBeenCalled();
    expect(fetchFullSeasonMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
    expect(deleteInMock).not.toHaveBeenCalled();
  });

  it("rejects zero games and a missing approved game instead of certifying a refresh", async () => {
    const source = await changedSource();
    fetchBoundedMock.mockResolvedValueOnce({ ...source, games: [] });
    const empty = await guardedCall();
    expect(empty.body).toMatchObject({ success: false, writeOutcome: "not_attempted",
      error: { code: "REFRESH_SCOPE_MISMATCH" } });
    const missing = await guardedCall({ gameIds: "2026020001,2026020002", maxSides: "4" });
    expect(missing.body).toMatchObject({ success: false, error: { code: "REFRESH_SCOPE_MISMATCH" } });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it.each(["extra", "overflow", "duplicate"])("rejects %s fetched scope without truncating or writing", async condition => {
    const source = await changedSource();
    const second = condition === "duplicate" ? source.games[0] :
      { ...source.games[0], game: { ...source.games[0].game, id: 2026020002 } };
    fetchBoundedMock.mockResolvedValue({ ...source, games: [...source.games, second] });
    const res = await guardedCall({ maxSides: condition === "overflow" ? "2" : "4" });
    expect(res.body).toMatchObject({ success: false, writeOutcome: "not_attempted",
      error: { code: condition === "overflow" ? "REFRESH_SCOPE_OVERFLOW" : "REFRESH_SCOPE_MISMATCH" } });
    expect(upsertMock).not.toHaveBeenCalled();
    expect(deleteInMock).not.toHaveBeenCalled();
  });

  it.each([
    { season: 20252026 }, { homeTeam: { id: 99, abbrev: "ZZZ" } },
    { gameDate: "2026-10-04" }, { gameDate: "2026-10-12" },
  ])("rejects a source outside season/team/date bounds before writes: %j", async overrides => {
    fetchBoundedMock.mockResolvedValue(await changedSource(overrides));
    const res = await guardedCall();
    expect(res.body).toMatchObject({ success: false, writeOutcome: "not_attempted",
      error: { code: "REFRESH_SCOPE_MISMATCH" } });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects incomplete or failed source reads and incomplete cache reads before writes", async () => {
    const source = await changedSource();
    fetchBoundedMock.mockResolvedValueOnce({ ...source, complete: false })
      .mockRejectedValueOnce(new Error("later weekly source read failed"));
    expect((await guardedCall()).statusCode).toBe(409);
    expect((await guardedCall()).body).toMatchObject({ success: false, writeOutcome: "not_attempted" });
    scheduleRead.missingCount = true;
    expect((await guardedCall()).body).toMatchObject({ success: false,
      error: { code: "SCHEDULE_READ_INCOMPLETE" }, writeOutcome: "not_attempted" });
    expect(upsertMock).not.toHaveBeenCalled();
    expect(deleteInMock).not.toHaveBeenCalled();
  });

  it("stops a changed postponement before writes and requires a fresh inspection hash", async () => {
    const inspection = await guardedCall();
    fetchBoundedMock.mockResolvedValue(await changedSource({ gameScheduleState: "PPD" }));
    const stopped = await guardedCall({ dryRun: "false", expectedScopeHash: scopeHash(inspection) });
    expect(stopped.body).toMatchObject({ success: false, writeOutcome: "not_attempted",
      error: { code: "REFRESH_SOURCE_CHANGED" } });
    expect(upsertMock).not.toHaveBeenCalled();
    const updated = await guardedCall();
    expect(updated.body).toMatchObject({ success: true, data: { scope: { nonCountableGameIds: [2026020001] } } });
    const approved = await guardedCall({ dryRun: "false", expectedScopeHash: scopeHash(updated) });
    expect(approved.statusCode).toBe(200);
    expect(upsertMock.mock.calls[0][0].every((row: Record<string, unknown>) => row.is_countable === false)).toBe(true);
  });

  it("uses the NHL scoring date at both boundaries when UTC start is on the next day", async () => {
    fetchBoundedMock.mockResolvedValue(await changedSource({ startTimeUTC: "2026-10-06T00:30:00Z" }));
    const inspected = await guardedCall({ endDate: "2026-10-05" });
    expect(inspected.statusCode).toBe(200);
    await guardedCall({ endDate: "2026-10-05", dryRun: "false", expectedScopeHash: scopeHash(inspected) });
    expect(upsertMock.mock.calls[0][0].map((row: Record<string, unknown>) => [row.game_date, row.start_time]))
      .toEqual([["2026-10-05", "2026-10-06T00:30:00.000Z"], ["2026-10-05", "2026-10-06T00:30:00.000Z"]]);
  });

  it("does not accept the same source hash for a different key, date window or side ceiling", async () => {
    const inspection = await guardedCall();
    for (const query of [{ gameKey: "other" }, { endDate: "2026-10-10" }, { maxSides: "4" }]) {
      expect((await guardedCall({ ...query, dryRun: "false", expectedScopeHash: scopeHash(inspection) })).body)
        .toMatchObject({ success: false, writeOutcome: "not_attempted", error: { code: "REFRESH_SOURCE_CHANGED" } });
    }
    expect(upsertMock).not.toHaveBeenCalled();
  });

  function persistIncoming(rows: Array<Record<string, unknown>>) {
    for (const row of rows) {
      const existing = tableData.roster_optimizer_team_games.find(item => {
        const old = item as Record<string, unknown>;
        return old.game_key === row.game_key && old.source_game_id === row.source_game_id && old.team_id === row.team_id;
      }) as Record<string, unknown> | undefined;
      if (existing) Object.assign(existing, row);
      else tableData.roster_optimizer_team_games.push({ id: tableData.roster_optimizer_team_games.length + 1, ...row });
    }
  }

  it("keeps same-identity retries idempotent for content with truthful new fetched_at and no fabricated provider time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T10:00:00Z"));
    upsertMock.mockImplementation(async rows => { persistIncoming(rows); return { error: null }; });
    const inspected = await guardedCall();
    await guardedCall({ dryRun: "false", expectedScopeHash: scopeHash(inspected) });
    const first = (tableData.roster_optimizer_team_games[0] as Record<string, unknown>).fetched_at;
    vi.setSystemTime(new Date("2026-10-04T10:05:00Z"));
    const retry = await guardedCall({ dryRun: "false", expectedScopeHash: scopeHash(inspected) });
    expect(retry.body).toMatchObject({ success: true, data: { changes: { unchangedRows: 2 } } });
    expect(tableData.roster_optimizer_team_games).toHaveLength(2);
    expect((tableData.roster_optimizer_team_games[0] as Record<string, unknown>).fetched_at).not.toBe(first);
    expect(tableData.roster_optimizer_team_games.map(row => (row as Record<string, unknown>).source_updated_at)).toEqual([null, null]);
    expect(deleteInMock).not.toHaveBeenCalled();
  });

  it("reports write failure as uncertain and never proceeds to another chunk or deletion", async () => {
    const inspected = await guardedCall();
    upsertMock.mockResolvedValueOnce({ error: { message: "statement failed" } });
    const failed = await guardedCall({ dryRun: "false", expectedScopeHash: scopeHash(inspected) });
    expect(failed.body).toMatchObject({ success: false, writeOutcome: "unknown", error: { code: "SCHEDULE_SYNC_FAILED" } });
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(deleteInMock).not.toHaveBeenCalled();
    expect(tableData.roster_optimizer_team_games).toHaveLength(0);
  });

  it("keeps an approved scope larger than the legacy chunk size in one atomic cache statement", async () => {
    const source = await changedSource();
    const ids = Array.from({ length: 300 }, (_, index) => 2026020001 + index);
    fetchBoundedMock.mockResolvedValue({ ...source, games: ids.map(id =>
      ({ ...source.games[0], game: { ...source.games[0].game, id } })) });
    const query = { gameIds: ids.join(","), maxSides: "600" };
    const inspected = await guardedCall(query);
    const written = await guardedCall({ ...query, dryRun: "false", expectedScopeHash: scopeHash(inspected) });
    expect(written.body).toMatchObject({ success: true, data: { rowsUpserted: 600 } });
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toHaveLength(600);
    expect(deleteInMock).not.toHaveBeenCalled();
  });

  it("does not claim rollback on lost acknowledgement; readback and same-identity retry can converge", async () => {
    const inspected = await guardedCall();
    upsertMock.mockImplementationOnce(async rows => {
      persistIncoming(rows);
      throw new Error("connection lost after statement");
    });
    const uncertain = await guardedCall({ dryRun: "false", expectedScopeHash: scopeHash(inspected) });
    expect(uncertain.body).toMatchObject({ success: false, writeOutcome: "unknown" });
    expect(tableData.roster_optimizer_team_games).toHaveLength(2);
    upsertMock.mockImplementation(async rows => { persistIncoming(rows); return { error: null }; });
    const readback = await guardedCall();
    expect(scopeHash(readback)).toBe(scopeHash(inspected));
    const retry = await guardedCall({ dryRun: "false", expectedScopeHash: scopeHash(readback) });
    expect(retry.body).toMatchObject({ success: true, data: { rowsUpserted: 2, changes: { unchangedRows: 2 } } });
    expect(tableData.roster_optimizer_team_games).toHaveLength(2);
    expect(deleteInMock).not.toHaveBeenCalled();
  });

  it("rejects unauthorized or wrong-method inspection without source, schedule or audit writes", async () => {
    for (const req of [{ method: "POST", headers: {} },
      { method: "GET", headers: { authorization: "Bearer schedule-secret" } }]) {
      const res = response();
      await handler({ ...req, query: guardedQuery } as never, res as never);
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    }
    expect(fetchBoundedMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
    expect(auditRecordMock).not.toHaveBeenCalled();
  });


});
