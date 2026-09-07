import type Stripe from "stripe";

import serviceRoleClient from "lib/supabase/server";
import { DRAFT_PRO_SEASON } from "lib/draft-pro/contracts";

import { DRAFT_PRO_STRIPE_PRICE } from "./config";

type CheckoutClient = Pick<typeof serviceRoleClient, "rpc">;

export async function createDraftProCheckout({
  stripe,
  userId,
  origin,
  client = serviceRoleClient,
}: {
  stripe: Stripe;
  userId: string;
  origin: string;
  client?: CheckoutClient;
}) {
  const { data: attempts, error: attemptError } = await client.rpc("begin_draft_pro_stripe_checkout_attempt", { p_user_id: userId });
  const attempt = attempts?.[0];
  if (attemptError || !attempt) throw attemptError ?? new Error("Could not record checkout attempt.");
  if (attempt.purchase_status === "active") return { alreadyPurchased: true as const, url: null, purchaseId: attempt.purchase_id };
  if (attempt.checkout_session_id) {
    const session = await stripe.checkout.sessions.retrieve(attempt.checkout_session_id);
    if (session.status === "open" && session.url) return { alreadyPurchased: false as const, url: session.url, purchaseId: attempt.purchase_id };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price_data: { currency: DRAFT_PRO_STRIPE_PRICE.currency, product_data: { name: DRAFT_PRO_STRIPE_PRICE.productName }, unit_amount: DRAFT_PRO_STRIPE_PRICE.unitAmount }, quantity: 1 }],
    client_reference_id: attempt.purchase_id,
    metadata: { draft_pro_user_id: userId, draft_pro_purchase_id: attempt.purchase_id, draft_pro_season: DRAFT_PRO_SEASON },
    payment_intent_data: { metadata: { draft_pro_user_id: userId, draft_pro_purchase_id: attempt.purchase_id, draft_pro_season: DRAFT_PRO_SEASON } },
    success_url: `${origin}/account?draft_pro_checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account?draft_pro_checkout=cancelled`,
  }, { idempotencyKey: attempt.stripe_idempotency_key });
  if (!session.url || !session.expires_at) throw new Error("Stripe did not return an expiring Checkout URL.");
  const { error: updateError } = await client.rpc("attach_draft_pro_stripe_checkout_session", { p_purchase_id: attempt.purchase_id, p_checkout_session_id: session.id, p_checkout_expires_at: new Date(session.expires_at * 1000).toISOString() });
  if (updateError) throw updateError;
  return { alreadyPurchased: false as const, url: session.url, purchaseId: attempt.purchase_id };
}
