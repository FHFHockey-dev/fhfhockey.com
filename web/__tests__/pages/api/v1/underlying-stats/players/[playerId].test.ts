import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/underlying-stats/playerStatsLandingServer", () => ({
  buildPlayerStatsDetailAggregationFromState: vi.fn(),
}));

import { buildPlayerStatsDetailAggregationFromState } from "lib/underlying-stats/playerStatsLandingServer";
import handler from "../../../../../../pages/api/v1/underlying-stats/players/[playerId]";

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

describe("/api/v1/underlying-stats/players/[playerId]", () => {
  beforeEach(() => {
    vi.mocked(buildPlayerStatsDetailAggregationFromState).mockReset();
  });

  it("returns a non-placeholder detail payload for valid requests", async () => {
    vi.mocked(buildPlayerStatsDetailAggregationFromState).mockResolvedValue({
      playerId: 8478401,
      family: "individualCounts",
      rows: [
        {
          rowKey: "detail:season:8478401:20252026",
          seasonId: 20252026,
          seasonLabel: "2025-26",
          playerName: "Pavel Zacha",
          teamLabel: "BOS",
          positionCode: "C",
          gamesPlayed: 72,
          toiSeconds: 73440,
          totalPoints: 60,
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
        playerId: "8478401",
        fromSeasonId: "20252026",
        throughSeasonId: "20252026",
      },
    });

    await handler(req as never, res as never);

    expect(buildPlayerStatsDetailAggregationFromState).toHaveBeenCalledWith(
      8478401,
      expect.objectContaining({
        surface: "detail",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(headers.get("Cache-Control")).toBe(
      "private, max-age=60, stale-while-revalidate=300"
    );
    expect(res.body).toMatchObject({
      playerId: 8478401,
      family: "individualCounts",
      placeholder: false,
      rows: [
        expect.objectContaining({
          seasonLabel: "2025-26",
          totalPoints: 60,
        }),
      ],
    });
  });

  it("returns a 400 error for invalid player ids", async () => {
    const { req, res } = createMockApiContext({
      query: {
        playerId: "not-a-player",
      },
    });

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      error: "Invalid player id.",
      issues: ["playerId must be a positive integer."],
    });
  });
});
