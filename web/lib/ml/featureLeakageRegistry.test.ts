import { describe, expect, it } from "vitest";

import {
  assertFeatureLeakageUsage,
  getFeatureLeakageEntriesByTable,
  validateFeatureLeakageUsage,
} from "./featureLeakageRegistry";

describe("featureLeakageRegistry", () => {
  it("allows pregame-safe schedule and travel features", () => {
    const report = validateFeatureLeakageUsage({
      usageMode: "pregame",
      tableNames: ["games", "nhl_xg_team_game_travel_fatigue_features"],
    });

    expect(report).toMatchObject({
      passed: true,
      blockingReasons: [],
      unknownTables: [],
    });
  });

  it("warns but allows freshness-gated pregame sources", () => {
    const report = validateFeatureLeakageUsage({
      usageMode: "pregame",
      tableNames: ["player_status_history", "goalie_start_projections"],
    });

    expect(report.passed).toBe(true);
    expect(report.warnings).toEqual([
      "goalie_starter_signals:requires_as_of_freshness_validation",
      "injury_status_signals:requires_as_of_freshness_validation",
    ]);
  });

  it("rejects postgame and target-leakage features from pregame usage", () => {
    const report = validateFeatureLeakageUsage({
      usageMode: "pregame",
      tableNames: [
        "nhl_xg_qot_qoc_player_game_features",
        "nhl_xg_adjusted_player_impacts",
      ],
      featureKeys: ["shotEventType:goal"],
    });

    expect(report.passed).toBe(false);
    expect(report.blockingReasons).toEqual([
      "adjusted_impact_postgame:postgame_descriptive_not_allowed_for_pregame",
      "direct_shot_goal_label:target_leakage_not_allowed_for_pregame",
      "qot_qoc_postgame_overlap:postgame_descriptive_not_allowed_for_pregame",
    ]);
  });

  it("rejects unregistered sources until they are explicitly classified", () => {
    const report = validateFeatureLeakageUsage({
      usageMode: "training",
      featureIds: ["new_model_feature"],
      tableNames: ["new_feature_table"],
    });

    expect(report.passed).toBe(false);
    expect(report.blockingReasons).toEqual([
      "new_model_feature:unregistered_feature_id",
      "new_feature_table:unregistered_table",
    ]);
  });

  it("throws from assert helper when unsafe features are requested", () => {
    expect(() =>
      assertFeatureLeakageUsage({
        usageMode: "pregame",
        tableNames: ["game_prediction_outputs"],
      })
    ).toThrow(/prediction_outputs:target_leakage_not_allowed_for_pregame/);
  });

  it("finds registry entries by table", () => {
    expect(getFeatureLeakageEntriesByTable("nhl_edge_skater_metrics_daily")).toEqual([
      expect.objectContaining({
        id: "nhl_edge_metrics",
        category: "pregame_safe_with_freshness",
      }),
    ]);
    expect(getFeatureLeakageEntriesByTable("nhl_xg_rebound_control_goalie_game_aggregates")).toEqual([
      expect.objectContaining({
        id: "xg_aggregates",
        category: "postgame_descriptive",
      }),
    ]);
  });
});
