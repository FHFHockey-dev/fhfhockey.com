import { describe, expect, it } from "vitest";

import {
  hasGamePredictionHealthAlerts,
  parseGamePredictionHealthArgs,
  summarizeGamePredictionHealthReport,
  validateGamePredictionHealthOptions,
} from "./check-game-prediction-health";

describe("game prediction health check script", () => {
  it("parses report options without enabling failure by default", () => {
    const options = parseGamePredictionHealthArgs([
      "--from-date",
      "2026-06-15",
      "--to-date=2026-06-22",
      "--output",
      "json",
    ]);

    expect(options).toEqual({
      fromDate: "2026-06-15",
      toDate: "2026-06-22",
      failOnAlerts: false,
      output: "json",
      help: false,
    });
    expect(() => validateGamePredictionHealthOptions(options)).not.toThrow();
  });

  it("supports explicit alert failure and validates date flags", () => {
    const options = parseGamePredictionHealthArgs([
      "--from-date=2026/06/15",
      "--fail-on-alerts",
    ]);

    expect(options.failOnAlerts).toBe(true);
    expect(() => validateGamePredictionHealthOptions(options)).toThrow(
      "--from-date and --to-date must use YYYY-MM-DD.",
    );
    expect(() =>
      validateGamePredictionHealthOptions(parseGamePredictionHealthArgs(["--help"])),
    ).not.toThrow();
    expect(() =>
      parseGamePredictionHealthArgs(["--output=verbose"]),
    ).toThrow("--output must be summary or json.");
  });

  it("summarizes monitoring state without dumping full row payloads", () => {
    const report = {
      generatedAt: "2026-06-15T12:00:00.000Z",
      productionModel: {
        modelName: "nhl_game_baseline_logistic",
        modelVersion: "candidate-v1",
        featureSetVersion: "game_features_v5_accuracy_candidates",
        status: "production",
        trainedAt: "2026-06-01T00:00:00.000Z",
        promotedAt: "2026-06-10T00:00:00.000Z",
        updatedAt: "2026-06-10T00:00:00.000Z",
        ageDays: 5,
        promotionAudit: {
          promotionStatus: "eligible_for_manual_promotion",
          decisionPromote: true,
          evaluatedGames: 180,
          validationStartDate: "2025-12-01",
          validationEndDate: "2026-04-20",
          usesMarketFeatures: true,
          marketFeatureTrainingEligible: false,
          marketTrustedSnapshotSourceGames: 0,
          marketRequiredGames: 180,
          marketTrustedSnapshotSourceCoveragePct: 0,
          marketAcceptedSourceNames: ["historical_market_odds_import"],
          marketTrustedSnapshotSourceNames: [],
          marketTrustedImportBatchIds: [],
          publicExplanationReady: false,
          explanationBlockers: ["market_odds_not_training_eligible"],
          segmentRegressionCount: 0,
        },
      },
      latestMetric: {
        evaluatedGames: 180,
        accuracy: 0.58,
        logLoss: 0.66,
        brierScore: 0.22,
        evaluationStartDate: "2025-12-01",
        evaluationEndDate: "2026-04-20",
        computedAt: "2026-06-15T11:00:00.000Z",
      },
      predictionCoverage: {
        scheduledGames: 3,
        predictedGames: 2,
        missingPredictionCount: 1,
        missingGameIds: [123],
      },
      dataFreshness: {
        auditedSources: 8,
        staleSourceCount: 1,
        nullExpiryCount: 0,
        staleSources: [],
      },
      sourceAuditStatuses: [],
      jobs: {
        monitoredJobNames: ["game-predictions-accuracy-loop"],
        failedJobCount: 1,
        failedJobs: [
          {
            jobName: "game-predictions-accuracy-loop",
            runTime: "2026-06-15T09:00:00.000Z",
            details: { error: "failed" },
          },
        ],
      },
      featureQuality: {
        recentSnapshotCount: 100,
        missingFeatureRate: 0.02,
        goalieWarningCount: 1,
      },
      marketOddsReadiness: {
        requiredGames: 180,
        snapshotGames: 0,
        preCutoffEligibleGames: 0,
        trustedSnapshotSourceGames: 0,
        provenanceGames: 0,
        freshProvenanceGames: 0,
        rejectedProvenanceGames: 0,
        snapshotCoveragePct: 0,
        preCutoffEligibleCoveragePct: 0,
        trustedSnapshotSourceCoveragePct: 0,
        provenanceCoveragePct: 0,
        freshProvenanceCoveragePct: 0,
        rejectedProvenanceCoveragePct: 0,
        trainingFeatureEligible: false,
        warnings: ["market_odds_snapshots_missing_or_after_prediction_cutoff"],
      },
      segmentPerformance: {
        monitoredSegmentKeys: [
          "season_phase",
          "goalie_confirmation_state",
          "has_stale_source",
          "market_edge_bucket",
        ],
        missingSegmentKeys: ["market_edge_bucket"],
        windowMismatches: [
          {
            segmentKey: "season_phase",
            segmentValue: "early",
            evaluationStartDate: "2025-10-01",
            evaluationEndDate: "2025-12-31",
            expectedEvaluationStartDate: "2025-12-01",
            expectedEvaluationEndDate: "2026-04-20",
            computedAt: "2026-06-15T09:00:00.000Z",
          },
        ],
        segments: [],
      },
      alerts: [
        {
          status: "warn",
          code: "production_promotion_evidence_incomplete",
          message: "Promotion evidence is incomplete.",
        },
      ],
    } as any;

    expect(hasGamePredictionHealthAlerts(report)).toBe(true);
    expect(summarizeGamePredictionHealthReport(report)).toMatchObject({
      productionModel: {
        modelVersion: "candidate-v1",
        featureSetVersion: "game_features_v5_accuracy_candidates",
      },
      predictionCoverage: {
        missingPredictionCount: 1,
      },
      jobs: {
        failedJobNames: ["game-predictions-accuracy-loop"],
      },
      marketOddsReadiness: {
        requiredGames: 180,
        trustedSnapshotSourceGames: 0,
        trainingFeatureEligible: false,
      },
      segmentPerformance: {
        missingSegmentKeys: ["market_edge_bucket"],
        windowMismatchCount: 1,
      },
      promotionAudit: {
        usesMarketFeatures: true,
        marketFeatureTrainingEligible: false,
        publicExplanationReady: false,
      },
      alertCount: 1,
      alerts: [
        {
          code: "production_promotion_evidence_incomplete",
        },
      ],
    });
  });

  it("does not treat the healthy pass check as an alert", () => {
    expect(
      hasGamePredictionHealthAlerts({
        alerts: [
          {
            status: "pass",
            code: "healthy",
            message: "No warnings.",
          },
        ],
      } as any),
    ).toBe(false);
  });
});
