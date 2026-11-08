import { describe, expect, it, vi } from "vitest";

vi.mock("react-chartjs-2", () => ({ Doughnut: () => null }));

import { buildGoalieShareByTeam, type GoalieGameRow } from "./index";

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
});
