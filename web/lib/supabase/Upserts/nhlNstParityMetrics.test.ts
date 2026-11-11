import { describe, expect, it } from "vitest";

import {
  buildNstParityMetrics,
  PARITY_CHANCE_DEFINITIONS,
  parityPdoToNstScale,
} from "./nhlNstParityMetrics";
import { buildShotFeatureRows } from "./nhlShotFeatureBuilder";
import { parseNhlPlayByPlayEvents } from "./nhlPlayByPlayParser";

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
      sourcePlayByPlayHash: "parity-hash",
      now: "2026-03-30T12:00:00.000Z",
    }
  );
}

describe("nhlNstParityMetrics", () => {
  it("counts own-goal scorers as goals without adding shot credit", () => {
    const events = parseEvents([
      {
        eventId: 100,
        sortOrder: 100,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:10",
        timeRemaining: "19:50",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 505,
        typeDescKey: "goal",
        goalModifier: "own-goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 91,
          goalieInNetId: 31,
          xCoord: 88,
          yCoord: 8,
          zoneCode: "O",
        },
      },
    ]);

    const shiftRows = [
      createShiftRow({ shift_id: 1, player_id: 91, team_id: 10, start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
      createShiftRow({ shift_id: 2, player_id: 31, team_id: 20, team_abbrev: "NYR", start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
    ] as any[];

    const shotFeatures = buildShotFeatureRows(events, shiftRows as any, 10, 20);
    const output = buildNstParityMetrics(events, shotFeatures, shiftRows as any, {
      date: "2026-03-30",
      season: 20252026,
      homeTeamId: 10,
      awayTeamId: 20,
    });

    const skater91All = output.skaters.all.counts.find((row) => row.player_id === 91)!;

    expect(skater91All).toMatchObject({
      goals: 1,
      total_points: 1,
      shots: 0,
      icf: 0,
      iff: 0,
    });
  });

  it("reconstructs all-situations and PP skater metrics plus on-ice counts from normalized events and shifts", () => {
    const events = parseEvents([
      {
        eventId: 100,
        sortOrder: 100,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:05",
        timeRemaining: "19:55",
        situationCode: "1451",
        homeTeamDefendingSide: "left",
        typeCode: 502,
        typeDescKey: "faceoff",
        details: {
          eventOwnerTeamId: 10,
          winningPlayerId: 91,
          losingPlayerId: 21,
          xCoord: 69,
          yCoord: 22,
          zoneCode: "O",
        },
      },
      {
        eventId: 101,
        sortOrder: 101,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:10",
        timeRemaining: "19:50",
        situationCode: "1451",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          goalieInNetId: 31,
          shotType: "Wrist",
          xCoord: 75,
          yCoord: 10,
          zoneCode: "O",
        },
      },
      {
        eventId: 102,
        sortOrder: 102,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:12",
        timeRemaining: "19:48",
        situationCode: "1451",
        homeTeamDefendingSide: "left",
        typeCode: 505,
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 34,
          assist1PlayerId: 91,
          goalieInNetId: 31,
          shotType: "Tip-In",
          xCoord: 82,
          yCoord: -2,
          zoneCode: "O",
        },
      },
      {
        eventId: 103,
        sortOrder: 103,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:16",
        timeRemaining: "19:44",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 504,
        typeDescKey: "giveaway",
        details: {
          eventOwnerTeamId: 20,
          playerId: 21,
          xCoord: 10,
          yCoord: -5,
          zoneCode: "N",
        },
      },
      {
        eventId: 104,
        sortOrder: 104,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:20",
        timeRemaining: "19:40",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 507,
        typeDescKey: "missed-shot",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          shotType: "Snap",
          reason: "wide-right",
          xCoord: 70,
          yCoord: 5,
          zoneCode: "O",
        },
      },
    ]);

    const shiftRows = [
      createShiftRow({ shift_id: 1, player_id: 91, team_id: 10, start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
      createShiftRow({ shift_id: 2, player_id: 34, team_id: 10, start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
      createShiftRow({ shift_id: 3, player_id: 21, team_id: 20, team_abbrev: "NYR", start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
      createShiftRow({ shift_id: 4, player_id: 31, team_id: 20, team_abbrev: "NYR", start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
    ] as any[];

    const shotFeatures = buildShotFeatureRows(events, shiftRows as any, 10, 20);
    const output = buildNstParityMetrics(events, shotFeatures, shiftRows as any, {
      date: "2026-03-30",
      season: 20252026,
      homeTeamId: 10,
      awayTeamId: 20,
    });

    const skater91All = output.skaters.all.counts.find((row) => row.player_id === 91)!;
    const skater91Pp = output.skaters.pp.counts.find((row) => row.player_id === 91)!;
    const skater91AllOi = output.skaters.all.countsOi.find((row) => row.player_id === 91)!;
    const skater91PpOi = output.skaters.pp.countsOi.find((row) => row.player_id === 91)!;
    const skater34Pp = output.skaters.pp.counts.find((row) => row.player_id === 34)!;

    expect(skater91All).toMatchObject({
      toi: 30,
      goals: 0,
      total_assists: 1,
      total_points: 1,
      shots: 1,
      icf: 2,
      iff: 2,
      rush_attempts: 1,
      rebounds_created: 1,
      faceoffs_won: 1,
    });
    expect(skater91Pp).toMatchObject({
      toi: 11,
      shots: 1,
      icf: 1,
      iff: 1,
      faceoffs_won: 1,
    });
    expect(skater34Pp).toMatchObject({
      goals: 1,
      total_points: 1,
      shots: 1,
      icf: 1,
      iff: 1,
    });
    expect(skater91AllOi).toMatchObject({
      cf: 3,
      ff: 3,
      sf: 2,
      gf: 1,
      ca: 0,
      off_zone_faceoffs: 1,
      off_zone_starts: 0,
    });
    expect(skater91PpOi).toMatchObject({
      cf: 2,
      ff: 2,
      sf: 2,
      gf: 1,
    });
  });

  it("reconstructs goalie against metrics across all, EV, 5v5, and PP splits", () => {
    const events = parseEvents([
      {
        eventId: 200,
        sortOrder: 200,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:05",
        timeRemaining: "19:55",
        situationCode: "1451",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          goalieInNetId: 31,
          xCoord: 73,
          yCoord: 6,
          zoneCode: "O",
        },
      },
      {
        eventId: 201,
        sortOrder: 201,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:10",
        timeRemaining: "19:50",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 34,
          goalieInNetId: 31,
          xCoord: 75,
          yCoord: -3,
          zoneCode: "O",
        },
      },
      {
        eventId: 202,
        sortOrder: 202,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:12",
        timeRemaining: "19:48",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 505,
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 34,
          goalieInNetId: 31,
          xCoord: 81,
          yCoord: 0,
          zoneCode: "O",
        },
      },
    ]);

    const shiftRows = [
      createShiftRow({ shift_id: 1, player_id: 91, team_id: 10, start_seconds: 0, end_seconds: 20, duration_seconds: 20 }),
      createShiftRow({ shift_id: 2, player_id: 34, team_id: 10, start_seconds: 0, end_seconds: 20, duration_seconds: 20 }),
      createShiftRow({ shift_id: 3, player_id: 31, team_id: 20, team_abbrev: "NYR", start_seconds: 0, end_seconds: 20, duration_seconds: 20 }),
    ] as any[];

    const shotFeatures = buildShotFeatureRows(events, shiftRows as any, 10, 20);
    const output = buildNstParityMetrics(events, shotFeatures, shiftRows as any, {
      date: "2026-03-30",
      season: 20252026,
      homeTeamId: 10,
      awayTeamId: 20,
    });

    const goalieAll = output.goalies.all.counts.find((row) => row.player_id === 31)!;
    const goalieEv = output.goalies.ev.counts.find((row) => row.player_id === 31)!;
    const goalieFiveOnFive = output.goalies.fiveOnFive.counts.find((row) => row.player_id === 31)!;
    const goaliePk = output.goalies.pk.counts.find((row) => row.player_id === 31)!;

    expect(goalieAll).toMatchObject({
      toi: 20,
      shots_against: 3,
      saves: 2,
      goals_against: 1,
      rebound_attempts_against: 1,
    });
    expect(goalieEv).toMatchObject({
      shots_against: 2,
      goals_against: 1,
    });
    expect(goalieFiveOnFive).toMatchObject({
      shots_against: 2,
      goals_against: 1,
    });
    expect(goaliePk).toMatchObject({
      shots_against: 1,
      saves: 1,
      goals_against: 0,
    });
  });

  it("supports extended goalie strength splits for 5v4 PP, 4v5 PK, 3v3, and against-empty-net states", () => {
    const events = parseEvents([
      {
        eventId: 210,
        sortOrder: 210,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:02",
        timeRemaining: "19:58",
        situationCode: "1541",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          goalieInNetId: 31,
          xCoord: 73,
          yCoord: 8,
          zoneCode: "O",
        },
      },
      {
        eventId: 211,
        sortOrder: 211,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:06",
        timeRemaining: "19:54",
        situationCode: "1451",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 34,
          goalieInNetId: 31,
          xCoord: 76,
          yCoord: -5,
          zoneCode: "O",
        },
      },
      {
        eventId: 212,
        sortOrder: 212,
        periodDescriptor: { number: 1, periodType: "OT" },
        timeInPeriod: "00:10",
        timeRemaining: "04:50",
        situationCode: "1331",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          goalieInNetId: 31,
          xCoord: 72,
          yCoord: 2,
          zoneCode: "O",
        },
      },
      {
        eventId: 213,
        sortOrder: 213,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:14",
        timeRemaining: "19:46",
        situationCode: "1550",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 34,
          goalieInNetId: 31,
          xCoord: 78,
          yCoord: 3,
          zoneCode: "O",
        },
      },
    ]);

    const shiftRows = [
      createShiftRow({ shift_id: 10, player_id: 91, team_id: 10, start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
      createShiftRow({ shift_id: 11, player_id: 34, team_id: 10, start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
      createShiftRow({ shift_id: 12, player_id: 31, team_id: 20, team_abbrev: "NYR", start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
    ] as any[];

    const shotFeatures = buildShotFeatureRows(events, shiftRows as any, 10, 20);
    const output = buildNstParityMetrics(events, shotFeatures, shiftRows as any, {
      date: "2026-03-30",
      season: 20252026,
      homeTeamId: 10,
      awayTeamId: 20,
    });

    expect(output.goalies.fiveOnFourPP.counts.find((row) => row.player_id === 31)).toMatchObject({
      shots_against: 1,
      saves: 1,
      goals_against: 0,
    });
    expect(output.goalies.fourOnFivePK.counts.find((row) => row.player_id === 31)).toMatchObject({
      shots_against: 1,
      saves: 1,
      goals_against: 0,
    });
    expect(output.goalies.threeOnThree.counts.find((row) => row.player_id === 31)).toMatchObject({
      shots_against: 1,
      saves: 1,
      goals_against: 0,
    });
    expect(output.goalies.againstEmptyNet.counts.find((row) => row.player_id === 31)).toMatchObject({
      shots_against: 1,
      saves: 1,
      goals_against: 0,
    });
  });

  it("filters goalie parity by score state using the team-relative pre-event score buckets", () => {
    const events = parseEvents([
      {
        eventId: 220,
        sortOrder: 220,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:02",
        timeRemaining: "19:58",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 505,
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 20,
          scoringPlayerId: 21,
          goalieInNetId: 41,
          homeScore: 0,
          awayScore: 1,
          xCoord: -78,
          yCoord: 4,
          zoneCode: "O",
        },
      },
      {
        eventId: 221,
        sortOrder: 221,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:05",
        timeRemaining: "19:55",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          goalieInNetId: 31,
          homeScore: 0,
          awayScore: 1,
          xCoord: 75,
          yCoord: 8,
          zoneCode: "O",
        },
      },
      {
        eventId: 222,
        sortOrder: 222,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:08",
        timeRemaining: "19:52",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 505,
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 91,
          goalieInNetId: 31,
          homeScore: 1,
          awayScore: 1,
          xCoord: 80,
          yCoord: -1,
          zoneCode: "O",
        },
      },
      {
        eventId: 223,
        sortOrder: 223,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:12",
        timeRemaining: "19:48",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 34,
          goalieInNetId: 31,
          homeScore: 1,
          awayScore: 1,
          xCoord: 77,
          yCoord: 3,
          zoneCode: "O",
        },
      },
    ]);

    const shiftRows = [
      createShiftRow({ shift_id: 20, player_id: 91, team_id: 10, start_seconds: 0, end_seconds: 20, duration_seconds: 20 }),
      createShiftRow({ shift_id: 21, player_id: 34, team_id: 10, start_seconds: 0, end_seconds: 20, duration_seconds: 20 }),
      createShiftRow({ shift_id: 22, player_id: 21, team_id: 20, team_abbrev: "NYR", start_seconds: 0, end_seconds: 20, duration_seconds: 20 }),
      createShiftRow({ shift_id: 23, player_id: 31, team_id: 20, team_abbrev: "NYR", start_seconds: 0, end_seconds: 20, duration_seconds: 20 }),
      createShiftRow({ shift_id: 24, player_id: 41, team_id: 10, start_seconds: 0, end_seconds: 20, duration_seconds: 20 }),
    ] as any[];

    const shotFeatures = buildShotFeatureRows(events, shiftRows as any, 10, 20);

    const upOneOutput = buildNstParityMetrics(events, shotFeatures, shiftRows as any, {
      date: "2026-03-30",
      season: 20252026,
      homeTeamId: 10,
      awayTeamId: 20,
      scoreState: "upOne",
    });
    const tiedOutput = buildNstParityMetrics(events, shotFeatures, shiftRows as any, {
      date: "2026-03-30",
      season: 20252026,
      homeTeamId: 10,
      awayTeamId: 20,
      scoreState: "tied",
    });

    expect(upOneOutput.goalies.all.counts.find((row) => row.player_id === 31)).toMatchObject({
      shots_against: 2,
      saves: 1,
      goals_against: 1,
    });
    expect(tiedOutput.goalies.all.counts.find((row) => row.player_id === 31)).toMatchObject({
      shots_against: 1,
      saves: 1,
      goals_against: 0,
    });
  });

  it("preserves skater exact counts when shift rows come from pg bigint string fields", () => {
    const events = parseEvents([
      {
        eventId: 300,
        sortOrder: 300,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:05",
        timeRemaining: "19:55",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 502,
        typeDescKey: "faceoff",
        details: {
          eventOwnerTeamId: 10,
          winningPlayerId: 91,
          losingPlayerId: 21,
          zoneCode: "O",
        },
      },
      {
        eventId: 301,
        sortOrder: 301,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:08",
        timeRemaining: "19:52",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          goalieInNetId: 31,
          xCoord: 75,
          yCoord: 8,
          zoneCode: "O",
        },
      },
      {
        eventId: 302,
        sortOrder: 302,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:10",
        timeRemaining: "19:50",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 507,
        typeDescKey: "missed-shot",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          xCoord: 72,
          yCoord: 5,
          zoneCode: "O",
          reason: "wide-left",
        },
      },
      {
        eventId: 303,
        sortOrder: 303,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:12",
        timeRemaining: "19:48",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 503,
        typeDescKey: "hit",
        details: {
          eventOwnerTeamId: 20,
          hittingPlayerId: 21,
          hitteePlayerId: 91,
          zoneCode: "N",
        },
      },
      {
        eventId: 304,
        sortOrder: 304,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:14",
        timeRemaining: "19:46",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 525,
        typeDescKey: "takeaway",
        details: {
          eventOwnerTeamId: 10,
          playerId: 91,
        },
      },
      {
        eventId: 305,
        sortOrder: 305,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:16",
        timeRemaining: "19:44",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 505,
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 34,
          assist1PlayerId: 91,
          goalieInNetId: 31,
          xCoord: 82,
          yCoord: -1,
          zoneCode: "O",
        },
      },
    ]);

    const shiftRows = [
      createShiftRow({
        game_id: "2025020418",
        shift_id: "21",
        player_id: "91",
        team_id: "10",
        start_seconds: "0",
        end_seconds: "30",
        duration_seconds: "30",
      }),
      createShiftRow({
        game_id: "2025020418",
        shift_id: "22",
        player_id: "34",
        team_id: "10",
        start_seconds: "0",
        end_seconds: "30",
        duration_seconds: "30",
      }),
      createShiftRow({
        game_id: "2025020418",
        shift_id: "23",
        player_id: "21",
        team_id: "20",
        team_abbrev: "NYR",
        start_seconds: "0",
        end_seconds: "30",
        duration_seconds: "30",
      }),
      createShiftRow({
        game_id: "2025020418",
        shift_id: "24",
        player_id: "31",
        team_id: "20",
        team_abbrev: "NYR",
        start_seconds: "0",
        end_seconds: "30",
        duration_seconds: "30",
      }),
    ] as any[];

    const shotFeatures = buildShotFeatureRows(events, shiftRows as any, 10, 20);
    const output = buildNstParityMetrics(events, shotFeatures, shiftRows as any, {
      date: "2026-03-30",
      season: 20252026,
      homeTeamId: 10,
      awayTeamId: 20,
    });

    const skater91 = output.skaters.all.counts.find((row) => row.player_id === 91)!;

    expect(skater91).toMatchObject({
      toi: 30,
      total_assists: 1,
      first_assists: 1,
      total_points: 1,
      shots: 1,
      icf: 2,
      iff: 2,
      takeaways: 1,
      hits_taken: 1,
      faceoffs_won: 1,
      faceoffs_lost: 0,
    });
  });

  it("does not double-count TOI when duplicate shift windows exist for the same player", () => {
    const events = parseEvents([
      {
        eventId: 600,
        sortOrder: 600,
        periodDescriptor: { number: 2, periodType: "REG" },
        timeInPeriod: "17:00",
        timeRemaining: "03:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 516,
        typeDescKey: "stoppage",
        details: {},
      },
      {
        eventId: 601,
        sortOrder: 601,
        periodDescriptor: { number: 2, periodType: "REG" },
        timeInPeriod: "18:01",
        timeRemaining: "01:59",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 516,
        typeDescKey: "stoppage",
        details: {},
      },
    ]);

    const shiftRows = [
      createShiftRow({
        shift_id: "31",
        player_id: "91",
        team_id: "10",
        period: "2",
        start_seconds: "1020",
        end_seconds: "1081",
        duration_seconds: "61",
      }),
      createShiftRow({
        shift_id: "32",
        player_id: "91",
        team_id: "10",
        period: "2",
        start_seconds: "1020",
        end_seconds: "1081",
        duration_seconds: "61",
      }),
      createShiftRow({
        shift_id: "33",
        player_id: "21",
        team_id: "20",
        team_abbrev: "NYR",
        period: "2",
        start_seconds: "1020",
        end_seconds: "1081",
        duration_seconds: "61",
      }),
    ] as any[];

    const shotFeatures = buildShotFeatureRows(events, shiftRows as any, 10, 20);
    const output = buildNstParityMetrics(events, shotFeatures, shiftRows as any, {
      date: "2026-03-30",
      season: 20252026,
      homeTeamId: 10,
      awayTeamId: 20,
    });

    const skater91 = output.skaters.all.counts.find((row) => row.player_id === 91)!;
    expect(skater91.toi).toBe(61);
  });

  it("excludes penalty-shot and shootout events from parity while preserving EV, PP, and PK split outputs", () => {
    const events = parseEvents([
      {
        eventId: 400,
        sortOrder: 400,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:05",
        timeRemaining: "19:55",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          goalieInNetId: 31,
          xCoord: 74,
          yCoord: 6,
          zoneCode: "O",
        },
      },
      {
        eventId: 401,
        sortOrder: 401,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:10",
        timeRemaining: "19:50",
        situationCode: "1451",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          goalieInNetId: 31,
          xCoord: 77,
          yCoord: -2,
          zoneCode: "O",
        },
      },
      {
        eventId: 402,
        sortOrder: 402,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:20",
        timeRemaining: "19:40",
        situationCode: "1541",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 20,
          shootingPlayerId: 21,
          goalieInNetId: 30,
          xCoord: -76,
          yCoord: 5,
          zoneCode: "O",
        },
      },
      {
        eventId: 403,
        sortOrder: 403,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:25",
        timeRemaining: "19:35",
        situationCode: "1011",
        homeTeamDefendingSide: "left",
        typeCode: 505,
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 34,
          goalieInNetId: 31,
          reason: "Penalty Shot",
          xCoord: 81,
          yCoord: 0,
          zoneCode: "O",
        },
      },
      {
        eventId: 404,
        sortOrder: 404,
        periodDescriptor: { number: 5, periodType: "SO" },
        timeInPeriod: "00:05",
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
          zoneCode: "O",
        },
      },
    ]);

    const shiftRows = [
      createShiftRow({ shift_id: 10, player_id: 91, team_id: 10, start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
      createShiftRow({ shift_id: 11, player_id: 34, team_id: 10, start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
      createShiftRow({ shift_id: 12, player_id: 30, team_id: 10, start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
      createShiftRow({ shift_id: 13, player_id: 21, team_id: 20, team_abbrev: "NYR", start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
      createShiftRow({ shift_id: 14, player_id: 31, team_id: 20, team_abbrev: "NYR", start_seconds: 0, end_seconds: 30, duration_seconds: 30 }),
    ] as any[];

    const shotFeatures = buildShotFeatureRows(events, shiftRows as any, 10, 20);
    const output = buildNstParityMetrics(events, shotFeatures, shiftRows as any, {
      date: "2026-03-30",
      season: 20252026,
      homeTeamId: 10,
      awayTeamId: 20,
    });

    expect(shotFeatures.map((row) => row.eventId)).toEqual([400, 401, 402]);

    const skater91All = output.skaters.all.counts.find((row) => row.player_id === 91)!;
    const skater91Ev = output.skaters.ev.counts.find((row) => row.player_id === 91)!;
    const skater91FiveOnFive = output.skaters.fiveOnFive.counts.find(
      (row) => row.player_id === 91
    )!;
    const skater91Pp = output.skaters.pp.counts.find((row) => row.player_id === 91)!;
    const skater91Pk = output.skaters.pk.counts.find((row) => row.player_id === 91)!;
    const skater91PkOi = output.skaters.pk.countsOi.find((row) => row.player_id === 91)!;
    const skater91EvRates = output.skaters.ev.rates.find((row) => row.player_id === 91)!;
    const skater91PpRates = output.skaters.pp.rates.find((row) => row.player_id === 91)!;
    const skater34All = output.skaters.all.counts.find((row) => row.player_id === 34)!;
    const goalie31All = output.goalies.all.counts.find((row) => row.player_id === 31)!;
    const goalie31Ev = output.goalies.ev.counts.find((row) => row.player_id === 31)!;
    const goalie31Pk = output.goalies.pk.counts.find((row) => row.player_id === 31)!;

    expect(skater91All).toMatchObject({
      toi: 30,
      shots: 2,
      icf: 2,
      iff: 2,
    });
    expect(skater91Ev).toMatchObject({
      toi: 5,
      shots: 1,
      icf: 1,
    });
    expect(skater91FiveOnFive).toMatchObject({
      toi: 5,
      shots: 1,
      icf: 1,
    });
    expect(skater91Pp).toMatchObject({
      toi: 10,
      shots: 1,
      icf: 1,
    });
    expect(skater91Pk).toMatchObject({
      toi: 10,
      shots: 0,
      icf: 0,
    });
    expect(skater91PkOi).toMatchObject({
      toi: 10,
      ca: 1,
      fa: 1,
      sa: 1,
      cf: 0,
    });
    expect(skater91EvRates.shots_per_60).toBeCloseTo(720, 5);
    expect(skater91PpRates.shots_per_60).toBeCloseTo(360, 5);
    expect(skater34All.goals).toBe(0);
    expect(goalie31All).toMatchObject({
      shots_against: 2,
      saves: 2,
      goals_against: 0,
    });
    expect(goalie31Ev).toMatchObject({
      shots_against: 1,
      saves: 1,
      goals_against: 0,
    });
    expect(goalie31Pk).toMatchObject({
      shots_against: 1,
      saves: 1,
      goals_against: 0,
    });
  });

  it("counts zone starts only for players whose shift begins at the faceoff second", () => {
    const events = parseEvents([
      {
        eventId: 700,
        sortOrder: 700,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:04",
        timeRemaining: "19:56",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 516,
        typeDescKey: "stoppage",
        details: {},
      },
      {
        eventId: 701,
        sortOrder: 701,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "00:05",
        timeRemaining: "19:55",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 502,
        typeDescKey: "faceoff",
        details: {
          eventOwnerTeamId: 10,
          winningPlayerId: 91,
          losingPlayerId: 21,
          zoneCode: "O",
        },
      },
    ]);

    const shiftRows = [
      createShiftRow({
        shift_id: 41,
        player_id: 91,
        team_id: 10,
        start_seconds: 0,
        end_seconds: 20,
        duration_seconds: 20,
      }),
      createShiftRow({
        shift_id: 42,
        player_id: 34,
        team_id: 10,
        start_seconds: 5,
        end_seconds: 20,
        duration_seconds: 15,
      }),
      createShiftRow({
        shift_id: 43,
        player_id: 21,
        team_id: 20,
        team_abbrev: "NYR",
        start_seconds: 0,
        end_seconds: 20,
        duration_seconds: 20,
      }),
      createShiftRow({
        shift_id: 44,
        player_id: 31,
        team_id: 20,
        team_abbrev: "NYR",
        start_seconds: 0,
        end_seconds: 20,
        duration_seconds: 20,
      }),
    ] as any[];

    const shotFeatures = buildShotFeatureRows(events, shiftRows as any, 10, 20);
    const output = buildNstParityMetrics(events, shotFeatures, shiftRows as any, {
      date: "2026-03-30",
      season: 20252026,
      homeTeamId: 10,
      awayTeamId: 20,
    });

    const skater91Oi = output.skaters.all.countsOi.find((row) => row.player_id === 91)!;
    const skater34Oi = output.skaters.all.countsOi.find((row) => row.player_id === 34)!;

    expect(skater91Oi).toMatchObject({
      off_zone_faceoffs: 1,
      off_zone_starts: 0,
      neu_zone_starts: 0,
      def_zone_starts: 0,
    });
    expect(skater34Oi).toMatchObject({
      off_zone_faceoffs: 1,
      off_zone_starts: 1,
      neu_zone_starts: 0,
      def_zone_starts: 0,
    });
  });

  describe("L1 fixes: shared manpower predicate, score segments, penalties, distance, rush", () => {
    const HOME = 10;
    const AWAY = 20;
    const clock = (seconds: number) =>
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    const play = (
      eventId: number,
      second: number,
      situationCode: string,
      typeDescKey: string,
      details: Record<string, unknown> = {},
      extra: Record<string, unknown> = {}
    ) => ({
      eventId,
      sortOrder: eventId,
      periodDescriptor: { number: 1, periodType: "REG" },
      timeInPeriod: clock(second),
      timeRemaining: clock(1200 - second),
      situationCode,
      homeTeamDefendingSide: "left",
      typeDescKey,
      details,
      ...extra,
    });
    const fullPeriodShifts = () =>
      [
        createShiftRow({ shift_id: 1, player_id: 91, team_id: HOME, start_seconds: 0, end_seconds: 1200, duration_seconds: 1200 }),
        createShiftRow({ shift_id: 2, player_id: 21, team_id: AWAY, team_abbrev: "NYR", start_seconds: 0, end_seconds: 1200, duration_seconds: 1200 }),
        createShiftRow({ shift_id: 3, player_id: 31, team_id: AWAY, team_abbrev: "NYR", start_seconds: 0, end_seconds: 1200, duration_seconds: 1200 }),
      ] as any[];

    // 0-300 1551 tied | 300-600 1551 home +1 (shot at 420) | 600-720 1451 home PP
    // | 720 away goal, then 1551 tied to 900 | 900-1080 1560 home pulled goalie, no
    // penalty | 1080-1200 1460 home PP with its goalie pulled.
    const orientedGame = () =>
      parseEvents([
        play(1, 0, "1551", "faceoff", { eventOwnerTeamId: HOME, winningPlayerId: 91, losingPlayerId: 21, zoneCode: "N" }),
        play(2, 300, "1551", "goal", { eventOwnerTeamId: HOME, scoringPlayerId: 91, goalieInNetId: 31, homeScore: 1, awayScore: 0, xCoord: 80, yCoord: 0, zoneCode: "O" }),
        play(3, 300, "1551", "faceoff", { eventOwnerTeamId: AWAY, winningPlayerId: 21, losingPlayerId: 91, zoneCode: "N" }),
        play(4, 420, "1551", "shot-on-goal", { eventOwnerTeamId: HOME, shootingPlayerId: 91, goalieInNetId: 31, xCoord: 70, yCoord: 0, zoneCode: "O" }),
        play(5, 600, "1451", "faceoff", { eventOwnerTeamId: HOME, winningPlayerId: 91, losingPlayerId: 21, zoneCode: "O" }),
        play(6, 720, "1451", "goal", { eventOwnerTeamId: AWAY, scoringPlayerId: 21, homeScore: 1, awayScore: 1, xCoord: -80, yCoord: 0, zoneCode: "O" }),
        play(7, 720, "1551", "faceoff", { eventOwnerTeamId: HOME, winningPlayerId: 91, losingPlayerId: 21, zoneCode: "N" }),
        play(8, 900, "1560", "faceoff", { eventOwnerTeamId: HOME, winningPlayerId: 91, losingPlayerId: 21, zoneCode: "O" }),
        play(9, 1000, "1560", "shot-on-goal", { eventOwnerTeamId: HOME, shootingPlayerId: 91, goalieInNetId: 31, xCoord: 75, yCoord: 5, zoneCode: "O" }),
        play(10, 1080, "1460", "faceoff", { eventOwnerTeamId: HOME, winningPlayerId: 91, losingPlayerId: 21, zoneCode: "O" }),
        play(11, 1100, "1460", "shot-on-goal", { eventOwnerTeamId: HOME, shootingPlayerId: 91, goalieInNetId: 31, xCoord: 75, yCoord: -5, zoneCode: "O" }),
      ]);

    const build = (scoreState?: "tied" | "leading" | "trailing" | "upOne" | "downOne") => {
      const events = orientedGame();
      const shifts = fullPeriodShifts();
      const shotFeatures = buildShotFeatureRows(events, shifts as any, HOME, AWAY);
      return buildNstParityMetrics(events, shotFeatures, shifts as any, {
        date: "2026-03-30",
        season: 20252026,
        homeTeamId: HOME,
        awayTeamId: AWAY,
        ...(scoreState ? { scoreState } : {}),
      });
    };
    const toi = (output: ReturnType<typeof build>, split: keyof ReturnType<typeof build>["skaters"], playerId: number) =>
      output.skaters[split].counts.find((row) => row.player_id === playerId)?.toi ?? 0;

    it("files 6v5 without a penalty as ES (+ empty-net attribute) and 6v4 as PP, oriented by team", () => {
      const output = build();

      // Home (advantaged in 1451 and 1460).
      expect(toi(output, "ev", 91)).toBe(300 + 300 + 180 + 180);
      expect(toi(output, "pp", 91)).toBe(120 + 120);
      expect(toi(output, "pk", 91)).toBe(0);
      expect(toi(output, "withEmptyNet", 91)).toBe(300);
      expect(toi(output, "againstEmptyNet", 91)).toBe(0);
      expect(toi(output, "fiveOnFive", 91)).toBe(780);
      // Away (shorthanded in 1451 and 1460).
      expect(toi(output, "ev", 21)).toBe(960);
      expect(toi(output, "pk", 21)).toBe(240);
      expect(toi(output, "pp", 21)).toBe(0);
      expect(toi(output, "againstEmptyNet", 21)).toBe(300);

      // Shots: the 1560 shot is ES for home; the 1460 shot is PP.
      const ev91 = output.skaters.ev.counts.find((row) => row.player_id === 91)!;
      const pp91 = output.skaters.pp.counts.find((row) => row.player_id === 91)!;
      expect(ev91.shots).toBe(2 + 1); // goal + 420 shot + 1560 shot
      expect(pp91.shots).toBe(1);
    });

    it("exclusive ES + PP + PK reconciles to total TOI; empty net is not double-counted", () => {
      const output = build();
      for (const playerId of [91, 21]) {
        expect(
          toi(output, "ev", playerId) + toi(output, "pp", playerId) + toi(output, "pk", playerId)
        ).toBe(toi(output, "all", playerId));
      }
    });

    it("classifies intervals by post-event score and events by pre-event score; Leading includes +1", () => {
      const tied = build("tied");
      const leading = build("leading");
      const trailing = build("trailing");
      const upOne = build("upOne");
      const downOne = build("downOne");

      expect(toi(tied, "all", 91)).toBe(300 + 480);
      expect(toi(leading, "all", 91)).toBe(420);
      expect(toi(upOne, "all", 91)).toBe(420);
      expect(toi(trailing, "all", 91)).toBe(0);
      expect(toi(trailing, "all", 21)).toBe(420);
      expect(toi(downOne, "all", 21)).toBe(420);
      // Known score time partitions all time.
      expect(toi(tied, "all", 91) + toi(leading, "all", 91) + toi(trailing, "all", 91)).toBe(1200);

      // The 420 s shot happened while leading by one; the goal itself was tied.
      const leadingCounts = leading.skaters.all.counts.find((row) => row.player_id === 91)!;
      const tiedCounts = tied.skaters.all.counts.find((row) => row.player_id === 91)!;
      expect(leadingCounts.shots).toBe(1);
      expect(tiedCounts.goals).toBe(1);
      expect(leadingCounts.goals).toBe(0);
    });

    it("files MIN4, MIS10 and PS rows by penalty type (decision 13)", () => {
      const events = parseEvents([
        play(1, 100, "1551", "penalty", { eventOwnerTeamId: HOME, committedByPlayerId: 91, drawnByPlayerId: 21, typeCode: "MIN", descKey: "high-sticking", duration: 4 }),
        play(2, 200, "1551", "penalty", { eventOwnerTeamId: HOME, committedByPlayerId: 91, typeCode: "MIS", descKey: "misconduct", duration: 10 }),
        play(3, 300, "1551", "penalty", { eventOwnerTeamId: HOME, committedByPlayerId: 91, drawnByPlayerId: 21, typeCode: "PS", descKey: "ps-hooking-on-breakaway", duration: 0 }),
      ]);
      const shifts = fullPeriodShifts();
      const output = buildNstParityMetrics(events, [], shifts as any, {
        date: "2026-03-30",
        season: 20252026,
        homeTeamId: HOME,
        awayTeamId: AWAY,
      });
      const committed = output.skaters.all.counts.find((row) => row.player_id === 91)!;
      const drawn = output.skaters.all.counts.find((row) => row.player_id === 21)!;

      expect(committed).toMatchObject({
        minor_penalties: 1,
        major_penalties: 0,
        misconduct_penalties: 1,
        total_penalties: 2,
        pim: 14,
      });
      expect(drawn.penalties_drawn).toBe(1);
    });

    it("carries goalie distance sums and measured counts (W2-2 PR-U3)", () => {
      const events = orientedGame();
      const shifts = fullPeriodShifts();
      const shotFeatures = buildShotFeatureRows(events, shifts as any, HOME, AWAY).map(
        (row) => (row.eventId === 9 ? { ...row, shotDistanceFeet: null } : row)
      );
      const output = buildNstParityMetrics(events, shotFeatures, shifts as any, {
        date: "2026-03-30",
        season: 20252026,
        homeTeamId: HOME,
        awayTeamId: AWAY,
      });
      const goalie = output.goalies.all.counts.find((row) => row.player_id === 31)!;
      const measured = shotFeatures.filter(
        (row) => row.goalieInNetId === 31 && row.shotDistanceFeet != null
      );

      expect(goalie.shots_against).toBe(4);
      expect(goalie.shot_distance_count).toBe(3);
      expect(goalie.shot_distance_total).toBeCloseTo(
        measured.reduce((sum, row) => sum + row.shotDistanceFeet!, 0),
        6
      );
      expect(goalie.avg_shot_distance).toBeCloseTo(
        goalie.shot_distance_total / goalie.shot_distance_count,
        6
      );
      expect(goalie.goal_distance_count).toBe(1);
    });

    it("counts NST rush attempts with the decision 8 window (4 s), not the 10 s feature window", () => {
      const events = parseEvents([
        play(1, 100, "1551", "takeaway", { eventOwnerTeamId: HOME, playerId: 91, zoneCode: "N" }),
        play(2, 106, "1551", "shot-on-goal", { eventOwnerTeamId: HOME, shootingPlayerId: 91, goalieInNetId: 31, xCoord: 70, yCoord: 0, zoneCode: "O" }),
        play(3, 200, "1551", "takeaway", { eventOwnerTeamId: HOME, playerId: 91, zoneCode: "N" }),
        play(4, 203, "1551", "shot-on-goal", { eventOwnerTeamId: HOME, shootingPlayerId: 91, goalieInNetId: 31, xCoord: 70, yCoord: 0, zoneCode: "O" }),
      ]);
      const shifts = fullPeriodShifts();
      const shotFeatures = buildShotFeatureRows(events, shifts as any, HOME, AWAY);
      // Both shots are rushes under the 10 s shot-feature window.
      expect(shotFeatures.filter((row) => row.isRushShot)).toHaveLength(2);

      const output = buildNstParityMetrics(events, shotFeatures, shifts as any, {
        date: "2026-03-30",
        season: 20252026,
        homeTeamId: HOME,
        awayTeamId: AWAY,
      });
      expect(output.skaters.all.counts.find((row) => row.player_id === 91)!.rush_attempts).toBe(1);
      expect(output.goalies.all.counts.find((row) => row.player_id === 31)!.rush_attempts_against).toBe(1);
    });

    it("excludes a 1010 penalty-shot attempt and never files it as empty net", () => {
      const events = parseEvents([
        play(1, 100, "1551", "faceoff", { eventOwnerTeamId: HOME, winningPlayerId: 91, losingPlayerId: 21, zoneCode: "N" }),
        play(2, 500, "1010", "shot-on-goal", { eventOwnerTeamId: HOME, shootingPlayerId: 91, goalieInNetId: 31, xCoord: 70, yCoord: 0, zoneCode: "O" }),
      ]);
      const shifts = fullPeriodShifts();
      const shotFeatures = buildShotFeatureRows(events, shifts as any, HOME, AWAY);
      const output = buildNstParityMetrics(events, shotFeatures, shifts as any, {
        date: "2026-03-30",
        season: 20252026,
        homeTeamId: HOME,
        awayTeamId: AWAY,
      });

      expect(output.skaters.all.counts.find((row) => row.player_id === 91)?.shots ?? 0).toBe(0);
      expect(output.skaters.againstEmptyNet.counts.find((row) => row.player_id === 91)).toBeUndefined();
      expect(output.goalies.all.counts.find((row) => row.player_id === 31)?.shots_against ?? 0).toBe(0);
    });

    it("declares PDO on the percent scale and converts to NST's 1.0 scale at the adapter", () => {
      const output = build();
      const row = output.skaters.all.countsOi.find((r) => r.player_id === 91)!;
      // Home on ice: 4 shots on goal, 1 goal (SH% 25); faced 1 shot, a goal (SV% 0).
      expect(row.on_ice_sh_pct).toBeCloseTo(25, 6);
      expect(row.on_ice_sv_pct).toBeCloseTo(0, 6);
      expect(row.pdo).toBeCloseTo(25, 6);
      expect(parityPdoToNstScale(row.pdo)).toBeCloseTo(0.25, 6);
      expect(parityPdoToNstScale(null)).toBeNull();
    });

    it("labels danger and chance columns as FHFH house definitions until an NST reference is saved", () => {
      expect(PARITY_CHANCE_DEFINITIONS.highDanger).toMatchObject({
        label: "FHFH high-danger",
        source: "fhfh-house",
        nstEquivalent: false,
      });
      expect(PARITY_CHANCE_DEFINITIONS.scoringChance.nstEquivalent).toBe(false);
      // The declared boundary is the one parity applies: 20 ft / 35 deg is high.
      const shot = (distance: number, angle: number) => ({
        dangerBucket: null,
        shotDistanceFeet: distance,
        shotAngleDegrees: angle,
      });
      const events = orientedGame();
      const shifts = fullPeriodShifts();
      const base = buildShotFeatureRows(events, shifts as any, HOME, AWAY);
      const withGeometry = base.map((row) =>
        row.eventId === 4 ? { ...row, ...shot(20, 35) } : row.eventId === 9 ? { ...row, ...shot(21, 35) } : row
      );
      const output = buildNstParityMetrics(events, withGeometry, shifts as any, {
        date: "2026-03-30",
        season: 20252026,
        homeTeamId: HOME,
        awayTeamId: AWAY,
      });
      const oi = output.skaters.all.countsOi.find((r) => r.player_id === 91)!;
      const baseline = buildNstParityMetrics(
        events,
        base.map((row) =>
          row.eventId === 4 || row.eventId === 9 ? { ...row, ...shot(60, 80) } : row
        ),
        shifts as any,
        { date: "2026-03-30", season: 20252026, homeTeamId: HOME, awayTeamId: AWAY }
      ).skaters.all.countsOi.find((r) => r.player_id === 91)!;
      expect((oi.hdcf ?? 0) - (baseline.hdcf ?? 0)).toBe(1);
      expect((oi.mdcf ?? 0) - (baseline.mdcf ?? 0)).toBe(1);
    });

    describe("penalty-expiry TOI (W1-2 D8), one fixture per case", () => {
      // Home (10) is penalized in every case; away (20) is advantaged.
      const at = (
        eventId: number,
        second: number,
        situationCode: string,
        typeDescKey: string,
        details: Record<string, unknown> = {},
        period = 1
      ) => ({
        eventId,
        sortOrder: eventId,
        periodDescriptor: { number: period, periodType: period > 3 ? "OT" : "REG" },
        timeInPeriod: clock(second),
        timeRemaining: clock((period > 3 ? 300 : 1200) - second),
        situationCode,
        homeTeamDefendingSide: "left",
        typeDescKey,
        details,
      });
      const penalty = (eventId: number, second: number, typeCode: string, duration: number, period = 1) =>
        at(eventId, second, "1551", "penalty", { eventOwnerTeamId: HOME, committedByPlayerId: 91, drawnByPlayerId: 21, typeCode, duration }, period);
      const faceoff = (eventId: number, second: number, situationCode: string, period = 1) =>
        at(eventId, second, situationCode, "faceoff", { eventOwnerTeamId: AWAY, winningPlayerId: 21, losingPlayerId: 91, zoneCode: "O" }, period);
      const awayGoal = (eventId: number, second: number, situationCode: string, period = 1) =>
        at(eventId, second, situationCode, "goal", { eventOwnerTeamId: AWAY, scoringPlayerId: 21, homeScore: 0, awayScore: 1 }, period);
      const run = (plays: Record<string, unknown>[], shifts = fullPeriodShifts()) => {
        const output = buildNstParityMetrics(parseEvents(plays), [], shifts as any, {
          date: "2026-03-30",
          season: 20252026,
          homeTeamId: HOME,
          awayTeamId: AWAY,
        });
        return {
          pp: toi(output as any, "pp", 21),
          pk: toi(output as any, "pk", 91),
          ev: toi(output as any, "ev", 91),
          all: toi(output as any, "all", 91),
        };
      };

      it("a minor with no event at expiry: PK ends at 2:00, not at the next event", () => {
        const result = run([
          faceoff(1, 0, "1551"),
          penalty(2, 100, "MIN", 2),
          faceoff(3, 100, "1541"),
          faceoff(4, 300, "1551"),
        ]);
        expect(result.pk).toBe(120);
        expect(result.pp).toBe(120);
        expect(result.ev + result.pk).toBe(result.all);
      });

      it("an early power-play goal ends the minor at the goal", () => {
        const result = run([
          faceoff(1, 0, "1551"),
          penalty(2, 100, "MIN", 2),
          faceoff(3, 100, "1541"),
          awayGoal(4, 150, "1541"),
          faceoff(5, 150, "1551"),
          faceoff(6, 300, "1551"),
        ]);
        expect(result.pk).toBe(50);
      });

      it("a double minor runs two halves; a goal in the first half ends only that half", () => {
        const full = run([
          faceoff(1, 0, "1551"),
          penalty(2, 100, "MIN", 4),
          faceoff(3, 100, "1541"),
          faceoff(4, 400, "1551"),
        ]);
        expect(full.pk).toBe(240);

        const firstHalfGoal = run([
          faceoff(1, 0, "1551"),
          penalty(2, 100, "MIN", 4),
          faceoff(3, 100, "1541"),
          awayGoal(4, 150, "1541"),
          faceoff(5, 150, "1541"),
          faceoff(6, 400, "1551"),
        ]);
        expect(firstHalfGoal.pk).toBe(50 + 120);
      });

      it("coincidental minors change no manpower: 4v4 stays ES and ES + PP + PK = TOI", () => {
        const result = run([
          faceoff(1, 0, "1551"),
          penalty(2, 100, "MIN", 2),
          at(3, 100, "1551", "penalty", { eventOwnerTeamId: AWAY, committedByPlayerId: 21, drawnByPlayerId: 91, typeCode: "MIN", duration: 2 }),
          faceoff(4, 100, "1441"),
          faceoff(5, 300, "1551"),
        ]);
        expect(result.pk).toBe(0);
        expect(result.pp).toBe(0);
        expect(result.ev).toBe(result.all);
      });

      it("OT manpower: a 3v3 minor gives 4v3 for 2:00, then 3v3 again", () => {
        const otShifts = [
          createShiftRow({ shift_id: 1, player_id: 91, team_id: HOME, period: 4, start_seconds: 0, end_seconds: 300, duration_seconds: 300 }),
          createShiftRow({ shift_id: 2, player_id: 21, team_id: AWAY, team_abbrev: "NYR", period: 4, start_seconds: 0, end_seconds: 300, duration_seconds: 300 }),
        ];
        const result = run(
          [
            faceoff(1, 0, "1331", 4),
            penalty(2, 30, "MIN", 2, 4),
            faceoff(3, 30, "1431", 4),
            faceoff(4, 200, "1331", 4),
          ],
          otShifts
        );
        expect(result.pk).toBe(120);
        expect(result.pp).toBe(120);
        expect(result.ev).toBe(300 - 120);
      });
    });
  });
});
