import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContextualRankingComparisonResponse } from "lib/rankings/comparison";
import type { DeploymentTiersResponse } from "lib/rankings/deploymentTiers";
import type { GoalieMatrixResponse } from "lib/rankings/goalieMatrix";
import type { PlayerMatrixResponse } from "lib/rankings/playerMatrix";
import type { RankingsSplitsResponse } from "lib/rankings/splits";
import type { TeamMatrixResponse } from "lib/rankings/teamMatrix";
import type { TrendingResponse } from "lib/rankings/trending";
import type { WarSurfaceResponse } from "lib/rankings/war";
import {
  TEAM_ADJUSTED_STYLE_SOURCE_CONTRACTS,
  TEAM_STYLE_SOURCE_CONTRACT,
} from "lib/rankings/teamStyleMethodology";
import type {
  ContextualRankingApiRow,
  ContextualRankingsRequest,
  ContextualRankingsResponse,
} from "lib/rankings/rankingTypes";

const { replaceMock, routerState, swrMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  routerState: {
    pathname: "/rankings",
    query: {} as Record<string, string>,
  },
  swrMock: vi.fn(),
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: routerState.pathname,
    query: routerState.query,
    replace: replaceMock,
  }),
}));

vi.mock("swr", () => ({
  default: (key: string | null) => swrMock(key),
}));

import RankingsPage from "../../pages/rankings";

const rankingRequest: ContextualRankingsRequest = {
  entity: "skaters",
  season: 20252026,
  asOfDate: null,
  window: "season",
  position: "all",
  deployment: "all",
  strength: "5v5",
  metric: "goals_per_60",
  minGp: 1,
  minToiSeconds: 300,
  teamId: null,
  peerGroupType: "all_skaters",
  sort: "percentile",
  direction: "desc",
  limit: 100,
  entityIds: null,
};

const rankingRow: ContextualRankingApiRow = {
  entity: {
    id: 1,
    name: "Matt Savoie",
    position: "C",
    positionGroup: "forward",
    imageUrl: null,
  },
  team: {
    id: 7,
    abbreviation: "BUF",
    name: "Buffalo Sabres",
  },
  deployment: {
    ev: "L2",
    pp: "PP1",
    pk: null,
    confidence: "medium",
  },
  sample: {
    gamesPlayed: 12,
    toiSeconds: 8400,
    toiPerGameSeconds: 700,
    confidence: "high",
    minimumSampleMet: true,
  },
  metric: {
    key: "goals_per_60",
    value: 1.1,
    formattedValue: "1.10",
    rawRank: 2,
    percentile: 92.2,
    qualifiedPeerCount: 18,
  },
  peerGroup: {
    type: "all_skaters",
    key: "all",
  },
  tags: ["L2", "PP1"],
  warnings: [],
  explanationItems: ["Rank 2 of 18 among all skaters."],
};

const matrixPayload: PlayerMatrixResponse = {
  success: true,
  request: {
    entity: "skaters",
    season: 20252026,
    asOfDate: null,
    window: "season",
    position: "all",
    deployment: "all",
    strength: "5v5",
    minGp: 1,
    minToiSeconds: 300,
    teamId: null,
    search: null,
    peerGroupType: "all_skaters",
    sortMetric: "points_per_60",
    sortDirection: "desc",
    sampleConfidence: "all",
    page: 1,
    pageSize: 10,
    selectedPlayerId: 1,
    rankingSourcePreference: "entity_metric_rankings",
  },
  selectedPlayerId: 1,
  rows: [
    {
      entity: rankingRow.entity,
      team: rankingRow.team,
      deployment: rankingRow.deployment,
      sample: rankingRow.sample,
      peerGroup: rankingRow.peerGroup,
      tags: rankingRow.tags,
      warnings: rankingRow.warnings,
      sort: {
        metricKey: "points_per_60",
        rank: 2,
        percentile: 92.2,
      },
      composite: null,
      metrics: {
        points_per_60: {
          metricKey: "points_per_60",
          shortLabel: "P/60",
          fullLabel: "Points/60",
          groupKey: "offense",
          rawValue: 3.2,
          formattedValue: "3.20",
          rank: 2,
          percentile: 92.2,
          qualifiedPeerCount: 18,
          lowerIsBetter: false,
          availabilityState: "available",
          availabilityReason: null,
          sampleConfidence: "high",
          sourceQualityFlags: [],
          denominatorKey: "toi_seconds",
          denominatorDescription: "TOI seconds",
          methodologyVersion: "contextual_rankings_v1",
          snapshotDate: "2026-04-16",
          warnings: [],
        },
      },
    },
  ],
  meta: {
    generatedAt: "2026-06-08T12:00:00.000Z",
    rowCount: 1,
    totalRankedRows: 18,
    page: 1,
    pageSize: 10,
    pageCount: 2,
    sortMetric: "points_per_60",
    sortDirection: "desc",
    metricGroups: [{ key: "offense", label: "Offense", description: "Offense" }],
    metricColumns: [
      {
        metricKey: "points_per_60",
        groupKey: "offense",
        shortLabel: "P/60",
        fullLabel: "Points/60",
        tooltip: "Points",
        defaultVisible: true,
        playerTypes: ["skater"],
        definition: undefined,
        availabilityState: "available",
        lowerIsBetter: false,
        sourceQualityFlags: [],
        denominatorKey: "toi_seconds",
        denominatorDescription: "TOI seconds",
        methodologyVersion: "contextual_rankings_v1",
      },
    ],
    plannedMetrics: [],
    unavailableMetrics: [],
    colorScaleBands: [{ label: "90-94", min: 90, max: 94.999, tone: "elite" }],
    activePeerGroupDescription: "all skaters",
    snapshotDate: "2026-04-16",
    latestAvailableSnapshotDate: "2026-04-16",
    snapshotUpdatedAt: "2026-04-16T06:00:00.000Z",
    snapshotSelectionReason: "latest_available",
    sourceTable: "entity_metric_rankings",
    sourceTables: ["entity_metric_rankings", "skater_composite_ratings"],
    rankingSource: "entity_metric_rankings",
    rankingSourcePreference: "entity_metric_rankings",
    rankingSourceFallbackReason: null,
    compositeSourceTable: "skater_composite_ratings",
    message: null,
  },
};

const explorerPayload: ContextualRankingsResponse = {
  success: true,
  request: rankingRequest,
  rankings: [rankingRow],
  meta: {
    generatedAt: "2026-06-08T12:00:00.000Z",
    snapshotDate: "2026-04-16",
    snapshotUpdatedAt: "2026-04-16T06:00:00.000Z",
    latestAvailableSnapshotDate: "2026-04-16",
    snapshotSelectionReason: "latest_available",
    sourceTable: "entity_metric_rankings",
    sourceTables: ["entity_metric_rankings"],
    rankingSource: "entity_metric_rankings",
    rankingSourcePreference: "entity_metric_rankings",
    rankingSourceFallbackReason: null,
    metric: {
      key: "goals_per_60",
      displayName: "Goals/60",
      availabilityStatus: "available",
      higherIsBetter: true,
      description: "Goals per 60.",
      formulaDescription: "Goals divided by TOI.",
      applicableStrengthStates: ["5v5"],
      denominatorKey: "toi_seconds",
      denominatorDescription: "TOI seconds",
      sampleRequirements: {
        minimumGp: 1,
        minimumToiSeconds: 300,
        windowSource: "rolling_player_game_metrics",
      },
      methodologyVersion: "contextual_rankings_v1",
      methodologyUpdatedAt: "2026-06-08T12:00:00.000Z",
      sourceQualityFlags: [],
    },
    unavailable: false,
    rowCount: 1,
    limit: 100,
    message: null,
  },
};

