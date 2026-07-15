import { describe, expect, it } from "vitest";

import {
  buildAccountabilityDailySeries,
  buildAccountabilitySummary,
  buildBacktestBaselineComparisons,
  buildBacktestPhaseSummaries,
  buildFeatureSignalSegmentAnalyses,
  buildMarketOddsSourceReadiness,
  buildBacktestPromotionEvidence,
  buildAblationPromotionEvidenceMetricRows,
  buildAblationPromotionEvidenceModelVersionRows,
  buildBacktestMonitoredSegmentSummaries,
  buildConfidenceCalibrationBuckets,
  buildPredictionCandlestick,
  BACKTEST_SEASON_RECENCY_WEIGHT_VERSION,
  calibrationMaxGapFromBuckets,
  DEFAULT_BACKTEST_ABLATION_VARIANTS,
  SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT,
  applyMarketFeatureTrainingGuardrailToVariants,
  compactMarketOddsSourceReadinessForMetadata,
  persistedFeatureSnapshotRowToPayload,
  selectAccuracyImprovementAblationVariants,
  selectAccuracyLoopSourceReadinessGames,
  selectWalkForwardBacktestGameWindows,
  syntheticBacktestPredictionCutoffAt,
  trainingSeasonRecencyWeight,
  type AccountabilityGameRow,
  type AccountabilityPredictionRow,
  type BacktestAblationVariant,
  type BacktestAblationComparison,
  type PredictionCandlestick,
} from "./accountability";
import { BASELINE_FEATURE_KEYS } from "./baselineModel";

describe("training season recency weighting", () => {
  it("uses the approved current/prior-season decay schedule", () => {
    expect(BACKTEST_SEASON_RECENCY_WEIGHT_VERSION).toContain("current_1");
    expect(trainingSeasonRecencyWeight(20252026, 20252026)).toBe(1);
    expect(trainingSeasonRecencyWeight(20252026, 20242025)).toBe(0.65);
    expect(trainingSeasonRecencyWeight(20252026, 20232024)).toBe(0.35);
    expect(trainingSeasonRecencyWeight(20252026, 20222023)).toBe(0.2);
    expect(trainingSeasonRecencyWeight(20252026, 20212022)).toBe(0.2);
  });
});

describe("feature signal season segments", () => {
  it("reports each available phase independently and preserves empty phases", () => {
    const example = (gameId: number, label: 0 | 1, edge: number) => ({
      gameId,
      featureSnapshotId: `snapshot-${gameId}`,
      featureKeys: BASELINE_FEATURE_KEYS,
      features: BASELINE_FEATURE_KEYS.map((_, index) =>
        index === 0 ? edge : 0,
      ),
      label,
    });
    const segments = buildFeatureSignalSegmentAnalyses([
      { phase: "early", example: example(1, 1, 2) },
      { phase: "early", example: example(2, 0, -1) },
      { phase: "middle", example: example(3, 1, 1) },
    ]);

    expect(segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "early",
          analyzedGames: 2,
          analysis: expect.objectContaining({ sampleSize: 2 }),
        }),
        expect.objectContaining({
          phase: "middle",
          analyzedGames: 1,
          analysis: expect.objectContaining({ sampleSize: 1 }),
        }),
        { phase: "late", analyzedGames: 0, analysis: null },
        { phase: "playoff", analyzedGames: 0, analysis: null },
      ]),
    );
  });
});

const teamsById = new Map([
  [1, { id: 1, abbreviation: "BOS", name: "Boston Bruins" }],
  [2, { id: 2, abbreviation: "BUF", name: "Buffalo Sabres" }],
]);

function prediction(
  overrides: Partial<AccountabilityPredictionRow>,
): AccountabilityPredictionRow {
  return {
    prediction_id: "prediction-1",
    game_id: 1,
    snapshot_date: "2026-01-10",
    prediction_cutoff_at: "2026-01-10T18:00:00.000Z",
    model_name: "nhl_game_baseline_logistic",
    model_version: "v1",
    feature_set_version: "game_features_v1",
    home_team_id: 2,
    away_team_id: 1,
    home_win_probability: 0.52,
    away_win_probability: 0.48,
    predicted_winner_team_id: 2,
    confidence_label: "low",
    metadata: {},
    computed_at: "2026-01-10T18:00:00.000Z",
    ...overrides,
  };
}

function candle(
  overrides: Partial<PredictionCandlestick>,
): PredictionCandlestick {
  return {
    gameId: 1,
    snapshotDate: "2026-01-10",
    startTime: "2026-01-10T23:00:00.000Z",
    homeTeamId: 2,
    awayTeamId: 1,
    homeTeamAbbreviation: "BUF",
    awayTeamAbbreviation: "BOS",
    openHomeWinProbability: 0.52,
    lowHomeWinProbability: 0.48,
    highHomeWinProbability: 0.57,
    finalHomeWinProbability: 0.54,
    actualHomeWinProbability: 1,
    probabilitySpread: 0.09,
    predictionCount: 3,
    finalPredictionId: "prediction-3",
    finalPredictionCutoffAt: "2026-01-10T22:00:00.000Z",
    predictedWinnerTeamId: 2,
    actualWinnerTeamId: 2,
    predictedWinnerCorrect: true,
    homeScore: 4,
    awayScore: 2,
    ...overrides,
  };
}

function ablationComparison(
  overrides: Partial<BacktestAblationComparison>,
): BacktestAblationComparison {
  return {
    key: "candidate",
    label: "Candidate",
    modelVersion: "candidate-v1",
    excludedFeatureKeys: [],
    disableDataQualityDampening: false,
    winnerDecisionThreshold: 0.52,
    modelFamily: "logistic",
    calibrationMethod: "raw",
    probabilityBlend: null,
    phaseSpecificTraining: false,
    minimumPhaseTrainingExamples: null,
    modelAuditMetadata: {},
    summary: {
      evaluatedGames: 100,
      correctGames: 58,
      wrongGames: 42,
      accuracy: 0.58,
      rolling10Accuracy: 0.6,
      rolling25Accuracy: 0.56,
      rolling50Accuracy: 0.58,
      brierScore: 0.22,
      logLoss: 0.65,
    },
    phaseSummaries: [
      {
        phase: "early",
        trainingExamples: 60,
        replayGames: 30,
        correctGames: 18,
        accuracy: 0.6,
        brierScore: 0.22,
        logLoss: 0.65,
        modelSource: "phase_specific",
      },
    ],
    monitoredSegmentSummaries: [],
    calibrationBuckets: [
      {
        label: "50-55%",
        minConfidence: 0.5,
        maxConfidence: 0.55,
        predictions: 40,
        correctGames: 22,
        accuracy: 0.55,
        averageConfidence: 0.54,
      },
    ],
    deltaVsBaseline: {
      accuracy: null,
      brierScore: null,
      logLoss: null,
    },
    recommendation: "review",
    ...overrides,
  };
}

