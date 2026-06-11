import { describe, expect, it } from "vitest";

import {
  buildSkaterWindowAggregatesFromRollingRow,
  getSkaterWindowSemantics,
  isSupportedSkaterWindowStrengthState,
  SKATER_WINDOW_AGGREGATION_REFRESH_SURFACES,
  type RollingPlayerGameMetricRow,
} from "./skaterWindowAggregation";

function rollingRow(
  overrides: Partial<RollingPlayerGameMetricRow> = {},
): RollingPlayerGameMetricRow {
  return {
    player_id: 1,
    team_id: 10,
    season: 20252026,
    game_date: "2026-01-15",
    strength_state: "all",
    season_games_played: 30,
    season_participation_games: null,
    games_played: 30,
    toi_seconds_avg_season: 900,
    toi_seconds_total_last5: 4500,
    toi_seconds_total_last10: 9000,
    toi_seconds_total_last20: 18000,
    goals_per_60_last5: 2.4,
    goals_per_60_total_last5: 3,
    goals_per_60_season: 1.2,
    goals_per_60_goals_season: 9,
    goals_per_60_toi_seconds_season: 27000,
    points_total_last5: 8,
    points_avg_season: 0.75,
    shot_attempts_per_60_last5: 8,
    shot_attempts_per_60_total_last5: 10,
    shot_attempts_per_60_season: 6,
    shot_attempts_per_60_shot_attempts_season: 45,
    shot_attempts_per_60_toi_seconds_season: 27000,
    penalties_taken_per_60_last5: 2.4,
    penalties_taken_per_60_total_last5: 3,
    penalties_taken_per_60_season: 1.6,
    penalties_taken_per_60_penalties_taken_season: 12,
    penalties_taken_per_60_toi_seconds_season: 27000,
    ixg_per_60_total_last5: 2.5,
    ixg_per_60_ixg_season: 7.5,
    ixg_per_60_toi_seconds_season: 27000,
    oi_gf_total_last5: 6,
    oi_ga_total_last5: 4,
    oi_gf_avg_season: 2,
    oi_ga_avg_season: 1,
    oi_xgf_total_last5: 5,
    oi_xga_total_last5: 3,
    oi_xgf_avg_season: 1.4,
    oi_xga_avg_season: 1.1,
    ...overrides,
  } as RollingPlayerGameMetricRow;
}