const metadataPayload = {
  success: true,
  generatedAt: "2026-06-13T12:00:00.000Z",
  filters: {},
  metrics: [],
  glossary: [
    {
      key: "better_than_percentile",
      label: "Better-than percentile",
      description:
        "The share of qualified peers with a lower normalized value after directionality is applied.",
    },
    {
      key: "source_quality_flags",
      label: "Source caveats",
      description:
        "Metric-specific flags for source limitations such as rink-scorekeeper sensitivity or denominator semantics.",
    },
  ],
  comparison: {},
  defensiveComposites: {},
  teamStyle: TEAM_STYLE_SOURCE_CONTRACT,
  war: null,
  entityCoverage: [],
};

const deploymentTiersPayload: DeploymentTiersResponse = {
  success: true,
  request: {
    entity: "skaters",
    season: 20252026,
    asOfDate: null,
    window: "season",
    position: "all",
    strength: "5v5",
    minGp: 1,
    minToiSeconds: 300,
    teamId: null,
    metricKeys: ["points_per_60", "goals_per_60"],
  },
  sections: [
    {
      key: "ev_forwards",
      label: "EV Forward Lines",
      description: "L1-L4 buckets from verified line-combination context.",
      strength: "5v5",
      sourceState: "available",
      buckets: [
        {
          key: "L1",
          label: "L1",
          playerCount: 12,
          averagePercentile: 84.5,
          topMetricKey: "points_per_60",
          topMetricLabel: "Points/60",
          topPlayer: {
            id: 1,
            name: "Matt Savoie",
            team: "BUF",
            percentile: 92.2,
          },
          metricAverages: [
            {
              metricKey: "points_per_60",
              label: "Points/60",
              averagePercentile: 84.5,
              qualifiedCount: 12,
            },
            {
              metricKey: "goals_per_60",
              label: "Goals/60",
              averagePercentile: 80.1,
              qualifiedCount: 12,
            },
          ],
          sourceState: "available",
          message: null,
        },
      ],
    },
  ],
  meta: {
    generatedAt: "2026-06-08T12:00:00.000Z",
    snapshotDates: ["2026-04-16"],
    latestAvailableSnapshotDate: "2026-04-16",
    sourceTable: "rolling_player_game_metrics",
    metricKeys: ["points_per_60", "goals_per_60"],
    message: null,
  },
};

const trendingPayload: TrendingResponse = {
  success: true,
  request: {
    entity: "skaters",
    season: 20252026,
    asOfDate: null,
    position: "all",
    deployment: "all",
    strength: "5v5",
    minGp: 1,
    minToiSeconds: 300,
    teamId: null,
    peerGroupType: "all_skaters",
    metricKeys: ["points_per_60", "goals_per_60"],
    sortDirection: "desc",
    limit: 25,
  },
  rows: [
    {
      entity: rankingRow.entity,
      team: rankingRow.team,
      deployment: rankingRow.deployment,
      sample: rankingRow.sample,
      trendScore: 18.4,
      primaryMetricKey: "points_per_60",
      primaryDeltaLast5VsLast20: 22.1,
      toiTrend: {
        seasonSeconds: 700,
        last20Seconds: 710,
        last10Seconds: 730,
        last5Seconds: 760,
        deltaLast5VsLast20Seconds: 50,
      },
      metrics: [
        {
          metricKey: "points_per_60",
          label: "Points/60",
          shortLabel: "Points/60",
          season: {
            value: 2.1,
            formattedValue: "2.10",
            percentile: 70,
            rank: 10,
          },
          last20: {
            value: 2.3,
            formattedValue: "2.30",
            percentile: 72,
            rank: 9,
          },
          last10: {
            value: 2.9,
            formattedValue: "2.90",
            percentile: 84,
            rank: 5,
          },
          last5: {
            value: 3.2,
            formattedValue: "3.20",
            percentile: 94.1,
            rank: 2,
          },
          deltaLast5VsLast20: 22.1,
          deltaLast5VsSeason: 24.1,
        },
        {
          metricKey: "goals_per_60",
          label: "Goals/60",
          shortLabel: "Goals/60",
          season: null,
          last20: {
            value: 0.5,
            formattedValue: "0.50",
            percentile: 50,
            rank: 8,
          },
          last10: null,
          last5: {
            value: 1.1,
            formattedValue: "1.10",
            percentile: 68,
            rank: 4,
          },
          deltaLast5VsLast20: 18,
          deltaLast5VsSeason: null,
        },
      ],
      opportunitySignals: [
        {
          type: "toi_up",
          label: "TOI Up",
          severity: "medium",
          sourceState: "available",
          baselineWindow: "last20",
          currentWindow: "last5",
          baselineValue: 710,
          currentValue: 760,
          delta: 50,
          evidence: "TOI/G up +50s from last 20 to last 5.",
        },
      ],
      sourceState: "available",
      message: null,
    },
  ],
  meta: {
    generatedAt: "2026-06-08T12:00:00.000Z",
    rowCount: 1,
    sourceTable: "rolling_player_game_metrics",
    metricKeys: ["points_per_60", "goals_per_60"],
    windows: ["season", "last20", "last10", "last5"],
    opportunitySignalContracts: [
      {
        type: "toi_up",
        label: "TOI Up",
        sourceState: "available",
        requiredInputs: ["last5 toi per game", "last20 toi per game"],
        description: "Flags players whose selected-window TOI/G is materially up.",
      },
      {
        type: "pp1_promotion",
        label: "PP1 Promotion",
        sourceState: "source_pending",
        requiredInputs: ["current PP unit", "prior PP unit", "PP TOI share by game"],
        description: "Requires deployment history rather than only current PP bucket.",
      },
    ],
    snapshotDates: {
      season: "2026-04-16",
      last20: "2026-04-16",
      last10: "2026-04-16",
      last5: "2026-04-16",
    },
    latestAvailableSnapshotDate: "2026-04-16",
    message: null,
  },
};

