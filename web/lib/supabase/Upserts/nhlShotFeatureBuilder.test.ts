import { describe, expect, it } from "vitest";

import {
  buildShotFeatureRows,
  NHL_SHOT_FEATURE_VERSION,
} from "./nhlShotFeatureBuilder";
import { parseNhlPlayByPlayEvents } from "./nhlPlayByPlayParser";

function createShiftRow(overrides: Record<string, unknown> = {}) {
  return {
    created_at: "2026-03-30T00:00:00.000Z",
    detail_code: null,
    duration: "0:40",
    duration_seconds: 40,
    end_seconds: 40,
    end_time: "0:40",
    event_description: null,
    event_details: null,
    event_number: null,
    first_name: "Test",
    game_date: "2026-03-30",
    game_id: 2025020418,
    hex_value: null,
    last_name: "Player",
    parser_version: 1,
    period: 1,
    player_id: 1,
    raw_shift: {},
    season_id: 20252026,
    shift_id: 1001,
    shift_number: 1,
    source_shiftcharts_hash: "shift-hash",
    start_seconds: 0,
    start_time: "0:00",
    team_abbrev: "TOR",
    team_id: 10,
    team_name: "Toronto Maple Leafs",
    type_code: null,
    updated_at: "2026-03-30T00:00:00.000Z",
    ...overrides,
  };
}

function parseEvents(plays: Record<string, unknown>[]) {
  return parseNhlPlayByPlayEvents(
    {
      id: 2025020418,
      season: 20252026,
      gameDate: "2026-03-30",
      homeTeam: { id: 10, abbrev: "TOR" },
      awayTeam: { id: 20, abbrev: "NYR" },
      plays,
    },
    {
      sourcePlayByPlayHash: "shot-builder-hash",
      now: "2026-03-30T12:00:00.000Z",
    }
  );
}

