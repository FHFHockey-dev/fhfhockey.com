import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), access: vi.fn(), load: vi.fn(), rate: vi.fn() }));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: mocks.user }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: mocks.access }));
vi.mock("lib/draft-pro/features", () => ({ getDraftProFeatureFlags: () => ({}) }));
vi.mock("lib/draft-pro/recommendationsRateLimit", () => ({ consumeRecommendationRequest: mocks.rate }));
vi.mock("./pickupServer", () => ({ loadYahooPickupContext: mocks.load }));
import handler from "pages/api/v1/account/yahoo/pickup";
const response = () => { const res: any = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn(), end: vi.fn() }; res.status.mockReturnValue(res); return res; };
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "owner" }); mocks.access.mockResolvedValue({ eligible: true }); mocks.rate.mockReturnValue(true); mocks.load.mockResolvedValue(null); });
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
});
