import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), create: vi.fn(), createMonthly: vi.fn(), availability: vi.fn(), management: vi.fn(), fulfill: vi.fn(), monthly: vi.fn(), cancel: vi.fn(), load: vi.fn(), config: vi.fn(), stripe: vi.fn(), store: vi.fn(), construct: vi.fn() }));
vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: mocks.auth }));
vi.mock("lib/integrations/providerSyncAccessServer", () => ({ loadProviderSyncAccess: mocks.access }));
vi.mock("./billing", () => ({ createInSeasonCheckout: mocks.create, fulfillInSeasonEvent: mocks.fulfill }));
vi.mock("./billingConfig", () => ({ assertInSeasonSandboxConfiguration: mocks.config, getInSeasonSandboxStripe: mocks.stripe, MONTHLY_CHECKOUT_BLOCKER: "Monthly policy pending." }));
vi.mock("./billingStore", () => ({ inSeasonBillingStore: mocks.store }));
vi.mock("./monthlyStore", () => ({ monthlyBillingStore: mocks.store }));
vi.mock("./monthlyBilling", () => ({ createMonthlyBilling: mocks.createMonthly }));
vi.mock("./billingEntryConfig", () => ({ monthlySignupAvailability: mocks.availability, monthlyManagementEnabled: mocks.management }));
vi.mock("./monthlyWebhook", () => ({ fulfillMonthlyEvent: mocks.monthly, cancelMonthlyBilling: mocks.cancel }));
import checkout from "pages/api/v1/account/in-season/checkout";
import webhook from "pages/api/v1/webhooks/in-season-stripe";
import cancel from "pages/api/v1/account/in-season/cancel";

function response() {
  const res = { status: vi.fn(), json: vi.fn(), end: vi.fn(), setHeader: vi.fn() };
  res.status.mockReturnValue(res); res.json.mockReturnValue(res);
  return res as unknown as NextApiResponse & typeof res;
}
function request(body: unknown = { plan: "season_pass" }, method = "POST") {
  return { method, body, headers: { authorization: "Bearer fixture" } } as NextApiRequest;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({ origin: "http://localhost:3000" });
  mocks.auth.mockResolvedValue({ id: "verified-user" });
  mocks.access.mockResolvedValue({ eligible: false, reason: "no_active_grant" });
  mocks.stripe.mockReturnValue({ webhooks: { constructEvent: mocks.construct } });
  mocks.create.mockResolvedValue({ state: "checkout", url: "https://checkout.stripe.com/test" });
  mocks.fulfill.mockResolvedValue({ processed: true });
  mocks.monthly.mockResolvedValue({ processed: false });
  mocks.store.mockReturnValue({ load: mocks.load });
  mocks.load.mockResolvedValue({ binding: { userId: "verified-user" } });
  mocks.availability.mockReturnValue({ available: false, reason: "disabled", minimum: null, initialAmountCents: null });
  mocks.management.mockReturnValue(false);
  mocks.createMonthly.mockResolvedValue({ state: "checkout", url: "https://invoice.stripe.com/test" });
});