describe("skaterWindowAggregation", () => {
  it("keeps last-N production windows on player appearance semantics", () => {
    expect(getSkaterWindowSemantics("season")).toBe("season_to_date");
    expect(getSkaterWindowSemantics("last5")).toBe(
      "player_last_n_games_played",
    );

    const [goalsLast5] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow(),
      { windows: ["last5"], metricKeys: ["goals_per_60"] },
    );

    expect(goalsLast5).toMatchObject({
      playerId: 1,
      teamId: 10,
      seasonId: 20252026,
      snapshotDate: "2026-01-15",
      strengthState: "all",
      window: "last5",
      windowType: "last_5",
      windowSize: 5,
      windowSemantics: "player_last_n_games_played",
      metricKey: "goals_per_60",
      rawValue: 2.4,
      numerator: 3,
      denominator: 4500,
      gamesPlayed: 5,
      toiSeconds: 4500,
    });
  });

  it("derives points per 60 from verified points and TOI fields", () => {
    const [pointsLast5] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow(),
      { windows: ["last5"], metricKeys: ["points_per_60"] },
    );

    expect(pointsLast5).toMatchObject({
      metricKey: "points_per_60",
      rawValue: 6.4,
      numerator: 8,
      denominator: 4500,
      sourceFields: ["points_total_last5", "toi_seconds_total_last5"],
    });
  });

  it("uses selected-window NST ICF for shot attempts per 60", () => {
    const [attemptsLast5] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow(),
      { windows: ["last5"], metricKeys: ["shot_attempts_per_60"] },
    );

    expect(attemptsLast5).toMatchObject({
      metricKey: "shot_attempts_per_60",
      rawValue: 8,
      numerator: 10,
      denominator: 4500,
      sourceFields: [
        "shot_attempts_per_60_last5",
        "shot_attempts_per_60_total_last5",
        "toi_seconds_total_last5",
      ],
    });
  });

  it("uses selected-window total penalties for penalties taken per 60", () => {
    const [penaltiesLast5] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow(),
      { windows: ["last5"], metricKeys: ["penalties_taken_per_60"] },
    );

    expect(penaltiesLast5).toMatchObject({
      metricKey: "penalties_taken_per_60",
      rawValue: 2.4,
      numerator: 3,
      denominator: 4500,
      sourceFields: [
        "penalties_taken_per_60_last5",
        "penalties_taken_per_60_total_last5",
        "toi_seconds_total_last5",
      ],
    });
  });

  it("derives xG finishing metrics from denominator-matched rolling components", () => {
    const aggregates = buildSkaterWindowAggregatesFromRollingRow(rollingRow(), {
      windows: ["last5"],
      metricKeys: [
        "expected_shooting_percentage",
        "sax_percentage",
        "goals_above_expected",
        "unrealized_xg",
      ],
    });

    expect(aggregates).toHaveLength(4);
    expect(aggregates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricKey: "expected_shooting_percentage",
          rawValue: 25,
          numerator: 2.5,
          denominator: 10,
          toiSeconds: 4500,
          sourceFields: [
            "ixg_per_60_total_last5",
            "shot_attempts_per_60_total_last5",
          ],
        }),
        expect.objectContaining({
          metricKey: "sax_percentage",
          rawValue: 5,
          numerator: 0.5,
          denominator: 10,
        }),
        expect.objectContaining({
          metricKey: "goals_above_expected",
          rawValue: 0.5,
          numerator: 3,
          denominator: 2.5,
        }),
        expect.objectContaining({
          metricKey: "unrealized_xg",
          rawValue: -0.5,
          numerator: 2.5,
          denominator: 3,
        }),
      ]),
    );
  });

  it("derives on-ice GF percentage from selected-window on-ice goal totals", () => {
    const [onIceGf] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({ strength_state: "5v5", season_games_played: null }),
      { windows: ["last5"], metricKeys: ["on_ice_gf_percentage"] },
    );

    expect(onIceGf).toMatchObject({
      metricKey: "on_ice_gf_percentage",
      strengthState: "5v5",
      rawValue: 60,
      numerator: 6,
      denominator: 10,
      toiSeconds: 4500,
      sourceFields: ["oi_gf_total_last5", "oi_ga_total_last5"],
    });
  });

  it("derives true 5v5 on-ice xG metrics from selected-window support totals", () => {
    const [xgaPer60, onIceXgf] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({ strength_state: "5v5", season_games_played: null }),
      {
        windows: ["last5"],
        metricKeys: ["xga_per_60", "on_ice_xgf_percentage"],
      },
    );

    expect(xgaPer60).toMatchObject({
      metricKey: "xga_per_60",
      strengthState: "5v5",
      rawValue: 2.4,
      numerator: 3,
      denominator: 4500,
      sourceFields: ["oi_xga_total_last5", "toi_seconds_total_last5"],
    });
    expect(onIceXgf).toMatchObject({
      metricKey: "on_ice_xgf_percentage",
      strengthState: "5v5",
      rawValue: 62.5,
      numerator: 5,
      denominator: 8,
      sourceFields: ["oi_xgf_total_last5", "oi_xga_total_last5"],
    });
  });

  it("does not calculate rates when denominator samples are missing or zero", () => {
    const [pointsLast5] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({ toi_seconds_total_last5: 0 }),
      { windows: ["last5"], metricKeys: ["points_per_60"] },
    );

    expect(pointsLast5.rawValue).toBeNull();
    expect(pointsLast5.denominator).toBe(0);
  });

  it("preserves split-strength participation samples and supported strength states", () => {
    expect(isSupportedSkaterWindowStrengthState("ev")).toBe(true);
    expect(isSupportedSkaterWindowStrengthState("5v5")).toBe(true);

    const [goalsLast10] = buildSkaterWindowAggregatesFromRollingRow(
      rollingRow({
        strength_state: "ev",
        season_games_played: null,
        season_participation_games: 6,
        goals_per_60_last10: 1,
        goals_per_60_total_last10: 2,
      }),
      { windows: ["last10"], metricKeys: ["goals_per_60"] },
    );

    expect(goalsLast10.gamesPlayed).toBe(6);
    expect(goalsLast10.strengthState).toBe("ev");
  });

  it("documents the existing refresh surfaces instead of adding a redundant rebuild path", () => {
    expect(SKATER_WINDOW_AGGREGATION_REFRESH_SURFACES).toEqual({
      endpoint: "/api/v1/db/update-rolling-player-averages",
      truncateRpc: "truncate_rolling_player_game_metrics",
      sourceTable: "rolling_player_game_metrics",
    });
  });
});
