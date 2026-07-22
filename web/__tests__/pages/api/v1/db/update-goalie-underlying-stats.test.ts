import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveRequestedGameIdsMock,
  ingestNhlApiRawGamesBestEffortMock,
  refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock,
  resolveGoalieStatsIncrementalSelectionMock,
} = vi.hoisted(() => ({
  resolveRequestedGameIdsMock: vi.fn(),
  ingestNhlApiRawGamesBestEffortMock: vi.fn(),
  refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock: vi.fn(),
  resolveGoalieStatsIncrementalSelectionMock: vi.fn(),
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

vi.mock("lib/underlying-stats/goalieStatsSummaryRefresh", () => ({
  refreshGoalieUnderlyingSummarySnapshotsForGameIds:
    refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock,
}));

vi.mock("lib/underlying-stats/goalieStatsRefreshWindow", () => ({
  resolveGoalieStatsIncrementalSelection:
    resolveGoalieStatsIncrementalSelectionMock,
}));

import handler from "../../../../../pages/api/v1/db/update-goalie-underlying-stats";

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

describe("/api/v1/db/update-goalie-underlying-stats", () => {
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
          idempotent: false,
        },
      ],
      failures: [],
    });
    refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock.mockResolvedValue({
      rowsUpserted: 6,
      seededGameIds: [],
      rawBuildGameIds: [2025020955],
    });
    resolveGoalieStatsIncrementalSelectionMock.mockResolvedValue({
      mode: "incremental",
      seasonId: 20252026,
      requestedGameType: 2,
      startDate: "2026-04-04",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-04-04",
      gameIds: [2025021184, 2025021196],
    });
  });

  it("refreshes raw gamecenter inputs and dedicated goalie summaries for one game", async () => {
    const { req, res } = createMockApiContext({
      query: {
        gameId: "2025020955",
      },
    });

    await handler(req as never, res as never);

    expect(resolveRequestedGameIdsMock).toHaveBeenCalledWith(req.query, {});
    expect(ingestNhlApiRawGamesBestEffortMock).toHaveBeenCalledWith({}, [2025020955]);
    expect(
      refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock
    ).toHaveBeenCalledWith({
      gameIds: [2025020955],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: true,
      preferSharedSnapshotSeed: false,
      supabase: {},
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-goalie-underlying-stats",
      mode: "game",
      seasonId: 20252026,
      requestedGameCount: 1,
      processedGameCount: 1,
      failedGameCount: 0,
      gameIds: [2025020955],
      rawRowsUpserted: 1140,
      summaryRowsUpserted: 6,
      rowsUpserted: 1146,
      warmedLandingCache: true,
      results: [
        {
          gameId: 2025020955,
          rosterCount: 40,
          eventCount: 326,
          shiftCount: 774,
          rawEndpointsStored: 4,
          idempotent: false,
        },
      ],
      message:
        "Goalie underlying stats ingest completed. Raw NHL gamecenter payloads were refreshed first, then goalie-only underlying summary partitions were rebuilt and upserted.",
    });
  });

  it("reports an idempotent raw replay as zero writes while rebuilding the goalie summary", async () => {
    ingestNhlApiRawGamesBestEffortMock.mockResolvedValue({
      results: [
        {
          gameId: 2025020955,
          rosterCount: 40,
          eventCount: 326,
          shiftCount: 774,
          rawEndpointsStored: 4,
          idempotent: true,
        },
      ],
      failures: [],
    });

    const { req, res } = createMockApiContext({
      query: {
        gameId: "2025020955",
      },
    });

    await handler(req as never, res as never);

    expect(res.body).toMatchObject({
      rawRowsUpserted: 0,
      summaryRowsUpserted: 6,
      rowsUpserted: 6,
      results: [
        {
          gameId: 2025020955,
          idempotent: true,
        },
      ],
    });
  });

  it("supports batched incremental catch-up", async () => {
    resolveGoalieStatsIncrementalSelectionMock.mockResolvedValue({
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
            idempotent: false,
          },
          {
            gameId: 2025021196,
            rosterCount: 40,
            eventCount: 50,
            shiftCount: 60,
            rawEndpointsStored: 4,
            idempotent: false,
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
            idempotent: false,
          },
        ],
        failures: [],
      });
    refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock
      .mockResolvedValueOnce({
        rowsUpserted: 4,
        seededGameIds: [],
        rawBuildGameIds: [2025021184, 2025021196],
      })
      .mockResolvedValueOnce({
        rowsUpserted: 2,
        seededGameIds: [],
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
    expect(
      refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock
    ).toHaveBeenNthCalledWith(1, {
      gameIds: [2025021184, 2025021196],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: false,
      preferSharedSnapshotSeed: false,
      supabase: {},
    });
    expect(
      refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock
    ).toHaveBeenNthCalledWith(2, {
      gameIds: [2025021197],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: true,
      preferSharedSnapshotSeed: false,
      supabase: {},
    });
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-goalie-underlying-stats",
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
      rawRowsUpserted: 450,
      summaryRowsUpserted: 6,
      rowsUpserted: 456,
      warmedLandingCache: true,
      results: [
        {
          gameId: 2025021184,
          rosterCount: 10,
          eventCount: 20,
          shiftCount: 30,
          rawEndpointsStored: 4,
          idempotent: false,
        },
        {
          gameId: 2025021196,
          rosterCount: 40,
          eventCount: 50,
          shiftCount: 60,
          rawEndpointsStored: 4,
          idempotent: false,
        },
        {
          gameId: 2025021197,
          rosterCount: 70,
          eventCount: 80,
          shiftCount: 90,
          rawEndpointsStored: 4,
          idempotent: false,
        },
      ],
      message:
        "Goalie underlying stats ingest completed. Raw NHL gamecenter payloads were refreshed first, then goalie-only underlying summary partitions were rebuilt and upserted.",
    });
  });
});
