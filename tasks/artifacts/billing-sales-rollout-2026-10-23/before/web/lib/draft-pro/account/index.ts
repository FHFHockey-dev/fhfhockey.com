import serviceRoleClient from "lib/supabase/server";
import { DRAFT_PRO_EXPIRATION, DRAFT_PRO_PRICE_CENTS, DRAFT_PRO_SEASON } from "../contracts";
import { isPatreonConfigured } from "lib/integrations/patreon/config";
import { isStripeConfigured } from "lib/integrations/stripe/config";

import { loadDraftProAccess } from "../server";
import { getDraftProFeatureFlags } from "../features";
import { REFUND_WINDOW_MS } from "./refunds";

type AccountClient = Pick<typeof serviceRoleClient, "from">;

export type DraftProCheckoutAvailabilityReason =
  | "available"
  | "checkout_disabled"
  | "stripe_not_configured"
  | "site_url_not_configured"
  | "already_eligible"
  | "pass_expired";

export type DraftProCheckoutAvailability = {
  available: boolean;
  reason: DraftProCheckoutAvailabilityReason;
};

export function getDraftProCheckoutAvailability({
  now,
  eligible,
  checkoutEnabled,
  stripeConfigured,
  siteUrlConfigured,
}: {
  now: Date;
  eligible: boolean;
  checkoutEnabled: boolean;
  stripeConfigured: boolean;
  siteUrlConfigured: boolean;
}): DraftProCheckoutAvailability {
  if (eligible) return { available: false, reason: "already_eligible" };
  if (now.getTime() >= Date.parse(DRAFT_PRO_EXPIRATION)) return { available: false, reason: "pass_expired" };
  if (!checkoutEnabled) return { available: false, reason: "checkout_disabled" };
  if (!stripeConfigured) return { available: false, reason: "stripe_not_configured" };
  if (!siteUrlConfigured) return { available: false, reason: "site_url_not_configured" };
  return { available: true, reason: "available" };
}

function validReceiptUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function receiptUrl(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return validReceiptUrl((metadata as Record<string, unknown>).receipt_url);
}

