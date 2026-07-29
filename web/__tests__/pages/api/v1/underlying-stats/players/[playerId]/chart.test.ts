import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/underlying-stats/playerStatsLandingServer", () => ({
  buildPlayerStatsLandingChartFromState: vi.fn(),
}));

import { buildPlayerStatsLandingChartFromState } from "lib/underlying-stats/playerStatsLandingServer";
import handler from "../../../../../../../pages/api/v1/underlying-stats/players/[playerId]/chart";

function createMockApiContext() {
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
      method: "GET",
      query: {
        playerId: "8478401",
        fromSeasonId: "20252026",
        throughSeasonId: "20252026",
      },
    },
    res: response,
  };
}

describe("/api/v1/underlying-stats/players/[playerId]/chart", () => {
  beforeEach(() => {
    vi.mocked(buildPlayerStatsLandingChartFromState).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts dependency details from chart 500 responses", async () => {
    const error = new Error("upstream payload detail");
    vi.mocked(buildPlayerStatsLandingChartFromState).mockRejectedValue(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { req, res } = createMockApiContext();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({
      error: "Unable to build player chart underlying stats.",
      issues: ["PLAYER_CHART_UNDERLYING_STATS_UNAVAILABLE"],
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to build player chart underlying stats",
      error
    );
  });
});
