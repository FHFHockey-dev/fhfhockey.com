import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveRequestedGameIdsMock,
  ingestNhlApiRawGamesBestEffortMock,
  refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock,
  resolvePlayerStatsIncrementalSelectionMock,
} = vi.hoisted(() => ({
  resolveRequestedGameIdsMock: vi.fn(),
  ingestNhlApiRawGamesBestEffortMock: vi.fn(),
  refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock: vi.fn(),
  resolvePlayerStatsIncrementalSelectionMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/supabase/server", () => ({
  default: {},
}));

vi.mock("lib/supabase/Upserts/nhlRawGamecenterRoute", () => ({
  resolveRequestedGameIds: resolveRequestedGameIdsMock,
}));

vi.mock("lib/supabase/Upserts/nhlRawGamecenter.mjs", () => ({
  ingestNhlApiRawGamesBestEffort: ingestNhlApiRawGamesBestEffortMock,
}));

vi.mock("lib/underlying-stats/playerStatsSummaryRefresh", () => ({
  refreshPlayerUnderlyingSummarySnapshotsForGameIds:
    refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock,
}));

vi.mock("lib/underlying-stats/playerStatsRefreshWindow", () => ({
  resolvePlayerStatsIncrementalSelection:
    resolvePlayerStatsIncrementalSelectionMock,
}));

import handler from "../../../../../pages/api/v1/db/update-player-underlying-stats";

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

