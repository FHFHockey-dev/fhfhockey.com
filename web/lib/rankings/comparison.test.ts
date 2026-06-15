import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildGoalieMatrixSurfaceMock,
  buildPlayerMatrixSurfaceMock,
  buildTeamMatrixSurfaceMock,
  parseGoalieMatrixRequestMock,
  parsePlayerMatrixRequestMock,
  parseTeamMatrixRequestMock,
} = vi.hoisted(() => ({
  buildGoalieMatrixSurfaceMock: vi.fn(),
  buildPlayerMatrixSurfaceMock: vi.fn(),
  buildTeamMatrixSurfaceMock: vi.fn(),
  parseGoalieMatrixRequestMock: vi.fn(),
  parsePlayerMatrixRequestMock: vi.fn(),
  parseTeamMatrixRequestMock: vi.fn(),
}));

vi.mock("./goalieMatrix", () => ({
  buildGoalieMatrixSurface: buildGoalieMatrixSurfaceMock,
  parseGoalieMatrixRequest: parseGoalieMatrixRequestMock,
}));

vi.mock("./playerMatrix", () => ({
  buildPlayerMatrixSurface: buildPlayerMatrixSurfaceMock,
  parsePlayerMatrixRequest: parsePlayerMatrixRequestMock,
}));

vi.mock("./teamMatrix", () => ({
  buildTeamMatrixSurface: buildTeamMatrixSurfaceMock,
  parseTeamMatrixRequest: parseTeamMatrixRequestMock,
}));

import { buildContextualRankingComparisonSurface } from "./comparison";

describe("buildContextualRankingComparisonSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns partial team comparisons without fabricating missing rows", async () => {
    parseTeamMatrixRequestMock.mockReturnValue({
      season: 20252026,
      asOfDate: null,
      metric: "off_rating",
      sortDirection: "desc",
      search: null,
      page: 1,
      pageSize: 10,
    });
    buildTeamMatrixSurfaceMock.mockResolvedValue({
      success: true,
      request: {},
      rows: [
        {
          team: {
            id: 25,
            abbreviation: "DAL",
            name: "Dallas Stars",
          },
          record: {
            latestPowerDate: "2026-06-13",
            styleSnapshotDate: "2026-06-12",
            styleGames: 20,
            ppTier: 1,
            pkTier: 2,
            trend10: 1.2,
          },
          metrics: {
            off_rating: {
              rawValue: 3.5,
              formattedValue: "3.5",
              rank: 2,
              percentile: 95,
              qualifiedPeerCount: 32,
              lowerIsBetter: false,
            },
          },
          warnings: ["raw_contextual_team_style"],
        },
      ],
      meta: {
        generatedAt: "2026-06-13T12:00:00.000Z",
        pageCount: 1,
        sourceTables: ["team_power_ratings_daily"],
        snapshotDate: "2026-06-13",
        latestAvailableSnapshotDate: "2026-06-13",
        sourceWarnings: ["team style is raw/contextual"],
        metricColumns: [
          {
            metricKey: "off_rating",
            label: "Off Rating",
            lowerIsBetter: false,
            source: "team_power_ratings_daily",
          },
        ],
      },
    });

    const response = await buildContextualRankingComparisonSurface({
      entity: "teams",
      teams: "DAL,MIN",
      season: "20252026",
    });

    expect(response).toMatchObject({
      success: true,
      version: "contextual_ranking_comparison_v1",
      status: "partial",
      request: {
        entity: "teams",
        season: 20252026,
        window: null,
        metric: "off_rating",
        subjectCount: 2,
      },
      source: {
        endpoint: "/api/v1/contextual-rankings/teams",
        sourceTables: ["team_power_ratings_daily"],
      },
      subjects: [
        {
          key: "DAL",
          label: "Dallas Stars",
          status: "available",
          caveats: ["raw_contextual_team_style"],
        },
        {
          key: "MIN",
          label: "MIN",
          status: "unavailable",
          row: null,
          reason: "Selected team is unavailable for the requested filter context.",
        },
      ],
      caveats: ["team style is raw/contextual"],
    });
    expect(buildTeamMatrixSurfaceMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 50 }),
    );
  });

  it("scans skater matrix pages until requested subjects are found", async () => {
    parsePlayerMatrixRequestMock.mockReturnValue({
      season: 20252026,
      window: "last10",
      sortMetric: "points_per_60",
      page: 1,
      pageSize: 10,
    });
    buildPlayerMatrixSurfaceMock
      .mockResolvedValueOnce({
        rows: [],
        meta: {
          generatedAt: "2026-06-13T12:00:00.000Z",
          pageCount: 2,
          sourceTable: "rolling_player_game_metrics",
          snapshotDate: "2026-06-13",
          latestAvailableSnapshotDate: "2026-06-13",
          unavailableMetrics: [],
          metricColumns: [],
        },
      })
      .mockResolvedValueOnce({
        rows: [
          {
            entity: { id: 97, name: "Connor McDavid" },
            warnings: [],
          },
        ],
        meta: {
          generatedAt: "2026-06-13T12:00:00.000Z",
          pageCount: 2,
          sourceTable: "rolling_player_game_metrics",
          snapshotDate: "2026-06-13",
          latestAvailableSnapshotDate: "2026-06-13",
          unavailableMetrics: [],
          metricColumns: [],
        },
      });

    const response = await buildContextualRankingComparisonSurface({
      entity: "skaters",
      player_ids: "97",
      season: "20252026",
      window: "last10",
    });

    expect(response.status).toBe("available");
    expect(response.subjects[0]).toMatchObject({
      key: "97",
      label: "Connor McDavid",
      status: "available",
    });
    expect(buildPlayerMatrixSurfaceMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ page: 1, pageSize: 50 }),
    );
    expect(buildPlayerMatrixSurfaceMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: 2, pageSize: 50 }),
    );
  });
});
