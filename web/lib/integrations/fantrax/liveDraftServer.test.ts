import { afterEach, describe, expect, it, vi } from "vitest";

import { loadDraftProAccess } from "lib/draft-pro/server";
import { getFantraxDraftResults } from "./client";
import { isFantraxLiveDraftEnabled, pollFantraxDraftSession, requireFantraxDraftAccess, startFantraxDraftSession, stopFantraxDraftSession } from "./liveDraftServer";
import { discoverLinkedFantraxLeagues, getFantraxConnections } from "./server";

vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: vi.fn().mockResolvedValue({ eligible: true }) }));
vi.mock("./client", async (importOriginal) => ({
  ...await importOriginal<typeof import("./client")>(),
  getFantraxDraftResults: vi.fn(),
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
