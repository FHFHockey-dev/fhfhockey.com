import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectMissingTeamSummaryGameIdsMock,
  runRawIngestAndRefreshBatchesMock,
  runWithDependencyRetryMock,
  refreshTeamUnderlyingSummaryRowsForGameIdsMock,
  warmTeamStatsLandingSeasonAggregateCacheMock,
} = vi.hoisted(() => ({
  selectMissingTeamSummaryGameIdsMock: vi.fn(),
  runRawIngestAndRefreshBatchesMock: vi.fn(),
  runWithDependencyRetryMock: vi.fn(),
  refreshTeamUnderlyingSummaryRowsForGameIdsMock: vi.fn(),
  warmTeamStatsLandingSeasonAggregateCacheMock: vi.fn(),
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
  selectMissingTeamSummaryGameIds: selectMissingTeamSummaryGameIdsMock,
}));

vi.mock("lib/underlying-stats/teamStatsSummaryRefresh", () => ({
  refreshTeamUnderlyingSummaryRowsForGameIds:
    refreshTeamUnderlyingSummaryRowsForGameIdsMock,
  warmTeamStatsLandingSeasonAggregateCache:
    warmTeamStatsLandingSeasonAggregateCacheMock,
}));

import handler from "../../../../../pages/api/v1/db/backfill-team-underlying-season";

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

describe("/api/v1/db/backfill-team-underlying-season", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    selectMissingTeamSummaryGameIdsMock
      .mockResolvedValueOnce([2025020955, 2025020956])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([2025020957])
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
      summaryRowsUpserted: 12,
    });

    refreshTeamUnderlyingSummaryRowsForGameIdsMock.mockResolvedValue({
      rowsUpserted: 6,
    });

    runWithDependencyRetryMock.mockImplementation(async ({ operation }: { operation: () => Promise<unknown> }) =>
      operation()
    );

    warmTeamStatsLandingSeasonAggregateCacheMock.mockResolvedValue(undefined);
  });

  it("selects missing team summary games, runs raw backfill batches, runs summary-only refreshes, and warms the landing cache", async () => {
    const { req, res } = createMockApiContext({
      query: {
        seasonId: "20252026",
        batchSize: "2",
        limit: "10",
        summaryLimit: "5",
      },
    });

    await handler(req as never, res as never);

    expect(selectMissingTeamSummaryGameIdsMock).toHaveBeenNthCalledWith(1, {
      seasonId: 20252026,
      requestedGameType: 2,
      limit: 10,
      supabase: {},
    });
    expect(selectMissingTeamSummaryGameIdsMock).toHaveBeenNthCalledWith(2, {
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

    const rawRefreshSummaries = runRawIngestAndRefreshBatchesMock.mock.calls[0]?.[0]
      ?.refreshSummaries as (args: {
      gameIds: number[];
      seasonId: number;
      requestedGameType: number;
      shouldWarmLandingCache: boolean;
    }) => Promise<unknown>;

    await rawRefreshSummaries({
      gameIds: [2025020955, 2025020956],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: false,
    });

    expect(selectMissingTeamSummaryGameIdsMock).toHaveBeenNthCalledWith(3, {
      seasonId: 20252026,
      requestedGameType: 2,
      limit: 5,
      supabase: {},
    });
    expect(runWithDependencyRetryMock).toHaveBeenCalledTimes(2);
    expect(refreshTeamUnderlyingSummaryRowsForGameIdsMock).toHaveBeenNthCalledWith(1, {
      gameIds: [2025020957],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: false,
      supabase: {},
    });
    expect(refreshTeamUnderlyingSummaryRowsForGameIdsMock).toHaveBeenNthCalledWith(2, {
      gameIds: [2025020955, 2025020956],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: false,
      supabase: {},
    });
    expect(warmTeamStatsLandingSeasonAggregateCacheMock).toHaveBeenCalledWith({
      seasonId: 20252026,
      gameType: 2,
      supabase: {},
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/backfill-team-underlying-season",
      seasonId: 20252026,
      requestedGameType: 2,
      rawBackfillBatchesProcessed: 1,
      summaryBackfillBatchesProcessed: 1,
      processedGameCount: 2,
      failedGameCount: 0,
      rawRowsUpserted: 2248,
      summaryRowsUpserted: 18,
      rowsUpserted: 2266,
      warmedLandingCache: true,
      message: "Team underlying season backfill completed.",
    });
  });

  it("returns partial success when raw ingest records per-game failures and cache warming still runs", async () => {
    selectMissingTeamSummaryGameIdsMock
      .mockReset()
      .mockResolvedValueOnce([2025020955])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    runRawIngestAndRefreshBatchesMock.mockResolvedValueOnce({
      aggregatedResults: [],
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
      route: "/api/v1/db/backfill-team-underlying-season",
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
      message: "Team underlying season backfill completed with partial failures.",
    });
  });
});