import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/underlying-stats/playerStatsLandingServer", () => ({
  buildPlayerStatsLandingAggregationFromState: vi.fn(),
}));

import { buildPlayerStatsLandingAggregationFromState } from "lib/underlying-stats/playerStatsLandingServer";
import handler from "../../../../../pages/api/v1/underlying-stats/goalies";

function createMockApiContext(args?: {
  method?: string;
  query?: Record<string, string>;
}) {
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    body: null as unknown,
    setHeader: vi.fn((name: string, value: string) => {
      headers.set(name, value);
    }),
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
    },
    res: response,
    headers,
  };
}

describe("/api/v1/underlying-stats/goalies", () => {
  beforeEach(() => {
    vi.mocked(buildPlayerStatsLandingAggregationFromState).mockReset();
  });

  it("forces goalie mode on landing requests", async () => {
    vi.mocked(buildPlayerStatsLandingAggregationFromState).mockResolvedValue({
      family: "goalieCounts",
      rows: [
        {
          rowKey: "landing:player:1",
          playerName: "Goalie Test",
          teamLabel: "AAA",
          gamesPlayed: 3,
          toiSeconds: 3600,
          savePct: 0.931,
        },
      ],
      sort: { sortKey: "savePct", direction: "desc" },
      pagination: {
        page: 1,
        pageSize: 50,
        totalRows: 1,
        totalPages: 1,
      },
    });

    const { req, res } = createMockApiContext({
      query: {
        fromSeasonId: "20252026",
        throughSeasonId: "20252026",
        statMode: "individual",
        displayMode: "counts",
      },
    });

    await handler(req as never, res as never);

    expect(buildPlayerStatsLandingAggregationFromState).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "landing",
        primary: expect.objectContaining({
          statMode: "goalies",
          displayMode: "counts",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toMatchObject({
      family: "goalieCounts",
      placeholder: false,
    });
  });
});
