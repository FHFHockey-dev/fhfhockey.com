import { describe, expect, it } from "vitest";

import {
  buildMissReasonContext,
  buildMissReasonContexts,
  classifyMissReasonBucket,
} from "./nhlMissReasons";
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
      sourcePlayByPlayHash: "miss-reason-hash",
      now: "2026-03-30T12:00:00.000Z",
    }
  );
}

describe("nhlMissReasons", () => {
  it("maps each exact NHL miss reason to its named bucket", () => {
    expect(classifyMissReasonBucket("short")).toBe("short-of-net");
    expect(classifyMissReasonBucket("wide-left")).toBe("wide");
    expect(classifyMissReasonBucket("wide-right")).toBe("wide");
    expect(classifyMissReasonBucket("high-and-wide-left")).toBe("high-and-wide");
    expect(classifyMissReasonBucket("high-and-wide-right")).toBe("high-and-wide");
    expect(classifyMissReasonBucket("hit-left-post")).toBe("post");
    expect(classifyMissReasonBucket("hit-right-post")).toBe("post");
    expect(classifyMissReasonBucket("hit-crossbar")).toBe("crossbar");
    // Over the net, not off the bar.
    expect(classifyMissReasonBucket("above-crossbar")).toBe("over-net");
    expect(classifyMissReasonBucket("failed-bank-attempt")).toBe("other");
    expect(classifyMissReasonBucket("short-side")).toBe("other");
    expect(classifyMissReasonBucket(null)).toBe("unknown");
  });

  it("keeps short-of-net missed shots in parity, sequence context, and xG feature eligibility", () => {
    const [event] = parseEvents([
      {
        eventId: 100,
        sortOrder: 100,
        periodDescriptor: { number: 1, periodType: "REG" },
        timeInPeriod: "06:00",
        timeRemaining: "14:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 507,
        typeDescKey: "missed-shot",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 91,
          reason: "short",
          shotType: "wrist",
          xCoord: 76,
          yCoord: 9,
        },
      },
    ]);

    expect(buildMissReasonContext(event)).toEqual({
      gameId: 2025020418,
      eventId: 100,
      missReasonRaw: "short",
      missReasonBucket: "short-of-net",
      isMissedShotEvent: true,
      // "short" is short of the net, not a short-side miss.
      isShortSideMiss: false,
      includeInParityMissCounts: true,
      includeInSequenceContext: true,
      includeInXgShotFeatures: true,
      excludeFromXgForMissReason: false,
      missReasonVersion: 2,
    });
  });

  it("keeps other missed-shot reasons included and preserves the normalized reason bucket", () => {
    const [event] = parseEvents([
      {
        eventId: 200,
        sortOrder: 200,
        periodDescriptor: { number: 2, periodType: "REG" },
        timeInPeriod: "09:00",
        timeRemaining: "11:00",
        situationCode: "1551",
        homeTeamDefendingSide: "right",
        typeCode: 507,
        typeDescKey: "missed-shot",
        details: {
          eventOwnerTeamId: 20,
          shootingPlayerId: 88,
          reason: "above-crossbar",
          shotType: "snap",
          xCoord: -72,
          yCoord: 4,
        },
      },
    ]);

    expect(buildMissReasonContext(event)).toMatchObject({
      eventId: 200,
      missReasonBucket: "over-net",
      includeInParityMissCounts: true,
      includeInSequenceContext: true,
      includeInXgShotFeatures: true,
      excludeFromXgForMissReason: false,
    });
  });

  it("does not treat non-missed-shot events as miss-reason-bearing xG exclusions", () => {
    const events = parseEvents([
      {
        eventId: 300,
        sortOrder: 300,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "12:00",
        timeRemaining: "08:00",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 506,
        typeDescKey: "shot-on-goal",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 34,
          xCoord: 73,
          yCoord: -4,
        },
      },
      {
        eventId: 301,
        sortOrder: 301,
        periodDescriptor: { number: 3, periodType: "REG" },
        timeInPeriod: "12:02",
        timeRemaining: "07:58",
        situationCode: "1551",
        homeTeamDefendingSide: "left",
        typeCode: 507,
        typeDescKey: "missed-shot",
        details: {
          eventOwnerTeamId: 10,
          shootingPlayerId: 16,
          reason: "wide-right",
          xCoord: 79,
          yCoord: 5,
        },
      },
    ]);

    const contexts = buildMissReasonContexts(events);

    expect(contexts).toMatchObject([
      {
        eventId: 300,
        isMissedShotEvent: false,
        missReasonBucket: null,
        includeInParityMissCounts: false,
        includeInSequenceContext: false,
        includeInXgShotFeatures: false,
      },
      {
        eventId: 301,
        isMissedShotEvent: true,
        missReasonBucket: "wide",
        includeInParityMissCounts: true,
        includeInSequenceContext: true,
        includeInXgShotFeatures: true,
      },
    ]);
  });
});
