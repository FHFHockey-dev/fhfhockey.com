import { describe, expect, it } from "vitest";

import {
  buildGamePredictionHealthReport,
  MONITORED_GAME_PREDICTION_JOB_NAMES,
} from "./adminHealth";

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
      segmentMetrics: [
        {
          segment_key: "season_phase",
          segment_value: "late",
          evaluated_games: 50,
          accuracy: 0.6,
          log_loss: 0.64,
          brier_score: 0.21,
          evaluation_start_date: "2025-10-01",
          evaluation_end_date: "2026-04-20",
          computed_at: "2026-04-27T08:00:00.000Z",
        },
        {
          segment_key: "goalie_confirmation_state",
          segment_value: "both_confirmed",
          evaluated_games: 40,
          accuracy: 0.57,
          log_loss: 0.66,
          brier_score: 0.22,
          evaluation_start_date: "2025-10-01",
          evaluation_end_date: "2026-04-20",
          computed_at: "2026-04-27T08:00:00.000Z",
        },
        {
          segment_key: "has_stale_source",
          segment_value: "false",
          evaluated_games: 100,
          accuracy: 0.59,
          log_loss: 0.65,
          brier_score: 0.22,
          evaluation_start_date: "2025-10-01",
          evaluation_end_date: "2026-04-20",
          computed_at: "2026-04-27T08:00:00.000Z",
        },
        {
          segment_key: "market_edge_bucket",
          segment_value: "no_market",
          evaluated_games: 120,
          accuracy: 0.58,
          log_loss: 0.66,
          brier_score: 0.22,
          evaluation_start_date: "2025-10-01",
          evaluation_end_date: "2026-04-20",
          computed_at: "2026-04-27T08:00:00.000Z",
        },
      ] as any,
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
    expect(report.jobs.monitoredJobNames).toEqual(
      MONITORED_GAME_PREDICTION_JOB_NAMES,
    );
    expect(report.jobs.monitoredJobNames).toEqual(
      expect.arrayContaining([
        "game-predictions-ingest-espn-odds",
        "game-predictions-backfill-feature-snapshots",
        "game-predictions-backtest-ablation",
        "game-predictions-accuracy-loop",
        "game-predictions-promote-model-version",
      ]),
    );
    expect(report.featureQuality.missingFeatureRate).toBe(0.5);
    expect(report.segmentPerformance.missingSegmentKeys).toEqual([]);
    expect(report.segmentPerformance.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          segmentKey: "season_phase",
          segmentValue: "late",
          coveragePctOfOverall: 50 / 120,
        }),
        expect.objectContaining({
          segmentKey: "market_edge_bucket",
          segmentValue: "no_market",
        }),
      ])
    );
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

  it("warns when persisted post-promotion segment metrics are incomplete", () => {
    const report = buildGamePredictionHealthReport({
      generatedAt: "2026-04-27T12:00:00.000Z",
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
      segmentMetrics: [
        {
          segment_key: "season_phase",
          segment_value: "late",
          evaluated_games: 50,
          accuracy: 0.6,
          log_loss: 0.64,
          brier_score: 0.21,
          evaluation_start_date: "2025-10-01",
          evaluation_end_date: "2026-04-20",
          computed_at: "2026-04-27T08:00:00.000Z",
        },
      ] as any,
    });

    expect(report.segmentPerformance.missingSegmentKeys).toEqual([
      "goalie_confirmation_state",
      "has_stale_source",
      "market_edge_bucket",
    ]);
    expect(report.alerts.map((alert) => alert.code)).toContain(
      "segment_monitoring_incomplete",
    );
  });

  it("surfaces eligible production promotion audit metadata", () => {
    const report = buildGamePredictionHealthReport({
      generatedAt: "2026-04-27T12:00:00.000Z",
      productionModel: {
        model_name: "nhl_game_baseline_logistic",
        model_version: "candidate-v1",
        feature_set_version: "game_features_v5_accuracy_candidates",
        status: "production",
        trained_at: "2026-04-01T00:00:00.000Z",
        promoted_at: "2026-04-26T00:00:00.000Z",
        updated_at: "2026-04-26T00:00:00.000Z",
        validation_start_date: "2025-12-01",
        validation_end_date: "2026-04-20",
        validation_metrics: {
          summary: {
            evaluatedGames: 180,
          },
        },
        metadata: {
          promotion_status: "eligible_for_manual_promotion",
          promotion_decision: {
            promote: true,
          },
          validation_window: {
            start_date: "2025-12-01",
            end_date: "2026-04-20",
            evaluated_games: 180,
          },
        },
        source_audit_metadata: {
          uses_market_features: true,
          market_feature_training_eligible: true,
          market_source_readiness: {
            acceptedSourceNames: [
              "espn_site_api_market_odds",
              "historical_market_odds_import",
            ],
            requiredGames: 180,
            trustedSnapshotSourceGames: 180,
            trustedSnapshotSourceCoveragePct: 1,
            trustedSnapshotSourceNames: ["historical_market_odds_import"],
            trustedImportBatchIds: ["market-import-2026-06-15"],
          },
          public_explanation_ready: true,
          explanation_blockers: [],
          segment_regression_count: 0,
        },
      } as any,
    });

    expect(report.productionModel?.promotionAudit).toMatchObject({
      promotionStatus: "eligible_for_manual_promotion",
      decisionPromote: true,
      evaluatedGames: 180,
      validationStartDate: "2025-12-01",
      validationEndDate: "2026-04-20",
      usesMarketFeatures: true,
      marketFeatureTrainingEligible: true,
      marketTrustedSnapshotSourceGames: 180,
      marketRequiredGames: 180,
      marketTrustedSnapshotSourceCoveragePct: 1,
      marketAcceptedSourceNames: [
        "espn_site_api_market_odds",
        "historical_market_odds_import",
      ],
      marketTrustedSnapshotSourceNames: ["historical_market_odds_import"],
      marketTrustedImportBatchIds: ["market-import-2026-06-15"],
      publicExplanationReady: true,
      explanationBlockers: [],
      segmentRegressionCount: 0,
    });
    expect(report.alerts.map((alert) => alert.code)).not.toContain(
      "production_promotion_evidence_incomplete",
    );
  });

  it("warns when production market-feature evidence lacks trusted odds row provenance coverage", () => {
    const report = buildGamePredictionHealthReport({
      generatedAt: "2026-04-27T12:00:00.000Z",
      productionModel: {
        model_name: "nhl_game_baseline_logistic",
        model_version: "candidate-v1",
        feature_set_version: "game_features_v5_accuracy_candidates",
        status: "production",
        trained_at: "2026-04-01T00:00:00.000Z",
        promoted_at: "2026-04-26T00:00:00.000Z",
        updated_at: "2026-04-26T00:00:00.000Z",
        validation_start_date: "2025-12-01",
        validation_end_date: "2026-04-20",
        validation_metrics: {
          summary: {
            evaluatedGames: 180,
          },
        },
        metadata: {
          promotion_status: "eligible_for_manual_promotion",
          promotion_decision: {
            promote: true,
          },
        },
        source_audit_metadata: {
          uses_market_features: true,
          market_feature_training_eligible: true,
          market_source_readiness: {
            acceptedSourceNames: [
              "espn_site_api_market_odds",
              "historical_market_odds_import",
            ],
            requiredGames: 180,
            trustedSnapshotSourceGames: 100,
            trustedSnapshotSourceCoveragePct: 0.555556,
            trustedSnapshotSourceNames: ["historical_market_odds_import"],
            trustedImportBatchIds: ["market-import-2026-06-15"],
          },
          public_explanation_ready: true,
          explanation_blockers: [],
          segment_regression_count: 0,
        },
      } as any,
    });

    expect(report.productionModel?.promotionAudit).toMatchObject({
      usesMarketFeatures: true,
      marketFeatureTrainingEligible: true,
      marketTrustedSnapshotSourceGames: 100,
      marketRequiredGames: 180,
      marketTrustedSnapshotSourceCoveragePct: 0.555556,
      marketAcceptedSourceNames: [
        "espn_site_api_market_odds",
        "historical_market_odds_import",
      ],
      marketTrustedSnapshotSourceNames: ["historical_market_odds_import"],
      marketTrustedImportBatchIds: ["market-import-2026-06-15"],
    });
    expect(report.alerts.map((alert) => alert.code)).toContain(
      "production_promotion_evidence_incomplete",
    );
  });
});
