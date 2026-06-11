import { describe, expect, it } from "vitest";

import {
  ADJUSTED_IMPACT_TARGET_FAMILY,
  buildAdjustedImpactDesignRows,
  fitAdjustedImpactBaseline,
  validateAdjustedImpactHeldOut,
  validateAdjustedImpactLeakage,
  type AdjustedImpactDesignRow,
  type AdjustedImpactShotRow,
} from "./adjustedImpact";

function shot(overrides: Partial<AdjustedImpactShotRow> = {}): AdjustedImpactShotRow {
  return {
    model_version: "model-v1",
    feature_version: 1,
    game_id: 2025020001,
    event_id: 102,
    season_id: 20252026,
    game_date: "2025-10-07",
    event_owner_team_id: 10,
    home_team_id: 10,
    away_team_id: 20,
    period_number: 1,
    period_seconds_elapsed: 325,
    strength_state: "5v5",
    strength_exact: "5v5",
    owner_score_diff_before_event: 1,
    owner_score_diff_bucket: "leading_1",
    zone_code: "O",
    shot_zone_code: "slot",
    owner_rest_days: 1,
    opponent_rest_days: 2,
    xg: 0.24,
    ...overrides,
  };
}

const stintsByGameId = new Map([
  [
    2025020001,
    [
      {
        gameId: 2025020001,
        seasonId: 20252026,
        gameDate: "2025-10-07",
        period: 1,
        startSecond: 300,
        endSecond: 340,
        durationSeconds: 40,
        teams: [
          { teamId: 10, playerIds: [1, 2, 3, 4, 5, 30] },
          { teamId: 20, playerIds: [6, 7, 8, 9, 10, 40] },
        ],
        onIcePlayerIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 30, 40],
      },
    ],
  ],
]);

function adjustedDesignRow(overrides: Partial<AdjustedImpactDesignRow> = {}): AdjustedImpactDesignRow {
  return {
    target_family: ADJUSTED_IMPACT_TARGET_FAMILY,
    model_version: "model-v1",
    feature_version: 1,
    game_id: 2025020001,
    event_id: 1,
    season_id: 20252026,
    game_date: "2025-10-07",
    response_xg_for: 0.3,
    response_xg_differential: 0.3,
    event_owner_team_id: 10,
    opponent_team_id: 20,
    is_home_event_for: true,
    period_number: 1,
    period_seconds_elapsed: 325,
    strength_state: "5v5",
    strength_exact: "5v5",
    owner_score_diff_before_event: 0,
    owner_score_diff_bucket: "tied",
    zone_code: "O",
    shot_zone_code: "slot",
    owner_rest_days: 1,
    opponent_rest_days: 1,
    player_coefficients: [
      { player_id: 1, team_id: 10, side: "for", value: 1 },
      { player_id: 2, team_id: 20, side: "against", value: -1 },
    ],
    ...overrides,
  };
}

