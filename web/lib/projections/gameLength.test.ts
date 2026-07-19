import { describe, expect, it } from "vitest";

import {
  calculateCompletedGameLengthSeconds,
  formatGameLength,
  normalizeNhlGameType,
} from "./gameLength";

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
