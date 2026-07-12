import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GoalieMatrixResponse } from "lib/rankings/goalieMatrix";
import type { TeamMatrixResponse } from "lib/rankings/teamMatrix";
import {
  TEAM_ADJUSTED_STYLE_SOURCE_CONTRACTS,
  TEAM_STYLE_SOURCE_CONTRACT,
} from "lib/rankings/teamStyleMethodology";

import GoalieMatrixTable from "./GoalieMatrixTable";
import TeamMatrixTable from "./TeamMatrixTable";

afterEach(() => {
  cleanup();
});

function goalieCell(
  metricKey: keyof GoalieMatrixResponse["rows"][number]["metrics"],
  overrides: Partial<GoalieMatrixResponse["rows"][number]["metrics"][typeof metricKey]> = {},
) {
  return {
    metricKey,
    rawValue: 0.925,
    formattedValue: ".925",
    rank: 3,
    percentile: 88.4,
    qualifiedPeerCount: 42,
    lowerIsBetter: false,
    ...overrides,
  };
}

const goaliePayload: GoalieMatrixResponse = {
  success: true,
  request: {
    season: 20252026,
    asOfDate: null,
    window: "season",
    metric: "save_percentage",
    sortDirection: "desc",
    role: "all",
    minStarts: 1,
    minShots: 300,
    team: null,
    search: null,
    page: 1,
    pageSize: 10,
  },
  rows: [
    {
      entity: {
        id: 31,
        name: "Test Goalie",
        position: "G",
        imageUrl: null,
      },
      team: {
        id: 1,
        abbreviation: "TST",
        name: "Test Team",
      },
      sample: {
        gamesPlayed: 12,
        gamesStarted: 10,
        shotsAgainst: 320,
        toiSeconds: 36000,
        minimumSampleMet: true,
        confidence: "high",
      },
      role: {
        deploymentBucket: "g1_workhorse",
        deploymentLabel: "G1 Workhorse",
        deploymentSource: "goalie_start_projections.season_start_pct",
        rawStartShare: 0.83,
        adjustedStartShare: 1,
        coreStartShare: 1,
        coreGoalieIds: [31, 32],
        excludedTeamStarts: 2,
        roleConfidence: "high",
        roleNotes: [
          "Raw window share uses 10 starts out of 12 team starts.",
          "Adjusted core share uses inferred top-two goalie starts only (10 starts).",
          "Projected season start share is available and remains the primary role source.",
        ],
        windowStartShare: 0.83,
        startShareLast10: 0.7,
        seasonStartShare: 0.65,
        startProbability: 0.7,
        projectedGsaaPer60: 0.2,
        confirmedStatus: true,
      },
      sort: {
        metricKey: "save_percentage",
        rank: 3,
        percentile: 88.4,
      },
      metrics: {
        save_percentage: goalieCell("save_percentage"),
        relative_save_percentage: goalieCell("relative_save_percentage", {
          rawValue: 0.027,
          formattedValue: "2.7%",
          rank: 7,
          percentile: 84,
        }),
        gsax: goalieCell("gsax", {
          rawValue: null,
          formattedValue: null,
          rank: null,
          percentile: null,
        }),
        gsaa_per_60: goalieCell("gsaa_per_60", {
          rawValue: 0,
          formattedValue: "0.00",
          rank: 18,
          percentile: 50,
        }),
        xga_per_shot_against: goalieCell("xga_per_shot_against", {
          rawValue: 0.092,
          formattedValue: "0.092",
          rank: 12,
          percentile: 70,
        }),
        goalie_value_signal: goalieCell("goalie_value_signal", {
          rawValue: 1.4,
          formattedValue: "1.4",
          rank: 8,
          percentile: 82,
        }),
        high_danger_save_percentage: goalieCell("high_danger_save_percentage", {
          rawValue: 0.818,
          formattedValue: "81.8%",
          rank: 9,
          percentile: 78,
        }),
        quality_start_pct: goalieCell("quality_start_pct"),
        really_bad_start_rate: goalieCell("really_bad_start_rate", {
          rawValue: 0.1,
          formattedValue: "10.0%",
          rank: 5,
          percentile: 80,
          lowerIsBetter: true,
        }),
        steal_rate: goalieCell("steal_rate"),
        start_share: goalieCell("start_share"),
      },
      warnings: [],
    },
  ],
  meta: {
    generatedAt: "2026-06-13T12:00:00.000Z",
    rowCount: 1,
    totalRankedRows: 42,
    page: 1,
    pageSize: 10,
    pageCount: 1,
    snapshotDate: "2026-06-13",
    latestAvailableSnapshotDate: "2026-06-13",
    sourceTables: ["goalie_stats_unified"],
    metricColumns: [
      {
        metricKey: "really_bad_start_rate",
        label: "RBS%",
        description: "Really bad start rate",
        lowerIsBetter: true,
        source: "goalieMethodology",
      },
      {
        metricKey: "save_percentage",
        label: "SV%",
        description: "Save percentage",
        lowerIsBetter: false,
        source: "goalie_stats_unified",
      },
      {
        metricKey: "relative_save_percentage",
        label: "Rel SV%",
        description: "Relative save percentage",
        lowerIsBetter: false,
        source: "goalie_stats_unified same-team baseline",
      },
      {
        metricKey: "gsax",
        label: "GSAx",
        description: "Goals saved above expected",
        lowerIsBetter: false,
        source: "goalie_stats_unified",
      },
      {
        metricKey: "xga_per_shot_against",
        label: "xGA/Shot",
        description: "Shot-quality workload",
        lowerIsBetter: false,
        source:
          "goalie_stats_unified.nst_5v5_counts_xg_against / nst_5v5_counts_shots_against",
      },
      {
        metricKey: "high_danger_save_percentage",
        label: "HD SV%",
        description: "High-danger save percentage",
        lowerIsBetter: false,
        source: "goalie_stats_unified.nst_5v5_counts_hd_sv_percentage",
      },
    ],
    sourceWarnings: [],
    sourcePendingMetricContracts: [
      {
        metricKey: "under_pressure_profile",
        label: "Under Pressure",
        status: "source_pending",
        reason: "Pressure-quadrant source rows are not published.",
        requiredFields: ["pressure labels", "save outcomes"],
      },
    ],
  },
};

