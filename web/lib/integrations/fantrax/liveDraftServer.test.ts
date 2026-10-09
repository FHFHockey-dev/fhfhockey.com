import { afterEach, describe, expect, it, vi } from "vitest";

import { loadDraftProAccess } from "lib/draft-pro/server";
import { getFantraxDraftResults, getFantraxPlayerIds } from "./client";
import { normalizeFantraxDraftResults } from "./draftResults";
import { isFantraxLiveDraftEnabled, pollFantraxDraftSession, requireFantraxDraftAccess, startFantraxDraftSession, stopFantraxDraftSession } from "./liveDraftServer";
import { discoverLinkedFantraxLeagues, getFantraxConnections } from "./server";

vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: vi.fn().mockResolvedValue({ eligible: true }) }));
vi.mock("./client", async (importOriginal) => ({
  ...await importOriginal<typeof import("./client")>(),
  getFantraxDraftResults: vi.fn(),
  getFantraxPlayerIds: vi.fn(),
}));
vi.mock("./server", async (importOriginal) => ({
  ...await importOriginal<typeof import("./server")>(),
  getFantraxConnections: vi.fn(),
  discoverLinkedFantraxLeagues: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("Fantrax live draft access and session lifecycle", () => {
  it("keeps the dedicated rollout off unless exactly enabled", () => {
    expect(isFantraxLiveDraftEnabled({})).toBe(false);
    expect(isFantraxLiveDraftEnabled({ FANTRAX_LIVE_DRAFT_ENABLED: "TRUE" })).toBe(false);
    expect(isFantraxLiveDraftEnabled({ FANTRAX_LIVE_DRAFT_ENABLED: "true" })).toBe(true);
  });

  it("requires server-verified Draft Pro access before calling Fantrax", async () => {
    const loadAccess = vi.fn().mockResolvedValue({ eligible: false });
    await expect(requireFantraxDraftAccess("user", { enabled: false, loadAccess })).rejects.toMatchObject({
      code: "FANTRAX_LIVE_DRAFT_DISABLED",
    });
    expect(loadAccess).not.toHaveBeenCalled();
    await expect(requireFantraxDraftAccess("user", { enabled: true, loadAccess })).rejects.toMatchObject({
      code: "FANTRAX_DRAFT_PRO_REQUIRED",
    });
    loadAccess.mockResolvedValue({ eligible: true });
    await expect(requireFantraxDraftAccess("user", { enabled: true, loadAccess })).resolves.toBeUndefined();
  });

  it("starts only for a linked owned team and a numbered provider snapshot", async () => {
    vi.stubEnv("FANTRAX_LIVE_DRAFT_ENABLED", "true");
    vi.stubEnv("FANTRAX_API_ENABLED", "true");
    vi.mocked(getFantraxConnections).mockResolvedValue({
      apiEnabled: true, defaultExternalLeagueId: null, defaultExternalTeamId: null,
      accounts: [{ id: "account", label: "Fantrax", status: "connected", lastSyncedAt: null,
        integrationModes: ["api"], leagues: [{ id: "league", connectedAccountId: "account",
          externalLeagueKey: "fx-league", name: "NHL", seasonKey: null, importedAt: null,
          settings: {} as never, isDefault: false, settingsChanged: false,
          teams: [{ id: "team", externalTeamKey: "fx-team", name: "Team", division: null, isOwned: true }],
        }],
      }],
    });
    vi.mocked(discoverLinkedFantraxLeagues).mockResolvedValue({
      leagues: [{ externalLeagueKey: "fx-league", name: "NHL", sport: "NHL",
        ownedTeams: [{ externalTeamKey: "fx-team", name: "Team", division: null, isOwned: true }],
      }], previews: [],
    });
    vi.mocked(getFantraxDraftResults).mockResolvedValue({
      draftState: "running", draftType: "snake", draftOrder: ["fx-team"],
      draftPicks: [{ round: 1, pick: 1, pickInRound: 1, teamId: "fx-team", playerId: null }],
    });
    const upsert = { upsert: vi.fn(), select: vi.fn(), single: vi.fn() };
    upsert.upsert.mockReturnValue(upsert);
    upsert.select.mockReturnValue(upsert);
    upsert.single.mockImplementation(async () => ({ data: {
      id: "session", user_id: "owner", status: "active", external_league_id: "league",
      external_team_id: "team", provider_status: "inProgress", last_polled_at: null,
      next_poll_at: "", last_error_code: null, snapshot: upsert.upsert.mock.calls[0][0].snapshot,
    }, error: null }));
    const client = { from: vi.fn().mockReturnValue(upsert) };
    const state = await startFantraxDraftSession({ userId: "owner", externalLeagueId: "league", externalTeamId: "team", client: client as never });
    expect(state.session.status).toBe("active");
    expect(upsert.upsert).toHaveBeenCalledWith(expect.objectContaining({ external_team_id: "team" }), expect.anything());
    await expect(startFantraxDraftSession({ userId: "owner", externalLeagueId: "league", externalTeamId: "other", client: client as never })).rejects.toMatchObject({
      code: "FANTRAX_DRAFT_TEAM_NOT_OWNED",
    });
    expect(getFantraxDraftResults).toHaveBeenCalledTimes(1);
  });

  it("resolves numbered picks through the official catalog and verified identities", async () => {
    vi.stubEnv("FANTRAX_LIVE_DRAFT_ENABLED", "true");
    vi.stubEnv("FANTRAX_API_ENABLED", "true");
    const league = {
      id: "league", connectedAccountId: "account", externalLeagueKey: "fx-league",
      name: "NHL", seasonKey: null, importedAt: null, settings: {} as never,
      isDefault: true, settingsChanged: false,
      teams: [{ id: "team", externalTeamKey: "fx-team", name: "Team", division: null, isOwned: true }],
    };
    vi.mocked(getFantraxConnections).mockResolvedValue({
      apiEnabled: true, defaultExternalLeagueId: "league", defaultExternalTeamId: "team",
      accounts: [{ id: "account", label: "Fantrax", status: "connected", lastSyncedAt: null,
        integrationModes: ["api"], leagues: [league] }],
    });
    vi.mocked(discoverLinkedFantraxLeagues).mockResolvedValue({ leagues: [{
      externalLeagueKey: "fx-league", name: "NHL", sport: "NHL",
      ownedTeams: [{ externalTeamKey: "fx-team", name: "Team", division: null, isOwned: true }],
    }], previews: [] });
    vi.mocked(getFantraxDraftResults).mockResolvedValue({
      draftState: "running", draftType: "snake", draftOrder: ["fx-team"],
      draftPicks: [{ round: 1, pick: 1, pickInRound: 1, teamId: "fx-team", playerId: "fx-player" }],
    });
    vi.mocked(getFantraxPlayerIds).mockResolvedValue({
      "fx-player": { fantraxId: "fx-player", name: "Slafkovsky, Juraj", team: "MTL", position: "RW" },
      "062h5": { fantraxId: "062h5", name: "McKenna, Gavin", team: "TOR", position: "LW" },
    });
    let mappingRows: Array<Record<string, unknown>> = [];
    let sessionRow: Record<string, unknown> = {};
    const client = { from: vi.fn((table: string) => {
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "is"]) query[method] = vi.fn(() => query);
      query.upsert = vi.fn((rows: unknown) => {
        if (table === "fhfh_player_external_identities") mappingRows = rows as typeof mappingRows;
        if (table === "fantrax_draft_sessions") sessionRow = rows as typeof sessionRow;
        return query;
      });
      query.single = vi.fn(async () => ({ data: { id: "session", user_id: "owner", ...sessionRow }, error: null }));
      query.then = (resolve: (value: unknown) => void) => resolve({
        data: table === "teams" ? [{ id: 1, abbreviation: "MTL" }]
          : table === "fhfh_player_identity_aliases" ? [{ fhfh_player_id: 10, normalized_alias: "juraj slafkovsky" }]
          : table === "fhfh_player_identities" ? [{ id: 10, canonical_name: "Juraj Slafkovský", canonical_position: "L",
            current_nhl_team_id: 1, nhl_player_id: 101, verification_status: "verified", merged_into_id: null }]
          : table === "fhfh_player_external_identities" ? mappingRows.map((row) => ({
            ...row, external_player_id: row.external_player_id, fhfh_player_id: row.fhfh_player_id,
          })) : [],
        error: null,
      });
      return query;
    }) };
    const state = await startFantraxDraftSession({ userId: "owner", externalLeagueId: "league", externalTeamId: "team", client: client as never });
    expect(mappingRows).toMatchObject([{ external_player_id: "fx-player", fhfh_player_id: 10, verification_status: "verified" }]);
    expect(state.picks).toMatchObject([{ pickNumber: 1, playerName: "Juraj Slafkovsky", nhlPlayerId: 101 }]);
    expect(sessionRow.snapshot).toMatchObject({ identityMatchVersion: "fantrax-nhl-v3-canonical-name" });
    expect(getFantraxPlayerIds).toHaveBeenCalledTimes(1);
  });

  it("rechecks old session identities when the numbered picks have not changed", async () => {
    vi.stubEnv("FANTRAX_LIVE_DRAFT_ENABLED", "true");
    vi.stubEnv("FANTRAX_API_ENABLED", "true");
    const provider = { draftState: "running", draftType: "snake", draftOrder: ["fx-team"],
      draftPicks: [{ round: 1, pick: 1, pickInRound: 1, teamId: "fx-team", playerId: "062h5" }] };
    const previous = { ...normalizeFantraxDraftResults(provider), identityMatchVersion: "fantrax-nhl-v2-verified-alias" };
    vi.mocked(getFantraxDraftResults).mockResolvedValue(provider);
    vi.mocked(getFantraxPlayerIds).mockResolvedValue({
      "062h5": { fantraxId: "062h5", name: "McKenna, Gavin", team: "TOR", position: "LW" },
    });
    let session = { id: "session", user_id: "owner", status: "active", external_league_id: "league",
      snapshot: previous, snapshot_hash: previous.hash, consecutive_failures: 0, poll_lease_token: null };
    let mappingRows: Array<Record<string, unknown>> = [];
    let updatedSnapshot: unknown;
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: "lease", error: null }),
      from: vi.fn((table: string) => {
        const query: Record<string, unknown> = {};
        for (const method of ["select", "eq", "in", "is"]) query[method] = vi.fn(() => query);
        query.update = vi.fn((patch: Record<string, unknown>) => {
          if (table === "fantrax_draft_sessions") {
            updatedSnapshot = patch.snapshot;
            session = { ...session, ...patch } as typeof session;
          }
          return query;
        });
        query.upsert = vi.fn((rows: unknown) => {
          if (table === "fhfh_player_external_identities") mappingRows = rows as typeof mappingRows;
          return query;
        });
        query.single = vi.fn(async () => ({ data: session, error: null }));
        query.maybeSingle = vi.fn(async () => ({ data: table === "external_leagues"
          ? { external_league_key: "fx-league" } : session, error: null }));
        query.then = (resolve: (value: unknown) => void) => resolve({
          data: table === "teams" ? [{ id: 10, abbreviation: "TOR" }]
            : table === "fhfh_player_identity_aliases" ? []
            : table === "fhfh_player_identities" ? [{ id: 10655, canonical_name: "Gavin McKenna", canonical_position: "L",
              current_nhl_team_id: 10, nhl_player_id: 8486067, verification_status: "verified", merged_into_id: null }]
            : table === "fhfh_player_external_identities" ? mappingRows : [],
          error: null,
        });
        return query;
      }),
    };
    const state = await pollFantraxDraftSession({ userId: "owner", sessionId: "session", client: client as never });
    expect(updatedSnapshot).toMatchObject({ identityMatchVersion: "fantrax-nhl-v3-canonical-name" });
    expect(mappingRows).toMatchObject([{ external_player_id: "062h5", fhfh_player_id: 10655 }]);
    expect(state.picks).toMatchObject([{ pickNumber: 1, nhlPlayerId: 8486067 }]);
  });

  it("allows the owner to stop and retain the last snapshot even when access is unavailable", async () => {
    const row = {
      id: "session", user_id: "owner", status: "active", external_league_id: "league",
      external_team_id: "team", provider_status: "inProgress", last_polled_at: null,
      next_poll_at: "", last_error_code: null, snapshot: {
        safeToApply: true, draftOrder: ["team"], slots: [], picks: [], warning: null,
      },
    };
    const lookup = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    lookup.select.mockReturnValue(lookup);
    lookup.eq.mockReturnValue(lookup);
    lookup.maybeSingle.mockResolvedValue({ data: row, error: null });
    const update = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() };
    update.update.mockReturnValue(update);
    update.eq.mockReturnValue(update);
    update.select.mockReturnValue(update);
    update.single.mockResolvedValue({ data: { ...row, status: "stopped" }, error: null });
    const client = { from: vi.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(update) };
    const state = await stopFantraxDraftSession({ userId: "owner", sessionId: "session", client: client as never });
    expect(state.session.status).toBe("stopped");
    expect(state.picks).toEqual([]);
    expect(update.eq).toHaveBeenCalledWith("user_id", "owner");
  });

  it("releases an active session on entitlement loss without polling Fantrax", async () => {
    vi.stubEnv("FANTRAX_LIVE_DRAFT_ENABLED", "true");
    vi.stubEnv("FANTRAX_API_ENABLED", "true");
    vi.mocked(loadDraftProAccess).mockResolvedValueOnce({ eligible: false } as never);
    const row = {
      id: "session", user_id: "owner", status: "active", external_league_id: "league",
      external_team_id: "team", provider_status: "inProgress", last_polled_at: null,
      next_poll_at: "", last_error_code: null, snapshot: {
        safeToApply: true, draftOrder: ["team"], slots: [], picks: [], warning: null,
      },
    };
    const lookup = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    lookup.select.mockReturnValue(lookup);
    lookup.eq.mockReturnValue(lookup);
    lookup.maybeSingle.mockResolvedValue({ data: row, error: null });
    const update = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() };
    update.update.mockReturnValue(update);
    update.eq.mockReturnValue(update);
    update.select.mockReturnValue(update);
    update.single.mockResolvedValue({ data: { ...row, status: "stopped", last_error_code: "FANTRAX_DRAFT_ACCESS_LOST" }, error: null });
    const client = { from: vi.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(update), rpc: vi.fn() };
    const state = await pollFantraxDraftSession({ userId: "owner", sessionId: "session", client: client as never });
    expect(state.session.status).toBe("stopped");
    expect(state.session.lastErrorCode).toBe("FANTRAX_DRAFT_ACCESS_LOST");
    expect(client.rpc).not.toHaveBeenCalled();
    expect(getFantraxDraftResults).not.toHaveBeenCalled();
  });
});
