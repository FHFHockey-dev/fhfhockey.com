import type { NextApiRequest, NextApiResponse } from "next";

import { z } from "zod";
import { consumeRecommendationRequest } from "lib/draft-pro/recommendationsRateLimit";

import { requireApiUser } from "lib/api/requireApiUser";
import serviceRoleClient from "lib/supabase/server";
import { loadDraftProAccess } from "lib/draft-pro/server";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { getStripeClient, isStripeConfigured } from "lib/integrations/stripe/config";
import { checkoutUserId, verifyStripeCheckoutSession } from "lib/integrations/stripe/fulfillment";

const inputSchema = z.union([
  z.object({ sessionId: z.string().regex(/^cs_(test|live)_[A-Za-z0-9]+$/) }).strict(),
  z.object({ recoveryCode: z.string().trim().regex(/^DPRO-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) }).strict(),
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const user = await requireApiUser(req, res);
  if (!user) return;
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A valid Checkout session is required." });
  if (!isStripeConfigured()) return res.status(503).json({ error: "Stripe checkout is not configured." });
  if (!consumeRecommendationRequest(`purchase-recovery:${user.id}`)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Please wait a minute before checking again." });
  }
  try {
    const recovery = "recoveryCode" in parsed.data;
    let sessionId = "sessionId" in parsed.data ? parsed.data.sessionId : "";
    let recoveryPurchaseId: string | null = null;
    if ("recoveryCode" in parsed.data) {
      recoveryPurchaseId = parsed.data.recoveryCode.slice(5).toLowerCase();
      const { data: owned, error } = await serviceRoleClient.from("draft_pro_purchases")
        .select("id,provider_checkout_session_id,status").eq("id", recoveryPurchaseId).eq("user_id", user.id).eq("provider", "stripe").maybeSingle();
      if (error) throw error;
      if (!owned?.provider_checkout_session_id || !["active", "pending"].includes(owned.status)) return res.status(400).json({ error: "This recovery code cannot activate a purchase for this account." });
      sessionId = owned.provider_checkout_session_id;
    }
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] });
    if (checkoutUserId(session) !== user.id) return res.status(403).json({ error: "This Checkout session belongs to another account." });
    if (recoveryPurchaseId && session.metadata?.draft_pro_purchase_id !== recoveryPurchaseId) return res.status(400).json({ error: "This recovery code cannot activate a purchase for this account." });
    if (recovery) {
      const intent = session.payment_intent;
      const charge = typeof intent === "object" && intent ? intent.latest_charge : null;
      if (!charge || typeof charge === "string" || charge.disputed || charge.refunded || charge.amount_refunded >= charge.amount) return res.status(400).json({ error: "This payment cannot currently activate Draft Pro. Contact support." });
    }
    const result = await verifyStripeCheckoutSession(stripe, session, serviceRoleClient, recovery);
    const purchaseId = result.purchaseId ?? session.metadata?.draft_pro_purchase_id ?? null;
    const { data: purchase, error: purchaseError } = purchaseId
      ? await serviceRoleClient.from("draft_pro_purchases").select("id,status").eq("id", purchaseId).eq("user_id", user.id).maybeSingle()
      : { data: null };
    if (purchaseError) throw purchaseError;
    const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true });
    const verifiedPaidPurchase = Boolean(result.purchaseId) && session.payment_status === "paid" &&
      (purchase?.status === "pending" || purchase?.status === "active");
    const state = verifiedPaidPurchase && access.eligible && purchase?.status === "active"
      ? "confirmed"
      : verifiedPaidPurchase
        ? "confirming"
        : "ineligible";
    return res.status(200).json({ state, purchaseId });
  } catch (error) {
    return res.status(500).json({ error: "Checkout verification failed." });
  }
}
