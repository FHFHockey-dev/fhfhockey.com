import serviceRoleClient from "lib/supabase/server";

import { loadDraftProAccess } from "../server";
import { getDraftProFeatureFlags } from "../features";
import { REFUND_WINDOW_MS } from "./refunds";

type AccountClient = Pick<typeof serviceRoleClient, "from">;

function receiptUrl(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).receipt_url;
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
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

  const refundByPurchase = new Map<string, { status: string }>();
  for (const refund of (refunds.data ?? []) as Array<{ purchase_id: string; status: string }>) {
    if (!['open', 'reviewing'].includes(refund.status)) continue;
    if (!refundByPurchase.has(refund.purchase_id)) refundByPurchase.set(refund.purchase_id, refund);
  }
  const nowMs = now.getTime();

  return {
    access,
    purchases: ((purchases.data ?? []) as Array<Record<string, unknown>>).map((purchase) => {
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
      receiptUrl: receiptUrl(purchase.metadata),
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
