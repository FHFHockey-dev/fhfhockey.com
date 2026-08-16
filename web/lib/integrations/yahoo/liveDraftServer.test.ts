import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchYahooJson,
  pollYahooDraftSession,
  requireOwnedYahooDraftLeague,
} from "./liveDraftServer";

function queryBuilder(
  table: string,
  responses: Record<string, { data: unknown; error: unknown }>,
  filters: Array<[string, string, unknown]>,
) {
  const response = responses[table];
  const builder: any = {
    select() {
      return this;
    },
    eq(column: string, value: unknown) {
      filters.push([table, column, value]);
      return this;
    },
    maybeSingle() {
      return Promise.resolve(response);
    },
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      return Promise.resolve(response).then(resolve, reject);
    },
  };
  return builder;
}

describe("Yahoo live draft ownership", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("requires an owner-scoped external league and an owned Yahoo team", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const externalLeagueId = "22222222-2222-4222-8222-222222222222";
    const filters: Array<[string, string, unknown]> = [];
    const responses = {
      external_leagues: {
        data: {
          id: externalLeagueId,
          connected_account_id: "33333333-3333-4333-8333-333333333333",
          user_id: userId,
          external_league_key: "477.l.123",
          league_name: "Five Hole",
          season_key: "2026",
          league_metadata: {},
          scoring_settings: {},
          roster_settings: {},
        },
        error: null,
      },
      external_teams: {
        data: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            external_league_id: externalLeagueId,
            connected_account_id: "33333333-3333-4333-8333-333333333333",
            user_id: userId,
            external_team_key: "477.l.123.t.1",
            team_name: "Five Hole",
            team_metadata: { is_owned: true },
          },
        ],
        error: null,
      },
    };
    const client = {
      from(table: string) {
        return queryBuilder(table, responses, filters);
      },
    };

    const result = await requireOwnedYahooDraftLeague(
      userId,
      externalLeagueId,
      client,
    );
    expect(result.ownedTeam.external_team_key).toBe("477.l.123.t.1");
    expect(filters).toContainEqual(["external_leagues", "id", externalLeagueId]);
    expect(filters).toContainEqual(["external_leagues", "user_id", userId]);
    expect(filters).toContainEqual(["external_teams", "user_id", userId]);
  });

  it("does not reveal a league owned by another user", async () => {
    const filters: Array<[string, string, unknown]> = [];
    const client = {
      from(table: string) {
        return queryBuilder(
          table,
          { external_leagues: { data: null, error: null } },
          filters,
        );
      },
    };
    await expect(
      requireOwnedYahooDraftLeague(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        client,
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: "yahoo_league_not_found" });
  });

  it("returns owner-scoped state without calling Yahoo when the poll lease is not claimed", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const sessionId = "22222222-2222-4222-8222-222222222222";
    const filters: Array<[string, string, unknown]> = [];
    const now = new Date("2026-08-12T12:00:00Z");
    const session = {
      id: sessionId,
      user_id: userId,
      connected_account_id: "33333333-3333-4333-8333-333333333333",
      external_league_id: "44444444-4444-4444-8444-444444444444",
      external_team_id: "55555555-5555-4555-8555-555555555555",
      draft_ranking_id: null,
      yahoo_game_key: "477",
      yahoo_season: 2026,
      target_season_id: 20262027,
      yahoo_league_key: "477.l.123",
      yahoo_team_key: "477.l.123.t.1",
      normalized_settings: {
        teamCount: 1,
        isSnakeDraft: true,
        rosterConfig: { C: 1, bench: 0, utility: 0 },
        leagueType: "categories",
        scoringCategories: {},
        categoryWeights: { GOALS: 1 },
        draftOrder: "snake",
        requiresConfirmation: false,
        requiresScoringConfirmation: false,
        normalized: {
          gameKey: "477",
          season: "2026",
          providerStatus: "predraft",
          draftOrder: "snake",
          draftType: "live_standard",
          teamCount: 1,
          rosterSize: 1,
          pickTimeSeconds: 30,
          draftTime: null,
        },
      },
      diagnostics: { warnings: [] },
      last_provider_sync_run_id: null,
      status: "active",
      provider_status: "predraft",
      snapshot_hash: null,
      snapshot_version: 0,
      last_pick_number: 0,
      last_snapshot_at: null,
      last_changed_at: null,
      next_poll_at: "2026-08-12T12:00:10Z",
      last_polled_at: null,
      consecutive_failures: 0,
      last_error_code: null,
      last_error_message: null,
      started_at: "2026-08-12T11:59:59Z",
      completed_at: null,
      created_at: "2026-08-12T11:59:59Z",
      updated_at: "2026-08-12T11:59:59Z",
    };
    const responses: any = {
      yahoo_draft_sessions: { data: session, error: null },
      yahoo_draft_picks: { data: [], error: null },
      external_leagues: {
        data: {
          id: session.external_league_id,
          connected_account_id: session.connected_account_id,
          user_id: userId,
          external_league_key: "477.l.123",
          league_name: "Five Hole",
          season_key: "2026",
          league_metadata: {},
          scoring_settings: {},
          roster_settings: {},
        },
        error: null,
      },
      external_teams: {
        data: [
          {
            id: session.external_team_id,
            external_league_id: session.external_league_id,
            connected_account_id: session.connected_account_id,
            user_id: userId,
            external_team_key: session.yahoo_team_key,
            team_name: "Five Hole",
            team_metadata: { is_owned: true, draft_position: 1 },
          },
        ],
        error: null,
      },
    };
    const client: any = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          claimed: false,
          sessionId,
          retryAt: "2026-08-12T12:00:10Z",
        },
        error: null,
      }),
      from(table: string) {
        const builder = queryBuilder(table, responses, filters);
        builder.order = () => builder;
        return builder;
      },
    };
    const fetchImpl = vi.fn();
    const result = await pollYahooDraftSession(userId, sessionId, {
      client,
      fetchImpl: fetchImpl as any,
      now: () => now,
    });
    expect(result.poll).toEqual({
      claimed: false,
      unchanged: true,
      retryAfterSeconds: 10,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(filters).toContainEqual(["yahoo_draft_sessions", "user_id", userId]);
  });

  it("persists a rotated Yahoo refresh token before retrying the request", async () => {
    vi.stubEnv("YAHOO_CONSUMER_KEY", "consumer-key");
    vi.stubEnv("YAHOO_CONSUMER_SECRET", "consumer-secret");
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          access_token: "expired-access",
          refresh_token: "old-refresh",
          token_type: "bearer",
          scopes: [],
          provider_user_id: "guid",
          refresh_expires_at: null,
          secret_metadata: {},
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: "token-row", error: null });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "fresh-access",
            refresh_token: "rotated-refresh",
            token_type: "bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    await expect(
      fetchYahooJson({
        client: { rpc },
        connectedAccountId: "33333333-3333-4333-8333-333333333333",
        userId: "11111111-1111-4111-8111-111111111111",
        url: "https://fantasysports.yahooapis.com/fantasy/v2/league/477.l.1/settings?format=json_f",
        fetchImpl: fetchImpl as any,
        now: new Date("2026-08-12T12:00:00Z"),
      }),
    ).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      "upsert_connected_account_tokens_secure",
      expect.objectContaining({
        p_access_token: "fresh-access",
        p_refresh_token: "rotated-refresh",
      }),
    );
    expect(fetchImpl).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fresh-access",
        }),
      }),
    );
  });
});
