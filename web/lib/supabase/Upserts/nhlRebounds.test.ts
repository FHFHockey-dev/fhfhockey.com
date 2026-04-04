import { describe, expect, it } from "vitest";

import { parseNhlPlayByPlayEvents } from "./nhlPlayByPlayParser";
import {
  buildReboundContexts,
  DEFAULT_REBOUND_WINDOW_SECONDS,
} from "./nhlRebounds";

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
      sourcePlayByPlayHash: "rebound-hash",
      now: "2026-03-30T12:00:00.000Z",
    }
  );
}

describe("nhlRebounds", () => {
  it("flags an immediate same-team follow-up shot as a rebound and credits the source shot", () => {
    const events = parseEvents([
      {
        eventId: 100,
        sortOrder: 100,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "10:00",
        timeRemaining: "10:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          xCoord: 70,
          yCoord: 8,
        },
      },
      {
        eventId: 101,
        sortOrder: 101,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "10:02",
        timeRemaining: "09:58",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 505,
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 34,
          xCoord: 78,
          yCoord: -3,
        },
      },
    ]);

    const contexts = buildReboundContexts(events);

    expect(contexts[0]).toEqual({
      gameId: 2025020418,
      eventId: 100,
      isReboundShot: false,
      reboundSourceEventId: null,
      reboundSourceTypeDescKey: null,
      reboundSourceTeamId: null,
      reboundTimeDeltaSeconds: null,
      reboundDistanceFromSource: null,
      reboundLateralDisplacementFeet: null,
      reboundDistanceDeltaFeet: null,
      reboundAngleChangeDegrees: null,
      reboundWindowSeconds: DEFAULT_REBOUND_WINDOW_SECONDS,
      createsRebound: true,
      reboundTargetEventId: 101,
      reboundTargetTypeDescKey: "goal",
    });

    expect(contexts[1]).toMatchObject({
      eventId: 101,
      isReboundShot: true,
      reboundSourceEventId: 100,
      reboundSourceTypeDescKey: "shot-on-goal",
      reboundSourceTeamId: 10,
      reboundTimeDeltaSeconds: 2,
      reboundWindowSeconds: DEFAULT_REBOUND_WINDOW_SECONDS,
      createsRebound: false,
    });
    expect(contexts[1].reboundDistanceFromSource).toBeCloseTo(13.601, 3);
    expect(contexts[1].reboundLateralDisplacementFeet).toBe(11);
    expect(contexts[1].reboundDistanceDeltaFeet).toBeCloseTo(-9.2138, 3);
    expect(contexts[1].reboundAngleChangeDegrees).toBeCloseTo(7.5789, 3);
  });

  it("breaks rebound sequences when an intervening non-shot event occurs", () => {
    const events = parseEvents([
      {
        eventId: 200,
        sortOrder: 200,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "05:00",
        timeRemaining: "15:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 16,
          xCoord: 71,
          yCoord: 2,
        },
      },
      {
        eventId: 201,
        sortOrder: 201,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "05:01",
        timeRemaining: "14:59",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 521,
        typeDescKey: "stoppage",
        details: {},
      },
      {
        eventId: 202,
        sortOrder: 202,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "05:02",
        timeRemaining: "14:58",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 507,
        typeDescKey: "missed-shot",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 34,
          xCoord: 74,
          yCoord: -7,
        },
      },
    ]);

    const contexts = buildReboundContexts(events);

    expect(contexts).toMatchObject([
      { eventId: 200, createsRebound: false, reboundTargetEventId: null },
      { eventId: 201, isReboundShot: false },
      { eventId: 202, isReboundShot: false, reboundSourceEventId: null },
    ]);
  });

  it("requires the follow-up shot to stay within the rebound time window", () => {
    const events = parseEvents([
      {
        eventId: 300,
        sortOrder: 300,
        periodDescriptor: { number: 2, periodType: "REG" },
        timeInPeriod: "07:10",
        timeRemaining: "12:50",
        situationCode: "1551",
        homeTeamDefendingSide: "right",
        typeCode: 507,
        typeDescKey: "missed-shot",
        details: {
          eventOwnerTeamId: 20,
          shootingPlayerId: 88,
          xCoord: -67,
          yCoord: 10,
        },
      },
      {
        eventId: 301,
        sortOrder: 301,
        periodDescriptor: { number: 2, periodType: "REG" },
        timeInPeriod: "07:14",
        timeRemaining: "12:46",
        situationCode: "1551",
        homeTeamDefendingSide: "right",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 20,
          shootingPlayerId: 89,
          xCoord: -79,
          yCoord: -5,
        },
      },
    ]);

    const contexts = buildReboundContexts(events);

    expect(contexts).toMatchObject([
      { eventId: 300, createsRebound: false },
      {
        eventId: 301,
        isReboundShot: false,
        reboundSourceEventId: null,
        reboundTimeDeltaSeconds: null,
      },
    ]);
  });

  it("does not treat penalty-shot follow-ups as rebound shots", () => {
    const events = parseEvents([
      {
        eventId: 400,
        sortOrder: 400,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "11:00",
        timeRemaining: "09:00",
        situationCode: "1011",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 29,
          reason: "Penalty Shot",
          xCoord: 80,
          yCoord: 0,
        },
      },
      {
        eventId: 401,
        sortOrder: 401,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "11:02",
        timeRemaining: "08:58",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          xCoord: 72,
          yCoord: 6,
        },
      },
    ]);

    const contexts = buildReboundContexts(events);

    expect(contexts).toMatchObject([
      { eventId: 400, createsRebound: false },
      { eventId: 401, isReboundShot: false, reboundSourceEventId: null },
    ]);
  });
});
