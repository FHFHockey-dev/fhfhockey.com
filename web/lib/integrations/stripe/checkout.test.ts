import { beforeEach, describe, expect, it, vi } from "vitest";

const verify = vi.hoisted(() => vi.fn().mockResolvedValue({ purchaseId: "p1", processed: true }));
vi.mock("./fulfillment", () => ({ verifyStripeCheckoutSession: verify }));
import { createDraftProCheckout } from "./checkout";

const attempt = (overrides: any = {}) => ({ purchase_id: "p1", stripe_idempotency_key: "key1", checkout_session_id: "cs1", purchase_status: "pending", ...overrides });
function client(rows: any[]) {
  const rpc = vi.fn().mockImplementation(async () => ({ data: [rows.shift()], error: null }));
  const terminal: any = { error: null };
  const chain: any = { update: vi.fn(() => chain), eq: vi.fn(() => chain), then: (resolve: any) => resolve(terminal) };
  return { rpc, from: vi.fn(() => chain), chain } as any;
}
function stripe(session: any) {
  return { checkout: { sessions: { retrieve: vi.fn().mockResolvedValue(session), create: vi.fn() } }, prices: { retrieve: vi.fn() } } as any;
}
beforeEach(() => { verify.mockClear(); process.env.STRIPE_DRAFT_PRO_PRICE_ID = "price1"; process.env.STRIPE_DRAFT_PRO_PRODUCT_ID = "prod1"; delete process.env.DRAFT_PRO_STRIPE_AUTOMATIC_TAX_ENABLED; });

describe("createDraftProCheckout lifecycle", () => {
  it("reuses an open session without creating another", async () => {
    const s = stripe({ id: "cs1", status: "open", url: "https://checkout.test" });
    await expect(createDraftProCheckout({ stripe: s, userId: "u1", origin: "https://app.test", client: client([attempt()]) })).resolves.toMatchObject({ url: "https://checkout.test" });
    expect(s.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it.each([["unpaid", "waiting"], ["paid", "confirming"]])("does not create again for completed %s", async (paymentStatus, state) => {
    const completed = { id: "cs1", status: "complete", payment_status: paymentStatus };
    const s = stripe(completed);
    await expect(createDraftProCheckout({ stripe: s, userId: "u1", origin: "https://app.test", client: client([attempt()]) })).resolves.toMatchObject({ state });
    expect(s.checkout.sessions.create).not.toHaveBeenCalled();
    expect(verify).toHaveBeenCalledTimes(paymentStatus === "paid" ? 1 : 0);
  });
  it("expires the matching pending row and begins a fresh attempt", async () => {
    const c = client([attempt(), attempt({ purchase_id: "p2", checkout_session_id: null })]);
    const s = stripe({ id: "cs1", status: "expired" });
    s.prices.retrieve.mockResolvedValue({ active: true, type: "one_time", unit_amount: 599, currency: "usd", product: "prod1" });
    s.checkout.sessions.create.mockResolvedValue({ id: "cs2", url: "https://new.test", expires_at: 2 });
    await expect(createDraftProCheckout({ stripe: s, userId: "u1", origin: "https://app.test", client: c })).resolves.toMatchObject({ purchaseId: "p2" });
    expect(c.chain.update).toHaveBeenCalledWith({ checkout_session_status: "expired", status: "expired" });
    expect(s.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ success_url: "https://app.test/account?section=draft-pro&draft_pro_checkout={CHECKOUT_SESSION_ID}", cancel_url: "https://app.test/account?section=draft-pro&draft_pro_checkout=cancelled" }), expect.anything());
  });
  it("does not overwrite a concurrently activated purchase", async () => {
    const c = client([attempt(), attempt({ purchase_status: "active" })]);
    const s = stripe({ id: "cs1", status: "expired" });
    await expect(createDraftProCheckout({ stripe: s, userId: "u1", origin: "https://app.test", client: c })).resolves.toMatchObject({ alreadyPurchased: true });
    expect(s.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("collects a billing address and enables automatic tax only with the server opt-in", async () => {
    process.env.DRAFT_PRO_STRIPE_AUTOMATIC_TAX_ENABLED = "true";
    const s = stripe({});
    s.prices.retrieve.mockResolvedValue({ active: true, type: "one_time", unit_amount: 599, currency: "usd", product: "prod1" });
    s.checkout.sessions.create.mockResolvedValue({ id: "cs2", url: "https://new.test", expires_at: 2 });
    await createDraftProCheckout({ stripe: s, userId: "u1", origin: "https://app.test", client: client([attempt({ checkout_session_id: null })]) });
    expect(s.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ automatic_tax: { enabled: true }, billing_address_collection: "required" }), expect.anything());
  });
  it("leaves automatic tax and address collection off by default", async () => {
    const s = stripe({});
    s.prices.retrieve.mockResolvedValue({ active: true, type: "one_time", unit_amount: 599, currency: "usd", product: "prod1" });
    s.checkout.sessions.create.mockResolvedValue({ id: "cs2", url: "https://new.test", expires_at: 2 });
    await createDraftProCheckout({ stripe: s, userId: "u1", origin: "https://app.test", client: client([attempt({ checkout_session_id: null })]) });
    expect(s.checkout.sessions.create.mock.calls[0][0]).not.toHaveProperty("automatic_tax");
    expect(s.checkout.sessions.create.mock.calls[0][0]).not.toHaveProperty("billing_address_collection");
  });
  it("rejects an inclusive Price when automatic tax is enabled", async () => {
    process.env.DRAFT_PRO_STRIPE_AUTOMATIC_TAX_ENABLED = "true";
    const s = stripe({});
    s.prices.retrieve.mockResolvedValue({ active: true, type: "one_time", unit_amount: 599, currency: "usd", product: "prod1", tax_behavior: "inclusive" });
    await expect(createDraftProCheckout({ stripe: s, userId: "u1", origin: "https://app.test", client: client([attempt({ checkout_session_id: null })]) })).rejects.toThrow("Draft Pro Stripe Price configuration is invalid.");
    expect(s.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
