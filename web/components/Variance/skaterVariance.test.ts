import { describe, expect, it } from "vitest";

import {
  buildSkaterVarianceRows,
  calculateSkaterProductionProxy
} from "./skaterVariance";

describe("calculateSkaterProductionProxy", () => {
  it("uses neutral points plus shot volume instead of site fantasy scoring", () => {
    expect(calculateSkaterProductionProxy({ points: 2, shots: 5 } as never)).toBe(
      2.5
    );
  });
});

describe("buildSkaterVarianceRows", () => {
  it("aggregates game rows and calculates game-to-game volatility", () => {
    const rows = buildSkaterVarianceRows([
      {
        player_id: 1,
        player_name: "Skater 1",
        team_abbrev: "FLA",
        position_code: "C",
        date: "2025-10-01",
        games_played: 1,
        points: 2,
        goals: 1,
        assists: 1,
        shots: 5,
        toi_per_game: 900
      },
      {
        player_id: 1,
        player_name: "Skater 1",
        team_abbrev: "FLA",
        position_code: "C",
        date: "2025-10-03",
        games_played: 1,
        points: 0,
        goals: 0,
        assists: 0,
        shots: 1,
        toi_per_game: 960
      }
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: 1,
      playerName: "Skater 1",
      team: "FLA",
      position: "C",
      gamesPlayed: 2,
      productionProxy: 2.6,
      goals: 1,
      assists: 1,
      shots: 6,
      toiPerGame: 930
    });
    expect(rows[0].gameVolatility).toBeCloseTo(1.2, 1);
  });
});
