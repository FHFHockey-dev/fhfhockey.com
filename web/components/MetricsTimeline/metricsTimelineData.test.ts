import { describe, expect, it } from "vitest";

import {
  buildMetricsTimelineRows,
  calculateTimelineDelta,
} from "./metricsTimelineData";

const PIN = { modelVersion: "cfg-champion", featureVersion: 1 };
const approvedXg = {
  game_date: "2026-01-10", game_id: 2025020001,
  model_version: "cfg-champion", feature_version: 1,
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
      xgModel: PIN,
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
    expect(buildMetricsTimelineRows({ wgoRows: [], xgRows: [row], xgModel: PIN })).toEqual([]);
  });

  it.each([
    { source_prediction_type: null },
    { source_prediction_type: "rebound" },
    { game_id: null },
    { game_id: 0 },
    { game_date: null },
  ])("rejects unsupported prediction provenance or missing game identity: %j", (change) => {
    expect(buildMetricsTimelineRows({ wgoRows: [], xgRows: [{ ...approvedXg, ...change }], xgModel: PIN })).toEqual([]);
  });

  it.each([null, NaN, Infinity, -1])("keeps valid xGA and its source date when xGF is %s", (xgf) => {
    const rows = buildMetricsTimelineRows({ wgoRows: [], xgRows: [{ ...approvedXg, xg_for: xgf }], xgModel: PIN });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-01-10", xgf: null, xga: 2.3, pointPct: null, wgoGamesPlayed: null });
  });

  it("preserves genuine zero xG and xG-only dates without carrying WGO values forward", () => {
    const rows = buildMetricsTimelineRows({
      wgoRows: [{ date: "2026-01-09", points: 2, games_played: 1, goals_for_per_game: 4, goals_against_per_game: 1, power_play_pct: null, shots_for_per_game: 30 }],
      xgRows: [{ ...approvedXg, xg_for: 0, xg_against: null }],
      xgModel: PIN,
    });
    expect(rows.map((row) => [row.date, row.pointPct, row.xgf, row.xga])).toEqual([
      ["2026-01-09", 1, null, null], ["2026-01-10", null, 0, null],
    ]);
  });

  it("selects the registry-pinned model when two models' rows exist for one game, in any order", () => {
    // A shadow model with a newer feature version sorts first under the old
    // "feature_version desc" query order; the pin, not the order, must decide.
    const shadow = { ...approvedXg, model_version: "cfg-shadow", feature_version: 2, xg_for: 1.1, xg_against: 0.7 };
    for (const xgRows of [[shadow, approvedXg], [approvedXg, shadow]]) {
      expect(buildMetricsTimelineRows({ wgoRows: [], xgRows, xgModel: PIN })[0]).toMatchObject({ xgf: 2.9, xga: 2.3 });
      expect(
        buildMetricsTimelineRows({ wgoRows: [], xgRows, xgModel: { modelVersion: "cfg-shadow", featureVersion: 2 } })[0]
      ).toMatchObject({ xgf: 1.1, xga: 0.7 });
    }
    // Same model, other feature version: not the pinned pair.
    expect(buildMetricsTimelineRows({ wgoRows: [], xgRows: [{ ...approvedXg, feature_version: 2 }], xgModel: PIN })).toEqual([]);
  });

  it("admits no in-house xG when no model is pinned", () => {
    expect(buildMetricsTimelineRows({ wgoRows: [], xgRows: [approvedXg], xgModel: null })).toEqual([]);
  });

  it("retains a missing category as null without filling it from another version", () => {
    const rows = buildMetricsTimelineRows({ wgoRows: [], xgRows: [
      { ...approvedXg, xg_against: null }, { ...approvedXg, feature_version: 2, xg_against: 9 },
    ], xgModel: PIN });
    expect(rows[0]).toMatchObject({ xgf: 2.9, xga: null });
  });

  it("does not label two different games on one date as a single per-game total", () => {
    const rows = buildMetricsTimelineRows({ wgoRows: [], xgRows: [
      approvedXg, { ...approvedXg, game_id: 2025020002 }, approvedXg,
    ], xgModel: PIN });
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
