import { describe, expect, it } from "vitest";

import { buildNstParityMetrics } from "./nhlNstParityMetrics";
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
});
