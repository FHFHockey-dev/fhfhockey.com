import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireApiUser } from "lib/api/requireApiUser";
import { buildPersonalizedRecommendations } from "lib/draft-pro/recommendations";
import { consumeRecommendationRequest } from "lib/draft-pro/recommendationsRateLimit";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";
import { draftProRecommendationsInputSchema, localRecommendationsAccessSchema } from "lib/draft-pro/recommendationsContract";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "method_not_allowed" } });
  }
  const user = await requireApiUser(req, res, {
    onUnauthorized: (message) => res.status(401).json({ error: { code: "authentication_required", message } }),
  });
  if (!user) return;
  if (!consumeRecommendationRequest(user.id)) {
    return res.status(429).json({ error: { code: "rate_limited", message: "Too many recommendation requests." } });
  }
  try {
    const access = await loadDraftProAccess(user.id, {
      now: new Date(),
      flags: getDraftProFeatureFlags(),
      patreonVerificationAvailable: true,
    });
    requireDraftProServerCapability(access, "recommendations");
    if (localRecommendationsAccessSchema.safeParse(req.body).success) {
      return res.status(200).json({ data: { authorized: true } });
    }
    const input = draftProRecommendationsInputSchema.parse(req.body ?? {});
    if (input.dataOrigin !== "server") {
      return res.status(422).json({ error: { code: "private_source_requires_saved_draft", message: "Imported projections must be calculated locally after checking Draft Pro access." } });
    }
    return res.status(200).json({ data: buildPersonalizedRecommendations(input.candidates, input) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: { code: "validation_error", message: error.issues[0]?.message ?? "Invalid recommendation request." } });
    }
    const status = typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    if (status === 403) {
      const code = typeof error === "object" && error && "code" in error && typeof error.code === "string" ? error.code : "draft_pro_required";
      return res.status(403).json({ error: { code, message: "Draft Pro access is required for this action." } });
    }
    return res.status(status >= 400 && status < 500 ? status : 500).json({ error: { code: status >= 400 && status < 500 ? "request_failed" : "recommendations_unavailable", message: status >= 400 && status < 500 ? "Unable to process this recommendation request." : "Unable to calculate recommendations." } });
  }
}
