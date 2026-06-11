import { describe, expect, it } from "vitest";

import {
  buildResultsLuckRollingSourceFromRow,
  resultsLuckRollingSelectFields,
} from "./resultsLuckSources";

describe("resultsLuckSources", () => {
  it("builds selected-window-excluded component values from a rolling row", () => {
    const source = buildResultsLuckRollingSourceFromRow({
      window: "last5",
      row: {
        player_id: 8478402,
        game_date: "2026-04-16",
        strength_state: "5v5",
        season_games_played: 20,
        goals_per_60_total_last5: 4,
        ixg_per_60_total_last5: 2.5,
        shot_attempts_per_60_total_last5: 20,
        goals_per_60_goals_season: 12,
        ixg_per_60_ixg_season: 9.5,
        shot_attempts_per_60_shot_attempts_season: 100,
        ipp_points_last5: 6,
        ipp_on_ice_goals_for_last5: 8,
        ipp_points_season: 30,
        ipp_on_ice_goals_for_season: 50,
        oi_gf_total_last5: 9,
        oi_xgf_total_last5: 7,
        oi_gf_avg_season: 1.5,
        oi_xgf_avg_season: 1.2,
      },
    });

    expect(source?.baselineProvenance).toMatchObject({
      baselineSource: "player_non_overlapping",
      baselineSnapshotDate: "2026-04-16",
      baselineWindowExcluded: true,
      baselineWeight: 1,
    });
    expect(source?.components).toEqual([
      {
        key: "goals_above_expected",
        semantics: "signed_difference",
        currentValue: 1.5,
        baselineValue: 1,
        scale: 2,
        weight: 0.35,
      },
      {
        key: "sax_percentage",
        semantics: "signed_difference",
        currentValue: 7.5,
        baselineValue: 1.25,
        scale: 10,
        weight: 0.25,
      },
      {
        key: "ipp",
        semantics: "ratio",
        currentValue: 75,
        baselineValue: 57.142857,
        weight: 0.2,
      },
      {
        key: "on_ice_shooting_context",
        semantics: "contextual_on_ice",
        currentValue: 2,
        baselineValue: 4,
        scale: 4,
        weight: 0.2,
      },
    ]);
  });

  it("marks season windows unavailable for selected-window exclusion", () => {
    const source = buildResultsLuckRollingSourceFromRow({
      window: "season",
      row: {
        player_id: 8478402,
        game_date: "2026-04-16",
        strength_state: "5v5",
      },
    });

    expect(source?.baselineProvenance).toMatchObject({
      baselineSource: "unavailable",
      baselineWindowExcluded: false,
      baselineWeight: 0,
    });
    expect(source?.baselineProvenance.warnings).toContain(
      "season_window_has_no_non_overlapping_baseline",
    );
  });

  it("selects the raw rolling fields required for every Results Luck component", () => {
    expect(resultsLuckRollingSelectFields("last20")).toEqual(
      expect.arrayContaining([
        "goals_per_60_total_last20",
        "ixg_per_60_total_last20",
        "shot_attempts_per_60_total_last20",
        "ipp_points_last20",
        "ipp_on_ice_goals_for_last20",
        "oi_gf_total_last20",
        "oi_xgf_total_last20",
        "goals_per_60_goals_season",
        "ixg_per_60_ixg_season",
        "shot_attempts_per_60_shot_attempts_season",
        "ipp_points_season",
        "ipp_on_ice_goals_for_season",
        "oi_gf_avg_season",
        "oi_xgf_avg_season",
      ]),
    );
  });
});
