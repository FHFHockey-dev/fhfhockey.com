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

  it("computes season, 3-year, and career gp ratios across season stints", () => {
    const acc = createHistoricalGpPctAccumulator();
    updateHistoricalGpPctAccumulator(acc, {
      season: 20252026,
      teamId: 1,
      playedThisGame: true,
      teamGamesPlayed: 10
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20252026,
      teamId: 2,
      playedThisGame: true,
      teamGamesPlayed: 8
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20242025,
      teamId: 2,
      playedThisGame: true,
      teamGamesPlayed: 5
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20252026,
      teamId: 1,
      playedThisGame: true,
      teamGamesPlayed: 12
    });

    expect(getHistoricalGpPctSnapshot(acc, 20252026)).toEqual({
      season: 0.15,
      threeYear: Number((4 / 25).toFixed(6)),
      career: Number((4 / 25).toFixed(6)),
      seasonPlayerGames: 3,
      seasonTeamGames: 20,
      threeYearPlayerGames: 4,
      threeYearTeamGames: 25,
      careerPlayerGames: 4,
      careerTeamGames: 25
    });
  });

  it("computes rolling gp windows from exact current-team team-game windows", () => {
    const acc = createHistoricalGpPctAccumulator();
    [1, 3, 4, 7, 8].forEach((teamGamesPlayed) => {
      updateHistoricalGpPctAccumulator(acc, {
        season: 20252026,
        teamId: 10,
        playedThisGame: true,
        teamGamesPlayed
      });
    });
    [2, 5].forEach((teamGamesPlayed) => {
      updateHistoricalGpPctAccumulator(acc, {
        season: 20252026,
        teamId: 11,
        playedThisGame: true,
        teamGamesPlayed
      });
    });

    expect(
      getRollingGpPctSnapshot(acc, {
        currentSeason: 20252026,
        currentTeamId: 10,
        currentTeamGamesPlayed: 8
      }).windows
    ).toEqual({
      3: { playerGames: 2, teamGames: 3, ratio: Number((2 / 3).toFixed(6)) },
      5: { playerGames: 3, teamGames: 5, ratio: 0.6 },
      10: { playerGames: 5, teamGames: 8, ratio: 0.625 },
      20: { playerGames: 5, teamGames: 8, ratio: 0.625 }
    });
  });
});