const splitsPayload: RankingsSplitsResponse = {
  success: true,
  request: {
    entity: "skaters",
    season: 20252026,
    asOfDate: null,
    window: "season",
    position: "all",
    deployment: "all",
    strength: "5v5",
    metric: "goals_per_60",
    minGp: 1,
    minToiSeconds: 300,
    teamId: null,
    peerGroupType: "all_skaters",
    limit: 25,
  },
  rows: [
    {
      entity: rankingRow.entity,
      team: rankingRow.team,
      deployment: rankingRow.deployment,
      sample: rankingRow.sample,
      base: {
        value: 1.1,
        formattedValue: "1.10",
        percentile: 92.2,
        rank: 2,
        qualifiedPeerCount: 18,
      },
      splits: {
        "strength:pp": {
          value: 1.4,
          formattedValue: "1.40",
          percentile: 95.5,
          rank: 1,
          qualifiedPeerCount: 15,
        },
        "window:last5": {
          value: 1.8,
          formattedValue: "1.80",
          percentile: 97.1,
          rank: 1,
          qualifiedPeerCount: 18,
        },
      },
    },
  ],
  sections: [
    {
      key: "strength",
      label: "Strength Splits",
      description: "Selected players compared across verified strength contexts.",
      sourceState: "available",
      comparisons: [
        {
          key: "strength:pp",
          label: "PP",
          context: {
            strength: "pp",
            window: "season",
            deployment: "all",
          },
          sourceState: "available",
          snapshotDate: "2026-04-16",
          rowCount: 1,
          message: null,
        },
      ],
    },
    {
      key: "window",
      label: "Window Splits",
      description: "Selected players compared across verified rolling windows.",
      sourceState: "available",
      comparisons: [
        {
          key: "window:last5",
          label: "Last 5",
          context: {
            strength: "5v5",
            window: "last5",
            deployment: "all",
          },
          sourceState: "available",
          snapshotDate: "2026-04-16",
          rowCount: 1,
          message: null,
        },
      ],
    },
  ],
  meta: {
    generatedAt: "2026-06-08T12:00:00.000Z",
    rowCount: 1,
    sourceTable: "rolling_player_game_metrics",
    metric: { key: "goals_per_60", displayName: "Goals/60" },
    baseSnapshotDate: "2026-04-16",
    latestAvailableSnapshotDate: "2026-04-16",
    unsupportedSplits: [
      {
        key: "home_away",
        reason: "Home/away is not exposed by the verified rolling rankings surface.",
      },
    ],
    message: null,
  },
};

const warPayload: WarSurfaceResponse = {
  success: true,
  request: {
    entity: "skaters",
    season: 20252026,
    window: "season",
    strength: "5v5",
    position: "all",
    deployment: "all",
  },
  status: "source_pending",
  methodology: {
    key: "wins_above_replacement",
    label: "Wins Above Replacement",
    version: null,
    updatedAt: null,
    sourceStatus: "source_pending",
    replacementBaseline: null,
    formula: null,
    denominator: "wins",
    direction: "higher_is_better",
  },
  summary:
    "WAR remains unavailable until a defensible replacement-level model is documented, validated, and populated.",
  sourcePendingReason:
    "The current rankings snapshots publish descriptive rates, percentiles, deployment context, and composites, but they do not define replacement baselines, position adjustments, or win-value conversion.",
  sourceTables: [
    "rolling_player_game_metrics",
    "skater_composite_ratings",
    "goalie_stats_unified",
    "team_power_ratings_daily",
  ],
  prerequisites: [
    {
      key: "replacement_baseline",
      label: "Replacement Baseline",
      status: "missing",
      detail: "No approved replacement baseline is published.",
    },
    {
      key: "win_value_conversion",
      label: "Win Conversion",
      status: "needs_validation",
      detail: "Existing percentile composites are not a win-value model.",
    },
  ],
  caveats: [
    "No WAR values are exposed in API or UI.",
    "Current matrix metrics are not a WAR substitute.",
  ],
  rows: [],
  meta: {
    generatedAt: "2026-06-13T12:00:00.000Z",
    sourceStatus: "source_pending",
    rowCount: 0,
    message: "Wins Above Replacement is Source Pending for this context.",
  },
};

