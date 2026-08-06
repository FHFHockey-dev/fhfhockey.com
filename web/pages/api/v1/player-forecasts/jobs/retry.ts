import type { NextApiResponse } from "next";

import playerForecastAdminOnly from "utils/playerForecastAdminOnlyMiddleware";

export default playerForecastAdminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const jobId = typeof body.jobId === "string" ? body.jobId : null;
  if (!jobId) return res.status(400).json({ success: false, message: "Missing jobId." });
  const { data, error } = await req.supabase
    .from("player_forecast_inference_queue")
    .update({
      status: "pending",
      not_before: new Date().toISOString(),
      lease_owner: null,
      lease_expires_at: null,
      claimed_watermark: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .in("status", ["failed", "cancelled"])
    .select("id,status")
    .maybeSingle();
  if (error) return res.status(500).json({ success: false, message: error.message });
  if (!data) return res.status(409).json({ success: false, message: "Job is not retryable." });
  return res.json({ success: true, job: data });
});
