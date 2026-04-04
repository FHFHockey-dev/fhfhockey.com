import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveRequestedGameIdsMock,
  ingestNhlApiRawGamesMock,
  refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock,
} = vi.hoisted(() => ({
  resolveRequestedGameIdsMock: vi.fn(),
  ingestNhlApiRawGamesMock: vi.fn(),
  refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock: vi.fn(),
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
  ingestNhlApiRawGames: ingestNhlApiRawGamesMock,
}));

vi.mock("lib/underlying-stats/playerStatsSummaryRefresh", () => ({
  refreshPlayerUnderlyingSummarySnapshotsForGameIds:
    refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock,
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
    ingestNhlApiRawGamesMock.mockResolvedValue([
      {
        rosterCount: 40,
        eventCount: 326,
        shiftCount: 774,
        rawEndpointsStored: 4,
      },
    ]);
    refreshPlayerUnderlyingSummarySnapshotsForGameIdsMock.mockResolvedValue({
      rowsUpserted: 1,
      migratedGameIds: [],
      rawBuildGameIds: [2025020955],
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
    expect(ingestNhlApiRawGamesMock).toHaveBeenCalledWith({}, [2025020955]);
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
      gameIds: [2025020955],
      rawRowsUpserted: 1144,
      summaryRowsUpserted: 1,
      rowsUpserted: 1145,
      warmedLandingCache: true,
      results: [
        {
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

    expect(ingestNhlApiRawGamesMock).not.toHaveBeenCalled();
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
});
