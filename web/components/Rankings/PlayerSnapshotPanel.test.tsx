import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PlayerMatrixResponse } from "lib/rankings/playerMatrix";

import PlayerSnapshotPanel from "./PlayerSnapshotPanel";

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
    deployment: "L1",
    strength: "5v5",
    minGp: 1,
    minToiSeconds: 300,
    teamId: null,
    peerGroupType: "deployment",
    sortMetric: "goals_per_60",
    sortDirection: "desc",
    sampleConfidence: "all",
    page: 1,
    pageSize: 10,
    selectedPlayerId: 1,
  },
  selectedPlayerId: 1,
  rows: [
    {
      entity: {
        id: 1,
        name: "Nikita Kucherov",
        position: "RW",
        positionGroup: "forward",
        imageUrl: "https://assets.nhle.com/mugs/nhl/20252026/TBL/8476453.png",
      },
      team: {
        id: 14,
        abbreviation: "TBL",
        name: "Tampa Bay Lightning",
      },
      deployment: {
        ev: "L1",
        pp: "PP1",
        pk: null,
        confidence: "high",
      },
      sample: {
        gamesPlayed: 20,
        toiSeconds: 24000,
        toiPerGameSeconds: 1200,
        confidence: "high",
        minimumSampleMet: true,
      },
      peerGroup: {
        type: "deployment",
        key: "L1",
      },
      tags: ["L1", "PP1"],
      warnings: [],
      sort: {
        metricKey: "goals_per_60",
        rank: 1,
        percentile: 98.2,
      },
      composite: {
        offenseRating: 91.4,
        defenseRating: 72.2,
        mcmScore: 88.6,
        beastTier: "BEAST+",
        shootFirstScore: 79.4,
        passFirstScore: 85.2,
        playDriverScore: 87.1,
        resultsLuckIndex: null,
        methodologyVersion: "contextual_composites_v1",
        snapshotDate: "2026-04-16",
        updatedAt: "2026-06-08T00:00:00.000Z",
      },
      metrics: {
        goals_per_60: {
          metricKey: "goals_per_60",
          shortLabel: "G/60",
          fullLabel: "Goals/60",
          groupKey: "offense",
          rawValue: 1.5,
          formattedValue: "1.50",
          rank: 1,
          percentile: 98.2,
          qualifiedPeerCount: 30,
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
        xga_per_60: {
          metricKey: "xga_per_60",
          shortLabel: "xGA/60",
          fullLabel: "xGA/60",
          groupKey: "defense_on_ice",
          rawValue: 1.2,
          formattedValue: "1.20",
          rank: 2,
          percentile: 92.1,
          qualifiedPeerCount: 30,
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
        },
      },
    },
  ],
  meta: {
    generatedAt: "2026-06-07T12:00:00.000Z",
    rowCount: 1,
    totalRankedRows: 30,
    page: 1,
    pageSize: 10,
    pageCount: 1,
    sortMetric: "goals_per_60",
    sortDirection: "desc",
    metricGroups: [],
    metricColumns: [],
    plannedMetrics: [],
    unavailableMetrics: [],
    colorScaleBands: [],
    activePeerGroupDescription: "L1 deployment",
    snapshotDate: "2026-04-16",
    latestAvailableSnapshotDate: "2026-04-16",
    snapshotUpdatedAt: "2026-04-16T06:00:00.000Z",
    snapshotSelectionReason: "latest_available",
    sourceTable: "rolling_player_game_metrics",
    message: null,
  },
};

describe("PlayerSnapshotPanel", () => {
  it("renders selected player context, live strengths, caveats, metric bars, and secondary composites", () => {
    render(<PlayerSnapshotPanel payload={payload} selectedPlayerId={1} />);

    expect(screen.getByText("Nikita Kucherov")).toBeTruthy();
    expect(screen.getByAltText("Nikita Kucherov headshot").getAttribute("src")).toBe(
      "https://assets.nhle.com/mugs/nhl/20252026/TBL/8476453.png",
    );
    expect(screen.getByAltText("Tampa Bay Lightning logo").getAttribute("src")).toBe(
      "/teamLogos/TBL.png",
    );
    expect(screen.getByText("L1 / PP1")).toBeTruthy();
    expect(screen.getByText("Profile Read")).toBeTruthy();
    expect(screen.getByText(/Best live signal is Goals\/60/)).toBeTruthy();
    expect(screen.getByText("Live Strengths")).toBeTruthy();
    expect(screen.getByText(/Goals\/60: 98\.2% percentile, rank 1/)).toBeTruthy();
    expect(screen.getByText(/xGA\/60: 92\.1% percentile, rank 2/)).toBeTruthy();
    expect(screen.getByText("Weak Spots")).toBeTruthy();
    expect(screen.getByText("Sample & Source Notes")).toBeTruthy();
    expect(screen.getByText("xGA/60: source caveat applies.")).toBeTruthy();
    expect(screen.getByText("Key Metric Percentiles")).toBeTruthy();
    expect(screen.getByText("Composite Status")).toBeTruthy();
    expect(screen.getByText("Offense Rating")).toBeTruthy();
    expect(screen.getByText("91.4")).toBeTruthy();
    expect(screen.getAllByText("Published composite value").length).toBeGreaterThan(0);
    expect(screen.getByText("BEAST+ · 88.6")).toBeTruthy();
    expect(screen.getByText("Planned; no live value")).toBeTruthy();
  });

  it("falls back to known local player and team images", () => {
    render(
      <PlayerSnapshotPanel
        payload={{
          ...payload,
          rows: [
            {
              ...payload.rows[0],
              entity: {
                ...payload.rows[0].entity,
                imageUrl: null,
              },
              team: {
                id: null,
                abbreviation: null,
                name: null,
              },
            },
          ],
        }}
        selectedPlayerId={1}
      />,
    );

    expect(screen.getByAltText("Nikita Kucherov headshot").getAttribute("src")).toBe(
      "/pictures/player-placeholder.jpg",
    );
    expect(screen.getByAltText("Team logo").getAttribute("src")).toBe(
      "/teamLogos/FHFH.png",
    );
  });

  it("renders an empty selected-row state", () => {
    render(<PlayerSnapshotPanel payload={null} selectedPlayerId={null} />);

    expect(screen.getByText("Player Snapshot")).toBeTruthy();
    expect(screen.getByText("Select a row to inspect player context.")).toBeTruthy();
  });
});
