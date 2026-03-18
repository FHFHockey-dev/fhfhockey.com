import { describe, expect, it } from "vitest";

import { buildTopAddsScheduleContextMap } from "./topAddsScheduleContext";

describe("topAddsScheduleContext", () => {
  it("counts games and off-nights from the selected day forward", () => {
    const context = buildTopAddsScheduleContextMap(
      [
        {
          teamId: 1,
          FRI: {
            id: 1001,
            season: 20252026,
            gameType: 2,
            homeTeam: { id: 1 },
            awayTeam: { id: 2 }
          },
          SUN: {
            id: 1002,
            season: 20252026,
            gameType: 2,
            homeTeam: { id: 3 },
            awayTeam: { id: 1 }
          }
        } as any
      ],
      [9, 11, 8, 7, 6, 10, 5],
      "2026-03-13"
    );

    expect(context.NJD).toEqual({
      teamAbbr: "NJD",
      gamesRemaining: 2,
      offNightsRemaining: 2,
      summaryLabel: "2G • 2 off"
    });
  });

  it("returns an empty map when schedule data is unavailable", () => {
    expect(buildTopAddsScheduleContextMap([], [], "2026-03-13")).toEqual({});
  });
});
