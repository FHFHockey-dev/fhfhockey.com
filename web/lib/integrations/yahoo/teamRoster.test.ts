import { describe, expect, it, vi } from "vitest";

import {
  getCachedYahooTeamRoster,
  loadYahooTeamRoster,
} from "./teamRoster";

function createTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-2",
    external_league_id: "league-1",
    connected_account_id: "account-1",
    user_id: "user-1",
    provider: "yahoo",
    external_team_key: "500.l.1.t.2",
    team_name: "League Rival",
    team_metadata: { is_owned: false },
    roster_snapshot: { players: [], visibility: "not_fetched" },
    imported_at: "2026-07-13T09:00:00.000Z",
    created_at: "2026-07-13T09:00:00.000Z",
    updated_at: "2026-07-13T09:00:00.000Z",
    ...overrides,
  };
}

function createClient(team: ReturnType<typeof createTeam>) {
  const update = vi.fn();
  const rpc = vi.fn().mockResolvedValue({
    data: [
      {
        access_token: "access-token",
        refresh_token: "refresh-token",
        token_type: "bearer",
        provider_user_id: "guid-1",
      },
    ],
    error: null,
  });

  const client: any = {
    rpc,
    from(table: string) {
      expect(table).toBe("external_teams");
      return {
        select() {
          const query: any = {
            eq: () => query,
            maybeSingle: () => Promise.resolve({ data: team, error: null }),
          };
          return query;
        },
        update(payload: unknown) {
          update(payload);
          const query: any = {
            eq: () => query,
            then: (resolve: (value: unknown) => void) =>
              resolve({ data: null, error: null }),
          };
          return query;
        },
      };
    },
  };

  return { client, rpc, update };
}

describe("Yahoo team roster cache", () => {
  it("returns a fresh league-visible roster and rejects stale snapshots", () => {
    const snapshot = {
      players: [{ player_key: "500.p.1" }],
      visibility: "league",
      fetched_at: "2026-07-13T10:00:00.000Z",
    };

    expect(
      getCachedYahooTeamRoster(
        snapshot,
        new Date("2026-07-13T10:14:59.000Z"),
      ),
    ).toEqual({
      players: [{ player_key: "500.p.1" }],
      fetchedAt: "2026-07-13T10:00:00.000Z",
    });
    expect(
      getCachedYahooTeamRoster(
        snapshot,
        new Date("2026-07-13T10:15:01.000Z"),
      ),
    ).toBeNull();
  });

  it("returns a fresh cached roster without reading tokens or calling Yahoo", async () => {
    const team = createTeam({
      roster_snapshot: {
        players: [{ player_key: "500.p.1" }],
        visibility: "league",
        fetched_at: "2026-07-13T10:00:00.000Z",
      },
    });
    const { client, rpc, update } = createClient(team);
    const fetchRoster = vi.fn();

    const result = await loadYahooTeamRoster({
      userId: "user-1",
      externalTeamId: "team-2",
      redirectUri: "https://fhfhockey.com/api/v1/account/yahoo/callback",
      client,
      now: () => new Date("2026-07-13T10:05:00.000Z"),
      fetchRoster,
    });

    expect(result.cached).toBe(true);
    expect(result.players).toEqual([{ player_key: "500.p.1" }]);
    expect(fetchRoster).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("fetches and caches an opponent roster under the authenticated owner", async () => {
    const { client, rpc, update } = createClient(createTeam());
    const fetchRoster = vi.fn().mockResolvedValue([
      {
        player_key: "500.p.1",
        name: { full: "Connor Example" },
        display_position: "C",
      },
    ]);

    const result = await loadYahooTeamRoster({
      userId: "user-1",
      externalTeamId: "team-2",
      redirectUri: "https://fhfhockey.com/api/v1/account/yahoo/callback",
      client,
      now: () => new Date("2026-07-13T10:20:00.000Z"),
      fetchRoster,
    });

    expect(rpc).toHaveBeenCalledWith(
      "get_connected_account_tokens_secure",
      expect.objectContaining({
        p_connected_account_id: "account-1",
        p_user_id: "user-1",
      }),
    );
    expect(fetchRoster).toHaveBeenCalledWith(
      expect.objectContaining({
        externalTeamKey: "500.l.1.t.2",
        userId: "user-1",
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        roster_snapshot: expect.objectContaining({
          visibility: "league",
          source: "on_demand",
          fetched_at: "2026-07-13T10:20:00.000Z",
        }),
      }),
    );
    expect(result.cached).toBe(false);
    expect(result.players).toHaveLength(1);
  });
});
