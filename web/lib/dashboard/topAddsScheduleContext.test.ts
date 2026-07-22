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
            awayTeam: { id: 2 },
          },
          SUN: {
            id: 1002,
            season: 20252026,
            gameType: 2,
            homeTeam: { id: 3 },
            awayTeam: { id: 1 },
          },
        } as any,
      ],
      [9, 11, 8, 7, 6, 10, 5],
      "2026-03-13",
      20252026,
    );

    expect(context.NJD).toEqual({
      teamAbbr: "NJD",
      gamesRemaining: 2,
      offNightsRemaining: 2,
      summaryLabel: "2G • 2 off",
    });
  });

  it("returns an empty map when schedule data is unavailable", () => {
    expect(
      buildTopAddsScheduleContextMap([], [], "2026-03-13", 20252026),
    ).toEqual({});
  });

  it.each([
    { seasonId: 20232024, teamId: 53, abbreviation: "ARI" },
    { seasonId: 20242025, teamId: 59, abbreviation: "UTA" },
    { seasonId: 20252026, teamId: 68, abbreviation: "UTA" },
  ])(
    "keys $seasonId $abbreviation/$teamId schedule rows by canonical UTA",
    ({ seasonId, teamId }) => {
      const context = buildTopAddsScheduleContextMap(
        [
          {
            teamId,
            FRI: {
              id: seasonId,
              season: seasonId,
              gameType: 2,
              homeTeam: { id: teamId },
              awayTeam: { id: 6 },
            },
          } as any,
        ],
        [12, 12, 12, 12, 7, 12, 12],
        `${String(seasonId).slice(0, 4)}-03-14`,
        seasonId,
      );

      expect(context).toEqual({
        UTA: {
          teamAbbr: "UTA",
          gamesRemaining: 1,
          offNightsRemaining: 1,
          summaryLabel: "1G • 1 off",
        },
      });
    },
  );

  it("skips a wrong-era padded Utah row before it can overwrite historical context", () => {
    const context = buildTopAddsScheduleContextMap(
      [
        {
          teamId: 53,
          FRI: {
            id: 1,
            season: 20232024,
            gameType: 2,
            homeTeam: { id: 53 },
            awayTeam: { id: 6 },
          },
        } as any,
        {
          teamId: 68,
        } as any,
      ],
      [12, 12, 12, 12, 7, 12, 12],
      "2024-03-14",
      20232024,
    );

    expect(context.UTA?.summaryLabel).toBe("1G • 1 off");
  });

  it("fails malformed, cross-season, and wrong-season Utah data closed", () => {
    expect(
      buildTopAddsScheduleContextMap(
        [
          {
            teamId: 53,
            FRI: {
              id: 1,
              season: 20242025,
              gameType: 2,
              homeTeam: { id: 53 },
              awayTeam: { id: 6 },
            },
          } as any,
          {
            teamId: 59,
            SAT: {
              id: 2,
              season: 20232024,
              gameType: 2,
              homeTeam: { id: 59 },
              awayTeam: { id: 6 },
            },
          } as any,
          { teamId: Number.NaN } as any,
        ],
        [12, 12, 12, 12, 7, 7, 12],
        "2024-03-14",
        20232024,
      ),
    ).toEqual({
      UTA: {
        teamAbbr: "UTA",
        gamesRemaining: 0,
        offNightsRemaining: 0,
        summaryLabel: "0G • 0 off",
      },
    });

    expect(
      buildTopAddsScheduleContextMap(
        [{ teamId: 53 } as any],
        [],
        "2024-03-14",
        20242025,
      ),
    ).toEqual({});
  });

  it("rejects a row whose game does not contain that row's team", () => {
    expect(
      buildTopAddsScheduleContextMap(
        [
          {
            teamId: 53,
            FRI: {
              id: 1,
              season: 20232024,
              gameType: 2,
              homeTeam: { id: 6 },
              awayTeam: { id: 22 },
            },
          } as any,
        ],
        [0, 0, 0, 0, 1, 0, 0],
        "2024-03-14",
        20232024,
      ),
    ).toEqual({
      UTA: {
        teamAbbr: "UTA",
        gamesRemaining: 0,
        offNightsRemaining: 0,
        summaryLabel: "0G • 0 off",
      },
    });
  });

  it("derives off-night counts only from unique eligible-season games", () => {
    const context = buildTopAddsScheduleContextMap(
      [
        {
          teamId: 53,
          FRI: {
            id: 1,
            season: 20232024,
            gameType: 2,
            homeTeam: { id: 53 },
            awayTeam: { id: 6 },
          },
        } as any,
        {
          teamId: 6,
          FRI: {
            id: 1,
            season: 20232024,
            gameType: 2,
            homeTeam: { id: 53 },
            awayTeam: { id: 6 },
          },
        } as any,
        ...(Array.from({ length: 12 }, (_, index) => ({
          teamId: 100 + index,
          FRI: {
            id: 100 + index,
            season: 20242025,
            gameType: index % 2 === 0 ? 2 : 1,
            homeTeam: { id: 100 + index },
            awayTeam: { id: 200 + index },
          },
        })) as any),
      ],
      [0, 0, 0, 0, 13, 0, 0],
      "2024-03-14",
      20232024,
    );

    expect(context.UTA).toEqual({
      teamAbbr: "UTA",
      gamesRemaining: 1,
      offNightsRemaining: 1,
      summaryLabel: "1G • 1 off",
    });
  });

  it("uses calendar-day position across the spring DST transition", () => {
    const context = buildTopAddsScheduleContextMap(
      [
        {
          teamId: 1,
          SAT: {
            id: 1,
            season: 20232024,
            gameType: 2,
            homeTeam: { id: 1 },
            awayTeam: { id: 6 },
          },
        } as any,
      ],
      [0, 0, 0, 0, 0, 1, 0],
      "2024-03-10",
      20232024,
    );

    expect(context.NJD).toEqual({
      teamAbbr: "NJD",
      gamesRemaining: 0,
      offNightsRemaining: 0,
      summaryLabel: "0G • 0 off",
    });
  });
});
