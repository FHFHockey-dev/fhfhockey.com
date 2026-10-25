import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), season: vi.fn(), draft: vi.fn(), pickup: vi.fn() }));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: mocks.auth }));
vi.mock("lib/in-season/server", () => ({ loadInSeasonAccess: mocks.season }));
vi.mock("lib/draft-pro/server", () => ({ loadDraftProAccess: mocks.draft }));
vi.mock("lib/integrations/yahoo/pickupServer", () => ({ loadYahooPickupContext: mocks.pickup }));
vi.mock("lib/draft-pro/recommendationsRateLimit", () => ({ consumeRecommendationRequest: () => true }));
import status from "pages/api/v1/account/provider-sync";
import rsoAccess from "pages/api/v1/roster-schedule-optimizer/access";
import pickup from "pages/api/v1/account/yahoo/pickup";
import { requireYahooLiveDraftServerAccess } from "./yahoo/liveDraftAccess";
import { requireFantraxDraftAccess } from "./fantrax/liveDraftServer";
const req = (query = {}) => ({ method: "GET", headers: {}, query: { userId: "foreign", ...query } }) as unknown as NextApiRequest;
const reply = () => {
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn(), end: vi.fn() };
  res.status.mockReturnValue(res); return res as typeof res & NextApiResponse;
};
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("PROVIDER_SYNC_PREMIUM_ENFORCEMENT_ENABLED", undefined);
  mocks.auth.mockResolvedValue({ id: "owner" });
  mocks.season.mockResolvedValue({ eligible: false, capabilities: [], reason: "no_active_grant" });
  mocks.draft.mockResolvedValue({ eligible: false, reason: "no_active_grant" });
  mocks.pickup.mockResolvedValue({ fixture: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("default-off sync rollout through real route guards", () => {
  it("returns free sync permission without inventing a billing entitlement", async () => {
    const sync = reply(); await status(req(), sync);
    expect(sync.json).toHaveBeenCalledWith({ data: { access: { eligible: true, expiresAt: null, nextVerificationAt: null, reason: "rollout_free" } } });
    expect(mocks.season).not.toHaveBeenCalled(); expect(mocks.draft).not.toHaveBeenCalled();
    const billing = reply(); await status(req({ entitlementOnly: "true" }), billing);
    expect(billing.json).toHaveBeenCalledWith({ data: { access: expect.objectContaining({ eligible: false, reason: "no_active_grant" }) } });
    expect(mocks.season).toHaveBeenCalledWith("owner");
  });
  it("keeps sync usable during a billing outage but reports the billing error truthfully", async () => {
    mocks.season.mockRejectedValue(new Error("private")); mocks.draft.mockRejectedValue(new Error("private"));
    const sync = reply(); await status(req(), sync); expect(sync.status).toHaveBeenCalledWith(200);
    const billing = reply(); await status(req({ entitlementOnly: "true" }), billing); expect(billing.status).toHaveBeenCalledWith(503);
  });
  it("passes only the authenticated account into Yahoo pickup with no purchase gate", async () => {
    const res = reply(); await pickup(req(), res);
    expect(res.json).toHaveBeenCalledWith({ data: { fixture: true } });
    expect(mocks.pickup).toHaveBeenCalledWith("owner");
    expect(mocks.season).not.toHaveBeenCalled();
  });
  it("requires sign-in even with enforcement off", async () => {
    mocks.auth.mockImplementation(async (_req, res) => { res.status(401).json({ error: "Sign in" }); return null; });
    for (const handler of [status, pickup, rsoAccess]) { const res = reply(); await handler(req(), res); expect(res.status).toHaveBeenCalledWith(401); }
    expect(mocks.pickup).not.toHaveBeenCalled(); expect(mocks.season).not.toHaveBeenCalled();
  });
  it("allows only the sync capability for a free RSO workspace", async () => {
    const res = reply(); await rsoAccess(req(), res);
    expect(res.json).toHaveBeenCalledWith({ data: expect.objectContaining({ eligible: true, reason: "rollout_free", capabilities: ["rso_sync"], grantingSources: [] }) });
  });
  it("preserves the separate Yahoo rollout and Fantrax readiness restrictions", async () => {
    vi.stubEnv("YAHOO_LIVE_DRAFT_ENABLED", "false");
    await expect(requireYahooLiveDraftServerAccess("owner")).rejects.toMatchObject({ code: "yahoo_live_draft_disabled" });
    vi.stubEnv("YAHOO_LIVE_DRAFT_ENABLED", "true"); vi.stubEnv("YAHOO_LIVE_DRAFT_ROLLOUT_STAGE", "staff"); vi.stubEnv("YAHOO_LIVE_DRAFT_STAFF_USER_IDS", "11111111-1111-4111-8111-111111111111");
    expect(await requireYahooLiveDraftServerAccess("11111111-1111-4111-8111-111111111111")).toMatchObject({ eligible: true, reason: "rollout_free" });
    await expect(requireYahooLiveDraftServerAccess("other")).rejects.toMatchObject({ code: "yahoo_live_draft_forbidden" });
    await expect(requireFantraxDraftAccess("owner", { enabled: false })).rejects.toMatchObject({ code: "FANTRAX_LIVE_DRAFT_DISABLED" });
    await expect(requireFantraxDraftAccess("owner", { enabled: true })).resolves.toBeUndefined();
    expect(mocks.season).not.toHaveBeenCalled(); expect(mocks.draft).not.toHaveBeenCalled();
  });
});
