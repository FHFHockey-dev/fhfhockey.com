import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildPlayerMatrixSurface: vi.fn(),
  parsePlayerMatrixRequestWithResolvedTeam: vi.fn(),
  buildGoalieMatrixSurface: vi.fn(),
  parseGoalieMatrixRequest: vi.fn(),
  buildTeamMatrixSurface: vi.fn(),
  parseTeamMatrixRequest: vi.fn(),
}));

vi.mock("./playerMatrix", () => ({
  buildPlayerMatrixSurface: mocks.buildPlayerMatrixSurface,
  parsePlayerMatrixRequestWithResolvedTeam: mocks.parsePlayerMatrixRequestWithResolvedTeam,
}));

vi.mock("./goalieMatrix", () => ({
  buildGoalieMatrixSurface: mocks.buildGoalieMatrixSurface,
  parseGoalieMatrixRequest: mocks.parseGoalieMatrixRequest,
}));

vi.mock("./teamMatrix", () => ({
  buildTeamMatrixSurface: mocks.buildTeamMatrixSurface,
  parseTeamMatrixRequest: mocks.parseTeamMatrixRequest,
}));

import { buildContextualRankingSnapshotSurface } from "./snapshot";

function playerPayload(rows: any[], page: number, pageCount = 2) {
  return {
    rows,
    meta: {
      page,
      pageCount,
      sourceTable: "rolling_player_game_metrics",
      snapshotDate: "2026-04-16",
      latestAvailableSnapshotDate: "2026-04-16",
      generatedAt: "2026-06-13T12:00:00.000Z",
      unavailableMetrics: [],
    },
  };
}

function goaliePayload(rows: any[], page = 1, pageCount = 1) {
  return {
    rows,
    meta: {
      page,
      pageCount,
      sourceTables: ["goalie_stats_unified"],
      snapshotDate: "2026-06-12",
      latestAvailableSnapshotDate: "2026-06-12",
      generatedAt: "2026-06-13T12:00:00.000Z",
      sourceWarnings: [],
    },
  };
}

function teamPayload(rows: any[], page = 1, pageCount = 1) {
  return {
    rows,
    meta: {
      page,
      pageCount,
      sourceTables: ["team_power_ratings_daily"],
      snapshotDate: "2026-06-12",
      latestAvailableSnapshotDate: "2026-06-12",
      generatedAt: "2026-06-13T12:00:00.000Z",
      sourceWarnings: ["team style source snapshot differs"],
    },
  };
}

describe("buildContextualRankingSnapshotSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parsePlayerMatrixRequestWithResolvedTeam.mockResolvedValue({
      entity: "skaters",
      season: 20252026,
      window: "season",
      page: 1,
      pageSize: 50,
    });
    mocks.parseGoalieMatrixRequest.mockReturnValue({
      season: 20252026,
      window: "last10",
      metric: "save_percentage",
      role: "all",
      page: 1,
      pageSize: 50,
    });
    mocks.parseTeamMatrixRequest.mockReturnValue({
      season: 20252026,
      metric: "off_rating",
      page: 1,
      pageSize: 50,
    });
  });

  it("asks the matrix for the page holding the selected player in one build", async () => {
    const playerRow = {
      entity: { id: 87, name: "Selected Skater" },
      warnings: ["low_sample"],
    };
    mocks.buildPlayerMatrixSurface.mockResolvedValueOnce(playerPayload([playerRow], 2, 2));

    const result = await buildContextualRankingSnapshotSurface({
      entity: "skaters",
      season: "20252026",
      player_id: "87",
    });

    expect(result).toMatchObject({
      success: true,
      version: "contextual_ranking_snapshot_v1",
      status: "available",
      request: {
        entity: "skaters",
        season: 20252026,
        selectedPlayerId: 87,
      },
      source: {
        endpoint: "/api/v1/contextual-rankings/matrix",
        sourceTables: ["rolling_player_game_metrics", "skater_composite_ratings"],
      },
      caveats: ["low_sample"],
    });
    expect(result.row).toBe(playerRow);
    expect(mocks.buildPlayerMatrixSurface).toHaveBeenCalledTimes(1);
    expect(mocks.buildPlayerMatrixSurface).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 50, pageForSelected: true }),
    );
  });

  it("reports a skater outside the published cohort explicitly, without scanning pages", async () => {
    mocks.buildPlayerMatrixSurface.mockResolvedValueOnce({
      ...playerPayload([], 1, 15),
      meta: {
        ...playerPayload([], 1, 15).meta,
        selectedPlayerAbsent: true,
        rankingSource: "entity_metric_rankings",
      },
    });

    const result = await buildContextualRankingSnapshotSurface({
      entity: "skaters",
      season: "20252026",
      player_id: "8473533",
    });

    expect(result).toMatchObject({
      status: "unavailable",
      row: null,
      reason: "Selected skater is not in the published cohort for this context.",
    });
    expect(mocks.buildPlayerMatrixSurface).toHaveBeenCalledTimes(1);
  });

  it("returns a goalie snapshot from the goalie matrix source", async () => {
    const goalieRow = {
      entity: { id: 31, name: "Selected Goalie" },
      warnings: [],
    };
    mocks.buildGoalieMatrixSurface.mockResolvedValue(goaliePayload([goalieRow]));

    const result = await buildContextualRankingSnapshotSurface({
      entity: "goalies",
      season: "20252026",
      selected_goalie: "31",
      goalie_metric: "gsax",
    });

    expect(result).toMatchObject({
      status: "available",
      request: {
        entity: "goalies",
        selectedGoalieId: 31,
      },
      source: {
        endpoint: "/api/v1/contextual-rankings/goalies",
        sourceTables: ["goalie_stats_unified"],
      },
    });
    expect(result.row).toBe(goalieRow);
    expect(mocks.parseGoalieMatrixRequest).toHaveBeenCalledWith(
      expect.objectContaining({ metric: "gsax", page_size: "50" }),
    );
  });

  it("returns unavailable without fake rows when the selected team is absent", async () => {
    mocks.buildTeamMatrixSurface.mockResolvedValue(
      teamPayload([{ team: { abbreviation: "DAL" }, warnings: [] }]),
    );

    const result = await buildContextualRankingSnapshotSurface({
      entity: "teams",
      season: "20252026",
      selected_team: "BOS",
    });

    expect(result).toMatchObject({
      status: "unavailable",
      row: null,
      request: {
        entity: "teams",
        selectedTeam: "BOS",
      },
      source: {
        endpoint: "/api/v1/contextual-rankings/teams",
        sourceTables: ["team_power_ratings_daily"],
      },
      reason: "Selected team is unavailable for the requested filter context.",
      caveats: ["team style source snapshot differs"],
    });
  });
});
