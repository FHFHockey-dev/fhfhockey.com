import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { createInSeasonCheckout, fulfillInSeasonEvent } from "./billing";
import { IN_SEASON_SANDBOX_CATALOG as catalog, assertInSeasonSandboxConfiguration } from "./billingConfig";
import type { InSeasonAttempt, InSeasonBillingStore } from "./billingStore";

const now = new Date("2026-10-21T18:00:00Z");
const paidAt = now.getTime() / 1000;
const metadata = { in_season_attempt_id: "attempt-a", in_season_user_id: "user-a", in_season_plan: "season_pass", in_season: "2026_27" };

function fixture() {
  const attempt: InSeasonAttempt = { id: "attempt-a", user_id: "user-a", created_at: new Date(now.getTime() - 60_000).toISOString(), status: "pending", checkout_session_id: null };
  const price = { id: catalog.seasonPassPriceId, livemode: false, active: true, type: "one_time", recurring: null, unit_amount: 2499, currency: "usd", product: catalog.productId };
  const session = { id: "cs_test_one", livemode: false, mode: "payment", client_reference_id: attempt.id, metadata: { ...metadata }, status: "complete", payment_status: "paid", amount_subtotal: 2499, amount_total: 2499, currency: "usd", total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 }, payment_intent: "pi_one", expires_at: Math.floor(Date.parse(attempt.created_at) / 1000) + 86400, url: "https://checkout.stripe.com/c/pay/cs_test_one" };
  const intent = { id: "pi_one", livemode: false, status: "succeeded", amount: 2499, amount_received: 2499, currency: "usd", metadata: { ...metadata }, latest_charge: { id: "ch_one", payment_intent: "pi_one", livemode: false, amount: 2499, currency: "usd", paid: true, captured: true, refunded: false, amount_refunded: 0, disputed: false } };
  const lines = { has_more: false, data: [{ quantity: 1, amount_total: 2499, price }] };
  const refunds = { data: [] as Stripe.Refund[], has_more: false };
  const disputes = { data: [] as Stripe.Dispute[], has_more: false };
  const stripe = { refunds: { list: vi.fn().mockResolvedValue(refunds) }, disputes: { list: vi.fn().mockResolvedValue(disputes) }, accounts: { retrieve: vi.fn().mockResolvedValue({ id: catalog.accountId }) }, prices: { retrieve: vi.fn().mockResolvedValue(price) }, checkout: { sessions: { create: vi.fn().mockResolvedValue(session), retrieve: vi.fn().mockResolvedValue(session), listLineItems: vi.fn().mockResolvedValue(lines) } }, paymentIntents: { retrieve: vi.fn().mockResolvedValue(intent) } };
  const store = { begin: vi.fn().mockResolvedValue(attempt), get: vi.fn().mockResolvedValue(attempt), attach: vi.fn(), expire: vi.fn(), claim: vi.fn().mockResolvedValue({ token: "lease-fixture" }), reconcile: vi.fn() };
  const event = { id: "evt_one", livemode: false, type: "checkout.session.completed", created: paidAt, data: { object: session } };
  const checkout = (plan = "season_pass", instant = now) => createInSeasonCheckout({ stripe: stripe as unknown as Stripe, store: store as InSeasonBillingStore, userId: "user-a", origin: "http://localhost:3000", plan, now: instant });
  const fulfill = () => fulfillInSeasonEvent({ stripe: stripe as unknown as Stripe, store: store as InSeasonBillingStore, event: event as unknown as Stripe.Event, now });
  return { attempt, price, session, intent, lines, stripe, store, event, checkout, fulfill, refunds, disputes };
}

