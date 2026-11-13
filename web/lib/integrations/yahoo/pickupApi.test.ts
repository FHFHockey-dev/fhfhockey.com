import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), access: vi.fn(), load: vi.fn(), rate: vi.fn() }));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: mocks.user }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: mocks.access }));
vi.mock("lib/draft-pro/features", () => ({ getDraftProFeatureFlags: () => ({}) }));
vi.mock("lib/draft-pro/recommendationsRateLimit", () => ({ consumeRecommendationRequest: mocks.rate }));
vi.mock("./pickupServer", () => ({ loadYahooPickupContext: mocks.load }));
import { YahooLiveDraftError } from "./liveDraft";
import handler from "pages/api/v1/account/yahoo/pickup";
const response = () => { const res: any = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn(), end: vi.fn() }; res.status.mockReturnValue(res); return res; };
beforeEach(() => { vi.stubEnv("PROVIDER_SYNC_PREMIUM_ENFORCEMENT_ENABLED", "true"); vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "owner" }); mocks.access.mockResolvedValue({ eligible: true }); mocks.rate.mockReturnValue(true); mocks.load.mockResolvedValue(null); });
describe("Yahoo pickup API", () => {
  it("requires sign-in before loading premium data", async () => {
    mocks.user.mockResolvedValue(null);
    await handler({ method: "GET" } as any, response());
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("enforces Draft Pro on the server", async () => {
    mocks.access.mockResolvedValue({ eligible: false }); const res = response();
    await handler({ method: "GET" } as any, res);
    expect(res.status).toHaveBeenCalledWith(403); expect(mocks.load).not.toHaveBeenCalled();
  });
  it("scopes loading to the authenticated user and disables shared caching", async () => {
    const res = response(); await handler({ method: "GET", query: { userId: "someone-else" } } as any, res);
    expect(mocks.load).toHaveBeenCalledWith("owner"); expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(res.json).toHaveBeenCalledWith({ data: null });
  });
  it("does not return a partial pool or expose provider errors", async () => {
    mocks.load.mockRejectedValue(new Error("private provider detail")); const res = response();
    await handler({ method: "GET" } as any, res);
    expect(res.status).toHaveBeenCalledWith(503); expect(JSON.stringify(res.json.mock.calls)).not.toContain("private provider detail");
  });
  it.each([
    ["yahoo_reauth_required", 409], ["yahoo_token_refresh_in_progress", 409],
    ["yahoo_rate_limited", 429], ["yahoo_access_denied", 403],
    ["yahoo_pickup_settings_unavailable", 503], ["yahoo_pickup_league_unavailable", 503],
    ["yahoo_pickup_roster_invalid", 503], ["yahoo_game_context_mismatch", 503],
    ["yahoo_token_store_failed", 503], ["yahoo_api_timeout", 503],
  ] as const)("classifies %s safely instead of hiding all errors behind 503", async (code, status) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.load.mockRejectedValue(new YahooLiveDraftError("SECRET token and private roster payload", 599, code));
    const res = response();
    await handler({ method: "GET" } as any, res);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ code, error: expect.any(String) });
    expect(warn).toHaveBeenCalledWith("[yahoo-pickup]", { code, status });
    expect(JSON.stringify([res.json.mock.calls, warn.mock.calls])).not.toContain("SECRET");
  });
  it("does not print unrecognized error codes, messages or metadata", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.load.mockRejectedValue(Object.assign(new YahooLiveDraftError("SECRET", 503, "SECRET_CODE"), { transport: { token: "SECRET" } }));
    const res = response();
    await handler({ method: "GET" } as any, res);
    expect(warn).toHaveBeenCalledWith("[yahoo-pickup]", { code: "yahoo_pickup_unavailable", status: 503 });
    expect(JSON.stringify([res.json.mock.calls, warn.mock.calls])).not.toContain("SECRET");
  });

});

vi.mock("lib/in-season/server", () => ({ loadInSeasonAccess: async () => ({ eligible: false, capabilities: [], reason: "no_active_grant" }) }));

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
