import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock,
  warmPlayerStatsLandingSeasonAggregateCacheMock,
  serviceRoleFromMock,
  resolvePlayerStatsIncrementalSelectionMock,
} = vi.hoisted(() => ({
  refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock: vi.fn(),
  warmPlayerStatsLandingSeasonAggregateCacheMock: vi.fn(),
  serviceRoleFromMock: vi.fn(),
  resolvePlayerStatsIncrementalSelectionMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: serviceRoleFromMock,
  },
}));

vi.mock("lib/underlying-stats/playerStatsSummaryRefresh", () => ({
  PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT: "landing",
  PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX:
    "derived://underlying-player-summary-v2/",
  refreshPlayerUnderlyingSummarySnapshotsForGameIds:
    refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock,
  warmPlayerStatsLandingSeasonAggregateCache:
    warmPlayerStatsLandingSeasonAggregateCacheMock,
}));

vi.mock("lib/underlying-stats/playerStatsRefreshWindow", () => ({
  resolvePlayerStatsIncrementalSelection:
    resolvePlayerStatsIncrementalSelectionMock,
}));

import handler from "../../../../../pages/api/v1/db/update-player-underlying-summaries";

function createMockApiContext(args?: {
  method?: string;
  query?: Record<string, string>;
}) {
  const response = {
    statusCode: 200,
    body: null as unknown,
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      response.statusCode = code;
      return response;
    }),
    json: vi.fn((payload: unknown) => {
      response.body = payload;
      return response;
    }),
  };

  return {
    req: {
      method: args?.method ?? "POST",
      query: args?.query ?? {},
      headers: {},
    },
    res: response,
  };
}

