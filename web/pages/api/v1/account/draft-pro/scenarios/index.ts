import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireApiUser } from "lib/api/requireApiUser";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { consumeRecommendationRequest } from "lib/draft-pro/recommendationsRateLimit";
import { compareDraftProScenarios, type ScenarioInput } from "lib/draft-pro/scenarios";
import { scenarioRequestSchema } from "lib/draft-pro/scenariosContract";
import { evaluateScenarioDust, validateScenarioReferences } from "lib/draft-pro/scenariosServer";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";
import serviceRoleClient from "lib/supabase/server";
import type { Json } from "lib/supabase/database-generated.types";

const fail = (res: NextApiResponse, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST"].includes(req.method ?? "")) { res.setHeader("Allow", "GET, POST"); return fail(res, 405, "method_not_allowed", "GET or POST is required."); }
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => fail(res, 401, "authentication_required", message) }); if (!user) return;
  try {
    if (req.method === "GET") { const { data, error } = await serviceRoleClient.from("draft_pro_scenarios").select("id,name,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100); if (error) throw error; return res.status(200).json({ data: data ?? [] }); }
    const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true }); requireDraftProServerCapability(access, "scenarios");
    if (!consumeRecommendationRequest(`scenario:${user.id}`)) return fail(res, 429, "rate_limited", "Too many scenario requests. Try again shortly.");
    const parsed = scenarioRequestSchema.parse(req.body ?? {}); const input = parsed.scenario as ScenarioInput; const draftId = parsed.draftId ?? null;
    const invalidReference = await validateScenarioReferences(user.id, input, draftId);
    if (invalidReference === "draft_not_found") return fail(res, 404, invalidReference, "Saved draft not found.");
    if (invalidReference === "private_import_not_saved") return fail(res, 403, invalidReference, "Private projections must come from an explicitly saved, owned draft import.");
    const dust = await evaluateScenarioDust(input); const calculation = compareDraftProScenarios(input, dust);
    if (parsed.action === "analyze") return res.status(200).json({ data: calculation });
    const { data, error } = await serviceRoleClient.from("draft_pro_scenarios").insert({ user_id: user.id, draft_id: draftId, name: parsed.name, source_fingerprint: calculation.fingerprint, input: parsed.scenario as Json, result: calculation as unknown as Json }).select().single(); if (error) throw error;
    return res.status(201).json({ data });
  } catch (cause) {
    const error = cause as { statusCode?: number; code?: string; message?: string }; if (error.statusCode) return fail(res, error.statusCode, error.code ?? "draft_pro_required", error.message ?? "Draft Pro access is required.");
    if (cause instanceof z.ZodError) return fail(res, 400, "invalid_request", cause.issues[0]?.message ?? "Invalid scenario.");
    if (cause instanceof Error && (cause.message.startsWith("Choose two") || cause.message.startsWith("Candidates must"))) return fail(res, 400, "invalid_scenario", cause.message);
    return fail(res, 500, "scenarios_unavailable", "Scenarios are unavailable. Your current comparison is unchanged.");
  }
}
