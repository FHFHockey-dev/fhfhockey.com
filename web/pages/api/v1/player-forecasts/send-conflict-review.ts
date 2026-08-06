import type { NextApiResponse } from "next";
import { Resend } from "resend";

import { createPlayerForecastReviewToken } from "lib/player-forecasts/reviewToken";
import playerForecastAdminOnly from "utils/playerForecastAdminOnlyMiddleware";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function baseUrl(req: any): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return `${req.headers["x-forwarded-proto"] ?? "https"}://${req.headers.host ?? "fhfhockey.com"}`;
}

export default playerForecastAdminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const recipient =
    process.env.PLAYER_FORECAST_REVIEW_EMAIL ??
    process.env.CRON_REPORT_EMAIL_RECIPIENT;
  if (!recipient) {
    return res.status(500).json({ success: false, message: "Forecast review recipient is not configured." });
  }
  const { data, error } = await req.supabase
    .from("player_forecast_observation_conflicts")
    .select("id,summary,detected_at,game_id,team_id,player_forecast_conflict_resolutions(id)")
    .order("detected_at", { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ success: false, message: error.message });
  const pending = (data ?? []).filter(
    (conflict: any) => (conflict.player_forecast_conflict_resolutions ?? []).length === 0,
  );
  if (pending.length === 0) return res.json({ success: true, message: "No unresolved conflicts." });
  const queueToken = createPlayerForecastReviewToken({ queue: true });
  const reviewAll = new URL("/db/player-forecast-review", baseUrl(req));
  if (queueToken) reviewAll.searchParams.set("reviewToken", queueToken);
  const rows = pending.map((conflict: any) => {
    const token = createPlayerForecastReviewToken({ conflictId: conflict.id });
    const url = new URL("/db/player-forecast-review", baseUrl(req));
    url.searchParams.set("conflictId", conflict.id);
    if (token) url.searchParams.set("reviewToken", token);
    return `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(conflict.summary)}</td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(conflict.detected_at)}</td><td style="padding:8px;border-bottom:1px solid #ddd"><a href="${escapeHtml(url)}">Review</a></td></tr>`;
  }).join("");
  const { data: email, error: emailError } = await resend.emails.send({
    from: "player-forecasts@fhfhockey.com",
    to: recipient,
    subject: `FHFH: ${pending.length} player forecast conflicts`,
    html: `<div style="font-family:Arial,sans-serif"><h1>Player forecast conflicts</h1><p>Forecasts remain provisional while these observations are reviewed.</p><p><a href="${escapeHtml(reviewAll)}">Review all conflicts</a></p><table style="border-collapse:collapse;width:100%">${rows}</table></div>`,
  });
  if (emailError) return res.status(500).json({ success: false, message: emailError.message });
  return res.json({ success: true, sent: pending.length, emailId: email?.id ?? null });
});
