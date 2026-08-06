import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSeason: vi.fn(),
  getSeasonById: vi.fn(),
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: mocks.getCurrentSeason,
  getSeasonById: mocks.getSeasonById,
}));

import handler from "pages/api/v1/season";

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader: vi.fn((name: string, value: string) => {
      response.headers[name] = value;
    }),
    status: vi.fn((statusCode: number) => {
      response.statusCode = statusCode;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      response.body = body;
      return response;
    }),
  };
  return response;
}

describe("GET /api/v1/season", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns one exact requested season", async () => {
    const season = {
      id: 20242025,
      startDate: "2024-10-04T00:00:00.000Z",
      regularSeasonEndDate: "2025-04-17T00:00:00.000Z",
      endDate: "2025-06-17T00:00:00.000Z",
      numberOfGames: 1312,
    };
    mocks.getSeasonById.mockResolvedValue(season);
    const response = createResponse();

    await handler(
      { method: "GET", query: { season: "20242025" } } as never,
      response as never,
    );

    expect(mocks.getSeasonById).toHaveBeenCalledWith(20242025);
    expect(mocks.getCurrentSeason).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(season);
  });

  it.each(["20242026", "../../20242025", ["20242025", "20232024"]])(
    "rejects invalid season query %j before lookup",
    async (season) => {
      const response = createResponse();

      await handler(
        { method: "GET", query: { season } } as never,
        response as never,
      );

      expect(response.statusCode).toBe(400);
      expect(mocks.getSeasonById).not.toHaveBeenCalled();
    },
  );

  it("returns 404 for an unknown valid season", async () => {
    mocks.getSeasonById.mockResolvedValue(null);
    const response = createResponse();

    await handler(
      { method: "GET", query: { season: "19981999" } } as never,
      response as never,
    );

    expect(response.statusCode).toBe(404);
  });

  it("fails closed when an exact season lookup is unavailable", async () => {
    mocks.getSeasonById.mockRejectedValue(new Error("dependency unavailable"));
    const response = createResponse();

    await handler(
      { method: "GET", query: { season: "20242025" } } as never,
      response as never,
    );

    expect(mocks.getCurrentSeason).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({ error: "Unable to resolve season" });
  });

  it("keeps the existing current-season path when no season is requested", async () => {
    const season = { seasonId: 20252026 };
    mocks.getCurrentSeason.mockResolvedValue(season);
    const response = createResponse();

    await handler({ method: "GET", query: {} } as never, response as never);

    expect(mocks.getCurrentSeason).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(season);
  });
});
