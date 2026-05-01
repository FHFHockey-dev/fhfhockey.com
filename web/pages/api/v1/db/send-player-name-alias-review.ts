import type { NextApiResponse } from "next";
import { Resend } from "resend";

import {
  createPlayerAliasQueueReviewToken,
  createPlayerAliasReviewToken
} from "lib/sources/playerAliasReviewToken";
import adminOnly from "utils/adminOnlyMiddleware";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveBaseUrl(req: any): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers.host ?? "fhfhockey.com";
  return `${protocol}://${host}`;
}

export default adminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      message: "Method not allowed."
    });
  }

  const recipient =
    process.env.PLAYER_ALIAS_REVIEW_EMAIL ?? process.env.CRON_REPORT_EMAIL_RECIPIENT;
  if (!recipient) {
    return res.status(500).json({
      success: false,
      message: "Set PLAYER_ALIAS_REVIEW_EMAIL or CRON_REPORT_EMAIL_RECIPIENT."
    });
  }

  const { data, error } = await req.supabase
    .from("lineup_unresolved_player_names" as any)
    .select("id, raw_name, team_abbreviation, source, tweet_id, context_text, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw error;

  const pending = data ?? [];
  if (pending.length === 0) {
    return res.json({
      success: true,
      message: "No pending unresolved player names."
    });
  }

  const baseUrl = resolveBaseUrl(req);
  const queueToken = createPlayerAliasQueueReviewToken();
  const reviewAllUrl = new URL("/db/player-aliases", baseUrl);
  if (queueToken) reviewAllUrl.searchParams.set("reviewToken", queueToken);
  const rowsHtml = pending
    .map((row: any) => {
      const token = createPlayerAliasReviewToken({ unresolvedId: row.id });
      const resolveUrl = new URL("/db/player-aliases", baseUrl);
      resolveUrl.searchParams.set("unresolvedId", row.id);
      if (token) resolveUrl.searchParams.set("reviewToken", token);
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #ddd;"><strong>${escapeHtml(row.raw_name)}</strong></td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(row.team_abbreviation)}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;">${escapeHtml(row.tweet_id)}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;"><a href="${escapeHtml(resolveUrl.toString())}">Resolve</a></td>
        </tr>`;
    })
    .join("");

  const { data: emailData, error: emailError } = await resend.emails.send({
    from: "player-aliases@fhfhockey.com",
    to: recipient,
    subject: `FHFH: ${pending.length} unresolved player names`,
    html: `
      <div style="font-family:Arial,sans-serif;">
        <h1>Unresolved player names</h1>
        <p>These names were captured from tweet-derived lineup parsing and need a manual player alias.</p>
        <p><a href="${escapeHtml(reviewAllUrl.toString())}">Review all pending names</a></p>
        <table style="border-collapse:collapse;width:100%;">
          <thead>
            <tr>
              <th align="left" style="padding:8px;border-bottom:2px solid #333;">Name</th>
              <th align="left" style="padding:8px;border-bottom:2px solid #333;">Team</th>
              <th align="left" style="padding:8px;border-bottom:2px solid #333;">Tweet</th>
              <th align="left" style="padding:8px;border-bottom:2px solid #333;">Action</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`
  });

  if (emailError) {
    return res.status(500).json({
      success: false,
      message: emailError.message
    });
  }

  return res.json({
    success: true,
    message: `Sent ${pending.length} unresolved names for review.`,
    emailId: emailData?.id ?? null
  });
});
