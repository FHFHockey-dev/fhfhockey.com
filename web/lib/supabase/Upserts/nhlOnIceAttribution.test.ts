import { describe, expect, it } from "vitest";

import {
  arePlayersOnIceTogether,
  buildOnIceAttributionForEvent,
  isEntityOnIce,
  isPlayerOnIce,
} from "./nhlOnIceAttribution";
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

describe("nhlOnIceAttribution", () => {
  it("attributes a power-play event to active home and away on-ice sets", () => {
    const stints = buildShiftStints([
      createShiftRow({ shift_id: 1, player_id: 11, team_id: 10, end_seconds: 40, duration_seconds: 40 }) as any,
      createShiftRow({ shift_id: 2, player_id: 12, team_id: 10, end_seconds: 40, duration_seconds: 40 }) as any,
      createShiftRow({ shift_id: 3, player_id: 13, team_id: 10, end_seconds: 40, duration_seconds: 40 }) as any,
      createShiftRow({ shift_id: 4, player_id: 14, team_id: 10, end_seconds: 40, duration_seconds: 40 }) as any,
      createShiftRow({ shift_id: 5, player_id: 15, team_id: 10, end_seconds: 40, duration_seconds: 40 }) as any,
      createShiftRow({ shift_id: 6, player_id: 21, team_id: 20, team_abbrev: "NYR", end_seconds: 40, duration_seconds: 40 }) as any,
      createShiftRow({ shift_id: 7, player_id: 22, team_id: 20, team_abbrev: "NYR", end_seconds: 40, duration_seconds: 40 }) as any,
      createShiftRow({ shift_id: 8, player_id: 23, team_id: 20, team_abbrev: "NYR", end_seconds: 40, duration_seconds: 40 }) as any,
      createShiftRow({ shift_id: 9, player_id: 24, team_id: 20, team_abbrev: "NYR", end_seconds: 40, duration_seconds: 40 }) as any,
    ]);

    const attribution = buildOnIceAttributionForEvent(
      {
        game_id: 2025020418,
        event_id: 200,
        period_number: 1,
        period_seconds_elapsed: 20,
        event_owner_team_id: 10,
        situation_code: "1451",
        strength_exact: "4v5",
      } as any,
      stints,
      10,
      20
    );

    expect(attribution).toMatchObject({
      stintFound: true,
      ownerPlayerIds: [11, 12, 13, 14, 15],
      opponentPlayerIds: [21, 22, 23, 24],
      homeTeam: {
        teamId: 10,
        playerIds: [11, 12, 13, 14, 15],
        strengthState: "PP",
        strengthExact: "4v5",
        isEventOwner: true,
      },
      awayTeam: {
        teamId: 20,
        playerIds: [21, 22, 23, 24],
        strengthState: "SH",
        strengthExact: "4v5",
        isEventOwner: false,
      },
    });
  });

  it("supports player, pairing, line, and team membership checks on the attributed stint", () => {
    const stints = buildShiftStints([
      createShiftRow({ shift_id: 1, player_id: 11, team_id: 10, end_seconds: 35, duration_seconds: 35 }) as any,
      createShiftRow({ shift_id: 2, player_id: 12, team_id: 10, end_seconds: 35, duration_seconds: 35 }) as any,
      createShiftRow({ shift_id: 3, player_id: 13, team_id: 10, end_seconds: 35, duration_seconds: 35 }) as any,
      createShiftRow({ shift_id: 4, player_id: 21, team_id: 20, team_abbrev: "NYR", end_seconds: 35, duration_seconds: 35 }) as any,
      createShiftRow({ shift_id: 5, player_id: 22, team_id: 20, team_abbrev: "NYR", end_seconds: 35, duration_seconds: 35 }) as any,
    ]);

    const attribution = buildOnIceAttributionForEvent(
      {
        game_id: 2025020418,
        event_id: 201,
        period_number: 1,
        period_seconds_elapsed: 15,
        event_owner_team_id: 20,
        situation_code: "1551",
        strength_exact: "5v5",
      } as any,
      stints,
      10,
      20
    );

    expect(isPlayerOnIce(attribution, 10, 12)).toBe(true);
    expect(arePlayersOnIceTogether(attribution, 10, [11, 12])).toBe(true);
    expect(isEntityOnIce(attribution, "pairing", 10, [11, 12])).toBe(true);
    expect(isEntityOnIce(attribution, "line", 10, [11, 12, 13])).toBe(true);
    expect(isEntityOnIce(attribution, "team", 20)).toBe(true);
    expect(isEntityOnIce(attribution, "line", 20, [21, 22, 23])).toBe(false);
  });

  it("marks empty-net events as EN for both team contexts while using stint membership", () => {
    const stints = buildShiftStints([
      createShiftRow({ shift_id: 1, player_id: 31, team_id: 10, period: 3, end_seconds: 50, duration_seconds: 50 }) as any,
      createShiftRow({ shift_id: 2, player_id: 32, team_id: 10, period: 3, end_seconds: 50, duration_seconds: 50 }) as any,
      createShiftRow({ shift_id: 3, player_id: 41, team_id: 20, team_abbrev: "NYR", period: 3, end_seconds: 50, duration_seconds: 50 }) as any,
      createShiftRow({ shift_id: 4, player_id: 42, team_id: 20, team_abbrev: "NYR", period: 3, end_seconds: 50, duration_seconds: 50 }) as any,
      createShiftRow({ shift_id: 5, player_id: 43, team_id: 20, team_abbrev: "NYR", period: 3, end_seconds: 50, duration_seconds: 50 }) as any,
      createShiftRow({ shift_id: 6, player_id: 44, team_id: 20, team_abbrev: "NYR", period: 3, end_seconds: 50, duration_seconds: 50 }) as any,
      createShiftRow({ shift_id: 7, player_id: 45, team_id: 20, team_abbrev: "NYR", period: 3, end_seconds: 50, duration_seconds: 50 }) as any,
      createShiftRow({ shift_id: 8, player_id: 46, team_id: 20, team_abbrev: "NYR", period: 3, end_seconds: 50, duration_seconds: 50 }) as any,
    ]);

    const attribution = buildOnIceAttributionForEvent(
      {
        game_id: 2025020418,
        event_id: 202,
        period_number: 3,
        period_seconds_elapsed: 48,
        event_owner_team_id: 20,
        situation_code: "0651",
        strength_exact: "6v5",
      } as any,
      stints,
      10,
      20
    );

    expect(attribution.homeTeam.strengthState).toBe("EN");
    expect(attribution.awayTeam.strengthState).toBe("EN");
    expect(attribution.ownerPlayerIds).toEqual([41, 42, 43, 44, 45, 46]);
    expect(attribution.opponentPlayerIds).toEqual([31, 32]);
  });

  it("returns empty on-ice sets when no active stint covers the event second", () => {
    const stints = buildShiftStints([
      createShiftRow({ shift_id: 1, player_id: 11, team_id: 10, start_seconds: 0, end_seconds: 10, duration_seconds: 10 }) as any,
      createShiftRow({ shift_id: 2, player_id: 21, team_id: 20, team_abbrev: "NYR", start_seconds: 0, end_seconds: 10, duration_seconds: 10 }) as any,
    ]);

    const attribution = buildOnIceAttributionForEvent(
      {
        game_id: 2025020418,
        event_id: 203,
        period_number: 1,
        period_seconds_elapsed: 15,
        event_owner_team_id: 10,
        situation_code: "1551",
        strength_exact: "5v5",
      } as any,
      stints,
      10,
      20
    );

    expect(attribution.stintFound).toBe(false);
    expect(attribution.homeTeam.playerIds).toEqual([]);
    expect(attribution.awayTeam.playerIds).toEqual([]);
    expect(attribution.ownerPlayerIds).toEqual([]);
    expect(attribution.opponentPlayerIds).toEqual([]);
  });
});