function teamCell(
  metricKey: keyof TeamMatrixResponse["rows"][number]["metrics"],
  overrides: Partial<TeamMatrixResponse["rows"][number]["metrics"][typeof metricKey]> = {},
) {
  return {
    rawValue: 2.85,
    formattedValue: "2.85",
    rank: 4,
    percentile: 84.2,
    qualifiedPeerCount: 32,
    lowerIsBetter: false,
    ...overrides,
  };
}

const teamUnitCoverage: TeamMatrixResponse["rows"][number]["unitUsage"]["coverage"] = {
  forwardTopLoad: {
    games: 20,
    latestDate: "2026-06-13",
    snapshotDate: "2026-06-22",
    status: "complete",
    warnings: [],
  },
  defensePairTopLoad: {
    games: 20,
    latestDate: "2026-06-13",
    snapshotDate: "2026-06-22",
    status: "complete",
    warnings: [],
  },
  pp1Pp2UsageShare: {
    games: 20,
    latestDate: "2026-06-13",
    snapshotDate: "2026-06-22",
    status: "complete",
    warnings: [],
  },
};

const teamUnitLabels: TeamMatrixResponse["rows"][number]["unitUsage"]["labels"] = {
  forwardTopLoad: {
    label: "Forward top load coverage-qualified",
    coverageQualified: true,
    minimumGames: 3,
    reason: "20 complete resolved games support this unit-usage label.",
  },
  defensePairTopLoad: {
    label: "Defense pair top load coverage-qualified",
    coverageQualified: true,
    minimumGames: 3,
    reason: "20 complete resolved games support this unit-usage label.",
  },
  pp1Pp2UsageShare: {
    label: "PP1/PP2 usage share coverage-qualified",
    coverageQualified: true,
    minimumGames: 3,
    reason: "20 complete resolved games support this unit-usage label.",
  },
};

