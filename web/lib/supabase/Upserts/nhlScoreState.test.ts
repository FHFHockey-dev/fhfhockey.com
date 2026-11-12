import { describe, expect, it } from "vitest";

import { parseNhlPlayByPlayEvents } from "./nhlPlayByPlayParser";
import {
  buildRunningScoreTimeline,
  buildScoreStateContexts,
  getSideScoreDiff,
  matchesScoreState,
} from "./nhlScoreState";

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

  describe("running-score timeline (shared score-segment helper)", () => {
    const play = (
      eventId: number,
      timeInPeriod: string,
      typeDescKey: string,
      details: Record<string, unknown> = {},
      periodType = "REG"
    ) => ({
      eventId,
      sortOrder: eventId,
      periodDescriptor: { number: periodType === "SO" ? 5 : 1, periodType },
      timeInPeriod,
      timeRemaining: "00:00",
      situationCode: "1551",
      homeTeamDefendingSide: "left",
      typeDescKey,
      details,
    });

    it("gives events their pre-event score and intervals their post-event score at a goal + stoppage on one clock", () => {
      const events = parseEvents([
        play(1, "05:00", "faceoff", { eventOwnerTeamId: 10 }),
        play(2, "06:00", "goal", { eventOwnerTeamId: 10, homeScore: 1, awayScore: 0 }),
        play(3, "06:00", "stoppage"),
        play(4, "06:00", "faceoff", { eventOwnerTeamId: 20 }),
      ]);
      const timeline = buildRunningScoreTimeline(events);
      const byId = new Map(timeline.map((entry) => [entry.eventId, entry]));

      // Non-goal events carry no scoreboard fields, yet still get a score.
      expect(byId.get(1)!.before).toEqual({ homeScore: 0, awayScore: 0 });
      // The goal is classified tied (pre-event), the interval after it as home +1.
      expect(byId.get(2)!.before).toEqual({ homeScore: 0, awayScore: 0 });
      expect(byId.get(2)!.after).toEqual({ homeScore: 1, awayScore: 0 });
      expect(byId.get(3)!.after).toEqual({ homeScore: 1, awayScore: 0 });
      expect(byId.get(4)!.before).toEqual({ homeScore: 1, awayScore: 0 });
    });

    it("leaves the score unknown after a goal with no scoreboard and no owner", () => {
      const events = parseEvents([
        play(1, "01:00", "goal", {}),
        play(2, "02:00", "shot-on-goal", { eventOwnerTeamId: 20 }),
        play(3, "03:00", "goal", { eventOwnerTeamId: 20, homeScore: 1, awayScore: 1 }),
      ]);
      const byId = new Map(
        buildRunningScoreTimeline(events).map((entry) => [entry.eventId, entry])
      );

      expect(byId.get(2)!.before).toEqual({ homeScore: null, awayScore: null });
      expect(getSideScoreDiff(byId.get(2)!.before, "home")).toBeNull();
      // Unknown is not tied.
      expect(matchesScoreState("tied", getSideScoreDiff(byId.get(2)!.before, "home"))).toBe(false);
      // A later scoreboard re-anchors.
      expect(byId.get(3)!.after).toEqual({ homeScore: 1, awayScore: 1 });
    });

    it("never changes the score on shootout attempts", () => {
      const events = parseEvents([
        play(1, "00:00", "goal", { eventOwnerTeamId: 10, homeScore: 3, awayScore: 2 }, "SO"),
      ]);
      expect(buildRunningScoreTimeline(events)[0].after).toEqual({ homeScore: 0, awayScore: 0 });
    });

    it("decision 11: Leading and Trailing include one-goal margins; Up/Down 1 are subsets", () => {
      expect(matchesScoreState("leading", 1)).toBe(true);
      expect(matchesScoreState("leading", 3)).toBe(true);
      expect(matchesScoreState("upOne", 1)).toBe(true);
      expect(matchesScoreState("upOne", 2)).toBe(false);
      expect(matchesScoreState("trailing", -1)).toBe(true);
      expect(matchesScoreState("downOne", -1)).toBe(true);
      expect(matchesScoreState("withinOne", -1)).toBe(true);
      expect(matchesScoreState("withinOne", 2)).toBe(false);
      expect(matchesScoreState("tied", 0)).toBe(true);
      for (const diff of [-3, -1, 0, 1, 3]) {
        const hits = (["tied", "leading", "trailing"] as const).filter((state) =>
          matchesScoreState(state, diff)
        );
        expect(hits).toHaveLength(1);
      }
      expect(matchesScoreState("allScores", null)).toBe(true);
    });
  });
});
