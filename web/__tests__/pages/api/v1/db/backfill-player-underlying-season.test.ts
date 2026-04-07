import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectMissingPlayerSummaryGameIdsMock,
  runRawIngestAndRefreshBatchesMock,
  runWithDependencyRetryMock,
  refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock,
  warmPlayerStatsLandingSeasonAggregateCacheMock,
} = vi.hoisted(() => ({
  selectMissingPlayerSummaryGameIdsMock: vi.fn(),
  runRawIngestAndRefreshBatchesMock: vi.fn(),
  runWithDependencyRetryMock: vi.fn(),
  refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock: vi.fn(),
  warmPlayerStatsLandingSeasonAggregateCacheMock: vi.fn(),
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

vi.mock("lib/underlying-stats/adminRouteHelpers", () => ({
  chunkGameIds: (gameIds: readonly number[], batchSize: number) => {
    const chunks: number[][] = [];
    for (let index = 0; index < gameIds.length; index += batchSize) {
      chunks.push(gameIds.slice(index, index + batchSize));
    }
    return chunks;
  },
  parsePositiveInteger: (value: string | string[] | undefined) => {
    const normalized = typeof value === "string" ? value : value?.[0];
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
  },
  runWithDependencyRetry: runWithDependencyRetryMock,
  runRawIngestAndRefreshBatches: runRawIngestAndRefreshBatchesMock,
  selectMissingPlayerSummaryGameIds: selectMissingPlayerSummaryGameIdsMock,
}));

vi.mock("lib/underlying-stats/playerStatsSummaryRefresh", () => ({
  refreshPlayerUnderlyingSummarySnapshotsForGameIds:
    refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock,
  warmPlayerStatsLandingSeasonAggregateCache:
    warmPlayerStatsLandingSeasonAggregateCacheMock,
}));

import handler from "../../../../../pages/api/v1/db/backfill-player-underlying-season";

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
      method: args?.method ?? "GET",
      query: args?.query ?? {},
      headers: {},
    },
    res: response,
  };
}

describe("/api/v1/db/backfill-player-underlying-season", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    selectMissingPlayerSummaryGameIdsMock
      .mockResolvedValueOnce([2025020955, 2025020956])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    runRawIngestAndRefreshBatchesMock.mockResolvedValue({
      aggregatedResults: [
        {
          gameId: 2025020955,
          rosterCount: 40,
          eventCount: 320,
          shiftCount: 760,
          rawEndpointsStored: 4,
        },
      ],
      failures: [],
      processedGameIds: [2025020955, 2025020956],
      rawRowsUpserted: 2248,
      summaryRowsUpserted: 4,
    });
    refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock.mockResolvedValue({
      rowsUpserted: 0,
      migratedGameIds: [],
      rawBuildGameIds: [],
    });
    runWithDependencyRetryMock.mockImplementation(async ({ operation }: { operation: () => Promise<unknown> }) =>
      operation()
    );
    warmPlayerStatsLandingSeasonAggregateCacheMock.mockResolvedValue(undefined);
  });

  it("selects missing player summary games directly instead of calling the heavy raw coverage selector", async () => {
    const { req, res } = createMockApiContext({
      query: {
        seasonId: "20252026",
        batchSize: "2",
        limit: "10",
      },
    });

    await handler(req as never, res as never);

    expect(selectMissingPlayerSummaryGameIdsMock).toHaveBeenNthCalledWith(1, {
      seasonId: 20252026,
      requestedGameType: 2,
      limit: 10,
      supabase: {},
    });
    expect(runRawIngestAndRefreshBatchesMock).toHaveBeenCalledWith({
      gameIdBatches: [[2025020955, 2025020956]],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: false,
      refreshSummaries: expect.any(Function),
    });
    expect(warmPlayerStatsLandingSeasonAggregateCacheMock).toHaveBeenCalledWith({
      seasonId: 20252026,
      gameType: 2,
      supabase: {},
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/backfill-player-underlying-season",
      seasonId: 20252026,
      requestedGameType: 2,
      rawBackfillBatchesProcessed: 1,
      summaryBackfillBatchesProcessed: 0,
      processedGameCount: 2,
      failedGameCount: 0,
      rawRowsUpserted: 2248,
      summaryRowsUpserted: 4,
      rowsUpserted: 2252,
      warmedLandingCache: true,
      message: "Player underlying season backfill completed.",
    });
  });

  it("returns partial success when summary refresh transport errors occur after raw ingest succeeds", async () => {
    runRawIngestAndRefreshBatchesMock.mockResolvedValueOnce({
      aggregatedResults: [
        {
          gameId: 2025020955,
          rosterCount: 40,
          eventCount: 320,
          shiftCount: 760,
          rawEndpointsStored: 4,
        },
      ],
      failures: [
        {
          gameId: 2025020955,
          message: "summary refresh failed: TypeError: fetch failed",
        },
      ],
      processedGameIds: [2025020955],
      rawRowsUpserted: 1124,
      summaryRowsUpserted: 0,
    });

    const { req, res } = createMockApiContext({
      query: {
        seasonId: "20252026",
      },
    });

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/backfill-player-underlying-season",
      seasonId: 20252026,
      requestedGameType: 2,
      rawBackfillBatchesProcessed: 1,
      summaryBackfillBatchesProcessed: 0,
      processedGameCount: 1,
      failedGameCount: 1,
      failedGameIds: [2025020955],
      failures: [
        {
          gameId: 2025020955,
          message: "summary refresh failed: TypeError: fetch failed",
        },
      ],
      rawRowsUpserted: 1124,
      summaryRowsUpserted: 0,
      rowsUpserted: 1124,
      warmedLandingCache: true,
      message: "Player underlying season backfill completed with partial failures.",
    });
  });
});