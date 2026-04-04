import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ingestNhlApiRawGamesMock, serviceRoleFromMock } = vi.hoisted(() => ({
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
  getCurrentSeason: vi.fn(async () => ({ seasonId: 20252026 })),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: serviceRoleFromMock,
  },
}));

vi.mock("lib/supabase/Upserts/nhlRawGamecenter.mjs", () => ({
  ingestNhlApiRawGames: ingestNhlApiRawGamesMock,
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
  rows: Array<{ id: number; date: string; seasonId: number; startTime: string }>
) {
  const chain: any = {};

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn((from: number) =>
    Promise.resolve({
      data: from === 0 ? rows : [],
      error: null,
    })
  );

  return chain;
}

function createGameIdTableMock(rows: Array<{ game_id: number }>) {
  const chain: any = {};

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.range = vi.fn((from: number) =>
    Promise.resolve({
      data: from === 0 ? rows : [],
      error: null,
    })
  );

  return chain;
}

function createRawPayloadTableMock(
  rowsByEndpoint: Record<string, Array<{ game_id: number }>>
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
  chain.range = vi.fn((from: number) =>
    Promise.resolve({
      data: from === 0 ? rowsByEndpoint[filters.endpoint ?? ""] ?? [] : [],
      error: null,
    })
  );

  return chain;
}

describe("/api/v1/db/update-nhl-shift-charts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T18:00:00.000Z"));

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

      if (table === "nhl_api_pbp_events") {
        return createGameIdTableMock([
          { game_id: 2025021089 },
          { game_id: 2025021088 },
        ]);
      }

      if (table === "nhl_api_shift_rows") {
        return createGameIdTableMock([{ game_id: 2025021088 }]);
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
      },
      {
        gameId: 2025021089,
        rosterCount: 40,
        eventCount: 299,
        shiftCount: 782,
        rawEndpointsStored: 4,
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
    expect(serviceRoleFromMock).toHaveBeenCalledWith("nhl_api_game_payloads_raw");
    expect(serviceRoleFromMock).toHaveBeenCalledWith("nhl_api_pbp_events");
    expect(serviceRoleFromMock).toHaveBeenCalledWith("nhl_api_shift_rows");
    expect(ingestNhlApiRawGamesMock).toHaveBeenCalledWith(
      expect.anything(),
      [2025021090, 2025021089]
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
      rowsUpserted: 2247,
    });
  });
});
