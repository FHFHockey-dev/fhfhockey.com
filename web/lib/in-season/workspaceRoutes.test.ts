import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { webcrypto } from "node:crypto";
import { capturePreservation, defaultWorkspace, preservationChecksum, writeWorkspace } from "lib/rosterScheduleOptimizer/workspace";

const state = vi.hoisted(() => ({
  userId: "owner-a", rows: [] as any[], capabilities: [] as string[],
  loadAccess: vi.fn(), requireUser: vi.fn(), dbCalls: 0, ownerCheck: vi.fn(), ownerRecordId: "owner-a", authError: false,
  teams: [] as any[], leagues: [] as any[], writes: [] as string[], beforeUpdate: null as null | (() => void),
}));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: state.requireUser }));
vi.mock("lib/in-season/server", () => ({
  loadInSeasonAccess: state.loadAccess,
  requireInSeasonCapability: (access: { capabilities: string[] }, capability: string) => {
    if (!access.capabilities.includes(capability)) throw Object.assign(new Error("Access required."), { statusCode: 403, code: "expired" });
  },
}));
vi.mock("lib/draft-pro/ownerAccess", () => ({ isDraftProOwner: state.ownerCheck }));
vi.mock("lib/supabase/server", () => ({ default: {
  auth: { admin: { getUserById: async () => ({ data: { user: { id: state.ownerRecordId } }, error: state.authError ? new Error("auth read failed") : null }) } },
  from: (table: string) => {
    state.dbCalls += 1;
    const tableRows = table === "in_season_workspaces" ? state.rows : table === "external_teams" ? state.teams : table === "external_leagues" ? state.leagues : null;
    if (!tableRows) throw new Error(`Unexpected table ${table}`);
    const filters: Record<string, unknown> = {};
    let action: "select" | "insert" | "update" = "select";
    let values: any;
    const query = {
      select() { return query; },
      eq(key: string, value: unknown) { filters[key] = value; return query; },
      insert(input: any) { action = "insert"; values = input; return query; },
      update(input: any) { action = "update"; values = input; return query; },
      async maybeSingle() { return run(); },
      async single() { return run(); },
    };
    const matches = (row: any) => Object.entries(filters).every(([key, value]) => row[key] === value);
    const run = () => {
      if (action === "insert") {
        const key = ["user_id", "provider", "season_id", "league_id", "team_id", "start_date", "end_date"];
        if (tableRows.some((row) => key.every((part) => row[part] === values[part]))) return { data: null, error: { code: "23505" } };
        const data = { ...values, id: "workspace-new", updated_at: "2026-10-01T13:00:00Z" };
        tableRows.push(data);
        return { data, error: null };
      }
      if (action === "update" && state.beforeUpdate) { const hook = state.beforeUpdate; state.beforeUpdate = null; hook(); }
      const row = tableRows.find(matches);
      if (!row) return { data: null, error: null };
      if (action === "update") { state.writes.push(table); Object.assign(row, values, { updated_at: "2026-10-01T14:00:00Z" }); }
      return { data: row, error: null };
    };
    return query;
  },
} }));

import accessHandler from "../../pages/api/v1/roster-schedule-optimizer/access";
import workspaceHandler from "../../pages/api/v1/roster-schedule-optimizer/workspace";

const context = { provider: "manual", seasonId: 20262027, leagueId: "league", teamId: "team", startDate: "2026-10-01", endDate: "2026-10-07", timeZone: "America/New_York", asOf: "2026-10-01T12:00:00Z" };
const query = { provider: "manual", seasonId: "20262027", leagueId: "league", teamId: "team", startDate: "2026-10-01", endDate: "2026-10-07" };
const rules = { lineupMode: "daily", rosterSlots: { C: 1 }, acquisitionTiming: "unknown", acquisitionCost: null, periods: [], scoring: { mode: "points", weights: {}, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "unknown" }, unsupported: [] };
const workspace = { version: 1, context, rules, roster: [], intent: { revision: 0, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 10 }, manualPlayers: [], unresolvedNames: [], realized: {}, opponent: null };
const snapshot = { id: "snapshot", context, players: [], roster: [], games: [], forecasts: [], rules, lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
function req(method: string, body?: unknown, params: Record<string, string> = query) { return { method, headers: {}, body, query: params } as any; }
function res() { return { statusCode: 200, body: null as any, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; }, setHeader() {} } as any; }
function savedRow(userId: string, version = 1) { return { id: `workspace-${userId}`, user_id: userId, provider: "manual", season_id: 20262027, league_id: "league", team_id: "team", start_date: "2026-10-01", end_date: "2026-10-07", lock_version: version, workspace, snapshot, updated_at: "2026-10-01T12:30:00Z" }; }

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  state.ownerCheck.mockReset().mockReturnValue(true); state.ownerRecordId = "owner-a"; state.authError = false; state.writes = []; state.beforeUpdate = null;
  state.teams = [{ id: "team", user_id: "owner-a", provider: "yahoo", external_league_id: "league", external_team_key: "477.l.125593.t.10", connected_account_id: "connection", team_metadata: { is_owned: true } }];
  state.leagues = [{ id: "league", user_id: "owner-a", provider: "yahoo", external_league_key: "477.l.125593", connected_account_id: "connection" }];
  state.rows = [];
  state.dbCalls = 0;
  state.userId = "owner-a";
  state.capabilities = [];
  state.requireUser.mockReset().mockImplementation(async () => ({ id: state.userId }));
  state.loadAccess.mockReset().mockImplementation(async () => ({ eligible: state.capabilities.length > 0, capabilities: state.capabilities, grantingSources: [], expiresAt: null, reason: state.capabilities.length ? "eligible" : "expired" }));
});

