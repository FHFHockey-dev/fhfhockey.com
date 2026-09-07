import { describe, expect, it, vi } from "vitest";

import { fulfillStripeEvent, verifyDraftProCheckoutSession, verifyStripeCheckoutSession } from "./fulfillment";

function rpcClient(result = { purchase_id: "purchase-1", processed: true }) {
  const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
  return { rpc } as any;
}
const stripe = { checkout: { sessions: { listLineItems: vi.fn().mockResolvedValue({ data: [{ quantity: 1, price: { id: "price_test", product: "prod_test", unit_amount: 599, currency: "usd" } }] }) } } } as any;

describe("Stripe fulfillment", () => {
  it("accepts exactly one configured price line item", async () => {
    process.env.STRIPE_DRAFT_PRO_PRICE_ID = "price_test";
    process.env.STRIPE_DRAFT_PRO_PRODUCT_ID = "prod_test";
    const stripe = { checkout: { sessions: { listLineItems: vi.fn().mockResolvedValue({ data: [{ quantity: 1, price: { id: "price_test", product: "prod_test", unit_amount: 599, currency: "usd" } }] }) } } } as any;
    const session = { id: "cs_test", mode: "payment", payment_status: "paid", amount_total: 599, currency: "usd", client_reference_id: "purchase-1", metadata: { draft_pro_user_id: "user-1", draft_pro_purchase_id: "purchase-1", draft_pro_season: "draft_pro_2026_27" } } as any;
    await expect(verifyDraftProCheckoutSession(stripe, session)).resolves.toBe(true);
    stripe.checkout.sessions.listLineItems.mockResolvedValue({ data: [{ quantity: 2, price: { id: "price_test", product: "prod_test", unit_amount: 599, currency: "usd" } }] });
    await expect(verifyDraftProCheckoutSession(stripe, session)).resolves.toBe(false);
    stripe.checkout.sessions.listLineItems.mockResolvedValue({ data: [{ quantity: 1, price: { id: "price_other", product: "prod_test", unit_amount: 599, currency: "usd" } }] });
    await expect(verifyDraftProCheckoutSession(stripe, session)).resolves.toBe(false);
    await expect(verifyDraftProCheckoutSession(stripe, { ...session, payment_status: "unpaid" })).resolves.toBe(false);
  });

  it("sends a completed signed event to the single atomic fulfillment RPC", async () => {
    const client = rpcClient();
    const result = await fulfillStripeEvent({
      id: "evt_completed",
      created: 1_725_000_000,
      type: "checkout.session.completed",
      data: { object: { object: "checkout.session", id: "cs_test_123", mode: "payment", payment_status: "paid", amount_total: 599, currency: "usd", client_reference_id: "purchase-1", payment_intent: "pi_123", metadata: { draft_pro_user_id: "user-1", draft_pro_purchase_id: "purchase-1", draft_pro_season: "draft_pro_2026_27" } } },
    } as any, client);

    expect(result).toEqual({ purchaseId: "purchase-1", processed: true });
    expect(client.rpc).toHaveBeenCalledWith("record_draft_pro_stripe_event", expect.objectContaining({
      p_event_id: "evt_completed", p_checkout_session_id: "cs_test_123", p_payment_intent_id: "pi_123", p_user_id: "user-1", p_payment_state: "paid",
    }));
  });

  it("does not process unrelated events", async () => {
    const client = rpcClient();
    await expect(fulfillStripeEvent({ id: "evt_ignored", type: "customer.created", data: { object: {} } } as any, client)).resolves.toEqual({ purchaseId: null, processed: false });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("uses a deterministic return event and only fulfills paid sessions", async () => {
    const client = rpcClient();
    await verifyStripeCheckoutSession(stripe, { object: "checkout.session", id: "cs_test_123", created: 1_725_000_000, mode: "payment", payment_status: "paid", amount_total: 599, currency: "usd", client_reference_id: "purchase-1", payment_intent: "pi_123", metadata: { draft_pro_user_id: "user-1", draft_pro_purchase_id: "purchase-1", draft_pro_season: "draft_pro_2026_27" } } as any, client);
    expect(client.rpc).toHaveBeenCalledWith("record_draft_pro_stripe_event", expect.objectContaining({ p_event_id: "return:cs_test_123" }));
    await expect(verifyStripeCheckoutSession({ payment_status: "unpaid" } as any, client)).resolves.toEqual({ purchaseId: null, processed: false });
  });

  it("rejects a paid session whose server-owned facts do not match", async () => {
    const client = rpcClient();
    await expect(verifyStripeCheckoutSession({ mode: "payment", payment_status: "paid", amount_total: 600, currency: "usd", metadata: { draft_pro_user_id: "user-1", draft_pro_purchase_id: "purchase-1", draft_pro_season: "draft_pro_2026_27" }, client_reference_id: "purchase-1" } as any, client)).resolves.toEqual({ purchaseId: null, processed: false });
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
