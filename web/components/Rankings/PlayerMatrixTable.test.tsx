import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlayerMatrixResponse } from "lib/rankings/playerMatrix";

import PlayerMatrixTable from "./PlayerMatrixTable";

// Score labels render the % sign in its own span (hidden in the compact heatmap).
const scoreText = (label: string) => (_content: string, element: Element | null) =>
  element?.tagName === "STRONG" && element.textContent === label;

afterEach(() => {
  cleanup();
});

const payload: PlayerMatrixResponse = {
  success: true,
  request: {
    entity: "skaters",
    season: 20252026,
    asOfDate: null,
    window: "last20",
    position: "F",
    deployment: "L2",
    strength: "5v5",
    minGp: 1,
    minToiSeconds: 300,
    teamId: null,
    search: null,
    peerGroupType: "deployment",
    sortMetric: "points_per_60",
    sortDirection: "desc",
    sampleConfidence: "all",
    page: 1,
    pageSize: 10,
    selectedPlayerId: 1,
    rankingSourcePreference: "fallback",
  },
  selectedPlayerId: 1,
  rows: [
    {
      entity: {
        id: 1,
        name: "Matt Savoie",
        position: "C",
        positionGroup: "forward",
        imageUrl: "https://example.test/matt-savoie.png",
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
        allStrengthsToiPerGameSeconds: 900,
        confidence: "high",
        minimumSampleMet: true,
      },
      peerGroup: {
        type: "deployment",
        key: "L2",
      },
      tags: ["L2", "PP1"],
      warnings: [],
      sort: {
        metricKey: "points_per_60",
        rank: 2,
        percentile: 92.2,
        rankScopes: {
          overall: {
            rank: 2,
            percentile: 92.2,
            qualifiedPeerCount: 18,
            peerGroupKey: "all_skaters",
          },
          deployment: {
            rank: 1,
            percentile: 98.5,
            qualifiedPeerCount: 6,
            peerGroupKey: "L2",
          },
        },
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
          rankScopes: {
            overall: {
              rank: 2,
              percentile: 92.2,
              qualifiedPeerCount: 18,
              peerGroupKey: "all_skaters",
            },
            deployment: {
              rank: 1,
              percentile: 98.5,
              qualifiedPeerCount: 6,
              peerGroupKey: "L2",
            },
          },
        },
        xga_per_60: {
          metricKey: "xga_per_60",
          shortLabel: "xGA/60",
          fullLabel: "xGA/60",
          groupKey: "defense_on_ice",
          rawValue: 1.7,
          formattedValue: "1.70",
          rank: 4,
          percentile: 84.1,
          qualifiedPeerCount: 18,
          lowerIsBetter: true,
          availabilityState: "available",
          availabilityReason: null,
          sampleConfidence: "high",
          sourceQualityFlags: ["context_influenced_unadjusted_on_ice"],
          denominatorKey: "toi_seconds",
          denominatorDescription: "TOI seconds",
          methodologyVersion: "contextual_rankings_v1",
          snapshotDate: "2026-04-16",
          warnings: [],
          rankScopes: {
            overall: {
              rank: 4,
              percentile: 84.1,
              qualifiedPeerCount: 18,
              peerGroupKey: "all_skaters",
            },
            deployment: {
              rank: 2,
              percentile: 88.4,
              qualifiedPeerCount: 6,
              peerGroupKey: "L2",
            },
          },
        },
      },
    },
  ],
  meta: {
    generatedAt: "2026-06-07T12:00:00.000Z",
    rowCount: 1,
    totalRankedRows: 18,
    page: 1,
    pageSize: 10,
    pageCount: 2,
    sortMetric: "points_per_60",
    sortDirection: "desc",
    metricGroups: [
      { key: "offense", label: "Offense", description: "Offense" },
      {
        key: "defense_on_ice",
        label: "Defense / On-Ice",
        description: "Defense",
      },
    ],
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
      {
        metricKey: "xga_per_60",
        groupKey: "defense_on_ice",
        shortLabel: "xGA/60",
        fullLabel: "xGA/60",
        tooltip: "Lower is better",
        defaultVisible: true,
        playerTypes: ["skater"],
        definition: undefined,
        availabilityState: "available",
        lowerIsBetter: true,
        sourceQualityFlags: ["context_influenced_unadjusted_on_ice"],
        denominatorKey: "toi_seconds",
        denominatorDescription: "TOI seconds",
        methodologyVersion: "contextual_rankings_v1",
      },
    ],
    plannedMetrics: [],
    unavailableMetrics: [],
    colorScaleBands: [{ label: "90-94", min: 90, max: 94.999, tone: "elite" }],
    activePeerGroupDescription: "L2 deployment",
    snapshotDate: "2026-04-16",
    latestAvailableSnapshotDate: "2026-04-16",
    snapshotUpdatedAt: "2026-04-16T06:00:00.000Z",
    snapshotSelectionReason: "latest_available",
    sourceTable: "rolling_player_game_metrics",
    message: null,
  },
};

