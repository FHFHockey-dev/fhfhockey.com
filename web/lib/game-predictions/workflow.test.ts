import { describe, expect, it, vi } from "vitest";

import {
  PREGAME_PREDICTION_REFRESH_POLICY,
  REQUIRED_PROMOTION_MONITORED_SEGMENT_KEYS,
  buildPredictionHealthChecks,
  buildWalkForwardSplits,
  canBootstrapCurrentCompiledBaseline,
  decidePromotion,
  evaluatePersistedModelVersionPromotionGate,
  generatePregamePredictionsForWindow,
  historicalPregamePredictionCutoffAt,
  isPregamePredictionCutoff,
  previewGamePredictionModelVersionPromotion,
  servingModelVersionPersistenceAction,
  sourceAsOfDateForPredictionCutoff,
} from "./workflow";
import {
  BASELINE_MODEL_NAME,
  BASELINE_MODEL_VERSION,
} from "./baselineModel";
import { GAME_PREDICTION_FEATURE_SET_VERSION } from "./featureSources";

function eligiblePromotionMetadata(overrides?: Record<string, unknown>) {
  return {
    promotion_status: "eligible_for_manual_promotion",
    promotion_decision: {
      promote: true,
    },
    validation_window: {
      start_date: "2026-01-01",
      end_date: "2026-04-01",
      evaluated_games: 240,
    },
    promotion_evidence: {
      current: {
        logLoss: 0.66,
        brierScore: 0.23,
        calibrationMaxGap: 0.04,
        evaluatedGames: 240,
      },
      candidate: {
        logLoss: 0.64,
        brierScore: 0.21,
        calibrationMaxGap: 0.03,
        evaluatedGames: 240,
      },
      simpleBaselineFloor: {
        key: "goal_differential",
        label: "Goal differential baseline",
        logLoss: 0.65,
        brierScore: 0.22,
        calibrationMaxGap: null,
        evaluatedGames: 240,
        accuracy: 0.56,
      },
    },
    baseline_floor: {
      key: "goal_differential",
      label: "Goal differential baseline",
      logLoss: 0.65,
      brierScore: 0.22,
      calibrationMaxGap: null,
      evaluatedGames: 240,
      accuracy: 0.56,
    },
    excluded_feature_keys: [],
    ...overrides,
  };
}

