import { describe, expect, it, vi } from "vitest";

import {
  flattenYahooTeams,
  mergeYahooLeagueTeams,
  selectYahooGamesForCanonicalSeason,
  yahooDraftDiscoveryMetadata,
  yahooTeamDraftPosition,
} from "./discovery";
import {
  extractYahooPlayerKeyPage,
  extractYahooPlayerBatch,
  fetchCompleteYahooPlayerKeySnapshot,
  fetchYahooPublicJson,
  getYahooRetryAfterMs,
  isYahooGameWeekSnapshotReceipt,
  isYahooSheetExportEligible,
  isRetryableYahooError,
  prepareYahooGameWeekSnapshot,
  requestYahooSheetExport,
  selectCanonicalYahooGame,
  withYahooRetry,
} from "./ingestionLifecycle";
import {
  assessYahooLifecycleHealth,
  classifyYahooLifecycleError,
} from "./lifecycleHealth";

describe("Yahoo discovery helpers", () => {
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
        code: "nhl",
        game_id: 500,
        game_key: "500",
        season: 2026,
      }),
    ).toEqual([{ game_key: "500", game_id: 500, season: "2026", code: "nhl" }]);
  });

  it("rejects a same-season game whose canonical key does not agree", () => {
    expect(
      selectYahooGamesForCanonicalSeason(
        [{ game_key: "501", game_id: 501, season: "2026", code: "nhl" }],
        { code: "nhl", game_id: 500, game_key: "500", season: 2026 },
      ),
    ).toEqual([]);
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

  it("retains safe Yahoo draft discovery fields", () => {
    expect(
      yahooDraftDiscoveryMetadata(
        { draft_status: "predraft" },
        {
          draft_type: "live",
          is_auction_draft: "0",
          draft_time: "1789000000",
          settings: { pick_time: "45", is_snake_draft: "1" },
        },
      ),
    ).toEqual({
      draft_status: "predraft",
      draft_type: "live",
      is_auction_draft: "0",
      draft_time: "1789000000",
      pick_time: "45",
      draft_order_type: "1",
    });
    expect(yahooTeamDraftPosition({ draft_position: "7" })).toBe(7);
    expect(yahooTeamDraftPosition({ draft_position: "0" })).toBeNull();
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

  it("normalizes one complete Yahoo game metadata/week snapshot", () => {
    expect(
      prepareYahooGameWeekSnapshot({
        game_key: "500",
        game_id: "500",
        name: "Hockey",
        code: "nhl",
        type: "full",
        url: "https://example.test/game/500",
        season: "2026",
        weeks: [
          { week: "2", start: "2026-10-13", end: "2026-10-19" },
          { week: 1, start: "2026-10-06", end: "2026-10-12" },
        ],
      }),
    ).toEqual({
      game: {
        game_id: 500,
        game_key: "500",
        name: "Hockey",
        code: "nhl",
        type: "full",
        url: "https://example.test/game/500",
        season: 2026,
      },
      weeks: [
        { week: 1, start_date: "2026-10-06", end_date: "2026-10-12" },
        { week: 2, start_date: "2026-10-13", end_date: "2026-10-19" },
      ],
    });
  });

  it("normalizes Yahoo's public json_f game-week envelope", () => {
    expect(
      prepareYahooGameWeekSnapshot({
        fantasy_content: {
          game: {
            game_key: "477",
            game_id: "477",
            name: "Hockey",
            code: "nhl",
            type: "full",
            url: "https://hockey.fantasysports.yahoo.com/hockey",
            season: "2026",
            game_weeks: [
              {
                game_week: {
                  week: "1",
                  start: "2026-09-29",
                  end: "2026-10-04",
                },
              },
            ],
          },
        },
      }),
    ).toMatchObject({
      game: { game_id: 477, game_key: "477", season: 2026 },
      weeks: [{ week: 1, start_date: "2026-09-29", end_date: "2026-10-04" }],
    });
  });

  it("rejects partial, duplicate, and invalid Yahoo game-week snapshots", () => {
    expect(() =>
      prepareYahooGameWeekSnapshot({
        game_key: "500",
        game_id: "500",
        season: "2026",
        weeks: [],
      }),
    ).toThrow("incomplete");
    expect(() =>
      prepareYahooGameWeekSnapshot({
        game_key: "500",
        game_id: "500",
        season: "2026",
        weeks: [
          { week: 1, start: "2026-10-13", end: "2026-10-12" },
          { week: 1, start: "2026-10-20", end: "2026-10-26" },
        ],
      }),
    ).toThrow("invalid");
  });

  it("accepts only an exact first-run game-week persistence receipt", () => {
    const expected = {
      snapshotId: "11111111-1111-4111-8111-111111111111",
      gameId: 500,
      gameKey: "500",
      season: 2026,
      sourceCount: 2,
    };
    const receipt = {
      ...expected,
      sourceHash: "a".repeat(64),
      metadataChanged: true,
      changed: 2,
      removed: 0,
      replayed: false,
    };

    expect(isYahooGameWeekSnapshotReceipt(receipt, expected)).toBe(true);
    expect(
      isYahooGameWeekSnapshotReceipt({ ...receipt, sourceCount: 1 }, expected),
    ).toBe(false);
    expect(
      isYahooGameWeekSnapshotReceipt({ ...receipt, replayed: true }, expected),
    ).toBe(false);
  });

  it("classifies every Yahoo lifecycle alert from durable audit observations", () => {
    expect(
      assessYahooLifecycleHealth({
        nowMs: Date.parse("2026-07-30T12:00:00Z"),
        observations: [
          {
            time: "2026-07-29T00:00:00Z",
            status: "failure",
            response: {
              rateLimitEvents: 3,
              errorCategory: "token_failure",
              health: { mappedPlayers: 90, unmatchedPlayers: 12 },
            },
          },
          {
            time: "2026-07-28T00:00:00Z",
            status: "failure",
            response: {
              health: { mappedPlayers: 100, unmatchedPlayers: 10 },
            },
          },
        ],
      }).map((warning) => warning.code),
    ).toEqual([
      "stale_last_success",
      "repeated_ownership_failure",
      "mapping_coverage_regression",
      "unmatched_growth",
      "rate_limit_saturation",
      "token_failure",
    ]);
    expect(
      classifyYahooLifecycleError({ code: "42703", message: "column missing" }),
    ).toBe("schema_drift");
    expect(
      classifyYahooLifecycleError({ status: 401, message: "OAuth denied" }),
    ).toBe("token_failure");
    expect(
      classifyYahooLifecycleError({
        status: 503,
        message: "Yahoo unavailable",
      }),
    ).toBe("provider_unavailable");
    expect(
      classifyYahooLifecycleError({
        code: "ETIMEDOUT",
        message: "request timed out",
      }),
    ).toBe("provider_unavailable");
    expect(
      assessYahooLifecycleHealth({
        nowMs: Date.parse("2026-07-30T12:00:00Z"),
        observations: [
          {
            time: "2026-07-30T00:00:00Z",
            status: "failure",
            response: { errorCategory: "provider_unavailable" },
          },
        ],
      }).map((warning) => warning.code),
    ).toContain("provider_unavailable");
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

  it("extracts public json_f player keys and enriched player batches", () => {
    const players = [
      {
        player: {
          player_key: "477.p.6743",
          player_id: "6743",
          name: { full: "Connor McDavid" },
          percent_owned: { value: 100 },
        },
      },
    ];

    expect(
      extractYahooPlayerKeyPage({
        fantasy_content: { game: { players } },
      }),
    ).toEqual([
      {
        player_key: "477.p.6743",
        player_id: 6743,
        player_name: "Connor McDavid",
      },
    ]);
    expect(
      extractYahooPlayerBatch({
        fantasy_content: { players },
      }),
    ).toEqual([
      expect.objectContaining({
        player_key: "477.p.6743",
        percent_owned: { value: 100 },
      }),
    ]);
  });

  it("requests Yahoo's public json_f endpoint and exposes retryable status", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ fantasy_content: { game: {} } }),
      } as Response;
    });

    await expect(
      fetchYahooPublicJson("game/nhl/game_weeks", fetchImpl as typeof fetch),
    ).resolves.toEqual({ fantasy_content: { game: {} } });
    expect(requestedUrls[0]).toContain(
      "pub-api-ro.fantasysports.yahoo.com/fantasy/v2/game/nhl/game_weeks?format=json_f",
    );

    const unavailable = () =>
      fetchYahooPublicJson(
        "game/nhl/game_weeks",
        (async () =>
          ({
            ok: false,
            status: 503,
            headers: new Headers(),
          }) as Response) as typeof fetch,
      );
    await expect(unavailable()).rejects.toMatchObject({ status: 503 });
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

  it("exports sheets only after an exact complete player receipt", async () => {
    expect(
      isYahooSheetExportEligible({
        providerComplete: true,
        ownershipOmitted: 0,
        persistedRows: 1494,
        sourceRows: 1494,
      }),
    ).toBe(true);
    expect(
      isYahooSheetExportEligible({
        providerComplete: true,
        ownershipOmitted: 1,
        persistedRows: 1493,
        sourceRows: 1494,
      }),
    ).toBe(false);

    const fetchImpl = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, count: 1494 }),
      }) as Response;
    await expect(
      requestYahooSheetExport({
        gameId: 465,
        cronSecret: "test-secret",
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).resolves.toEqual({
      attempted: true,
      succeeded: true,
      statusCode: 200,
      reason: "complete_player_receipt",
    });
    await expect(
      requestYahooSheetExport({
        gameId: 465,
        cronSecret: "test-secret",
        fetchImpl: (async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, count: 0 }),
          }) as Response) as typeof fetch,
      }),
    ).resolves.toEqual({
      attempted: true,
      succeeded: false,
      statusCode: 200,
      reason: "request_failed",
    });
    await expect(
      requestYahooSheetExport({
        gameId: 465,
        cronSecret: undefined,
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).resolves.toEqual({
      attempted: false,
      succeeded: false,
      statusCode: null,
      reason: "missing_cron_secret",
    });
  });
});
