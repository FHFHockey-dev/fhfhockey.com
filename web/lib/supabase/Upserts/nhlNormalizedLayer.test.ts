import { describe, expect, it } from "vitest";

import { normalizeCoordinatesToAttackingDirection } from "./nhlCoordinates";
import { evaluateNormalizedEventInclusion } from "./nhlEventInclusion";
import { buildOnIceAttributionForEvent } from "./nhlOnIceAttribution";
import { parseNhlPlayByPlayEvents } from "./nhlPlayByPlayParser";
import { buildShiftStints } from "./nhlShiftStints";

function createShiftRow(overrides: Record<string, unknown> = {}) {
  return {
    created_at: "2026-03-30T00:00:00.000Z",
    detail_code: null,
    duration: "0:30",
    duration_seconds: 30,
    end_seconds: 30,
    end_time: "0:30",
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

describe("nhlNormalizedLayer", () => {
  it("covers a standard regulation shot across parser, inclusion, coordinates, and on-ice attribution", () => {
    const [event] = parseNhlPlayByPlayEvents(
      {
        id: 2025020418,
        season: 20252026,
        gameDate: "2026-03-30",
        homeTeam: { id: 10, abbrev: "TOR" },
        awayTeam: { id: 20, abbrev: "NYR" },
        plays: [
          {
            eventId: 200,
            sortOrder: 20,
            periodDescriptor: { number: 1, periodType: "REG" },
            timeInPeriod: "00:20",
            timeRemaining: "19:40",
            situationCode: "1551",
            homeTeamDefendingSide: "left",
            typeCode: 506,
            typeDescKey: "shot-on-goal",
            details: {
              eventOwnerTeamId: 10,
              shootingPlayerId: 91,
              goalieInNetId: 31,
              shotType: "Wrist",
              xCoord: 68,
              yCoord: 12,
              zoneCode: "O",
            },
          },
        ],
      },
      {
        sourcePlayByPlayHash: "hash-std",
        now: "2026-03-30T12:00:00.000Z",
      }
    );

    const inclusion = evaluateNormalizedEventInclusion(event);
    const coords = normalizeCoordinatesToAttackingDirection(event.x_coord, event.y_coord, {
      homeTeamDefendingSide: event.home_team_defending_side as "left" | "right" | null,
      teamSide: event.event_owner_side,
    });
    const stints = buildShiftStints([
      createShiftRow({ shift_id: 1, player_id: 91, team_id: 10, end_seconds: 40, duration_seconds: 40 }) as any,
      createShiftRow({ shift_id: 2, player_id: 92, team_id: 10, end_seconds: 40, duration_seconds: 40 }) as any,
      createShiftRow({ shift_id: 3, player_id: 31, team_id: 20, team_abbrev: "NYR", end_seconds: 40, duration_seconds: 40 }) as any,
      createShiftRow({ shift_id: 4, player_id: 32, team_id: 20, team_abbrev: "NYR", end_seconds: 40, duration_seconds: 40 }) as any,
    ]);
    const attribution = buildOnIceAttributionForEvent(event, stints, 10, 20);

    expect(event).toMatchObject({
      type_desc_key: "shot-on-goal",
      strength_state: "EV",
      event_owner_side: "home",
      shooting_player_id: 91,
    });
    expect(inclusion).toMatchObject({
      includeInParity: true,
      includeInShotFeatures: true,
      isEmptyNetEvent: false,
      isOvertimeEvent: false,
    });
    expect(coords).toMatchObject({
      normalizedX: 68,
      normalizedY: 12,
      isMirrored: false,
      attackingSide: "right",
    });
    expect(attribution).toMatchObject({
      stintFound: true,
      ownerPlayerIds: [91, 92],
      opponentPlayerIds: [31, 32],
    });
  });

  it("covers a rare event shape with missing shot type and owner-relative fields left nullable", () => {
    const rows = parseNhlPlayByPlayEvents(
      {
        id: 2025020418,
        season: 20252026,
        gameDate: "2026-03-30",
        homeTeam: { id: 10, abbrev: "TOR" },
        awayTeam: { id: 20, abbrev: "NYR" },
        plays: [
          {
            eventId: 300,
            sortOrder: 30,
            periodDescriptor: { number: 2, periodType: "REG" },
            timeInPeriod: "05:10",
            timeRemaining: "14:50",
            situationCode: "1551",
            homeTeamDefendingSide: "right",
            typeCode: 507,
            typeDescKey: "blocked-shot",
            details: {
              blockingPlayerId: 77,
              shootingPlayerId: 66,
              xCoord: -54,
              yCoord: 18,
              zoneCode: "O",
            },
          },
          {
            eventId: 301,
            sortOrder: 31,
            periodDescriptor: { number: 2, periodType: "REG" },
            timeInPeriod: "05:30",
            timeRemaining: "14:30",
            situationCode: "1551",
            typeCode: 516,
            typeDescKey: "stoppage",
            details: {},
          },
        ],
      },
      {
        sourcePlayByPlayHash: "hash-rare",
        now: "2026-03-30T12:00:00.000Z",
      }
    );

    expect(rows[0]).toMatchObject({
      type_desc_key: "blocked-shot",
      is_shot_like: true,
      shot_type: null,
      blocking_player_id: 77,
      shooting_player_id: 66,
      x_coord: -54,
      y_coord: 18,
    });

    expect(rows[1]).toMatchObject({
      type_desc_key: "stoppage",
      event_owner_team_id: null,
      event_owner_side: null,
      strength_state: null,
    });
  });

  it("covers overtime states and keeps them included with EV 3v3 handling", () => {
    const [event] = parseNhlPlayByPlayEvents(
      {
        id: 2025021018,
        season: 20252026,
        gameDate: "2026-03-10",
        homeTeam: { id: 12, abbrev: "CAR" },
        awayTeam: { id: 5, abbrev: "PIT" },
        plays: [
          {
            eventId: 400,
            sortOrder: 400,
            periodDescriptor: { number: 4, periodType: "OT" },
            timeInPeriod: "00:15",
            timeRemaining: "04:45",
            situationCode: "1331",
            homeTeamDefendingSide: "left",
            typeCode: 506,
            typeDescKey: "shot-on-goal",
            details: {
              eventOwnerTeamId: 12,
              shootingPlayerId: 19,
              xCoord: 72,
              yCoord: -8,
              zoneCode: "O",
            },
          },
        ],
      },
      {
        sourcePlayByPlayHash: "hash-ot",
        now: "2026-03-30T12:00:00.000Z",
      }
    );

    expect(event).toMatchObject({
      period_number: 4,
      period_type: "OT",
      strength_exact: "3v3",
      strength_state: "EV",
    });
    expect(evaluateNormalizedEventInclusion(event)).toMatchObject({
      includeInParity: true,
      includeInShotFeatures: true,
      isOvertimeEvent: true,
      hasRareManpower: false,
    });
  });

  it("covers pulled-goalie and shift-overlap edge cases together", () => {
    const [event] = parseNhlPlayByPlayEvents(
      {
        id: 2025021103,
        season: 20252026,
        gameDate: "2026-03-21",
        homeTeam: { id: 28, abbrev: "SJS" },
        awayTeam: { id: 4, abbrev: "PHI" },
        plays: [
          {
            eventId: 500,
            sortOrder: 500,
            periodDescriptor: { number: 3, periodType: "REG" },
            timeInPeriod: "19:48",
            timeRemaining: "00:12",
            situationCode: "0651",
            homeTeamDefendingSide: "right",
            typeCode: 505,
            typeDescKey: "goal",
            details: {
              eventOwnerTeamId: 4,
              scoringPlayerId: 11,
              homeScore: 2,
              awayScore: 4,
            },
          },
        ],
      },
      {
        sourcePlayByPlayHash: "hash-en",
        now: "2026-03-30T12:00:00.000Z",
      }
    );

    const stints = buildShiftStints([
      createShiftRow({ game_id: 2025021103, team_id: 4, team_abbrev: "PHI", period: 3, shift_id: 1, player_id: 11, start_seconds: 1180, end_seconds: 0, duration_seconds: 20 }) as any,
      createShiftRow({ game_id: 2025021103, team_id: 4, team_abbrev: "PHI", period: 3, shift_id: 2, player_id: 12, start_seconds: 1180, end_seconds: 1200, duration_seconds: 20 }) as any,
      createShiftRow({ game_id: 2025021103, team_id: 4, team_abbrev: "PHI", period: 3, shift_id: 3, player_id: 13, start_seconds: 1185, end_seconds: 1200, duration_seconds: 15 }) as any,
      createShiftRow({ game_id: 2025021103, team_id: 28, team_abbrev: "SJS", period: 3, shift_id: 4, player_id: 21, start_seconds: 1180, end_seconds: 1200, duration_seconds: 20 }) as any,
      createShiftRow({ game_id: 2025021103, team_id: 28, team_abbrev: "SJS", period: 3, shift_id: 5, player_id: 22, start_seconds: 1180, end_seconds: 1200, duration_seconds: 20 }) as any,
    ]);
    const attribution = buildOnIceAttributionForEvent(event, stints, 28, 4);

    expect(event).toMatchObject({
      strength_exact: "6v5",
      strength_state: "EN",
      event_owner_side: "away",
      scoring_player_id: 11,
    });
    expect(evaluateNormalizedEventInclusion(event)).toMatchObject({
      includeInParity: true,
      includeInOnIceParity: true,
      isEmptyNetEvent: true,
    });
    expect(attribution).toMatchObject({
      stintFound: true,
      awayTeam: {
        strengthState: "EN",
        playerIds: [11, 12, 13],
      },
      homeTeam: {
        strengthState: "EN",
        playerIds: [21, 22],
      },
      ownerPlayerIds: [11, 12, 13],
      opponentPlayerIds: [21, 22],
    });
  });
});
