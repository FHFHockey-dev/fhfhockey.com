import { describe, expect, it } from "vitest";

import { parseNhlPlayByPlayEvents } from "./nhlPlayByPlayParser";
import { buildRushContexts, DEFAULT_RUSH_WINDOW_SECONDS } from "./nhlRush";

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
      sourcePlayByPlayHash: "rush-hash",
      now: "2026-03-30T12:00:00.000Z",
    }
  );
}

describe("nhlRush", () => {
  it("flags a same-team neutral-zone takeaway followed by a quick shot as a rush", () => {
    const events = parseEvents([
      {
        eventId: 100,
        sortOrder: 100,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "04:00",
        timeRemaining: "16:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 525,
        typeDescKey: "takeaway",
        details: {
          eventOwnerTeamId: 10,
          playerId: 16,
          zoneCode: "N",
        },
      },
      {
        eventId: 101,
        sortOrder: 101,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "04:06",
        timeRemaining: "15:54",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          xCoord: 73,
          yCoord: -4,
        },
      },
    ]);

    const contexts = buildRushContexts(events);

    expect(contexts).toMatchObject([
      { eventId: 100, isRushShot: false },
      {
        eventId: 101,
        isRushShot: true,
        rushSourceEventId: 100,
        rushSourceTypeDescKey: "takeaway",
        rushSourceTeamId: 10,
        rushSourceZoneCode: "N",
        rushSourceTeamRelativeZoneCode: "N",
        rushTimeSinceSourceSeconds: 6,
        rushEventsSinceSource: 0,
        rushWindowSeconds: DEFAULT_RUSH_WINDOW_SECONDS,
      },
    ]);
  });

  it("treats an opponent offensive-zone giveaway as a defensive-zone rush source for the shooting team", () => {
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
          xCoord: 68,
          yCoord: 10,
        },
      },
    ]);

    const contexts = buildRushContexts(events);

    expect(contexts[1]).toMatchObject({
      eventId: 201,
      isRushShot: true,
      rushSourceEventId: 200,
      rushSourceTypeDescKey: "giveaway",
      rushSourceZoneCode: "O",
      rushSourceTeamRelativeZoneCode: "D",
      rushTimeSinceSourceSeconds: 7,
    });
  });

  it("does not tag rebound shots as rush shots", () => {
    const events = parseEvents([
      {
        eventId: 300,
        sortOrder: 300,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "12:00",
        timeRemaining: "08:00",
        situationCode: "1551",
        homeTeamDefendingSide: "right",
        typeCode: 525,
        typeDescKey: "takeaway",
        details: {
          eventOwnerTeamId: 20,
          playerId: 13,
          zoneCode: "N",
        },
      },
      {
        eventId: 301,
        sortOrder: 301,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "12:07",
        timeRemaining: "07:53",
        situationCode: "1551",
        homeTeamDefendingSide: "right",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 20,
          shootingPlayerId: 88,
          xCoord: -74,
          yCoord: 6,
        },
      },
      {
        eventId: 302,
        sortOrder: 302,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "12:09",
        timeRemaining: "07:51",
        situationCode: "1551",
        homeTeamDefendingSide: "right",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 20,
          shootingPlayerId: 89,
          xCoord: -79,
          yCoord: 3,
        },
      },
    ]);

    const contexts = buildRushContexts(events);

    expect(contexts).toMatchObject([
      { eventId: 300, isRushShot: false },
      { eventId: 301, isRushShot: true, rushSourceEventId: 300 },
      { eventId: 302, isRushShot: false, rushSourceEventId: null },
    ]);
  });

  it("breaks the rush sequence when the source is already in the offensive zone", () => {
    const events = parseEvents([
      {
        eventId: 400,
        sortOrder: 400,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "03:00",
        timeRemaining: "17:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 502,
        typeDescKey: "faceoff",
        details: {
          eventOwnerTeamId: 10,
          winningPlayerId: 91,
          losingPlayerId: 20,
          zoneCode: "O",
        },
      },
      {
        eventId: 401,
        sortOrder: 401,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "03:04",
        timeRemaining: "16:56",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 34,
          xCoord: 76,
          yCoord: 7,
        },
      },
    ]);

    const contexts = buildRushContexts(events);

    expect(contexts).toMatchObject([
      { eventId: 400, isRushShot: false },
      { eventId: 401, isRushShot: false, rushSourceEventId: null },
    ]);
  });
});
