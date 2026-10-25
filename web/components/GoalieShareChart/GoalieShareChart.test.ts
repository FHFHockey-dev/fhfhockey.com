import { describe, expect, it } from "vitest";
import { buildGoalieShareByTeam, type GoalieGameRow } from "../../lib/goalieWorkload";

function row(overrides: Partial<GoalieGameRow>): GoalieGameRow {
  return {
    gameId: 1,
    gameDate: "2026-10-01",
    teamAbbrev: "PHI",
    playerId: 1,
    goalieFullName: "Starter One",
    gamesPlayed: 1,
    wins: 0,
    losses: 0,
    otLosses: 0,
    saves: 27,
    shotsAgainst: 30,
    goalsAgainst: 3,
    timeOnIce: 3600,
    ...overrides
  };
}

// PHI plays 12 games: the starter plays games 1-8, the backup games 9-12.
const phiGames = Array.from({ length: 12 }, (_, index) => {
  const game = index + 1;
  return row({
    gameId: 2026020000 + game,
    gameDate: `2026-10-${String(game).padStart(2, "0")}`,
    playerId: game <= 8 ? 1 : 2,
    goalieFullName: game <= 8 ? "Starter One" : "Backup Two"
  });
});

describe("buildGoalieShareByTeam", () => {
  it("windows on each team's last N completed games", () => {
    const season = buildGoalieShareByTeam(phiGames, "Season").PHI;
    expect(season.totalGames).toBe(12);
    expect(season.goalies.map((g) => [g.goalieFullName, g.gamesPlayed])).toEqual([
      ["Starter One", 8],
      ["Backup Two", 4]
    ]);

    const last10 = buildGoalieShareByTeam(phiGames, "L10").PHI;
    expect(last10.totalGames).toBe(10);
    expect(last10.goalies.map((g) => g.gamesPlayed)).toEqual([6, 4]);
  });

  it("uses every completed game when the span exceeds the games played", () => {
    expect(buildGoalieShareByTeam(phiGames, "L30").PHI.totalGames).toBe(12);
  });

  it("builds save percentage and GAA from summed saves, shots and time on ice", () => {
    const rows = [
      row({ gameId: 1, saves: 9, shotsAgainst: 10, goalsAgainst: 1, timeOnIce: 1800 }),
      row({ gameId: 2, saves: 36, shotsAgainst: 40, goalsAgainst: 4, timeOnIce: 3600 })
    ];
    const [goalie] = buildGoalieShareByTeam(rows, "Season").PHI.goalies;
    expect(goalie.savePct).toBeCloseTo(45 / 50);
    expect(goalie.goalsAgainstAverage).toBeCloseTo((5 * 3600) / 5400);
  });

  it("credits a traded goalie's appearances to the team he played for", () => {
    const rows = [
      row({ gameId: 1, teamAbbrev: "PHI", playerId: 7, goalieFullName: "Traded Goalie" }),
      row({ gameId: 2, teamAbbrev: "BOS", playerId: 7, goalieFullName: "Traded Goalie" })
    ];
    const stats = buildGoalieShareByTeam(rows, "Season");
    expect(stats.PHI.goalies[0].gamesPlayed).toBe(1);
    expect(stats.BOS.goalies[0].gamesPlayed).toBe(1);
  });

  it("counts one team game and two appearances when a goalie relieves", () => {
    const stats = buildGoalieShareByTeam([row({}), row({ playerId: 2 })], "L10").PHI;
    expect(stats.totalGames).toBe(1);
    expect(stats.totalAppearances).toBe(2);
    expect(stats.goalies.map(goalie => goalie.gamesPlayed / stats.totalAppearances)).toEqual([0.5, 0.5]);
  });

  it("windows by distinct team games even when one game has relief", () => {
    const stats = buildGoalieShareByTeam([...phiGames, row({ ...phiGames[11], playerId: 3 })], "L10").PHI;
    expect(stats.totalGames).toBe(10);
    expect(stats.totalAppearances).toBe(11);
  });

  it("preserves missing exposure and distinguishes undefined rates from measured zero", () => {
    const missing = buildGoalieShareByTeam([row({ timeOnIce: null }), row({ gameId: 2, saves: null })], "Season").PHI.goalies[0];
    expect(missing.timeOnIce).toBeNull();
    expect(missing.goalsAgainstAverage).toBeNull();
    expect(missing.savePct).toBeNull();
    const noSaves = buildGoalieShareByTeam([row({ saves: 0, goalsAgainst: 30 })], "Season").PHI.goalies[0];
    expect(noSaves.savePct).toBe(0);
    const noGoals = buildGoalieShareByTeam([row({ saves: 30, goalsAgainst: 0 })], "Season").PHI.goalies[0];
    expect(noGoals.goalsAgainstAverage).toBe(0);
    const noExposure = buildGoalieShareByTeam([row({ shotsAgainst: 0, saves: 0, timeOnIce: 0 })], "Season").PHI.goalies[0];
    expect(noExposure.savePct).toBeNull();
    expect(noExposure.goalsAgainstAverage).toBeNull();
  });
});
