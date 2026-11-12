import { describe, expect, test } from "vitest";

import {
  calculateBlendedWinOdds,
  convertTeamRowToWinOddsList,
  formatWinOdds,
  GAME_GRID_WIN_ODDS,
  isBackToBack
} from "./calcWinOdds";

describe("Game Grid win odds are withheld (decision 64, W1 P0 #14)", () => {
  const game = (id, homeOdds) => ({
    id, season: 20262027, gameType: 2,
    homeTeam: { id: 1, winOdds: homeOdds, apiWinOdds: homeOdds }, awayTeam: { id: 2, winOdds: 100 - homeOdds }
  });

  test("a stored odds row never reaches the grid", () => {
    expect(calculateBlendedWinOdds(75, 70)).toBeNull();
    expect(GAME_GRID_WIN_ODDS).toMatchObject({ status: "unavailable", message: "Model odds unavailable" });
  });

  test("the Week Score odds list is withheld, including the back-to-back cut", () => {
    const row = { teamId: 1, weekNumber: 1, MON: game(1, 80), TUE: game(2, 60) };
    expect(convertTeamRowToWinOddsList(row)).toEqual([null, null, null, null, null, null, null]);
  });
});

test("format winOdds", () => {
  expect(formatWinOdds(75)).toEqual("75.0%");
  expect(formatWinOdds(25)).toEqual("25.0%");
});

describe("Back to back", () => {
  // [winOddsList, expected isBackToBack for indexes 0,1,2,4,5,6]
  test.each([
    ["begin", [3, 0.3, null, 0.3, 6.4, null, 2.7], [false, true, false, true, false, false]],
    ["middle", [null, 0.3, null, 0.3, 6.4, null, 2.7], [false, false, false, true, false, false]],
    ["end", [null, 0.3, null, 0.3, null, 1, 2.7], [false, false, false, false, false, true]],
  ])("Back to back, %s", (_name, list, expected) => {
    const days = [0, 1, 2, 4, 5, 6];
    expect(days.map((d) => isBackToBack(list, d))).toEqual(expected);
  });
});
