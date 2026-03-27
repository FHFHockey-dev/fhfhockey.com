import { describe, expect, it } from "vitest";

import { flattenYahooTeams, selectLatestYahooGames } from "./discovery";

describe("Yahoo discovery helpers", () => {
  it("keeps only the latest Yahoo game season for sync", () => {
    const games = [
      { game_key: "411", game_id: 411, season: "2023", code: "nhl" },
      { game_key: "453", game_id: 453, season: "2024", code: "nhl" },
      { game_key: "465", game_id: 465, season: "2025", code: "nhl" },
    ];

    expect(selectLatestYahooGames(games)).toEqual([
      { game_key: "465", game_id: 465, season: "2025", code: "nhl" },
    ]);
  });

  it("flattens owned Yahoo teams from the game_teams wrapper shape", () => {
    const teamGames = [
      {
        game_key: "465",
        game_id: 465,
        code: "nhl",
        name: "Hockey",
        teams: [
          {
            team_key: "465.l.123.t.1",
            league_key: "465.l.123",
            name: "Five Hole",
          },
        ],
      },
    ];

    expect(flattenYahooTeams(teamGames)).toEqual([
      expect.objectContaining({
        team_key: "465.l.123.t.1",
        league_key: "465.l.123",
        game_key: "465",
        game_id: 465,
        game_code: "nhl",
        game_name: "Hockey",
      }),
    ]);
  });
});