function comparisonPayloadFor(
  entity: "skaters" | "goalies" | "teams",
): ContextualRankingComparisonResponse {
  if (entity === "goalies") {
    return {
      success: true,
      version: "contextual_ranking_comparison_v1",
      status: "available",
      request: {
        entity: "goalies",
        season: 20252026,
        window: "season",
        metric: "save_percentage",
        subjectCount: 2,
      },
      source: {
        endpoint: "/api/v1/contextual-rankings/goalies",
        sourceTables: goaliePayload.meta.sourceTables,
        snapshotDate: goaliePayload.meta.snapshotDate,
        latestAvailableSnapshotDate: goaliePayload.meta.latestAvailableSnapshotDate,
        generatedAt: goaliePayload.meta.generatedAt,
      },
      metricColumns: goaliePayload.meta.metricColumns.map((column) => ({
        metricKey: column.metricKey,
        label: column.label,
        lowerIsBetter: column.lowerIsBetter,
        source: column.source,
      })),
      subjects: goaliePayload.rows.slice(0, 2).map((row) => ({
        key: String(row.entity.id),
        label: row.entity.name ?? `Goalie ${row.entity.id}`,
        status: "available",
        row,
        reason: null,
        caveats: row.warnings,
      })),
      caveats: [],
    };
  }

  if (entity === "teams") {
    return {
      success: true,
      version: "contextual_ranking_comparison_v1",
      status: "available",
      request: {
        entity: "teams",
        season: 20252026,
        window: null,
        metric: "off_rating",
        subjectCount: 2,
      },
      source: {
        endpoint: "/api/v1/contextual-rankings/teams",
        sourceTables: teamPayload.meta.sourceTables,
        snapshotDate: teamPayload.meta.snapshotDate,
        latestAvailableSnapshotDate: teamPayload.meta.latestAvailableSnapshotDate,
        generatedAt: teamPayload.meta.generatedAt,
      },
      metricColumns: teamPayload.meta.metricColumns.map((column) => ({
        metricKey: column.metricKey,
        label: column.label,
        lowerIsBetter: column.lowerIsBetter,
        source: column.source,
      })),
      subjects: teamPayload.rows.slice(0, 2).map((row) => ({
        key: row.team.abbreviation,
        label: row.team.name ?? row.team.abbreviation,
        status: "available",
        row,
        reason: null,
        caveats: row.warnings,
      })),
      caveats: ["Score/venue-adjusted team style remains Source Pending."],
    };
  }

  return {
    success: true,
    version: "contextual_ranking_comparison_v1",
    status: "available",
    request: {
      entity: "skaters",
      season: 20252026,
      window: "season",
      metric: "points_per_60",
      subjectCount: 1,
    },
    source: {
      endpoint: "/api/v1/contextual-rankings/matrix",
      sourceTables: matrixPayload.meta.sourceTables ?? [matrixPayload.meta.sourceTable],
      snapshotDate: matrixPayload.meta.snapshotDate,
      latestAvailableSnapshotDate: matrixPayload.meta.latestAvailableSnapshotDate,
      generatedAt: matrixPayload.meta.generatedAt,
    },
    metricColumns: matrixPayload.meta.metricColumns.map((column) => ({
      metricKey: column.metricKey,
      label: column.shortLabel,
      lowerIsBetter: column.lowerIsBetter,
      source: column.denominatorDescription ?? "matrix metric",
    })),
    subjects: matrixPayload.rows.map((row) => ({
      key: String(row.entity.id),
      label: row.entity.name ?? `Skater ${row.entity.id}`,
      status: "available",
      row,
      reason: null,
      caveats: row.warnings,
    })),
    caveats: [],
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
    minStarts: 3,
    minShots: 100,
    team: null,
    search: null,
    page: 1,
    pageSize: 10,
  },
  rows: [
    {
      entity: {
        id: 31,
        name: "Trent Miner",
        position: "G",
        imageUrl: null,
      },
      team: {
        id: 21,
        abbreviation: "COL",
        name: "Colorado Avalanche",
      },
      sample: {
        gamesPlayed: 4,
        gamesStarted: 3,
        shotsAgainst: 104,
        toiSeconds: 14219,
        minimumSampleMet: true,
        confidence: "medium",
      },
      role: {
        deploymentBucket: "g2_reserve",
        deploymentLabel: "G2 Reserve",
        deploymentSource: "goalie_start_projections.season_start_pct",
        rawStartShare: 0.3,
        adjustedStartShare: 0.3,
        coreStartShare: null,
        coreGoalieIds: [32, 31],
        excludedTeamStarts: 3,
        roleConfidence: "medium",
        roleNotes: [
          "Raw window share uses 3 starts out of 10 team starts.",
          "Goalie is outside the inferred top-two workload group; adjusted core share is not used for role promotion.",
          "Projected season start share is available and remains the primary role source.",
        ],
        windowStartShare: 0.3,
        startShareLast10: 0.3,
        seasonStartShare: 0.032,
        startProbability: 0.1,
        projectedGsaaPer60: 0.2,
        confirmedStatus: false,
      },
      sort: {
        metricKey: "save_percentage",
        rank: 1,
        percentile: 98.7,
      },
      metrics: {
        save_percentage: {
          metricKey: "save_percentage",
          rawValue: 0.933,
          formattedValue: "93.3%",
          rank: 1,
          percentile: 98.7,
          qualifiedPeerCount: 60,
          lowerIsBetter: false,
        },
        relative_save_percentage: {
          metricKey: "relative_save_percentage",
          rawValue: 0.018,
          formattedValue: "1.8%",
          rank: 12,
          percentile: 80,
          qualifiedPeerCount: 60,
          lowerIsBetter: false,
        },
        gsax: {
          metricKey: "gsax",
          rawValue: 2.3,
          formattedValue: "2.3",
          rank: 40,
          percentile: 49,
          qualifiedPeerCount: 60,
          lowerIsBetter: false,
        },
        gsaa_per_60: {
          metricKey: "gsaa_per_60",
          rawValue: 58.15,
          formattedValue: "58.15",
          rank: 1,
          percentile: 98.7,
          qualifiedPeerCount: 60,
          lowerIsBetter: false,
        },
        xga_per_shot_against: {
          metricKey: "xga_per_shot_against",
          rawValue: 0.096,
          formattedValue: "0.096",
          rank: 18,
          percentile: 72,
          qualifiedPeerCount: 60,
          lowerIsBetter: false,
        },
        goalie_value_signal: {
          metricKey: "goalie_value_signal",
          rawValue: 1.3,
          formattedValue: "1.3",
          rank: 14,
          percentile: 78,
          qualifiedPeerCount: 60,
          lowerIsBetter: false,
        },
        high_danger_save_percentage: {
          metricKey: "high_danger_save_percentage",
          rawValue: 0.842,
          formattedValue: "84.2%",
          rank: 11,
          percentile: 82,
          qualifiedPeerCount: 60,
          lowerIsBetter: false,
        },
        quality_start_pct: {
          metricKey: "quality_start_pct",
          rawValue: 0.667,
          formattedValue: "66.7%",
          rank: 6,
          percentile: 92,
          qualifiedPeerCount: 60,
          lowerIsBetter: false,
        },
        really_bad_start_rate: {
          metricKey: "really_bad_start_rate",
          rawValue: 0.083,
          formattedValue: "8.3%",
          rank: 5,
          percentile: 94,
          qualifiedPeerCount: 60,
          lowerIsBetter: true,
        },
        steal_rate: {
          metricKey: "steal_rate",
          rawValue: 0.333,
          formattedValue: "33.3%",
          rank: 3,
          percentile: 96,
          qualifiedPeerCount: 60,
          lowerIsBetter: false,
        },
        start_share: {
          metricKey: "start_share",
          rawValue: 0.032,
          formattedValue: "3.2%",
          rank: 48,
          percentile: 0,
          qualifiedPeerCount: 60,
          lowerIsBetter: false,
        },
      },
      warnings: [],
    },
  ],
  meta: {
    generatedAt: "2026-06-09T12:00:00.000Z",
    rowCount: 1,
    totalRankedRows: 98,
    page: 1,
    pageSize: 10,
    pageCount: 10,
    snapshotDate: "2026-06-06",
    latestAvailableSnapshotDate: "2026-06-06",
    sourceTables: [
      "goalie_stats_unified",
      "wgo_goalie_stats",
      "nst_gamelog_goalie_*",
      "goalie_start_projections",
    ],
    metricColumns: [
      {
        metricKey: "save_percentage",
        label: "SV%",
        description: "Window save percentage.",
        lowerIsBetter: false,
        source: "goalie_stats_unified",
      },
      {
        metricKey: "relative_save_percentage",
        label: "Rel SV%",
        description: "Relative save percentage.",
        lowerIsBetter: false,
        source: "goalie_stats_unified same-team baseline",
      },
      {
        metricKey: "steal_rate",
        label: "Steal Rate",
        description: "Steal rate.",
        lowerIsBetter: false,
        source: "goalieMethodology",
      },
      {
        metricKey: "xga_per_shot_against",
        label: "xGA/Shot",
        description: "Shot-quality workload.",
        lowerIsBetter: false,
        source:
          "goalie_stats_unified.nst_5v5_counts_xg_against / nst_5v5_counts_shots_against",
      },
      {
        metricKey: "high_danger_save_percentage",
        label: "HD SV%",
        description: "High-danger save percentage.",
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

goaliePayload.rows.push({
  ...goaliePayload.rows[0]!,
  entity: {
    id: 32,
    name: "Casey DeSmith",
    position: "G",
    imageUrl: null,
  },
  team: {
    id: 9,
    abbreviation: "DAL",
    name: "Dallas Stars",
  },
  sample: {
    gamesPlayed: 8,
    gamesStarted: 7,
    shotsAgainst: 221,
    toiSeconds: 24540,
    minimumSampleMet: true,
    confidence: "high",
  },
  role: {
    deploymentBucket: "g2_backup",
    deploymentLabel: "G2 Backup",
    deploymentSource: "goalie_start_projections.season_start_pct",
    rawStartShare: 0.7,
    adjustedStartShare: 0.7,
    coreStartShare: 0.7,
    coreGoalieIds: [32, 31],
    excludedTeamStarts: 3,
    roleConfidence: "high",
    roleNotes: [
      "Raw window share uses 7 starts out of 10 team starts.",
      "Adjusted core share uses inferred top-two goalie starts only (10 starts).",
      "Projected season start share is available and remains the primary role source.",
    ],
    windowStartShare: 0.7,
    startShareLast10: 0.7,
    seasonStartShare: 0.22,
    startProbability: 0.62,
    projectedGsaaPer60: 0.4,
    confirmedStatus: true,
  },
  sort: {
    metricKey: "save_percentage",
    rank: 2,
    percentile: 93.1,
  },
  metrics: {
    ...goaliePayload.rows[0]!.metrics,
    save_percentage: {
      ...goaliePayload.rows[0]!.metrics.save_percentage,
      rawValue: 0.921,
      formattedValue: "92.1%",
      rank: 2,
      percentile: 93.1,
    },
    steal_rate: {
      ...goaliePayload.rows[0]!.metrics.steal_rate,
      rawValue: 0.2,
      formattedValue: "20.0%",
      rank: 8,
      percentile: 84,
    },
    start_share: {
      ...goaliePayload.rows[0]!.metrics.start_share,
      rawValue: 0.22,
      formattedValue: "22.0%",
      rank: 20,
      percentile: 60,
    },
  },
});

const teamUnitCoverage: TeamMatrixResponse["rows"][number]["unitUsage"]["coverage"] = {
  forwardTopLoad: {
    games: 78,
    latestDate: "2026-04-16",
    snapshotDate: "2026-06-22",
    status: "complete",
    warnings: [],
  },
  defensePairTopLoad: {
    games: 78,
    latestDate: "2026-04-16",
    snapshotDate: "2026-06-22",
    status: "complete",
    warnings: [],
  },
  pp1Pp2UsageShare: {
    games: 78,
    latestDate: "2026-04-16",
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
    reason: "78 complete resolved games support this unit-usage label.",
  },
  defensePairTopLoad: {
    label: "Defense pair top load coverage-qualified",
    coverageQualified: true,
    minimumGames: 3,
    reason: "78 complete resolved games support this unit-usage label.",
  },
  pp1Pp2UsageShare: {
    label: "PP1/PP2 usage share coverage-qualified",
    coverageQualified: true,
    minimumGames: 3,
    reason: "78 complete resolved games support this unit-usage label.",
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
        id: 12,
        abbreviation: "CAR",
        name: "Carolina Hurricanes",
      },
      record: {
        latestPowerDate: "2026-06-09",
        styleSnapshotDate: "2026-04-07",
        styleGames: 78,
        ppTier: 1,
        pkTier: 2,
        trend10: 3.8,
      },
      style: {
        label: "Controls play",
        descriptorType: "raw_contextual",
        displayLabel: "Controls play (raw/contextual)",
        adjustedTargetLabel: "Score- and venue-adjusted 5v5 team style",
        adjustedStatus: "source_pending",
        interpretation:
          "Environment descriptor from current raw/contextual 5v5 inputs; not a coach/system claim.",
        paceAxis: "balanced_event",
        controlAxis: "controls_play",
        xgForPercentage: 58.6,
        eventRate: 7.89,
        shotQuality: 0.114,
        source: "team_underlying_stats_summary",
        adjusted: false,
      },
      luck: {
        finishingLuck: -188.68,
        saveLuck: 97.44,
        netGoalsAboveExpected: -91.24,
      },
      context: {
        games: 82,
        latestDate: "2026-06-06",
        oneGoalGameRate: 43.9,
        homeRoadPointPctGap: 8.5,
        powerPlayOpportunityRate: 3.12,
        penaltiesTakenPer60: 3.84,
      },
      unitUsage: {
        games: 78,
        latestDate: "2026-04-16",
        snapshotDate: "2026-06-22",
        forwardTopLoadIndex: 54.2,
        defensePairTopLoadIndex: 47.8,
        pp1Pp2UsageShare: 88.4,
        coverage: teamUnitCoverage,
        labels: teamUnitLabels,
      },
      sort: {
        metricKey: "off_rating",
        rank: 1,
        percentile: 96.875,
      },
      metrics: {
        off_rating: {
          rawValue: 133.7,
          formattedValue: "133.7",
          rank: 1,
          percentile: 96.875,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        def_rating: {
          rawValue: 125.6,
          formattedValue: "125.6",
          rank: 2,
          percentile: 94,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        xgf60: {
          rawValue: 4.01,
          formattedValue: "4.01",
          rank: 1,
          percentile: 96.875,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        xga60: {
          rawValue: 2.74,
          formattedValue: "2.74",
          rank: 3,
          percentile: 91,
          qualifiedPeerCount: 32,
          lowerIsBetter: true,
        },
        xgf_percentage: {
          rawValue: 58.6,
          formattedValue: "58.6%",
          rank: 1,
          percentile: 96.875,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        shot_quality: {
          rawValue: 0.114,
          formattedValue: "0.114",
          rank: 17,
          percentile: 47,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        event_rate: {
          rawValue: 7.89,
          formattedValue: "7.89",
          rank: 9,
          percentile: 72,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        finishing_luck: {
          rawValue: -188.68,
          formattedValue: "-188.68",
          rank: 32,
          percentile: 0,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        save_luck: {
          rawValue: 97.44,
          formattedValue: "97.44",
          rank: 31,
          percentile: 3,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        net_luck: {
          rawValue: -91.24,
          formattedValue: "-91.24",
          rank: 32,
          percentile: 0,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        pace_rating: {
          rawValue: 108.2,
          formattedValue: "108.2",
          rank: 9,
          percentile: 72,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        special_rating: {
          rawValue: 102.3,
          formattedValue: "102.3",
          rank: 6,
          percentile: 81,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        one_goal_game_rate: {
          rawValue: 43.9,
          formattedValue: "43.9%",
          rank: 18,
          percentile: 44,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        home_road_point_pct_gap: {
          rawValue: 8.5,
          formattedValue: "8.50",
          rank: 10,
          percentile: 69,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        pp_opportunity_rate: {
          rawValue: 3.12,
          formattedValue: "3.12",
          rank: 9,
          percentile: 72,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
        penalties_taken_per_60: {
          rawValue: 3.84,
          formattedValue: "3.84",
          rank: 7,
          percentile: 78,
          qualifiedPeerCount: 32,
          lowerIsBetter: true,
        },
        forward_top_load_index: {
          rawValue: 54.2,
          formattedValue: "54.2%",
          rank: 12,
          percentile: 65,
          qualifiedPeerCount: 31,
          lowerIsBetter: false,
        },
        defense_pair_top_load_index: {
          rawValue: 47.8,
          formattedValue: "47.8%",
          rank: 15,
          percentile: 53,
          qualifiedPeerCount: 31,
          lowerIsBetter: false,
        },
        pp1_pp2_usage_share: {
          rawValue: 88.4,
          formattedValue: "88.4%",
          rank: 5,
          percentile: 84,
          qualifiedPeerCount: 32,
          lowerIsBetter: false,
        },
      },
      warnings: ["raw_contextual_team_style"],
    },
  ],
  meta: {
    generatedAt: "2026-06-09T12:00:00.000Z",
    rowCount: 1,
    totalRankedRows: 32,
    page: 1,
    pageSize: 10,
    pageCount: 4,
    snapshotDate: "2026-06-09",
    latestAvailableSnapshotDate: "2026-06-09",
    styleSnapshotDate: "2026-04-07",
    sourceTables: [
      "team_power_ratings_daily",
      "team_underlying_stats_summary",
      "nst_team_stats",
      "wgo_team_stats",
      "games",
      "team_unit_toi",
    ],
    sourceWarnings: [
      "team style source snapshot 2026-04-07 differs from team power snapshot 2026-06-09",
      "team style is raw/contextual, not score- or venue-adjusted",
      "team unit-usage metrics use pooled player-seconds",
    ],
    teamStyleContract: TEAM_STYLE_SOURCE_CONTRACT,
    sourcePendingMetricContracts: TEAM_ADJUSTED_STYLE_SOURCE_CONTRACTS,
    metricColumns: [
      {
        metricKey: "off_rating",
        label: "Off Rating",
        description: "Offense rating.",
        lowerIsBetter: false,
        source: "team_power_ratings_daily.off_rating",
      },
      {
        metricKey: "net_luck",
        label: "Net Luck",
        description: "Net luck.",
        lowerIsBetter: false,
        source: "teamStyleMethodology",
      },
      {
        metricKey: "one_goal_game_rate",
        label: "1-Goal%",
        description: "One-goal game rate.",
        lowerIsBetter: false,
        source: "wgo_team_stats + games",
      },
      {
        metricKey: "home_road_point_pct_gap",
        label: "Home Edge",
        description: "Home-road point-percentage gap.",
        lowerIsBetter: false,
        source: "wgo_team_stats",
      },
      {
        metricKey: "forward_top_load_index",
        label: "Fwd Top Load",
        description: "Forward top load.",
        lowerIsBetter: false,
        source: "team_unit_toi",
      },
      {
        metricKey: "defense_pair_top_load_index",
        label: "Pair Top Load",
        description: "Defense pair top load.",
        lowerIsBetter: false,
        source: "team_unit_toi",
      },
      {
        metricKey: "pp1_pp2_usage_share",
        label: "PP1/PP2 Share",
        description: "PP1/PP2 usage share.",
        lowerIsBetter: false,
        source: "team_unit_toi",
      },
    ],
  },
};

teamPayload.rows.push({
  ...teamPayload.rows[0]!,
  team: {
    id: 9,
    abbreviation: "DAL",
    name: "Dallas Stars",
  },
  record: {
    latestPowerDate: "2026-06-09",
    styleSnapshotDate: "2026-04-07",
    styleGames: 78,
    ppTier: 2,
    pkTier: 1,
    trend10: 1.4,
  },
  style: {
    label: "Balanced pressure",
    descriptorType: "raw_contextual",
    displayLabel: "Balanced pressure (raw/contextual)",
    adjustedTargetLabel: "Score- and venue-adjusted 5v5 team style",
    adjustedStatus: "source_pending",
    interpretation:
      "Environment descriptor from current raw/contextual 5v5 inputs; not a coach/system claim.",
    paceAxis: "balanced_event",
    controlAxis: "balanced_control",
    xgForPercentage: 51.2,
    eventRate: 6.88,
    shotQuality: 0.101,
    source: "team_underlying_stats_summary",
    adjusted: false,
  },
  luck: {
    finishingLuck: 12.3,
    saveLuck: 4.1,
    netGoalsAboveExpected: 16.4,
  },
  sort: {
    metricKey: "off_rating",
    rank: 2,
    percentile: 93.75,
  },
  metrics: {
    ...teamPayload.rows[0]!.metrics,
    off_rating: {
      ...teamPayload.rows[0]!.metrics.off_rating,
      rawValue: 126.4,
      formattedValue: "126.4",
      rank: 2,
      percentile: 93.75,
    },
    net_luck: {
      ...teamPayload.rows[0]!.metrics.net_luck,
      rawValue: 16.4,
      formattedValue: "16.40",
      rank: 5,
      percentile: 84,
    },
  },
  warnings: ["raw_contextual_team_style"],
});

function setupSWR() {
  swrMock.mockImplementation((key: string | null) => {
    if (key == null) {
      return { data: undefined, error: null, isLoading: false };
    }
    if (key.startsWith("/api/v1/contextual-rankings/matrix")) {
      return { data: matrixPayload, error: null, isLoading: false };
    }
    if (key.startsWith("/api/v1/contextual-rankings/goalies")) {
      return { data: goaliePayload, error: null, isLoading: false };
    }
    if (key.startsWith("/api/v1/contextual-rankings/teams")) {
      return { data: teamPayload, error: null, isLoading: false };
    }
    if (key.startsWith("/api/v1/contextual-rankings/deployment-tiers")) {
      return { data: deploymentTiersPayload, error: null, isLoading: false };
    }
    if (key.startsWith("/api/v1/contextual-rankings/trending")) {
      return { data: trendingPayload, error: null, isLoading: false };
    }
    if (key.startsWith("/api/v1/contextual-rankings/splits")) {
      return { data: splitsPayload, error: null, isLoading: false };
    }
    if (key.startsWith("/api/v1/contextual-rankings/war")) {
      return { data: warPayload, error: null, isLoading: false };
    }
    if (key.startsWith("/api/v1/contextual-rankings/comparison")) {
      const url = new URL(key, "https://fhfh.test");
      const entity =
        (url.searchParams.get("entity") as "skaters" | "goalies" | "teams" | null) ??
        "skaters";
      return {
        data: comparisonPayloadFor(entity),
        error: null,
        isLoading: false,
      };
    }
    if (key.startsWith("/api/v1/contextual-rankings/snapshot")) {
      const url = new URL(key, "https://fhfh.test");
      const entity = url.searchParams.get("entity");
      const selectedGoalie = url.searchParams.get("selected_goalie");
      const selectedTeam = url.searchParams.get("selected_team");
      const selectedPlayer = url.searchParams.get("selected_player");
      let row: unknown = null;

      if (entity === "goalies" && selectedGoalie === "32") {
        row = goaliePayload.rows[1];
      } else if (entity === "goalies" && selectedGoalie === "999") {
        row = {
          ...goaliePayload.rows[1]!,
          entity: {
            ...goaliePayload.rows[1]!.entity,
            id: 999,
            name: "Off Page Goalie",
          },
        };
      } else if (entity === "teams" && selectedTeam === "DAL") {
        row = teamPayload.rows[1];
      } else if (entity === "skaters" && selectedPlayer === "1") {
        row = matrixPayload.rows[0];
      }

      return {
        data: row
          ? {
              success: true,
              version: "contextual_ranking_snapshot_v1",
              status: "available",
              request: {
                entity,
                season: 20252026,
                window: entity === "teams" ? null : "season",
                selectedPlayerId: selectedPlayer ? Number(selectedPlayer) : null,
                selectedGoalieId: selectedGoalie ? Number(selectedGoalie) : null,
                selectedTeam,
              },
              row,
              source: {
                endpoint: "/api/v1/contextual-rankings/snapshot",
                sourceTables: [],
                snapshotDate: "2026-06-09",
                latestAvailableSnapshotDate: "2026-06-09",
                generatedAt: "2026-06-13T12:00:00.000Z",
              },
              caveats: [],
            }
          : undefined,
        error: null,
        isLoading: false,
      };
    }
    if (key.startsWith("/api/v1/contextual-rankings/metadata")) {
      return { data: metadataPayload, error: null, isLoading: false };
    }
    if (key.startsWith("/api/v1/contextual-rankings?")) {
      return { data: explorerPayload, error: null, isLoading: false };
    }
    return { data: undefined, error: null, isLoading: false };
  });
}

describe("RankingsPage interactions", () => {
  beforeEach(() => {
    routerState.query = {};
    replaceMock.mockReset();
    setupSWR();
  });

  afterEach(() => {
    cleanup();
  });

  it("wires matrix sorting, pagination, page size, and row selection into URL state", () => {
    render(<RankingsPage />);

    expect(screen.getByRole("heading", { name: "Skater Rankings" })).toBeTruthy();
    expect(document.title).toBe("Skater Rankings | FHFHockey");
    expect(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content"),
    ).toBe(
      "Contextual NHL skater rankings with deployment filters, percentiles, multi-metric matrices, and player snapshots.",
    );
    expect(
      within(screen.getByLabelText("Ranking quick info")).getByText(
        "Points/60 Percentile",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Rankings Matrix")).toBeTruthy();
    expect(screen.getAllByText("Matt Savoie").length).toBeGreaterThan(0);
    expect(screen.getByRole("complementary", { name: "Comparison context" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Comparison Context" })).toBeTruthy();
    expect(screen.getByText("TOI Up: TOI/G up +50s from last 20 to last 5.")).toBeTruthy();
    expect(swrMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/api\/v1\/contextual-rankings\/comparison\?.*player_ids=1/,
      ),
    );
    expect(screen.getByText("Legend & Methodology")).toBeTruthy();
    fireEvent.click(screen.getByText("Legend & Methodology"));
    expect(screen.getByRole("heading", { name: "Ranking Legend" })).toBeTruthy();
    expect(
      screen.getByText(
        "Percentile shows the share of other qualified peers this row is better than after metric directionality is applied.",
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Raw rank uses dense-rank semantics/)).toBeTruthy();
    expect(screen.getByText("Better-than percentile")).toBeTruthy();
    expect(
      screen.getByText("Durable snapshot: entity_metric_rankings"),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "Savoie" },
    });
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/rankings",
        query: expect.objectContaining({
          search: "Savoie",
          page: "1",
        }),
      }),
      undefined,
      { shallow: true },
    );

    fireEvent.change(screen.getByLabelText("Display"), {
      target: { value: "metric_value" },
    });
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/rankings",
        query: expect.objectContaining({
          display: "metric_value",
        }),
      }),
      undefined,
      { shallow: true },
    );

    fireEvent.click(screen.getByRole("button", { name: /P\/60/i }));
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/rankings",
        query: expect.objectContaining({
          sort_metric: "points_per_60",
          sort_direction: "asc",
          page: "1",
        }),
      }),
      undefined,
      { shallow: true },
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/rankings",
        query: expect.objectContaining({ page: "2" }),
      }),
      undefined,
      { shallow: true },
    );

    fireEvent.change(screen.getByLabelText("Rows"), {
      target: { value: "25" },
    });
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/rankings",
        query: expect.objectContaining({ page: "1", page_size: "25" }),
      }),
      undefined,
      { shallow: true },
    );

    fireEvent.click(
      within(screen.getByRole("row", { name: /Matt Savoie/i })).getByRole(
        "button",
        { name: "2" },
      ),
    );
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/rankings",
        query: expect.objectContaining({ selected_player: "1" }),
      }),
      undefined,
      { shallow: true },
    );
  });

  it("wires tab switching and Metric Explorer fallback sorting into URL state", () => {
    const { rerender } = render(<RankingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Metric Explorer" }));
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/rankings",
        query: expect.objectContaining({ tab: "metric_explorer", page: "1" }),
      }),
      undefined,
      { shallow: true },
    );

    routerState.query = { tab: "metric_explorer" };
    rerender(<RankingsPage />);

    expect(
      screen.getByRole("heading", { name: "Metric Explorer" }),
    ).toBeTruthy();
    expect(screen.getAllByText("Goals/60").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Legend & Methodology"));
    expect(
      screen.getByText("Durable snapshot: entity_metric_rankings"),
    ).toBeTruthy();
    expect(screen.queryByText(/Adjusted Defensive Impact/i)).toBeNull();
    expect(screen.queryByText(/Adjusted xG Impact/i)).toBeNull();
    expect(screen.getAllByText("Matt Savoie").length).toBeGreaterThan(0);
    expect(swrMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/v1\/contextual-rankings\?/),
    );

    fireEvent.click(screen.getByRole("button", { name: /Sort by GP/i }));
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/rankings",
        query: expect.objectContaining({
          tab: "metric_explorer",
          sort: "gp",
          direction: "desc",
          page: "1",
        }),
      }),
      undefined,
      { shallow: true },
    );
  });

  it("renders live deployment tier summaries and keeps unsupported analytics planned", () => {
    routerState.query = { tab: "deployment_tiers" };
    const { rerender } = render(<RankingsPage />);

    expect(screen.getByRole("region", { name: "Deployment Tiers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "EV Forward Lines" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "L1" })).toBeTruthy();
    expect(screen.getByText("Matt Savoie (BUF)")).toBeTruthy();
    expect(swrMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/v1\/contextual-rankings\/deployment-tiers\?/),
    );

    routerState.query = { tab: "trending" };
    rerender(<RankingsPage />);

    expect(screen.getByRole("region", { name: "Trending players" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Trending Players" })).toBeTruthy();
    expect(screen.getByText("+18.4")).toBeTruthy();
    expect(screen.getByText("+22.1 pct")).toBeTruthy();
    expect(screen.getByText("TOI Up")).toBeTruthy();
    expect(screen.getByText(/Opportunity contracts: PP1 Promotion/)).toBeTruthy();
    expect(swrMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/v1\/contextual-rankings\/trending\?/),
    );

    routerState.query = { tab: "splits" };
    rerender(<RankingsPage />);

    expect(screen.getByRole("region", { name: "Ranking splits" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Splits" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Strength Splits" })).toBeTruthy();
    expect(screen.getByText("Home/away is not exposed by the verified rolling rankings surface.")).toBeTruthy();
    expect(swrMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/v1\/contextual-rankings\/splits\?/),
    );

    routerState.query = { tab: "war" };
    rerender(<RankingsPage />);

    expect(
      screen.getByRole("region", { name: "Wins Above Replacement status" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "WAR remains unavailable until a defensible replacement-level model is documented, validated, and populated.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Replacement Baseline" })).toBeTruthy();
    expect(screen.getByText("No WAR values are exposed in API or UI.")).toBeTruthy();
    expect(swrMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/v1\/contextual-rankings\/war\?/),
    );
  });

  it("renders skater, goalie, team, and planned states from entity URL state", () => {
    const { rerender } = render(<RankingsPage />);

    expect(screen.getByRole("heading", { name: "Rankings Matrix" })).toBeTruthy();
    expect(screen.getAllByText("Matt Savoie").length).toBeGreaterThan(0);

    routerState.query = { entity: "goalies", tab: "rankings" };
    rerender(<RankingsPage />);

    expect(screen.getByRole("heading", { name: "Goalie Rankings" })).toBeTruthy();
    expect(document.title).toBe("Goalie Rankings | FHFHockey");
    expect(
      within(screen.getByLabelText("Ranking quick info")).getByText(
        "SV% Percentile",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Goalie Rankings Matrix" }),
    ).toBeTruthy();
    expect(screen.getAllByText("Trent Miner").length).toBeGreaterThan(0);
    expect(screen.getByText(/Goalie roles use latest projected season start share/)).toBeTruthy();
    expect(screen.getByLabelText("Goalie snapshot")).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Comparison context" })).toBeTruthy();
    expect(
      screen.getAllByText(
        "Opportunity-change signals are source-pending for this entity type.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Why He Stands Out" })).toBeTruthy();
    expect(screen.getByText(/Start share: 3.2%/)).toBeTruthy();
    expect(screen.getByText(/Role confidence: medium/)).toBeTruthy();
    expect(screen.getByText(/Raw window start share: 30.0%/)).toBeTruthy();
    expect(screen.getByText(/Adjusted core start share: 30.0%/)).toBeTruthy();
    expect(
      screen.getByText(
        "Goalie is outside the inferred top-two workload group; adjusted core share is not used for role promotion.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getAllByText("Casey DeSmith")[0]!);
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/rankings",
        query: expect.objectContaining({
          entity: "goalies",
          selected_goalie: "32",
        }),
      }),
      undefined,
      { shallow: true },
    );
    routerState.query = {
      entity: "goalies",
      tab: "rankings",
      selected_goalie: "32",
    };
    rerender(<RankingsPage />);
    expect(
      within(screen.getByLabelText("Goalie snapshot")).getByText("Casey DeSmith"),
    ).toBeTruthy();
    expect(screen.getByText(/Start share: 22.0%/)).toBeTruthy();
    expect(swrMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/v1\/contextual-rankings\/goalies\?/),
    );
    expect(swrMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/api\/v1\/contextual-rankings\/comparison\?.*goalie_ids=32%2C31/,
      ),
    );
    expect(swrMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/api\/v1\/contextual-rankings\/snapshot\?.*selected_goalie=32/,
      ),
    );

    routerState.query = {
      entity: "goalies",
      tab: "rankings",
      selected_goalie: "999",
    };
    rerender(<RankingsPage />);
    expect(
      within(screen.getByLabelText("Goalie snapshot")).getByText("Off Page Goalie"),
    ).toBeTruthy();

    routerState.query = { entity: "goalies", tab: "trending" };
    rerender(<RankingsPage />);

    expect(screen.getByRole("region", { name: "Trending status" })).toBeTruthy();
    expect(screen.getByText(/Trending is Source Pending for goalie rankings/)).toBeTruthy();
    expect(screen.getByText("No fake values are generated while the secondary-tab source contract is pending.")).toBeTruthy();

    swrMock.mockClear();
    routerState.query = { entity: "goalies", tab: "metric_explorer" };
    rerender(<RankingsPage />);

    expect(screen.getByRole("region", { name: "Metric Explorer status" })).toBeTruthy();
    expect(
      screen.getByText(/Metric Explorer is Source Pending for goalie rankings/),
    ).toBeTruthy();
    expect(
      swrMock.mock.calls.some(
        ([key]) =>
          typeof key === "string" &&
          /^\/api\/v1\/contextual-rankings\?/.test(key),
      ),
    ).toBe(false);

    routerState.query = { entity: "teams", tab: "rankings" };
    rerender(<RankingsPage />);

    expect(screen.getByRole("heading", { name: "Team Rankings" })).toBeTruthy();
    expect(document.title).toBe("Team Rankings | FHFHockey");
    expect(
      within(screen.getByLabelText("Ranking quick info")).getByText(
        "Off Rating Percentile",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Team Rankings Matrix" }),
    ).toBeTruthy();
    expect(screen.getAllByText("Carolina Hurricanes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Controls play (raw/contextual)").length).toBeGreaterThan(0);
    expect(screen.getByText(/Team style caveat:/)).toBeTruthy();
    expect(screen.getAllByText(/Source-pending team contracts:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not a coach\/system claim/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Team snapshot")).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Comparison context" })).toBeTruthy();
    expect(screen.getByText("Score/venue-adjusted team style remains Source Pending.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Why This Team Stands Out" })).toBeTruthy();
    expect(screen.getByText(/Game-context source: 2026-06-06/)).toBeTruthy();
    expect(screen.getByText(/One-goal game rate: 43.9%/)).toBeTruthy();
    expect(screen.getByText(/Home edge: 8.5 percentage points/)).toBeTruthy();
    expect(screen.getByText(/PP opportunities: 3.12 per game/)).toBeTruthy();
    expect(screen.getByText(/Penalties taken: 3.84 per 60/)).toBeTruthy();
    expect(screen.getByText(/Unit usage source: 2026-06-22/)).toBeTruthy();
    expect(screen.getByText(/Forward top load coverage-qualified:/)).toBeTruthy();
    expect(screen.getAllByText(/78 complete resolved games support this unit-usage label/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Defense pair top load coverage-qualified:/)).toBeTruthy();
    expect(screen.getByText(/PP1\/PP2 usage share coverage-qualified:/)).toBeTruthy();
    expect(
      screen.getByText("Score/venue-adjusted style remains Source Pending when unavailable."),
    ).toBeTruthy();
    fireEvent.click(screen.getAllByText("Dallas Stars")[0]!);
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/rankings",
        query: expect.objectContaining({
          entity: "teams",
          selected_team: "DAL",
        }),
      }),
      undefined,
      { shallow: true },
    );
    routerState.query = {
      entity: "teams",
      tab: "rankings",
      selected_team: "DAL",
    };
    rerender(<RankingsPage />);
    expect(
      within(screen.getByLabelText("Team snapshot")).getByText("Dallas Stars"),
    ).toBeTruthy();
    expect(
      within(screen.getByLabelText("Team snapshot")).getByText(
        "Balanced pressure (raw/contextual)",
      ),
    ).toBeTruthy();
    expect(swrMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/v1\/contextual-rankings\/teams\?/),
    );
    expect(swrMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/api\/v1\/contextual-rankings\/comparison\?.*teams=DAL%2CCAR/,
      ),
    );

    routerState.query = { tab: "war" };
    rerender(<RankingsPage />);

    expect(
      screen.getByText(
        "WAR remains unavailable until a defensible replacement-level model is documented, validated, and populated.",
      ),
    ).toBeTruthy();
  });

  it("restores live team unit metrics from URL state", () => {
    routerState.query = {
      entity: "teams",
      tab: "rankings",
      team_metric: "forward_top_load_index",
    };

    render(<RankingsPage />);

    expect(screen.getByRole("heading", { name: "Team Rankings" })).toBeTruthy();
    expect(
      within(screen.getByLabelText("Ranking quick info")).getByText(
        "Forward Top Load Percentile",
      ),
    ).toBeTruthy();
    expect(
      swrMock.mock.calls.some(
        ([key]) =>
          typeof key === "string" &&
          /^\/api\/v1\/contextual-rankings\/teams\?.*metric=forward_top_load_index/.test(
            key,
          ),
      ),
    ).toBe(true);
  });
});
