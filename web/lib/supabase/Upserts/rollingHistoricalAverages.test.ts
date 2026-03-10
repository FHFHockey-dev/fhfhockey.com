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

  it("computes healthy one-team availability as full participation across season, 3YA, career, and rolling windows", () => {
    const acc = createHistoricalGpPctAccumulator();
    [1, 2, 3, 4].forEach((teamGamesPlayed) => {
      updateHistoricalGpPctAccumulator(acc, {
        season: 20252026,
        teamId: 10,
        playedThisGame: true,
        teamGamesPlayed
      });
    });

    expect(getHistoricalGpPctSnapshot(acc, 20252026)).toEqual({
      season: 1,
      threeYear: 1,
      career: 1,
      seasonPlayerGames: 4,
      seasonTeamGames: 4,
      threeYearPlayerGames: 4,
      threeYearTeamGames: 4,
      careerPlayerGames: 4,
      careerTeamGames: 4
    });

    expect(
      getRollingGpPctSnapshot(acc, {
        currentSeason: 20252026,
        currentTeamId: 10,
        currentTeamGamesPlayed: 4
      }).windows
    ).toEqual({
      3: { playerGames: 3, teamGames: 3, ratio: 1 },
      5: { playerGames: 4, teamGames: 4, ratio: 1 },
      10: { playerGames: 4, teamGames: 4, ratio: 1 },
      20: { playerGames: 4, teamGames: 4, ratio: 1 }
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

  it("counts missed games in the denominator for availability scopes", () => {
    const acc = createHistoricalGpPctAccumulator();
    updateHistoricalGpPctAccumulator(acc, {
      season: 20252026,
      teamId: 20,
      playedThisGame: true,
      teamGamesPlayed: 1
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20252026,
      teamId: 20,
      playedThisGame: false,
      teamGamesPlayed: 2
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20252026,
      teamId: 20,
      playedThisGame: false,
      teamGamesPlayed: 3
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20242025,
      teamId: 20,
      playedThisGame: true,
      teamGamesPlayed: 4
    });

    expect(getHistoricalGpPctSnapshot(acc, 20252026)).toEqual({
      season: Number((1 / 3).toFixed(6)),
      threeYear: Number((2 / 7).toFixed(6)),
      career: Number((2 / 7).toFixed(6)),
      seasonPlayerGames: 1,
      seasonTeamGames: 3,
      threeYearPlayerGames: 2,
      threeYearTeamGames: 7,
      careerPlayerGames: 2,
      careerTeamGames: 7
    });
  });

  it("keeps season availability player-centered after a trade instead of collapsing to the current team bucket", () => {
    const acc = createHistoricalGpPctAccumulator();
    updateHistoricalGpPctAccumulator(acc, {
      season: 20252026,
      teamId: 1,
      playedThisGame: true,
      teamGamesPlayed: 4
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20252026,
      teamId: 1,
      playedThisGame: true,
      teamGamesPlayed: 9
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20252026,
      teamId: 1,
      playedThisGame: false,
      teamGamesPlayed: 12
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20252026,
      teamId: 2,
      playedThisGame: true,
      teamGamesPlayed: 3
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20252026,
      teamId: 2,
      playedThisGame: false,
      teamGamesPlayed: 8
    });

    expect(getHistoricalGpPctSnapshot(acc, 20252026)).toMatchObject({
      season: 0.15,
      seasonPlayerGames: 3,
      seasonTeamGames: 20
    });
  });

  it("accumulates cross-stint historical gp scopes directly and excludes seasons outside 3YA", () => {
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
      playedThisGame: false,
      teamGamesPlayed: 5
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20242025,
      teamId: 3,
      playedThisGame: true,
      teamGamesPlayed: 20
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20232024,
      teamId: 4,
      playedThisGame: false,
      teamGamesPlayed: 7
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20232024,
      teamId: 5,
      playedThisGame: true,
      teamGamesPlayed: 4
    });
    updateHistoricalGpPctAccumulator(acc, {
      season: 20222023,
      teamId: 6,
      playedThisGame: true,
      teamGamesPlayed: 9
    });

    expect(acc.bySeason.get(20252026)).toEqual({
      playerGames: 1,
      teamGames: 15
    });
    expect(acc.bySeason.get(20232024)).toEqual({
      playerGames: 1,
      teamGames: 11
    });
    expect(acc.careerPlayerGames).toBe(4);
    expect(acc.careerTeamGames).toBe(55);

    expect(getHistoricalGpPctSnapshot(acc, 20252026)).toEqual({
      season: Number((1 / 15).toFixed(6)),
      threeYear: Number((3 / 46).toFixed(6)),
      career: Number((4 / 55).toFixed(6)),
      seasonPlayerGames: 1,
      seasonTeamGames: 15,
      threeYearPlayerGames: 3,
      threeYearTeamGames: 46,
      careerPlayerGames: 4,
      careerTeamGames: 55
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

  it("uses exact current-team windows after a trade and excludes prior-team appearances", () => {
    const acc = createHistoricalGpPctAccumulator();
    [10, 11, 12].forEach((teamGamesPlayed) => {
      updateHistoricalGpPctAccumulator(acc, {
        season: 20252026,
        teamId: 1,
        playedThisGame: true,
        teamGamesPlayed
      });
    });
    [2, 4, 9, 12].forEach((teamGamesPlayed) => {
      updateHistoricalGpPctAccumulator(acc, {
        season: 20252026,
        teamId: 2,
        playedThisGame: true,
        teamGamesPlayed
      });
    });

    expect(
      getRollingGpPctSnapshot(acc, {
        currentSeason: 20252026,
        currentTeamId: 2,
        currentTeamGamesPlayed: 12
      }).windows
    ).toEqual({
      3: { playerGames: 1, teamGames: 3, ratio: Number((1 / 3).toFixed(6)) },
      5: { playerGames: 2, teamGames: 5, ratio: 0.4 },
      10: { playerGames: 3, teamGames: 10, ratio: 0.3 },
      20: { playerGames: 4, teamGames: 12, ratio: Number((4 / 12).toFixed(6)) }
    });
  });
});
