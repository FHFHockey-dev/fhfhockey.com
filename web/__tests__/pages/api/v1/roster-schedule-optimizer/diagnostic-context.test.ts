import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), admin: vi.fn(), from: vi.fn(), owner: vi.fn() }));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: mocks.auth }));
vi.mock("lib/draft-pro/ownerAccess", () => ({ isDraftProOwner: mocks.owner }));
vi.mock("lib/supabase/server", () => ({ default: { auth: { admin: { getUserById: mocks.admin } }, from: mocks.from } }));
import handler from "pages/api/v1/roster-schedule-optimizer/diagnostic-context";
import htmlHandler from "pages/api/v1/roster-schedule-optimizer/diagnostic";
import { DIAGNOSTIC_SCOPE } from "lib/rosterScheduleOptimizer/diagnostic";
let tables: Record<string, any>;
let calls: string[];
let filters: Record<string, Record<string, unknown>>;
function response() {
  const res: any = { code: 0, body: null, headers: {}, setHeader: vi.fn((k, v) => { res.headers[k] = v; }), status: vi.fn((code) => { res.code = code; return res; }), end: vi.fn(), json: vi.fn(body => { res.body = body; return res; }), send: vi.fn(body => { res.body = body; return res; }) }; return res;
}
async function run(overrides = {}) {
  const res = response(); await handler({ method: "GET", headers: { host: "localhost:3000", authorization: "Bearer fixture-secret" }, query: {}, socket: { remoteAddress: "127.0.0.1" }, ...overrides } as any, res); return res;
}
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development"); vi.clearAllMocks(); calls = []; filters = {};
  mocks.auth.mockImplementation(async () => { calls.push("auth"); return { id: "owner" }; });
  mocks.admin.mockImplementation(async () => { calls.push("admin"); return { data: { user: { id: "owner" } }, error: null }; }); mocks.owner.mockReturnValue(true);
  tables = {
    external_leagues: { data: [{ id: "league", connected_account_id: "account", external_league_key: "477.l.125593", league_name: DIAGNOSTIC_SCOPE.leagueName, season_key: "2026", league_metadata: { current_week: "3", secret: "DO_NOT_EXPORT" } }], error: null },
    external_teams: { data: [{ id: "team", external_league_id: "league", connected_account_id: "account", external_team_key: "477.l.125593.t.10", team_name: DIAGNOSTIC_SCOPE.teamName, team_metadata: { is_owned: true, secret: "DO_NOT_EXPORT" } }], error: null },
    in_season_workspaces: { data: { id: "row", lock_version: 7, updated_at: "2026-10-15T00:00:00Z", workspace: { context: { ...DIAGNOSTIC_SCOPE, leagueId: "league", teamId: "team", timeZone: "America/New_York" }, roster: [1], intent: { steps: [1], protectedPlayerIds: [], excludedPlayerIds: [] }, secret: "DO_NOT_EXPORT" }, snapshot: null }, error: null },
  };
  mocks.from.mockImplementation(table => {
    calls.push(table); filters[table] = {};
    const query: any = { select: vi.fn(() => query), eq: vi.fn((k, v) => { filters[table][k] = v; return query; }), limit: vi.fn(() => query), maybeSingle: vi.fn(() => query), then: (resolve: any) => Promise.resolve(tables[table]).then(resolve) }; return query;
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("read-only baseline route", () => {
  it("authenticates, binds owned identity and reads baseline sequentially within five reads", async () => {
    const res = await run(); expect(res.code).toBe(200); expect(res.body.backendReads).toBe(5);
    expect(calls).toEqual(["auth", "admin", "external_leagues", "external_teams", "in_season_workspaces"]);
    expect(filters.in_season_workspaces).toEqual({ user_id: "owner", provider: "yahoo", season_id: 20262027, league_id: "league", team_id: "team", start_date: "2026-10-12", end_date: "2026-10-18" });
    expect(res.body.context.currentProviderTimeZone).toBeNull(); expect(res.body.context.currentProviderStartDate).toBeNull();
    expect(res.body.workspace).toMatchObject({ exists: true, version: 7, stepCount: 1, savedTimeZone: "America/New_York", restorableBackup: false });
    expect(res.body.workspace.payloadSha256).toMatch(/^[a-f0-9]{64}$/); expect(JSON.stringify(res.body)).not.toMatch(/DO_NOT_EXPORT|fixture-secret|connected_account_id/);
  });
  it("does not begin data reads while owner verification is pending", async () => {
    let release!: (value: any) => void;
    mocks.admin.mockImplementation(() => { calls.push("admin"); return new Promise(resolve => { release = resolve; }); });
    const pending = run();
    await vi.waitFor(() => expect(calls).toEqual(["auth", "admin"]));
    expect(mocks.from).not.toHaveBeenCalled();
    release({ data: { user: { id: "owner" } }, error: null });
    expect((await pending).body.backendReads).toBe(5);
  });
  it("blocks before any read outside local development, for PUT or context overrides", async () => {
    vi.stubEnv("NODE_ENV", "production"); expect((await run()).code).toBe(404); vi.stubEnv("NODE_ENV", "development");
    expect((await run({ method: "PUT" })).code).toBe(405); expect((await run({ query: { preservation: "read" } })).code).toBe(400); expect(calls).toEqual([]);
  });
  it("rejects a spoofed loopback Host from a remote peer on both routes", async () => {
    expect((await run({ socket: { remoteAddress: "203.0.113.10" } })).code).toBe(404);
    const res = response();
    htmlHandler({ method: "GET", headers: { host: "localhost:3000" }, socket: { remoteAddress: "203.0.113.10" } } as any, res);
    expect(res.code).toBe(404); expect(calls).toEqual([]);
  });
  it("fails closed without auth or owner authority", async () => {
    expect((await run({ headers: { host: "localhost:3000" } })).code).toBe(401); expect(calls).toEqual([]);
    mocks.owner.mockReturnValue(false); expect((await run()).code).toBe(403); expect(calls).toEqual(["auth", "admin"]);
  });
  it.each(["ambiguous", "season", "ownership", "binding", "error"])("stops on %s without workspace access", async kind => {
    if (kind === "ambiguous") tables.external_leagues.data.push(tables.external_leagues.data[0]);
    if (kind === "season") tables.external_leagues.data[0].season_key = "2025";
    if (kind === "ownership") tables.external_teams.data[0].team_metadata.is_owned = false;
    if (kind === "binding") tables.external_teams.data[0].connected_account_id = "other";
    if (kind === "error") tables.external_teams.error = { message: "fixture-secret" };
    const res = await run(); expect(res.code).toBeGreaterThanOrEqual(400); expect(calls).not.toContain("in_season_workspaces"); expect(JSON.stringify(res.body)).not.toContain("fixture-secret");
  });
  it("distinguishes original absence from read failure", async () => {
    tables.in_season_workspaces.data = null; expect((await run()).body.workspace).toEqual({ exists: false });
    tables.in_season_workspaces.error = { message: "DO_NOT_EXPORT" }; const res = await run(); expect(res.code).toBe(503); expect(res.body.workspace).toBeNull();
  });
  it("rejects mismatched saved context", async () => {
    tables.in_season_workspaces.data.workspace.context.teamId = "other"; expect((await run()).body.reason).toBe("saved_context_or_version_invalid");
  });
  it("serves isolated no-store HTML only locally with no account access", () => {
    const res = response(); htmlHandler({ method: "GET", headers: { host: "localhost:3000" }, socket: { remoteAddress: "127.0.0.1" } } as any, res);
    expect(res.code).toBe(200); expect(res.headers["Content-Security-Policy"]).toContain("connect-src 'self'");
    expect(res.body).not.toMatch(/<script src=|_next|AuthProvider|RosterScheduleOptimizer/); expect(calls).toEqual([]);
  });
});
