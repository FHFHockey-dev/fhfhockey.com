import { describe, expect, it } from "vitest";

import { parseNhlPlayByPlayEvents } from "./nhlPlayByPlayParser";
import { buildPossessionChainContexts } from "./nhlPossessionChains";

function parseEvents(plays: Record<string, unknown>[]) {
  return parseNhlPlayByPlayEvents(
    {
      id: 2025020418,
      season: 20252026,
      gameDate: "2026-03-31",
      homeTeam: { id: 10, abbrev: "TOR" },
      awayTeam: { id: 20, abbrev: "NYR" },
      plays,
    },
    {
      sourcePlayByPlayHash: "possession-chain-test",
      now: "2026-03-31T12:00:00.000Z",
    }
  );
}

describe("nhlPossessionChains", () => {
  it("tracks same-team chain length, duration, and offensive-zone entry markers", () => {
    const events = parseEvents([
      {
        eventId: 100,
        sortOrder: 100,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "01:00",
        timeRemaining: "19:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeDescKey: "faceoff",
        details: {
          eventOwnerTeamId: 10,
          zoneCode: "N",
        },
      },
      {
        eventId: 101,
        sortOrder: 101,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "01:04",
        timeRemaining: "18:56",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeDescKey: "pass",
        details: {
          eventOwnerTeamId: 10,
          zoneCode: "N",
        },
      },
      {
        eventId: 102,
        sortOrder: 102,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "01:07",
        timeRemaining: "18:53",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          zoneCode: "O",
          xCoord: 75,
          yCoord: 10,
        },
      },
    ]);

    const contexts = buildPossessionChainContexts(events);

    expect(contexts[0]).toMatchObject({
      eventId: 100,
      possessionEventCount: 1,
      possessionDurationSeconds: 0,
      possessionStartEventId: 100,
      possessionStartTypeDescKey: "faceoff",
      possessionStartZoneCode: "N",
      possessionRegainedFromOpponent: false,
      possessionRegainEventTypeDescKey: null,
      possessionEnteredOffensiveZone: false,
    });
    expect(contexts[2]).toMatchObject({
      eventId: 102,
      possessionEventCount: 3,
      possessionDurationSeconds: 7,
      possessionStartEventId: 100,
      possessionStartTypeDescKey: "faceoff",
      possessionStartZoneCode: "N",
      possessionRegainedFromOpponent: false,
      possessionRegainEventTypeDescKey: null,
      possessionEnteredOffensiveZone: true,
    });
  });

  it("marks opponent-regain chains when control changes directly across owned events", () => {
    const events = parseEvents([
      {
        eventId: 200,
        sortOrder: 200,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "05:00",
        timeRemaining: "15:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeDescKey: "giveaway",
        details: {
          eventOwnerTeamId: 20,
          zoneCode: "N",
        },
      },
      {
        eventId: 201,
        sortOrder: 201,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "05:02",
        timeRemaining: "14:58",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 34,
          zoneCode: "O",
          xCoord: 78,
          yCoord: -3,
        },
      },
    ]);

    const contexts = buildPossessionChainContexts(events);

    expect(contexts[1]).toMatchObject({
      eventId: 201,
      possessionEventCount: 1,
      possessionDurationSeconds: 0,
      possessionStartEventId: 201,
      possessionStartTypeDescKey: "shot-on-goal",
      possessionStartZoneCode: "O",
      possessionRegainedFromOpponent: true,
      possessionRegainEventTypeDescKey: "giveaway",
      possessionEnteredOffensiveZone: false,
    });
  });
});
