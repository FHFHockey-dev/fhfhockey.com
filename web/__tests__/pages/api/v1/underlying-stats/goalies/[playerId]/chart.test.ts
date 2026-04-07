import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/underlying-stats/playerStatsLandingServer", () => ({
  buildPlayerStatsLandingChartFromState: vi.fn(),
}));

import { buildPlayerStatsLandingChartFromState } from "lib/underlying-stats/playerStatsLandingServer";
import handler from "../../../../../../../pages/api/v1/underlying-stats/goalies/[playerId]/chart";

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

describe("/api/v1/underlying-stats/goalies/[playerId]/chart", () => {
  beforeEach(() => {
    vi.mocked(buildPlayerStatsLandingChartFromState).mockReset();
  });

  it("returns the shared goalie chart payload unchanged for chart requests", async () => {
    vi.mocked(buildPlayerStatsLandingChartFromState).mockResolvedValue({
      playerId: 8475883,
      family: "goalieCounts",
      rows: [
        {
          rowKey: "chart:8475883:2025021001",
          gameId: 2025021001,
          gameDate: "2026-03-01",
          opponentTeamId: 1,
          isHome: true,
          savePct: 0.944,
        },
      ],
      generatedAt: "2026-04-06T00:00:00.000Z",
    });

    const { req, res } = createMockApiContext({
      query: {
        playerId: "8475883",
        splitTeamId: "5",
        statMode: "individual",
      },
    });

    await handler(req as never, res as never);

    expect(buildPlayerStatsLandingChartFromState).toHaveBeenCalledWith({
      playerId: 8475883,
      splitTeamId: 5,
      state: expect.objectContaining({
        surface: "landing",
        primary: expect.objectContaining({
          statMode: "goalies",
        }),
      }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toMatchObject({
      playerId: 8475883,
      family: "goalieCounts",
      rows: [
        expect.objectContaining({
          gameId: 2025021001,
          savePct: 0.944,
        }),
      ],
    });
  });

  it("returns a goalie-only rates family when the shared chart builder resolves goalie rates", async () => {
    vi.mocked(buildPlayerStatsLandingChartFromState).mockResolvedValue({
      playerId: 8475883,
      family: "goalieRates",
      rows: [
        {
          rowKey: "chart:8475883:2025021002",
          gameId: 2025021002,
          gameDate: "2026-03-03",
          opponentTeamId: 2,
          isHome: false,
          savePct: 0.952,
          shotsAgainstPer60: 25.8,
        },
      ],
      generatedAt: "2026-04-06T00:00:00.000Z",
    });

    const { req, res } = createMockApiContext({
      query: {
        playerId: "8475883",
        displayMode: "rates",
        statMode: "individual",
      },
    });

    await handler(req as never, res as never);

    expect(buildPlayerStatsLandingChartFromState).toHaveBeenCalledWith({
      playerId: 8475883,
      splitTeamId: null,
      state: expect.objectContaining({
        primary: expect.objectContaining({
          statMode: "goalies",
          displayMode: "rates",
        }),
      }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toMatchObject({
      playerId: 8475883,
      family: "goalieRates",
      rows: [
        expect.objectContaining({
          gameId: 2025021002,
          shotsAgainstPer60: 25.8,
        }),
      ],
    });
  });
});