describe("/api/v1/db/update-player-underlying-stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    resolveRequestedGameIdsMock.mockResolvedValue({
      mode: "game",
      seasonId: 20252026,
      gameIds: [2025020955],
    });
    ingestNhlApiRawGamesBestEffortMock.mockResolvedValue({
      results: [
        {
          gameId: 2025020955,
          rosterCount: 40,
          eventCount: 326,
          shiftCount: 774,
          rawEndpointsStored: 4,
        },
      ],
      failures: [],
    });
    refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock.mockResolvedValue({
      rowsUpserted: 1,
      migratedGameIds: [],
      rawBuildGameIds: [2025020955],
    });
    resolvePlayerStatsIncrementalSelectionMock.mockResolvedValue({
      mode: "incremental",
      seasonId: 20252026,
      requestedGameType: 2,
      startDate: "2026-04-04",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-04-04",
      gameIds: [2025021184, 2025021196],
    });
  });

  it("refreshes raw gamecenter inputs and per-game player summaries for one game", async () => {
    const { req, res } = createMockApiContext({
      query: {
        gameId: "2025020955",
      },
    });

    await handler(req as never, res as never);

    expect(resolveRequestedGameIdsMock).toHaveBeenCalledWith(req.query, {});
    expect(ingestNhlApiRawGamesBestEffortMock).toHaveBeenCalledWith({}, [2025020955]);
    expect(refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock).toHaveBeenCalledWith({
      gameIds: [2025020955],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: true,
      shouldMigrateLegacySummaries: false,
      supabase: {},
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-player-underlying-stats",
      mode: "game",
      seasonId: 20252026,
      requestedGameCount: 1,
      processedGameCount: 1,
      failedGameCount: 0,
      gameIds: [2025020955],
      rawRowsUpserted: 1144,
      summaryRowsUpserted: 1,
      rowsUpserted: 1145,
      warmedLandingCache: true,
      results: [
        {
          gameId: 2025020955,
          rosterCount: 40,
          eventCount: 326,
          shiftCount: 774,
          rawEndpointsStored: 4,
        },
      ],
      message:
        "Player underlying stats ingest completed. Raw NHL gamecenter payloads were refreshed first, then per-game player underlying summaries were rebuilt.",
    });
  });

  it("returns early when the selection resolves to no games", async () => {
    resolveRequestedGameIdsMock.mockResolvedValue({
      mode: "date_range",
      seasonId: 20252026,
      gameIds: [],
    });

    const { req, res } = createMockApiContext({
      query: {
        startDate: "2026-04-02",
        endDate: "2026-04-02",
      },
    });

    await handler(req as never, res as never);

    expect(ingestNhlApiRawGamesBestEffortMock).not.toHaveBeenCalled();
    expect(refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-player-underlying-stats",
      mode: "date_range",
      seasonId: 20252026,
      requestedGameCount: 0,
      gameIds: [],
      rawRowsUpserted: 0,
      summaryRowsUpserted: 0,
      rowsUpserted: 0,
      warmedLandingCache: false,
      results: [],
      message: "No matching games found for the requested selection.",
    });
  });

  it("supports incremental refresh from the latest covered date through current finished games", async () => {
    ingestNhlApiRawGamesBestEffortMock.mockResolvedValue({
      results: [
        {
          gameId: 2025021184,
          rosterCount: 80,
          eventCount: 600,
          shiftCount: 1200,
          rawEndpointsStored: 8,
        },
      ],
      failures: [],
    });
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

    expect(resolveRequestedGameIdsMock).not.toHaveBeenCalled();
    expect(resolvePlayerStatsIncrementalSelectionMock).toHaveBeenCalledWith({
      seasonId: null,
      requestedGameType: null,
      supabase: {},
    });
    expect(refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock).toHaveBeenCalledWith({
      gameIds: [2025021184],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: true,
      shouldMigrateLegacySummaries: false,
      supabase: {},
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-player-underlying-stats",
      mode: "incremental",
      seasonId: 20252026,
      startDate: "2026-04-04",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-04-04",
      requestedGameCount: 2,
      processedGameCount: 1,
      failedGameCount: 0,
      gameIds: [2025021184, 2025021196],
      rawRowsUpserted: 1888,
      summaryRowsUpserted: 2,
      rowsUpserted: 1890,
      warmedLandingCache: true,
      results: [
        {
          gameId: 2025021184,
          rosterCount: 80,
          eventCount: 600,
          shiftCount: 1200,
          rawEndpointsStored: 8,
        },
      ],
      message:
        "Player underlying stats ingest completed. Raw NHL gamecenter payloads were refreshed first, then per-game player underlying summaries were rebuilt.",
    });
  });

  it("supports batched catch-up mode for incremental refreshes", async () => {
    resolvePlayerStatsIncrementalSelectionMock.mockResolvedValue({
      mode: "incremental",
      seasonId: 20252026,
      requestedGameType: 2,
      startDate: "2026-04-04",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-04-04",
      gameIds: [2025021184, 2025021196, 2025021197],
    });
    ingestNhlApiRawGamesBestEffortMock
      .mockResolvedValueOnce({
        results: [
          {
            gameId: 2025021184,
            rosterCount: 10,
            eventCount: 20,
            shiftCount: 30,
            rawEndpointsStored: 4,
          },
          {
            gameId: 2025021196,
            rosterCount: 40,
            eventCount: 50,
            shiftCount: 60,
            rawEndpointsStored: 4,
          },
        ],
        failures: [],
      })
      .mockResolvedValueOnce({
        results: [
          {
            gameId: 2025021197,
            rosterCount: 70,
            eventCount: 80,
            shiftCount: 90,
            rawEndpointsStored: 4,
          },
        ],
        failures: [],
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

    expect(ingestNhlApiRawGamesBestEffortMock).toHaveBeenNthCalledWith(1, {}, [
      2025021184,
      2025021196,
    ]);
    expect(ingestNhlApiRawGamesBestEffortMock).toHaveBeenNthCalledWith(2, {}, [2025021197]);
    expect(refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock).toHaveBeenNthCalledWith(1, {
      gameIds: [2025021184, 2025021196],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: false,
      shouldMigrateLegacySummaries: false,
      supabase: {},
    });
    expect(refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock).toHaveBeenNthCalledWith(2, {
      gameIds: [2025021197],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: true,
      shouldMigrateLegacySummaries: false,
      supabase: {},
    });
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-player-underlying-stats",
      mode: "incremental",
      seasonId: 20252026,
      startDate: "2026-04-04",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-04-04",
      catchUpCompleted: true,
      batchSize: 2,
      batchesProcessed: 2,
      requestedGameCount: 3,
      processedGameCount: 3,
      failedGameCount: 0,
      gameIds: [2025021184, 2025021196, 2025021197],
      rawRowsUpserted: 462,
      summaryRowsUpserted: 3,
      rowsUpserted: 465,
      warmedLandingCache: true,
      results: [
        {
          gameId: 2025021184,
          rosterCount: 10,
          eventCount: 20,
          shiftCount: 30,
          rawEndpointsStored: 4,
        },
        {
          gameId: 2025021196,
          rosterCount: 40,
          eventCount: 50,
          shiftCount: 60,
          rawEndpointsStored: 4,
        },
        {
          gameId: 2025021197,
          rosterCount: 70,
          eventCount: 80,
          shiftCount: 90,
          rawEndpointsStored: 4,
        },
      ],
      message:
        "Player underlying stats ingest completed. Raw NHL gamecenter payloads were refreshed first, then per-game player underlying summaries were rebuilt.",
    });
  });

  it("returns partial success details when one or more games fail during catch-up", async () => {
    resolvePlayerStatsIncrementalSelectionMock.mockResolvedValue({
      mode: "incremental",
      seasonId: 20252026,
      requestedGameType: 2,
      startDate: "2026-04-04",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-04-04",
      gameIds: [2025021184, 2025021196],
    });
    ingestNhlApiRawGamesBestEffortMock.mockResolvedValue({
      results: [
        {
          gameId: 2025021184,
          rosterCount: 10,
          eventCount: 20,
          shiftCount: 30,
          rawEndpointsStored: 4,
        },
      ],
      failures: [{ gameId: 2025021196, message: "TypeError: fetch failed" }],
    });
    refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock.mockResolvedValue({
      rowsUpserted: 1,
      migratedGameIds: [],
      rawBuildGameIds: [2025021184],
    });

    const { req, res } = createMockApiContext({
      query: {
        incremental: "true",
        catchUp: "true",
        warmLandingCache: "true",
      },
    });

    await handler(req as never, res as never);

    expect(refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock).toHaveBeenCalledWith({
      gameIds: [2025021184],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: false,
      shouldMigrateLegacySummaries: false,
      supabase: {},
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-player-underlying-stats",
      mode: "incremental",
      seasonId: 20252026,
      startDate: "2026-04-04",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-04-04",
      catchUpCompleted: false,
      batchSize: 5,
      batchesProcessed: 1,
      requestedGameCount: 2,
      processedGameCount: 1,
      failedGameCount: 1,
      failedGameIds: [2025021196],
      failures: [{ gameId: 2025021196, message: "TypeError: fetch failed" }],
      gameIds: [2025021184, 2025021196],
      rawRowsUpserted: 64,
      summaryRowsUpserted: 1,
      rowsUpserted: 65,
      warmedLandingCache: false,
      results: [
        {
          gameId: 2025021184,
          rosterCount: 10,
          eventCount: 20,
          shiftCount: 30,
          rawEndpointsStored: 4,
        },
      ],
      message:
        "Player underlying stats ingest completed with partial failures. Successful games were refreshed and summarized; failed games can be retried with the same URL.",
    });
  });
});
