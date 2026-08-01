import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/underlying-stats/teamStatsQueries", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("lib/underlying-stats/teamStatsQueries")
    >();

  return {
    ...original,
    queryTeamStatsLanding: vi.fn(),
  };
});

import { queryTeamStatsLanding } from "lib/underlying-stats/teamStatsQueries";
import handler from "../../../../../pages/api/v1/underlying-stats/teams";

function createMockApiContext() {
  const response = {
    body: null as unknown,
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      response.statusCode = code;
      return response;
    }),
    statusCode: 200,
    json: vi.fn((payload: unknown) => {
      response.body = payload;
      return response;
    }),
  };

  return {
    req: {
      method: "GET",
      query: {
        fromSeasonId: "20252026",
        throughSeasonId: "20252026",
      },
    },
    res: response,
  };
}

describe("/api/v1/underlying-stats/teams", () => {
  beforeEach(() => {
    vi.mocked(queryTeamStatsLanding).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts dependency details from landing 500 responses", async () => {
    const error = new Error("postgres connection detail");
    vi.mocked(queryTeamStatsLanding).mockRejectedValue(error);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { req, res } = createMockApiContext();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({
      error: "Unable to build team underlying stats.",
      issues: ["TEAM_UNDERLYING_STATS_UNAVAILABLE"],
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to build team underlying stats",
      error,
    );
  });
});