describe("buildAdjustedImpactDesignRows", () => {
  it("creates sparse on-ice xG differential design rows with context features", () => {
    const result = buildAdjustedImpactDesignRows({
      shots: [shot()],
      stintsByGameId,
      goaliePlayerIds: new Set([30, 40]),
    });

    expect(result.targetFamily).toBe(ADJUSTED_IMPACT_TARGET_FAMILY);
    expect(result.skippedRows).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        target_family: "on_ice_xg_differential_v1",
        response_xg_for: 0.24,
        response_xg_differential: 0.24,
        event_owner_team_id: 10,
        opponent_team_id: 20,
        is_home_event_for: true,
        strength_state: "5v5",
        owner_score_diff_bucket: "leading_1",
        zone_code: "O",
        shot_zone_code: "slot",
        owner_rest_days: 1,
        opponent_rest_days: 2,
      }),
    ]);
    expect(result.rows[0]!.player_coefficients).toEqual([
      { player_id: 1, team_id: 10, side: "for", value: 1 },
      { player_id: 2, team_id: 10, side: "for", value: 1 },
      { player_id: 3, team_id: 10, side: "for", value: 1 },
      { player_id: 4, team_id: 10, side: "for", value: 1 },
      { player_id: 5, team_id: 10, side: "for", value: 1 },
      { player_id: 6, team_id: 20, side: "against", value: -1 },
      { player_id: 7, team_id: 20, side: "against", value: -1 },
      { player_id: 8, team_id: 20, side: "against", value: -1 },
      { player_id: 9, team_id: 20, side: "against", value: -1 },
      { player_id: 10, team_id: 20, side: "against", value: -1 },
    ]);
  });

  it("skips rows that cannot be joined to full on-ice context", () => {
    const result = buildAdjustedImpactDesignRows({
      shots: [
        shot({ event_id: 1, period_seconds_elapsed: 999 }),
        shot({ event_id: 2, event_owner_team_id: null }),
        shot({ event_id: 3, home_team_id: null, away_team_id: null }),
      ],
      stintsByGameId,
    });

    expect(result.rows).toEqual([]);
    expect(result.skippedRows).toEqual([
      { gameId: 2025020001, eventId: 1, reason: "missing_shift_stint" },
      { gameId: 2025020001, eventId: 2, reason: "missing_required_event_context" },
      { gameId: 2025020001, eventId: 3, reason: "missing_opponent_team_id" },
    ]);
  });

  it("fits a regularized baseline from sparse adjusted-impact design rows", () => {
    const design = buildAdjustedImpactDesignRows({
      shots: [
        shot({ event_id: 101, xg: 0.3 }),
        shot({ event_id: 102, xg: 0.28 }),
        shot({ event_id: 103, event_owner_team_id: 20, home_team_id: 10, away_team_id: 20, xg: 0.05 }),
      ],
      stintsByGameId,
      goaliePlayerIds: new Set([30, 40]),
    });

    const model = fitAdjustedImpactBaseline(design.rows, {
      iterations: 300,
      learningRate: 0.05,
      l2: 0.05,
      minPlayerRows: 1,
    });

    expect(model).toMatchObject({
      target_family: "on_ice_xg_differential_v1",
      model_family: "ridge_sgd_v1",
      training_summary: {
        rows: 3,
        players: 10,
      },
    });
    expect(model.training_summary.mse).toBeLessThan(0.02);
    expect(model.player_estimates.find((row) => row.player_id === 1)).toMatchObject({
      offensive_rows: 2,
      defensive_rows: 1,
      total_rows: 3,
    });
    expect(model.context_estimates.map((row) => row.feature_key)).toContain(
      "strength_state:5v5"
    );
  });

  it("validates adjusted-impact models against a chronological held-out split", () => {
    const rows = Array.from({ length: 10 }).flatMap((_, dateIndex) => {
      const gameDate = `2025-10-${String(dateIndex + 1).padStart(2, "0")}`;
      return [
        adjustedDesignRow({
          event_id: dateIndex * 2 + 1,
          game_date: gameDate,
          response_xg_for: 0.3,
          response_xg_differential: 0.3,
        }),
        adjustedDesignRow({
          event_id: dateIndex * 2 + 2,
          game_date: gameDate,
          response_xg_for: -0.3,
          response_xg_differential: -0.3,
          event_owner_team_id: 20,
          opponent_team_id: 10,
          is_home_event_for: false,
          player_coefficients: [
            { player_id: 2, team_id: 20, side: "for", value: 1 },
            { player_id: 1, team_id: 10, side: "against", value: -1 },
          ],
        }),
      ];
    });

    const report = validateAdjustedImpactHeldOut(rows, {
      iterations: 500,
      learningRate: 0.05,
      l2: 0.01,
      minPlayerRows: 1,
      minValidationRows: 1,
    });

    expect(report.passed).toBe(true);
    expect(report.split).toMatchObject({
      strategy: "chronological_game_date",
      training_rows: 16,
      validation_rows: 4,
      validation_start_game_date: "2025-10-09",
    });
    expect(report.metrics.validation_mse).toBeLessThan(report.metrics.baseline_mse!);
    expect(report.metrics.mse_improvement).toBeGreaterThan(0);
  });

  it("blocks held-out validation when dated rows are insufficient", () => {
    const report = validateAdjustedImpactHeldOut(
      [
        adjustedDesignRow({ game_date: null }),
        adjustedDesignRow({ event_id: 2, game_date: null }),
      ],
      { minValidationRows: 1 }
    );

    expect(report.passed).toBe(false);
    expect(report.blocking_reasons).toContain(
      "insufficient_distinct_game_dates_for_chronological_validation"
    );
    expect(report.warnings).toContain("rows_without_game_dates_excluded_from_held_out_validation");
  });

  it("blocks adjusted-impact rows from pregame-safe usage", () => {
    const design = buildAdjustedImpactDesignRows({
      shots: [shot()],
      stintsByGameId,
      goaliePlayerIds: new Set([30, 40]),
    });

    expect(
      validateAdjustedImpactLeakage({
        rows: design.rows,
        usageMode: "postgame_descriptive",
      })
    ).toMatchObject({
      passed: true,
      feature_availability: "postgame_descriptive",
      blocking_reasons: [],
      temporal: {
        rows: 1,
        min_game_date: "2025-10-07",
        max_game_date: "2025-10-07",
      },
    });

    expect(
      validateAdjustedImpactLeakage({
        rows: design.rows,
        usageMode: "pregame",
      })
    ).toMatchObject({
      passed: false,
      blocking_reasons: [
        "adjusted_impact_is_not_pregame_safe",
        "same_game_on_ice_target_leakage",
      ],
    });
  });
});
