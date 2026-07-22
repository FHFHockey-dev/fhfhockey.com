import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentSeasonMock, ingestNhlApiRawGamesMock, serviceRoleFromMock } =
  vi.hoisted(() => ({
    getCurrentSeasonMock: vi.fn(),
    ingestNhlApiRawGamesMock: vi.fn(),
    serviceRoleFromMock: vi.fn(),
  }));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: getCurrentSeasonMock,
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: serviceRoleFromMock,
  },
}));

vi.mock("lib/supabase/Upserts/nhlRawGamecenter.mjs", () => ({
  ingestNhlApiRawGames: ingestNhlApiRawGamesMock,
  NORMALIZATION_PARSER_FINGERPRINT: "f".repeat(64),
}));

import handler from "../../../../../pages/api/v1/db/update-nhl-shift-charts";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    headersSent: false,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
  };
  return res;
}

function createGamesTableMock(
  rows: Array<{
    id: number;
    date: string;
    seasonId: number;
    startTime: string;
  }>,
) {
  const chain: any = {};

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn((from: number, to: number) =>
    Promise.resolve({
      data: rows.slice(from, to + 1),
      error: null,
    }),
  );

  return chain;
}

function createGameIdTableMock(
  rows: Array<{
    game_id: number;
    season_id: number;
    status: string;
    parser_fingerprint: string;
    observed_roster_rows: number | null;
    observed_event_rows: number | null;
    observed_shift_rows: number | null;
  }>,
) {
  const chain: any = {};
  const equalityFilters: Array<{ column: string; value: string | number }> = [];
  const greaterThanFilters: Array<{ column: string; value: number }> = [];

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn((column: string, value: string | number) => {
    equalityFilters.push({ column, value });
    return chain;
  });
  chain.gt = vi.fn((column: string, value: number) => {
    greaterThanFilters.push({ column, value });
    return chain;
  });
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn((from: number, to: number) =>
    Promise.resolve({
      data: rows
        .filter(
          (row) =>
            equalityFilters.every(
              ({ column, value }) => row[column as keyof typeof row] === value,
            ) &&
            greaterThanFilters.every(({ column, value }) => {
              const candidate = row[column as keyof typeof row];
              return (
                candidate != null &&
                Number.isFinite(Number(candidate)) &&
                Number(candidate) > value
              );
            }),
        )
        .slice(from, to + 1),
      error: null,
    }),
  );

  return chain;
}

function createCompleteNormalizationRow(
  gameId: number,
  overrides: Partial<{
    season_id: number;
    status: string;
    parser_fingerprint: string;
    observed_roster_rows: number | null;
    observed_event_rows: number | null;
    observed_shift_rows: number | null;
  }> = {},
) {
  return {
    game_id: gameId,
    season_id: 20252026,
    status: "complete",
    parser_fingerprint: "f".repeat(64),
    observed_roster_rows: 40,
    observed_event_rows: 300,
    observed_shift_rows: 700,
    ...overrides,
  };
}

function createRawPayloadTableMock(
  rowsByEndpoint: Record<string, Array<{ game_id: number }>>,
) {
  const filters: { endpoint?: string } = {};
  const chain: any = {};

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn((column: string, value: string | number) => {
    if (column === "endpoint") {
      filters.endpoint = String(value);
    }
    return chain;
  });
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn((from: number, to: number) =>
    Promise.resolve({
      data: (rowsByEndpoint[filters.endpoint ?? ""] ?? []).slice(from, to + 1),
      error: null,
    }),
  );

  return chain;
}

