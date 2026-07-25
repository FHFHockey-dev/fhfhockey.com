import { describe, expect, it } from "vitest";

import {
  flattenYahooTeams,
  mergeYahooLeagueTeams,
  selectLatestYahooGames,
  selectYahooGamesForCanonicalSeason,
} from "./discovery";
import {
  extractYahooPlayerKeyPage,
  fetchCompleteYahooPlayerKeySnapshot,
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

  it("extracts and completely paginates a deterministic Yahoo player-key snapshot", async () => {
    const page = (players: Array<[string, string, string]>) => ({
      fantasy_content: {
        game: [
          { game_id: "465" },
          {
            players: Object.fromEntries([
              ...players.map(([playerKey, playerId, full], index) => [
                String(index),
                {
                  player: [
                    [
                      { player_key: playerKey },
                      { player_id: playerId },
                      { name: { full } },
                    ],
                  ],
                },
              ]),
              ["count", players.length],
            ]),
          },
        ],
      },
    });
    const requestedUrls: string[] = [];
    const responses = [
      page([
        ["465.p.2", "2", "Player Two"],
        ["465.p.1", "1", "Player One"],
      ]),
      page([["465.p.3", "3", "Player Three"]]),
    ];

    await expect(
      fetchCompleteYahooPlayerKeySnapshot(
        "465",
        async (url) => {
          requestedUrls.push(url);
          return responses.shift();
        },
        { pageSize: 2 },
      ),
    ).resolves.toEqual({
      players: [
        {
          player_key: "465.p.1",
          player_id: 1,
          player_name: "Player One",
        },
        {
          player_key: "465.p.2",
          player_id: 2,
          player_name: "Player Two",
        },
        {
          player_key: "465.p.3",
          player_id: 3,
          player_name: "Player Three",
        },
      ],
      pagesFetched: 2,
    });
    expect(requestedUrls).toEqual([
      expect.stringContaining("/players;start=0;count=2"),
      expect.stringContaining("/players;start=2;count=2"),
    ]);
  });

  it("fails closed on malformed, repeated, or non-terminating key pages", async () => {
    expect(() =>
      extractYahooPlayerKeyPage({
        fantasy_content: { game: [{ game_id: "465" }] },
      }),
    ).toThrow("collection is missing");

    const fullPage = {
      fantasy_content: {
        game: [
          {},
          {
            players: {
              0: {
                player: [[{ player_key: "465.p.1" }, { player_id: "1" }]],
              },
              count: 1,
            },
          },
        ],
      },
    };
    await expect(
      fetchCompleteYahooPlayerKeySnapshot("465", async () => fullPage, {
        pageSize: 1,
      }),
    ).rejects.toThrow("repeated a key");
    await expect(
      fetchCompleteYahooPlayerKeySnapshot(
        "465",
        async (url) => ({
          fantasy_content: {
            game: [
              {},
              {
                players: {
                  0: {
                    player: [
                      [
                        {
                          player_key: `465.p.${
                            Number(url.match(/start=(\d+)/)?.[1] ?? 0) + 1
                          }`,
                        },
                      ],
                    ],
                  },
                  count: 1,
                },
              },
            ],
          },
        }),
        { pageSize: 1, maxPages: 2 },
      ),
    ).rejects.toThrow("exceeded its safety bound");
  });
});