describe("game prediction accountability", () => {
  it("reuses persisted feature snapshots only for the requested feature set and source date", () => {
    const payload = {
      featureSetVersion: "game_features_v5_accuracy_candidates",
      gameId: 1,
      sourceAsOfDate: "2026-01-10",
      gameDate: "2026-01-10",
    };
    const row = {
      feature_snapshot_id: "snapshot-1",
      game_id: 1,
      feature_set_version: "game_features_v5_accuracy_candidates",
      prediction_cutoff_at: "2026-01-10T16:00:00.000Z",
      feature_payload: payload,
      metadata: { source_as_of_date: "2026-01-10" },
      computed_at: "2026-01-10T16:01:00.000Z",
    } as any;

    expect(
      persistedFeatureSnapshotRowToPayload({
        row,
        featureSetVersion: "game_features_v5_accuracy_candidates",
        sourceAsOfDate: "2026-01-10",
      }),
    ).toBe(payload);
    expect(
      persistedFeatureSnapshotRowToPayload({
        row,
        featureSetVersion: "game_features_v4_roster_sos_context",
        sourceAsOfDate: "2026-01-10",
      }),
    ).toBeNull();
    expect(
      persistedFeatureSnapshotRowToPayload({
        row,
        featureSetVersion: "game_features_v5_accuracy_candidates",
        sourceAsOfDate: "2026-01-09",
      }),
    ).toBeNull();
  });

  it("builds candlesticks from repeated predictions and uses final pregame prediction", () => {
    const result = buildPredictionCandlestick({
      teamsById,
      game: {
        id: 1,
        date: "2026-01-10",
        startTime: "2026-01-10T23:00:00.000Z",
        seasonId: 20252026,
        homeTeamId: 2,
        awayTeamId: 1,
        type: 2,
      },
      outcome: {
        gameId: 1,
        homeTeamId: 2,
        awayTeamId: 1,
        homeScore: 4,
        awayScore: 2,
        homeWon: true,
      },
      predictions: [
        prediction({
          prediction_id: "prediction-1",
          prediction_cutoff_at: "2026-01-10T16:00:00.000Z",
          home_win_probability: 0.52,
          away_win_probability: 0.48,
        }),
        prediction({
          prediction_id: "prediction-2",
          prediction_cutoff_at: "2026-01-10T18:00:00.000Z",
          home_win_probability: 0.48,
          away_win_probability: 0.52,
          predicted_winner_team_id: 1,
        }),
        prediction({
          prediction_id: "prediction-3",
          prediction_cutoff_at: "2026-01-10T22:00:00.000Z",
          home_win_probability: 0.57,
          away_win_probability: 0.43,
        }),
      ],
    });

    expect(result).toMatchObject({
      openHomeWinProbability: 0.52,
      lowHomeWinProbability: 0.48,
      highHomeWinProbability: 0.57,
      finalHomeWinProbability: 0.57,
      actualHomeWinProbability: 1,
      probabilitySpread: 0.09,
      predictionCount: 3,
      finalPredictionId: "prediction-3",
      predictedWinnerCorrect: true,
      homeTeamAbbreviation: "BUF",
      awayTeamAbbreviation: "BOS",
    });
  });

  it("excludes at-or-after-start predictions when the game start time is time-only", () => {
    const result = buildPredictionCandlestick({
      teamsById,
      game: {
        id: 1,
        date: "2026-01-10",
        startTime: "19:00:00",
        seasonId: 20252026,
        homeTeamId: 2,
        awayTeamId: 1,
        type: 2,
      },
      outcome: {
        gameId: 1,
        homeTeamId: 2,
        awayTeamId: 1,
        homeScore: 4,
        awayScore: 2,
        homeWon: true,
      },
      predictions: [
        prediction({
          prediction_id: "prediction-1",
          prediction_cutoff_at: "2026-01-10T18:59:59.000Z",
          home_win_probability: 0.52,
          away_win_probability: 0.48,
        }),
        prediction({
          prediction_id: "prediction-2",
          prediction_cutoff_at: "2026-01-10T19:00:00.000Z",
          home_win_probability: 0.2,
          away_win_probability: 0.8,
          predicted_winner_team_id: 1,
        }),
        prediction({
          prediction_id: "prediction-3",
          prediction_cutoff_at: "2026-01-10T20:00:00.000Z",
          home_win_probability: 0.9,
          away_win_probability: 0.1,
        }),
      ],
    });

    expect(result).toMatchObject({
      predictionCount: 1,
      finalPredictionId: "prediction-1",
      finalPredictionCutoffAt: "2026-01-10T18:59:59.000Z",
      finalHomeWinProbability: 0.52,
    });

    expect(
      buildPredictionCandlestick({
        teamsById,
        game: {
          id: 1,
          date: "2026-01-10",
          startTime: "19:00:00",
          seasonId: 20252026,
          homeTeamId: 2,
          awayTeamId: 1,
          type: 2,
        },
        outcome: {
          gameId: 1,
          homeTeamId: 2,
          awayTeamId: 1,
          homeScore: 4,
          awayScore: 2,
          homeWon: true,
        },
        predictions: [
          prediction({
            prediction_cutoff_at: "2026-01-10T19:00:00.000Z",
          }),
        ],
      }),
    ).toBeNull();
  });

  it("summarizes cumulative and rolling accountability", () => {
    const candles = [
      candle({
        gameId: 1,
        snapshotDate: "2026-01-10",
        predictedWinnerCorrect: true,
      }),
      candle({
        gameId: 2,
        snapshotDate: "2026-01-11",
        predictedWinnerCorrect: false,
      }),
      candle({
        gameId: 3,
        snapshotDate: "2026-01-11",
        predictedWinnerCorrect: true,
      }),
    ];

    expect(buildAccountabilitySummary(candles)).toMatchObject({
      evaluatedGames: 3,
      correctGames: 2,
      wrongGames: 1,
      accuracy: 0.666667,
    });

    expect(buildAccountabilityDailySeries(candles)).toMatchObject([
      {
        asOfDate: "2026-01-10",
        evaluatedGames: 1,
        correctGames: 1,
        wrongGames: 0,
        cumulativeAccuracy: 1,
      },
      {
        asOfDate: "2026-01-11",
        evaluatedGames: 3,
        correctGames: 2,
        wrongGames: 1,
        cumulativeAccuracy: 0.666667,
      },
    ]);
  });

  it("builds simple baseline comparisons and confidence buckets", () => {
    const candles = [
      candle({
        gameId: 1,
        finalHomeWinProbability: 0.54,
        predictedWinnerCorrect: true,
        actualHomeWinProbability: 1,
      }),
      candle({
        gameId: 2,
        finalHomeWinProbability: 0.72,
        predictedWinnerCorrect: false,
        actualHomeWinProbability: 0,
      }),
      candle({
        gameId: 3,
        finalHomeWinProbability: 0.43,
        predictedWinnerCorrect: true,
        actualHomeWinProbability: 0,
      }),
    ];

    expect(buildBacktestBaselineComparisons({ candles })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "home_team_fixed_54",
          evaluatedGames: 3,
        }),
        expect.objectContaining({
          key: "team_power_composite",
          evaluatedGames: 3,
        }),
      ]),
    );

    expect(buildConfidenceCalibrationBuckets(candles)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "50-55%",
          predictions: 1,
          accuracy: 1,
        }),
        expect.objectContaining({
          label: "70-80%",
          predictions: 1,
          accuracy: 0,
        }),
      ]),
    );
  });

  it("summarizes replay metrics by season phase", () => {
    const candles = [
      candle({
        gameId: 1,
        finalHomeWinProbability: 0.54,
        predictedWinnerCorrect: true,
        actualHomeWinProbability: 1,
      }),
      candle({
        gameId: 2,
        finalHomeWinProbability: 0.61,
        predictedWinnerCorrect: false,
        actualHomeWinProbability: 0,
      }),
      candle({
        gameId: 3,
        finalHomeWinProbability: 0.43,
        predictedWinnerCorrect: true,
        actualHomeWinProbability: 0,
      }),
    ];
    const payloadsByGameId = new Map<number, any>([
      [1, { seasonPhase: { phase: "early" } }],
      [2, { seasonPhase: { phase: "early" } }],
      [3, { seasonPhase: { phase: "middle" } }],
    ]);

    expect(
      buildBacktestPhaseSummaries({
        candles,
        payloadsByGameId,
        phaseTrainingCounts: new Map([
          ["early", 42],
          ["middle", 65],
        ]),
        phaseModelSourceByGameId: new Map([
          [1, "phase_specific"],
          [2, "overall_fallback"],
          [3, "phase_specific"],
        ]),
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "early",
          trainingExamples: 42,
          replayGames: 2,
          correctGames: 1,
          accuracy: 0.5,
          modelSource: "mixed",
        }),
        expect.objectContaining({
          phase: "middle",
          trainingExamples: 65,
          replayGames: 1,
          correctGames: 1,
          accuracy: 1,
          modelSource: "phase_specific",
        }),
      ]),
    );
  });

  it("summarizes replay metrics by monitored prediction metadata segments", () => {
    const candles = [
      candle({
        gameId: 1,
        finalHomeWinProbability: 0.7,
        predictedWinnerCorrect: true,
        actualHomeWinProbability: 1,
      }),
      candle({
        gameId: 2,
        finalHomeWinProbability: 0.4,
        predictedWinnerCorrect: true,
        actualHomeWinProbability: 0,
      }),
      candle({
        gameId: 3,
        finalHomeWinProbability: 0.6,
        predictedWinnerCorrect: false,
        actualHomeWinProbability: 0,
      }),
    ];
    const summaries = buildBacktestMonitoredSegmentSummaries({
      candles,
      predictionMetadataByGameId: new Map([
        [
          1,
          {
            goalie_confirmation_state: "both_confirmed",
            has_stale_source: false,
            market_edge_bucket: "model_plus_5",
          },
        ],
        [
          2,
          {
            goalie_confirmation_state: "projected_or_fallback",
            has_stale_source: true,
            market_edge_bucket: "no_market",
          },
        ],
        [
          3,
          {
            goalie_confirmation_state: "both_confirmed",
            has_stale_source: false,
            market_edge_bucket: "model_plus_5",
          },
        ],
      ]),
    });

    expect(summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          segmentKey: "goalie_confirmation_state",
          segmentValue: "both_confirmed",
          replayGames: 2,
          correctGames: 1,
          accuracy: 0.5,
        }),
        expect.objectContaining({
          segmentKey: "has_stale_source",
          segmentValue: "true",
          replayGames: 1,
          correctGames: 1,
          accuracy: 1,
        }),
        expect.objectContaining({
          segmentKey: "market_edge_bucket",
          segmentValue: "model_plus_5",
          replayGames: 2,
          correctGames: 1,
          accuracy: 0.5,
        }),
      ]),
    );
  });

  it("registers phase-specific logistic as a dry-run ablation candidate", () => {
    expect(DEFAULT_BACKTEST_ABLATION_VARIANTS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "phase_specific_logistic_candidate",
          phaseSpecificTraining: true,
          featureVectorOptions: expect.objectContaining({
            excludedFeatureKeys: ["homeMarketNoVigProbability"],
          }),
        }),
      ]),
    );
  });

  it("selects the default dry-run accuracy-loop ablation set", () => {
    expect(selectAccuracyImprovementAblationVariants().map((variant) => variant.key))
      .toEqual([
        "v4_default",
        "long_window_form_candidate",
        "training_home_prior_blend_candidate",
        "platt_calibrated_logistic_candidate",
        "no_cross_season_prior_candidate",
        "phase_specific_logistic_candidate",
        "extra_trees_candidate",
        "platt_calibrated_extra_trees_candidate",
        "market_anchored_candidate",
      ]);
    expect(DEFAULT_BACKTEST_ABLATION_VARIANTS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "training_home_prior_blend_candidate",
          probabilityBlend: {
            method: "training_home_prior",
            modelWeight: 0.2,
          },
        }),
        expect.objectContaining({
          key: "goal_differential_anchor_blend_candidate",
          probabilityBlend: {
            method: "goal_differential_anchor",
            modelWeight: 0.5,
          },
        }),
        expect.objectContaining({
          key: "standings_point_pct_anchor_blend_candidate",
          probabilityBlend: {
            method: "standings_point_pct_anchor",
            modelWeight: 0.5,
          },
        }),
      ]),
    );
    expect(
      selectAccuracyImprovementAblationVariants([
        "market_anchored_candidate",
        "missing_variant",
      ]).map((variant) => variant.key),
    ).toEqual(["market_anchored_candidate"]);
  });

  it("audits market odds source readiness with strict pre-cutoff provenance", () => {
    const games: AccountabilityGameRow[] = [
      {
        id: 1,
        date: "2026-01-10",
        startTime: "2026-01-10T23:00:00.000Z",
        seasonId: 20252026,
        homeTeamId: 2,
        awayTeamId: 1,
        type: 2,
      },
      {
        id: 2,
        date: "2026-01-11",
        startTime: "2026-01-11T23:00:00.000Z",
        seasonId: 20252026,
        homeTeamId: 2,
        awayTeamId: 1,
        type: 2,
      },
      {
        id: 3,
        date: "2026-01-12",
        startTime: "2026-01-12T23:00:00.000Z",
        seasonId: 20252026,
        homeTeamId: 2,
        awayTeamId: 1,
        type: 2,
      },
    ];

    const readiness = buildMarketOddsSourceReadiness({
      games,
      oddsRows: [
        {
          game_id: 1,
          captured_at: "2026-01-10T15:00:00.000Z",
          event_start_at: "2026-01-10T23:00:00.000Z",
          provider: "ESPN BET",
          provenance: { source_name: "espn_site_api_market_odds" },
          metadata: {},
        },
        {
          game_id: 2,
          captured_at: "2026-01-11T17:00:00.000Z",
          event_start_at: "2026-01-11T23:00:00.000Z",
          provider: "ESPN BET",
          provenance: { import_source_name: "historical_market_odds_import" },
          metadata: {},
        },
        {
          game_id: 1,
          captured_at: "2026-01-10T14:30:00.000Z",
          event_start_at: "2026-01-10T23:00:00.000Z",
          provider: "DraftKings",
          provenance: {
            import_source_name: "historical_market_odds_import",
          },
          metadata: {},
        },
      ],
      provenanceRows: [
        {
          game_id: 1,
          source_type: "game_prediction_market_odds",
          source_name: "espn_site_api_market_odds",
          status: "observed",
          observed_at: "2026-01-10T15:00:00.000Z",
          freshness_expires_at: "2026-01-10T23:00:00.000Z",
        },
        {
          game_id: 1,
          source_type: "game_prediction_market_odds",
          source_name: "historical_market_odds_import",
          status: "observed",
          observed_at: "2026-01-10T14:30:00.000Z",
          freshness_expires_at: "2026-01-10T23:00:00.000Z",
          metadata: { importBatchId: "market-import-sidecar-2026-01-10" },
        },
        {
          game_id: 2,
          source_type: "game_prediction_market_odds",
          source_name: "historical_market_odds_import",
          status: "observed",
          observed_at: "2026-01-11T15:00:00.000Z",
          freshness_expires_at: "2026-01-11T15:30:00.000Z",
        },
        {
          game_id: 3,
          source_type: "game_prediction_market_odds",
          source_name: "espn_site_api_market_odds_rejected",
          status: "rejected",
          observed_at: "2026-01-12T23:05:00.000Z",
          freshness_expires_at: "2026-01-12T23:00:00.000Z",
        },
      ],
    });

    expect(readiness).toMatchObject({
      requiredGames: 3,
      acceptedSourceNames: [
        "espn_site_api_market_odds",
        "historical_market_odds_import",
      ],
      trustedSnapshotSourceNames: [
        "espn_site_api_market_odds",
        "historical_market_odds_import",
      ],
      trustedImportBatchIds: ["market-import-sidecar-2026-01-10"],
      snapshotGames: 2,
      preCutoffEligibleGames: 1,
      trustedSnapshotSourceGames: 1,
      provenanceGames: 2,
      freshProvenanceGames: 1,
      rejectedProvenanceGames: 1,
      snapshotCoveragePct: 0.666667,
      preCutoffEligibleCoveragePct: 0.333333,
      trustedSnapshotSourceCoveragePct: 0.333333,
      provenanceCoveragePct: 0.666667,
      freshProvenanceCoveragePct: 0.333333,
      rejectedProvenanceCoveragePct: 0.333333,
      trainingFeatureEligible: false,
      missingSnapshotGameIds: [3],
      missingPreCutoffEligibleGameIds: [2, 3],
      missingTrustedSnapshotSourceGameIds: [2, 3],
      missingProvenanceGameIds: [3],
      staleProvenanceGameIds: [2],
      rejectedProvenanceGameIds: [3],
    });
    expect(readiness.warnings).toEqual(
      expect.arrayContaining([
        "market_odds_snapshots_missing_or_after_prediction_cutoff",
        "market_odds_snapshot_source_provenance_missing_or_untrusted",
        "market_odds_source_provenance_missing",
        "market_odds_source_provenance_stale_before_cutoff",
        "market_odds_source_provenance_rejected",
      ]),
    );
  });

  it("rejects market odds readiness captured after a time-only puck drop", () => {
    const readiness = buildMarketOddsSourceReadiness({
      games: [
        {
          id: 1,
          date: "2026-01-10",
          startTime: "13:00:00",
          seasonId: 20252026,
          homeTeamId: 2,
          awayTeamId: 1,
          type: 2,
        },
      ],
      oddsRows: [
        {
          game_id: 1,
          captured_at: "2026-01-10T15:00:00.000Z",
          event_start_at: null,
          provider: "DraftKings",
          provenance: {
            import_source_name: "historical_market_odds_import",
            import_batch_id: "market-import-2026-01-10",
          },
          metadata: {},
        },
      ],
      provenanceRows: [
        {
          game_id: 1,
          source_type: "game_prediction_market_odds",
          source_name: "historical_market_odds_import",
          status: "observed",
          observed_at: "2026-01-10T15:00:00.000Z",
          freshness_expires_at: "2026-01-10T16:00:00.000Z",
        },
      ],
    });

    expect(readiness).toMatchObject({
      requiredGames: 1,
      snapshotGames: 1,
      preCutoffEligibleGames: 0,
      trustedSnapshotSourceGames: 0,
      provenanceGames: 0,
      freshProvenanceGames: 0,
      trainingFeatureEligible: false,
      missingPreCutoffEligibleGameIds: [1],
      missingTrustedSnapshotSourceGameIds: [1],
      missingProvenanceGameIds: [1],
    });
    expect(readiness.warnings).toEqual(
      expect.arrayContaining([
        "market_odds_snapshots_missing_or_after_prediction_cutoff",
        "market_odds_snapshot_source_provenance_missing_or_untrusted",
        "market_odds_source_provenance_missing",
      ]),
    );
  });

  it("scopes source readiness to capped training and replay windows", () => {
    const games: AccountabilityGameRow[] = Array.from(
      { length: 8 },
      (_, index) => {
        const day = String(index + 1).padStart(2, "0");
        return {
          id: index + 1,
          date: `2026-01-${day}`,
          startTime: `2026-01-${day}T23:00:00.000Z`,
          seasonId: 20252026,
          homeTeamId: 2,
          awayTeamId: 1,
          type: 2,
        };
      },
    );

    expect(
      selectAccuracyLoopSourceReadinessGames({
        games,
        trainStartDate: "2026-01-01",
        blindDate: "2026-01-05",
        replayEndDate: "2026-01-08",
        maxTrainingGames: 2,
        maxReplayGames: 2,
      }).map((game) => game.id),
    ).toEqual([4, 5, 6, 7]);

    expect(
      selectAccuracyLoopSourceReadinessGames({
        games,
        trainStartDate: "2026-01-01",
        blindDate: "2026-01-05",
        replayEndDate: "2026-01-08",
        horizonDays: [1],
        maxSimulationDays: 1,
        maxTrainingGames: 2,
        maxReplayGames: 3,
      }).map((game) => game.id),
    ).toEqual([4, 5, 6]);

    expect(
      selectAccuracyLoopSourceReadinessGames({
        games,
        trainStartDate: "2026-01-01",
        analysisEndDate: "2026-01-08",
        maxTrainingGames: 2,
        maxReplayGames: 1,
      }).map((game) => game.id),
    ).toEqual([3, 4, 5]);
  });

  it("scopes walk-forward ablation windows to analysis end date", () => {
    const games: AccountabilityGameRow[] = Array.from(
      { length: 8 },
      (_, index) => {
        const day = String(index + 1).padStart(2, "0");
        return {
          id: index + 1,
          date: `2026-01-${day}`,
          startTime: `2026-01-${day}T23:00:00.000Z`,
          seasonId: 20252026,
          homeTeamId: 2,
          awayTeamId: 1,
          type: 2,
        };
      },
    );

    const splitWindow = selectWalkForwardBacktestGameWindows({
      games,
      trainStartDate: "2026-01-02",
      analysisEndDate: "2026-01-06",
    });
    expect(splitWindow.trainingGames.map((game) => game.id)).toEqual([2, 3]);
    expect(splitWindow.replayGames.map((game) => game.id)).toEqual([4, 5, 6]);

    const blindWindow = selectWalkForwardBacktestGameWindows({
      games,
      trainStartDate: "2026-01-02",
      blindDate: "2026-01-04",
      analysisEndDate: "2026-01-06",
      maxTrainingGames: 2,
      maxReplayGames: 1,
    });
    expect(blindWindow.trainingGames.map((game) => game.id)).toEqual([3, 4]);
    expect(blindWindow.replayGames.map((game) => game.id)).toEqual([5]);

    const replayEndOverride = selectWalkForwardBacktestGameWindows({
      games,
      trainStartDate: "2026-01-02",
      blindDate: "2026-01-04",
      analysisEndDate: "2026-01-06",
      replayEndDate: "2026-01-07",
    });
    expect(replayEndOverride.replayGames.map((game) => game.id)).toEqual([
      5,
      6,
      7,
    ]);
  });

  it("keeps prior-season games in training while holding the target season blind", () => {
    const games: AccountabilityGameRow[] = [
      { id: 1, date: "2024-04-01", startTime: "2024-04-01T23:00:00Z", seasonId: 20232024, homeTeamId: 1, awayTeamId: 2, type: 2 },
      { id: 2, date: "2025-04-01", startTime: "2025-04-01T23:00:00Z", seasonId: 20242025, homeTeamId: 2, awayTeamId: 1, type: 2 },
      { id: 3, date: "2025-10-10", startTime: "2025-10-10T23:00:00Z", seasonId: 20252026, homeTeamId: 1, awayTeamId: 2, type: 2 },
      { id: 4, date: "2025-10-12", startTime: "2025-10-12T23:00:00Z", seasonId: 20252026, homeTeamId: 2, awayTeamId: 1, type: 2 },
    ];

    const window = selectWalkForwardBacktestGameWindows({
      games,
      trainStartDate: "2024-01-01",
      blindDate: "2025-10-01",
      replayEndDate: "2025-10-31",
    });

    expect(window.trainingGames.map((game) => game.seasonId)).toEqual([
      20232024, 20242025,
    ]);
    expect(window.replayGames.map((game) => game.seasonId)).toEqual([
      20252026, 20252026,
    ]);
  });

  it("uses strict pregame cutoffs for same-day synthetic backtests", () => {
    expect(
      syntheticBacktestPredictionCutoffAt({
        game: {
          date: "2026-01-10",
          startTime: "19:00:00",
        },
        simulationDate: "2026-01-10",
        horizonDays: 0,
      }),
    ).toBe("2026-01-10T18:00:00.000Z");

    expect(
      syntheticBacktestPredictionCutoffAt({
        game: {
          date: "2026-01-10",
          startTime: "2026-01-10T23:00:00.000Z",
        },
        simulationDate: "2026-01-10",
        horizonDays: 0,
      }),
    ).toBe("2026-01-10T22:00:00.000Z");

    expect(
      syntheticBacktestPredictionCutoffAt({
        game: {
          date: "2026-01-10",
          startTime: "19:00:00",
        },
        simulationDate: "2026-01-09",
        horizonDays: 1,
      }),
    ).toBe("2026-01-09T16:00:00.000Z");
  });

  it("builds promotion evidence with calibration, market, and segment guardrails", () => {
    expect(
      calibrationMaxGapFromBuckets([
        {
          label: "50-55%",
          minConfidence: 0.5,
          maxConfidence: 0.55,
          predictions: 10,
          correctGames: 7,
          accuracy: 0.7,
          averageConfidence: 0.55,
        },
      ]),
    ).toBe(0.15);

    const baseline = ablationComparison({
      key: "v4_default",
      summary: {
        evaluatedGames: 100,
        correctGames: 55,
        wrongGames: 45,
        accuracy: 0.55,
        rolling10Accuracy: 0.5,
        rolling25Accuracy: 0.52,
        rolling50Accuracy: 0.54,
        brierScore: 0.23,
        logLoss: 0.66,
      },
      phaseSummaries: [
        {
          phase: "early",
          trainingExamples: 60,
          replayGames: 30,
          correctGames: 17,
          accuracy: 0.566667,
          brierScore: 0.23,
          logLoss: 0.66,
          modelSource: "overall_fallback",
        },
      ],
    });
    const candidate = ablationComparison({
      key: "market_anchored_candidate",
      phaseSummaries: [
        {
          phase: "early",
          trainingExamples: 60,
          replayGames: 30,
          correctGames: 16,
          accuracy: 0.533333,
          brierScore: 0.24,
          logLoss: 0.675,
          modelSource: "phase_specific",
        },
      ],
    });

    const evidence = buildBacktestPromotionEvidence({
      baseline,
      candidate,
      candidateFeatureVectorOptions: {
        includeDefaultExcludedFeatureKeys: true,
      },
      marketBaselineComparison: {
        key: "market_no_vig_moneyline",
        label: "Market no-vig moneyline",
        evaluatedGames: 40,
        correctGames: 24,
        wrongGames: 16,
        accuracy: 0.6,
        brierScore: 0.21,
        logLoss: 0.62,
        averagePrediction: 0.53,
      },
      candidateBaselineComparisons: [
        {
          key: "home_team_fixed_54",
          label: "Always home team",
          evaluatedGames: 100,
          correctGames: 54,
          wrongGames: 46,
          accuracy: 0.54,
          brierScore: 0.21,
          logLoss: 0.64,
          averagePrediction: 0.54,
        },
      ],
    });

    expect(evidence.usesMarketFeatures).toBe(true);
    expect(evidence.marketFeatureTrainingEligible).toBe(false);
    expect(evidence.marketBaselineCoverage.coveragePct).toBe(0.4);
    expect(evidence.simpleBaselineFloor).toMatchObject({
      key: "home_team_fixed_54",
      logLoss: 0.64,
      brierScore: 0.21,
    });
    expect(evidence.publicExplanationReady).toBe(true);
    expect(evidence.explanationBlockers).toEqual([]);
    expect(evidence.segmentRegressionCount).toBe(1);
    expect(evidence.decision.promote).toBe(false);
    expect(evidence.decision.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Market features require historical odds snapshots"),
        expect.stringContaining("evaluation segment"),
      ]),
    );
  });

  it("blocks ExtraTrees promotion without surrogate explanation support", () => {
    const baseline = ablationComparison({
      key: "v4_default",
      summary: {
        evaluatedGames: 120,
        correctGames: 66,
        wrongGames: 54,
        accuracy: 0.55,
        rolling10Accuracy: 0.5,
        rolling25Accuracy: 0.52,
        rolling50Accuracy: 0.54,
        brierScore: 0.23,
        logLoss: 0.66,
      },
    });
    const candidate = ablationComparison({
      key: "extra_trees_candidate",
      modelFamily: "extra_trees",
      summary: {
        evaluatedGames: 120,
        correctGames: 72,
        wrongGames: 48,
        accuracy: 0.6,
        rolling10Accuracy: 0.6,
        rolling25Accuracy: 0.6,
        rolling50Accuracy: 0.6,
        brierScore: 0.21,
        logLoss: 0.62,
      },
    });

    const evidence = buildBacktestPromotionEvidence({
      baseline,
      candidate,
      candidateBaselineComparisons: [
        {
          key: "home_team_fixed_54",
          label: "Always home team",
          evaluatedGames: 120,
          correctGames: 65,
          wrongGames: 55,
          accuracy: 0.541667,
          brierScore: 0.215,
          logLoss: 0.63,
          averagePrediction: 0.54,
        },
      ],
    });

    expect(evidence.activeUnexplainedFeatureKeys).toEqual([]);
    expect(evidence.explanationBlockers).toEqual([
      "extra_trees_requires_surrogate_explanation",
    ]);
    expect(evidence.publicExplanationReady).toBe(false);
    expect(evidence.decision.promote).toBe(false);
    expect(evidence.decision.reasons).toEqual([
      "Public explanation metadata is not ready for every promoted feature.",
    ]);
  });

  it("blocks market-feature promotion when source readiness is not eligible", () => {
    const baseline = ablationComparison({
      key: "v4_default",
      summary: {
        evaluatedGames: 100,
        correctGames: 55,
        wrongGames: 45,
        accuracy: 0.55,
        rolling10Accuracy: 0.5,
        rolling25Accuracy: 0.52,
        rolling50Accuracy: 0.54,
        brierScore: 0.23,
        logLoss: 0.66,
      },
    });
    const candidate = ablationComparison({
      key: "market_anchored_candidate",
      summary: {
        evaluatedGames: 100,
        correctGames: 60,
        wrongGames: 40,
        accuracy: 0.6,
        rolling10Accuracy: 0.6,
        rolling25Accuracy: 0.6,
        rolling50Accuracy: 0.6,
        brierScore: 0.21,
        logLoss: 0.62,
      },
    });
    const games: AccountabilityGameRow[] = [
      {
        id: 1,
        date: "2026-01-10",
        startTime: "2026-01-10T23:00:00.000Z",
        seasonId: 20252026,
        homeTeamId: 2,
        awayTeamId: 1,
        type: 2,
      },
    ];
    const ineligibleSourceReadiness = buildMarketOddsSourceReadiness({
      games,
      oddsRows: [
        {
          game_id: 1,
          captured_at: "2026-01-10T17:00:00.000Z",
          event_start_at: "2026-01-10T23:00:00.000Z",
          provider: "ESPN BET",
          provenance: {},
          metadata: {},
        },
      ],
      provenanceRows: [],
    });
    const eligibleSourceReadiness = buildMarketOddsSourceReadiness({
      games,
      oddsRows: [
        {
          game_id: 1,
          captured_at: "2026-01-10T15:00:00.000Z",
          event_start_at: "2026-01-10T23:00:00.000Z",
          provider: "DraftKings",
          provenance: {
            import_source_name: "historical_market_odds_import",
            import_batch_id: "market-import-2026-01-10",
          },
          metadata: {},
        },
      ],
      provenanceRows: [
        {
          game_id: 1,
          source_type: "game_prediction_market_odds",
          source_name: "historical_market_odds_import",
          status: "observed",
          observed_at: "2026-01-10T15:00:00.000Z",
          freshness_expires_at: "2026-01-10T23:00:00.000Z",
        },
      ],
    });

    const marketBaselineComparison = {
      key: "market_no_vig_moneyline",
      label: "Market no-vig moneyline",
      evaluatedGames: 100,
      correctGames: 60,
      wrongGames: 40,
      accuracy: 0.6,
      brierScore: 0.21,
      logLoss: 0.62,
      averagePrediction: 0.55,
    };

    const blockedEvidence = buildBacktestPromotionEvidence({
      baseline,
      candidate,
      candidateFeatureVectorOptions: {
        includeDefaultExcludedFeatureKeys: true,
      },
      marketBaselineComparison,
      marketSourceReadiness: ineligibleSourceReadiness,
    });
    const eligibleEvidence = buildBacktestPromotionEvidence({
      baseline,
      candidate,
      candidateFeatureVectorOptions: {
        includeDefaultExcludedFeatureKeys: true,
      },
      marketBaselineComparison,
      marketSourceReadiness: eligibleSourceReadiness,
    });

    expect(blockedEvidence.marketBaselineCoverage.coveragePct).toBe(1);
    expect(blockedEvidence.marketSourceReadiness).toMatchObject({
      trainingFeatureEligible: false,
      trustedSnapshotSourceNames: [],
      trustedImportBatchIds: [],
      missingPreCutoffEligibleGameIds: [1],
    });
    expect(eligibleEvidence.marketSourceReadiness).toMatchObject({
      trainingFeatureEligible: true,
      trustedSnapshotSourceNames: ["historical_market_odds_import"],
      trustedImportBatchIds: ["market-import-2026-01-10"],
    });
    expect(blockedEvidence.marketFeatureTrainingEligible).toBe(false);
    expect(blockedEvidence.marketSourceTrainingEligible).toBe(false);
    expect(blockedEvidence.marketFeatureSuppressedBySourceReadiness).toBe(false);
    expect(blockedEvidence.decision.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Market features require historical odds snapshots"),
      ]),
    );
    expect(eligibleEvidence.marketFeatureTrainingEligible).toBe(true);
    expect(eligibleEvidence.marketSourceTrainingEligible).toBe(true);
    expect(eligibleEvidence.marketFeatureSuppressedBySourceReadiness).toBe(false);
  });

  it("suppresses market features from ablation training until source readiness is eligible", () => {
    const games: AccountabilityGameRow[] = [
      {
        id: 1,
        date: "2026-01-10",
        startTime: "2026-01-10T23:00:00.000Z",
        seasonId: 20252026,
        homeTeamId: 2,
        awayTeamId: 1,
        type: 2,
      },
    ];
    const ineligibleSourceReadiness = buildMarketOddsSourceReadiness({
      games,
      oddsRows: [],
      provenanceRows: [],
    });
    const eligibleSourceReadiness = buildMarketOddsSourceReadiness({
      games,
      oddsRows: [
        {
          game_id: 1,
          captured_at: "2026-01-10T15:00:00.000Z",
          event_start_at: "2026-01-10T23:00:00.000Z",
          provider: "DraftKings",
          provenance: {
            import_source_name: "historical_market_odds_import",
            import_batch_id: "market-import-2026-01-10",
          },
          metadata: {},
        },
      ],
      provenanceRows: [
        {
          game_id: 1,
          source_type: "game_prediction_market_odds",
          source_name: "historical_market_odds_import",
          status: "observed",
          observed_at: "2026-01-10T15:00:00.000Z",
          freshness_expires_at: "2026-01-10T23:00:00.000Z",
        },
      ],
    });
    const variants: BacktestAblationVariant[] = [
      {
        key: "market_anchored_candidate",
        label: "Market snapshot candidate",
        featureVectorOptions: {
          includeDefaultExcludedFeatureKeys: true,
        },
      },
      {
        key: "long_window_form_candidate",
        label: "Long-window form candidate",
        featureVectorOptions: {
          includeDefaultExcludedFeatureKeys: true,
          excludedFeatureKeys: ["homeMarketNoVigProbability" as const],
        },
      },
    ];

    const guarded = applyMarketFeatureTrainingGuardrailToVariants({
      variants,
      marketSourceReadiness: ineligibleSourceReadiness,
    });
    const eligible = applyMarketFeatureTrainingGuardrailToVariants({
      variants,
      marketSourceReadiness: eligibleSourceReadiness,
    });

    expect(guarded[0]).toMatchObject({
      featureVectorOptions: {
        excludedFeatureKeys: ["homeMarketNoVigProbability"],
      },
      modelAuditMetadata: {
        marketFeatureSuppressedBySourceReadiness: true,
        marketFeatureGuardrailReason:
          "market_odds_source_readiness_not_training_eligible",
      },
    });
    expect(guarded[1]).toBe(variants[1]);
    expect(eligible[0]).toBe(variants[0]);

    const suppressedEvidence = buildBacktestPromotionEvidence({
      baseline: ablationComparison({ key: "v4_default" }),
      candidate: ablationComparison({
        key: "market_anchored_candidate",
        modelAuditMetadata: guarded[0]?.modelAuditMetadata ?? {},
      }),
      candidateFeatureVectorOptions: guarded[0]?.featureVectorOptions,
      marketSourceReadiness: ineligibleSourceReadiness,
    });

    expect(suppressedEvidence.usesMarketFeatures).toBe(false);
    expect(suppressedEvidence.marketSourceTrainingEligible).toBe(false);
    expect(suppressedEvidence.marketFeatureSuppressedBySourceReadiness).toBe(true);
    expect(suppressedEvidence.marketFeatureTrainingEligible).toBe(false);
    expect(suppressedEvidence.decision.reasons).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("Market features require historical odds snapshots"),
      ]),
    );
  });

  it("builds model-version rows that persist rejected promotion evidence", () => {
    const baseline = ablationComparison({
      key: "v4_default",
      label: "Production default",
      modelVersion: "v4_default_model",
      summary: {
        evaluatedGames: 100,
        correctGames: 55,
        wrongGames: 45,
        accuracy: 0.55,
        rolling10Accuracy: 0.5,
        rolling25Accuracy: 0.52,
        rolling50Accuracy: 0.54,
        brierScore: 0.23,
        logLoss: 0.66,
      },
    });
    const candidate = ablationComparison({
      key: "market_anchored_candidate",
      label: "Market anchored candidate",
      modelVersion: "market_candidate_model",
      excludedFeatureKeys: [],
      summary: {
        evaluatedGames: 100,
        correctGames: 54,
        wrongGames: 46,
        accuracy: 0.54,
        rolling10Accuracy: 0.5,
        rolling25Accuracy: 0.52,
        rolling50Accuracy: 0.54,
        brierScore: 0.24,
        logLoss: 0.675,
      },
      monitoredSegmentSummaries: [
        {
          segmentKey: "goalie_confirmation_state",
          segmentValue: "both_confirmed",
          replayGames: 52,
          correctGames: 29,
          accuracy: 0.557692,
          brierScore: 0.231,
          logLoss: 0.662,
        },
      ],
    });
    const sourceReadinessGames: AccountabilityGameRow[] = Array.from(
      { length: SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT + 2 },
      (_, index) => {
        const day = String(index + 1).padStart(2, "0");
        return {
          id: index + 1,
          date: `2026-01-${day}`,
          startTime: `2026-01-${day}T23:00:00.000Z`,
          seasonId: 20252026,
          homeTeamId: 2,
          awayTeamId: 1,
          type: 2,
        };
      },
    );
    const sourceReadiness = buildMarketOddsSourceReadiness({
      games: sourceReadinessGames,
      oddsRows: [],
      provenanceRows: [],
    });
    const compactSourceReadiness =
      compactMarketOddsSourceReadinessForMetadata(sourceReadiness);

    expect(compactSourceReadiness).toMatchObject({
      requiredGames: SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT + 2,
      missingSnapshotGameIdCount: SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT + 2,
      missingSnapshotGameIdsTruncated: true,
      trustedSnapshotSourceNames: [],
      trustedImportBatchIds: [],
      missingPreCutoffEligibleGameIdCount:
        SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT + 2,
      missingPreCutoffEligibleGameIdsTruncated: true,
      missingTrustedSnapshotSourceGameIdCount:
        SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT + 2,
      missingTrustedSnapshotSourceGameIdsTruncated: true,
      missingProvenanceGameIdCount: SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT + 2,
      missingProvenanceGameIdsTruncated: true,
      staleProvenanceGameIdCount: 0,
      staleProvenanceGameIdsTruncated: false,
    });
    expect(compactSourceReadiness.missingSnapshotGameIds).toHaveLength(
      SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT,
    );
    const evidence = buildBacktestPromotionEvidence({
      baseline,
      candidate,
      candidateFeatureVectorOptions: {
        includeDefaultExcludedFeatureKeys: true,
      },
      marketBaselineComparison: {
        key: "market_no_vig_moneyline",
        label: "Market no-vig moneyline",
        evaluatedGames: 40,
        correctGames: 24,
        wrongGames: 16,
        accuracy: 0.6,
        brierScore: 0.21,
        logLoss: 0.62,
        averagePrediction: 0.53,
      },
      marketSourceReadiness: sourceReadiness,
    });
    const ablationResult = {
      generatedAt: "2026-04-27T12:00:00.000Z",
      modelName: "nhl_game_baseline_logistic",
      featureSetVersion: "game_features_v4",
      trainingStartDate: "2025-10-07",
      trainingEndDate: "2025-12-31",
      replayStartDate: "2026-01-01",
      replayEndDate: "2026-04-15",
      baselineKey: "v4_default",
      sourceReadiness: {
        marketOdds: sourceReadiness,
      },
      candidateTracks: [],
      promotionEvidence: [evidence],
      promotionEvidencePersisted: false,
      variants: [baseline, candidate],
    };

    const rows = buildAblationPromotionEvidenceModelVersionRows({
      generatedAt: "2026-04-27T12:00:00.000Z",
      result: ablationResult,
    });
    const metricRows = buildAblationPromotionEvidenceMetricRows({
      generatedAt: "2026-04-27T12:00:00.000Z",
      result: ablationResult,
    });

    const candidateRow = rows.find(
      (row) => row.model_version === "market_candidate_model",
    );

    expect(candidateRow).toMatchObject({
      model_name: "nhl_game_baseline_logistic",
      feature_set_version: "game_features_v4",
      status: "rejected",
      training_start_date: "2025-10-07",
      validation_end_date: "2026-04-15",
    });
    expect(candidateRow?.metadata).toMatchObject({
      promotion_status: "rejected_by_guardrails",
      source_readiness: {
        marketOdds: {
          requiredGames: SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT + 2,
          missingSnapshotGameIdCount:
            SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT + 2,
          missingSnapshotGameIdsTruncated: true,
          trainingFeatureEligible: false,
        },
      },
      validation_window: {
        start_date: "2026-01-01",
        end_date: "2026-04-15",
        evaluated_games: 100,
      },
      promotion_decision: {
        promote: false,
      },
    });
    expect(candidateRow?.validation_metrics).toMatchObject({
      summary: {
        logLoss: 0.675,
        brierScore: 0.24,
      },
      monitored_segment_summaries: [
        {
          segmentKey: "goalie_confirmation_state",
          segmentValue: "both_confirmed",
        },
      ],
      promotion_evidence: {
        candidateKey: "market_anchored_candidate",
        marketBaselineCoverage: {
          coveragePct: 0.4,
        },
        marketSourceReadiness: {
          missingSnapshotGameIdCount:
            SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT + 2,
          missingSnapshotGameIdsTruncated: true,
        },
      },
    });
    expect(candidateRow?.source_audit_metadata).toMatchObject({
      uses_market_features: true,
      market_feature_training_eligible: false,
      market_source_training_eligible: false,
      market_feature_suppressed_by_source_readiness: false,
      run_source_readiness: {
        marketOdds: {
          requiredGames: SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT + 2,
          missingSnapshotGameIdCount:
            SOURCE_READINESS_GAME_ID_SAMPLE_LIMIT + 2,
          missingSnapshotGameIdsTruncated: true,
          trainingFeatureEligible: false,
        },
      },
      public_explanation_ready: true,
      explanation_blockers: [],
    });
    expect(
      rows.find((row) => row.model_version === "v4_default_model")?.status,
    ).toBe("candidate");
    expect(metricRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          model_name: "nhl_game_baseline_logistic",
          model_version: "market_candidate_model",
          feature_set_version: "game_features_v4",
          evaluation_start_date: "2026-01-01",
          evaluation_end_date: "2026-04-15",
          segment_key: "overall",
          segment_value: "all",
          evaluated_games: 100,
          log_loss: 0.675,
          brier_score: 0.24,
          accuracy: 0.54,
          computed_at: "2026-04-27T12:00:00.000Z",
          metadata: expect.objectContaining({
            accuracy_improvement_ablation: true,
            baseline_key: "v4_default",
            candidate_key: "market_anchored_candidate",
            promotion_status: "rejected_by_guardrails",
          }),
        }),
        expect.objectContaining({
          model_version: "market_candidate_model",
          segment_key: "season_phase",
          segment_value: "early",
          evaluated_games: 30,
          log_loss: 0.65,
          brier_score: 0.22,
          coverage: expect.objectContaining({
            training_examples: 60,
            model_source: "phase_specific",
          }),
          metadata: expect.objectContaining({
            segment_source: "walk_forward_phase_summary",
          }),
        }),
        expect.objectContaining({
          model_version: "market_candidate_model",
          segment_key: "goalie_confirmation_state",
          segment_value: "both_confirmed",
          evaluated_games: 52,
          log_loss: 0.662,
          brier_score: 0.231,
          accuracy: 0.557692,
          coverage: expect.objectContaining({
            correct_games: 29,
          }),
          metadata: expect.objectContaining({
            segment_source: "walk_forward_prediction_metadata",
          }),
        }),
      ]),
    );
  });
});