describe("/api/v1/db/update-nhl-shift-charts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T18:00:00.000Z"));
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20252026 });

    const gamesTable = createGamesTableMock([
      {
        id: 2025021204,
        date: "2026-04-02",
        startTime: "2026-04-03T02:30:00+00:00",
        seasonId: 20252026,
      },
      {
        id: 2025021190,
        date: "2026-04-01",
        startTime: "2026-04-02T01:00:00+00:00",
        seasonId: 20252026,
      },
      {
        id: 2025021090,
        date: "2026-03-20",
        startTime: "2026-03-21T00:00:00+00:00",
        seasonId: 20252026,
      },
      {
        id: 2025021089,
        date: "2026-03-19",
        startTime: "2026-03-20T00:00:00+00:00",
        seasonId: 20252026,
      },
      {
        id: 2025021088,
        date: "2026-03-18",
        startTime: "2026-03-19T00:00:00+00:00",
        seasonId: 20252026,
      },
    ]);

    serviceRoleFromMock.mockImplementation((table: string) => {
      if (table === "games") {
        return gamesTable;
      }

      if (table === "nhl_api_game_payloads_raw") {
        return createRawPayloadTableMock({
          "play-by-play": [{ game_id: 2025021089 }, { game_id: 2025021088 }],
          boxscore: [{ game_id: 2025021089 }, { game_id: 2025021088 }],
          landing: [{ game_id: 2025021089 }, { game_id: 2025021088 }],
          shiftcharts: [{ game_id: 2025021088 }],
        });
      }

      if (table === "nhl_api_game_normalization_status") {
        return createGameIdTableMock([
          createCompleteNormalizationRow(2025021089),
          createCompleteNormalizationRow(2025021088),
        ]);
      }

      throw new Error(`Unexpected table access: ${table}`);
    });

    ingestNhlApiRawGamesMock.mockResolvedValue([
      {
        gameId: 2025021090,
        rosterCount: 40,
        eventCount: 358,
        shiftCount: 720,
        rawEndpointsStored: 4,
        idempotent: false,
      },
      {
        gameId: 2025021089,
        rosterCount: 40,
        eventCount: 299,
        shiftCount: 782,
        rawEndpointsStored: 4,
        idempotent: false,
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a missing-coverage backfill batch and skips future, same-day, and fully covered games", async () => {
    const req: any = {
      method: "POST",
      query: {
        backfill: "true",
        seasonId: "20252026",
        limit: "2",
      },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(serviceRoleFromMock).toHaveBeenCalledWith("games");
    expect(serviceRoleFromMock).toHaveBeenCalledWith(
      "nhl_api_game_payloads_raw",
    );
    expect(serviceRoleFromMock).toHaveBeenCalledWith(
      "nhl_api_game_normalization_status",
    );
    expect(serviceRoleFromMock).not.toHaveBeenCalledWith("nhl_api_pbp_events");
    expect(serviceRoleFromMock).not.toHaveBeenCalledWith("nhl_api_shift_rows");
    expect(ingestNhlApiRawGamesMock).toHaveBeenCalledWith(
      expect.anything(),
      [2025021090, 2025021089],
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      route: "/api/v1/db/update-nhl-shift-charts",
      routeAlias: "shift-charts",
      mode: "backfill_batch",
      seasonId: 20252026,
      requestedGameCount: 2,
      gameIds: [2025021090, 2025021089],
      rowsUpserted: 2239,
      rowsVerified: 2247,
    });

    const statusCallIndex = serviceRoleFromMock.mock.calls.findIndex(
      ([table]) => table === "nhl_api_game_normalization_status",
    );
    const statusTable =
      serviceRoleFromMock.mock.results[statusCallIndex]?.value;
    expect(statusTable.eq).toHaveBeenCalledWith(
      "parser_fingerprint",
      "f".repeat(64),
    );
    expect(statusTable.gt).toHaveBeenCalledWith("observed_roster_rows", 0);
    expect(statusTable.gt).toHaveBeenCalledWith("observed_event_rows", 0);
    expect(statusTable.gt).toHaveBeenCalledWith("observed_shift_rows", 0);
    expect(statusTable.order).toHaveBeenCalledWith("game_id", {
      ascending: true,
    });
  });

  it("retries a fully captured game when normalized event or shift coverage is empty", async () => {
    const gameId = 2025021088;
    const gamesTable = createGamesTableMock([
      {
        id: gameId,
        date: "2026-03-18",
        startTime: "2026-03-19T00:00:00+00:00",
        seasonId: 20252026,
      },
    ]);
    const rawTable = createRawPayloadTableMock({
      "play-by-play": [{ game_id: gameId }],
      boxscore: [{ game_id: gameId }],
      landing: [{ game_id: gameId }],
      shiftcharts: [{ game_id: gameId }],
    });
    const normalizationTable = createGameIdTableMock([
      createCompleteNormalizationRow(gameId, { observed_event_rows: 0 }),
    ]);

    serviceRoleFromMock.mockImplementation((table: string) => {
      if (table === "games") return gamesTable;
      if (table === "nhl_api_game_payloads_raw") return rawTable;
      if (table === "nhl_api_game_normalization_status") {
        return normalizationTable;
      }
      throw new Error(`Unexpected table access: ${table}`);
    });
    ingestNhlApiRawGamesMock.mockResolvedValue([
      {
        gameId,
        rosterCount: 40,
        eventCount: 300,
        shiftCount: 700,
        rawEndpointsStored: 4,
        idempotent: false,
      },
    ]);

    const req: any = {
      method: "POST",
      query: {
        backfill: "true",
        seasonId: "20252026",
        limit: "1",
      },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(ingestNhlApiRawGamesMock).toHaveBeenCalledWith(expect.anything(), [
      gameId,
    ]);
    expect(normalizationTable.gt).toHaveBeenCalledWith(
      "observed_roster_rows",
      0,
    );
    expect(normalizationTable.gt).toHaveBeenCalledWith(
      "observed_event_rows",
      0,
    );
    expect(normalizationTable.gt).toHaveBeenCalledWith(
      "observed_shift_rows",
      0,
    );
  });

  it("retries when manifest equality or non-null count predicates do not qualify", async () => {
    const gameId = 2025021088;
    const gamesTable = createGamesTableMock([
      {
        id: gameId,
        date: "2026-03-18",
        startTime: "2026-03-19T00:00:00+00:00",
        seasonId: 20252026,
      },
    ]);
    const rawTable = createRawPayloadTableMock({
      "play-by-play": [{ game_id: gameId }],
      boxscore: [{ game_id: gameId }],
      landing: [{ game_id: gameId }],
      shiftcharts: [{ game_id: gameId }],
    });
    const normalizationTable = createGameIdTableMock([
      createCompleteNormalizationRow(gameId, { season_id: 20242025 }),
      createCompleteNormalizationRow(gameId, { status: "stale" }),
      createCompleteNormalizationRow(gameId, {
        parser_fingerprint: "e".repeat(64),
      }),
      createCompleteNormalizationRow(gameId, {
        observed_shift_rows: null,
      }),
    ]);

    serviceRoleFromMock.mockImplementation((table: string) => {
      if (table === "games") return gamesTable;
      if (table === "nhl_api_game_payloads_raw") return rawTable;
      if (table === "nhl_api_game_normalization_status") {
        return normalizationTable;
      }
      throw new Error(`Unexpected table access: ${table}`);
    });
    ingestNhlApiRawGamesMock.mockResolvedValue([
      {
        gameId,
        rosterCount: 40,
        eventCount: 300,
        shiftCount: 700,
        rawEndpointsStored: 4,
        idempotent: false,
      },
    ]);

    const req: any = {
      method: "POST",
      query: {
        backfill: "true",
        seasonId: "20252026",
        limit: "1",
      },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(ingestNhlApiRawGamesMock).toHaveBeenCalledWith(expect.anything(), [
      gameId,
    ]);
    expect(normalizationTable.eq).toHaveBeenCalledWith("season_id", 20252026);
    expect(normalizationTable.eq).toHaveBeenCalledWith("status", "complete");
    expect(normalizationTable.eq).toHaveBeenCalledWith(
      "parser_fingerprint",
      "f".repeat(64),
    );
  });

  it("reads the second raw and manifest pages before deciding coverage is complete", async () => {
    const gameId = 2025021088;
    const firstPage = Array.from({ length: 1000 }, (_, index) =>
      createCompleteNormalizationRow(1000000000 + index),
    );
    const allCoverageRows = [
      ...firstPage,
      createCompleteNormalizationRow(gameId),
    ];
    const gamesTable = createGamesTableMock([
      {
        id: gameId,
        date: "2026-03-18",
        startTime: "2026-03-19T00:00:00+00:00",
        seasonId: 20252026,
      },
    ]);
    const rawTables: any[] = [];
    const normalizationTable = createGameIdTableMock(allCoverageRows);

    serviceRoleFromMock.mockImplementation((table: string) => {
      if (table === "games") return gamesTable;
      if (table === "nhl_api_game_payloads_raw") {
        const rawTable = createRawPayloadTableMock({
          "play-by-play": allCoverageRows,
          boxscore: allCoverageRows,
          landing: allCoverageRows,
          shiftcharts: allCoverageRows,
        });
        rawTables.push(rawTable);
        return rawTable;
      }
      if (table === "nhl_api_game_normalization_status") {
        return normalizationTable;
      }
      throw new Error(`Unexpected table access: ${table}`);
    });

    const req: any = {
      method: "POST",
      query: {
        backfill: "true",
        seasonId: "20252026",
        limit: "1",
      },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(ingestNhlApiRawGamesMock).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: true,
      requestedGameCount: 0,
      rowsUpserted: 0,
      rowsVerified: 0,
    });
    expect(normalizationTable.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(normalizationTable.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    const rawRangeCalls = rawTables.flatMap((rawTable) =>
      rawTable.range.mock.calls.map((call: unknown[]) => call),
    );
    expect(
      rawRangeCalls.filter(([from, to]) => from === 0 && to === 999),
    ).toHaveLength(4);
    expect(
      rawRangeCalls.filter(([from, to]) => from === 1000 && to === 1999),
    ).toHaveLength(4);
  });

  it("paginates an explicit date range beyond 1,000 games", async () => {
    const games = Array.from({ length: 1100 }, (_, index) => ({
      id: 2020000000 + index,
      date: "2026-01-01",
      startTime: "2026-01-01T12:00:00+00:00",
      seasonId: 20252026,
    }));
    const gamesTable = createGamesTableMock(games);
    serviceRoleFromMock.mockImplementation((table: string) => {
      if (table === "games") return gamesTable;
      throw new Error(`Unexpected table access: ${table}`);
    });
    ingestNhlApiRawGamesMock.mockResolvedValue([]);

    const req: any = {
      method: "POST",
      query: {
        seasonId: "20252026",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        limit: "1001",
      },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(gamesTable.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(gamesTable.range).toHaveBeenNthCalledWith(2, 1000, 1000);
    expect(ingestNhlApiRawGamesMock).toHaveBeenCalledWith(
      expect.anything(),
      games.slice(0, 1001).map((game) => game.id),
    );
    expect(res.body).toMatchObject({
      mode: "date_range",
      requestedGameCount: 1001,
      rowsUpserted: 0,
      rowsVerified: 0,
    });
  });

  it.each([
    ["2026-02-30", "2026-03-01"],
    ["2026-03-02", "2026-03-01"],
    ["2026-03-01", undefined],
  ])(
    "rejects an invalid or incomplete date range before database work (%s, %s)",
    async (startDate, endDate) => {
      const req: any = {
        method: "POST",
        query: { startDate, endDate },
        headers: {},
      };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        rowsUpserted: 0,
        rowsVerified: 0,
      });
      expect(serviceRoleFromMock).not.toHaveBeenCalled();
      expect(getCurrentSeasonMock).not.toHaveBeenCalled();
      expect(ingestNhlApiRawGamesMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    { startDate: "2026-01-01", endDate: "2026-01-02", limit: "0" },
    { startDate: "2026-01-01", endDate: "2026-01-02", limit: "1.5" },
    {
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      limit: ["1", "2"],
    },
    { startDate: "2026-01-01", endDate: "2026-01-02", seasonId: "no" },
    {
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      seasonId: ["20252026", "20242025"],
    },
    { gameId: "1.5" },
    { gameId: ["2025020001", "2025020002"] },
    { startDate: ["2026-01-01", "2026-01-02"], endDate: "2026-01-02" },
  ])(
    "rejects malformed or repeated exact-selection controls before source work: %j",
    async (query) => {
      const req: any = { method: "POST", query, headers: {} };
      const res = createMockRes();

      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        rowsUpserted: 0,
        rowsVerified: 0,
      });
      expect(serviceRoleFromMock).not.toHaveBeenCalled();
      expect(getCurrentSeasonMock).not.toHaveBeenCalled();
      expect(ingestNhlApiRawGamesMock).not.toHaveBeenCalled();
    },
  );

  it("reports an idempotent normalization replay as verified without upserts", async () => {
    const gameId = 2025021088;
    ingestNhlApiRawGamesMock.mockResolvedValue([
      {
        gameId,
        rosterCount: 40,
        eventCount: 300,
        shiftCount: 700,
        rawEndpointsStored: 4,
        idempotent: true,
      },
    ]);

    const req: any = {
      method: "POST",
      query: { seasonId: "20252026", gameId: String(gameId) },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.body).toMatchObject({
      requestedGameCount: 1,
      rowsUpserted: 0,
      rowsVerified: 1044,
    });
  });
});
