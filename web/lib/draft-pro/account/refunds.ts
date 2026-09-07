import { Resend } from "resend";

import serviceRoleClient, { getServiceRoleClient } from "lib/supabase/server";

import type { CreateDraftProRefundRequestInput } from "../contracts";

export const REFUND_WINDOW_MS = 168 * 60 * 60 * 1000;
export const REFUND_RECIPIENT = "tim@fhfhockey.com";
const REFUND_FROM = "draft-pro@fhfhockey.com";
// Resend honors this key for 24 hours. Durable email state prevents routine
// duplicate retries; attempts after that provider window are not exactly-once.

type RefundClient = Pick<typeof serviceRoleClient, "from">;
type RefundMailer = (message: {
  subject: string;
  html: string;
  idempotencyKey: string;
}) => Promise<{ id?: string | null }>;

export type DraftProRefundResult = {
  id: string;
  status: string;
  emailStatus: string;
  duplicate: boolean;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function defaultMailer(): RefundMailer {
  return async ({ subject, html, idempotencyKey }) => {
    if (!process.env.RESEND_API_KEY?.trim()) {
      throw new Error("RESEND_API_KEY is not configured.");
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: REFUND_FROM,
      to: REFUND_RECIPIENT,
      subject,
      html,
    }, { idempotencyKey });
    if (error) throw new Error(error.message);
    return { id: data?.id };
  };
}

function isWithinRefundWindow(activatedAt: string, now: Date) {
  const activation = new Date(activatedAt).getTime();
  return Number.isFinite(activation) &&
    now.getTime() >= activation &&
    now.getTime() <= activation + REFUND_WINDOW_MS;
}

function refundEmailHtml(input: CreateDraftProRefundRequestInput, purchaseId: string, userId: string, accountEmail: string, activatedAt: string | null) {
  return `<h1>Draft Pro refund request</h1>
    <p><strong>User:</strong> ${escapeHtml(userId)}</p>
    <p><strong>Account email:</strong> ${escapeHtml(accountEmail)}</p>
    <p><strong>Purchase:</strong> ${escapeHtml(purchaseId)}</p>
    <p><strong>Activated:</strong> ${escapeHtml(activatedAt ?? "Unavailable")}</p>
    <p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>
    <p><strong>Explanation:</strong><br>${escapeHtml(input.explanation)}</p>
    ${input.improvementNotes ? `<p><strong>Improvement notes:</strong><br>${escapeHtml(input.improvementNotes)}</p>` : ""}
    ${input.usedDuringLiveDraft === undefined ? "" : `<p><strong>Used during live draft:</strong> ${input.usedDuringLiveDraft ? "Yes" : "No"}</p>`}`;
}

async function markEmailFailure(client: RefundClient, id: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Refund email failed.";
  await client.from("draft_pro_refund_requests").update({
    email_status: "failed",
    email_attempts: 1,
    email_last_error: message.slice(0, 2000),
  }).eq("id", id);
}

export async function createDraftProRefundRequest({
  client = serviceRoleClient,
  mailer,
  now = new Date(),
  userId,
  accountEmail,
  input,
}: {
  client?: RefundClient;
  mailer?: RefundMailer;
  now?: Date;
  userId: string;
  accountEmail: string;
  input: CreateDraftProRefundRequestInput;
}): Promise<DraftProRefundResult> {
  const purchaseQuery = await client.from("draft_pro_purchases")
    .select("id,user_id,status,activated_at")
    .eq("id", input.purchaseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (purchaseQuery.error) throw purchaseQuery.error;
  const purchase = purchaseQuery.data as { id: string; user_id: string; status: string; activated_at: string | null } | null;
  if (!purchase || purchase.user_id !== userId || !purchase.activated_at || ["pending", "failed", "expired", "refunded"].includes(purchase.status)) {
    const error = new Error("This Draft Pro purchase is not eligible for a refund request.");
    Object.assign(error, { statusCode: 404, code: "purchase_not_found" });
    throw error;
  }
  if (!isWithinRefundWindow(purchase.activated_at, now)) {
    const error = new Error("Refund requests must be submitted within 168 hours of activation.");
    Object.assign(error, { statusCode: 422, code: "refund_window_closed" });
    throw error;
  }

  const inserted = await client.from("draft_pro_refund_requests").insert({
    user_id: userId,
    purchase_id: purchase.id,
    reason: input.reason,
    explanation: input.explanation,
    improvement_notes: input.improvementNotes ?? null,
    used_during_live_draft: input.usedDuringLiveDraft ?? null,
  }).select("id,status,email_status").single();
  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const existing = await client.from("draft_pro_refund_requests")
        .select("id,status,email_status")
        .eq("purchase_id", purchase.id)
        .eq("user_id", userId)
        .in("status", ["open", "reviewing"])
        .maybeSingle();
      if (!existing.error && existing.data) {
        const request = existing.data as { id: string; status: string; email_status: string };
        return { ...request, emailStatus: request.email_status, duplicate: true };
      }
      const error = new Error("There is already an open refund request for this purchase.");
      Object.assign(error, { statusCode: 409, code: "refund_request_exists" });
      throw error;
    }
    throw inserted.error;
  }
  const request = inserted.data as { id: string; status: string; email_status: string };

  try {
    const sendEmail = mailer ?? defaultMailer();
    await sendEmail({
      subject: `FHFH Draft Pro refund request ${request.id}`,
      idempotencyKey: `draft-pro-refund-${request.id}`,
      html: refundEmailHtml(input, purchase.id, userId, accountEmail, purchase.activated_at),
    });
    const stateUpdate = await client.from("draft_pro_refund_requests").update({
      email_status: "sent",
      email_attempts: 1,
      email_sent_at: now.toISOString(),
      email_last_error: null,
    }).eq("id", request.id).eq("user_id", userId);
    if (stateUpdate.error) {
      return { ...request, emailStatus: "failed", duplicate: false };
    }
    return { ...request, emailStatus: "sent", duplicate: false };
  } catch (error) {
    await markEmailFailure(client, request.id, error);
    return { ...request, emailStatus: "failed", duplicate: false };
  }
}