function queryBuilder(result: unknown, terminal: "maybeSingle" | "limit") {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    limit: vi.fn(() =>
      terminal === "limit" ? Promise.resolve(result) : builder,
    ),
    maybeSingle: vi.fn(() =>
      terminal === "maybeSingle" ? Promise.resolve(result) : builder,
    ),
  };
  return builder;
}

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
    expect(
      historicalPregamePredictionCutoffAt(
        {
          date: "2026-01-10",
          startTime: "19:00:00",
        },
        2,
      ),
    ).toBe("2026-01-10T17:00:00.000Z");
  });

  it("rejects pregame prediction cutoffs at or after puck drop", () => {
    expect(
      isPregamePredictionCutoff({
        game: { date: "2026-01-10", startTime: "2026-01-10T23:00:00.000Z" },
        predictionCutoffAt: "2026-01-10T22:59:59.000Z",
      }),
    ).toBe(true);
    expect(
      isPregamePredictionCutoff({
        game: { date: "2026-01-10", startTime: "2026-01-10T23:00:00.000Z" },
        predictionCutoffAt: "2026-01-10T23:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      isPregamePredictionCutoff({
        game: { date: "2026-01-10", startTime: "19:00:00" },
        predictionCutoffAt: "2026-01-10T20:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      isPregamePredictionCutoff({
        game: { date: "2026-01-10", startTime: "19:00:00" },
        predictionCutoffAt: "2026-01-10T18:59:59.000Z",
      }),
    ).toBe(true);
  });

  it("skips post-start games in forecast windows without aborting the run", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          date: "2026-01-10",
          startTime: "19:00:00",
          seasonId: 20252026,
          homeTeamId: 10,
          awayTeamId: 20,
          type: 2,
        },
      ],
      error: null,
    });
    const secondOrder = vi.fn(() => ({ limit }));
    const firstOrder = vi.fn(() => ({ order: secondOrder }));
    const lte = vi.fn(() => ({ order: firstOrder }));
    const gte = vi.fn(() => ({ lte }));
    const select = vi.fn(() => ({ gte }));
    const from = vi.fn(() => ({ select }));

    const result = await generatePregamePredictionsForWindow({
      client: { from } as any,
      fromDate: "2026-01-10",
      toDate: "2026-01-10",
      predictionCutoffAt: "2026-01-10T20:00:00.000Z",
      dryRun: true,
    });

    expect(result).toMatchObject({
      requestedGames: 1,
      processedGames: 0,
      skippedGames: 1,
      dryRun: true,
      results: [
        {
          gameId: 1,
          homeWinProbability: null,
          awayWinProbability: null,
          skippedReason: "prediction_cutoff_at_or_after_puck_drop",
        },
      ],
    });
    expect(from).toHaveBeenCalledTimes(1);
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
          metadata: eligiblePromotionMetadata(),
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
        "Promotion evidence metadata must include a validation window matching the model version.",
        "Promotion evidence metadata is required before promotion.",
        "Promotion evidence metadata must include excluded feature keys.",
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
      metadata: eligiblePromotionMetadata(),
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

  it("requires persisted promotion evidence metadata before manual promotion", () => {
    const result = evaluatePersistedModelVersionPromotionGate({
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
          validation_window: {
            start_date: "2026-01-01",
            end_date: "2026-04-01",
            evaluated_games: 240,
          },
          promotion_evidence: {
            current: {
              logLoss: 0.66,
              brierScore: 0.23,
              evaluatedGames: 240,
            },
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
    });

    expect(result.promote).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "Promotion evidence metadata must include current and candidate probability metrics.",
        "Promotion evidence metadata must include strongest simple-baseline comparison metadata.",
        "Promotion evidence metadata must include excluded feature keys.",
      ]),
    );
  });

  it("previews persisted promotion gates without mutating model rows", async () => {
    const modelQuery = queryBuilder(
      {
        data: {
          model_name: "nhl_game_baseline_logistic",
          model_version: "candidate-v1",
          feature_set_version: "game_features_v5_accuracy_candidates",
          status: "candidate",
          validation_start_date: "2026-01-01",
          validation_end_date: "2026-04-01",
          validation_metrics: {
            summary: {
              evaluatedGames: 240,
            },
          },
          metadata: eligiblePromotionMetadata(),
          source_audit_metadata: {
            uses_market_features: false,
            public_explanation_ready: true,
            explanation_blockers: [],
            segment_regression_count: 0,
          },
        },
        error: null,
      },
      "maybeSingle",
    );
    const metricQuery = queryBuilder(
      {
        data: {
          segment_key: "overall",
          segment_value: "all",
          evaluation_start_date: "2026-01-01",
          evaluation_end_date: "2026-04-01",
          evaluated_games: 240,
          log_loss: 0.64,
          brier_score: 0.21,
          accuracy: 0.58,
        },
        error: null,
      },
      "maybeSingle",
    );
    const segmentQuery = queryBuilder(
      {
        data: REQUIRED_PROMOTION_MONITORED_SEGMENT_KEYS.map((segment_key) => ({
          segment_key,
        })),
        error: null,
      },
      "limit",
    );
    const metricQueries = [metricQuery, segmentQuery];
    const from = vi.fn((table: string) => {
      if (table === "game_prediction_model_versions") return modelQuery;
      if (table === "game_prediction_model_metrics") {
        return metricQueries.shift();
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await previewGamePredictionModelVersionPromotion({
      client: { from } as any,
      modelName: "nhl_game_baseline_logistic",
      modelVersion: "candidate-v1",
      featureSetVersion: "game_features_v5_accuracy_candidates",
      minEvaluatedGames: 150,
    });

    expect(result).toEqual({
      wouldPromote: true,
      reasons: [],
      modelName: "nhl_game_baseline_logistic",
      modelVersion: "candidate-v1",
      featureSetVersion: "game_features_v5_accuracy_candidates",
      persistedEvidenceChecked: true,
    });
    expect(from).toHaveBeenCalledTimes(3);
    expect(modelQuery).not.toHaveProperty("update");
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
      metadata: eligiblePromotionMetadata(),
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
    expect(() =>
      servingModelVersionPersistenceAction(currentBaseline),
    ).toThrow(/Promote the model version before serving predictions/);
    expect(
      servingModelVersionPersistenceAction({
        ...currentBaseline,
        allowBaselineBootstrap: true,
      }),
    ).toBe("bootstrap_current_compiled_baseline");
    expect(
      servingModelVersionPersistenceAction({
        ...currentBaseline,
        existingStatus: "production",
      }),
    ).toBe(
      "use_existing_production",
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
