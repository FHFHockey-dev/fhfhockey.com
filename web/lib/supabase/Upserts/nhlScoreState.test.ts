import { describe, expect, it } from "vitest";

import { parseNhlPlayByPlayEvents } from "./nhlPlayByPlayParser";
import { buildScoreStateContexts } from "./nhlScoreState";

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
      sourcePlayByPlayHash: "score-state-test",
      now: "2026-03-31T12:00:00.000Z",
    }
  );
}

describe("nhlScoreState", () => {
  it("tracks pre-event score state so goal events do not see their own updated score", () => {
    const events = parseEvents([
      {
        eventId: 100,
        sortOrder: 100,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "01:00",
        timeRemaining: "19:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 91,
          zoneCode: "O",
          homeScore: 1,
          awayScore: 0,
        },
      },
      {
        eventId: 101,
        sortOrder: 101,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "01:20",
        timeRemaining: "18:40",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 20,
          shootingPlayerId: 34,
          zoneCode: "O",
        },
      },
    ]);

    const contexts = buildScoreStateContexts(events);

    expect(contexts[0]).toMatchObject({
      eventId: 100,
      homeScoreBeforeEvent: 0,
      awayScoreBeforeEvent: 0,
      homeScoreDiffBeforeEvent: 0,
      awayScoreDiffBeforeEvent: 0,
      ownerScoreDiffBeforeEvent: 0,
      ownerScoreDiffBucket: "tied",
      scoreEffectsGameTimeSegment: "early-regulation",
      ownerScoreDiffByGameTimeBucket: "tied@early-regulation",
      isFinalFiveMinutes: false,
      isFinalTwoMinutes: false,
    });
    expect(contexts[1]).toMatchObject({
      eventId: 101,
      homeScoreBeforeEvent: 1,
      awayScoreBeforeEvent: 0,
      homeScoreDiffBeforeEvent: 1,
      awayScoreDiffBeforeEvent: -1,
      ownerScoreDiffBeforeEvent: -1,
      ownerScoreDiffBucket: "trail-1",
      scoreEffectsGameTimeSegment: "early-regulation",
      ownerScoreDiffByGameTimeBucket: "trail-1@early-regulation",
    });
  });

  it("marks late-game close and trailing owner states from the pre-event scoreboard", () => {
    const events = parseEvents([
      {
        eventId: 200,
        sortOrder: 200,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "18:30",
        timeRemaining: "01:30",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 20,
          shootingPlayerId: 34,
          zoneCode: "O",
          homeScore: 3,
          awayScore: 2,
        },
      },
      {
        eventId: 201,
        sortOrder: 201,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "18:40",
        timeRemaining: "01:20",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeDescKey: "missed-shot",
        details: {
          eventOwnerTeamId: 20,
          shootingPlayerId: 34,
          zoneCode: "O",
        },
      },
    ]);

    const contexts = buildScoreStateContexts(events);

    expect(contexts[1]).toMatchObject({
      eventId: 201,
      homeScoreBeforeEvent: 3,
      awayScoreBeforeEvent: 2,
      ownerScoreDiffBeforeEvent: -1,
      ownerScoreDiffBucket: "trail-1",
      scoreEffectsGameTimeSegment: "final-five-regulation",
      ownerScoreDiffByGameTimeBucket: "trail-1@final-five-regulation",
      isLateGameClose: true,
      isLateGameTrailing: true,
      isLateGameLeading: false,
      isFinalFiveMinutes: true,
      isFinalTwoMinutes: true,
    });
  });

  it("tracks late-game leading and overtime score-effects segments separately", () => {
    const events = parseEvents([
      {
        eventId: 299,
        sortOrder: 299,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "15:50",
        timeRemaining: "04:10",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeDescKey: "goal",
        details: {
          eventOwnerTeamId: 10,
          scoringPlayerId: 91,
          zoneCode: "O",
          homeScore: 3,
          awayScore: 2,
        },
      },
      {
        eventId: 300,
        sortOrder: 300,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "16:00",
        timeRemaining: "04:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          zoneCode: "O",
          homeScore: 3,
          awayScore: 2,
        },
      },
      {
        eventId: 301,
        sortOrder: 301,
        periodDescriptor: { number: 4, periodType: "OT" },
        timeInPeriod: "01:00",
        timeRemaining: "04:00",
        situationCode: "1441",
        homeTeamDefendingSide: "left",
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          zoneCode: "O",
        },
      },
    ]);

    const contexts = buildScoreStateContexts(events);

    expect(contexts[1]).toMatchObject({
      eventId: 300,
      scoreEffectsGameTimeSegment: "final-five-regulation",
      ownerScoreDiffByGameTimeBucket: "lead-1@final-five-regulation",
      isLateGameLeading: true,
      isFinalFiveMinutes: true,
      isFinalTwoMinutes: false,
    });
    expect(contexts[2]).toMatchObject({
      eventId: 301,
      scoreEffectsGameTimeSegment: "overtime",
      ownerScoreDiffByGameTimeBucket: "lead-1@overtime",
      isFinalFiveMinutes: null,
      isFinalTwoMinutes: null,
    });
  });
});