describe("checkout route", () => {
  it("reports disabled availability without external auth or billing calls", async () => { const res = response(); mocks.config.mockImplementation(() => { throw new Error(); }); await checkout(request(undefined, "GET"), res); expect(res.json).toHaveBeenCalledWith({ data: { seasonPassAvailable: false, monthlyAvailable: false, monthlyReason: "disabled", initialMonthlyAmountCents: null, managementAvailable: false } }); expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.availability).not.toHaveBeenCalled(); });
  it("rejects anonymous purchases", async () => { const req = request(); req.headers = {}; const res = response(); await checkout(req, res); expect(res.status).toHaveBeenCalledWith(401); expect(mocks.create).not.toHaveBeenCalled(); });
  it("stops before external Auth if isolation or configuration fails", async () => { const res = response(); mocks.config.mockImplementation(() => { throw new Error(); }); await checkout(request(), res); expect(res.status).toHaveBeenCalledWith(503); expect(mocks.auth).not.toHaveBeenCalled(); });
  it("honors an invalid session denial", async () => { const res = response(); mocks.auth.mockImplementation(async (_req, reply) => { reply.status(401).json({ error: "Sign in" }); return null; }); await checkout(request(), res); expect(res.status).toHaveBeenCalledWith(401); expect(mocks.access).not.toHaveBeenCalled(); });
  it.each([{ plan: "season_pass", userId: "victim" }, { plan: "annual" }, { plan: "season_pass", priceId: "price_599" }, null])("rejects forged or invalid body %j", async (body) => { const res = response(); await checkout(request(body), res); expect(res.status).toHaveBeenCalledWith(400); expect(mocks.create).not.toHaveBeenCalled(); });
  it("blocks monthly without creating an uncapped subscription", async () => { const res = response(); await checkout(request({ plan: "monthly" }), res); expect(res.status).toHaveBeenCalledWith(409); expect(mocks.stripe).not.toHaveBeenCalled(); });
  it.each(["paid monthly", "season pass", "supporter", "retained Draft Pro", "applicable grace"])("does not sell a duplicate to an eligible %s account", async () => { const res = response(); mocks.access.mockResolvedValue({ eligible: true, reason: "eligible" }); await checkout(request(), res); expect(res.status).toHaveBeenCalledWith(409); expect(mocks.create).not.toHaveBeenCalled(); });
  it.each(["no_active_grant", "expired"])("uses the authenticated principal for %s accounts", async (reason) => { const res = response(); mocks.access.mockResolvedValue({ eligible: false, reason }); await checkout(request(), res); expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "verified-user", plan: "season_pass" })); expect(res.status).toHaveBeenCalledWith(200); });
  it("treats unknown entitlement state as a transient failure", async () => { const res = response(); mocks.access.mockResolvedValue({ eligible: false, reason: "verification_unavailable" }); await checkout(request(), res); expect(res.status).toHaveBeenCalledWith(503); expect(mocks.create).not.toHaveBeenCalled(); });
  it("fails closed if entitlement loading throws", async () => { const res = response(); mocks.access.mockRejectedValue(new Error("offline")); await checkout(request(), res); expect(res.status).toHaveBeenCalledWith(503); expect(mocks.create).not.toHaveBeenCalled(); });
  it("does not treat malformed access as a free account", async () => { const res = response(); mocks.access.mockResolvedValue({ reason: "no_active_grant" }); await checkout(request(), res); expect(res.status).toHaveBeenCalledWith(503); expect(mocks.create).not.toHaveBeenCalled(); });
});

