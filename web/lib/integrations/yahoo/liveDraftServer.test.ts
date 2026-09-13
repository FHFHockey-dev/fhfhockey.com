import { afterEach, describe, expect, it, vi } from "vitest";

import {
  correctedIncomingPickNumbers,
  deferYahooDraftSessionForAccessCheck,
  pauseYahooDraftSessionForAccessLoss,
  postdraftConfirmation,
  pollYahooDraftSession,
  requireOwnedYahooDraftLeague,
  snapshotRequiresCorrectionConfirmation,
  stopYahooDraftSession,
} from "./liveDraftServer";
import { fetchYahooDraftResource } from "./providerClient";

const GAME_CONTEXT = {
  gameCode: "nhl" as const,
  gameKey: "477",
  season: "2026",
  targetSeasonId: 20262027,
};

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
      client as any,
      GAME_CONTEXT,
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
        client as any,
        GAME_CONTEXT,
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: "yahoo_league_not_found" });
  });

  it("stops automatic updates on access loss without changing retained picks", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const builder: any = {
      eq: () => builder,
      in: () => builder,
      maybeSingle: () => Promise.resolve({ data: { id: "session" }, error: null }),
      select: () => builder,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(resolve),
    };
    const client: any = {
      from: (table: string) => ({
        update: (values: Record<string, unknown>) => {
          expect(table).toBe("yahoo_draft_sessions");
          updates.push(values);
          return builder;
        },
      }),
    };

    await pauseYahooDraftSessionForAccessLoss({
      client,
      error: Object.assign(new Error("Draft Pro access is required."), {
        code: "no_active_grant",
        statusCode: 403,
      }),
      sessionId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
    });

    expect(updates).toEqual([
      expect.objectContaining({
        last_error_code: "yahoo_draft_pro_access_required",
        status: "stopped",
      }),
    ]);
    expect(updates[0]).not.toHaveProperty("completed_at");
    expect(updates[0]).not.toHaveProperty("picks");
  });

  it("scopes access transitions and preserves completed rows, picks, and leases", async () => {
    const rows = [
      { id: "active", user_id: "owner", status: "active", completed_at: null, picks: [1], poll_lease_token: "lease", poll_lease_expires_at: "2099-01-01" },
      { id: "complete", user_id: "owner", status: "complete", completed_at: "2026-09-12T01:00:00Z", picks: [2], poll_lease_token: null, poll_lease_expires_at: null },
      { id: "other", user_id: "other", status: "active", completed_at: null, picks: [3], poll_lease_token: "other-lease", poll_lease_expires_at: "2099-01-01" },
    ];
    const updates: Array<{ id: string; values: Record<string, unknown> }> = [];
    const client: any = {
      from: () => {
        const query: any = { id: null, user: null, statuses: null, values: null };
        const builder: any = {
          update: (values: Record<string, unknown>) => { query.values = values; return builder; },
          eq: (column: string, value: string) => { if (column === "id") query.id = value; if (column === "user_id") query.user = value; return builder; },
          in: (_column: string, values: string[]) => { query.statuses = values; return builder; },
          select: () => builder,
          maybeSingle: () => {
            const row = rows.find((candidate) => candidate.id === query.id && candidate.user_id === query.user && (!query.statuses || query.statuses.includes(candidate.status)));
            if (query.values && row) { updates.push({ id: row.id, values: query.values }); Object.assign(row, query.values); }
            return Promise.resolve({ data: row ? { id: row.id } : null, error: null });
          },
          then: (resolve: (value: unknown) => unknown) => {
            const row = rows.find((candidate) => candidate.id === query.id && candidate.user_id === query.user && (!query.statuses || query.statuses.includes(candidate.status)));
            if (query.values && row) { updates.push({ id: row.id, values: query.values }); Object.assign(row, query.values); }
            return Promise.resolve({ data: row ? { id: row.id } : null, error: null }).then(resolve);
          },
        };
        return builder;
      },
    };
    await pauseYahooDraftSessionForAccessLoss({ client, error: new Error("expired"), sessionId: "complete", userId: "owner" });
    await pauseYahooDraftSessionForAccessLoss({ client, error: new Error("expired"), sessionId: "active", userId: "other" });
    await deferYahooDraftSessionForAccessCheck({ client, error: new Error("temporary"), now: new Date("2026-09-12T01:00:00Z"), sessionId: "complete", userId: "owner" });
    await deferYahooDraftSessionForAccessCheck({ client, error: new Error("temporary"), now: new Date("2026-09-12T01:00:00Z"), sessionId: "active", userId: "owner" });
    await expect(stopYahooDraftSession("other", "active", client)).rejects.toMatchObject({ statusCode: 404, code: "yahoo_draft_session_not_found" });
    expect(rows[1]).toMatchObject({ status: "complete", completed_at: "2026-09-12T01:00:00Z", picks: [2] });
    expect(rows[2]).toMatchObject({ status: "active", picks: [3] });
    expect(rows[0]).toMatchObject({ status: "active", poll_lease_token: "lease", poll_lease_expires_at: "2099-01-01", picks: [1] });
    expect(updates.map((update) => update.id)).toEqual(["active"]);
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
          league_metadata: { end_week: "26" },
          scoring_settings: {},
          roster_settings: { uses_playoff: "1", playoff_start_week: "24" },
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
      context: GAME_CONTEXT,
      fetchImpl: fetchImpl as any,
      now: () => now,
    });
    expect(result.poll).toEqual({
      claimed: false,
      unchanged: true,
      retryAfterSeconds: 10,
    });
    expect(result.settings.playoffWeeks).toEqual([24, 25, 26]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(filters).toContainEqual(["yahoo_draft_sessions", "user_id", userId]);
  });

  it("persists a rotated Yahoo refresh token before retrying the request", async () => {
    vi.stubEnv("YAHOO_CONSUMER_KEY", "consumer-key");
    vi.stubEnv("YAHOO_CONSUMER_SECRET", "consumer-secret");
    vi.stubEnv(
      "YAHOO_REDIRECT_URI",
      "https://fhfhockey.com/api/v1/account/yahoo/callback",
    );
    let refreshed = false;
    const rpc = vi.fn(async (name: string) => {
      if (name === "get_connected_account_tokens_secure") {
        return {
          data: {
            access_token: refreshed ? "fresh-access" : "expired-access",
            expires_at: null,
            last_refreshed_at: null,
            refresh_token: refreshed ? "rotated-refresh" : "old-refresh",
            token_type: "bearer",
            scopes: [],
            provider_user_id: "guid",
            refresh_expires_at: null,
            secret_metadata: {},
          },
          error: null,
        };
      }
      if (name === "claim_yahoo_token_refresh_lease") {
        return {
          data: { claimed: true, leaseToken: "lease-token" },
          error: null,
        };
      }
      if (name === "upsert_connected_account_tokens_secure") {
        refreshed = true;
        return { data: "token-row", error: null };
      }
      if (name === "release_yahoo_token_refresh_lease") {
        return { data: true, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });
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
      fetchYahooDraftResource({
        client: { rpc } as any,
        connectedAccountId: "33333333-3333-4333-8333-333333333333",
        context: GAME_CONTEXT,
        leagueKey: "477.l.1",
        resource: "settings",
        userId: "11111111-1111-4111-8111-111111111111",
        fetchImpl: fetchImpl as any,
        now: new Date("2026-08-12T12:00:00Z"),
      }),
    ).resolves.toMatchObject({ payload: { ok: true } });
    expect(rpc).toHaveBeenCalledWith(
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

  it("captures provider cache/rate metadata and distinguishes timeouts", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        access_token: "access-token",
        expires_at: null,
        last_refreshed_at: null,
        provider_user_id: null,
        refresh_expires_at: null,
        refresh_token: "refresh-token",
        scopes: [],
        secret_metadata: {},
        token_type: "bearer",
      },
      error: null,
    });
    const result = await fetchYahooDraftResource({
      client: { rpc } as any,
      connectedAccountId: "33333333-3333-4333-8333-333333333333",
      context: GAME_CONTEXT,
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          headers: {
            age: "4",
            "cache-control": "private, max-age=5",
            etag: '"snapshot"',
            "last-modified": "Mon, 24 Aug 2026 12:00:00 GMT",
            "refresh-rate": "10",
            "retry-after": "7",
          },
          status: 200,
        }),
      ) as any,
      leagueKey: "477.l.1",
      now: new Date("2026-08-24T12:00:00.000Z"),
      resource: "draftresults",
      userId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.transport).toMatchObject({
      ageSeconds: 4,
      cacheControl: "private, max-age=5",
      etagPresent: true,
      lastModifiedPresent: true,
      refreshRate: "10",
      retryAfterSeconds: 7,
    });

    await expect(
      fetchYahooDraftResource({
        client: { rpc } as any,
        connectedAccountId: "33333333-3333-4333-8333-333333333333",
        context: GAME_CONTEXT,
        fetchImpl: vi.fn().mockRejectedValue(
          Object.assign(new Error("timed out"), { name: "TimeoutError" }),
        ) as any,
        leagueKey: "477.l.1",
        resource: "draftresults",
        userId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toMatchObject({ code: "yahoo_api_timeout" });

    await expect(
      fetchYahooDraftResource({
        client: { rpc } as any,
        connectedAccountId: "33333333-3333-4333-8333-333333333333",
        context: GAME_CONTEXT,
        fetchImpl: vi.fn().mockResolvedValue(
          new Response("unavailable", { status: 503 }),
        ) as any,
        leagueKey: "477.l.1",
        resource: "draftresults",
        userId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toMatchObject({ code: "yahoo_provider_outage" });
  });

  it("uses a token refreshed by the current database lease owner", async () => {
    vi.stubEnv("YAHOO_CONSUMER_KEY", "consumer-key");
    vi.stubEnv("YAHOO_CONSUMER_SECRET", "consumer-secret");
    vi.stubEnv(
      "YAHOO_REDIRECT_URI",
      "https://fhfhockey.com/api/v1/account/yahoo/callback",
    );
    let tokenLoads = 0;
    const rpc = vi.fn(async (name: string) => {
      if (name === "get_connected_account_tokens_secure") {
        tokenLoads += 1;
        const refreshed = tokenLoads >= 3;
        return {
          data: {
            access_token: refreshed ? "fresh-access" : "expired-access",
            expires_at: refreshed ? "2026-08-24T13:00:00.000Z" : null,
            last_refreshed_at: refreshed
              ? "2026-08-24T12:00:01.000Z"
              : null,
            refresh_token: "refresh-token",
            token_type: "bearer",
            scopes: [],
            provider_user_id: null,
            refresh_expires_at: null,
            secret_metadata: {},
          },
          error: null,
        };
      }
      if (name === "claim_yahoo_token_refresh_lease") {
        return {
          data: {
            claimed: false,
            retryAt: "2026-08-24T12:00:02.000Z",
          },
          error: null,
        };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    await expect(
      fetchYahooDraftResource({
        client: { rpc } as any,
        connectedAccountId: "33333333-3333-4333-8333-333333333333",
        context: GAME_CONTEXT,
        fetchImpl: fetchImpl as any,
        leagueKey: "477.l.1",
        now: new Date("2026-08-24T12:00:00.000Z"),
        resource: "draftresults",
        userId: "11111111-1111-4111-8111-111111111111",
      }),
    ).resolves.toMatchObject({ payload: { ok: true } });
    expect(fetchImpl).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fresh-access",
        }),
      }),
    );
  });

  it("quarantines regressive and replacement snapshots but permits append-only growth", () => {
    const existing = [
      {
        auction_cost: null,
        pick_number: 1,
        round_number: 1,
        yahoo_player_key: "477.p.10",
        yahoo_team_key: "477.l.1.t.1",
      },
    ];
    const original = {
      cost: null,
      nhlTeamAbbreviation: null,
      pickNumber: 1,
      playerName: null,
      position: null,
      roundNumber: 1,
      yahooPlayerId: "10",
      yahooPlayerKey: "477.p.10",
      yahooTeamKey: "477.l.1.t.1",
    };
    expect(snapshotRequiresCorrectionConfirmation(existing, [])).toBe(true);
    expect(
      snapshotRequiresCorrectionConfirmation(existing, [
        { ...original, cost: 7 },
      ]),
    ).toBe(true);
    expect(
      [...correctedIncomingPickNumbers(existing, [{ ...original, cost: 7 }])],
    ).toEqual([1]);
    expect(
      snapshotRequiresCorrectionConfirmation(existing, [
        { ...original, yahooTeamKey: "477.l.1.t.2" },
      ]),
    ).toBe(true);
    expect(
      snapshotRequiresCorrectionConfirmation(existing, [
        original,
        {
          ...original,
          pickNumber: 2,
          yahooPlayerId: "20",
          yahooPlayerKey: "477.p.20",
          yahooTeamKey: "477.l.1.t.2",
        },
      ]),
    ).toBe(false);
    expect(
      correctedIncomingPickNumbers(existing, [
        original,
        {
          ...original,
          pickNumber: 2,
          yahooPlayerId: "20",
          yahooPlayerKey: "477.p.20",
          yahooTeamKey: "477.l.1.t.2",
        },
      ]).size,
    ).toBe(0);
  });

  it("requires a delayed matching postdraft observation before completion", () => {
    const first = postdraftConfirmation({
      diagnostics: {},
      observedAt: new Date("2026-08-24T12:00:00.000Z"),
      providerStatus: "postdraft",
      snapshotHash: "snapshot-a",
    });
    expect(first.confirmed).toBe(false);
    const confirmed = postdraftConfirmation({
      diagnostics: first.diagnostics,
      observedAt: new Date("2026-08-24T12:00:05.000Z"),
      providerStatus: "postdraft",
      snapshotHash: "snapshot-a",
    });
    expect(confirmed.confirmed).toBe(true);
    expect(
      postdraftConfirmation({
        diagnostics: first.diagnostics,
        observedAt: new Date("2026-08-24T12:00:05.000Z"),
        providerStatus: "postdraft",
        snapshotHash: "snapshot-b",
      }).confirmed,
    ).toBe(false);
  });
});