describe("in-season workspace routes", () => {
  it("rejects anonymous access before loading capabilities or workspaces", async () => {
    state.requireUser.mockImplementation(async (_req, _res, options) => { options.onUnauthorized("Authentication required."); return null; });
    for (const [handler, request] of [
      [accessHandler, req("GET")],
      [workspaceHandler, req("GET")],
      [workspaceHandler, req("PUT", { workspace, snapshot, expectedVersion: null })],
    ] as const) {
      const response = res(); await handler(request, response);
      expect(response.statusCode).toBe(401);
    }
    expect(state.loadAccess).not.toHaveBeenCalled();
    expect(state.dbCalls).toBe(0);
    expect(state.rows).toHaveLength(0);
  });
  it("returns a previously saved snapshot after access expires, scoped to its owner", async () => {
    state.rows.push(savedRow("owner-a"), savedRow("owner-b", 4));
    const owned = res(); await workspaceHandler(req("GET"), owned);
    expect(owned.body.data).toMatchObject({ version: 1, snapshot: { id: "snapshot" } });
    expect(state.loadAccess).not.toHaveBeenCalled();
    state.userId = "owner-b";
    const otherOwner = res(); await workspaceHandler(req("GET"), otherOwner);
    expect(otherOwner.body.data.version).toBe(4);
    state.userId = "owner-c";
    const other = res(); await workspaceHandler(req("GET"), other);
    expect(other.body.data).toBeNull();
  });
  it("requires the current save capability and detects stale expected versions", async () => {
    state.rows.push(savedRow("owner-a", 2));
    const denied = res(); await workspaceHandler(req("PUT", { workspace, snapshot, expectedVersion: 2 }), denied);
    expect(denied.statusCode).toBe(403);
    state.capabilities = ["rso_account_save"];
    const conflict = res(); await workspaceHandler(req("PUT", { workspace, snapshot, expectedVersion: 1 }), conflict);
    expect(conflict.statusCode).toBe(409);
    expect(conflict.body.error.code).toBe("version_conflict");
    const saved = res(); await workspaceHandler(req("PUT", { workspace, snapshot, expectedVersion: 2 }), saved);
    expect(saved.body.data.version).toBe(3);
  });
  it("cannot update another account using its current version", async () => {
    state.rows.push(savedRow("owner-b", 4));
    state.capabilities = ["rso_account_save"];
    const response = res(); await workspaceHandler(req("PUT", { workspace, snapshot, expectedVersion: 4 }), response);
    expect(response.statusCode).toBe(409);
    expect(state.rows[0].lock_version).toBe(4);
    expect(state.rows[0].user_id).toBe("owner-b");
  });
  it("rejects forged owner fields and invalid intent or snapshot context", async () => {
    state.capabilities = ["rso_account_save"];
    for (const body of [
      { workspace: { ...workspace, userId: "owner-b" }, snapshot, expectedVersion: null },
      { workspace: { ...workspace, context: { ...context, seasonId: 2026 } }, snapshot, expectedVersion: null },
      { workspace: { ...workspace, intent: { ...workspace.intent, alternativeCount: 7 } }, snapshot, expectedVersion: null },
      { workspace, snapshot: { ...snapshot, context: { ...context, teamId: "other" } }, expectedVersion: null },
    ]) {
      const response = res(); await workspaceHandler(req("PUT", body), response);
      expect(response.statusCode).toBe(400);
    }
    expect(state.rows).toHaveLength(0);
  });
  it("rejects unsupported methods before authentication", async () => {
    const response = res(); await workspaceHandler(req("DELETE"), response);
    expect(response.statusCode).toBe(405);
    const accessResponse = res(); await accessHandler(req("POST"), accessResponse);
    expect(accessResponse.statusCode).toBe(405);
    expect(state.requireUser).not.toHaveBeenCalled();
  });
  it("returns the current capability response", async () => {
    state.capabilities = ["rso_sync", "rso_account_save"];
    const response = res(); await accessHandler(req("GET"), response);
    expect(response.body.data.capabilities).toEqual(["rso_sync", "rso_account_save"]);
  });
});


