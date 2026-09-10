import { Readable } from "stream";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

const fulfill = vi.hoisted(() => vi.fn());
const verify = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ stripe: null as Stripe | null }));

vi.mock("lib/integrations/stripe/config", () => ({
  isStripeConfigured: () => true,
  getStripeWebhookSecret: () => "whsec_test",
  getStripeClient: () => state.stripe,
}));
vi.mock("lib/integrations/stripe/fulfillment", () => ({
  fulfillStripeProviderEvent: fulfill,
  verifyDraftProCheckoutSession: verify,
}));

import handler from "../../../pages/api/v1/webhooks/stripe";

function response() {
  const state: any = { statusCode: 0, body: null };
  return Object.assign(state, { status(code: number) { state.statusCode = code; return state; }, json(body: unknown) { state.body = body; return state; }, setHeader: vi.fn() });
}
function request(payload: string, signature: string) {
  const req = Readable.from([Buffer.from(payload)]) as any;
  req.method = "POST";
  req.headers = { "stripe-signature": signature };
  return req;
}

describe("Stripe webhook route", () => {
  state.stripe = new Stripe("sk_test_mock");
  it("rejects an invalid raw-body signature before fulfillment", async () => {
    const res = response();
    await handler(request('{"id":"evt_bad"}', "t=1,v1=bad"), res);
    expect(res.statusCode).toBe(400);
    expect(fulfill).not.toHaveBeenCalled();
  });

  it("accepts a Stripe SDK-signed payload and reaches fulfillment", async () => {
    const payload = JSON.stringify({ id: "evt_valid", object: "event", type: "charge.refunded", created: 1, data: { object: { id: "ch_1" } } });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test" });
    fulfill.mockResolvedValueOnce({ processed: true });
    const res = response();
    await handler(request(payload, signature), res);
    expect(res.statusCode).toBe(200);
    expect(fulfill).toHaveBeenCalledTimes(1);
  });

  it("keeps processing failures generic after a valid signature", async () => {
    const payload = JSON.stringify({ id: "evt_error", object: "event", type: "charge.refunded", created: 1, data: { object: { id: "ch_1" } } });
    fulfill.mockRejectedValueOnce(new Error("provider credential detail"));
    const res = response();
    await handler(request(payload, Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test" })), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Webhook processing failed." });
  });
});
