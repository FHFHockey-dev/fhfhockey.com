import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/underlying-stats/playerStatsLandingServer", () => ({
  buildPlayerStatsDetailAggregationFromState: vi.fn(),
}));

import { buildPlayerStatsDetailAggregationFromState } from "lib/underlying-stats/playerStatsLandingServer";
import handler from "../../../../../../pages/api/v1/underlying-stats/goalies/[playerId]";

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

describe("/api/v1/underlying-stats/goalies/[playerId]", () => {
  beforeEach(() => {
    vi.mocked(buildPlayerStatsDetailAggregationFromState).mockReset();
  });

  it("returns the shared goalie counts payload unchanged for detail requests", async () => {
    vi.mocked(buildPlayerStatsDetailAggregationFromState).mockResolvedValue({
      playerId: 8475883,
      family: "goalieCounts",
      rows: [
        {
          rowKey: "detail:season:8475883:20252026",
          seasonId: 20252026,
          seasonLabel: "2025-26",
          playerName: "Goalie Test",
          teamLabel: "AAA",
          gamesPlayed: 50,
          toiSeconds: 120000,
          savePct: 0.919,
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
        playerId: "8475883",
        fromSeasonId: "20252026",
        throughSeasonId: "20252026",
        statMode: "individual",
      },
    });

    await handler(req as never, res as never);

    expect(buildPlayerStatsDetailAggregationFromState).toHaveBeenCalledWith(
      8475883,
      expect.objectContaining({
        surface: "detail",
        primary: expect.objectContaining({
          statMode: "goalies",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toMatchObject({
      family: "goalieCounts",
      placeholder: false,
      rows: [
        expect.objectContaining({
          playerName: "Goalie Test",
          savePct: 0.919,
        }),
      ],
    });
  });

  it("returns a goalie-only rates family when the shared detail builder resolves goalie rates", async () => {
    vi.mocked(buildPlayerStatsDetailAggregationFromState).mockResolvedValue({
      playerId: 8475883,
      family: "goalieRates",
      rows: [
        {
          rowKey: "detail:season:8475883:20252026",
          seasonId: 20252026,
          seasonLabel: "2025-26",
          playerName: "Goalie Rates Test",
          teamLabel: "AAA",
          gamesPlayed: 50,
          toiSeconds: 120000,
          savePct: 0.921,
          shotsAgainstPer60: 27.1,
          gsaaPer60: 0.21,
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
        playerId: "8475883",
        fromSeasonId: "20252026",
        throughSeasonId: "20252026",
        displayMode: "rates",
        statMode: "individual",
      },
    });

    await handler(req as never, res as never);

    expect(buildPlayerStatsDetailAggregationFromState).toHaveBeenCalledWith(
      8475883,
      expect.objectContaining({
        primary: expect.objectContaining({
          statMode: "goalies",
          displayMode: "rates",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toMatchObject({
      family: "goalieRates",
      placeholder: false,
      rows: [
        expect.objectContaining({
          playerName: "Goalie Rates Test",
          shotsAgainstPer60: 27.1,
          gsaaPer60: 0.21,
        }),
      ],
    });
  });
});
