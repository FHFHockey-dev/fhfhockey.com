import { describe, expect, it } from "vitest";

import {
  calculateCompletedGameLengthSeconds,
  formatCompletedPbpGameLength,
  formatGameLength,
  normalizeNhlGameType,
} from "./gameLength";
import type { PbpResponse } from "./ingest/pbp";

function finalPbp(args: {
  gameType?: number;
  period?: number;
  periodType?: string;
  timeRemaining?: string;
} = {}): PbpResponse {
  const period = args.period ?? 3;
  const periodType = args.periodType ?? "REG";
  return {
    id: 2025020001,
    season: 20252026,
    gameType: args.gameType ?? 2,
    gameState: "FINAL",
    gameDate: "2025-10-07",
    startTimeUTC: "2025-10-07T23:00:00Z",
    awayTeam: {
      id: 1,
      abbrev: "AAA",
      commonName: { default: "Away" },
      score: 2,
    },
    homeTeam: {
      id: 2,
      abbrev: "BBB",
      commonName: { default: "Home" },
      score: 3,
    },
    plays: [
      {
        eventId: 1,
        typeDescKey: "period-start",
        periodDescriptor: { number: period, periodType },
        timeInPeriod: "00:00",
        timeRemaining: "20:00",
      },
      {
        eventId: 2,
        typeDescKey: "game-end",
        periodDescriptor: { number: period, periodType },
        timeInPeriod: "20:00",
        timeRemaining: args.timeRemaining ?? "00:00",
      },
    ],
  };
}

describe("completed NHL game length", () => {
  it("normalizes numeric schedule game types for the text database contract", () => {
    expect(normalizeNhlGameType(2)).toBe("2");
    expect(normalizeNhlGameType("3")).toBe("3");
    expect(() => normalizeNhlGameType("regular")).toThrow(
      "Invalid NHL game type",
    );
  });

  it("handles regulation and regular-season overtime or shootout", () => {
    expect(
      calculateCompletedGameLengthSeconds({
        gameType: 2,
        periodDescriptor: { number: 3 },
        clock: { timeRemaining: "00:00" },
        gameOutcome: { lastPeriodType: "REG" },
      }),
    ).toBe(3600);
    expect(
      calculateCompletedGameLengthSeconds({
        gameType: 2,
        periodDescriptor: { number: 4 },
        clock: { timeRemaining: "02:15" },
        gameOutcome: { lastPeriodType: "OT" },
      }),
    ).toBe(3765);
    expect(
      calculateCompletedGameLengthSeconds({
        gameType: 2,
        periodDescriptor: { number: 5 },
        clock: { timeRemaining: "00:00" },
        gameOutcome: { lastPeriodType: "SO" },
      }),
    ).toBe(3900);
  });

  it("uses full 20-minute playoff overtime periods", () => {
    const seconds = calculateCompletedGameLengthSeconds({
      gameType: 3,
      periodDescriptor: { number: 5 },
      clock: { timeRemaining: "10:46" },
      gameOutcome: { lastPeriodType: "OT" },
    });

    expect(seconds).toBe(5354);
    expect(formatGameLength(seconds)).toBe("89:14");
  });

  it("derives persisted game length from the exact final PBP terminal", () => {
    expect(formatCompletedPbpGameLength(finalPbp())).toBe("60:00");
    expect(
      formatCompletedPbpGameLength(
        finalPbp({
          gameType: 3,
          period: 5,
          periodType: "OT",
          timeRemaining: "10:46",
        }),
      ),
    ).toBe("89:14");

    expect(() =>
      formatCompletedPbpGameLength({
        ...finalPbp(),
        gameState: "LIVE",
      }),
    ).toThrow("PBP is not final and complete");
  });

  it("fails closed on malformed or impossible clocks", () => {
    expect(() =>
      calculateCompletedGameLengthSeconds({
        gameType: 2,
        periodDescriptor: { number: 4 },
        clock: { timeRemaining: "5 minutes" },
        gameOutcome: { lastPeriodType: "OT" },
      }),
    ).toThrow("Invalid game clock");
    expect(() =>
      calculateCompletedGameLengthSeconds({
        gameType: 3,
        periodDescriptor: { number: 5 },
        clock: { timeRemaining: "00:00" },
        gameOutcome: { lastPeriodType: "SO" },
      }),
    ).toThrow("Playoff games cannot end in a shootout");
  });
});
