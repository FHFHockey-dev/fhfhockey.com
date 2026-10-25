import { describe, expect, it } from "vitest";

import {
  buildMetricsTimelineRows,
  calculateTimelineDelta,
} from "./metricsTimelineData";

const approvedXg = {
  game_date: "2026-01-10", game_id: 2025020001,
  source_model_approved: true, source_prediction_type: "shot_goal",
  xg_for: 2.9, xg_against: 2.3,
};

describe("buildMetricsTimelineRows", () => {
  it("preserves a dated WGO snapshot's sample size alongside approved per-game xG", () => {
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
      xgRows: [approvedXg],
    });

    expect(rows).toEqual([
      {
        date: "2026-01-10",
        label: "01-10",
        wgoGamesPlayed: 30,
        xgGameId: 2025020001,
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

  it.each([false, null, undefined, "true", 1])("rejects xG without explicit approval: %s", (approval) => {
    const row = JSON.parse(JSON.stringify({ ...approvedXg, source_model_approved: approval }));
    expect(buildMetricsTimelineRows({ wgoRows: [], xgRows: [row] })).toEqual([]);
  });

  it.each([
    { source_prediction_type: null },
    { source_prediction_type: "rebound" },
    { game_id: null },
    { game_id: 0 },
    { game_date: null },
  ])("rejects unsupported prediction provenance or missing game identity: %j", (change) => {
    expect(buildMetricsTimelineRows({ wgoRows: [], xgRows: [{ ...approvedXg, ...change }] })).toEqual([]);
  });

  it.each([null, NaN, Infinity, -1])("keeps valid xGA and its source date when xGF is %s", (xgf) => {
    const rows = buildMetricsTimelineRows({ wgoRows: [], xgRows: [{ ...approvedXg, xg_for: xgf }] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-01-10", xgf: null, xga: 2.3, pointPct: null, wgoGamesPlayed: null });
  });

  it("preserves genuine zero xG and xG-only dates without carrying WGO values forward", () => {
    const rows = buildMetricsTimelineRows({
      wgoRows: [{ date: "2026-01-09", points: 2, games_played: 1, goals_for_per_game: 4, goals_against_per_game: 1, power_play_pct: null, shots_for_per_game: 30 }],
      xgRows: [{ ...approvedXg, xg_for: 0, xg_against: null }],
    });
    expect(rows.map((row) => [row.date, row.pointPct, row.xgf, row.xga])).toEqual([
      ["2026-01-09", 1, null, null], ["2026-01-10", null, 0, null],
    ]);
  });

  it("retains the preferred approved version without filling its missing category from another version", () => {
    const rows = buildMetricsTimelineRows({ wgoRows: [], xgRows: [
      { ...approvedXg, xg_against: null }, { ...approvedXg, xg_for: 9 },
    ] });
    expect(rows[0]).toMatchObject({ xgf: 2.9, xga: null });
  });

  it("does not label two different games on one date as a single per-game total", () => {
    const rows = buildMetricsTimelineRows({ wgoRows: [], xgRows: [
      approvedXg, { ...approvedXg, game_id: 2025020002 }, approvedXg,
    ] });
    expect(rows[0]).toMatchObject({ xgf: null, xga: null, xgGameId: null });
  });
});

describe("calculateTimelineDelta", () => {
  it("compares the latest point against the configured lookback", () => {
    const delta = calculateTimelineDelta({
      rows: [
        {
          date: "2026-01-01",
          label: "01-01",
          wgoGamesPlayed: 30,
          xgGameId: null,
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
          wgoGamesPlayed: 31,
          xgGameId: null,
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
          wgoGamesPlayed: 32,
          xgGameId: null,
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