const teamPayload: TeamMatrixResponse = {
  success: true,
  request: {
    season: 20252026,
    asOfDate: null,
    metric: "off_rating",
    sortDirection: "desc",
    search: null,
    page: 1,
    pageSize: 10,
  },
  rows: [
    {
      team: {
        id: 1,
        abbreviation: "TST",
        name: "Test Team",
      },
      record: {
        latestPowerDate: "2026-06-13",
        styleSnapshotDate: "2026-06-13",
        styleGames: 20,
        ppTier: 1,
        pkTier: 2,
        trend10: 1.2,
      },
      style: {
        label: "High Event",
        descriptorType: "raw_contextual",
        displayLabel: "High Event (raw/contextual)",
        adjustedTargetLabel: "Score- and venue-adjusted 5v5 team style",
        adjustedStatus: "source_pending",
        interpretation:
          "Environment descriptor from current raw/contextual 5v5 inputs; not a coach/system claim.",
        paceAxis: "Fast",
        controlAxis: "Control",
        xgForPercentage: 0.55,
        eventRate: 6.1,
        shotQuality: null,
        source: "team_underlying_stats_summary",
        adjusted: false,
      },
      luck: {
        finishingLuck: 2,
        saveLuck: -1,
        netGoalsAboveExpected: 1,
      },
      context: {
        games: 20,
        latestDate: "2026-06-13",
        oneGoalGameRate: 45,
        homeRoadPointPctGap: 12.5,
        powerPlayOpportunityRate: 3.4,
        penaltiesTakenPer60: 4.2,
      },
      unitUsage: {
        games: 20,
        latestDate: "2026-06-13",
        snapshotDate: "2026-06-22",
        forwardTopLoadIndex: 56.2,
        defensePairTopLoadIndex: 49.4,
        pp1Pp2UsageShare: 91.5,
        coverage: teamUnitCoverage,
        labels: teamUnitLabels,
      },
      sort: {
        metricKey: "off_rating",
        rank: 4,
        percentile: 84.2,
      },
      metrics: {
        off_rating: teamCell("off_rating"),
        def_rating: teamCell("def_rating"),
        xgf60: teamCell("xgf60"),
        xga60: teamCell("xga60", {
          lowerIsBetter: true,
          rawValue: 2.2,
          formattedValue: "2.20",
          rank: 5,
          percentile: 80,
        }),
        xgf_percentage: teamCell("xgf_percentage"),
        shot_quality: teamCell("shot_quality", {
          rawValue: null,
          formattedValue: null,
          rank: null,
          percentile: null,
        }),
        event_rate: teamCell("event_rate"),
        finishing_luck: teamCell("finishing_luck"),
        save_luck: teamCell("save_luck"),
        net_luck: teamCell("net_luck"),
        pace_rating: teamCell("pace_rating"),
        special_rating: teamCell("special_rating"),
        one_goal_game_rate: teamCell("one_goal_game_rate", {
          rawValue: 45,
          formattedValue: "45.0%",
          rank: 10,
          percentile: 70,
        }),
        home_road_point_pct_gap: teamCell("home_road_point_pct_gap", {
          rawValue: 12.5,
          formattedValue: "12.50",
          rank: 7,
          percentile: 78,
        }),
        pp_opportunity_rate: teamCell("pp_opportunity_rate", {
          rawValue: 3.4,
          formattedValue: "3.40",
          rank: 5,
          percentile: 84,
        }),
        penalties_taken_per_60: teamCell("penalties_taken_per_60", {
          rawValue: 4.2,
          formattedValue: "4.20",
          rank: 15,
          percentile: 55,
          lowerIsBetter: true,
        }),
        forward_top_load_index: teamCell("forward_top_load_index", {
          rawValue: 56.2,
          formattedValue: "56.2%",
          rank: 8,
          percentile: 76,
        }),
        defense_pair_top_load_index: teamCell("defense_pair_top_load_index", {
          rawValue: 49.4,
          formattedValue: "49.4%",
          rank: 11,
          percentile: 66,
        }),
        pp1_pp2_usage_share: teamCell("pp1_pp2_usage_share", {
          rawValue: 91.5,
          formattedValue: "91.5%",
          rank: 4,
          percentile: 88,
        }),
      },
      warnings: ["raw score-and-venue adjustment unavailable"],
    },
  ],
  meta: {
    generatedAt: "2026-06-13T12:00:00.000Z",
    rowCount: 1,
    totalRankedRows: 32,
    page: 1,
    pageSize: 10,
    pageCount: 1,
    snapshotDate: "2026-06-13",
    latestAvailableSnapshotDate: "2026-06-13",
    styleSnapshotDate: "2026-06-13",
    sourceTables: ["team_power_ratings_daily", "wgo_team_stats", "games", "team_unit_toi"],
    sourceWarnings: [],
    teamStyleContract: TEAM_STYLE_SOURCE_CONTRACT,
    sourcePendingMetricContracts: TEAM_ADJUSTED_STYLE_SOURCE_CONTRACTS,
    metricColumns: [
      {
        metricKey: "off_rating",
        label: "Off Rating",
        description: "Offensive rating",
        lowerIsBetter: false,
        source: "team_power_ratings_daily",
      },
      {
        metricKey: "xga60",
        label: "xGA/60",
        description: "Expected goals against",
        lowerIsBetter: true,
        source: "team_power_ratings_daily",
      },
      {
        metricKey: "shot_quality",
        label: "Shot Quality",
        description: "Shot quality",
        lowerIsBetter: false,
        source: "teamStyleMethodology",
      },
      {
        metricKey: "one_goal_game_rate",
        label: "1-Goal%",
        description: "One-goal game rate",
        lowerIsBetter: false,
        source: "wgo_team_stats + games",
      },
      {
        metricKey: "home_road_point_pct_gap",
        label: "Home Edge",
        description: "Home point gap",
        lowerIsBetter: false,
        source: "wgo_team_stats",
      },
      {
        metricKey: "pp_opportunity_rate",
        label: "PP Opp/G",
        description: "Power-play opportunities",
        lowerIsBetter: false,
        source: "wgo_team_stats",
      },
      {
        metricKey: "penalties_taken_per_60",
        label: "Pen/60",
        description: "Penalties taken",
        lowerIsBetter: true,
        source: "wgo_team_stats",
      },
      {
        metricKey: "forward_top_load_index",
        label: "Fwd Top Load",
        description: "Forward top load",
        lowerIsBetter: false,
        source: "team_unit_toi",
      },
      {
        metricKey: "defense_pair_top_load_index",
        label: "Pair Top Load",
        description: "Defense pair top load",
        lowerIsBetter: false,
        source: "team_unit_toi",
      },
      {
        metricKey: "pp1_pp2_usage_share",
        label: "PP1/PP2 Share",
        description: "PP1/PP2 usage",
        lowerIsBetter: false,
        source: "team_unit_toi",
      },
    ],
  },
};