describe("PlayerMatrixTable", () => {
  it("renders grouped headers, metric cells, selection, sorting, and legend", () => {
    const onSelectPlayer = vi.fn();
    const onSortMetric = vi.fn();

    const { rerender } = render(
      <PlayerMatrixTable
        payload={payload}
        isLoading={false}
        selectedPlayerId={1}
        onSelectPlayer={onSelectPlayer}
        onSortMetric={onSortMetric}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Offense")).toBeTruthy();
    expect(screen.getByText("Defense / On-Ice")).toBeTruthy();
    expect(screen.getByText("Rank")).toBeTruthy();
    expect(screen.getByText("Matt Savoie")).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Team" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Pos" })).toBeNull();
    expect(screen.getByText("11:40")).toBeTruthy();
    expect(screen.getByText("15:00")).toBeTruthy();
    expect(screen.queryByText("Val")).toBeNull();
    // Desktop and phone copies of the badge (CSS shows one at a time).
    expect(screen.getAllByLabelText("Deployment L2 / PP1")).toHaveLength(2);
    expect(screen.getByText(scoreText("92%"))).toBeTruthy();
    expect(screen.getByText(scoreText("84%"))).toBeTruthy();
    expect(screen.getAllByText("#2").length).toBeGreaterThan(0);
    expect(screen.getByText("#4")).toBeTruthy();
    expect(
      screen.getByLabelText(
        /Points\/60.*Value 3\.20.*Overall Rank 2.*Overall Percentile 92\.2%/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        /xGA\/60.*Value 1\.70.*Overall Rank 4.*Overall Percentile 84\.1%/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        /xGA\/60.*Caveats: On-ice result, not adjusted for teammates or opponents/,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Showing 1 of 18")).toBeTruthy();
    expect(
      screen.getByText("Percentile vs peers"),
    ).toBeTruthy();
    expect(screen.getByText("95-100")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /P\/60/i }));
    expect(onSortMetric).toHaveBeenCalledWith("points_per_60", "asc");

    const playerRow = screen.getByRole("row", { name: /Matt Savoie/i });
    const selectPlayer = within(playerRow).getByRole("button", {
      name: "Select Matt Savoie",
    });

    fireEvent.click(playerRow);
    expect(onSelectPlayer).not.toHaveBeenCalled();

    fireEvent.click(selectPlayer);
    expect(selectPlayer.getAttribute("aria-pressed")).toBe("true");
    expect(onSelectPlayer).toHaveBeenCalledWith(1);

    rerender(
      <PlayerMatrixTable
        payload={payload}
        isLoading={false}
        selectedPlayerId={1}
        onSelectPlayer={onSelectPlayer}
        onSortMetric={onSortMetric}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        rankMode="deployment"
      />,
    );
    expect(screen.getAllByText("#1").length).toBeGreaterThan(0);
    expect(screen.getByText(scoreText("99%"))).toBeTruthy();
    expect(
      screen.getByLabelText(
        /Points\/60.*Deployment Rank 1.*Deployment Percentile 98\.5%/,
      ),
    ).toBeTruthy();
  });

  it("renders loading and unavailable metric notices", () => {
    const { rerender } = render(
      <PlayerMatrixTable
        payload={null}
        isLoading
        selectedPlayerId={null}
        onSelectPlayer={vi.fn()}
        onSortMetric={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Loading matrix...")).toBeTruthy();

    rerender(
      <PlayerMatrixTable
        payload={{
          ...payload,
          rows: [],
          meta: {
            ...payload.meta,
            rowCount: 0,
            unavailableMetrics: [
              {
                metricKey: "xga_per_60",
                label: "xGA/60",
                reason: "Metric is not available for ALL strength.",
              },
            ],
            message: "No players matched the matrix filters.",
          },
        }}
        isLoading={false}
        selectedPlayerId={null}
        onSelectPlayer={vi.fn()}
        onSortMetric={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Some requested metrics are unavailable/i),
    ).toBeTruthy();
    expect(
      screen.getByText("No players matched the matrix filters."),
    ).toBeTruthy();
  });

  it("toggles metric cells to the novel score value display mode", () => {
    render(
      <PlayerMatrixTable
        payload={payload}
        isLoading={false}
        selectedPlayerId={1}
        onSelectPlayer={vi.fn()}
        onSortMetric={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        displayMode="metric_value"
      />,
    );

    expect(screen.queryByText(scoreText("92%"))).toBeNull();
    expect(screen.queryByText("#4")).toBeNull();
    expect(screen.getByRole("button", { name: "P/60 Val descending" })).toBeTruthy();
    expect(screen.getByText("xGA/60 Val")).toBeTruthy();
    expect(screen.getByText("3.20")).toBeTruthy();
    expect(screen.getByText("1.70")).toBeTruthy();
    expect(screen.getByLabelText("Points/60 value 3.20")).toBeTruthy();
  });

  it("renders planned, unavailable, low-sample, true-zero, and stale-source states", () => {
    const statePayload: PlayerMatrixResponse = {
      ...payload,
      rows: [
        {
          ...payload.rows[0],
          sample: {
            ...payload.rows[0].sample,
            confidence: "low",
            minimumSampleMet: false,
          },
          metrics: {
            points_per_60: {
              ...payload.rows[0].metrics.points_per_60,
              rawValue: 0,
              formattedValue: "0.00",
              percentile: 0,
              rank: 18,
              sampleConfidence: "low",
              warnings: ["small_peer_group"],
              snapshotDate: "2026-04-15",
              rankScopes: {
                overall: {
                  rank: 18,
                  percentile: 0,
                  qualifiedPeerCount: 18,
                  peerGroupKey: "all_skaters",
                },
                deployment: {
                  rank: 6,
                  percentile: 0,
                  qualifiedPeerCount: 6,
                  peerGroupKey: "L2",
                },
              },
            },
            xga_per_60: {
              ...payload.rows[0].metrics.xga_per_60,
              percentile: 84.1,
              sampleConfidence: "low",
              warnings: ["small_peer_group"],
            },
            goals_per_60: {
              ...payload.rows[0].metrics.points_per_60,
              metricKey: "goals_per_60",
              shortLabel: "G/60",
              fullLabel: "Goals/60",
              rawValue: 0,
              formattedValue: "0.00",
              rank: 18,
              percentile: 5,
              snapshotDate: "2026-04-16",
              rankScopes: {
                overall: {
                  rank: 18,
                  percentile: 5,
                  qualifiedPeerCount: 18,
                  peerGroupKey: "all_skaters",
                },
                deployment: {
                  rank: 6,
                  percentile: 5,
                  qualifiedPeerCount: 6,
                  peerGroupKey: "L2",
                },
              },
            },
            results_luck_index: {
              ...payload.rows[0].metrics.points_per_60,
              metricKey: "results_luck_index",
              shortLabel: "Luck",
              fullLabel: "Results Luck Index",
              rawValue: null,
              formattedValue: null,
              rank: null,
              percentile: null,
              qualifiedPeerCount: 0,
              availabilityState: "unavailable",
              availabilityReason:
                "No verified Results Luck value for this row.",
            },
            rel_5v5_gf_percentage: {
              ...payload.rows[0].metrics.points_per_60,
              metricKey: "rel_5v5_gf_percentage",
              shortLabel: "Rel GF%",
              fullLabel: "Relative 5v5 GF%",
              rawValue: null,
              formattedValue: null,
              rank: null,
              percentile: null,
              qualifiedPeerCount: 0,
              availabilityState: "unavailable",
              availabilityReason: "Metric row was not returned.",
            },
          },
        },
      ],
      meta: {
        ...payload.meta,
        latestAvailableSnapshotDate: "2026-04-16",
        metricGroups: [
          ...payload.meta.metricGroups,
          {
            key: "overall_context",
            label: "Overall / Context",
            description: "Overall",
          },
        ],
        metricColumns: [
          ...payload.meta.metricColumns,
          {
            metricKey: "goals_per_60",
            groupKey: "offense",
            shortLabel: "G/60",
            fullLabel: "Goals/60",
            tooltip: "Goals",
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
          {
            metricKey: "results_luck_index",
            groupKey: "overall_context",
            shortLabel: "Luck",
            fullLabel: "Results Luck Index",
            tooltip:
              "Results Luck live, sparse until all verified components are available.",
            defaultVisible: false,
            playerTypes: ["skater"],
            definition: undefined,
            availabilityState: "available",
            lowerIsBetter: false,
            sourceQualityFlags: [],
            denominatorKey: null,
            denominatorDescription: null,
            methodologyVersion: null,
          },
          {
            metricKey: "rel_5v5_gf_percentage",
            groupKey: "overall_context",
            shortLabel: "Rel GF%",
            fullLabel: "Relative 5v5 GF%",
            tooltip: "Unavailable",
            defaultVisible: false,
            playerTypes: ["skater"],
            definition: undefined,
            availabilityState: "unavailable",
            lowerIsBetter: false,
            sourceQualityFlags: [],
            denominatorKey: null,
            denominatorDescription: null,
            methodologyVersion: null,
          },
        ],
      },
    };

    render(
      <PlayerMatrixTable
        payload={statePayload}
        isLoading={false}
        selectedPlayerId={1}
        onSelectPlayer={vi.fn()}
        onSortMetric={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText(scoreText("0%"))).toBeTruthy();
    expect(screen.queryByText("Low sample")).toBeNull();
    expect(screen.queryByText("True zero")).toBeNull();
    expect(
      screen.getByLabelText(
        /Snapshot is older than latest available matrix snapshot/,
      ),
    ).toBeTruthy();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    expect(
      screen.getByLabelText(/xGA\/60.*Lower raw values are better/).className,
    ).toContain("scoreToneStrong");
  });

  it("hides composite columns that are unpublished on every row and says so in the footer", () => {
    const mcmColumn = {
      ...payload.meta.metricColumns[0],
      metricKey: "mcm_score",
      groupKey: "overall_context",
      shortLabel: "MCM",
      fullLabel: "MCM Score",
    } as PlayerMatrixResponse["meta"]["metricColumns"][number];
    const unpublishedPayload: PlayerMatrixResponse = {
      ...payload,
      rows: payload.rows.map((row) => ({
        ...row,
        metrics: {
          ...row.metrics,
          mcm_score: {
            ...row.metrics.points_per_60,
            metricKey: "mcm_score",
            shortLabel: "MCM",
            fullLabel: "MCM Score",
            rawValue: null,
            formattedValue: null,
            percentile: null,
            rank: null,
            availabilityState: "unavailable",
          },
        },
      })),
      meta: {
        ...payload.meta,
        metricColumns: [...payload.meta.metricColumns, mcmColumn],
      },
    };

    render(
      <PlayerMatrixTable
        payload={unpublishedPayload}
        isLoading={false}
        selectedPlayerId={1}
        onSelectPlayer={vi.fn()}
        onSortMetric={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /MCM/ })).toBeNull();
    expect(screen.getByText("MCM not published for 2025\u201326 yet")).toBeTruthy();
  });

  it("shows a muted dash, not N/A, for scored players without a BEAST tier", () => {
    const beastColumn = {
      ...payload.meta.metricColumns[0],
      metricKey: "beast_tier",
      groupKey: "overall_context",
      shortLabel: "BEAST",
      fullLabel: "BEAST Tier",
    } as PlayerMatrixResponse["meta"]["metricColumns"][number];
    const tierPayload: PlayerMatrixResponse = {
      ...payload,
      rows: payload.rows.map((row) => ({
        ...row,
        metrics: {
          ...row.metrics,
          beast_tier: {
            ...row.metrics.points_per_60,
            metricKey: "beast_tier",
            shortLabel: "BEAST",
            fullLabel: "BEAST Tier",
            rawValue: 76.01,
            formattedValue: null,
            percentile: 76.01,
            rank: null,
            availabilityState: "unavailable",
            availabilityReason: "Composite metric is not available for this player/context.",
          },
        },
      })),
      meta: {
        ...payload.meta,
        metricColumns: [...payload.meta.metricColumns, beastColumn],
      },
    };

    render(
      <PlayerMatrixTable
        payload={tierPayload}
        isLoading={false}
        selectedPlayerId={1}
        onSelectPlayer={vi.fn()}
        onSortMetric={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("BEAST Tier: no tier").textContent).toBe("–");
  });
});
