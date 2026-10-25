import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), access: vi.fn(), load: vi.fn(), confirm: vi.fn(), client: vi.fn() }));
vi.mock("lib/supabase", () => ({ createClientWithToken: mocks.client }));
vi.mock("lib/supabase/server", () => ({ default: {} }));
vi.mock("lib/integrations/providerSyncAccessServer", () => ({ requireProviderSyncAccess: mocks.access }));
vi.mock("./planningConfirmations", () => ({ loadYahooPlanningConfirmations: mocks.confirm }));
vi.mock("lib/rosterScheduleData/planning", async original => ({ ...await original<object>(), loadPlanningData: mocks.load }));
import handler from "../../../pages/api/v1/roster-schedule-optimizer/yahoo-current-data";
const nonce = "12345678-1234-4123-8123-123456789012";
const now = "2026-10-23T12:00:00.000Z";
const request = (body = {}, token = "synthetic-token", method = "POST") => ({ method,
  headers: token ? { authorization: `Bearer ${token}` } : {}, body: { nonce, teamId: "team", leagueId: "league",
    seasonId: 20262027, startDate: "2026-10-23", endDate: "2026-10-24", timeZone: "UTC", ...body } }) as any;
function response() { const res = { statusCode: 200, setHeader: vi.fn(), status: vi.fn((code: number) => { res.statusCode = code; return res; }), json: vi.fn(), end: vi.fn() }; return res; }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(now)); vi.resetAllMocks();
  mocks.client.mockReturnValue({ auth: { getUser: mocks.user } });
  mocks.user.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.access.mockResolvedValue({ eligible: true });
  const data = { players: [], games: [], forecasts: [], evidence: {}, forecastManifest: { version: "planning-forecasts-v1",
    id: "manifest", seasonId: 20262027, asOf: now, rsoUsePolicy: { version: "rso-target-use-v1", revision: "policy", bridgeRevisionIds: [] } } };
  mocks.load.mockResolvedValue(data); mocks.confirm.mockResolvedValue({ data, expiresAt: "2026-10-23T12:02:00Z" });
});
afterEach(() => vi.useRealTimers());
it("authenticates the principal rather than trusting body userId, preserves the current source path and returns a private scope-bound receipt", async () => {
  const res = response(); await handler(request({ userId: "forged" }), res as any);
  expect(res.statusCode).toBe(200); expect(mocks.user).toHaveBeenCalledWith("synthetic-token");
  expect(mocks.access).toHaveBeenCalledWith("owner");
  expect(mocks.load).toHaveBeenCalledOnce(); expect(mocks.load.mock.calls[0][2]).toMatchObject({ forgeDailyBridge: true, consumer: "rso" });
  expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner", teamId: "team", leagueId: "league" }));
  expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  expect(res.setHeader).toHaveBeenCalledWith("Vary", "Authorization, Cookie");
  expect(res.json.mock.calls[0][0].read).toEqual({ nonce, principalId: "owner", teamId: "team", leagueId: "league", seasonId: 20262027,
    startDate: "2026-10-23", endDate: "2026-10-24", timeZone: "UTC", evaluatedAt: now, expiresAt: "2026-10-23T12:02:00Z" });
});
it.each(["missing-token", "invalid-token", "method", "nonce", "range", "access"])("rejects %s before planning/provider work", async kind => {
  const req = request(), res = response();
  if (kind === "missing-token") req.headers = {};
  if (kind === "invalid-token") mocks.user.mockResolvedValue({ data: { user: null }, error: new Error() });
  if (kind === "method") req.method = "GET";
  if (kind === "nonce") req.body.nonce = "old-generation";
  if (kind === "range") req.body.endDate = "2010-01-01";
  if (kind === "access") mocks.access.mockRejectedValue({ statusCode: 403 });
  await handler(req, res as any); expect(res.statusCode).toBeGreaterThanOrEqual(400);
  expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled();
});
it("fails without stale forecast fallback or private error disclosure when current Yahoo verification fails", async () => {
  mocks.confirm.mockRejectedValue(new Error("sensitive-provider-body"));
  const res = response(); await handler(request(), res as any);
  expect(res.statusCode).toBe(503); expect(JSON.stringify(res.json.mock.calls)).not.toContain("sensitive-provider-body");
  expect(res.json.mock.calls[0][0]).not.toHaveProperty("data");
});
