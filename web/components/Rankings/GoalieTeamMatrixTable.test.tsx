import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GoalieMatrixResponse } from "lib/rankings/goalieMatrix";
import type { TeamMatrixResponse } from "lib/rankings/teamMatrix";
import { TEAM_STYLE_SOURCE_CONTRACT } from "lib/rankings/teamStyleMethodology";

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
        metricKey: "gsax",
        label: "GSAx",
        description: "Goals saved above expected",
        lowerIsBetter: false,
        source: "goalie_stats_unified",
      },
    ],
    sourceWarnings: [],
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
    sourceTables: ["team_power_ratings_daily"],
    sourceWarnings: [],
    teamStyleContract: TEAM_STYLE_SOURCE_CONTRACT,
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
    expect(screen.getByText("88%")).toBeTruthy();
    expect(screen.getAllByText("#3").length).toBeGreaterThan(0);
    expect(screen.getByText(".925")).toBeTruthy();
    expect(screen.getByText("Source pending")).toBeTruthy();
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

    expect(screen.getAllByText("Stale source").length).toBeGreaterThan(0);
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
    expect(screen.getByText("High Event")).toBeTruthy();
    expect(screen.getByText("84%")).toBeTruthy();
    expect(screen.getAllByText("#4").length).toBeGreaterThan(0);
    expect(screen.getByText("2.85")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
    expect(screen.getByText("#5")).toBeTruthy();
    expect(screen.getByText("2.20")).toBeTruthy();
    expect(screen.getByText("Source pending")).toBeTruthy();
    expect(screen.getAllByText("Raw context").length).toBeGreaterThan(0);
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

    expect(screen.getByText("Stale source")).toBeTruthy();
    expect(
      screen.getByLabelText(
        /Team style source 2026-06-11 differs from team power snapshot 2026-06-13/,
      ),
    ).toBeTruthy();
  });
});
