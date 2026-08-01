import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildTeamDirectory: vi.fn((teams: unknown) => teams),
  from: vi.fn(),
  getCurrentSeason: vi.fn(),
  getTeams: vi.fn(),
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: mocks.getCurrentSeason,
  getTeams: mocks.getTeams,
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => (req: any, res: any) =>
    handler({ ...req, supabase: { from: mocks.from } }, res),
}));

vi.mock("lib/sources/lineupSourceIngestion", () => ({
  buildGameDayTweetsLineupSourceFromTweet: vi.fn(),
  buildGoalieStartSourceFromModel: vi.fn(),
  buildGoalieStartSourceFromOfficialLineup: vi.fn(),
  buildNhlLineupProjectionsUrl: vi.fn(),
  buildTeamDirectory: mocks.buildTeamDirectory,
  fetchGameDayTweetOEmbedData: vi.fn(),
  parseDailyFaceoffLineCombinationsPage: vi.fn(),
  parseDailyFaceoffStartingGoaliesPage: vi.fn(),
  parseGameDayTweetsGoaliesPage: vi.fn(),
  parseGameDayTweetsLinesPage: vi.fn(),
  parseNhlLineupProjectionsPage: vi.fn(),
  selectBestGoalieStartSource: vi.fn(),
  selectBestPregameLineupSource: vi.fn(),
  toGoalieStartProvenanceSnapshotRow: vi.fn(),
  toHistoricalLineSourceRow: vi.fn(),
  toSourceProvenanceSnapshotRow: vi.fn(),
}));

import handler from "pages/api/v1/db/update-lineup-source-provenance";

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

describe("/api/v1/db/update-lineup-source-provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSeason.mockResolvedValue({ seasonId: 20252026 });
    mocks.getTeams.mockResolvedValue([
      {
        id: 68,
        name: "Utah Mammoth",
        abbreviation: "UTA",
        logo: "/teamLogos/UTA.png",
      },
    ]);

    const gamesQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    gamesQuery.select.mockReturnValue(gamesQuery);
    gamesQuery.eq.mockReturnValue(gamesQuery);
    gamesQuery.order.mockResolvedValue({ data: [], error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table !== "games") throw new Error(`Unexpected table: ${table}`);
      return gamesQuery;
    });
  });

  it("requests the current-canonical directory before bounded current ingestion", async () => {
    const response = createResponse();

    await handler(
      { method: "POST", query: { date: "2099-01-05" } } as never,
      response as never,
    );

    expect(mocks.getTeams).toHaveBeenCalledWith(20252026, {
      mode: "current-canonical",
    });
    expect(mocks.buildTeamDirectory).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      success: true,
      date: "2099-01-05",
      rowsUpserted: 0,
      message: "No scheduled games found for requested date.",
    });
  });
});