export async function retryDraftProRefundEmails({
  client = serviceRoleClient,
  mailer,
  accountEmailResolver,
  limit = 25,
  dryRun = false,
}: {
  client?: RefundClient;
  mailer?: RefundMailer;
  limit?: number;
  accountEmailResolver?: (userId: string) => Promise<string>;
  dryRun?: boolean;
} = {}) {
  const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const pending = await client.from("draft_pro_refund_requests")
    .select("id,user_id,purchase_id,reason,explanation,improvement_notes,used_during_live_draft,email_attempts")
    .in("email_status", ["pending", "failed"])
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(boundedLimit);
  if (pending.error) throw pending.error;
  if (dryRun) return { attempted: (pending.data ?? []).length, sent: 0, failed: 0, dryRun: true };
  let sent = 0;
  let failed = 0;
  const sendEmail = mailer ?? defaultMailer();
  const resolveEmail = accountEmailResolver ?? (async (userId: string) => {
    const { data, error } = await getServiceRoleClient().auth.admin.getUserById(userId);
    if (error || !data.user?.email) throw new Error("Account email unavailable.");
    return data.user.email;
  });
  type RetryRow = {
    id: string;
    user_id: string;
    purchase_id: string;
    reason: CreateDraftProRefundRequestInput["reason"];
    explanation: string;
    improvement_notes: string | null;
    used_during_live_draft: boolean | null;
    email_attempts: number;
  };
  for (const request of (pending.data ?? []) as unknown as RetryRow[]) {
    try {
      const accountEmail = await resolveEmail(request.user_id);
      const purchase = await client.from("draft_pro_purchases").select("activated_at").eq("id", request.purchase_id).eq("user_id", request.user_id).maybeSingle();
      if (purchase.error || !purchase.data) throw new Error("Purchase context unavailable.");
      await sendEmail({
        subject: `FHFH Draft Pro refund request ${request.id}`,
        idempotencyKey: `draft-pro-refund-${request.id}`,
        html: refundEmailHtml({ purchaseId: request.purchase_id, reason: request.reason, explanation: request.explanation, improvementNotes: request.improvement_notes ?? undefined, usedDuringLiveDraft: request.used_during_live_draft ?? undefined }, request.purchase_id, request.user_id, accountEmail, purchase.data.activated_at),
      });
      const stateUpdate = await client.from("draft_pro_refund_requests").update({ email_status: "sent", email_attempts: request.email_attempts + 1, email_sent_at: new Date().toISOString(), email_last_error: null }).eq("id", request.id);
      if (stateUpdate.error) throw new Error("Email state could not be saved.");
      sent += 1;
    } catch (error) {
      await client.from("draft_pro_refund_requests").update({ email_status: "failed", email_attempts: request.email_attempts + 1, email_last_error: (error instanceof Error ? error.message : "Refund email failed.").slice(0, 2000) }).eq("id", request.id);
      failed += 1;
    }
  }
  return { attempted: (pending.data ?? []).length, sent, failed, dryRun: false };
}