describe("nhlShotFeatureBuilder", () => {
  it("builds versioned shot rows from normalized events and derived helpers without parity aggregation", () => {
    const events = parseEvents([
      {
        eventId: 100,
        sortOrder: 100,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "01:40",
        timeRemaining: "18:20",
        situationCode: "1451",
        homeTeamDefendingSide: "left",
        typeCode: 502,
        typeDescKey: "faceoff",
        details: {
          eventOwnerTeamId: 10,
          winningPlayerId: 91,
          losingPlayerId: 21,
          xCoord: 69,
          yCoord: -22,
          zoneCode: "O",
        },
      },
      {
        eventId: 101,
        sortOrder: 101,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "01:44",
        timeRemaining: "18:16",
        situationCode: "1451",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          goalieInNetId: 31,
          shotType: "Wrist",
          xCoord: 76,
          yCoord: 12,
          zoneCode: "O",
        },
      },
      {
        eventId: 102,
        sortOrder: 102,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "01:46",
        timeRemaining: "18:14",
        situationCode: "1451",
        homeTeamDefendingSide: "left",
        typeCode: 505,
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 34,
          goalieInNetId: 31,
          shotType: "Tip-In",
          xCoord: 82,
          yCoord: -3,
          zoneCode: "O",
          homeScore: 1,
          awayScore: 0,
        },
      },
    ]);

    const shiftRows = [
      createShiftRow({
        shift_id: 1,
        player_id: 91,
        team_id: 10,
        start_seconds: 90,
        end_seconds: 130,
        duration_seconds: 40,
      }),
      createShiftRow({
        shift_id: 2,
        player_id: 34,
        team_id: 10,
        start_seconds: 95,
        end_seconds: 130,
        duration_seconds: 35,
      }),
      createShiftRow({
        shift_id: 3,
        player_id: 31,
        team_id: 20,
        team_abbrev: "NYR",
        start_seconds: 80,
        end_seconds: 130,
        duration_seconds: 50,
      }),
      createShiftRow({
        shift_id: 4,
        player_id: 32,
        team_id: 20,
        team_abbrev: "NYR",
        start_seconds: 85,
        end_seconds: 130,
        duration_seconds: 45,
      }),
    ] as any[];

    const rows = buildShotFeatureRows(events, shiftRows as any, 10, 20);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      featureVersion: NHL_SHOT_FEATURE_VERSION,
      eventId: 101,
      shotEventType: "shot-on-goal",
      isGoal: false,
      isShotOnGoal: true,
      isMissedShot: false,
      isBlockedShot: false,
      isUnblockedShotAttempt: true,
      shooterPlayerId: 91,
      shotType: "wrist",
      normalizedX: 76,
      normalizedY: 12,
      previousEventId: 100,
      previousEventTypeDescKey: "faceoff",
      previousEventSameTeam: true,
      homeScoreBeforeEvent: 0,
      awayScoreBeforeEvent: 0,
      homeScoreDiffBeforeEvent: 0,
      awayScoreDiffBeforeEvent: 0,
      ownerScoreDiffBeforeEvent: 0,
      ownerScoreDiffBucket: "tied",
      isLateGameClose: false,
      isLateGameTrailing: false,
      possessionEventCount: 2,
      possessionDurationSeconds: 4,
      possessionStartEventId: 100,
      possessionStartTypeDescKey: "faceoff",
      possessionStartZoneCode: "O",
      possessionRegainedFromOpponent: false,
      possessionEnteredOffensiveZone: false,
      isReboundShot: false,
      reboundLateralDisplacementFeet: null,
      reboundDistanceDeltaFeet: null,
      reboundAngleChangeDegrees: null,
      createsRebound: true,
      isRushShot: false,
      isFlurryShot: true,
      flurryShotIndex: 1,
      flurryShotCount: 2,
      ownerPowerPlayAgeSeconds: 4,
      shooterShiftAgeSeconds: 14,
      ownerGoalieOnIce: true,
      opponentGoalieOnIce: true,
      eastWestMovementFeet: 34,
      crossedRoyalRoad: true,
      isPenaltyShotEvent: false,
      isEmptyNetEvent: false
    });
    expect(rows[0].shotDistanceFeet).toBeCloseTo(17.6918, 3);
    expect(rows[0].shotAngleDegrees).toBeCloseTo(42.7093, 3);

    expect(rows[1]).toMatchObject({
      eventId: 102,
      shotEventType: "goal",
      isGoal: true,
      isShotOnGoal: true,
      shooterPlayerId: 34,
      scoringPlayerId: 34,
      homeScoreBeforeEvent: 0,
      awayScoreBeforeEvent: 0,
      ownerScoreDiffBeforeEvent: 0,
      ownerScoreDiffBucket: "tied",
      possessionEventCount: 3,
      possessionDurationSeconds: 6,
      possessionStartTypeDescKey: "faceoff",
      isReboundShot: true,
      reboundSourceEventId: 101,
      reboundSourceTypeDescKey: "shot-on-goal",
      reboundTimeDeltaSeconds: 2,
      reboundLateralDisplacementFeet: 15,
      isFlurryShot: true,
      flurryShotIndex: 2,
      flurryShotCount: 2,
      shotType: "tip-in",
      ownerPowerPlayAgeSeconds: 6,
    });
    expect(rows[1].shotDistanceFeet).toBeCloseTo(7.6157, 3);
    expect(rows[1].reboundDistanceDeltaFeet).toBeCloseTo(-10.0761, 3);
    expect(rows[1].reboundAngleChangeDegrees).toBeCloseTo(19.5107, 3);
  });

  it("preserves blocked and missed-shot feature rows with miss-reason and rush/flurry flags", () => {
    const events = parseEvents([
      {
        eventId: 200,
        sortOrder: 200,
        periodDescriptor: { number: 2, periodType: "REG" },
        timeInPeriod: "08:10",
        timeRemaining: "11:50",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 524,
        typeDescKey: "giveaway",
        details: {
          eventOwnerTeamId: 20,
          playerId: 77,
          zoneCode: "O",
        },
      },
      {
        eventId: 201,
        sortOrder: 201,
        periodDescriptor: { number: 2, periodType: "REG" },
        timeInPeriod: "08:17",
        timeRemaining: "11:43",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 507,
        typeDescKey: "missed-shot",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 34,
          shotType: "Snap",
          reason: "short-side",
          xCoord: 68,
          yCoord: 10,
          zoneCode: "O",
        },
      },
      {
        eventId: 202,
        sortOrder: 202,
        periodDescriptor: { number: 2, periodType: "REG" },
        timeInPeriod: "08:20",
        timeRemaining: "11:40",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 508,
        typeDescKey: "blocked-shot",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          blockingPlayerId: 25,
          xCoord: 74,
          yCoord: -4,
          zoneCode: "O",
        },
      },
    ]);

    const rows = buildShotFeatureRows(events, [] as any, 10, 20);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      eventId: 201,
      isMissedShot: true,
      isUnblockedShotAttempt: true,
      isRushShot: true,
      rushSourceEventId: 200,
      rushSourceTypeDescKey: "giveaway",
      rushSourceTeamRelativeZoneCode: "D",
      homeScoreBeforeEvent: 0,
      awayScoreBeforeEvent: 0,
      ownerScoreDiffBeforeEvent: 0,
      ownerScoreDiffBucket: "tied",
      possessionEventCount: 1,
      possessionDurationSeconds: 0,
      possessionStartEventId: 201,
      possessionStartTypeDescKey: "missed-shot",
      possessionStartZoneCode: "O",
      possessionRegainedFromOpponent: true,
      possessionRegainEventTypeDescKey: "giveaway",
      possessionEnteredOffensiveZone: false,
      missReasonRaw: "short-side",
      missReasonBucket: "short-side",
      isShortSideMiss: true,
    });

    expect(rows[1]).toMatchObject({
      eventId: 202,
      isBlockedShot: true,
      isUnblockedShotAttempt: false,
      shotType: null,
      isFlurryShot: true,
      flurryShotCount: 2,
    });
  });

  it("derives owner and opponent goalie-on-ice flags from the parsed situation code", () => {
    const evenStrengthRows = buildShotFeatureRows(
      parseEvents([
        {
          eventId: 500,
          sortOrder: 500,
          periodDescriptor: { number: 1, periodType: "REG" },
          timeInPeriod: "03:00",
          timeRemaining: "17:00",
          situationCode: "1551",
          homeTeamDefendingSide: "left",
          typeCode: 506,
          typeDescKey: "shot-on-goal",
          details: {
            eventOwnerTeamId: 10,
            shootingPlayerId: 91,
            goalieInNetId: 31,
            shotType: "Wrist",
            xCoord: 70,
            yCoord: 10,
            zoneCode: "O"
          }
        }
      ]),
      [] as any,
      10,
      20
    );

    expect(evenStrengthRows[0]).toMatchObject({
      strengthExact: "5v5",
      ownerGoalieOnIce: true,
      opponentGoalieOnIce: true
    });

    const emptyNetRows = buildShotFeatureRows(
      parseEvents([
        {
          eventId: 501,
          sortOrder: 501,
          periodDescriptor: { number: 3, periodType: "REG" },
          timeInPeriod: "18:00",
          timeRemaining: "02:00",
          situationCode: "0651",
          homeTeamDefendingSide: "left",
          typeCode: 506,
          typeDescKey: "shot-on-goal",
          details: {
            eventOwnerTeamId: 10,
            shootingPlayerId: 91,
            shotType: "Wrist",
            xCoord: 70,
            yCoord: 10,
            zoneCode: "O"
          }
        }
      ]),
      [] as any,
      10,
      20
    );

    expect(emptyNetRows[0]).toMatchObject({
      strengthExact: "6v5",
      ownerGoalieOnIce: true,
      opponentGoalieOnIce: false,
      isEmptyNetEvent: true
    });
  });

  it("excludes penalty-shot and shootout events from the feature layer", () => {
    const events = parseEvents([
      {
        eventId: 300,
        sortOrder: 300,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "10:00",
        timeRemaining: "10:00",
        situationCode: "1011",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          reason: "Penalty Shot",
          xCoord: 80,
          yCoord: 0,
        },
      },
      {
        eventId: 301,
        sortOrder: 301,
        periodDescriptor: { number: 5, periodType: "SO" },
        timeInPeriod: "00:10",
        timeRemaining: "00:00",
        situationCode: "1011",
        homeTeamDefendingSide: "left",
        typeCode: 505,
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 20,
          scoringPlayerId: 88,
          xCoord: -80,
          yCoord: 0,
        },
      },
      {
        eventId: 302,
        sortOrder: 302,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "10:05",
        timeRemaining: "09:55",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 34,
          xCoord: 74,
          yCoord: 4,
        },
      },
    ]);

    const rows = buildShotFeatureRows(events, [] as any, 10, 20);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      eventId: 302,
      isPenaltyShotEvent: false,
      isShootoutEvent: false,
    });
  });

  it("keeps empty-net shot events in the feature layer and marks them explicitly", () => {
    const events = parseEvents([
      {
        eventId: 400,
        sortOrder: 400,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "18:40",
        timeRemaining: "01:20",
        situationCode: "1560",
        homeTeamDefendingSide: "right",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          xCoord: -72,
          yCoord: 8,
          zoneCode: "O",
        },
      },
      {
        eventId: 401,
        sortOrder: 401,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "18:44",
        timeRemaining: "01:16",
        situationCode: "1560",
        homeTeamDefendingSide: "right",
        typeCode: 505,
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 34,
          shotType: "Backhand",
          xCoord: -80,
          yCoord: -4,
          zoneCode: "O",
        },
      },
    ]);

    const rows = buildShotFeatureRows(events, [] as any, 10, 20);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      eventId: 400,
      isEmptyNetEvent: true,
      strengthState: "EN",
      strengthExact: "5v6",
      normalizedX: 72,
      normalizedY: -8,
    });
    expect(rows[1]).toMatchObject({
      eventId: 401,
      isGoal: true,
      isEmptyNetEvent: true,
      shotType: "backhand",
      normalizedX: 80,
      normalizedY: 4,
    });
  });
});
