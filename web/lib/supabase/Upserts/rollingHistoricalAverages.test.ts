import { describe, expect, it } from "vitest";

import {
  createHistoricalAverageAccumulator,
  createHistoricalGpPctAccumulator,
  getHistoricalAverageSnapshot,
  getHistoricalGpPctSnapshot,
  getRollingGpPctSnapshot,
  updateHistoricalAverageAccumulator,
  updateHistoricalGpPctAccumulator
} from "./rollingHistoricalAverages";

describe("rollingHistoricalAverages", () => {
  it("computes season, 3-year, and career averages", () => {
    const acc = createHistoricalAverageAccumulator();
    updateHistoricalAverageAccumulator(acc, 20232024, 1);
    updateHistoricalAverageAccumulator(acc, 20232024, 3);
    updateHistoricalAverageAccumulator(acc, 20242025, 5);
    updateHistoricalAverageAccumulator(acc, 20252026, 7);

    expect(getHistoricalAverageSnapshot(acc, 20252026)).toEqual({
      season: 7,
      threeYear: 4,
      career: 4
    });
  });

  // Decision 16: availability follows the team of record by date. These
  // replace the pre-decision tests that pinned current-team-only windows.
  const days = (from: number, to: number, month = "11") =>
    Array.from({ length: to - from + 1 }, (_, i) =>
      `2025-${month}-${String(from + i).padStart(2, "0")}`
    );
  const feed = (
    acc: ReturnType<typeof createHistoricalGpPctAccumulator>,
    rows: Array<{
      date: string;
      teamId: number | null;
      schedule: string[] | null;
      played?: boolean;
      season?: number;
      regularSeason?: boolean;
    }>
  ) =>
    rows.forEach((row) =>
      updateHistoricalGpPctAccumulator(acc, {
        season: row.season ?? 20252026,
        teamId: row.teamId,
        date: row.date,
        playedThisGame: row.played ?? true,
        teamScheduleDates: row.schedule,
        regularSeason: row.regularSeason
      })
    );

  it("reproduces TJ's worked example: (3 + 5) / (4 + 6) after a trade", () => {
    // Team A plays 11-01, 11-02, 11-04, 11-05; the player misses 11-04.
    // Traded; team B plays 11-06 … 11-11; the player misses 11-08.
    const teamA = ["2025-11-01", "2025-11-02", "2025-11-04", "2025-11-05", "2025-11-08"];
    const teamB = days(6, 11);
    const acc = createHistoricalGpPctAccumulator();
    feed(acc, [
      { date: "2025-11-01", teamId: 1, schedule: teamA },
      { date: "2025-11-02", teamId: 1, schedule: teamA },
      { date: "2025-11-05", teamId: 1, schedule: teamA },
      ...["2025-11-06", "2025-11-07", "2025-11-09", "2025-11-10", "2025-11-11"].map(
        (date) => ({ date, teamId: 2, schedule: teamB })
      )
    ]);

    expect(getRollingGpPctSnapshot(acc, { currentSeason: 20252026 }).windows[10]).toEqual({
      playerGames: 8,
      teamGames: 10,
      ratio: 0.8
    });
    expect(getHistoricalGpPctSnapshot(acc, 20252026)).toMatchObject({
      season: 0.8,
      seasonPlayerGames: 8,
      seasonTeamGames: 10
    });
  });

  it("does not re-add the new team's earlier games after a trade", () => {
    // Team B played 12 games before the trade; only the 5 after count.
    const teamA = days(1, 10);
    const teamB = [...days(1, 12, "10"), ...days(11, 15)];
    const acc = createHistoricalGpPctAccumulator();
    feed(acc, [
      ...teamA.map((date) => ({ date, teamId: 1, schedule: teamA })),
      ...days(11, 15).map((date) => ({ date, teamId: 2, schedule: teamB }))
    ]);

    expect(getHistoricalGpPctSnapshot(acc, 20252026)).toMatchObject({
      season: 1,
      seasonPlayerGames: 15,
      seasonTeamGames: 15
    });
    // A player who missed nothing reads N of N across the trade.
    expect(getRollingGpPctSnapshot(acc, { currentSeason: 20252026 }).windows[10]).toEqual({
      playerGames: 10,
      teamGames: 10,
      ratio: 1
    });
  });

  it("counts missed team games between appearances in the denominator", () => {
    const schedule = days(1, 6);
    const acc = createHistoricalGpPctAccumulator();
    feed(acc, [
      { date: "2025-11-01", teamId: 7, schedule },
      { date: "2025-11-05", teamId: 7, schedule },
      { date: "2025-11-06", teamId: 7, schedule, played: false }
    ]);

    expect(getHistoricalGpPctSnapshot(acc, 20252026)).toMatchObject({
      season: Number((2 / 6).toFixed(6)),
      seasonPlayerGames: 2,
      seasonTeamGames: 6
    });
    expect(getRollingGpPctSnapshot(acc, { currentSeason: 20252026 }).windows[3]).toEqual({
      playerGames: 1,
      teamGames: 3,
      ratio: Number((1 / 3).toFixed(6))
    });
  });

  it("starts an incumbent's season at the team's first game", () => {
    const lastSeason = ["2025-04-10", "2025-04-12"];
    const thisSeason = days(1, 4, "10");
    const acc = createHistoricalGpPctAccumulator();
    feed(acc, [
      { date: "2025-04-12", teamId: 3, schedule: lastSeason, season: 20242025 },
      // Misses the first two games of the new season with the same team.
      { date: "2025-10-03", teamId: 3, schedule: thisSeason },
      { date: "2025-10-04", teamId: 3, schedule: thisSeason }
    ]);

    expect(getHistoricalGpPctSnapshot(acc, 20252026)).toMatchObject({
      season: 0.5,
      seasonTeamGames: 4
    });
  });

  it("skips preseason and playoff rows", () => {
    const schedule = days(1, 2);
    const acc = createHistoricalGpPctAccumulator();
    feed(acc, [
      { date: "2025-09-25", teamId: 4, schedule, regularSeason: false },
      { date: "2025-11-01", teamId: 4, schedule },
      { date: "2025-11-02", teamId: 4, schedule }
    ]);

    expect(getHistoricalGpPctSnapshot(acc, 20252026)).toMatchObject({
      season: 1,
      seasonPlayerGames: 2,
      seasonTeamGames: 2
    });
  });

  it("leaves availability unknown, never clamped, when the team of record is unknown", () => {
    const schedule = days(1, 2);
    const acc = createHistoricalGpPctAccumulator();
    feed(acc, [
      // An older season with no team abbreviation on the log row.
      { date: "2023-01-10", teamId: null, schedule: null, season: 20222023 },
      { date: "2023-01-12", teamId: null, schedule: null, season: 20222023 },
      { date: "2025-11-01", teamId: 5, schedule },
      { date: "2025-11-02", teamId: 5, schedule }
    ]);

    const snapshot = getHistoricalGpPctSnapshot(acc, 20252026);
    expect(snapshot).toMatchObject({
      season: 1,
      seasonTeamGames: 2,
      career: null,
      careerTeamGames: null,
      careerPlayerGames: 4
    });
    expect(getHistoricalGpPctSnapshot(acc, 20222023)).toMatchObject({
      season: null,
      seasonPlayerGames: 2,
      seasonTeamGames: null
    });
  });
});
