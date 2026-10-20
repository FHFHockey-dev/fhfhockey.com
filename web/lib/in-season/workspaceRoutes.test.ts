import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { webcrypto } from "node:crypto";
import { capturePreservation, defaultWorkspace, preservationChecksum, writeWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import { expandBridgeForecasts, packPlanningSnapshots, unpackPlanningSnapshots } from "lib/rosterScheduleData/bridgeForecastWire";
import { WORKSPACE_SAVE_BYTE_BUDGET, WORKSPACE_TRANSPORT_BYTE_BUDGET } from "lib/in-season/workspaceSchema";

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
  it("saves interim bridge projections sent packed in full, and sends them back packed", async () => {
    state.capabilities = ["rso_account_save"];
    const players = [{ id: "7", nhlId: 8470001, nhlTeamId: 10, rosterRevision: "roster-7", name: "Skater", teamAbbreviation: "TOR",
      eligiblePositions: ["C"], eligibilityVerified: true, playerClass: "skater", availability: "free_agent", ownership: null, canDrop: true,
      holdValue: null, reserveEligibility: [] }];
    const games = [{ id: "2026020101", scheduleRevision: "schedule-101", date: "2026-10-02", startsAt: "2026-10-02T23:00:00.000Z",
      teamAbbreviation: "TOR", opponent: "MTL", home: true, status: "scheduled" }];
    const wire = { version: "forge-daily-bridge-wire-v1", seasonId: 20262027, limitations: ["Interim FORGE projection."],
      runs: [["forge-daily-bridge-v1:run-a", "forge-daily-bridge-v1:run-a", "forge-daily-bridge-v1:abc", "2026-10-01T11:00:00.000Z", "2026-10-01T11:00:00.000Z"]],
      rows: [["7", "2026020101", 0, "2026-10-02T23:00:00.000Z", { GOALS: 0.3 }, null, false, null]] };
    const bridged = { ...snapshot, players, games, forecasts: expandBridgeForecasts(wire, { players, games } as never) };
    const sent = packPlanningSnapshots({ workspace, snapshot: bridged, expectedVersion: null });
    expect(sent.snapshot.forecasts).toEqual([]);
    const saved = res(); await workspaceHandler(req("PUT", JSON.parse(JSON.stringify(sent))), saved);
    expect(saved.statusCode).toBe(200);
    expect(state.rows[0].snapshot.forecasts).toEqual(bridged.forecasts);
    expect(saved.body.data.snapshot.forecasts).toEqual([]);
    expect(unpackPlanningSnapshots(JSON.parse(JSON.stringify(saved.body))).data.snapshot).toEqual(bridged);
    const loaded = res(); await workspaceHandler(req("GET"), loaded);
    expect(unpackPlanningSnapshots(JSON.parse(JSON.stringify(loaded.body))).data.snapshot).toEqual(bridged);
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

describe("workspace transport in exact UTF-8 bytes", () => {
  // Measured independently of the route: Vercel caps request and response bodies at 4.5 MB.
  const utf8 = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");
  const SAVE_BUDGET = 3_996_000, TRANSPORT_BUDGET = 4_000_000;
  const noted = (note: string, ctx = context) => ({ ...snapshot, context: ctx, players: [{ id: "p1", nhlId: null, name: "Pálffy", teamAbbreviation: null,
    eligiblePositions: [], playerClass: "skater", availability: "free_agent", ownership: null, canDrop: null, holdValue: null,
    reserveEligibility: [], injury: { status: "IR", label: "IR", note } }] });
  const body = (note: string) => ({ workspace, snapshot: noted(note), expectedVersion: null });
  const ascii = (bytes: number) => body("a".repeat(bytes - utf8(body(""))));
  beforeEach(() => { state.capabilities = ["rso_account_save"]; });

  it("uses a save budget that leaves the response wrapper inside the transport budget", () => {
    expect([WORKSPACE_SAVE_BYTE_BUDGET, WORKSPACE_TRANSPORT_BYTE_BUDGET]).toEqual([SAVE_BUDGET, TRANSPORT_BUDGET]);
  });

  it("saves a packed body exactly at the save budget and sends it back inside the transport budget", async () => {
    const sent = ascii(SAVE_BUDGET);
    expect(utf8(sent)).toBe(SAVE_BUDGET);
    const saved = res(); await workspaceHandler(req("PUT", sent), saved);
    expect(saved.statusCode).toBe(200);
    expect(utf8(saved.body)).toBeLessThanOrEqual(TRANSPORT_BUDGET);
    const loaded = res(); await workspaceHandler(req("GET"), loaded);
    expect(loaded.statusCode).toBe(200);
    expect(utf8(loaded.body)).toBeLessThanOrEqual(TRANSPORT_BUDGET);
  });

  it("rejects a save one byte past the budget before writing anything", async () => {
    const saved = res(); await workspaceHandler(req("PUT", ascii(SAVE_BUDGET + 1)), saved);
    expect(saved.statusCode).toBe(413);
    expect(saved.body.error.code).toBe("workspace_too_large");
    expect(state.rows).toEqual([]);
  });

  it("counts non-ASCII text in UTF-8 bytes, not string length", async () => {
    const sent = body("é".repeat(Math.ceil((SAVE_BUDGET - utf8(body(""))) / 2) + 1));
    expect(JSON.stringify(sent).length).toBeLessThanOrEqual(SAVE_BUDGET);
    expect(utf8(sent)).toBeGreaterThan(SAVE_BUDGET);
    const saved = res(); await workspaceHandler(req("PUT", sent), saved);
    expect(saved.statusCode).toBe(413);
    expect(state.rows).toEqual([]);
  });

  it("refuses to send a stored workspace the platform would cut off, with a clear error", async () => {
    state.rows = [{ ...savedRow("owner-a"), snapshot: noted("ø".repeat(2_100_000)) }];
    const loaded = res(); await workspaceHandler(req("GET"), loaded);
    expect(loaded.statusCode).toBe(503);
    expect(loaded.body.error.code).toBe("workspace_too_large");
    expect(utf8(loaded.body)).toBeLessThan(1_000);
  });

  it("counts preservation responses, which carry the row twice", async () => {
    const original = defaultWorkspace(new Date("2026-10-01T12:00:00Z"));
    original.context = { ...original.context, provider: "yahoo", leagueId: "league", teamId: "team", timeZone: "America/New_York" };
    const big = noted("a".repeat(2_200_000), original.context);
    state.rows = [{ id: "record-a", user_id: "owner-a", provider: "yahoo", season_id: original.context.seasonId, league_id: "league", team_id: "team",
      start_date: original.context.startDate, end_date: original.context.endDate, lock_version: 2, workspace: original, snapshot: big, updated_at: "2026-10-01T12:30:00Z" }];
    const { provider, leagueId, teamId, startDate, endDate } = original.context;
    const plain = res(); await workspaceHandler(req("GET", undefined, { provider, seasonId: String(original.context.seasonId), leagueId, teamId, startDate, endDate }), plain);
    expect(plain.statusCode).toBe(200);
    expect(utf8(plain.body)).toBeLessThanOrEqual(TRANSPORT_BUDGET);
    const read = res(); await workspaceHandler(req("GET", undefined, { ...original.context, seasonId: String(original.context.seasonId), preservation: "read" }), read);
    expect(read.statusCode).toBe(503);
    expect(read.body.error.code).toBe("workspace_too_large");
  });
});
