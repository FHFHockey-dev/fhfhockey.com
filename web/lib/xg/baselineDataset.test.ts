import { describe, expect, it } from "vitest";

import type { NhlShotFeatureRow } from "../supabase/Upserts/nhlShotFeatureBuilder";
import {
  BASELINE_FEATURE_FAMILY_PRESETS,
  buildEncodedBaselineDataset,
  isEligibleBaselineTrainingRow,
} from "./baselineDataset";

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

describe("baselineDataset", () => {
  it("filters to the approved baseline training cohort", () => {
    expect(isEligibleBaselineTrainingRow(createShotRow())).toBe(true);
    expect(
      isEligibleBaselineTrainingRow(createShotRow({ isUnblockedShotAttempt: false }))
    ).toBe(false);
    expect(
      isEligibleBaselineTrainingRow(createShotRow({ isPenaltyShotEvent: true }))
    ).toBe(false);
    expect(
      isEligibleBaselineTrainingRow(createShotRow({ isShootoutEvent: true }))
    ).toBe(false);
  });

  it("builds deterministic chronological splits and honors feature subset selection", () => {
    const rows = [
      createShotRow({
        gameId: 2025021001,
        eventId: 1,
        gameDate: "2026-01-01",
        normalizedX: 70,
        normalizedY: 4,
        shotDistanceFeet: 19,
        shotAngleDegrees: 15,
        isReboundShot: true,
        shotEventType: "goal",
        previousEventTypeDescKey: "shot-on-goal",
        isGoal: true,
      }),
      createShotRow({
        gameId: 2025021002,
        eventId: 2,
        gameDate: "2026-01-02",
        normalizedX: 65,
        normalizedY: -2,
        shotDistanceFeet: 25,
        shotAngleDegrees: 22,
        isRushShot: true,
        shotEventType: "missed-shot",
        previousEventTypeDescKey: "giveaway",
      }),
      createShotRow({
        gameId: 2025021003,
        eventId: 3,
        gameDate: "2026-01-03",
        normalizedX: 80,
        normalizedY: 1,
        shotDistanceFeet: 10,
        shotAngleDegrees: 5,
        shotEventType: "shot-on-goal",
        previousEventTypeDescKey: "faceoff",
      }),
      createShotRow({
        gameId: 2025021004,
        eventId: 4,
        gameDate: "2026-01-04",
        normalizedX: 68,
        normalizedY: 8,
        shotDistanceFeet: 21,
        shotAngleDegrees: 18,
        shotEventType: "shot-on-goal",
        previousEventTypeDescKey: "takeaway",
      }),
    ];

    const dataset = buildEncodedBaselineDataset(rows, {
      seed: 7,
      splitConfig: {
        trainRatio: 0.5,
        validationRatio: 0.25,
      },
      featureSelection: {
        numericKeys: ["normalizedX", "shotDistanceFeet"],
        booleanKeys: ["isReboundShot"],
        categoricalKeys: ["shotType", "previousEventTypeDescKey"],
      },
    });

    expect(dataset.featureKeys).toEqual([
      "normalizedX",
      "shotDistanceFeet",
      "isReboundShot",
      "shotType:wrist",
      "previousEventTypeDescKey:faceoff",
      "previousEventTypeDescKey:giveaway",
      "previousEventTypeDescKey:shot-on-goal",
      "previousEventTypeDescKey:takeaway",
    ]);
    expect(dataset.splitAssignments).toEqual([
      { gameId: 2025021001, split: "train" },
      { gameId: 2025021002, split: "train" },
      { gameId: 2025021003, split: "validation" },
      { gameId: 2025021004, split: "test" },
    ]);
    expect(dataset.splitCounts).toEqual({
      train: 2,
      validation: 1,
      test: 1,
    });
    expect(dataset.examples[0]).toMatchObject({
      rowId: "2025021001:1",
      split: "train",
      label: 1,
      features: [70, 19, 1, 1, 0, 0, 1, 0],
    });
  });

  it("rejects leaked current-shot event-class features if they are forced back in", () => {
    expect(() =>
      buildEncodedBaselineDataset(
        [createShotRow()],
        {
          featureSelection: {
            categoricalKeys: ["shotEventType" as never],
          },
        }
      )
    ).toThrow("Forbidden baseline feature inputs were requested: shotEventType.");
  });

  it("defaults to the first_pass_v1 feature family when no explicit subset is provided", () => {
    const dataset = buildEncodedBaselineDataset([createShotRow()]);

    expect(dataset.featureKeys).toEqual([
      ...BASELINE_FEATURE_FAMILY_PRESETS.first_pass_v1.numericKeys,
      ...BASELINE_FEATURE_FAMILY_PRESETS.first_pass_v1.booleanKeys,
      "shotType:wrist",
      "strengthState:EV",
      "strengthExact:5v5",
      "zoneCode:O",
      "previousEventTypeDescKey:faceoff",
      "missReasonBucket:unknown",
    ]);
  });

  it("uses the expanded_v2 feature family when requested", () => {
    const dataset = buildEncodedBaselineDataset([createShotRow()], {
      featureFamily: "expanded_v2",
    });

    expect(dataset.featureKeys).toContain("ownerScoreDiffBeforeEvent");
    expect(dataset.featureKeys).toContain("possessionEventCount");
    expect(dataset.featureKeys).toContain("isDefensemanShooter");
    expect(dataset.featureKeys).toContain("shooterRosterPosition:L");
    expect(dataset.featureKeys).toContain("shooterPositionGroup:forward");
    expect(dataset.featureKeys).toContain("ownerScoreDiffBucket:lead-1");
    expect(dataset.featureKeys).not.toContain("shooterHandedness:L");
    expect(dataset.featureKeys).not.toContain("reboundLateralDisplacementFeet");
  });

  it("encodes handedness categorical features when explicitly selected", () => {
    const dataset = buildEncodedBaselineDataset(
      [
        createShotRow({
          eventId: 1,
          shooterHandedness: "L",
          goalieCatchHand: "R",
          shooterGoalieHandednessMatchup: "opposite-hand",
        }),
        createShotRow({
          eventId: 2,
          gameId: 2025021002,
          gameDate: "2026-01-02",
          shooterHandedness: "R",
          goalieCatchHand: "R",
          shooterGoalieHandednessMatchup: "same-hand",
        }),
      ],
      {
        featureSelection: {
          numericKeys: ["normalizedX"],
          booleanKeys: ["isReboundShot"],
          categoricalKeys: [
            "shooterHandedness",
            "goalieCatchHand",
            "shooterGoalieHandednessMatchup",
          ],
        },
      }
    );

    expect(dataset.featureKeys).toEqual([
      "normalizedX",
      "isReboundShot",
      "shooterHandedness:L",
      "shooterHandedness:R",
      "goalieCatchHand:R",
      "shooterGoalieHandednessMatchup:opposite-hand",
      "shooterGoalieHandednessMatchup:same-hand",
    ]);
  });

  it("encodes roster-position categorical and boolean features when explicitly selected", () => {
    const dataset = buildEncodedBaselineDataset(
      [
        createShotRow({
          eventId: 1,
          shooterRosterPosition: "D",
          shooterPositionGroup: "defense",
          isDefensemanShooter: true,
        }),
        createShotRow({
          eventId: 2,
          gameId: 2025021002,
          gameDate: "2026-01-02",
          shooterRosterPosition: "C",
          shooterPositionGroup: "forward",
          isDefensemanShooter: false,
        }),
      ],
      {
        featureSelection: {
          numericKeys: ["normalizedX"],
          booleanKeys: ["isDefensemanShooter"],
          categoricalKeys: ["shooterRosterPosition", "shooterPositionGroup"],
        },
      }
    );

    expect(dataset.featureKeys).toEqual([
      "normalizedX",
      "isDefensemanShooter",
      "shooterRosterPosition:C",
      "shooterRosterPosition:D",
      "shooterPositionGroup:defense",
      "shooterPositionGroup:forward",
    ]);
  });

  it("encodes deployment and matchup context features when explicitly selected", () => {
    const dataset = buildEncodedBaselineDataset(
      [
        createShotRow({
          eventId: 1,
          ownerForwardCountOnIce: 3,
          ownerDefenseCountOnIce: 2,
          opponentForwardCountOnIce: 4,
          opponentDefenseCountOnIce: 1,
          ownerGoalieOnIce: true,
          opponentGoalieOnIce: true,
          ownerSkaterDeploymentBucket: "3F-2D",
          opponentSkaterDeploymentBucket: "4F-1D",
          skaterRoleMatchupBucket: "3F-2D_vs_4F-1D",
        }),
        createShotRow({
          eventId: 2,
          gameId: 2025021002,
          gameDate: "2026-01-02",
          ownerForwardCountOnIce: 4,
          ownerDefenseCountOnIce: 1,
          opponentForwardCountOnIce: 3,
          opponentDefenseCountOnIce: 2,
          ownerGoalieOnIce: false,
          opponentGoalieOnIce: true,
          ownerSkaterDeploymentBucket: "4F-1D",
          opponentSkaterDeploymentBucket: "3F-2D",
          skaterRoleMatchupBucket: "4F-1D_vs_3F-2D",
        }),
      ],
      {
        featureSelection: {
          numericKeys: [
            "ownerForwardCountOnIce",
            "opponentDefenseCountOnIce",
          ],
          booleanKeys: ["ownerGoalieOnIce", "opponentGoalieOnIce"],
          categoricalKeys: [
            "ownerSkaterDeploymentBucket",
            "opponentSkaterDeploymentBucket",
            "skaterRoleMatchupBucket",
          ],
        },
      }
    );

    expect(dataset.featureKeys).toEqual([
      "ownerForwardCountOnIce",
      "opponentDefenseCountOnIce",
      "ownerGoalieOnIce",
      "opponentGoalieOnIce",
      "ownerSkaterDeploymentBucket:3F-2D",
      "ownerSkaterDeploymentBucket:4F-1D",
      "opponentSkaterDeploymentBucket:3F-2D",
      "opponentSkaterDeploymentBucket:4F-1D",
      "skaterRoleMatchupBucket:3F-2D_vs_4F-1D",
      "skaterRoleMatchupBucket:4F-1D_vs_3F-2D",
    ]);
  });

  it("encodes richer shift-fatigue history features when explicitly selected", () => {
    const dataset = buildEncodedBaselineDataset(
      [
        createShotRow({
          eventId: 1,
          shooterPreviousShiftGapSeconds: 20,
          shooterPreviousShiftDurationSeconds: 45,
          ownerAveragePreviousShiftGapSeconds: 18,
          ownerAveragePreviousShiftDurationSeconds: 44,
          opponentAveragePreviousShiftGapSeconds: 22,
          opponentAveragePreviousShiftDurationSeconds: 42,
        }),
      ],
      {
        featureSelection: {
          numericKeys: [
            "shooterPreviousShiftGapSeconds",
            "shooterPreviousShiftDurationSeconds",
            "ownerAveragePreviousShiftGapSeconds",
            "ownerAveragePreviousShiftDurationSeconds",
            "opponentAveragePreviousShiftGapSeconds",
            "opponentAveragePreviousShiftDurationSeconds",
          ],
          booleanKeys: ["isReboundShot"],
          categoricalKeys: ["shotType"],
        },
      }
    );

    expect(dataset.featureKeys).toEqual([
      "shooterPreviousShiftGapSeconds",
      "shooterPreviousShiftDurationSeconds",
      "ownerAveragePreviousShiftGapSeconds",
      "ownerAveragePreviousShiftDurationSeconds",
      "opponentAveragePreviousShiftGapSeconds",
      "opponentAveragePreviousShiftDurationSeconds",
      "isReboundShot",
      "shotType:wrist",
    ]);
    expect(dataset.examples[0]?.features).toEqual([20, 45, 18, 44, 22, 42, 0, 1]);
  });

  it("encodes score-effects-by-time features when explicitly selected", () => {
    const dataset = buildEncodedBaselineDataset(
      [
        createShotRow({
          eventId: 1,
          isLateGameLeading: true,
          isFinalFiveMinutes: true,
          isFinalTwoMinutes: false,
          scoreEffectsGameTimeSegment: "final-five-regulation",
          ownerScoreDiffByGameTimeBucket: "lead-1@final-five-regulation",
        }),
        createShotRow({
          eventId: 2,
          gameId: 2025021002,
          gameDate: "2026-01-02",
          isLateGameLeading: false,
          isFinalFiveMinutes: false,
          isFinalTwoMinutes: false,
          scoreEffectsGameTimeSegment: "mid-regulation",
          ownerScoreDiffByGameTimeBucket: "trail-1@mid-regulation",
        }),
      ],
      {
        featureSelection: {
          numericKeys: ["ownerScoreDiffBeforeEvent"],
          booleanKeys: ["isLateGameLeading", "isFinalFiveMinutes", "isFinalTwoMinutes"],
          categoricalKeys: ["scoreEffectsGameTimeSegment", "ownerScoreDiffByGameTimeBucket"],
        },
      }
    );

    expect(dataset.featureKeys).toEqual([
      "ownerScoreDiffBeforeEvent",
      "isLateGameLeading",
      "isFinalFiveMinutes",
      "isFinalTwoMinutes",
      "scoreEffectsGameTimeSegment:final-five-regulation",
      "scoreEffectsGameTimeSegment:mid-regulation",
      "ownerScoreDiffByGameTimeBucket:lead-1@final-five-regulation",
      "ownerScoreDiffByGameTimeBucket:trail-1@mid-regulation",
    ]);
  });
});