describe("sandbox-only configuration", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("IN_SEASON_BILLING_SANDBOX_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("IN_SEASON_SANDBOX_ORIGIN", "http://localhost:3000");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only");
    vi.stubEnv("IN_SEASON_STRIPE_SECRET_KEY", "sk_test_fixture");
    vi.stubEnv("IN_SEASON_STRIPE_WEBHOOK_SECRET", "whsec_fixture");
  });
  it("requires explicit isolated test setup", () => expect(assertInSeasonSandboxConfiguration()).toEqual({ origin: "http://localhost:3000" }));
  it("accepts a restricted sandbox key under the same isolation guards", () => {
    vi.stubEnv("IN_SEASON_STRIPE_SECRET_KEY", "rk_test_fixture");
    expect(assertInSeasonSandboxConfiguration()).toEqual({ origin: "http://localhost:3000" });
  });
  it.each([
    ["NODE_ENV", "production"], ["IN_SEASON_BILLING_SANDBOX_ENABLED", "false"],
    ["NEXT_PUBLIC_SUPABASE_URL", "https://production.supabase.co"], ["NEXT_PUBLIC_SUPABASE_URL", "http://localhost.evil.example"],
    ["IN_SEASON_SANDBOX_ORIGIN", "https://fhfhockey.com"], ["SUPABASE_SERVICE_ROLE_KEY", ""],
    ["IN_SEASON_STRIPE_SECRET_KEY", "sk_live_fixture"], ["IN_SEASON_STRIPE_SECRET_KEY", "rk_live_fixture"],
    ["IN_SEASON_STRIPE_SECRET_KEY", "pk_test_fixture"], ["IN_SEASON_STRIPE_WEBHOOK_SECRET", ""],
  ])("blocks %s=%s without using another credential source", (key, value) => { vi.stubEnv(key, value); expect(assertInSeasonSandboxConfiguration).toThrow(); });
});

describe("season-pass checkout", () => {
  it("uses the separate one-time 2499 catalog and fixed season deadline", async () => {
    const f = fixture(); await f.checkout();
    expect(f.stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ mode: "payment", line_items: [{ price: catalog.seasonPassPriceId, quantity: 1 }], client_reference_id: "attempt-a", metadata, allow_promotion_codes: false, success_url: "http://localhost:3000/account?section=in-season&in_season_checkout=confirming" }), { idempotencyKey: "in-season-sandbox:attempt-a" });
    expect(f.store.attach).toHaveBeenCalledWith("attempt-a", "cs_test_one");
    expect(f.store.reconcile).not.toHaveBeenCalled();
  });
  it.each(["monthly", "annual", "draft_pro"])("blocks unsupported or unsettled %s before Stripe/storage", async (plan) => { const f = fixture(); await expect(f.checkout(plan)).rejects.toThrow(); expect(f.stripe.accounts.retrieve).not.toHaveBeenCalled(); expect(f.store.begin).not.toHaveBeenCalled(); });
  it.each(["2027-07-01T04:00:00Z", "2027-07-01T03:30:00Z", "invalid"])("closes checkout at %s", async (date) => { const f = fixture(); await expect(f.checkout("season_pass", new Date(date))).rejects.toThrow(); expect(f.store.begin).not.toHaveBeenCalled(); });
  it.each(["unit_amount", "currency", "product", "type", "livemode", "active"])("rejects mismatched price %s", async (field) => { const f = fixture(); Object.assign(f.price, { [field]: field === "livemode" ? true : field === "active" ? false : "wrong" }); await expect(f.checkout()).rejects.toThrow(); expect(f.store.begin).not.toHaveBeenCalled(); });
  it("blocks a different Stripe account", async () => { const f = fixture(); f.stripe.accounts.retrieve.mockResolvedValue({ id: "acct_wrong" }); await expect(f.checkout()).rejects.toThrow(); expect(f.store.begin).not.toHaveBeenCalled(); });
  it("rejects a cross-account durable attempt", async () => { const f = fixture(); f.attempt.user_id = "user-b"; await expect(f.checkout()).rejects.toThrow(); expect(f.stripe.checkout.sessions.create).not.toHaveBeenCalled(); });
  it("reuses an open owner-bound session without creating a second charge", async () => { const f = fixture(); f.attempt.checkout_session_id = f.session.id; f.session.status = "open"; await expect(f.checkout()).resolves.toEqual({ state: "checkout", url: f.session.url }); expect(f.stripe.checkout.sessions.create).not.toHaveBeenCalled(); });
  it("waits for verified fulfillment after browser completion", async () => { const f = fixture(); f.attempt.checkout_session_id = f.session.id; await expect(f.checkout()).resolves.toEqual({ state: "confirming", url: null }); expect(f.store.reconcile).not.toHaveBeenCalled(); });
  it("marks only a verified expired checkout before allowing a later attempt", async () => { const f = fixture(); f.attempt.checkout_session_id = f.session.id; f.session.status = "expired"; await expect(f.checkout()).resolves.toEqual({ state: "expired", url: null }); expect(f.store.expire).toHaveBeenCalledWith(f.attempt.id, f.session.id); expect(f.stripe.checkout.sessions.create).not.toHaveBeenCalled(); });
  it("refuses an old unattached attempt after the idempotency safety window", async () => { const f = fixture(); f.attempt.created_at = "2026-10-19T00:00:00Z"; await expect(f.checkout()).rejects.toThrow(/review/); expect(f.stripe.checkout.sessions.create).not.toHaveBeenCalled(); });
  it.each([100, 5_001])("bounds database clock skew for a new attempt at %s milliseconds", async (skew) => {
    const f = fixture(); f.attempt.created_at = new Date(now.getTime() + skew).toISOString();
    f.session.expires_at = Math.floor(Date.parse(f.attempt.created_at) / 1000) + 86400;
    if (skew <= 5_000) await expect(f.checkout()).resolves.toMatchObject({ state: "checkout" });
    else { await expect(f.checkout()).rejects.toThrow(/review/); expect(f.stripe.checkout.sessions.create).not.toHaveBeenCalled(); }
  });
  it("uses identical arguments after an uncertain attachment outcome", async () => { const f = fixture(); f.store.attach.mockRejectedValueOnce(new Error("connection lost")); await expect(f.checkout()).rejects.toThrow(); await f.checkout(); expect(f.stripe.checkout.sessions.create.mock.calls[1]).toEqual(f.stripe.checkout.sessions.create.mock.calls[0]); });
});

