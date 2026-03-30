import { describe, expect, it } from "vitest";

import { buildContextualFeatureContexts } from "./nhlContextualFeatures";
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
      sourcePlayByPlayHash: "context-hash",
      now: "2026-03-30T12:00:00.000Z",
    }
  );
}

describe("nhlContextualFeatures", () => {
  it("computes power-play age, shift-age fatigue, and east-west proxies for a same-team PP shot", () => {
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
          xCoord: 76,
          yCoord: 12,
          zoneCode: "O",
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

    const contexts = buildContextualFeatureContexts(events, shiftRows as any, 10, 20);

    expect(contexts[0]).toMatchObject({
      eventId: 100,
      ownerPowerPlayAgeSeconds: 0,
      opponentPowerPlayAgeSeconds: null,
      homePowerPlayAgeSeconds: 0,
      awayPowerPlayAgeSeconds: null,
      eastWestMovementFeet: null,
      northSouthMovementFeet: null,
      crossedRoyalRoad: null,
    });

    expect(contexts[1]).toMatchObject({
      eventId: 101,
      ownerPowerPlayAgeSeconds: 4,
      opponentPowerPlayAgeSeconds: null,
      homePowerPlayAgeSeconds: 4,
      awayPowerPlayAgeSeconds: null,
      shooterShiftAgeSeconds: 14,
      ownerAverageShiftAgeSeconds: 11.5,
      ownerMaxShiftAgeSeconds: 14,
      opponentAverageShiftAgeSeconds: 21.5,
      opponentMaxShiftAgeSeconds: 24,
      eastWestMovementFeet: 34,
      northSouthMovementFeet: 7,
      crossedRoyalRoad: true,
    });
  });

  it("resets power-play age when the team leaves and later re-enters the advantage", () => {
    const events = parseEvents([
      {
        eventId: 200,
        sortOrder: 200,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "05:00",
        timeRemaining: "15:00",
        situationCode: "1451",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: { eventOwnerTeamId: 10, shootingPlayerId: 91, xCoord: 72, yCoord: 0 },
      },
      {
        eventId: 201,
        sortOrder: 201,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "05:06",
        timeRemaining: "14:54",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 516,
        typeDescKey: "stoppage",
        details: {},
      },
      {
        eventId: 202,
        sortOrder: 202,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "05:20",
        timeRemaining: "14:40",
        situationCode: "1451",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: { eventOwnerTeamId: 10, shootingPlayerId: 34, xCoord: 75, yCoord: 5 },
      },
    ]);

    const contexts = buildContextualFeatureContexts(events, [] as any, 10, 20);

    expect(contexts).toMatchObject([
      { eventId: 200, ownerPowerPlayAgeSeconds: 0, homePowerPlayAgeSeconds: 0 },
      { eventId: 201, homePowerPlayAgeSeconds: null, awayPowerPlayAgeSeconds: null },
      { eventId: 202, ownerPowerPlayAgeSeconds: 0, homePowerPlayAgeSeconds: 0 },
    ]);
  });

  it("returns null fatigue and movement proxies when the public inputs are insufficient", () => {
    const events = parseEvents([
      {
        eventId: 300,
        sortOrder: 300,
        periodDescriptor: { number: 2, periodType: "REG" },
        timeInPeriod: "10:00",
        timeRemaining: "10:00",
        situationCode: "1551",
        homeTeamDefendingSide: "right",
        typeCode: 504,
        typeDescKey: "giveaway",
        details: {
          eventOwnerTeamId: 20,
          playerId: 88,
        },
      },
      {
        eventId: 301,
        sortOrder: 301,
        periodDescriptor: { number: 2, periodType: "REG" },
        timeInPeriod: "10:03",
        timeRemaining: "09:57",
        situationCode: "1551",
        homeTeamDefendingSide: "right",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          xCoord: -75,
          yCoord: 7,
        },
      },
    ]);

    const contexts = buildContextualFeatureContexts(events, [] as any, 10, 20);

    expect(contexts[1]).toMatchObject({
      eventId: 301,
      shooterShiftAgeSeconds: null,
      ownerAverageShiftAgeSeconds: null,
      opponentAverageShiftAgeSeconds: null,
      eastWestMovementFeet: null,
      northSouthMovementFeet: null,
      crossedRoyalRoad: null,
    });
  });
});