describe("/api/v1/db/update-player-underlying-summaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock.mockResolvedValue({
      rowsUpserted: 1,
      migratedGameIds: [],
      rawBuildGameIds: [2025020955],
    });
    warmPlayerStatsLandingSeasonAggregateCacheMock.mockResolvedValue(undefined);
    resolvePlayerStatsIncrementalSelectionMock.mockResolvedValue({
      mode: "incremental",
      seasonId: 20252026,
      requestedGameType: 2,
      startDate: "2026-04-04",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-04-04",
      gameIds: [2025021184, 2025021196],
    });

    serviceRoleFromMock.mockImplementation((table: string) => {
      if (table === "nhl_api_game_payloads_raw") {
        const filters: { endpoint?: string; sourceUrlPrefix?: string } = {};
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn((column: string, value: string | number) => {
            if (column === "endpoint") {
              filters.endpoint = String(value);
            }
            return chain;
          }),
          like: vi.fn((column: string, value: string) => {
            if (column === "source_url") {
              filters.sourceUrlPrefix = value.replace(/%$/, "");
            }
            return chain;
          }),
          in: vi.fn(() => chain),
          order: vi.fn(() => chain),
          range: vi.fn((from: number) => {
            const rows =
              filters.endpoint === "landing" &&
              filters.sourceUrlPrefix === "derived://underlying-player-summary/"
                ? []
                : [];
            return Promise.resolve({
              data: from === 0 ? rows : [],
              error: null,
            });
          }),
          upsert: vi.fn(async () => ({ error: null })),
        };
        return chain;
      }

      if (table === "games") {
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          lte: vi.fn(() => chain),
          order: vi.fn(() => chain),
          range: vi.fn((from: number) =>
            Promise.resolve({
              data:
                from === 0
                  ? [
                      {
                        id: 2025020955,
                        date: "2026-03-02",
                        startTime: "2026-03-03T00:00:00+00:00",
                        seasonId: 20252026,
                      },
                    ]
                  : [],
              error: null,
            })
          ),
        };
        return chain;
      }

      if (table === "nhl_api_pbp_events" || table === "nhl_api_shift_rows") {
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          range: vi.fn((from: number) =>
            Promise.resolve({
              data: from === 0 ? [{ game_id: 2025020955 }] : [],
              error: null,
            })
          ),
        };
        return chain;
      }

      throw new Error(`Unexpected table access: ${table}`);
    });
  });

  it("builds and stores compact per-game underlying summary snapshots", async () => {
    const { req, res } = createMockApiContext({
      query: {
        backfill: "true",
        seasonId: "20252026",
        limit: "1",
      },
    });

    await handler(req as never, res as never);

    expect(refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock).toHaveBeenCalledWith({
      gameIds: [2025020955],
      seasonId: 20252026,
      requestedGameType: null,
      shouldMigrateLegacySummaries: true,
      shouldWarmLandingCache: false,
      supabase: expect.anything(),
    });
    expect(serviceRoleFromMock).toHaveBeenCalledWith("nhl_api_game_payloads_raw");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-player-underlying-summaries",
      mode: "backfill_batch",
      seasonId: 20252026,
      requestedGameCount: 1,
      gameIds: [2025020955],
      rowsUpserted: 1,
    });
  });

  it("migrates existing legacy summary payloads into v2 partitions without rebuilding raw game inputs", async () => {
    serviceRoleFromMock.mockImplementation((table: string) => {
      if (table === "nhl_api_game_payloads_raw") {
        const filters: { endpoint?: string; sourceUrlPrefix?: string } = {};
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn((column: string, value: string | number) => {
            if (column === "endpoint") {
              filters.endpoint = String(value);
            }
            return chain;
          }),
          like: vi.fn((column: string, value: string) => {
            if (column === "source_url") {
              filters.sourceUrlPrefix = value.replace(/%$/, "");
            }
            return chain;
          }),
          in: vi.fn(() => chain),
          order: vi.fn(() => chain),
          range: vi.fn((from: number) =>
            Promise.resolve({
              data:
                from === 0 &&
                filters.endpoint === "landing" &&
                filters.sourceUrlPrefix === "derived://underlying-player-summary/"
                  ? [
                      {
                        game_id: 2025020955,
                        fetched_at: "2026-04-02T00:00:00.000Z",
                        source_url: "derived://underlying-player-summary/2025020955",
                        payload: {
                          version: 1,
                          generatedAt: "2026-04-02T00:00:00.000Z",
                          game: {
                            id: 2025020955,
                            seasonId: 20252026,
                            date: "2026-03-02",
                            homeTeamId: 27,
                            awayTeamId: 17,
                          },
                          rows: [],
                        },
                      },
                    ]
                  : [],
              error: null,
            })
          ),
          upsert: vi.fn(async () => ({ error: null })),
        };
        return chain;
      }

      if (table === "games") {
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          lte: vi.fn(() => chain),
          order: vi.fn(() => chain),
          range: vi.fn((from: number) =>
            Promise.resolve({
              data:
                from === 0
                  ? [
                      {
                        id: 2025020955,
                        date: "2026-03-02",
                        startTime: "2026-03-03T00:00:00+00:00",
                        seasonId: 20252026,
                      },
                    ]
                  : [],
              error: null,
            })
          ),
        };
        return chain;
      }

      throw new Error(`Unexpected table access: ${table}`);
    });

    const { req, res } = createMockApiContext({
      query: {
        backfill: "true",
        seasonId: "20252026",
        limit: "1",
      },
    });

    await handler(req as never, res as never);

    expect(refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock).toHaveBeenCalledWith({
      gameIds: [2025020955],
      seasonId: 20252026,
      requestedGameType: null,
      shouldMigrateLegacySummaries: true,
      shouldWarmLandingCache: false,
      supabase: expect.anything(),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-player-underlying-summaries",
      mode: "backfill_batch",
      seasonId: 20252026,
      requestedGameCount: 1,
      gameIds: [2025020955],
      rowsUpserted: 1,
    });
  });

  it("rebuilds explicit game refreshes from raw inputs instead of remigrating legacy payloads", async () => {
    const { req, res } = createMockApiContext({
      query: {
        gameId: "2025020955",
      },
    });

    await handler(req as never, res as never);

    expect(refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock).toHaveBeenCalledWith({
      gameIds: [2025020955],
      seasonId: null,
      requestedGameType: null,
      shouldMigrateLegacySummaries: false,
      shouldWarmLandingCache: false,
      supabase: expect.objectContaining({
        from: expect.any(Function),
      }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-player-underlying-summaries",
      mode: "game",
      seasonId: null,
      requestedGameCount: 1,
      gameIds: [2025020955],
      rowsUpserted: 1,
    });
  });

  it("backfill defaults to regular-season games so preseason leftovers do not keep the loop alive", async () => {
    serviceRoleFromMock.mockImplementation((table: string) => {
      if (table === "nhl_api_game_payloads_raw") {
        const filters: { endpoint?: string; sourceUrlPrefix?: string } = {};
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn((column: string, value: string | number) => {
            if (column === "endpoint") {
              filters.endpoint = String(value);
            }
            return chain;
          }),
          like: vi.fn((column: string, value: string) => {
            if (column === "source_url") {
              filters.sourceUrlPrefix = value.replace(/%$/, "");
            }
            return chain;
          }),
          in: vi.fn(() => chain),
          order: vi.fn(() => chain),
          range: vi.fn((from: number) =>
            Promise.resolve({
              data:
                from === 0 &&
                filters.endpoint === "landing" &&
                filters.sourceUrlPrefix === "derived://underlying-player-summary-v2/"
                  ? [{ game_id: 2025020955 }]
                  : [],
              error: null,
            })
          ),
          upsert: vi.fn(async () => ({ error: null })),
        };
        return chain;
      }

      if (table === "games") {
        const filters: { type?: number } = {};
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn((column: string, value: string | number) => {
            if (column === "type") {
              filters.type = Number(value);
            }
            return chain;
          }),
          lte: vi.fn(() => chain),
          order: vi.fn(() => chain),
          range: vi.fn((from: number) =>
            Promise.resolve({
              data:
                from === 0 && filters.type === 2
                  ? [
                      {
                        id: 2025020955,
                        date: "2026-03-02",
                        startTime: "2026-03-03T00:00:00+00:00",
                        seasonId: 20252026,
                        type: 2,
                      },
                    ]
                  : [],
              error: null,
            })
          ),
        };
        return chain;
      }

      throw new Error(`Unexpected table access: ${table}`);
    });

    const { req, res } = createMockApiContext({
      query: {
        backfill: "true",
        seasonId: "20252026",
        limit: "10",
      },
    });

    refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock.mockResolvedValue({
      rowsUpserted: 0,
      migratedGameIds: [],
      rawBuildGameIds: [],
    });

    await handler(req as never, res as never);

    expect(refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock).toHaveBeenCalledWith({
      gameIds: [],
      seasonId: 20252026,
      requestedGameType: null,
      shouldMigrateLegacySummaries: true,
      shouldWarmLandingCache: false,
      supabase: expect.anything(),
    });
    expect(warmPlayerStatsLandingSeasonAggregateCacheMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-player-underlying-summaries",
      mode: "backfill_batch",
      seasonId: 20252026,
      requestedGameCount: 0,
      gameIds: [],
      rowsUpserted: 0,
    });
  });

  it("supports incremental summary catch-up from the latest covered date through current finished games", async () => {
    refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock.mockResolvedValue({
      rowsUpserted: 2,
      migratedGameIds: [],
      rawBuildGameIds: [2025021184, 2025021196],
    });

    const { req, res } = createMockApiContext({
      query: {
        incremental: "true",
        warmLandingCache: "true",
      },
    });

    await handler(req as never, res as never);

    expect(resolvePlayerStatsIncrementalSelectionMock).toHaveBeenCalledWith({
      seasonId: null,
      requestedGameType: null,
      supabase: expect.objectContaining({
        from: expect.any(Function),
      }),
    });
    expect(refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock).toHaveBeenCalledWith({
      gameIds: [2025021184, 2025021196],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldMigrateLegacySummaries: false,
      shouldWarmLandingCache: false,
      supabase: expect.objectContaining({
        from: expect.any(Function),
      }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-player-underlying-summaries",
      mode: "incremental",
      seasonId: 20252026,
      startDate: "2026-04-04",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-04-04",
      requestedGameCount: 2,
      gameIds: [2025021184, 2025021196],
      rowsUpserted: 2,
    });
    expect(warmPlayerStatsLandingSeasonAggregateCacheMock).toHaveBeenCalledWith({
      seasonId: 20252026,
      gameType: 2,
      supabase: expect.objectContaining({
        from: expect.any(Function),
      }),
    });
  });

  it("supports batched catch-up mode for incremental summary refreshes", async () => {
    resolvePlayerStatsIncrementalSelectionMock.mockResolvedValue({
      mode: "incremental",
      seasonId: 20252026,
      requestedGameType: 2,
      startDate: "2026-04-04",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-04-04",
      gameIds: [2025021184, 2025021196, 2025021197],
    });
    refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock
      .mockResolvedValueOnce({
        rowsUpserted: 2,
        migratedGameIds: [],
        rawBuildGameIds: [2025021184, 2025021196],
      })
      .mockResolvedValueOnce({
        rowsUpserted: 1,
        migratedGameIds: [],
        rawBuildGameIds: [2025021197],
      });

    const { req, res } = createMockApiContext({
      query: {
        incremental: "true",
        catchUp: "true",
        batchSize: "2",
        warmLandingCache: "true",
      },
    });

    await handler(req as never, res as never);

    expect(refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock).toHaveBeenNthCalledWith(1, {
      gameIds: [2025021184, 2025021196],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldMigrateLegacySummaries: false,
      shouldWarmLandingCache: false,
      supabase: expect.objectContaining({
        from: expect.any(Function),
      }),
    });
    expect(refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock).toHaveBeenNthCalledWith(2, {
      gameIds: [2025021197],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldMigrateLegacySummaries: false,
      shouldWarmLandingCache: false,
      supabase: expect.objectContaining({
        from: expect.any(Function),
      }),
    });
    expect(warmPlayerStatsLandingSeasonAggregateCacheMock).toHaveBeenCalledWith({
      seasonId: 20252026,
      gameType: 2,
      supabase: expect.objectContaining({
        from: expect.any(Function),
      }),
    });
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-player-underlying-summaries",
      mode: "incremental",
      seasonId: 20252026,
      startDate: "2026-04-04",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-04-04",
      catchUpCompleted: true,
      batchSize: 2,
      batchesProcessed: 2,
      requestedGameCount: 3,
      gameIds: [2025021184, 2025021196, 2025021197],
      rowsUpserted: 3,
    });
  });
});