describe("verified payment fulfillment", () => {
  it("records a paid, owner-bound, intact season pass through the atomic store", async () => { const f = fixture(); await expect(f.fulfill()).resolves.toEqual({ processed: true }); expect(f.store.reconcile).toHaveBeenCalledWith({ attemptId: "attempt-a", userId: "user-a", eventId: "evt_one", sessionId: "cs_test_one", paymentIntentId: "pi_one", paidAt: now.toISOString(), token: "lease-fixture", active: true, snapshot: expect.any(Object) }); });
  it("accepts provider second precision when purchase creation has milliseconds", async () => { const f = fixture(); f.attempt.created_at = "2026-10-21T18:00:00.400Z"; await expect(f.fulfill()).resolves.toEqual({ processed: true }); });
  it.each([
    ["live event", (f: ReturnType<typeof fixture>) => { f.event.livemode = true; }],
    ["live session", (f: ReturnType<typeof fixture>) => { f.session.livemode = true; }],
    ["unpaid", (f: ReturnType<typeof fixture>) => { f.session.payment_status = "unpaid"; }],
    ["wrong account", (f: ReturnType<typeof fixture>) => { f.session.metadata.in_season_user_id = "user-b"; }],
    ["foreign attempt", (f: ReturnType<typeof fixture>) => { f.session.client_reference_id = "attempt-b"; }],
    ["foreign stored session", (f: ReturnType<typeof fixture>) => { f.attempt.checkout_session_id = "cs_test_other"; }],
    ["wrong plan", (f: ReturnType<typeof fixture>) => { f.session.metadata.in_season_plan = "monthly"; }],
    ["wrong amount", (f: ReturnType<typeof fixture>) => { f.session.amount_total = 599; }],
    ["discount", (f: ReturnType<typeof fixture>) => { f.session.total_details.amount_discount = 100; }],
    ["another price", (f: ReturnType<typeof fixture>) => { f.price.id = "price_other" as typeof f.price.id; }],
    ["extra line", (f: ReturnType<typeof fixture>) => { f.lines.has_more = true; }],
    ["unsettled payment", (f: ReturnType<typeof fixture>) => { f.intent.status = "processing"; }],
    ["refunded payment", (f: ReturnType<typeof fixture>) => { f.intent.latest_charge.amount_refunded = 1; }],
    ["disputed payment", (f: ReturnType<typeof fixture>) => { f.intent.latest_charge.disputed = true; }],
    ["future event", (f: ReturnType<typeof fixture>) => { f.event.created = paidAt + 1; }],
    ["payment predates checkout", (f: ReturnType<typeof fixture>) => { f.event.created = paidAt - 120; }],
  ])("fails closed for %s", async (_name, mutate) => { const f = fixture(); (mutate as (f: ReturnType<typeof fixture>) => void)(f); await expect(f.fulfill()).rejects.toThrow(); expect(f.store.reconcile).not.toHaveBeenCalled(); });
  it("does not handle legacy Draft Pro events", async () => { const f = fixture(); f.session.metadata = {} as typeof metadata; await expect(f.fulfill()).resolves.toEqual({ processed: false }); expect(f.store.get).not.toHaveBeenCalled(); });
  it("does not acknowledge a failed store write as success", async () => { const f = fixture(); f.store.reconcile.mockRejectedValue(new Error("database unavailable")); await expect(f.fulfill()).rejects.toThrow(); });
});

