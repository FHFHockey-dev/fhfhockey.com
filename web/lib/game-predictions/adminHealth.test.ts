import { describe, expect, it } from "vitest";

import { buildGamePredictionHealthReport } from "./adminHealth";

describe("game prediction admin health", () => {
  it("summarizes model, coverage, freshness, job, and feature-quality warnings", () => {
    const report = buildGamePredictionHealthReport({
      generatedAt: "2026-04-27T12:00:00.000Z",
      productionModel: {
        model_name: "nhl_game_baseline_logistic",
        model_version: "v1",
        feature_set_version: "game_features_v1",
        status: "production",
        trained_at: "2026-04-01T00:00:00.000Z",
        promoted_at: "2026-04-10T00:00:00.000Z",
        updated_at: "2026-04-10T00:00:00.000Z",
      } as any,
      latestMetric: {
        evaluated_games: 120,
        accuracy: 0.58,
        log_loss: 0.66,
        brier_score: 0.22,
        auc: 0.61,
        evaluation_start_date: "2025-10-01",
        evaluation_end_date: "2026-04-20",
        computed_at: "2026-04-27T08:00:00.000Z",
      } as any,
      scheduledGames: [{ id: 1 }, { id: 2 }] as any,
      predictionOutputs: [{ game_id: 1 }] as any,
      provenanceRows: [
        {
          source_name: "lineups",
          source_type: "lineup",
          status: "observed",
          freshness_expires_at: null,
          observed_at: "2026-04-27T10:00:00.000Z",
        },
        {
          source_name: "goalies",
          source_type: "goalie_start",
          status: "stale",
          freshness_expires_at: "2026-04-26T10:00:00.000Z",
          observed_at: "2026-04-26T08:00:00.000Z",
        },
      ] as any,
      failedJobs: [
        {
          job_name: "game-predictions-generate",
          run_time: "2026-04-27T09:00:00.000Z",
          details: { error: "failed" },
        },
      ] as any,
      featureSnapshots: [
        {
          missing_features: ["team_power"],
          feature_payload: {
            warnings: [
              {
                code: "goalie_probability_anomaly",
                message: "starter probabilities do not sum to 1",
              },
            ],
          },
        },
        { missing_features: [], feature_payload: { warnings: [] } },
      ] as any,
    });

    expect(report.productionModel?.ageDays).toBe(17);
    expect(report.predictionCoverage.missingGameIds).toEqual([2]);
    expect(report.dataFreshness.staleSourceCount).toBe(2);
    expect(report.jobs.failedJobCount).toBe(1);
    expect(report.featureQuality.missingFeatureRate).toBe(0.5);
    expect(report.alerts.map((alert) => alert.code)).toEqual(
      expect.arrayContaining([
        "stale_sources",
        "missing_predictions",
        "failed_jobs",
        "stale_model",
        "goalie_probability_anomalies",
      ])
    );
  });
});
