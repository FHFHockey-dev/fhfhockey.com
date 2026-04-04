import { describe, expect, it } from "vitest";

import {
  buildShiftStints,
  findShiftStintAtTime,
  getOnIcePlayersForTeam,
  normalizeShiftInterval,
  normalizeShiftIntervals,
} from "./nhlShiftStints";

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

describe("nhlShiftStints", () => {
  it("normalizes raw shift rows into usable intervals", () => {
    const row = createShiftRow({
      shift_id: 2001,
      player_id: 91,
      team_id: 10,
      period: 2,
      start_seconds: 120,
      end_seconds: 0,
      duration_seconds: 45,
    });

    expect(normalizeShiftInterval(row as any)).toEqual({
      gameId: 2025020418,
      shiftId: 2001,
      seasonId: 20252026,
      gameDate: "2026-03-30",
      teamId: 10,
      playerId: 91,
      period: 2,
      startSecond: 120,
      endSecond: 165,
      durationSeconds: 45,
      shiftNumber: 1,
    });
  });

  it("normalizes pg-shaped bigint string identifiers into numeric interval fields", () => {
    const row = createShiftRow({
      game_id: "2025020418",
      shift_id: "2002",
      season_id: "20252026",
      team_id: "10",
      player_id: "91",
      shift_number: "4",
      period: "2",
      start_seconds: "120",
      end_seconds: "165",
      duration_seconds: "45",
    });

    expect(normalizeShiftInterval(row as any)).toEqual({
      gameId: 2025020418,
      shiftId: 2002,
      seasonId: 20252026,
      gameDate: "2026-03-30",
      teamId: 10,
      playerId: 91,
      period: 2,
      startSecond: 120,
      endSecond: 165,
      durationSeconds: 45,
      shiftNumber: 4,
    });
  });

  it("sorts and preserves overlapping intervals from the raw feed", () => {
    const intervals = normalizeShiftIntervals([
      createShiftRow({
        shift_id: 2,
        player_id: 12,
        start_seconds: 25,
        end_seconds: 55,
        duration_seconds: 30,
      }) as any,
      createShiftRow({
        shift_id: 1,
        player_id: 11,
        start_seconds: 0,
        end_seconds: 40,
        duration_seconds: 40,
      }) as any,
    ]);

    expect(intervals.map((interval) => interval.shiftId)).toEqual([1, 2]);
    expect(intervals.map((interval) => [interval.startSecond, interval.endSecond])).toEqual([
      [0, 40],
      [25, 55],
    ]);
  });

  it("deduplicates identical shift windows for the same player so TOI is not double-counted", () => {
    const intervals = normalizeShiftIntervals([
      createShiftRow({
        shift_id: 10,
        player_id: "11",
        team_id: "10",
        period: "2",
        start_seconds: "1020",
        end_seconds: "1081",
        duration_seconds: "61",
      }) as any,
      createShiftRow({
        shift_id: 11,
        player_id: "11",
        team_id: "10",
        period: "2",
        start_seconds: "1020",
        end_seconds: "1081",
        duration_seconds: "61",
      }) as any,
    ]);

    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toMatchObject({
      shiftId: 10,
      playerId: 11,
      teamId: 10,
      period: 2,
      startSecond: 1020,
      endSecond: 1081,
      durationSeconds: 61,
    });
  });

  it("builds merged stints with per-team on-ice player sets across line changes", () => {
    const stints = buildShiftStints([
      createShiftRow({
        shift_id: 1,
        player_id: 11,
        team_id: 10,
        start_seconds: 0,
        end_seconds: 40,
        duration_seconds: 40,
      }) as any,
      createShiftRow({
        shift_id: 2,
        player_id: 12,
        team_id: 10,
        start_seconds: 0,
        end_seconds: 30,
        duration_seconds: 30,
      }) as any,
      createShiftRow({
        shift_id: 3,
        player_id: 13,
        team_id: 10,
        start_seconds: 20,
        end_seconds: 40,
        duration_seconds: 20,
      }) as any,
      createShiftRow({
        shift_id: 4,
        player_id: 21,
        team_id: 20,
        team_abbrev: "NYR",
        start_seconds: 0,
        end_seconds: 40,
        duration_seconds: 40,
      }) as any,
      createShiftRow({
        shift_id: 5,
        player_id: 22,
        team_id: 20,
        team_abbrev: "NYR",
        start_seconds: 10,
        end_seconds: 40,
        duration_seconds: 30,
      }) as any,
    ]);

    expect(stints).toEqual([
      {
        gameId: 2025020418,
        seasonId: 20252026,
        gameDate: "2026-03-30",
        period: 1,
        startSecond: 0,
        endSecond: 10,
        durationSeconds: 10,
        teams: [
          { teamId: 10, playerIds: [11, 12] },
          { teamId: 20, playerIds: [21] },
        ],
        onIcePlayerIds: [11, 12, 21],
      },
      {
        gameId: 2025020418,
        seasonId: 20252026,
        gameDate: "2026-03-30",
        period: 1,
        startSecond: 10,
        endSecond: 20,
        durationSeconds: 10,
        teams: [
          { teamId: 10, playerIds: [11, 12] },
          { teamId: 20, playerIds: [21, 22] },
        ],
        onIcePlayerIds: [11, 12, 21, 22],
      },
      {
        gameId: 2025020418,
        seasonId: 20252026,
        gameDate: "2026-03-30",
        period: 1,
        startSecond: 20,
        endSecond: 30,
        durationSeconds: 10,
        teams: [
          { teamId: 10, playerIds: [11, 12, 13] },
          { teamId: 20, playerIds: [21, 22] },
        ],
        onIcePlayerIds: [11, 12, 13, 21, 22],
      },
      {
        gameId: 2025020418,
        seasonId: 20252026,
        gameDate: "2026-03-30",
        period: 1,
        startSecond: 30,
        endSecond: 40,
        durationSeconds: 10,
        teams: [
          { teamId: 10, playerIds: [11, 13] },
          { teamId: 20, playerIds: [21, 22] },
        ],
        onIcePlayerIds: [11, 13, 21, 22],
      },
    ]);
  });

  it("supports lookups for the active stint and team on-ice players at an event second", () => {
    const stints = buildShiftStints([
      createShiftRow({
        shift_id: 1,
        player_id: 31,
        team_id: 10,
        start_seconds: 0,
        end_seconds: 50,
        duration_seconds: 50,
      }) as any,
      createShiftRow({
        shift_id: 2,
        player_id: 41,
        team_id: 20,
        team_abbrev: "NYR",
        start_seconds: 0,
        end_seconds: 50,
        duration_seconds: 50,
      }) as any,
      createShiftRow({
        shift_id: 3,
        player_id: 42,
        team_id: 20,
        team_abbrev: "NYR",
        start_seconds: 15,
        end_seconds: 50,
        duration_seconds: 35,
      }) as any,
    ]);

    expect(findShiftStintAtTime(stints, 1, 5)).toMatchObject({
      startSecond: 0,
      endSecond: 15,
    });
    expect(findShiftStintAtTime(stints, 1, 25)).toMatchObject({
      startSecond: 15,
      endSecond: 50,
    });
    expect(getOnIcePlayersForTeam(stints, 1, 25, 20)).toEqual([41, 42]);
    expect(getOnIcePlayersForTeam(stints, 1, 25, 10)).toEqual([31]);
    expect(getOnIcePlayersForTeam(stints, 2, 25, 10)).toEqual([]);
  });
});
