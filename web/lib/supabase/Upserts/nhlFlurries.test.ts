import { describe, expect, it } from "vitest";

import { buildFlurryContexts, DEFAULT_FLURRY_GAP_SECONDS } from "./nhlFlurries";
import { parseNhlPlayByPlayEvents } from "./nhlPlayByPlayParser";

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
      sourcePlayByPlayHash: "flurry-hash",
      now: "2026-03-30T12:00:00.000Z",
    }
  );
}

describe("nhlFlurries", () => {
  it("groups quick same-team shot sequences into one flurry with stable member metadata", () => {
    const events = parseEvents([
      {
        eventId: 100,
        sortOrder: 100,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "02:00",
        timeRemaining: "18:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          xCoord: 71,
          yCoord: 5,
        },
      },
      {
        eventId: 101,
        sortOrder: 101,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "02:03",
        timeRemaining: "17:57",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 507,
        typeDescKey: "missed-shot",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 34,
          xCoord: 76,
          yCoord: -2,
        },
      },
      {
        eventId: 102,
        sortOrder: 102,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "02:05",
        timeRemaining: "17:55",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 505,
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 16,
          xCoord: 80,
          yCoord: 1,
        },
      },
    ]);

    const contexts = buildFlurryContexts(events);

    expect(contexts).toMatchObject([
      {
        eventId: 100,
        isFlurryShot: true,
        flurryShotIndex: 1,
        flurryShotCount: 3,
        flurrySequenceStartEventId: 100,
        flurrySequenceEndEventId: 102,
        flurrySequenceDurationSeconds: 5,
        flurryGapSeconds: DEFAULT_FLURRY_GAP_SECONDS,
        isFlurrySequenceStarter: true,
        isFlurrySequenceFinisher: false,
      },
      {
        eventId: 101,
        isFlurryShot: true,
        flurryShotIndex: 2,
        flurryShotCount: 3,
        isFlurrySequenceStarter: false,
        isFlurrySequenceFinisher: false,
      },
      {
        eventId: 102,
        isFlurryShot: true,
        flurryShotIndex: 3,
        flurryShotCount: 3,
        isFlurrySequenceStarter: false,
        isFlurrySequenceFinisher: true,
      },
    ]);
    expect(contexts[0].flurrySequenceId).toBe(contexts[1].flurrySequenceId);
    expect(contexts[1].flurrySequenceId).toBe(contexts[2].flurrySequenceId);
  });

  it("breaks the flurry when the gap between shots exceeds the configured threshold", () => {
    const events = parseEvents([
      {
        eventId: 200,
        sortOrder: 200,
        periodDescriptor: { number: 2, periodType: "REG" },
        timeInPeriod: "08:00",
        timeRemaining: "12:00",
        situationCode: "1551",
        homeTeamDefendingSide: "right",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 20,
          shootingPlayerId: 88,
          xCoord: -71,
          yCoord: 7,
        },
      },
      {
        eventId: 201,
        sortOrder: 201,
        periodDescriptor: { number: 2, periodType: "REG" },
        timeInPeriod: "08:06",
        timeRemaining: "11:54",
        situationCode: "1551",
        homeTeamDefendingSide: "right",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 20,
          shootingPlayerId: 89,
          xCoord: -76,
          yCoord: -1,
        },
      },
    ]);

    const contexts = buildFlurryContexts(events);

    expect(contexts).toMatchObject([
      { eventId: 200, isFlurryShot: false, flurrySequenceId: null },
      { eventId: 201, isFlurryShot: false, flurrySequenceId: null },
    ]);
  });

  it("breaks the flurry on stoppages and starts a new sequence afterward", () => {
    const events = parseEvents([
      {
        eventId: 300,
        sortOrder: 300,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "11:00",
        timeRemaining: "09:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 34,
          xCoord: 70,
          yCoord: 2,
        },
      },
      {
        eventId: 301,
        sortOrder: 301,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "11:01",
        timeRemaining: "08:59",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 516,
        typeDescKey: "stoppage",
        details: {},
      },
      {
        eventId: 302,
        sortOrder: 302,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "11:03",
        timeRemaining: "08:57",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 507,
        typeDescKey: "missed-shot",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 16,
          xCoord: 78,
          yCoord: -6,
        },
      },
      {
        eventId: 303,
        sortOrder: 303,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "11:05",
        timeRemaining: "08:55",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 505,
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 91,
          xCoord: 82,
          yCoord: 0,
        },
      },
    ]);

    const contexts = buildFlurryContexts(events);

    expect(contexts).toMatchObject([
      { eventId: 300, isFlurryShot: false, flurrySequenceId: null },
      { eventId: 301, isFlurryShot: false, flurrySequenceId: null },
      {
        eventId: 302,
        isFlurryShot: true,
        flurryShotCount: 2,
        flurrySequenceStartEventId: 302,
        flurrySequenceEndEventId: 303,
      },
      {
        eventId: 303,
        isFlurryShot: true,
        flurryShotCount: 2,
        flurrySequenceStartEventId: 302,
        flurrySequenceEndEventId: 303,
      },
    ]);
  });

  it("breaks the flurry when the opponent records the next shot", () => {
    const events = parseEvents([
      {
        eventId: 400,
        sortOrder: 400,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "15:00",
        timeRemaining: "05:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 34,
          xCoord: 72,
          yCoord: 4,
        },
      },
      {
        eventId: 401,
        sortOrder: 401,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "15:03",
        timeRemaining: "04:57",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 20,
          shootingPlayerId: 88,
          xCoord: -74,
          yCoord: -3,
        },
      },
      {
        eventId: 402,
        sortOrder: 402,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "15:05",
        timeRemaining: "04:55",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 507,
        typeDescKey: "missed-shot",
        details: {
          eventOwnerTeamId: 20,
          shootingPlayerId: 89,
          xCoord: -80,
          yCoord: 1,
        },
      },
    ]);

    const contexts = buildFlurryContexts(events);

    expect(contexts).toMatchObject([
      { eventId: 400, isFlurryShot: false, flurrySequenceId: null },
      {
        eventId: 401,
        isFlurryShot: true,
        flurryShotCount: 2,
        flurrySequenceStartEventId: 401,
        flurrySequenceEndEventId: 402,
      },
      {
        eventId: 402,
        isFlurryShot: true,
        flurryShotCount: 2,
        flurrySequenceStartEventId: 401,
        flurrySequenceEndEventId: 402,
      },
    ]);
  });
});
