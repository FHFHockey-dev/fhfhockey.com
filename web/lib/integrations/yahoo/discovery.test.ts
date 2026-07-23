import { describe, expect, it } from "vitest";

import {
  flattenYahooTeams,
  mergeYahooLeagueTeams,
  selectLatestYahooGames,
  selectYahooGamesForCanonicalSeason,
} from "./discovery";
import {
  getYahooRetryAfterMs,
  isRetryableYahooError,
  selectCanonicalYahooGame,
  withYahooRetry,
} from "./ingestionLifecycle";

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

  it("uses the canonical Yahoo game row even when user games are not ordered", () => {
    const games = [
      { game_key: "465", game_id: 465, season: "2025", code: "nhl" },
      { game_key: "453", game_id: 453, season: "2024", code: "nhl" },
      { game_key: "500", game_id: 500, season: "2026", code: "nhl" },
    ];

    expect(
      selectYahooGamesForCanonicalSeason(games, {
        game_id: 500,
        game_key: "500",
        season: 2026,
      }),
    ).toEqual([{ game_key: "500", game_id: 500, season: "2026", code: "nhl" }]);
  });

  it("merges the full league field with standings by team key", () => {
    expect(
      mergeYahooLeagueTeams(
        [
          { team_key: "500.l.1.t.1", name: "Five Hole" },
          { team_key: "500.l.1.t.2", name: "Rival" },
        ],
        [
          { team_key: "500.l.1.t.2", standings: { rank: 1 } },
          { team_key: "500.l.1.t.1", standings: { rank: 2 } },
        ],
      ),
    ).toEqual([
      expect.objectContaining({
        team_key: "500.l.1.t.1",
        standings: { rank: 2 },
      }),
      expect.objectContaining({
        team_key: "500.l.1.t.2",
        standings: { rank: 1 },
      }),
    ]);
  });

  it("selects the newest canonical game deterministically", () => {
    expect(
      selectCanonicalYahooGame([
        { game_id: 465, season: 2025, is_game_over: true },
        { game_id: 500, season: 2026, is_offseason: true },
        { game_id: null, season: 2027 },
      ]),
    ).toEqual({ game_id: 500, season: 2026, is_offseason: true });
  });

  it("retries transient Yahoo failures with Retry-After but fails fast on auth", async () => {
    const sleeps: number[] = [];
    const retryEvents: Array<{ rateLimited: boolean }> = [];
    let calls = 0;

    await expect(
      withYahooRetry(
        async () => {
          calls += 1;
          if (calls === 1) {
            throw {
              status: 429,
              response: { headers: { "retry-after": "2" } },
            };
          }
          return "ok";
        },
        {
          random: () => 0.5,
          sleep: async (delayMs) => {
            sleeps.push(delayMs);
          },
          onRetry: (event) => retryEvents.push(event),
        },
      ),
    ).resolves.toBe("ok");

    expect(sleeps).toEqual([2000]);
    expect(retryEvents).toEqual([
      expect.objectContaining({ rateLimited: true }),
    ]);
    expect(getYahooRetryAfterMs({ headers: { "Retry-After": "3" } }, 0)).toBe(
      3000,
    );
    expect(isRetryableYahooError({ statusCode: 503 })).toBe(true);

    calls = 0;
    await expect(
      withYahooRetry(async () => {
        calls += 1;
        throw { status: 401 };
      }),
    ).rejects.toEqual({ status: 401 });
    expect(calls).toBe(1);
  });
});
