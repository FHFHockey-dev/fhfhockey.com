import { describe, expect, it } from "vitest";

import {
  buildAccuracyLoopNextActions,
  formatAccuracyLoopVariantKeys,
  parseAccuracyLoopArgs,
  summarizeAccuracyLoopResult,
  validateAccuracyLoopOptions,
} from "./run-game-prediction-accuracy-loop";

describe("game prediction accuracy loop script", () => {
  it("parses bounded dry-run options", () => {
    const options = parseAccuracyLoopArgs([
      "--season-id",
      "20252026",
      "--game-type=2",
      "--blind-date",
      "2026-01-15",
      "--replay-end-date=2026-02-15",
      "--horizon-days",
      "0,1,1",
      "--max-signal-games",
      "80",
      "--max-training-games",
      "60",
      "--max-replay-games",
      "12",
      "--max-simulation-days",
      "25",
      "--retrain-cadence-games",
      "10",
      "--variants",
      "v4_default,long_window_form_candidate",
    ]);

    expect(options).toEqual({
      seasonId: 20252026,
      gameType: 2,
      blindDate: "2026-01-15",
      replayEndDate: "2026-02-15",
      horizonDays: [0, 1],
      maxSignalGames: 80,
      maxTrainingGames: 60,
      maxReplayGames: 12,
      maxSimulationDays: 25,
      retrainCadenceGames: 10,
      variantKeys: ["v4_default", "long_window_form_candidate"],
      persistEvidence: false,
      confirmPersist: false,
      help: false,
    });
    expect(() => validateAccuracyLoopOptions(options)).not.toThrow();
  });

  it("requires explicit confirmation before persisting promotion evidence", () => {
    const options = parseAccuracyLoopArgs([
      "--season-id=20252026",
      "--persist-evidence",
    ]);

    expect(() => validateAccuracyLoopOptions(options)).toThrow(
      "Refusing to persist accuracy-loop evidence without --confirm-persist.",
    );
    expect(() =>
      validateAccuracyLoopOptions({
        ...options,
        confirmPersist: true,
      }),
    ).not.toThrow();
  });

  it("requires a season id and rejects unknown variants", () => {
    expect(() =>
      validateAccuracyLoopOptions(parseAccuracyLoopArgs(["--blind-date=2026-01-15"])),
    ).toThrow("--season-id is required.");

    expect(() =>
      validateAccuracyLoopOptions(
        parseAccuracyLoopArgs([
          "--season-id=20252026",
          "--variants=v4_default,unknown_candidate",
        ]),
      ),
    ).toThrow(
      `Unknown variant key(s): unknown_candidate. Known variant keys: ${formatAccuracyLoopVariantKeys()}.`,
    );
  });

  it("summarizes loop results without dumping full backtest payloads", () => {
    const result = {
      generatedAt: "2026-06-15T12:00:00.000Z",
      seasonId: 20252026,
      gameType: 2,
      featureSetVersion: "game_features_v5_accuracy_candidates",
      dryRun: true,
      sourceReadiness: {
        marketOdds: {
          requiredGames: 12,
          snapshotGames: 0,
          trustedSnapshotSourceGames: 0,
          trainingFeatureEligible: false,
          warnings: ["market_odds_snapshots_missing_or_after_prediction_cutoff"],
        },
      },
      signalAnalysis: {
        analyzedGames: 80,
        analysisStartDate: "2026-02-26",
        analysisEndDate: "2026-03-08",
        analysis: {
          signals: [
            {
              featureKey: "homeMinusAwayRecent40ShotShare",
              rank: 1,
              mutualInformationScore: 0.04,
              absoluteCorrelation: 0.15,
              multivariateLogisticWeight: 0.39,
            },
          ],
          leakageChecks: [
            {
              featureKey: "homeMarketNoVigProbability",
              status: "blocked_by_default",
            },
          ],
        },
      },
      ablations: {
        promotionEvidencePersisted: false,
        variants: [
          {
            key: "v4_default",
            recommendation: "review",
            modelFamily: "logistic",
            calibrationMethod: "raw",
            summary: {
              evaluatedGames: 12,
              accuracy: 0.58,
              brierScore: 0.25,
              logLoss: 0.69,
            },
            deltaVsBaseline: {
              accuracy: 0,
              brierScore: 0,
              logLoss: 0,
            },
            excludedFeatureKeys: [],
          },
        ],
        promotionEvidence: [
          {
            candidateKey: "long_window_form_candidate",
            usesMarketFeatures: false,
            marketSourceTrainingEligible: false,
            marketFeatureTrainingEligible: false,
            marketFeatureSuppressedBySourceReadiness: true,
            publicExplanationReady: true,
            segmentRegressionCount: 0,
            decision: {
              promote: false,
              reasons: ["Candidate evaluated games below minimum 100."],
            },
          },
        ],
      },
    } as any;
    const summary = summarizeAccuracyLoopResult(result, {
      seasonId: 20252026,
      gameType: 2,
      blindDate: "2026-01-15",
      replayEndDate: "2026-02-15",
      horizonDays: [0, 1],
      maxTrainingGames: 60,
      maxReplayGames: 12,
    });

    expect(summary).toMatchObject({
      evidencePersisted: false,
      sourceReadiness: {
        marketOdds: {
          trainingFeatureEligible: false,
        },
      },
      signalAnalysis: {
        analyzedGames: 80,
        blockedFeatureKeys: ["homeMarketNoVigProbability"],
      },
      variants: [
        {
          key: "v4_default",
          evaluatedGames: 12,
          logLoss: 0.69,
        },
      ],
      promotionEvidence: [
        {
          candidateKey: "long_window_form_candidate",
          marketFeatureSuppressedBySourceReadiness: true,
        },
      ],
      nextActions: {
        marketOddsBackfill: {
          requiredGames: 12,
          trustedSnapshotSourceGames: 0,
          printExpectedGamesCommand:
            "npm run import:historical-market-odds -- --print-expected-games --season-id 20252026 --game-type 2 --blind-date 2026-01-15 --replay-end-date 2026-02-15 --horizon-days 0,1 --max-training-games 60 --max-replay-games 12",
        },
      },
    });
  });

  it("omits market backfill guidance when odds are training eligible", () => {
    expect(
      buildAccuracyLoopNextActions({
        result: {
          sourceReadiness: {
            marketOdds: {
              requiredGames: 12,
              snapshotGames: 12,
              trustedSnapshotSourceGames: 12,
              trainingFeatureEligible: true,
              warnings: [],
            },
          },
        } as any,
        options: { seasonId: 20252026 },
      }),
    ).toEqual({
      marketOddsBackfill: null,
    });
  });
});
