import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTeams: vi.fn(),
  isValidNhlSeasonId: vi.fn(
    (seasonId: number) =>
      Number.isSafeInteger(seasonId) &&
      /^\d{8}$/.test(String(seasonId)) &&
      Number(String(seasonId).slice(4)) ===
        Number(String(seasonId).slice(0, 4)) + 1,
  ),
}));

vi.mock("lib/NHL/server", () => ({
  getTeams: mocks.getTeams,
  isValidNhlSeasonId: mocks.isValidNhlSeasonId,
}));

import handler from "pages/api/v1/team/[seasonId]";

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

describe("GET /api/v1/team/[seasonId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTeams.mockResolvedValue([]);
  });

  it("preserves the exact current route", async () => {
    const response = createResponse();

    await handler(
      { method: "GET", query: { seasonId: "current" } } as never,
      response as never,
    );

    expect(mocks.getTeams).toHaveBeenCalledWith(undefined);
    expect(response.statusCode).toBe(200);
    expect(response.headers["Cache-Control"]).toBe("max-age=86400");
  });

  it("passes a valid explicit season to the season-exact default", async () => {
    const teams = [
      {
        id: 53,
        name: "Arizona Coyotes",
        abbreviation: "ARI",
        logo: "/teamLogos/ARI.png",
      },
    ];
    mocks.getTeams.mockResolvedValue(teams);
    const response = createResponse();

    await handler(
      { method: "GET", query: { seasonId: "20232024" } } as never,
      response as never,
    );

    expect(mocks.getTeams).toHaveBeenCalledWith(20232024);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(teams);
  });

  it.each([
    undefined,
    ["20242025", "20232024"],
    "NaN",
    "9007199254740992",
    "2024202",
    "202420250",
    "20242026",
    "CURRENT",
  ])("rejects invalid route season %j before lookup", async (seasonId) => {
    const response = createResponse();

    await handler(
      { method: "GET", query: { seasonId } } as never,
      response as never,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "A valid season id or 'current' is required",
    });
    expect(mocks.getTeams).not.toHaveBeenCalled();
  });

  it("fails closed when an exact lookup is unavailable", async () => {
    mocks.getTeams.mockRejectedValue(new Error("dependency unavailable"));
    const response = createResponse();

    await handler(
      { method: "GET", query: { seasonId: "20242025" } } as never,
      response as never,
    );

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual([]);
  });
});
