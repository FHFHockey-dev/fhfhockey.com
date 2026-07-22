import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getCurrentSeason: vi.fn(),
  getTeams: vi.fn(),
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: mocks.getCurrentSeason,
  getTeams: mocks.getTeams,
}));

vi.mock("lib/supabase/server", () => ({
  default: { from: mocks.from },
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler,
}));

vi.mock("lib/NHL/edge", () => ({
  getEdgeGoalie5v5Detail: vi.fn(),
  getEdgeGoalieDetail: vi.fn(),
  getEdgeGoalieDetailNow: vi.fn(),
  getEdgeGoalieSavePercentageDetail: vi.fn(),
  getEdgeGoalieShotLocationDetail: vi.fn(),
  getEdgeSkaterDetail: vi.fn(),
  getEdgeSkaterDetailNow: vi.fn(),
  getEdgeSkaterShotLocationDetail: vi.fn(),
  getEdgeSkaterShotLocationTop10: vi.fn(),
  getEdgeSkaterShotSpeedDetail: vi.fn(),
  getEdgeSkaterSkatingDistanceDetail: vi.fn(),
  getEdgeSkaterSkatingSpeedDetail: vi.fn(),
  getEdgeSkaterZoneTime: vi.fn(),
  getEdgeTeamDetail: vi.fn(),
  getEdgeTeamDetailNow: vi.fn(),
  getEdgeTeamShotLocationDetail: vi.fn(),
  getEdgeTeamShotSpeedDetail: vi.fn(),
  getEdgeTeamSkatingDistanceDetail: vi.fn(),
  getEdgeTeamSkatingSpeedDetail: vi.fn(),
  getEdgeTeamZoneTimeDetails: vi.fn(),
}));

vi.mock("lib/NHL/edgeIngestion", () => ({
  EDGE_SHOT_LOCATION_VARIANTS: [],
  buildEdgeGoalieMetricRow: vi.fn(() => null),
  buildEdgeGoalieDetailRow: vi.fn(),
  buildEdgeGoalieDetailNowRow: vi.fn(),
  buildEdgeGoalieSupplementalDetailRow: vi.fn(),
  buildEdgeSkaterMetricRow: vi.fn(() => null),
  buildEdgeSkaterDetailRow: vi.fn(),
  buildEdgeSkaterDetailNowRow: vi.fn(),
  buildEdgeSkaterSkatingDistanceGameRows: vi.fn(() => []),
  buildEdgeSkaterShotLocationLeaderMetricRows: vi.fn(() => []),
  buildEdgeSkaterShotLocationRows: vi.fn(),
  buildEdgeSkaterSupplementalDetailRow: vi.fn(),
  buildEdgeTeamMetricRow: vi.fn(() => null),
  buildEdgeTeamDetailRow: vi.fn(),
  buildEdgeTeamDetailNowRow: vi.fn(),
  buildEdgeTeamSkatingDistanceGameRows: vi.fn(() => []),
  buildEdgeTeamSupplementalDetailRow: vi.fn(),
}));

import {
  buildEdgeUnavailableReason,
  runNhlEdgeStatsSnapshot,
} from "pages/api/v1/db/update-nhl-edge-stats";

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string | string[]>,
    setHeader: vi.fn((name: string, value: string | string[]) => {
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

function configureEmptyRoster() {
  const rosterQuery = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  rosterQuery.select.mockReturnValue(rosterQuery);
  rosterQuery.eq.mockResolvedValue({ data: [], error: null });
  mocks.from.mockImplementation((table: string) => {
    if (table !== "rosters") throw new Error(`Unexpected table: ${table}`);
    return rosterQuery;
  });
}

describe("update-nhl-edge-stats diagnostics", () => {
  it("names the failed endpoint family in unavailable reasons", () => {
    expect(buildEdgeUnavailableReason("team-zone-time-details")).toBe(
      "team-zone-time-details not available",
    );
    expect(buildEdgeUnavailableReason("goalie-save-percentage-detail")).toBe(
      "goalie-save-percentage-detail not available",
    );
  });
});

describe("update-nhl-edge-stats team catalog mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSeason.mockResolvedValue({ seasonId: 20252026 });
    mocks.getTeams.mockResolvedValue([]);
    configureEmptyRoster();
  });

  it("uses current-canonical for an implicit current season in both team reads", async () => {
    const response = createResponse();

    await runNhlEdgeStatsSnapshot(
      { method: "GET", query: { target: "team-detail" } } as never,
      response as never,
    );

    expect(mocks.getCurrentSeason).toHaveBeenCalledOnce();
    expect(mocks.getTeams).toHaveBeenCalledTimes(2);
    expect(mocks.getTeams).toHaveBeenNthCalledWith(1, 20252026, {
      mode: "current-canonical",
    });
    expect(mocks.getTeams).toHaveBeenNthCalledWith(2, 20252026, {
      mode: "current-canonical",
    });
    expect(response.statusCode).toBe(200);
  });

  it("uses season-exact for an explicit historical override in both team reads", async () => {
    const response = createResponse();

    await runNhlEdgeStatsSnapshot(
      {
        method: "GET",
        query: { target: "team-detail", seasonId: "20232024" },
      } as never,
      response as never,
    );

    expect(mocks.getCurrentSeason).not.toHaveBeenCalled();
    expect(mocks.getTeams).toHaveBeenCalledTimes(2);
    expect(mocks.getTeams).toHaveBeenNthCalledWith(1, 20232024, {
      mode: "season-exact",
    });
    expect(mocks.getTeams).toHaveBeenNthCalledWith(2, 20232024, {
      mode: "season-exact",
    });
    expect(response.statusCode).toBe(200);
  });
});
