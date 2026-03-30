import { describe, expect, it } from "vitest";
import { buildStrengthContext, parseSituationCode } from "./nhlStrengthState";

import { parseNhlPlayByPlayEvents } from "./nhlPlayByPlayParser";

describe("nhlPlayByPlayParser", () => {
  it("extracts typed event rows with participants, shot fields, reasons, and score state", () => {
    const rows = parseNhlPlayByPlayEvents(
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
            timeInPeriod: "02:15",
            timeRemaining: "17:45",
            situationCode: "1451",
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
              homeScore: 0,
              awayScore: 0,
              homeSOG: 4,
              awaySOG: 3,
            },
          },
          {
            eventId: 201,
            sortOrder: 21,
            periodDescriptor: { number: 1, periodType: "REG" },
            timeInPeriod: "02:40",
            timeRemaining: "17:20",
            situationCode: "1451",
            homeTeamDefendingSide: "left",
            typeCode: 509,
            typeDescKey: "penalty",
            details: {
              eventOwnerTeamId: 20,
              committedByPlayerId: 55,
              drawnByPlayerId: 16,
              duration: 2,
              typeCode: "MIN",
              descKey: "tripping",
              reason: "tripping",
              secondaryReason: "stick infraction",
              homeScore: 0,
              awayScore: 0,
            },
          },
        ],
      },
      {
        sourcePlayByPlayHash: "hash-1",
        now: "2026-03-30T12:00:00.000Z",
      }
    );

    expect(rows).toHaveLength(2);

    expect(rows[0]).toMatchObject({
      game_id: 2025020418,
      season_id: 20252026,
      source_play_by_play_hash: "hash-1",
      event_id: 200,
      type_desc_key: "shot-on-goal",
      is_shot_like: true,
      is_goal: false,
      event_owner_team_id: 10,
      event_owner_side: "home",
      strength_exact: "4v5",
      strength_state: "PP",
      shooting_player_id: 91,
      goalie_in_net_id: 31,
      shot_type: "Wrist",
      x_coord: 68,
      y_coord: 12,
      zone_code: "O",
      home_score: 0,
      away_score: 0,
      home_sog: 4,
      away_sog: 3,
      updated_at: "2026-03-30T12:00:00.000Z",
      previous_event_id: null,
      next_event_id: 201,
    });

    expect(rows[1]).toMatchObject({
      event_id: 201,
      type_desc_key: "penalty",
      is_penalty: true,
      event_owner_team_id: 20,
      event_owner_side: "away",
      strength_exact: "4v5",
      strength_state: "SH",
      committed_by_player_id: 55,
      drawn_by_player_id: 16,
      penalty_duration_minutes: 2,
      penalty_type_code: "MIN",
      penalty_desc_key: "tripping",
      reason: "tripping",
      secondary_reason: "stick infraction",
      previous_event_id: 200,
      previous_event_type_desc_key: "shot-on-goal",
      next_event_id: null,
    });
  });

  it("sorts by sortOrder and derives deterministic sequence context across periods", () => {
    const rows = parseNhlPlayByPlayEvents(
      {
        id: 2025020999,
        season: 20252026,
        gameDate: "2026-03-30",
        homeTeam: { id: 1 },
        awayTeam: { id: 2 },
        plays: [
          {
            eventId: 3,
            sortOrder: 30,
            periodDescriptor: { number: 2, periodType: "REG" },
            timeInPeriod: "00:10",
            timeRemaining: "19:50",
            situationCode: "1551",
            typeDescKey: "goal",
            details: {
              eventOwnerTeamId: 1,
              scoringPlayerId: 88,
              homeScore: 1,
              awayScore: 0,
            },
          },
          {
            eventId: 1,
            sortOrder: 10,
            periodDescriptor: { number: 1, periodType: "REG" },
            timeInPeriod: "01:00",
            timeRemaining: "19:00",
            situationCode: "1551",
            typeDescKey: "faceoff",
            details: {
              eventOwnerTeamId: 2,
              winningPlayerId: 11,
              losingPlayerId: 22,
            },
          },
          {
            eventId: 2,
            sortOrder: 20,
            periodDescriptor: { number: 1, periodType: "REG" },
            timeInPeriod: "01:30",
            timeRemaining: "18:30",
            situationCode: "1551",
            typeDescKey: "shot-on-goal",
            details: {
              eventOwnerTeamId: 2,
              shootingPlayerId: 77,
            },
          },
        ],
      },
      {
        sourcePlayByPlayHash: "hash-2",
        now: "2026-03-30T12:00:00.000Z",
      }
    );

    expect(rows.map((row) => row.event_id)).toEqual([1, 2, 3]);
    expect(rows.map((row) => row.event_index)).toEqual([0, 1, 2]);
    expect(rows.map((row) => row.game_seconds_elapsed)).toEqual([60, 90, 1210]);
    expect(rows[1].seconds_since_previous_event).toBe(30);
    expect(rows[2].seconds_since_previous_event).toBe(1120);
    expect(rows[2]).toMatchObject({
      previous_event_id: 2,
      previous_event_sort_order: 20,
      previous_event_type_desc_key: "shot-on-goal",
      is_goal: true,
      scoring_player_id: 88,
    });
  });

  it("keeps validated empty-net and overtime strength decoding available to later layers", () => {
    const overtime = parseSituationCode("1331");
    const emptyNet = parseSituationCode("0651");

    expect(
      buildStrengthContext(overtime, 1, 1, 2)
    ).toEqual({
      strengthExact: "3v3",
      strengthState: "EV",
      eventOwnerSide: "home",
    });

    expect(
      buildStrengthContext(emptyNet, 2, 1, 2)
    ).toEqual({
      strengthExact: "6v5",
      strengthState: "EN",
      eventOwnerSide: "away",
    });
  });
});
