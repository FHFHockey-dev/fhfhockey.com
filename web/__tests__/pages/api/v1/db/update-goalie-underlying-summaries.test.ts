import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock,
  warmGoalieStatsLandingSeasonAggregateCacheMock,
  serviceRoleFromMock,
  resolveGoalieStatsIncrementalSelectionMock,
} = vi.hoisted(() => ({
  refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock: vi.fn(),
  warmGoalieStatsLandingSeasonAggregateCacheMock: vi.fn(),
  serviceRoleFromMock: vi.fn(),
  resolveGoalieStatsIncrementalSelectionMock: vi.fn(),
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

vi.mock("lib/underlying-stats/goalieStatsSummaryRefresh", () => ({
  refreshGoalieUnderlyingSummarySnapshotsForGameIds:
    refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock,
  fetchSeasonGoalieSummaryGameIdSet: vi.fn(),
  warmGoalieStatsLandingSeasonAggregateCache:
    warmGoalieStatsLandingSeasonAggregateCacheMock,
}));

vi.mock("lib/underlying-stats/goalieStatsRefreshWindow", () => ({
  resolveGoalieStatsIncrementalSelection:
    resolveGoalieStatsIncrementalSelectionMock,
}));

import handler from "../../../../../pages/api/v1/db/update-goalie-underlying-summaries";

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

describe("/api/v1/db/update-goalie-underlying-summaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock.mockResolvedValue({
      rowsUpserted: 3,
      seededGameIds: [2025020955],
      rawBuildGameIds: [],
    });
    warmGoalieStatsLandingSeasonAggregateCacheMock.mockResolvedValue(undefined);
    resolveGoalieStatsIncrementalSelectionMock.mockResolvedValue({
      mode: "incremental",
      seasonId: 20252026,
      requestedGameType: 2,
      startDate: "2026-04-04",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-04-04",
      gameIds: [2025021184, 2025021196],
    });

    serviceRoleFromMock.mockImplementation((table: string) => {
      if (table === "games") {
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          gte: vi.fn(() => chain),
          lte: vi.fn(() => chain),
          order: vi.fn(() => chain),
        };
        return chain;
      }

      throw new Error(`Unexpected table access: ${table}`);
    });
  });

  it("refreshes dedicated goalie summary partitions for one game", async () => {
    const { req, res } = createMockApiContext({
      query: {
        gameId: "2025020955",
      },
    });

    await handler(req as never, res as never);

    expect(
      refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock
    ).toHaveBeenCalledWith({
      gameIds: [2025020955],
      seasonId: null,
      requestedGameType: null,
      preferSharedSnapshotSeed: false,
      shouldWarmLandingCache: false,
      supabase: expect.anything(),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-goalie-underlying-summaries",
      mode: "game",
      seasonId: null,
      requestedGameCount: 1,
      gameIds: [2025020955],
      rowsUpserted: 3,
    });
  });

  it("supports incremental goalie summary catch-up", async () => {
    refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock
      .mockResolvedValueOnce({
        rowsUpserted: 2,
        seededGameIds: [],
        rawBuildGameIds: [2025021184],
      })
      .mockResolvedValueOnce({
        rowsUpserted: 1,
        seededGameIds: [],
        rawBuildGameIds: [2025021196],
      });

    const { req, res } = createMockApiContext({
      query: {
        incremental: "true",
        catchUp: "true",
        batchSize: "1",
        warmLandingCache: "true",
      },
    });

    await handler(req as never, res as never);

    expect(resolveGoalieStatsIncrementalSelectionMock).toHaveBeenCalledWith({
      seasonId: null,
      requestedGameType: null,
      supabase: expect.anything(),
    });
    expect(
      refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock
    ).toHaveBeenNthCalledWith(1, {
      gameIds: [2025021184],
      seasonId: 20252026,
      requestedGameType: 2,
      preferSharedSnapshotSeed: false,
      shouldWarmLandingCache: false,
      supabase: expect.anything(),
    });
    expect(
      refreshGoalieUnderlyingSummarySnapshotsForGameIdsMock
    ).toHaveBeenNthCalledWith(2, {
      gameIds: [2025021196],
      seasonId: 20252026,
      requestedGameType: 2,
      preferSharedSnapshotSeed: false,
      shouldWarmLandingCache: false,
      supabase: expect.anything(),
    });
    expect(warmGoalieStatsLandingSeasonAggregateCacheMock).toHaveBeenCalledWith({
      seasonId: 20252026,
      gameType: 2,
      supabase: expect.anything(),
    });
    expect(res.body).toEqual({
      success: true,
      route: "/api/v1/db/update-goalie-underlying-summaries",
      mode: "incremental",
      seasonId: 20252026,
      startDate: "2026-04-04",
      endDate: "2026-04-05",
      latestCoveredDate: "2026-04-04",
      catchUpCompleted: true,
      batchSize: 1,
      batchesProcessed: 2,
      requestedGameCount: 2,
      gameIds: [2025021184, 2025021196],
      rowsUpserted: 3,
    });
  });
});