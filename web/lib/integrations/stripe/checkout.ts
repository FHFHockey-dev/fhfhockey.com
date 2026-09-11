import type Stripe from "stripe";

import serviceRoleClient from "lib/supabase/server";
import { DRAFT_PRO_SEASON } from "lib/draft-pro/contracts";

import { DRAFT_PRO_STRIPE_PRICE, getDraftProStripeCatalog, isDraftProStripeAutomaticTaxEnabled, isDraftProStripeManagedPaymentsEnabled } from "./config";
import { verifyStripeCheckoutSession } from "./fulfillment";

type CheckoutClient = Pick<typeof serviceRoleClient, "rpc" | "from">;

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
  const managedPaymentsEnabled = isDraftProStripeManagedPaymentsEnabled();
  let { data: attempts, error: attemptError } = await client.rpc("begin_draft_pro_stripe_checkout_attempt", { p_user_id: userId });
  let attempt = attempts?.[0];
  if (attemptError || !attempt) throw attemptError ?? new Error("Could not record checkout attempt.");
  if (attempt.purchase_status === "active") return { alreadyPurchased: true as const, url: null, purchaseId: attempt.purchase_id };
  if (attempt.checkout_session_id) {
    let session = await stripe.checkout.sessions.retrieve(attempt.checkout_session_id);
    // Never reuse an ordinary checkout after switching to merchant-of-record tax handling.
    if (session.status === "open" && managedPaymentsEnabled && !(session as Stripe.Checkout.Session & { managed_payments?: { enabled: boolean } }).managed_payments?.enabled) {
      session = await stripe.checkout.sessions.expire(session.id);
    }
    if (session.status === "open" && session.url) return { alreadyPurchased: false as const, url: session.url, purchaseId: attempt.purchase_id };
    if (session.status === "complete") {
      if (session.payment_status === "paid") await verifyStripeCheckoutSession(stripe, session, client);
      return { alreadyPurchased: false as const, url: null, purchaseId: attempt.purchase_id, state: session.payment_status === "paid" ? "confirming" as const : "waiting" as const };
    }
    if (session.status === "expired") {
      const { error } = await client.from("draft_pro_purchases")
        .update({ checkout_session_status: "expired", status: "expired" })
        .eq("id", attempt.purchase_id)
        .eq("user_id", userId)
        .eq("status", "pending")
        .eq("provider_checkout_session_id", session.id);
      if (error) throw error;
      ({ data: attempts, error: attemptError } = await client.rpc("begin_draft_pro_stripe_checkout_attempt", { p_user_id: userId }));
      attempt = attempts?.[0];
      if (attemptError || !attempt) throw attemptError ?? new Error("Could not renew checkout attempt.");
      if (attempt.purchase_status === "active") return { alreadyPurchased: true as const, url: null, purchaseId: attempt.purchase_id };
      if (attempt.checkout_session_id) return { alreadyPurchased: false as const, url: null, purchaseId: attempt.purchase_id, state: "waiting" as const };
    }
  }

  const catalog = getDraftProStripeCatalog();
  const automaticTaxEnabled = isDraftProStripeAutomaticTaxEnabled();
  const price = await stripe.prices.retrieve(catalog.priceId);
  if (!price.active || price.type !== "one_time" || price.unit_amount !== DRAFT_PRO_STRIPE_PRICE.unitAmount || price.currency !== DRAFT_PRO_STRIPE_PRICE.currency || (typeof price.product === "string" ? price.product : price.product.id) !== catalog.productId || ((automaticTaxEnabled || managedPaymentsEnabled) && price.tax_behavior === "inclusive")) throw new Error("Draft Pro Stripe Price configuration is invalid.");
  // The installed SDK predates this documented API parameter. Keep its shape explicit.
  const params: Stripe.Checkout.SessionCreateParams & { managed_payments?: { enabled: boolean } } = {
    mode: "payment",
    ...(managedPaymentsEnabled ? { managed_payments: { enabled: true } } : { payment_method_types: ["card", "link"] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[] }),
    line_items: [{ price: catalog.priceId, quantity: 1 }],
    ...(!managedPaymentsEnabled && automaticTaxEnabled ? {
      automatic_tax: { enabled: true },
      billing_address_collection: "required" as const,
    } : {}),
    client_reference_id: attempt.purchase_id,
    metadata: { draft_pro_user_id: userId, draft_pro_purchase_id: attempt.purchase_id, draft_pro_season: DRAFT_PRO_SEASON },
    payment_intent_data: { metadata: { draft_pro_user_id: userId, draft_pro_purchase_id: attempt.purchase_id, draft_pro_season: DRAFT_PRO_SEASON } },
    success_url: `${origin}/account?section=draft-pro&draft_pro_checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account?section=draft-pro&draft_pro_checkout=cancelled`,
  };
  const session = await stripe.checkout.sessions.create(params, { idempotencyKey: `${attempt.stripe_idempotency_key}${managedPaymentsEnabled ? ":managed" : ""}` });
  if (!session.url || !session.expires_at) throw new Error("Stripe did not return an expiring Checkout URL.");
  const { error: updateError } = await client.rpc("attach_draft_pro_stripe_checkout_session", { p_purchase_id: attempt.purchase_id, p_checkout_session_id: session.id, p_checkout_expires_at: new Date(session.expires_at * 1000).toISOString() });
  if (updateError) throw updateError;
  return { alreadyPurchased: false as const, url: session.url, purchaseId: attempt.purchase_id };
}