export async function loadDraftProAccount({
  client = serviceRoleClient,
  userId,
  now = new Date(),
  patreonVerificationAvailable = true,
}: {
  client?: AccountClient;
  userId: string;
  now?: Date;
  patreonVerificationAvailable?: boolean;
}) {
  const access = await loadDraftProAccess(userId, {
    client,
    now,
    flags: getDraftProFeatureFlags(),
    patreonVerificationAvailable,
  });
  const checkoutEnabled = getDraftProFeatureFlags().checkout;
  const checkoutAvailability = getDraftProCheckoutAvailability({
    now,
    eligible: access.eligible,
    checkoutEnabled,
    stripeConfigured: isStripeConfigured(),
    siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()),
  });
  const purchases = await client.from("draft_pro_purchases")
    .select("id,season,status,activated_at,expires_at,amount_cents,currency,metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (purchases.error) throw purchases.error;
  const refunds = await client.from("draft_pro_refund_requests")
    .select("id,purchase_id,reason,status,submitted_at,email_status")
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false });
  if (refunds.error) throw refunds.error;
  const drafts = await client.from("draft_pro_drafts")
    .select("id,name,status,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (drafts.error) throw drafts.error;
  const privateImports = await client.from("draft_pro_private_imports")
    .select("id,name,draft_id,byte_size,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (privateImports.error) throw privateImports.error;

  const purchaseRows = (purchases.data ?? []) as Array<Record<string, unknown>>;
  const missingReceiptPurchaseIds = purchaseRows
    .filter((purchase) => !receiptUrl(purchase.metadata))
    .map((purchase) => purchase.id)
    .filter((purchaseId): purchaseId is string => typeof purchaseId === "string");
  const receiptByPurchaseId = new Map<string, string>();
  if (missingReceiptPurchaseIds.length) {
    try {
      const { data, error } = await client.from("draft_pro_provider_events")
        .select("provider,user_id,purchase_id,receipt_url:payload->>receipt_url,provider_occurred_at")
        .eq("provider", "stripe")
        .eq("user_id", userId)
        .in("purchase_id", missingReceiptPurchaseIds)
        .not("payload->>receipt_url", "is", null)
        .order("provider_occurred_at", { ascending: false })
        .limit(100);
      if (!error) {
        const ownedPurchaseIds = new Set(missingReceiptPurchaseIds);
        for (const event of (data ?? []) as Array<Record<string, unknown>>) {
          const purchaseId = event.purchase_id;
          const receipt = validReceiptUrl(event.receipt_url);
          if (event.provider === "stripe" && event.user_id === userId && typeof purchaseId === "string" && ownedPurchaseIds.has(purchaseId) && receipt && !receiptByPurchaseId.has(purchaseId)) {
            receiptByPurchaseId.set(purchaseId, receipt);
          }
        }
      }
    } catch {
      // Receipt history is optional; account access must not depend on it.
    }
  }

  const refundByPurchase = new Map<string, { status: string }>();
  for (const refund of (refunds.data ?? []) as Array<{ purchase_id: string; status: string }>) {
    if (!['open', 'reviewing'].includes(refund.status)) continue;
    if (!refundByPurchase.has(refund.purchase_id)) refundByPurchase.set(refund.purchase_id, refund);
  }
  const nowMs = now.getTime();

  return {
    access,
    passInfo: {
      season: DRAFT_PRO_SEASON,
      priceCents: DRAFT_PRO_PRICE_CENTS,
      currency: "usd",
      expiresAt: DRAFT_PRO_EXPIRATION,
      renewal: "none" as const,
    },
    checkoutAvailability,
    availableFeatures: Object.entries(getDraftProFeatureFlags())
      .filter(([feature, enabled]) => feature !== "checkout" && enabled)
      .map(([feature]) => feature),
    configurationReadiness: {
      stripe: isStripeConfigured(),
      patreon: isPatreonConfigured(),
      yahoo: false,
    },
    purchases: purchaseRows.map((purchase) => {
      const activatedAt = typeof purchase.activated_at === "string" ? purchase.activated_at : null;
      const deadlineMs = activatedAt ? new Date(activatedAt).getTime() + REFUND_WINDOW_MS : NaN;
      const openRefund = refundByPurchase.get(String(purchase.id));
      const activationMs = activatedAt ? new Date(activatedAt).getTime() : NaN;
      const eligible = Boolean(activatedAt && Number.isFinite(activationMs) && Number.isFinite(deadlineMs) && nowMs >= activationMs && nowMs <= deadlineMs && ["active", "disputed"].includes(String(purchase.status)) && !openRefund);
      return {
      id: purchase.id,
      season: purchase.season,
      status: purchase.status,
      activatedAt,
      expiresAt: purchase.expires_at,
      amountCents: purchase.amount_cents,
      currency: purchase.currency,
      receiptUrl: receiptUrl(purchase.metadata) ?? receiptByPurchaseId.get(String(purchase.id)) ?? null,
      refundEligibility: { eligible, deadline: Number.isFinite(deadlineMs) ? new Date(deadlineMs).toISOString() : null, reason: eligible ? "eligible" : openRefund ? "request_open" : deadlineMs <= nowMs ? "window_closed" : "purchase_ineligible" },
    }; }),
    refundRequests: ((refunds.data ?? []) as Array<Record<string, unknown>>).map((refund) => ({
      id: refund.id,
      purchaseId: refund.purchase_id,
      reason: refund.reason,
      status: refund.status,
      submittedAt: refund.submitted_at,
      emailStatus: refund.email_status,
    })),
    providerReadiness: access.providerReadiness,
    savedDrafts: (drafts.data ?? []).map((draft) => ({ id: draft.id, name: draft.name, status: draft.status, updatedAt: draft.updated_at })),
    privateImports: (privateImports.data ?? []).map((item) => ({ id: item.id, name: item.name, draftId: item.draft_id, byteSize: item.byte_size, updatedAt: item.updated_at })),
  };
}
