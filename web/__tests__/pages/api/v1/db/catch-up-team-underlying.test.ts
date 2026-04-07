import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveTeamStatsIncrementalSelectionMock,
  runRawIngestAndRefreshBatchesMock,
  refreshTeamUnderlyingSummaryRowsForGameIdsMock,
} = vi.hoisted(() => ({
  resolveTeamStatsIncrementalSelectionMock: vi.fn(),
  runRawIngestAndRefreshBatchesMock: vi.fn(),
  refreshTeamUnderlyingSummaryRowsForGameIdsMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
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
  runRawIngestAndRefreshBatches: runRawIngestAndRefreshBatchesMock,
}));

vi.mock("lib/underlying-stats/teamStatsRefreshWindow", () => ({
  resolveTeamStatsIncrementalSelection: resolveTeamStatsIncrementalSelectionMock,
}));

vi.mock("lib/underlying-stats/teamStatsSummaryRefresh", () => ({
  refreshTeamUnderlyingSummaryRowsForGameIds:
    refreshTeamUnderlyingSummaryRowsForGameIdsMock,
}));

import handler from "../../../../../pages/api/v1/db/catch-up-team-underlying";

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

describe("/api/v1/db/catch-up-team-underlying", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    resolveTeamStatsIncrementalSelectionMock.mockResolvedValue({
      mode: "incremental",
      seasonId: 20252026,
      requestedGameType: 2,
      startDate: "2026-04-01",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-03-31",
      gameIds: [2025020955, 2025020956, 2025020957],
    });

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
      processedGameIds: [2025020955, 2025020956, 2025020957],
      rawRowsUpserted: 3360,
      summaryRowsUpserted: 18,
    });

    refreshTeamUnderlyingSummaryRowsForGameIdsMock.mockResolvedValue({
      rowsUpserted: 6,
    });
  });

  it("selects incremental team games, batches them, and wires the team summary refresh callback", async () => {
    const { req, res } = createMockApiContext({
      query: {
        seasonId: "20252026",
        batchSize: "2",
      },
    });

    await handler(req as never, res as never);

    expect(resolveTeamStatsIncrementalSelectionMock).toHaveBeenCalledWith({
      seasonId: 20252026,
      requestedGameType: null,
    });
    expect(runRawIngestAndRefreshBatchesMock).toHaveBeenCalledWith({
      gameIdBatches: [[2025020955, 2025020956], [2025020957]],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: true,
      refreshSummaries: expect.any(Function),
    });

    const refreshSummaries = runRawIngestAndRefreshBatchesMock.mock.calls[0]?.[0]
      ?.refreshSummaries as (args: {
      gameIds: number[];
      seasonId: number;
      requestedGameType: number;
      shouldWarmLandingCache: boolean;
    }) => Promise<unknown>;

    await refreshSummaries({
      gameIds: [2025020955, 2025020956],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: true,
    });

    expect(refreshTeamUnderlyingSummaryRowsForGameIdsMock).toHaveBeenCalledWith({
      gameIds: [2025020955, 2025020956],
      seasonId: 20252026,
      requestedGameType: 2,
      shouldWarmLandingCache: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/catch-up-team-underlying",
      mode: "incremental",
      seasonId: 20252026,
      startDate: "2026-04-01",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-03-31",
      requestedGameCount: 3,
      processedGameCount: 3,
      failedGameCount: 0,
      batchSize: 2,
      batchesProcessed: 2,
      rawRowsUpserted: 3360,
      summaryRowsUpserted: 18,
      rowsUpserted: 3378,
      warmedLandingCache: true,
      results: [
        {
          gameId: 2025020955,
          rosterCount: 40,
          eventCount: 320,
          shiftCount: 760,
          rawEndpointsStored: 4,
        },
      ],
      message: "Team underlying catch-up completed through the latest finished games.",
    });
  });

  it("returns a partial-success payload when some games fail during catch-up", async () => {
    runRawIngestAndRefreshBatchesMock.mockResolvedValueOnce({
      aggregatedResults: [],
      failures: [
        {
          gameId: 2025020956,
          message: "summary refresh failed: TypeError: fetch failed",
        },
      ],
      processedGameIds: [2025020955],
      rawRowsUpserted: 1120,
      summaryRowsUpserted: 6,
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
      route: "/api/v1/db/catch-up-team-underlying",
      mode: "incremental",
      seasonId: 20252026,
      startDate: "2026-04-01",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-03-31",
      requestedGameCount: 3,
      processedGameCount: 1,
      failedGameCount: 1,
      failedGameIds: [2025020956],
      failures: [
        {
          gameId: 2025020956,
          message: "summary refresh failed: TypeError: fetch failed",
        },
      ],
      batchSize: 5,
      batchesProcessed: 1,
      rawRowsUpserted: 1120,
      summaryRowsUpserted: 6,
      rowsUpserted: 1126,
      warmedLandingCache: false,
      results: [],
      message: "Team underlying catch-up completed with partial failures.",
    });
  });

  it("short-circuits when the incremental selector finds no work", async () => {
    resolveTeamStatsIncrementalSelectionMock.mockResolvedValueOnce({
      mode: "incremental",
      seasonId: 20252026,
      requestedGameType: 2,
      startDate: null,
      endDate: null,
      latestCoveredDate: null,
      gameIds: [],
    });

    const { req, res } = createMockApiContext({
      query: {
        seasonId: "20252026",
      },
    });

    await handler(req as never, res as never);

    expect(runRawIngestAndRefreshBatchesMock).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/catch-up-team-underlying",
      mode: "incremental",
      seasonId: 20252026,
      startDate: null,
      endDate: null,
      latestCoveredDate: null,
      requestedGameCount: 0,
      processedGameCount: 0,
      failedGameCount: 0,
      batchSize: 5,
      batchesProcessed: 0,
      rawRowsUpserted: 0,
      summaryRowsUpserted: 0,
      rowsUpserted: 0,
      warmedLandingCache: false,
      results: [],
      message: "Team underlying catch-up is already current for the selected season.",
    });
  });
});