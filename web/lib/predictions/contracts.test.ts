import { describe, expect, it } from "vitest";

import {
  buildPredictionMetadataContract,
  buildSourceFreshnessContract,
} from "./contracts";

describe("prediction contracts", () => {
  it("labels fresh, fallback, stale, and missing source states", () => {
    expect(
      buildSourceFreshnessContract({
        source: "team_power_ratings_daily",
        requestedDate: "2026-01-10",
        sourceDate: "2026-01-09",
      })
    ).toMatchObject({
      ageDays: 1,
      stale: false,
      fallbackApplied: false,
      degradedState: "fresh",
      label: "Fresh",
    });

    expect(
      buildSourceFreshnessContract({
        source: "team_power_ratings_daily",
        requestedDate: "2026-01-10",
        sourceDate: "2026-01-09",
        fallbackReason: "latest_available_with_data",
      })
    ).toMatchObject({
      stale: false,
      fallbackApplied: true,
      degradedState: "fallback",
      label: "Fallback",
    });

    expect(
      buildSourceFreshnessContract({
        source: "wgo_team_stats",
        requestedDate: "2026-01-30",
        sourceDate: "2026-01-01",
        staleThresholdDays: 14,
      })
    ).toMatchObject({
      ageDays: 29,
      stale: true,
      degradedState: "stale",
      label: "Stale",
    });

    expect(
      buildSourceFreshnessContract({
        source: "goalie_start_projections",
        requestedDate: "2026-01-10",
        sourceDate: null,
      })
    ).toMatchObject({
      sourceDate: null,
      stale: true,
      degradedState: "missing",
      label: "Missing",
    });
  });

  it("preserves the shared model metadata shape", () => {
    const metadata = buildPredictionMetadataContract({
      modelName: "baseline_logistic",
      modelVersion: "v1",
      featureSetVersion: "game_features_v2",
      asOfDate: "2026-01-10",
      fallbackFlags: { home_goalie_fallback: true },
      warnings: [{ code: "missing_goalie", message: "No goalie starter row." }],
    });

    expect(metadata).toEqual({
      modelName: "baseline_logistic",
      modelVersion: "v1",
      featureSetVersion: "game_features_v2",
      asOfDate: "2026-01-10",
      sourceCutoffs: [],
      warnings: [{ code: "missing_goalie", message: "No goalie starter row." }],
      topFactors: [],
      calibration: null,
      fallbackFlags: { home_goalie_fallback: true },
    });
  });
});
