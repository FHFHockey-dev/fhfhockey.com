import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireApiUser } from "lib/api/requireApiUser";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";
import { consumeRecommendationRequest } from "lib/draft-pro/recommendationsRateLimit";
import { draftProExportInputSchema, formatDraftProExportCsv } from "lib/draft-pro/exportContract";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") return res.status(405).json({ error: { code: "method_not_allowed" } });
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => res.status(401).json({ error: { code: "authentication_required", message } }) });
  if (!user) return;
  if (!consumeRecommendationRequest(`export:${user.id}`)) return res.status(429).json({ error: { code: "rate_limited", message: "Too many export requests." } });
  try {
    const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true });
    requireDraftProServerCapability(access, "blended_csv");
    const input = draftProExportInputSchema.parse(req.body ?? {});
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="fhfhockey-blended-projections.csv"');
    return res.status(200).send(formatDraftProExportCsv(input));
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: { code: "validation_error", message: error.issues[0]?.message ?? "Invalid export request." } });
    const status = typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    return res.status(status).json({ error: { code: status === 403 ? "draft_pro_required" : "export_unavailable", message: status === 403 ? "Draft Pro access is required for this export." : "Unable to create the CSV export." } });
  }
}
