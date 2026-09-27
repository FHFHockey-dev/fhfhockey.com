import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "owner-a", rows: [] as any[], capabilities: [] as string[],
  loadAccess: vi.fn(), requireUser: vi.fn(), dbCalls: 0,
}));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: state.requireUser }));
vi.mock("lib/in-season/server", () => ({
  loadInSeasonAccess: state.loadAccess,
  requireInSeasonCapability: (access: { capabilities: string[] }, capability: string) => {
    if (!access.capabilities.includes(capability)) throw Object.assign(new Error("Access required."), { statusCode: 403, code: "expired" });
  },
}));
vi.mock("lib/supabase/server", () => ({ default: {
  from: (table: string) => {
    state.dbCalls += 1;
    if (table !== "in_season_workspaces") throw new Error(`Unexpected table ${table}`);
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
        if (state.rows.some((row) => key.every((part) => row[part] === values[part]))) return { data: null, error: { code: "23505" } };
        const data = { ...values, id: "workspace-new", updated_at: "2026-10-01T13:00:00Z" };
        state.rows.push(data);
        return { data, error: null };
      }
      const row = state.rows.find(matches);
      if (!row) return { data: null, error: null };
      if (action === "update") Object.assign(row, values, { updated_at: "2026-10-01T14:00:00Z" });
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
function req(method: string, body?: unknown, params = query) { return { method, headers: {}, body, query: params } as any; }
function res() { return { statusCode: 200, body: null as any, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; }, setHeader() {} } as any; }
function savedRow(userId: string, version = 1) { return { user_id: userId, provider: "manual", season_id: 20262027, league_id: "league", team_id: "team", start_date: "2026-10-01", end_date: "2026-10-07", lock_version: version, workspace, snapshot, updated_at: "2026-10-01T12:30:00Z" }; }

beforeEach(() => {
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