afterEach(() => vi.unstubAllGlobals());
describe("owner preservation route", () => {
  function owned() {
    const original = defaultWorkspace(new Date("2026-10-01T12:00:00Z"));
    original.context = { ...original.context, provider: "yahoo", leagueId: "league", teamId: "team", timeZone: "America/New_York" };
    state.rows = [{ id: "record-a", user_id: "owner-a", provider: "yahoo", season_id: original.context.seasonId, league_id: "league", team_id: "team", start_date: original.context.startDate, end_date: original.context.endDate, lock_version: 2, workspace: original, snapshot: null, updated_at: "2026-10-01T12:30:00Z" }];
    const params = { ...original.context, seasonId: String(original.context.seasonId), preservation: "read" };
    return { original, params };
  }
  async function prepare(absent = false) {
    const { original, params } = owned(); if (absent) state.rows = [];
    const read = res(); await workspaceHandler(req("GET", undefined, params), read);
    expect(read.statusCode).toBe(200);
    const values = new Map<string, string>(); const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    writeWorkspace(storage, original);
    const backup = await capturePreservation(storage, "owner-a", original, [], { selectedDate: null, selectedPlayer: null, tab: "itinerary" }, { receiptId: read.body.preservation.receiptId, row: read.body.preservation.row });
    const sealed = res(); await workspaceHandler(req("GET", undefined, { ...params, preservation: "seal", receipt: backup.remote.receiptId, checksum: backup.checksum, localHash: await preservationChecksum(backup.local) }), sealed);
    expect(sealed.statusCode).toBe(200);
    return { original, params, backup, proof: read.body.preservation };
  }
  it("verifies real server identity and owned-team mapping without entitlement loaders or writes", async () => {
    const { original, params } = owned();
    const response = res(); await workspaceHandler(req("GET", undefined, params), response);
    expect(response.body.preservation).toMatchObject({ principalId: "owner-a", ownerVerified: true, contextKey: JSON.stringify(["yahoo", original.context.seasonId, "league", "team", original.context.startDate, original.context.endDate, "America/New_York"]), ownedTeam: { leagueKey: "477.l.125593", teamKey: "477.l.125593.t.10" }, row: { id: "record-a", lock_version: 2 } });
    expect(state.ownerCheck).toHaveBeenCalledWith({ id: "owner-a" }); expect(state.loadAccess).not.toHaveBeenCalled(); expect(state.writes).toEqual([]);
    state.ownerRecordId = "different-principal";
    const mismatch = res(); await workspaceHandler(req("GET", undefined, params), mismatch); expect(mismatch.statusCode).toBe(403);
    state.ownerRecordId = "owner-a"; state.authError = true;
    const unavailable = res(); await workspaceHandler(req("GET", undefined, params), unavailable); expect(unavailable.statusCode).toBe(403); expect(state.loadAccess).not.toHaveBeenCalled();
  });
  it("rejects nonowners, foreign teams, provider account mismatch and time-zone collision", async () => {
    const { params } = owned();
    state.ownerCheck.mockReturnValue(false);
    const nonowner = res(); await workspaceHandler(req("GET", undefined, params), nonowner); expect(nonowner.statusCode).toBe(403);
    state.ownerCheck.mockReturnValue(true); state.teams[0].user_id = "owner-b";
    const tenant = res(); await workspaceHandler(req("GET", undefined, params), tenant); expect(tenant.statusCode).toBe(403);
    state.teams[0].user_id = "owner-a"; state.leagues[0].connected_account_id = "other";
    const connection = res(); await workspaceHandler(req("GET", undefined, params), connection); expect(connection.statusCode).toBe(403);
    state.leagues[0].connected_account_id = "connection";
    const zone = res(); await workspaceHandler(req("GET", undefined, { ...params, timeZone: "UTC" }), zone); expect(zone.statusCode).toBe(409); expect(state.writes).toEqual([]);
  });
  it("pins the original exported payload independently and rejects resealing/substitution", async () => {
    const { params, backup } = await prepare();
    const changed = JSON.parse(JSON.stringify(backup)); changed.view.tab = "candidates";
    const { checksum: _checksum, ...payload } = changed; changed.checksum = await preservationChecksum(payload);
    const reseal = res(); await workspaceHandler(req("GET", undefined, { ...params, preservation: "seal", receipt: backup.remote.receiptId, checksum: changed.checksum }), reseal); expect(reseal.statusCode).toBe(409);
    const restore = res(); await workspaceHandler(req("PUT", { backup: changed, expectedVersion: 2 }, { ...params, preservation: "restore" }), restore); expect(restore.statusCode).toBe(409); expect(state.writes).toEqual([]);
  });
  it("tracks only this writer's acknowledged saves and restores the original with CAS", async () => {
    const { original, params, backup } = await prepare();
    const edited = { ...original, intent: { ...original.intent, revision: 1, protectedPlayerIds: ["player"] } };
    const saved = res(); await workspaceHandler(req("PUT", { workspace: edited, snapshot: null, expectedVersion: 2 }, { ...params, preservation: "write", receipt: backup.remote.receiptId }), saved); expect(saved.body.data.version).toBe(3);
    const unacknowledged = res(); await workspaceHandler(req("GET", undefined, { ...params, preservation: "verify", receipt: backup.remote.receiptId }), unacknowledged); expect(unacknowledged.statusCode).toBe(409);
    const originalLocalHash = await preservationChecksum(backup.local);
    const rejectedLocal = res(); await workspaceHandler(req("GET", undefined, { ...params, preservation: "local_ack", receipt: backup.remote.receiptId, checksum: backup.checksum, previousLocalHash: originalLocalHash, localHash: "a".repeat(64) }), rejectedLocal);
    expect(rejectedLocal.statusCode).toBe(409);
    const ack = res(); await workspaceHandler(req("GET", undefined, { ...params, preservation: "ack", receipt: backup.remote.receiptId, version: "3" }), ack); expect(ack.statusCode).toBe(200);
    expect(ack.body.preservation.localHash).toBe(originalLocalHash);
    const acknowledgedLocal = res(); await workspaceHandler(req("GET", undefined, { ...params, preservation: "local_ack", receipt: backup.remote.receiptId, checksum: backup.checksum, previousLocalHash: originalLocalHash, localHash: "a".repeat(64) }), acknowledgedLocal);
    expect(acknowledgedLocal.statusCode).toBe(200); expect(acknowledgedLocal.body.preservation.localHash).toBe("a".repeat(64));
    const restored = res(); await workspaceHandler(req("PUT", { backup, expectedVersion: 3 }, { ...params, preservation: "restore" }), restored); expect(restored.body.data.version).toBe(4); expect(restored.body.data.workspace).toEqual(original); expect(restored.body.preservation.restored).toBe(true);
    expect(state.loadAccess).not.toHaveBeenCalled();
  });
  it("never adopts a newer GET version from an intervening writer", async () => {
    const { params, backup } = await prepare(); state.rows[0].lock_version = 3;
    const read = res(); await workspaceHandler(req("GET", undefined, { ...params, preservation: "read", receipt: backup.remote.receiptId }), read); expect(read.statusCode).toBe(409);
    const restored = res(); await workspaceHandler(req("PUT", { backup, expectedVersion: 3 }, { ...params, preservation: "restore" }), restored); expect(restored.statusCode).toBe(409); expect(state.rows[0].lock_version).toBe(3); expect(state.writes).toEqual([]);
  });
  it("rejects a concurrent write between readback and restore CAS", async () => {
    const { params, backup } = await prepare(); state.beforeUpdate = () => { state.rows[0].lock_version = 3; state.rows[0].workspace = { ...state.rows[0].workspace, unresolvedNames: ["Other manager change"] }; };
    const restored = res(); await workspaceHandler(req("PUT", { backup, expectedVersion: 2 }, { ...params, preservation: "restore" }), restored);
    expect(restored.statusCode).toBe(409); expect(state.rows[0].workspace.unresolvedNames).toEqual(["Other manager change"]); expect(state.writes).toEqual([]);
  });
  it("holds account writes for original absence and fails closed for missing receipts", async () => {
    const { original, params, backup, proof } = await prepare(true); expect(proof.accountSaveAllowed).toBe(false);
    const save = res(); await workspaceHandler(req("PUT", { workspace: original, snapshot: null, expectedVersion: null }, { ...params, preservation: "write", receipt: backup.remote.receiptId }), save); expect(save.statusCode).toBe(409); expect(state.rows).toEqual([]);
    const missing = res(); await workspaceHandler(req("GET", undefined, { ...params, preservation: "verify", receipt: "unknown-runtime-receipt" }), missing); expect(missing.statusCode).toBe(409); expect(state.writes).toEqual([]);
  });
});
