import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), season: vi.fn(), draft: vi.fn(), from: vi.fn(), rpc: vi.fn(), oauth: vi.fn() }));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: mocks.user }));
vi.mock("lib/in-season/server", () => ({ loadInSeasonAccess: mocks.season }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: mocks.draft }));
vi.mock("lib/supabase/server", () => ({ default: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("lib/integrations/yahoo/oauth", () => ({ createYahooAuthorizationRequest: mocks.oauth, sanitizeYahooNextPath: () => "/account", buildYahooCallbackUrl: () => "https://fixture.invalid/callback" }));
vi.mock("lib/draft-pro/recommendationsRateLimit", () => ({ consumeRecommendationRequest: () => true }));
import disconnect from "pages/api/v1/account/yahoo/disconnect";
import connect from "pages/api/v1/account/yahoo/connect";
import refresh from "pages/api/v1/account/yahoo/refresh";
import roster from "pages/api/v1/account/yahoo/team-roster";
import pickup from "pages/api/v1/account/yahoo/pickup";
import starter from "pages/api/v1/account/yahoo/starter-board";
import discover from "pages/api/v1/account/fantrax/discover";
import link from "pages/api/v1/account/fantrax/link";
import fantraxRefresh from "pages/api/v1/account/fantrax/refresh";
import connection from "pages/api/v1/account/fantrax/connections/[accountId]";
import apply from "pages/api/v1/account/fantrax/apply-settings";
import players from "pages/api/v1/account/fantrax/player-data";
import draftPlayers from "pages/api/v1/draft-pro/fantrax-player-data";
import provider from "pages/api/v1/roster-schedule-optimizer/provider";
import syncStatus from "pages/api/v1/account/provider-sync";
import rsoAccess from "pages/api/v1/roster-schedule-optimizer/access";
const routes = [
  ["Yahoo connect", connect, "POST"], ["Yahoo refresh", refresh, "POST"], ["Yahoo roster", roster, "POST"],
  ["Yahoo pickup", pickup, "GET"], ["Yahoo starter board", starter, "POST"],
  ["Fantrax discover", discover, "POST"], ["Fantrax link", link, "POST"], ["Fantrax refresh", fantraxRefresh, "POST"],
  ["Fantrax reconfigure", connection, "PATCH"], ["Fantrax apply", apply, "POST"], ["Fantrax players", players, "GET"],
  ["RSO provider", provider, "POST"], ["Fantrax draft player data", draftPlayers, "GET"],
] as const;
const response = () => { const res: any = { statusCode: 200, body: null, setHeader: vi.fn(), end: vi.fn(), status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } }; return res; };
const request = (method: string) => ({ method, headers: {}, query: { accountId: "foreign-account", externalLeagueId: "foreign-league", userId: "foreign-user" }, body: { selectedLeagueKeys: ["foreign-league"], userId: "foreign-user", externalTeamId: "foreign-team", accountId: "foreign-account", provider: "yahoo", teamId: "foreign-team", startDate: "2026-10-21", endDate: "2026-10-28" } }) as any;
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "authenticated-user" }); mocks.season.mockResolvedValue({ eligible: false, capabilities: [], reason: "no_active_grant" }); mocks.draft.mockResolvedValue({ eligible: false, reason: "no_active_grant" }); });
describe.each(routes)("%s API paywall", (_name, handler, method) => {
  it("blocks unauthenticated direct calls", async () => {
    mocks.user.mockImplementation(async (_req, res) => { res.status(401).json({ error: "Sign in" }); return null; });
    const res = response(); await handler(request(method), res);
    expect(res.statusCode).toBe(401); expect(mocks.season).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.oauth).not.toHaveBeenCalled();
  });
  it("blocks free callers before provider credentials or writes and ignores supplied user IDs", async () => {
    const res = response(); await handler(request(method), res);
    expect(res.statusCode).toBe(403); expect(mocks.season).toHaveBeenCalledWith("authenticated-user");
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.oauth).not.toHaveBeenCalled();
  });
  it("fails closed on entitlement outages without exposing internals", async () => {
    mocks.season.mockRejectedValue(new Error("private credentials detail")); mocks.draft.mockRejectedValue(new Error("private database detail"));
    const res = response(); await handler(request(method), res);
    expect(res.statusCode).toBe(503); expect(JSON.stringify(res.body)).not.toContain("private");
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.oauth).not.toHaveBeenCalled();
  });
});

it("keeps Yahoo disconnect available without checking premium and scopes deletion to the signed-in account", async () => {
  const filters: unknown[] = [];
  const query: any = { select: () => query, delete: () => query, update: () => query, eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    maybeSingle: async () => ({ data: { id: "owned-connection" }, error: null }), then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
  mocks.from.mockReturnValue(query);
  const res = response(); await disconnect(request("POST"), res);
  expect(res.statusCode).toBe(200); expect(mocks.season).not.toHaveBeenCalled(); expect(mocks.draft).not.toHaveBeenCalled();
  expect(filters).toContainEqual(["user_id", "authenticated-user"]); expect(filters).toContainEqual(["id", "owned-connection"]);
});
it("keeps Fantrax disconnect available for free accounts through its owner-scoped RPC", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  const res = response(); await connection(request("DELETE"), res);
  expect(res.statusCode).toBe(200); expect(mocks.season).not.toHaveBeenCalled(); expect(mocks.draft).not.toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenCalledWith("disconnect_fantrax_account_secure", { p_user_id: "authenticated-user", p_connected_account_id: "foreign-account" });
});

describe.each([["provider sync", syncStatus], ["RSO", rsoAccess]] as const)("%s access status", (_name, handler) => {
  it("returns a private free response without allowing sync", async () => {
    const res = response(); await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.access ?? res.body.data).toMatchObject({ eligible: false });
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(mocks.season).toHaveBeenCalledWith("authenticated-user");
  });
  it("requires sign-in", async () => {
    mocks.user.mockImplementation(async (_req, res) => { res.status(401).json({ error: "Sign in" }); return null; });
    const res = response(); await handler(request("GET"), res);
    expect(res.statusCode).toBe(401); expect(mocks.season).not.toHaveBeenCalled();
  });
  it("returns unavailable rather than an upgrade when verification fails", async () => {
    mocks.season.mockRejectedValue(new Error("private failure")); mocks.draft.mockRejectedValue(new Error("private failure"));
    const res = response(); await handler(request("GET"), res);
    expect(res.statusCode).toBe(503); expect(JSON.stringify(res.body)).not.toContain("private failure");
  });
  it("preserves grandfathered access without adding unrelated RSO capabilities", async () => {
    mocks.draft.mockResolvedValue({ eligible: true, expiresAt: "2027-07-01T04:00:00Z", nextVerificationAt: null, reason: "eligible" });
    const res = response(); await handler(request("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.access ?? res.body.data).toMatchObject({ eligible: true });
    if (handler === rsoAccess) expect(res.body.data.capabilities).toEqual(["rso_sync"]);
  });
});
