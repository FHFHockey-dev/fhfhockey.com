import { describe, expect, it } from "vitest";

import {
  PREGAME_PREDICTION_REFRESH_POLICY,
  REQUIRED_PROMOTION_MONITORED_SEGMENT_KEYS,
  buildPredictionHealthChecks,
  buildWalkForwardSplits,
  canBootstrapCurrentCompiledBaseline,
  decidePromotion,
  evaluatePersistedModelVersionPromotionGate,
  historicalPregamePredictionCutoffAt,
  servingModelVersionPersistenceAction,
  sourceAsOfDateForPredictionCutoff,
} from "./workflow";
import {
  BASELINE_MODEL_NAME,
  BASELINE_MODEL_VERSION,
} from "./baselineModel";
import { GAME_PREDICTION_FEATURE_SET_VERSION } from "./featureSources";

describe("game prediction workflow", () => {
  it("defines repeated same-day pregame refresh windows", () => {
    expect(PREGAME_PREDICTION_REFRESH_POLICY).toMatchObject({
      allowMultipleSameDayRefreshes: true,
      route: "/api/v1/game-predictions/generate",
      scoringRoute: "/api/v1/game-predictions/score",
    });
    expect(PREGAME_PREDICTION_REFRESH_POLICY.windowsBeforeStartHours).toEqual([24, 6, 1]);
  });

  it("builds walk-forward splits without random shuffling", () => {
    const examples = [
      { snapshotDate: "2026-01-05", id: 5 },
      { snapshotDate: "2026-01-01", id: 1 },
      { snapshotDate: "2026-01-02", id: 2 },
      { snapshotDate: "2026-01-03", id: 3 },
      { snapshotDate: "2026-01-04", id: 4 },
    ];
    const splits = buildWalkForwardSplits(examples, 2, 1);

    expect(splits).toHaveLength(3);
    expect(splits[0].train.map((row) => row.id)).toEqual([1, 2]);
    expect(splits[0].validation.map((row) => row.id)).toEqual([3]);
    expect(splits[1].train.map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it("derives historical feature-snapshot cutoffs before puck drop", () => {
    const cutoff = historicalPregamePredictionCutoffAt(
      {
        date: "2026-01-10",
        startTime: "2026-01-11T00:00:00.000Z",
      },
      2,
    );

    expect(cutoff).toBe("2026-01-10T22:00:00.000Z");
    expect(sourceAsOfDateForPredictionCutoff(cutoff)).toBe("2026-01-10");
    expect(
      historicalPregamePredictionCutoffAt({
        date: "2026-01-10",
        startTime: null,
      }),
    ).toBe("2026-01-10T16:00:00.000Z");
  });

  it("requires meaningful metric improvement before promotion", () => {
    expect(
      decidePromotion({
        current: { logLoss: 0.66, brierScore: 0.23, calibrationMaxGap: 0.04, evaluatedGames: 300 },
        candidate: { logLoss: 0.655, brierScore: 0.228, calibrationMaxGap: 0.03, evaluatedGames: 300 },
      })
    ).toEqual({ promote: true, reasons: [] });

    expect(
      decidePromotion({
        current: { logLoss: 0.66, brierScore: 0.23, calibrationMaxGap: 0.04, evaluatedGames: 300 },
        candidate: { logLoss: 0.655, brierScore: 0.228, calibrationMaxGap: 0.03, evaluatedGames: 300 },
        simpleBaselineFloor: {
          logLoss: 0.65,
          brierScore: 0.225,
          calibrationMaxGap: null,
          evaluatedGames: 300,
        },
      }).reasons
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("strongest simple baseline"),
      ]),
    );

    const rejected = decidePromotion({
      current: { logLoss: 0.66, brierScore: 0.23, calibrationMaxGap: 0.04, evaluatedGames: 300 },
      candidate: { logLoss: 0.659, brierScore: 0.24, calibrationMaxGap: 0.08, evaluatedGames: 20 },
      usesMarketFeatures: true,
      marketFeatureTrainingEligible: false,
      segmentRegressionCount: 1,
      publicExplanationReady: false,
    });

    expect(rejected.promote).toBe(false);
    expect(rejected.reasons.length).toBeGreaterThan(4);
    expect(rejected.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Market features require historical odds snapshots"),
        expect.stringContaining("Public explanation metadata"),
      ]),
    );
  });

  it("promotes only from persisted eligible model-version evidence", () => {
    expect(
      evaluatePersistedModelVersionPromotionGate({
        modelVersion: {
          status: "candidate",
          validation_start_date: "2026-01-01",
          validation_end_date: "2026-04-01",
          validation_metrics: {
            summary: {
              evaluatedGames: 240,
            },
          },
          metadata: {
            promotion_status: "eligible_for_manual_promotion",
            promotion_decision: {
              promote: true,
            },
          },
          source_audit_metadata: {
            uses_market_features: false,
            public_explanation_ready: true,
            explanation_blockers: [],
            segment_regression_count: 0,
          },
        },
        persistedOverallMetric: {
          segment_key: "overall",
          segment_value: "all",
          evaluation_start_date: "2026-01-01",
          evaluation_end_date: "2026-04-01",
          evaluated_games: 240,
          log_loss: 0.64,
          brier_score: 0.21,
          accuracy: 0.58,
        },
        persistedMonitoredSegmentKeys: REQUIRED_PROMOTION_MONITORED_SEGMENT_KEYS,
      }),
    ).toEqual({ promote: true, reasons: [] });

    const blocked = evaluatePersistedModelVersionPromotionGate({
      modelVersion: {
        status: "rejected",
        validation_start_date: null,
        validation_end_date: null,
        validation_metrics: {
          summary: {
            evaluatedGames: 20,
          },
        },
        metadata: {
          promotion_status: "rejected_by_guardrails",
          promotion_decision: {
            promote: false,
          },
        },
        source_audit_metadata: {
          uses_market_features: true,
          market_feature_training_eligible: false,
          public_explanation_ready: false,
          explanation_blockers: ["active_unexplained_feature_keys"],
          segment_regression_count: 1,
        },
      },
    });

    expect(blocked.promote).toBe(false);
    expect(blocked.reasons).toEqual(
      expect.arrayContaining([
        "Only candidate model versions can be promoted manually.",
        "Persisted promotion evidence is not eligible for promotion.",
        "Persisted promotion decision does not approve promotion.",
        "Validation date range is required before promotion.",
        "Candidate evaluated games below minimum 100.",
        "Persisted overall model metric row is required before promotion.",
        "Persisted monitored segment metric rows are required before promotion: season_phase, goalie_confirmation_state, has_stale_source, market_edge_bucket.",
        expect.stringContaining("Market features require historical odds"),
        "Public explanation metadata is not ready for every promoted feature.",
        "Promotion evidence still has public explanation blockers.",
        "1 evaluation segment(s) regressed beyond guardrails.",
      ]),
    );
  });

  it("requires trusted persisted odds snapshot source coverage for market-feature promotion", () => {
    const persistedOverallMetric = {
      segment_key: "overall",
      segment_value: "all",
      evaluation_start_date: "2026-01-01",
      evaluation_end_date: "2026-04-01",
      evaluated_games: 240,
      log_loss: 0.64,
      brier_score: 0.21,
      accuracy: 0.58,
    };
    const persistedMonitoredSegmentKeys = REQUIRED_PROMOTION_MONITORED_SEGMENT_KEYS;
    const baseModelVersion = {
      status: "candidate",
      validation_start_date: "2026-01-01",
      validation_end_date: "2026-04-01",
      validation_metrics: {
        summary: {
          evaluatedGames: 240,
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
        public_explanation_ready: true,
        explanation_blockers: [],
        segment_regression_count: 0,
      },
    };

    const blocked = evaluatePersistedModelVersionPromotionGate({
      modelVersion: baseModelVersion,
      persistedOverallMetric,
      persistedMonitoredSegmentKeys,
    });
    const blockedWithoutSourceNames = evaluatePersistedModelVersionPromotionGate({
      modelVersion: {
        ...baseModelVersion,
        source_audit_metadata: {
          ...baseModelVersion.source_audit_metadata,
          market_source_readiness: {
            requiredGames: 240,
            trustedSnapshotSourceGames: 240,
            trustedSnapshotSourceCoveragePct: 1,
          },
        },
      },
      persistedOverallMetric,
      persistedMonitoredSegmentKeys,
    });
    const eligible = evaluatePersistedModelVersionPromotionGate({
      modelVersion: {
        ...baseModelVersion,
        source_audit_metadata: {
          ...baseModelVersion.source_audit_metadata,
          market_source_readiness: {
            acceptedSourceNames: [
              "espn_site_api_market_odds",
              "historical_market_odds_import",
            ],
            requiredGames: 240,
            trustedSnapshotSourceGames: 240,
            trustedSnapshotSourceCoveragePct: 1,
            trustedSnapshotSourceNames: ["historical_market_odds_import"],
            trustedImportBatchIds: ["market-import-2026-06-15"],
          },
        },
      },
      persistedOverallMetric,
      persistedMonitoredSegmentKeys,
    });

    expect(blocked.promote).toBe(false);
    expect(blocked.reasons).toEqual(
      expect.arrayContaining([
        "Market feature promotion requires trusted row-level odds snapshot source provenance for every evaluated game.",
      ]),
    );
    expect(blockedWithoutSourceNames.promote).toBe(false);
    expect(blockedWithoutSourceNames.reasons).toEqual(
      expect.arrayContaining([
        "Market feature promotion requires trusted row-level odds snapshot source provenance for every evaluated game.",
      ]),
    );
    expect(eligible).toEqual({ promote: true, reasons: [] });
  });

  it("requires persisted overall metric evidence to match the promotion window", () => {
    const modelVersion = {
      status: "candidate",
      validation_start_date: "2026-01-01",
      validation_end_date: "2026-04-01",
      validation_metrics: {
        summary: {
          evaluatedGames: 240,
        },
      },
      metadata: {
        promotion_status: "eligible_for_manual_promotion",
        promotion_decision: {
          promote: true,
        },
      },
      source_audit_metadata: {
        uses_market_features: false,
        public_explanation_ready: true,
        explanation_blockers: [],
        segment_regression_count: 0,
      },
    };

    expect(
      evaluatePersistedModelVersionPromotionGate({
        modelVersion,
        persistedOverallMetric: {
          segment_key: "season_phase",
          segment_value: "late",
          evaluation_start_date: "2026-01-02",
          evaluation_end_date: "2026-04-01",
          evaluated_games: 200,
          log_loss: null,
          brier_score: 0.22,
          accuracy: 0.56,
        },
        persistedMonitoredSegmentKeys: ["season_phase"],
      }).reasons,
    ).toEqual(
      expect.arrayContaining([
        "Persisted promotion metric row must be the overall/all segment.",
        "Persisted overall metric window must match validation window.",
        "Persisted overall metric row does not match promotion evaluated-game count.",
        "Persisted overall metric row must include log loss and Brier score.",
        "Persisted monitored segment metric rows are required before promotion: goalie_confirmation_state, has_stale_source, market_edge_bucket.",
      ]),
    );
  });

  it("guards serving writes behind production model-version status", () => {
    const currentBaseline = {
      modelName: BASELINE_MODEL_NAME,
      modelVersion: BASELINE_MODEL_VERSION,
      featureSetVersion: GAME_PREDICTION_FEATURE_SET_VERSION,
    };

    expect(canBootstrapCurrentCompiledBaseline(currentBaseline)).toBe(true);
    expect(servingModelVersionPersistenceAction(currentBaseline)).toBe(
      "bootstrap_current_compiled_baseline",
    );
    expect(
      servingModelVersionPersistenceAction({
        modelName: "nhl_game_baseline_logistic",
        modelVersion: "candidate-v2",
        featureSetVersion: "game_features_candidate",
        existingStatus: "production",
      }),
    ).toBe("use_existing_production");
    expect(() =>
      servingModelVersionPersistenceAction({
        modelName: "nhl_game_baseline_logistic",
        modelVersion: "candidate-v2",
        featureSetVersion: "game_features_candidate",
        existingStatus: "rejected",
      }),
    ).toThrow(/non-production model version/);
    expect(() =>
      servingModelVersionPersistenceAction({
        modelName: "nhl_game_baseline_logistic",
        modelVersion: "candidate-v2",
        featureSetVersion: "game_features_candidate",
        existingStatus: null,
      }),
    ).toThrow(/Promote the model version before serving predictions/);
  });

  it("reports workflow health warnings", () => {
    expect(
      buildPredictionHealthChecks({
        staleSourceCount: 0,
        missingPredictionCount: 0,
        failedJobCount: 0,
        staleModelAgeDays: 2,
        recentLogLoss: 0.66,
        referenceLogLoss: 0.65,
      })
    ).toEqual([{ status: "pass", code: "healthy", message: "No prediction workflow health warnings detected." }]);

    const checks = buildPredictionHealthChecks({
      staleSourceCount: 1,
      missingPredictionCount: 2,
      failedJobCount: 1,
      staleModelAgeDays: 21,
      recentLogLoss: 0.69,
      referenceLogLoss: 0.65,
    });

    expect(checks.map((check) => check.code)).toEqual([
      "stale_sources",
      "missing_predictions",
      "failed_jobs",
      "stale_model",
      "metric_degradation",
    ]);
  });
});
