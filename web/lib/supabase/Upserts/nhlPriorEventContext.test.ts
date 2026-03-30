import { describe, expect, it } from "vitest";

import { buildPriorEventContexts } from "./nhlPriorEventContext";
import { parseNhlPlayByPlayEvents } from "./nhlPlayByPlayParser";

describe("nhlPriorEventContext", () => {
  it("derives previous type, team, time, and distance context for standard ordered events", () => {
    const events = parseNhlPlayByPlayEvents(
      {
        id: 2025020418,
        season: 20252026,
        gameDate: "2026-03-30",
        homeTeam: { id: 10, abbrev: "TOR" },
        awayTeam: { id: 20, abbrev: "NYR" },
        plays: [
          {
            eventId: 100,
            sortOrder: 10,
            periodDescriptor: { number: 1, periodType: "REG" },
            timeInPeriod: "00:10",
            timeRemaining: "19:50",
            situationCode: "1551",
            homeTeamDefendingSide: "left",
            typeCode: 525,
            typeDescKey: "takeaway",
            details: {
              eventOwnerTeamId: 10,
              playerId: 91,
              xCoord: 20,
              yCoord: 5,
            },
          },
          {
            eventId: 101,
            sortOrder: 20,
            periodDescriptor: { number: 1, periodType: "REG" },
            timeInPeriod: "00:25",
            timeRemaining: "19:35",
            situationCode: "1551",
            homeTeamDefendingSide: "left",
            typeCode: 506,
            typeDescKey: "shot-on-goal",
            details: {
              eventOwnerTeamId: 10,
              shootingPlayerId: 91,
              xCoord: 68,
              yCoord: 12,
            },
          },
          {
            eventId: 102,
            sortOrder: 30,
            periodDescriptor: { number: 1, periodType: "REG" },
            timeInPeriod: "00:35",
            timeRemaining: "19:25",
            situationCode: "1551",
            homeTeamDefendingSide: "left",
            typeCode: 516,
            typeDescKey: "stoppage",
            details: {
              xCoord: 0,
              yCoord: 0,
            },
          },
        ],
      },
      {
        sourcePlayByPlayHash: "hash-context-1",
        now: "2026-03-30T12:00:00.000Z",
      }
    );

    const contexts = buildPriorEventContexts(events);

    expect(contexts[0]).toMatchObject({
      previousEventId: null,
      previousEventTypeDescKey: null,
      previousEventTeamId: null,
      timeSincePreviousEventSeconds: null,
      distanceFromPreviousEvent: null,
      currentNormalizedX: 20,
      currentNormalizedY: 5,
    });

    expect(contexts[1]).toMatchObject({
      previousEventId: 100,
      previousEventSortOrder: 10,
      previousEventTypeDescKey: "takeaway",
      previousEventTeamId: 10,
      previousEventSameTeam: true,
      previousEventPeriodNumber: 1,
      timeSincePreviousEventSeconds: 15,
      currentNormalizedX: 68,
      currentNormalizedY: 12,
      previousNormalizedX: 20,
      previousNormalizedY: 5,
    });
    expect(contexts[1].distanceFromPreviousEvent).toBeCloseTo(
      Math.sqrt(48 * 48 + 7 * 7),
      6
    );

    expect(contexts[2]).toMatchObject({
      previousEventId: 101,
      previousEventTypeDescKey: "shot-on-goal",
      previousEventTeamId: 10,
      previousEventSameTeam: null,
      timeSincePreviousEventSeconds: 10,
    });
  });

  it("handles cross-team previous events and normalizes coordinates by each event owner side", () => {
    const events = parseNhlPlayByPlayEvents(
      {
        id: 2025021018,
        season: 20252026,
        gameDate: "2026-03-10",
        homeTeam: { id: 12, abbrev: "CAR" },
        awayTeam: { id: 5, abbrev: "PIT" },
        plays: [
          {
            eventId: 200,
            sortOrder: 10,
            periodDescriptor: { number: 4, periodType: "OT" },
            timeInPeriod: "00:05",
            timeRemaining: "04:55",
            situationCode: "1331",
            homeTeamDefendingSide: "left",
            typeCode: 506,
            typeDescKey: "shot-on-goal",
            details: {
              eventOwnerTeamId: 5,
              xCoord: 60,
              yCoord: -10,
            },
          },
          {
            eventId: 201,
            sortOrder: 20,
            periodDescriptor: { number: 4, periodType: "OT" },
            timeInPeriod: "00:12",
            timeRemaining: "04:48",
            situationCode: "1331",
            homeTeamDefendingSide: "left",
            typeCode: 525,
            typeDescKey: "takeaway",
            details: {
              eventOwnerTeamId: 12,
              xCoord: -35,
              yCoord: 6,
            },
          },
        ],
      },
      {
        sourcePlayByPlayHash: "hash-context-2",
        now: "2026-03-30T12:00:00.000Z",
      }
    );

    const contexts = buildPriorEventContexts(events);

    expect(contexts[1]).toMatchObject({
      previousEventId: 200,
      previousEventTypeDescKey: "shot-on-goal",
      previousEventTeamId: 5,
      previousEventSameTeam: false,
      timeSincePreviousEventSeconds: 7,
      currentNormalizedX: -35,
      currentNormalizedY: 6,
      previousNormalizedX: -60,
      previousNormalizedY: 10,
    });
    expect(contexts[1].distanceFromPreviousEvent).toBeCloseTo(
      Math.sqrt(95 * 95 + 16 * 16),
      6
    );
  });

  it("keeps distance nullable when either event lacks coordinates", () => {
    const events = parseNhlPlayByPlayEvents(
      {
        id: 2025021103,
        season: 20252026,
        gameDate: "2026-03-21",
        homeTeam: { id: 28, abbrev: "SJS" },
        awayTeam: { id: 4, abbrev: "PHI" },
        plays: [
          {
            eventId: 300,
            sortOrder: 10,
            periodDescriptor: { number: 3, periodType: "REG" },
            timeInPeriod: "19:30",
            timeRemaining: "00:30",
            situationCode: "0651",
            homeTeamDefendingSide: "right",
            typeCode: 535,
            typeDescKey: "delayed-penalty",
            details: {
              eventOwnerTeamId: 4,
            },
          },
          {
            eventId: 301,
            sortOrder: 20,
            periodDescriptor: { number: 3, periodType: "REG" },
            timeInPeriod: "19:40",
            timeRemaining: "00:20",
            situationCode: "0651",
            homeTeamDefendingSide: "right",
            typeCode: 507,
            typeDescKey: "blocked-shot",
            details: {
              eventOwnerTeamId: 4,
              xCoord: 74,
              yCoord: -4,
            },
          },
        ],
      },
      {
        sourcePlayByPlayHash: "hash-context-3",
        now: "2026-03-30T12:00:00.000Z",
      }
    );

    const contexts = buildPriorEventContexts(events);

    expect(contexts[1]).toMatchObject({
      previousEventId: 300,
      previousEventTypeDescKey: "delayed-penalty",
      previousEventTeamId: 4,
      previousEventSameTeam: true,
      timeSincePreviousEventSeconds: 10,
      distanceFromPreviousEvent: null,
      currentNormalizedX: 74,
      currentNormalizedY: -4,
      previousNormalizedX: null,
      previousNormalizedY: null,
    });
  });
});
