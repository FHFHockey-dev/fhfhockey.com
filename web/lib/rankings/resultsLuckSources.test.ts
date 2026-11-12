import { describe, expect, it } from "vitest";

import { calculateComponentAwareResultsLuckIndex } from "./resultsLuckIndex";
import {
  buildResultsLuckRollingSourceFromRow,
  resultsLuckRollingSelectFields,
} from "./resultsLuckSources";

describe("resultsLuckSources", () => {
  // Astra W2-4 fixture 4: 40 games as two identical 20-game halves
  // (G 6, ixG 4, TOI 18,000 s each); the last-20 window is the second half.
  function neutralRow(gameIds = Array.from({ length: 20 }, (_, i) => 2025020301 + i)) {
    return {
      player_id: 8478402,
      game_date: "2026-04-16",
      strength_state: "5v5",
      season: 20252026,
      season_games_played: 40,
      season_participation_games: 40,
      // Per-60 rate aliases: the defect subtracted these from season counts.
      goals_per_60_total_last20: 1.2,
      ixg_per_60_total_last20: 0.8,
      goals_per_60_goals_season: 12,
      goals_per_60_toi_seconds_season: 36000,
      ixg_per_60_ixg_season: 8,
      ixg_per_60_toi_seconds_season: 36000,
      ipp_points_season: 20,
      ipp_on_ice_goals_for_season: 40,
      oi_gf_total_last20: 20,
      oi_xgf_total_last20: 18,
      toi_seconds_total_last20: 18000,
      oi_gf_avg_season: 1,
      oi_xgf_avg_season: 0.9,
      toi_seconds_avg_season: 900,
      windowCountSupport: {
        version: "rolling-player-window-counts-v1",
        strengthState: "5v5",
        anchor: { gameId: 2025020320, gameDate: "2026-04-16", season: 20252026 },
        selection: "chronological_appearances_in_strength_state",
        game: { appeared: true, ratio: {}, additive: {} },
        windows: Object.fromEntries(["last5", "last10", "last20"].map((key) => [key, {
          appearances: 20, gameIds, gameDates: Array(20).fill("2026-04-16"), secondary: {},
          ratio: {
            goals_per_60: [6, 18000, 20],
            ixg_per_60: [4, 18000, 20],
            ipp: [10, 20, 20],
            expected_sh_pct: [4, 80, 20],
          },
        }])),
      },
    };
  }

  it("scores a matched neutral window at exactly 100 per component, or leaves it unpublished (W2-4 D3)", () => {
    const source = buildResultsLuckRollingSourceFromRow({ window: "last20", row: neutralRow() });
    expect(source?.baselineProvenance).toMatchObject({
      baselineSource: "player_non_overlapping",
      baselineWindowExcluded: true,
    });
    const result = calculateComponentAwareResultsLuckIndex({
      components: source!.components,
      baselineProvenance: source!.baselineProvenance,
      currentWindow: "last20",
    });
    const byKey = new Map(result.componentScores.map((score) => [score.key, score]));
    // (G − ixG)/60: 2 × 3600 ÷ 18,000 = 0.4 in the window and in the baseline.
    expect(byKey.get("goals_above_expected")).toMatchObject({
      currentValue: 0.4, baselineValue: 0.4, componentIndex: 100,
    });
    expect(byKey.get("ipp")?.componentIndex).toBe(100);
    expect(byKey.get("on_ice_shooting_context")?.componentIndex).toBe(100);
    // SAX% has no stored season Fenwick count: unknown, so nothing publishes
    // (the defect published 65 for this fixture).
    expect(byKey.get("sax_percentage")?.componentIndex).toBeNull();
    expect(result.canPublish).toBe(false);
  });

  it("has no season-minus-window baseline when the window crosses seasons", () => {
    const ids = [
      ...Array.from({ length: 5 }, (_, i) => 2024021201 + i),
      ...Array.from({ length: 15 }, (_, i) => 2025020301 + i),
    ];
    const source = buildResultsLuckRollingSourceFromRow({ window: "last20", row: neutralRow(ids) });
    expect(source?.baselineProvenance).toMatchObject({
      baselineSource: "unavailable",
      baselineWindowExcluded: false,
    });
    expect(source?.baselineProvenance.warnings).toContain("window_crosses_seasons_no_baseline");
    expect(source?.components.every((component) => component.baselineValue == null)).toBe(true);
  });

  it("leaves the window unknown without L6 window-count support", () => {
    const source = buildResultsLuckRollingSourceFromRow({
      window: "last20",
      row: { ...neutralRow(), windowCountSupport: null },
    });
    expect(source?.components.find((c) => c.key === "goals_above_expected")?.currentValue).toBeNull();
    expect(source?.baselineProvenance.warnings).toContain("window_count_support_unavailable");
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
    const fields = resultsLuckRollingSelectFields("last20");
    expect(fields).toEqual(
      expect.arrayContaining([
        "toi_seconds_total_last20",
        "oi_gf_total_last20",
        "oi_xgf_total_last20",
        "goals_per_60_goals_season",
        "goals_per_60_toi_seconds_season",
        "ixg_per_60_ixg_season",
        "ixg_per_60_toi_seconds_season",
        "ipp_points_season",
        "ipp_on_ice_goals_for_season",
        "oi_gf_avg_season",
        "oi_xgf_avg_season",
        "toi_seconds_avg_season",
      ]),
    );
    // Per-60 rate aliases are never read as counts (W2-4 D3, W3-6 N1).
    expect(fields.filter((field) => /_per_60_total_last/.test(field))).toEqual([]);
  });
});
