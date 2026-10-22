import { describe, expect, it } from "vitest";

import {
  buildMetricsTimelineRows,
  calculateTimelineDelta,
} from "./metricsTimelineData";

describe("buildMetricsTimelineRows", () => {
  it("merges WGO and 5v5 timeline sources into one chart contract", () => {
    const rows = buildMetricsTimelineRows({
      wgoRows: [
        {
          date: "2026-01-10",
          points: 40,
          games_played: 30,
          goals_for_per_game: 3.4,
          goals_against_per_game: 2.7,
          power_play_pct: 0.24,
          shots_for_per_game: 31.2,
        },
      ],
      underlyingRows: [
        {
          date: "2026-01-10",
          xgf: 2.9,
          xga: 2.3,
        },
      ],
    });

    expect(rows).toEqual([
      {
        date: "2026-01-10",
        label: "01-10",
        pointPct: 40 / 60,
        goalsForPerGame: 3.4,
        goalsAgainstPerGame: 2.7,
        powerPlayPct: 0.24,
        shotsForPerGame: 31.2,
        xgf: 2.9,
        xga: 2.3,
      },
    ]);
  });
});

describe("calculateTimelineDelta", () => {
  it("compares the latest point against the configured lookback", () => {
    const delta = calculateTimelineDelta({
      rows: [
        {
          date: "2026-01-01",
          label: "01-01",
          pointPct: 0.5,
          goalsForPerGame: 3,
          goalsAgainstPerGame: 2.9,
          powerPlayPct: 0.2,
          shotsForPerGame: 30,
          xgf: 2.5,
          xga: 2.4,
        },
        {
          date: "2026-01-02",
          label: "01-02",
          pointPct: 0.52,
          goalsForPerGame: 3.1,
          goalsAgainstPerGame: 2.8,
          powerPlayPct: 0.21,
          shotsForPerGame: 30.2,
          xgf: 2.6,
          xga: 2.35,
        },
        {
          date: "2026-01-03",
          label: "01-03",
          pointPct: 0.54,
          goalsForPerGame: 3.2,
          goalsAgainstPerGame: 2.7,
          powerPlayPct: 0.22,
          shotsForPerGame: 30.5,
          xgf: 2.7,
          xga: 2.3,
        },
      ],
      metric: "pointPct",
      lookback: 1,
    });

    expect(delta).toBe(0.02);
  });
});
