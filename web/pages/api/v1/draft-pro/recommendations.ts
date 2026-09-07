import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireApiUser } from "lib/api/requireApiUser";
import { buildPersonalizedRecommendations } from "lib/draft-pro/recommendations";
import { consumeRecommendationRequest } from "lib/draft-pro/recommendationsRateLimit";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";

const finiteNumber = z.number().finite();
const categoryValues = z.record(finiteNumber.nullable()).refine(
  (values) => Object.keys(values).length <= 80,
  "A player may include at most 80 category values.",
);
const inputSchema = z.object({
  // Local CSV/private rows must never be sent here by background recalculation.
  // W08 supplies the saved-account source once an owner explicitly saves it.
  dataOrigin: z.enum(["server", "local_csv", "private_import"]),
  leagueType: z.enum(["points", "categories"]),
  candidates: z.array(z.object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    role: z.enum(["skater", "goalie"]),
    eligiblePositions: z.array(z.string().min(1).max(12)).max(12),
    globalVorp: finiteNumber,
    rankValue: finiteNumber,
    baselineScore: finiteNumber.optional(),
    categoryValues: categoryValues.optional(),
    adp: finiteNumber.nullable().optional(),
  }).strict()).min(1).max(200),
  positionNeeds: z.record(finiteNumber).optional(),
  categoryNeeds: z.record(finiteNumber).optional(),
  categoryWeights: z.record(finiteNumber).optional(),
  needAlpha: finiteNumber.min(0).max(1).optional(),
  currentPick: finiteNumber.int().min(1).max(2_000).optional(),
  teamCount: finiteNumber.int().min(1).max(32).optional(),
  limit: finiteNumber.int().min(1).max(100).optional(),
}).strict();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const input = inputSchema.parse(req.body ?? {});
    if (input.dataOrigin !== "server") {
      return res.status(422).json({ error: { code: "private_source_requires_saved_draft", message: "Save this private import to your account before requesting remote recommendations." } });
    }
    return res.status(200).json({ data: buildPersonalizedRecommendations(input.candidates, input) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: { code: "validation_error", message: error.issues[0]?.message ?? "Invalid recommendation request." } });
    }
    const status = typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    const code = typeof error === "object" && error && "code" in error && typeof error.code === "string" ? error.code : "recommendations_unavailable";
    return res.status(status).json({ error: { code, message: error instanceof Error ? error.message : "Unable to calculate recommendations." } });
  }
}