describe("GoalieMatrixTable and TeamMatrixTable", () => {
  it("renders goalie metric cells with percentile, rank, raw value, and source-pending state", () => {
    render(
      <GoalieMatrixTable
        payload={goaliePayload}
        isLoading={false}
        selectedGoalieId={31}
        onSelectGoalie={vi.fn()}
        onSortMetric={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Sort Rank")).toBeTruthy();
    expect(screen.getByText("Test Goalie")).toBeTruthy();
    expect(screen.getByText("G1 Workhorse")).toBeTruthy();
    expect(screen.getByText("83.0%")).toBeTruthy();
    expect(screen.getByText("100.0%")).toBeTruthy();
    expect(screen.getByLabelText("G1 Workhorse role, high confidence")).toBeTruthy();
    expect(screen.getByText("88%")).toBeTruthy();
    expect(screen.getByText("xGA/Shot")).toBeTruthy();
    expect(screen.getByText("0.092")).toBeTruthy();
    expect(screen.getByText("HD SV%")).toBeTruthy();
    expect(screen.getByText("81.8%")).toBeTruthy();
    expect(
      screen.getByText(/Source-pending goalie contracts: Under Pressure/),
    ).toBeTruthy();
    expect(screen.getAllByText("#3").length).toBeGreaterThan(0);
    expect(screen.getByText(".925")).toBeTruthy();
    expect(screen.getAllByLabelText("Source pending").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Goalie source state legend")).toBeTruthy();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/SV%.*Value \.925.*Rank 3.*Percentile 88\.4%/)).toBeTruthy();
  });

  it("renders goalie stale-source state from matrix freshness metadata", () => {
    render(
      <GoalieMatrixTable
        payload={{
          ...goaliePayload,
          meta: {
            ...goaliePayload.meta,
            snapshotDate: "2026-06-12",
            latestAvailableSnapshotDate: "2026-06-13",
          },
        }}
        isLoading={false}
        selectedGoalieId={31}
        onSelectGoalie={vi.fn()}
        onSortMetric={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getAllByLabelText("Stale source").length).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText(
        /Snapshot is older than latest available goalie matrix snapshot/,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("renders team metric cells with lower-is-better semantics and source-pending state", () => {
    render(
      <TeamMatrixTable
        payload={teamPayload}
        isLoading={false}
        selectedTeam="TST"
        onSelectTeam={vi.fn()}
        onSortMetric={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Sort Rank")).toBeTruthy();
    expect(screen.getByText("High Event (raw/contextual)")).toBeTruthy();
    expect(screen.getByText(/not a coach\/system claim/)).toBeTruthy();
    expect(screen.getAllByText("84%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("#4").length).toBeGreaterThan(0);
    expect(screen.getByText("2.85")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
    expect(screen.getAllByText("#5").length).toBeGreaterThan(0);
    expect(screen.getByText("2.20")).toBeTruthy();
    expect(screen.getByText("1-Goal%")).toBeTruthy();
    expect(screen.getByText("45.0%")).toBeTruthy();
    expect(screen.getByText("Home Edge")).toBeTruthy();
    expect(screen.getByText("12.50")).toBeTruthy();
    expect(screen.getByText("PP Opp/G")).toBeTruthy();
    expect(screen.getByText("3.40")).toBeTruthy();
    expect(screen.getByText("Pen/60")).toBeTruthy();
    expect(screen.getByText("4.20")).toBeTruthy();
    expect(screen.getByText("Fwd Top Load")).toBeTruthy();
    expect(screen.getByText("56.2%")).toBeTruthy();
    expect(screen.getByText("Pair Top Load")).toBeTruthy();
    expect(screen.getByText("49.4%")).toBeTruthy();
    expect(screen.getByText("PP1/PP2 Share")).toBeTruthy();
    expect(screen.getByText("91.5%")).toBeTruthy();
    expect(screen.getByText(/Source-pending team contracts:/)).toBeTruthy();
    expect(screen.getAllByLabelText("Source pending").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Raw context").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Team source state legend")).toBeTruthy();
    expect(screen.getByLabelText(/xGA\/60.*Value 2\.20.*Rank 5.*Lower raw values are better/)).toBeTruthy();
  });

  it("renders team stale-source state when style source lags power snapshot", () => {
    render(
      <TeamMatrixTable
        payload={{
          ...teamPayload,
          rows: [
            {
              ...teamPayload.rows[0],
              record: {
                ...teamPayload.rows[0].record,
                latestPowerDate: "2026-06-13",
                styleSnapshotDate: "2026-06-11",
              },
              metrics: {
                ...teamPayload.rows[0].metrics,
                shot_quality: teamCell("shot_quality", {
                  rawValue: 0.092,
                  formattedValue: "0.092",
                  rank: 12,
                  percentile: 58,
                }),
              },
            },
          ],
        }}
        isLoading={false}
        selectedTeam="TST"
        onSelectTeam={vi.fn()}
        onSortMetric={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Stale source")).toBeTruthy();
    expect(
      screen.getByLabelText(
        /Team style source 2026-06-11 differs from team power snapshot 2026-06-13/,
      ),
    ).toBeTruthy();
  });

  it("distinguishes missing team unit coverage from a low top-load value", () => {
    render(
      <TeamMatrixTable
        payload={{
          ...teamPayload,
          request: {
            ...teamPayload.request,
            metric: "forward_top_load_index",
          },
          rows: [
            {
              ...teamPayload.rows[0],
              unitUsage: {
                ...teamPayload.rows[0].unitUsage,
                forwardTopLoadIndex: null,
                coverage: {
                  ...teamPayload.rows[0].unitUsage.coverage,
                  forwardTopLoad: {
                    games: 0,
                    latestDate: null,
                    snapshotDate: "2026-06-22",
                    status: "source_gap",
                    warnings: ["forward_lines_unresolved"],
                  },
                },
              },
              metrics: {
                ...teamPayload.rows[0].metrics,
                forward_top_load_index: teamCell("forward_top_load_index", {
                  rawValue: null,
                  formattedValue: null,
                  rank: null,
                  percentile: null,
                }),
              },
            },
          ],
        }}
        isLoading={false}
        selectedTeam="TST"
        onSelectTeam={vi.fn()}
        onSortMetric={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("No unit coverage")).toBeTruthy();
    expect(
      screen.getByLabelText(
        /Fwd Top Load.*Unit coverage source_gap; resolved games 0; latest none.*forward_lines_unresolved/,
      ),
    ).toBeTruthy();
  });
});
