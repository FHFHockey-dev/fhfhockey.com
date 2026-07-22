import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildOddsTeamDirectory: vi.fn((teams: unknown) => teams),
  from: vi.fn(),
  getCurrentSeason: vi.fn(),
  getScheduleDaily: vi.fn(),
  getTeams: vi.fn(),
  normalizeNhlScheduleOdds: vi.fn(),
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: mocks.getCurrentSeason,
  getTeams: mocks.getTeams,
}));

vi.mock("lib/NHL/server/scheduleDaily", () => ({
  getScheduleDaily: mocks.getScheduleDaily,
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => (req: any, res: any) =>
    handler({ ...req, supabase: { from: mocks.from } }, res),
}));

vi.mock("lib/cors-fetch", () => ({
  default: vi.fn(),
}));

vi.mock("lib/sources/oddsSourceIngestion", () => ({
  buildExternalOddsEventOddsUrl: vi.fn(),
  buildExternalOddsFeaturedUrl: vi.fn(),
  buildOddsTeamDirectory: mocks.buildOddsTeamDirectory,
  normalizeNhlScheduleOdds: mocks.normalizeNhlScheduleOdds,
  normalizeTheOddsApiFeaturedOdds: vi.fn(),
  normalizeTheOddsApiPropOdds: vi.fn(),
}));

import handler from "pages/api/v1/db/update-market-prices";

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
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

describe("/api/v1/db/update-market-prices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PARLAY_API_KEY;
    delete process.env.PARLAYAPI_KEY;
    delete process.env.PARLAYAPI_API_KEY;
    delete process.env.THE_ODDS_API_KEY;
    delete process.env.ODDS_API_KEY;
    delete process.env.THEODDS_API_KEY;

    mocks.getCurrentSeason.mockResolvedValue({ seasonId: 20252026 });
    mocks.getTeams.mockResolvedValue([
      {
        id: 68,
        name: "Utah Mammoth",
        abbreviation: "UTA",
        logo: "/teamLogos/UTA.png",
      },
    ]);
    mocks.getScheduleDaily.mockResolvedValue({ games: [] });
    mocks.normalizeNhlScheduleOdds.mockReturnValue({
      rows: [],
      provenanceRows: [],
    });

    const gamesQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    gamesQuery.select.mockReturnValue(gamesQuery);
    gamesQuery.eq.mockReturnValue(gamesQuery);
    gamesQuery.order.mockResolvedValue({
      data: [
        {
          id: 2025020601,
          date: "2026-01-05",
          homeTeamId: 68,
          awayTeamId: 1,
        },
      ],
      error: null,
    });

    const playersQuery = {
      select: vi.fn(),
      in: vi.fn(),
    };
    playersQuery.select.mockReturnValue(playersQuery);
    playersQuery.in.mockResolvedValue({ data: [], error: null });

    mocks.from.mockImplementation((table: string) => {
      if (table === "games") return gamesQuery;
      if (table === "players") return playersQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("requests the current-canonical directory for current market ingestion", async () => {
    const response = createResponse();

    await handler(
      { method: "POST", query: { date: "2026-01-05" } } as never,
      response as never,
    );

    expect(mocks.getTeams).toHaveBeenCalledWith(20252026, {
      mode: "current-canonical",
    });
    expect(mocks.buildOddsTeamDirectory).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      snapshotDate: "2026-01-05",
    });
  });
});