describe("guarded monthly signup route", () => {
  const minimum = { accountId: "sandbox", minimumChargeCents: 50, chargeCurrency: "usd", settlementCurrency: "usd", verificationReference: "fixture" };
  beforeEach(() => mocks.availability.mockReturnValue({ available: true, reason: "available", minimum, initialAmountCents: 177 }));
  it("uses only the authenticated owner and existing monthly adapter", async () => {
    const res = response(); await checkout(request({ plan: "monthly" }), res);
    expect(mocks.createMonthly).toHaveBeenCalledWith({ stripe: expect.anything(), store: expect.anything(), userId: "verified-user", minimum });
    expect(res.json).toHaveBeenCalledWith({ data: { state: "checkout", url: "https://invoice.stripe.com/test" } }); expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["minimum_not_verified", "below_verified_minimum", "season_ended", "disabled"])("rejects %s before Stripe or storage", async reason => {
    mocks.availability.mockReturnValue({ available: false, reason, minimum: null }); const res = response();
    await checkout(request({ plan: "monthly" }), res); expect(res.status).toHaveBeenCalledWith(409); expect(mocks.stripe).not.toHaveBeenCalled(); expect(mocks.store).not.toHaveBeenCalled();
    if (reason === "below_verified_minimum") expect(res.json.mock.calls[0][0].error).toMatch(/No amount will be rounded up or carried forward/);
  });
  it.each(["paid monthly", "season pass", "supporter", "retained Draft Pro", "applicable grace"])("blocks duplicate monthly purchase for %s", async () => {
    mocks.access.mockResolvedValue({ eligible: true, reason: "eligible" }); const res = response(); await checkout(request({ plan: "monthly" }), res);
    expect(res.status).toHaveBeenCalledWith(409); expect(mocks.createMonthly).not.toHaveBeenCalled();
  });
  it.each([{ eligible: false, reason: "verification_unavailable" }, null, { reason: "unknown" }])("fails closed for unknown access %j", async access => {
    mocks.access.mockResolvedValue(access); const res = response(); await checkout(request({ plan: "monthly" }), res);
    expect(res.status).toHaveBeenCalledWith(503); expect(mocks.createMonthly).not.toHaveBeenCalled();
  });
  it.each(["expired", "cancelled", "no_active_grant"])("passes %s to verified monthly creation without granting access", async reason => {
    mocks.access.mockResolvedValue({ eligible: false, reason }); mocks.createMonthly.mockResolvedValue({ state: "confirming", url: null });
    const res = response(); await checkout(request({ plan: "monthly" }), res); expect(res.json).toHaveBeenCalledWith({ data: { state: "confirming", url: null } });
  });
  it("rejects owner, price and minimum overrides", async () => {
    const res = response(); await checkout(request({ plan: "monthly", userId: "other", minimumChargeCents: 1 }), res);
    expect(res.status).toHaveBeenCalledWith(400); expect(mocks.createMonthly).not.toHaveBeenCalled();
  });
  it("returns a transient error on an uncertain adapter result without leaking details", async () => {
    mocks.createMonthly.mockRejectedValue(new Error("private provider detail")); const res = response(); await checkout(request({ plan: "monthly" }), res);
    expect(res.status).toHaveBeenCalledWith(503); expect(JSON.stringify(res.json.mock.calls)).not.toContain("private provider");
  });
});

describe("separate sandbox webhook", () => {
  async function invoke(signature: unknown = "signature", bytes = "raw signed bytes") {
    const req = Object.assign(Readable.from([Buffer.from(bytes)]), { method: "POST", headers: { "stripe-signature": signature } });
    const res = response(); await webhook(req as unknown as NextApiRequest, res); return res;
  }
  it("verifies untouched raw bytes before fulfillment", async () => { const event = { id: "evt_test" }; mocks.construct.mockReturnValue(event); const res = await invoke(); expect(mocks.construct.mock.calls[0][0]).toEqual(Buffer.from("raw signed bytes")); expect(mocks.fulfill).toHaveBeenCalledWith(expect.objectContaining({ event })); expect(res.status).toHaveBeenCalledWith(200); });
  it.each([undefined, ["signature", "other"]])("rejects a missing or repeated signature", async (signature) => { const req = Object.assign(Readable.from([]), { method: "POST", headers: { "stripe-signature": signature } }); const res = response(); await webhook(req as unknown as NextApiRequest, res); expect(res.status).toHaveBeenCalledWith(400); expect(mocks.fulfill).not.toHaveBeenCalled(); });
  it("rejects a forged signature", async () => { mocks.construct.mockImplementation(() => { throw new Error("bad signature"); }); const res = await invoke(); expect(res.status).toHaveBeenCalledWith(400); expect(mocks.fulfill).not.toHaveBeenCalled(); });
  it("rejects oversized input before verification or storage", async () => { const res = await invoke("sig", "x".repeat(1024 * 1024 + 1)); expect(res.status).toHaveBeenCalledWith(400); expect(mocks.construct).not.toHaveBeenCalled(); expect(mocks.fulfill).not.toHaveBeenCalled(); });
  it("returns retryable failure for uncertain persistence", async () => { mocks.fulfill.mockRejectedValue(new Error("unknown database outcome")); const res = await invoke(); expect(res.status).toHaveBeenCalledWith(503); });
  it("does no processing when sandbox configuration is absent", async () => { mocks.stripe.mockImplementation(() => { throw new Error("disabled"); }); const res = await invoke(); expect(res.status).toHaveBeenCalledWith(503); expect(mocks.fulfill).not.toHaveBeenCalled(); });
  it("dispatches signed monthly events without season-pass processing", async () => { mocks.monthly.mockResolvedValue({ processed: true }); const res = await invoke(); expect(res.status).toHaveBeenCalledWith(200); expect(mocks.fulfill).not.toHaveBeenCalled(); });
  it("does not acknowledge a failed monthly commit as success", async () => { mocks.monthly.mockRejectedValue(new Error("conflict")); const res = await invoke(); expect(res.status).toHaveBeenCalledWith(503); expect(mocks.fulfill).not.toHaveBeenCalled(); });
});

describe("monthly cancellation route", () => {
  const body = { subscriptionId: "sub_test", requestId: "00000000-0000-4000-8000-000000000000" };
  it("uses the authenticated owner and requires no premium entitlement to cancel", async () => { const res = response(); await cancel(request(body), res); expect(res.status).toHaveBeenCalledWith(200); expect(mocks.cancel).toHaveBeenCalledWith(expect.anything(), "verified-user", body.subscriptionId, body.requestId); expect(mocks.access).not.toHaveBeenCalled(); expect(mocks.stripe).not.toHaveBeenCalled(); });
  it.each([null, { binding: { userId: "other" } }])("rejects missing and cross-account subscriptions identically", async (state) => { mocks.load.mockResolvedValue(state); const res = response(); await cancel(request(body), res); expect(res.status).toHaveBeenCalledWith(404); expect(mocks.cancel).not.toHaveBeenCalled(); });
  it("rejects forged owner fields and anonymous requests", async () => { const res = response(); await cancel(request({ ...body, userId: "victim" }), res); expect(res.status).toHaveBeenCalledWith(400); const req = request(body); req.headers = {}; await cancel(req, res); expect(res.status).toHaveBeenCalledWith(401); expect(mocks.cancel).not.toHaveBeenCalled(); });
  it("reports cancellation as pending when persistence fails", async () => { mocks.cancel.mockRejectedValue(new Error("lease busy")); const res = response(); await cancel(request(body), res); expect(res.status).toHaveBeenCalledWith(503); });
});
