import { describe, expect, it } from "vitest";

import { buildEncodedBaselineDataset } from "../lib/xg/baselineDataset";
import type { NhlShotFeatureRow } from "../lib/supabase/Upserts/nhlShotFeatureBuilder";
import {
  buildBaselineArtifactPayloads,
  enrichShotRowsWithHandedness,
  enrichShotRowsWithTrainingContext,
} from "./train-nhl-xg-baseline";

function createShotRow(
  overrides: Partial<NhlShotFeatureRow> = {}
): NhlShotFeatureRow {
  return {
    featureVersion: 1,
    gameId: 2025021001,
    eventId: 100,
    seasonId: 20252026,
    gameDate: "2026-01-01",
    periodNumber: 1,
    periodType: "REG",
    periodSecondsElapsed: 120,
    gameSecondsElapsed: 120,
    eventTime: "02:00",
    sortOrder: 100,
    shotEventType: "shot-on-goal",
    eventOwnerTeamId: 10,
    eventOwnerSide: "home",
    shooterPlayerId: 91,
    scoringPlayerId: null,
    assist1PlayerId: null,
    assist2PlayerId: null,
    goalieInNetId: 31,
    shotType: "wrist",
    shotReason: null,
    zoneCode: "O",
    strengthState: "EV",
    strengthExact: "5v5",
    awayGoalie: 1,
    awaySkaters: 5,
    homeSkaters: 5,
    homeGoalie: 1,
    isGoal: false,
    isShotOnGoal: true,
    isMissedShot: false,
    isBlockedShot: false,
    isUnblockedShotAttempt: true,
    isPenaltyShotEvent: false,
    isShootoutEvent: false,
    isEmptyNetEvent: false,
    isOvertimeEvent: false,
    isReboundShot: false,
    reboundSourceEventId: null,
    reboundSourceTypeDescKey: null,
    reboundSourceTeamId: null,
    reboundTimeDeltaSeconds: null,
    reboundDistanceFromSource: null,
    createsRebound: false,
    reboundTargetEventId: null,
    isRushShot: false,
    rushSourceEventId: null,
    rushSourceTypeDescKey: null,
    rushSourceTeamId: null,
    rushSourceTeamRelativeZone: null,
    rushTimeSinceSourceSeconds: null,
    rushInterveningEventCount: null,
    isFlurryShot: false,
    flurrySequenceId: null,
    flurryShotIndex: null,
    flurryShotCount: null,
    flurrySequenceStartEventId: null,
    flurrySequenceEndEventId: null,
    flurrySequenceDurationSeconds: null,
    missReasonBucket: "unknown",
    isShortSideMiss: false,
    previousEventId: 99,
    previousEventTypeDescKey: "faceoff",
    previousEventTeamId: 10,
    previousEventSameTeam: true,
    timeSincePreviousEventSeconds: 4,
    distanceFromPreviousEvent: 12,
    homeScoreBeforeEvent: 1,
    awayScoreBeforeEvent: 0,
    homeScoreDiffBeforeEvent: 1,
    awayScoreDiffBeforeEvent: -1,
    ownerScoreDiffBeforeEvent: 1,
    ownerScoreDiffBucket: "lead-1",
    isLateGameClose: false,
    isLateGameTrailing: false,
    isLateGameLeading: false,
    isFinalFiveMinutes: false,
    isFinalTwoMinutes: false,
    scoreEffectsGameTimeSegment: "early-regulation",
    ownerScoreDiffByGameTimeBucket: "lead-1@early-regulation",
    possessionSequenceId: "2025021001:10:1",
    possessionEventCount: 2,
    possessionDurationSeconds: 4,
    possessionStartEventId: 99,
    possessionStartTypeDescKey: "faceoff",
    possessionStartZoneCode: "O",
    possessionRegainedFromOpponent: false,
    possessionRegainEventTypeDescKey: null,
    possessionEnteredOffensiveZone: false,
    previousNormalizedX: 70,
    previousNormalizedY: 5,
    normalizedX: 75,
    normalizedY: 10,
    shotDistanceFeet: 18,
    shotAngleDegrees: 30,
    shooterRosterPosition: "L",
    shooterPositionGroup: "forward",
    isDefensemanShooter: false,
    shooterHandedness: "L",
    goalieCatchHand: "R",
    shooterGoalieHandednessMatchup: "opposite-hand",
    reboundLateralDisplacementFeet: null,
    reboundDistanceDeltaFeet: null,
    reboundAngleChangeDegrees: null,
    ownerPowerPlayAgeSeconds: null,
    shooterShiftAgeSeconds: 15,
    shooterPreviousShiftGapSeconds: 20,
    shooterPreviousShiftDurationSeconds: 45,
    ownerAverageShiftAgeSeconds: 20,
    ownerMaxShiftAgeSeconds: 35,
    ownerAveragePreviousShiftGapSeconds: 18,
    ownerAveragePreviousShiftDurationSeconds: 44,
    opponentAverageShiftAgeSeconds: 18,
    opponentMaxShiftAgeSeconds: 30,
    opponentAveragePreviousShiftGapSeconds: 22,
    opponentAveragePreviousShiftDurationSeconds: 42,
    ownerForwardCountOnIce: 3,
    ownerDefenseCountOnIce: 2,
    opponentForwardCountOnIce: 3,
    opponentDefenseCountOnIce: 2,
    ownerGoalieOnIce: true,
    opponentGoalieOnIce: true,
    ownerSkaterDeploymentBucket: "3F-2D",
    opponentSkaterDeploymentBucket: "3F-2D",
    skaterRoleMatchupBucket: "3F-2D_vs_3F-2D",
    eastWestMovementFeet: 5,
    northSouthMovementFeet: 8,
    crossedRoyalRoad: false,
    rawXCoord: 75,
    rawYCoord: 10,
    ...overrides,
  } as NhlShotFeatureRow;
}

