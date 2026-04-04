import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/underlying-stats/playerStatsLandingServer", () => ({
  buildPlayerStatsLandingAggregationFromState: vi.fn(),
}));

import { buildPlayerStatsLandingAggregationFromState } from "lib/underlying-stats/playerStatsLandingServer";
import handler from "./players";

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

describe("/api/v1/underlying-stats/players", () => {
  beforeEach(() => {
    vi.mocked(buildPlayerStatsLandingAggregationFromState).mockReset();
  });

  it("returns a non-placeholder native landing payload for valid requests", async () => {
    vi.mocked(buildPlayerStatsLandingAggregationFromState).mockResolvedValue({
      family: "individualCounts",
      rows: [
        {
          rowKey: "landing:player:9001",
          playerName: "Taylor Test",
          teamLabel: "AAA / BBB",
          gamesPlayed: 2,
          toiSeconds: 540,
          totalPoints: 3,
        },
      ],
      sort: { sortKey: "totalPoints", direction: "desc" },
      pagination: {
        page: 1,
        pageSize: 50,
        totalRows: 1,
        totalPages: 1,
      },
    });

    const { req, res, headers } = createMockApiContext({
      query: {
        fromSeasonId: "20252026",
        throughSeasonId: "20252026",
        statMode: "individual",
        displayMode: "counts",
      },
    });

    await handler(req as never, res as never);

    expect(buildPlayerStatsLandingAggregationFromState).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(headers.get("Cache-Control")).toBe(
      "private, max-age=60, stale-while-revalidate=300"
    );
    expect(res.body).toMatchObject({
      family: "individualCounts",
      placeholder: false,
      rows: [
        expect.objectContaining({
          playerName: "Taylor Test",
          totalPoints: 3,
        }),
      ],
    });
  });

  it("returns a 400 error for unsupported native filter combinations", async () => {
    vi.mocked(buildPlayerStatsLandingAggregationFromState).mockRejectedValue(
      new Error('Native landing aggregation does not yet support score state "tied".')
    );

    const { req, res } = createMockApiContext({
      query: {
        fromSeasonId: "20252026",
        throughSeasonId: "20252026",
        scoreState: "tied",
      },
    });

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      error: "Unsupported player stats filter combination.",
      issues: ['Native landing aggregation does not yet support score state "tied".'],
    });
  });
});
