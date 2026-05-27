import { describe, expect, it } from "vitest";

import {
  PREDICTION_SOURCE_OWNERSHIP,
  SKO_OWNERSHIP_DECISION,
  SUSTAINABILITY_RUNTIME_OWNERSHIP,
  getPredictionSourceOwnership,
  getPredictionSourceOwnershipByStage,
} from "./sourceOwnership";

describe("prediction source ownership", () => {
  it("classifies core FORGE and game prediction tables as canonical", () => {
    expect(getPredictionSourceOwnership("rolling_player_game_metrics")).toMatchObject({
      stage: "rolling_features",
      owner: "web_typescript",
      canonical: true,
    });

    expect(getPredictionSourceOwnership("game_prediction_feature_snapshots")).toMatchObject({
      stage: "game_prediction_features",
      canonical: true,
    });
  });

  it("keeps sKO outputs quarantined until validation promotes them", () => {
    expect(getPredictionSourceOwnership("predictions_sko")).toMatchObject({
      stage: "legacy_quarantine",
      canonical: false,
    });
    expect(SKO_OWNERSHIP_DECISION).toMatchObject({
      status: "legacy_quarantine",
      canonical: false,
    });
  });

  it("makes TypeScript the canonical sustainability runtime", () => {
    expect(SUSTAINABILITY_RUNTIME_OWNERSHIP).toMatchObject({
      canonicalRuntime: "web_typescript",
      canonicalPaths: ["web/lib/sustainability/*", "web/pages/api/v1/sustainability/*"],
      nonCanonicalPaths: ["functions/lib/sustainability/*"],
    });
  });

  it("covers every unified prediction stage with at least one ownership row", () => {
    const stages = new Set(PREDICTION_SOURCE_OWNERSHIP.map((entry) => entry.stage));

    expect(stages).toEqual(
      new Set([
        "source_freshness",
        "canonical_contracts",
        "rolling_features",
        "sustainability_baselines",
        "lineup_roster_context",
        "forge_projection_execution",
        "game_prediction_features",
        "backtesting_calibration",
        "product_serving",
        "operational_health",
        "legacy_quarantine",
      ])
    );
    expect(getPredictionSourceOwnershipByStage("forge_projection_execution").length).toBeGreaterThan(3);
  });
});