describe("season-pass adjustment reconciliation", () => {
  const completed = () => {
    const f = fixture();
    Object.assign(f.attempt, { status: "paid", checkout_session_id: "cs_test_one", payment_intent_id: "pi_one", paid_at: now.toISOString() });
    f.event.type = "refund.updated";
    f.event.data.object = { payment_intent: "pi_one" } as typeof f.session;
    return f;
  };
  const refund = (status: string, amount = 2499) => ({ id: "re_one", charge: "ch_one", payment_intent: "pi_one", currency: "usd", amount, status }) as Stripe.Refund;
  it.each([["pending", true], ["failed", true], ["canceled", true], ["succeeded", false]])("reconciles a %s full refund without issuing money", async (status, active) => {
    const f = completed(); f.refunds.data = [refund(status)]; await f.fulfill();
    expect(f.store.reconcile).toHaveBeenCalledWith(expect.objectContaining({ active, paidAt: now.toISOString(), paymentIntentId: "pi_one", token: "lease-fixture" }));
  });
  it("retains partial-refund access and refuses incomplete inventory", async () => {
    const f = completed(); f.refunds.data = [refund("succeeded", 100)]; await f.fulfill();
    expect(f.store.reconcile).toHaveBeenCalledWith(expect.objectContaining({ active: true }));
    f.store.reconcile.mockClear(); f.refunds.has_more = true;
    await expect(f.fulfill()).rejects.toThrow(); expect(f.store.reconcile).not.toHaveBeenCalled();
  });
  it.each([["needs_response", false], ["lost", false], ["won", true]])("uses %s dispute outcome without changing the original coverage", async (status, active) => {
    const f = completed(); f.event.type = "charge.dispute.updated";
    f.disputes.data = [{ id: "dp_one", charge: "ch_one", payment_intent: "pi_one", currency: "usd", livemode: false, status } as Stripe.Dispute];
    await f.fulfill(); expect(f.store.reconcile).toHaveBeenCalledWith(expect.objectContaining({ active, paidAt: now.toISOString() }));
  });
  it("deduplicates before fetching a new snapshot and propagates a held lease", async () => {
    const f = fixture(); f.store.claim.mockResolvedValueOnce({ duplicate: true } as never);
    await expect(f.fulfill()).resolves.toEqual({ processed: true, duplicate: true });
    expect(f.stripe.checkout.sessions.retrieve).not.toHaveBeenCalled(); expect(f.store.reconcile).not.toHaveBeenCalled();
    f.store.claim.mockRejectedValueOnce(new Error("Reconciliation busy")); await expect(f.fulfill()).rejects.toThrow(/busy/);
  });
  it("requires original completion before early adjustment and rejects foreign adjustment payments", async () => {
    const f = completed(); f.attempt.status = "pending"; await expect(f.fulfill()).rejects.toThrow(/completion/);
    f.attempt.status = "paid"; f.attempt.payment_intent_id = "pi_other"; await expect(f.fulfill()).rejects.toThrow(/ownership/);
    expect(f.store.reconcile).not.toHaveBeenCalled();
  });
  it("records a late payment without granting expired access", async () => {
    const f = fixture(); const late = new Date("2027-07-01T05:00Z"); f.event.created = late.getTime() / 1000;
    await fulfillInSeasonEvent({ stripe: f.stripe as unknown as Stripe, store: f.store as InSeasonBillingStore, event: f.event as unknown as Stripe.Event, now: late });
    expect(f.store.reconcile).toHaveBeenCalledWith(expect.objectContaining({ active: false, paidAt: late.toISOString() }));
  });
});
