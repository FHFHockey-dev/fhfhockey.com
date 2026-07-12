import { describe, expect, it } from "vitest";

import { buildContextualRankingsAvailableFilters } from "./availableFilters";
import {
  aggregateTeamGameContextRows,
  aggregateTeamStyleRows,
  aggregateTeamUnitToiRows,
  buildTeamUnitMetricInterpretation,
  parseTeamMatrixRequest,
  rankTeamMetricValues,
} from "./teamMatrix";

describe("teamMatrix", () => {
  const publishedTeamMetricOptions =
    buildContextualRankingsAvailableFilters()
      .entities.find((entity) => entity.value === "teams")
      ?.filters.metrics.filter((metric) => metric.status === "available")
      .map((metric) => metric.value) ?? [];

  it("aggregates five-on-five team style rows by team abbreviation", () => {
    const teamsById = new Map([
      [1, { id: 1, abbreviation: "BOS", name: "Boston Bruins" }],
      [2, { id: 2, abbreviation: "TOR", name: "Toronto Maple Leafs" }],
    ]);
    const aggregates = aggregateTeamStyleRows({
      teamsById,
      rows: [
        {
          game_date: "2026-04-01",
          team_id: 1,
          xgf: 2,
          xga: 1,
          gf: 3,
          ga: 1,
          ff: 20,
          fa: 10,
          cf: 30,
          ca: 15,
        },
        {
          game_date: "2026-04-03",
          team_id: 1,
          xgf: 1.5,
          xga: 2,
          gf: 1,
          ga: 2,
          ff: 18,
          fa: 22,
          cf: 28,
          ca: 31,
        },
        {
          game_date: "2026-04-02",
          team_id: 2,
          xgf: 3,
          xga: 1,
          gf: 2,
          ga: 0,
          ff: 25,
          fa: 12,
          cf: 33,
          ca: 20,
        },
      ],
    });

    expect(aggregates.get("BOS")).toMatchObject({
      teamId: 1,
      gamesCount: 2,
      latestDate: "2026-04-03",
      xgf: 3.5,
      xga: 3,
      gf: 4,
      ga: 3,
      ff: 38,
      fa: 32,
      source: "team_underlying_stats_summary",
    });
    expect(aggregates.get("TOR")?.gamesCount).toBe(1);
  });

  it("parses team matrix requests with conservative defaults", () => {
    const request = parseTeamMatrixRequest({
      season: "20252026",
      metric: "xgf_percentage",
      search: "Leafs",
      page_size: "25",
    });

    expect(request).toMatchObject({
      season: 20252026,
      metric: "xgf_percentage",
      sortDirection: "desc",
      search: "Leafs",
      page: 1,
      pageSize: 25,
    });
  });

  it("parses every published live team metric option", () => {
    expect(publishedTeamMetricOptions).toEqual(
      expect.arrayContaining([
        "forward_top_load_index",
        "defense_pair_top_load_index",
        "pp1_pp2_usage_share",
      ]),
    );

    for (const metric of publishedTeamMetricOptions) {
      expect(
        parseTeamMatrixRequest({
          season: "20252026",
          metric,
        }).metric,
      ).toBe(metric);
    }
  });

  it("aggregates WGO team game-context rows by team id", () => {
    const aggregates = aggregateTeamGameContextRows([
      {
        date: "2026-04-01",
        team_id: 1,
        game_id: 101,
        home_road: "home",
        goals_for: 4,
        goals_against: 3,
        point_pct: 1,
        pp_opportunities_per_game: 4,
        penalties_taken_per_60: 3,
      },
      {
        date: "2026-04-03",
        team_id: 1,
        game_id: 102,
        home_road: "road",
        goals_for: 1,
        goals_against: 4,
        point_pct: 0,
        pp_opportunities_per_game: 2,
        penalties_taken_per_60: 5,
      },
      {
        date: "2026-04-02",
        team_id: 1,
        game_id: 103,
        home_road: "home",
        goals_for: 2,
        goals_against: 3,
        point_pct: 0.5,
        pp_opportunities_per_game: 3,
        penalties_taken_per_60: 4,
      },
    ]);

    expect(aggregates.get(1)).toMatchObject({
      teamId: 1,
      gamesCount: 3,
      latestDate: "2026-04-03",
      oneGoalGameRate: 66.666667,
      homeRoadPointPctGap: 75,
      powerPlayOpportunityRate: 3,
      penaltiesTakenPer60: 4,
    });
  });

  it("aggregates durable team unit-TOI rows into live usage metrics", () => {
    const aggregates = aggregateTeamUnitToiRows([
      {
        team_id: 1,
        game_id: 101,
        game_date: "2026-04-01",
        snapshot_date: "2026-06-22",
        unit_type: "forward_line",
        unit_number: 1,
        unit_share: 0.6,
        unit_toi_seconds: 180,
        team_unit_pool_toi_seconds: 300,
        coverage_status: "complete",
        coverage_warnings: [],
      },
      {
        team_id: 1,
        game_id: 101,
        game_date: "2026-04-01",
        snapshot_date: "2026-06-22",
        unit_type: "defense_pair",
        unit_number: 1,
        unit_share: 0.55,
        unit_toi_seconds: 110,
        team_unit_pool_toi_seconds: 200,
        coverage_status: "complete",
        coverage_warnings: [],
      },
      {
        team_id: 1,
        game_id: 101,
        game_date: "2026-04-01",
        snapshot_date: "2026-06-22",
        unit_type: "power_play",
        unit_number: 1,
        unit_share: 0.7,
        unit_toi_seconds: 70,
        team_unit_pool_toi_seconds: 100,
        coverage_status: "complete",
        coverage_warnings: [],
      },
      {
        team_id: 1,
        game_id: 101,
        game_date: "2026-04-01",
        snapshot_date: "2026-06-22",
        unit_type: "power_play",
        unit_number: 2,
        unit_share: 0.2,
        unit_toi_seconds: 20,
        team_unit_pool_toi_seconds: 100,
        coverage_status: "complete",
        coverage_warnings: [],
      },
      {
        team_id: 1,
        game_id: 102,
        game_date: "2026-04-03",
        snapshot_date: "2026-06-22",
        unit_type: "forward_line",
        unit_number: 1,
        unit_share: 0.5,
        unit_toi_seconds: 150,
        team_unit_pool_toi_seconds: 300,
        coverage_status: "partial",
        coverage_warnings: ["defense_pair_unresolved"],
      },
    ]);

    expect(aggregates.get(1)).toMatchObject({
      teamId: 1,
      gamesCount: 2,
      latestDate: "2026-04-03",
      snapshotDate: "2026-06-22",
      forwardTopLoadIndex: 55,
      defensePairTopLoadIndex: 55,
      pp1Pp2UsageShare: 90,
      coverage: {
        forwardTopLoad: {
          games: 2,
          latestDate: "2026-04-03",
          snapshotDate: "2026-06-22",
          status: "partial",
          warnings: ["defense_pair_unresolved"],
        },
        defensePairTopLoad: {
          games: 1,
          latestDate: "2026-04-01",
          snapshotDate: "2026-06-22",
          status: "partial",
        },
        pp1Pp2UsageShare: {
          games: 1,
          latestDate: "2026-04-01",
          snapshotDate: "2026-06-22",
          status: "partial",
        },
      },
    });
  });

  it("requires complete minimum unit coverage before naming top-load labels", () => {
    expect(
      buildTeamUnitMetricInterpretation({
        metricLabel: "Forward top load",
        coverage: {
          games: 3,
          latestDate: "2026-04-03",
          snapshotDate: "2026-06-22",
          status: "complete",
          warnings: [],
        },
      }),
    ).toMatchObject({
      label: "Forward top load coverage-qualified",
      coverageQualified: true,
    });
    expect(
      buildTeamUnitMetricInterpretation({
        metricLabel: "Forward top load",
        coverage: {
          games: 2,
          latestDate: "2026-04-03",
          snapshotDate: "2026-06-22",
          status: "partial",
          warnings: ["forward_lines_unresolved"],
        },
      }),
    ).toMatchObject({
      label: "Forward top load coverage-limited",
      coverageQualified: false,
      reason: expect.stringContaining("require 3 complete games"),
    });
  });

  it("ranks team metrics with dense ties and lower-is-better percentile direction", () => {
    const ranks = rankTeamMetricValues(
      [
        { id: "BOS", value: 2.1 },
        { id: "DAL", value: 2.1 },
        { id: "TOR", value: 3.4 },
        { id: "UTA", value: null },
      ],
      true,
    );

    expect(ranks.get("BOS")).toMatchObject({
      rank: 1,
      percentile: 50,
      qualifiedPeerCount: 3,
    });
    expect(ranks.get("DAL")).toMatchObject({
      rank: 1,
      percentile: 50,
      qualifiedPeerCount: 3,
    });
    expect(ranks.get("TOR")).toMatchObject({
      rank: 2,
      percentile: 0,
      qualifiedPeerCount: 3,
    });
    expect(ranks.has("UTA")).toBe(false);
  });
});