describe("train-nhl-xg-baseline", () => {
  it("builds dataset and model artifact payloads with lineage and evaluation metadata", () => {
    const dataset = buildEncodedBaselineDataset([
      createShotRow({ gameId: 2025021001, eventId: 1, gameDate: "2026-01-01", isGoal: true }),
      createShotRow({ gameId: 2025021002, eventId: 2, gameDate: "2026-01-02" }),
      createShotRow({ gameId: 2025021003, eventId: 3, gameDate: "2026-01-03" }),
    ]);

    const { datasetArtifact, modelArtifact } = buildBaselineArtifactPayloads({
      artifactTag: "logistic_unregularized-s20252026-p1-st1-f1-cfgtest123",
      generatedAt: "2026-03-31T14:00:00.000Z",
      sourceCommitSha: "abc123",
      seasonScope: 20252026,
      family: "logistic_unregularized",
      featureFamily: "first_pass_v1",
      parserVersion: 1,
      strengthVersion: 1,
      featureVersion: 1,
      randomSeed: 42,
      splitConfig: { trainRatio: 0.7, validationRatio: 0.15 },
      splitStrategy: "chronological_game(train=0.7,validation=0.15,test=0.15)",
      selectedFeatures: {
        numeric: ["normalizedX", "shotDistanceFeet"],
        boolean: ["isReboundShot"],
        categorical: ["shotType"],
      },
      dataset,
      fitOptions: {
        iterations: 800,
        learningRate: 0.05,
        l1: 0,
        l2: 0.01,
      },
      evaluation: {
        overall: {
          exampleCount: 3,
          goalCount: 1,
          goalRate: 0.333333,
          averagePrediction: 0.2,
          logLoss: 0.5,
          brierScore: 0.1,
          calibrationBins: [],
        },
        train: {
          exampleCount: 1,
          goalCount: 1,
          goalRate: 1,
          averagePrediction: 0.8,
          logLoss: 0.2,
          brierScore: 0.04,
          calibrationBins: [],
        },
        validation: {
          exampleCount: 1,
          goalCount: 0,
          goalRate: 0,
          averagePrediction: 0.1,
          logLoss: 0.1,
          brierScore: 0.01,
          calibrationBins: [],
        },
        test: {
          exampleCount: 1,
          goalCount: 0,
          goalRate: 0,
          averagePrediction: 0.2,
          logLoss: 0.3,
          brierScore: 0.04,
          calibrationBins: [],
        },
      },
      holdoutEvaluation: {
        exampleCount: 2,
        goalCount: 0,
        goalRate: 0,
        averagePrediction: 0.15,
        logLoss: 0.2,
        brierScore: 0.03,
        calibrationBins: [],
      },
      holdoutSliceEvaluations: {
        strengthState: [],
        rebound: [],
        rush: [],
      },
      holdoutScores: [
        {
          rowId: "2025021002:2",
          split: "validation",
          label: 0,
          prediction: 0.1,
          strengthState: "EV",
          isReboundShot: false,
          isRushShot: false,
        },
      ],
      calibrationAssessment: {
        requiresPostCalibration: true,
        requirementReason: "Average prediction differs from observed goal rate by 0.15.",
        validationStrategy: "cross_validated_holdout",
        holdoutExampleCount: 2,
        holdoutPositiveCount: 0,
        reboundPositiveCount: 0,
        rushPositiveCount: 0,
        trustWarnings: ["No dedicated test split is available; calibration comparison is holdout cross-validation only."],
        adoptabilityBlockingReasons: [
          "No dedicated test split is available; calibration cannot be treated as adoptable.",
          "Holdout positive-goal coverage is below the adoptability minimum of 10.",
          "Positive rebound holdout coverage is below the adoptability minimum of 1.",
          "Positive rush holdout coverage is below the adoptability minimum of 1.",
        ],
        methods: [
          {
            method: "raw",
            applicable: true,
            metrics: {
              exampleCount: 2,
              goalCount: 0,
              goalRate: 0,
              averagePrediction: 0.15,
              logLoss: 0.2,
              brierScore: 0.03,
            },
          },
        ],
        bestObservedMethod: "raw",
        adoptableMethod: null,
      },
      model: {
        featureCount: dataset.featureKeys.length,
        weights: Array.from({ length: dataset.featureKeys.length }, () => 0.1),
        bias: -1.2,
      },
    });

    expect(datasetArtifact).toMatchObject({
      artifactKind: "nhl_xg_training_dataset",
      artifactTag: "logistic_unregularized-s20252026-p1-st1-f1-cfgtest123",
      sourceCommitSha: "abc123",
      randomSeed: 42,
      featureFamily: "first_pass_v1",
      splitConfig: { trainRatio: 0.7, validationRatio: 0.15 },
      splitStrategy: "chronological_game(train=0.7,validation=0.15,test=0.15)",
      selectedFeatures: {
        numeric: ["normalizedX", "shotDistanceFeet"],
        boolean: ["isReboundShot"],
        categorical: ["shotType"],
      },
      approvalGradeEligibility: {
        isEligible: false,
        blockingReasons: [
          "Dedicated test split is empty; approval-grade benchmark artifacts require at least one test example.",
        ],
      },
      rowCount: 3,
    });
    expect(datasetArtifact.rowIds).toEqual(["2025021001:1", "2025021002:2", "2025021003:3"]);

    expect(modelArtifact).toMatchObject({
      artifactKind: "nhl_xg_model",
      family: "logistic_unregularized",
      featureFamily: "first_pass_v1",
      trainExampleCount: 2,
      validationExampleCount: 1,
      testExampleCount: 0,
      fitOptions: {
        iterations: 800,
        learningRate: 0.05,
        l1: 0,
        l2: 0.01,
      },
      evaluation: {
        overall: {
          exampleCount: 3,
          logLoss: 0.5,
          brierScore: 0.1,
        },
      },
      holdoutEvaluation: {
        exampleCount: 2,
        brierScore: 0.03,
      },
      calibrationAssessment: {
        requiresPostCalibration: true,
        validationStrategy: "cross_validated_holdout",
        adoptabilityBlockingReasons: [
          "No dedicated test split is available; calibration cannot be treated as adoptable.",
          "Holdout positive-goal coverage is below the adoptability minimum of 10.",
          "Positive rebound holdout coverage is below the adoptability minimum of 1.",
          "Positive rush holdout coverage is below the adoptability minimum of 1.",
        ],
      },
      approvalGradeEligibility: {
        isEligible: false,
        blockingReasons: [
          "Dedicated test split is empty; approval-grade benchmark artifacts require at least one test example.",
        ],
      },
      model: {
        bias: -1.2,
      },
    });
  });

  it("marks artifacts as approval-grade eligible when a dedicated test split exists", () => {
    const dataset = buildEncodedBaselineDataset([
      createShotRow({ gameId: 2025021001, eventId: 1, gameDate: "2026-01-01", isGoal: true }),
      createShotRow({ gameId: 2025021002, eventId: 2, gameDate: "2026-01-02" }),
      createShotRow({ gameId: 2025021003, eventId: 3, gameDate: "2026-01-03" }),
      createShotRow({ gameId: 2025021004, eventId: 4, gameDate: "2026-01-04" }),
    ]);

    const { datasetArtifact, modelArtifact } = buildBaselineArtifactPayloads({
      artifactTag: "logistic_unregularized-s20252026-p1-st1-f1-cfgtest456",
      generatedAt: "2026-03-31T15:00:00.000Z",
      sourceCommitSha: "def456",
      seasonScope: 20252026,
      family: "logistic_unregularized",
      featureFamily: "expanded_v2",
      parserVersion: 1,
      strengthVersion: 1,
      featureVersion: 1,
      randomSeed: 42,
      splitConfig: { trainRatio: 0.7, validationRatio: 0.15 },
      splitStrategy: "chronological_game(train=0.7,validation=0.15,test=0.15)",
      selectedFeatures: {
        numeric: ["normalizedX"],
        boolean: ["isReboundShot"],
        categorical: ["shotType"],
      },
      dataset,
      fitOptions: {
        iterations: 800,
        learningRate: 0.05,
        l1: 0,
        l2: 0,
      },
      evaluation: {
        overall: {
          exampleCount: 4,
          goalCount: 1,
          goalRate: 0.25,
          averagePrediction: 0.25,
          logLoss: 0.5,
          brierScore: 0.1,
          calibrationBins: [],
        },
        train: {
          exampleCount: 2,
          goalCount: 1,
          goalRate: 0.5,
          averagePrediction: 0.4,
          logLoss: 0.4,
          brierScore: 0.12,
          calibrationBins: [],
        },
        validation: {
          exampleCount: 1,
          goalCount: 0,
          goalRate: 0,
          averagePrediction: 0.2,
          logLoss: 0.2,
          brierScore: 0.04,
          calibrationBins: [],
        },
        test: {
          exampleCount: 1,
          goalCount: 0,
          goalRate: 0,
          averagePrediction: 0.1,
          logLoss: 0.1,
          brierScore: 0.01,
          calibrationBins: [],
        },
      },
      holdoutEvaluation: {
        exampleCount: 2,
        goalCount: 0,
        goalRate: 0,
        averagePrediction: 0.15,
        logLoss: 0.15,
        brierScore: 0.025,
        calibrationBins: [],
      },
      holdoutSliceEvaluations: {
        strengthState: [],
        rebound: [],
        rush: [],
      },
      holdoutScores: [],
      calibrationAssessment: {
        requiresPostCalibration: false,
        requirementReason:
          "Average prediction and populated calibration bins stay within the current baseline tolerance.",
        validationStrategy: "cross_validated_holdout",
        holdoutExampleCount: 2,
        holdoutPositiveCount: 0,
        reboundPositiveCount: 0,
        rushPositiveCount: 0,
        trustWarnings: [],
        adoptabilityBlockingReasons: [],
        methods: [],
        bestObservedMethod: null,
        adoptableMethod: null,
      },
      model: {
        featureCount: dataset.featureKeys.length,
        weights: Array.from({ length: dataset.featureKeys.length }, () => 0.1),
        bias: -1.2,
      },
    });

    expect(datasetArtifact.approvalGradeEligibility).toEqual({
      isEligible: true,
      blockingReasons: [],
    });
    expect(datasetArtifact.featureFamily).toBe("expanded_v2");
    expect(modelArtifact.approvalGradeEligibility).toEqual({
      isEligible: true,
      blockingReasons: [],
    });
    expect(modelArtifact.featureFamily).toBe("expanded_v2");
  });

  it("rejects leaked shotEventType metadata during artifact generation", () => {
    const dataset = buildEncodedBaselineDataset([
      createShotRow({ gameId: 2025021001, eventId: 1, gameDate: "2026-01-01", isGoal: true }),
      createShotRow({ gameId: 2025021002, eventId: 2, gameDate: "2026-01-02" }),
    ]);

    expect(() =>
      buildBaselineArtifactPayloads({
        artifactTag: "bad-artifact",
        generatedAt: "2026-03-31T14:00:00.000Z",
        sourceCommitSha: "abc123",
        seasonScope: 20252026,
        family: "logistic_unregularized",
        featureFamily: "first_pass_v1",
        parserVersion: 1,
        strengthVersion: 1,
        featureVersion: 1,
        randomSeed: 42,
        splitConfig: { trainRatio: 0.7, validationRatio: 0.15 },
        splitStrategy: "chronological_game(train=0.7,validation=0.15,test=0.15)",
        selectedFeatures: {
          numeric: ["normalizedX"],
          boolean: ["isReboundShot"],
          categorical: ["shotEventType"],
        },
        dataset: {
          ...dataset,
          featureKeys: ["normalizedX", "shotEventType:goal"],
        },
        fitOptions: {
          iterations: 800,
          learningRate: 0.05,
          l1: 0,
          l2: 0.01,
        },
        evaluation: {
          overall: {
            exampleCount: 2,
            goalCount: 1,
            goalRate: 0.5,
            averagePrediction: 0.2,
            logLoss: 0.5,
            brierScore: 0.1,
            calibrationBins: [],
          },
          train: {
            exampleCount: 1,
            goalCount: 1,
            goalRate: 1,
            averagePrediction: 0.8,
            logLoss: 0.2,
            brierScore: 0.04,
            calibrationBins: [],
          },
          validation: {
            exampleCount: 1,
            goalCount: 0,
            goalRate: 0,
            averagePrediction: 0.1,
            logLoss: 0.1,
            brierScore: 0.01,
            calibrationBins: [],
          },
          test: {
            exampleCount: 0,
            goalCount: 0,
            goalRate: null,
            averagePrediction: null,
            logLoss: null,
            brierScore: null,
            calibrationBins: [],
          },
        },
        holdoutEvaluation: {
          exampleCount: 1,
          goalCount: 0,
          goalRate: 0,
          averagePrediction: 0.1,
          logLoss: 0.1,
          brierScore: 0.01,
          calibrationBins: [],
        },
        holdoutSliceEvaluations: {
          strengthState: [],
          rebound: [],
          rush: [],
        },
        holdoutScores: [],
        calibrationAssessment: {
          requiresPostCalibration: true,
          requirementReason: "test",
          validationStrategy: "cross_validated_holdout",
          holdoutExampleCount: 1,
          holdoutPositiveCount: 0,
          reboundPositiveCount: 0,
          rushPositiveCount: 0,
          trustWarnings: [],
          adoptabilityBlockingReasons: [],
          methods: [],
          bestObservedMethod: null,
          adoptableMethod: null,
        },
        model: {
          featureCount: dataset.featureKeys.length,
          weights: Array.from({ length: dataset.featureKeys.length }, () => 0.1),
          bias: -1.2,
        },
      })
    ).toThrow("Baseline artifact generation refused to persist leaked feature selection: shotEventType.");
  });

  it("enriches shot rows with shooter and goalie handedness from unified views", async () => {
    const rows = [
      createShotRow({
        shooterPlayerId: 91,
        goalieInNetId: 31,
      }),
    ];
    const calls: Array<{ table: string; filters: Record<string, unknown> }> = [];
    const client = {
      from(table: string) {
        const state: Record<string, unknown> = { table };
        return {
          select() {
            return this;
          },
          in(column: string, value: unknown) {
            state[`in:${column}`] = value;
            return this;
          },
          eq(column: string, value: unknown) {
            state[`eq:${column}`] = value;
            return this;
          },
          order() {
            return this;
          },
          then(resolve: (value: unknown) => unknown) {
            calls.push({ table, filters: state });
            if (table === "player_stats_unified") {
              return Promise.resolve(
                resolve({
                  data: [{ player_id: 91, shoots_catches: "L", date: "2026-03-01" }],
                  error: null,
                })
              );
            }

            if (table === "players") {
              return Promise.resolve(
                resolve({
                  data: [{ id: 91, position: "L" }],
                  error: null,
                })
              );
            }

            return Promise.resolve(
              resolve({
                data: [{ player_id: 31, shoots_catches: "R", date: "2026-03-01" }],
                error: null,
              })
            );
          },
        };
      },
    } as never;

    const enriched = await enrichShotRowsWithHandedness(client, rows, 20252026);

    expect(calls.map((entry) => entry.table)).toEqual([
      "player_stats_unified",
      "goalie_stats_unified",
      "players",
    ]);
    expect(enriched[0]).toMatchObject({
      shooterRosterPosition: "L",
      shooterPositionGroup: "forward",
      isDefensemanShooter: false,
      shooterHandedness: "L",
      goalieCatchHand: "R",
      shooterGoalieHandednessMatchup: "opposite-hand",
    });
  });

  it("enriches shot rows with deployment context from stable on-ice joins", async () => {
    const rows = [
      createShotRow({
        gameId: 2025021001,
        periodNumber: 1,
        periodSecondsElapsed: 300,
        eventOwnerTeamId: 10,
        shooterPlayerId: 91,
        goalieInNetId: 31,
      }),
    ];
    const shiftRows = [
      { game_id: 2025021001, shift_id: 1, team_id: 10, player_id: 91, period: 1, start_seconds: 0, end_seconds: 600, duration_seconds: 600, season_id: 20252026, game_date: "2026-01-01", shift_number: 1 },
      { game_id: 2025021001, shift_id: 2, team_id: 10, player_id: 92, period: 1, start_seconds: 0, end_seconds: 600, duration_seconds: 600, season_id: 20252026, game_date: "2026-01-01", shift_number: 1 },
      { game_id: 2025021001, shift_id: 3, team_id: 10, player_id: 93, period: 1, start_seconds: 0, end_seconds: 600, duration_seconds: 600, season_id: 20252026, game_date: "2026-01-01", shift_number: 1 },
      { game_id: 2025021001, shift_id: 4, team_id: 10, player_id: 94, period: 1, start_seconds: 0, end_seconds: 600, duration_seconds: 600, season_id: 20252026, game_date: "2026-01-01", shift_number: 1 },
      { game_id: 2025021001, shift_id: 5, team_id: 10, player_id: 95, period: 1, start_seconds: 0, end_seconds: 600, duration_seconds: 600, season_id: 20252026, game_date: "2026-01-01", shift_number: 1 },
      { game_id: 2025021001, shift_id: 6, team_id: 10, player_id: 31, period: 1, start_seconds: 0, end_seconds: 600, duration_seconds: 600, season_id: 20252026, game_date: "2026-01-01", shift_number: 1 },
      { game_id: 2025021001, shift_id: 7, team_id: 20, player_id: 81, period: 1, start_seconds: 0, end_seconds: 600, duration_seconds: 600, season_id: 20252026, game_date: "2026-01-01", shift_number: 1 },
      { game_id: 2025021001, shift_id: 8, team_id: 20, player_id: 82, period: 1, start_seconds: 0, end_seconds: 600, duration_seconds: 600, season_id: 20252026, game_date: "2026-01-01", shift_number: 1 },
      { game_id: 2025021001, shift_id: 9, team_id: 20, player_id: 83, period: 1, start_seconds: 0, end_seconds: 600, duration_seconds: 600, season_id: 20252026, game_date: "2026-01-01", shift_number: 1 },
      { game_id: 2025021001, shift_id: 10, team_id: 20, player_id: 84, period: 1, start_seconds: 0, end_seconds: 600, duration_seconds: 600, season_id: 20252026, game_date: "2026-01-01", shift_number: 1 },
      { game_id: 2025021001, shift_id: 11, team_id: 20, player_id: 85, period: 1, start_seconds: 0, end_seconds: 600, duration_seconds: 600, season_id: 20252026, game_date: "2026-01-01", shift_number: 1 },
      { game_id: 2025021001, shift_id: 12, team_id: 20, player_id: 41, period: 1, start_seconds: 0, end_seconds: 600, duration_seconds: 600, season_id: 20252026, game_date: "2026-01-01", shift_number: 1 },
    ];
    const client = {
      from(table: string) {
        return {
          select() {
            return this;
          },
          in() {
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return this;
          },
          then(resolve: (value: unknown) => unknown) {
            if (table === "player_stats_unified") {
              return Promise.resolve(
                resolve({
                  data: [{ player_id: 91, shoots_catches: "L", date: "2026-03-01" }],
                  error: null,
                })
              );
            }

            if (table === "goalie_stats_unified") {
              return Promise.resolve(
                resolve({
                  data: [{ player_id: 31, shoots_catches: "R", date: "2026-03-01" }],
                  error: null,
                })
              );
            }

            return Promise.resolve(
              resolve({
                data: [
                  { id: 91, position: "L" },
                  { id: 92, position: "C" },
                  { id: 93, position: "R" },
                  { id: 94, position: "D" },
                  { id: 95, position: "D" },
                  { id: 31, position: "G" },
                  { id: 81, position: "L" },
                  { id: 82, position: "C" },
                  { id: 83, position: "R" },
                  { id: 84, position: "R" },
                  { id: 85, position: "D" },
                  { id: 41, position: "G" },
                ],
                error: null,
              })
            );
          },
        };
      },
    } as never;

    const enriched = await enrichShotRowsWithTrainingContext(
      client,
      rows,
      shiftRows as never,
      20252026
    );

    expect(enriched[0]).toMatchObject({
      shooterHandedness: "L",
      goalieCatchHand: "R",
      ownerForwardCountOnIce: 3,
      ownerDefenseCountOnIce: 2,
      opponentForwardCountOnIce: 4,
      opponentDefenseCountOnIce: 1,
      ownerGoalieOnIce: true,
      opponentGoalieOnIce: true,
      ownerSkaterDeploymentBucket: "3F-2D",
      opponentSkaterDeploymentBucket: "4F-1D",
      skaterRoleMatchupBucket: "3F-2D_vs_4F-1D",
    });
  });
});
