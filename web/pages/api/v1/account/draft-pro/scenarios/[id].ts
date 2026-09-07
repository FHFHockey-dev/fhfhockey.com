import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireApiUser } from "lib/api/requireApiUser";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";
import serviceRoleClient from "lib/supabase/server";
const id = z.string().uuid(); const fail = (res: NextApiResponse, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store"); if (req.method !== "GET") { res.setHeader("Allow", "GET"); return fail(res, 405, "method_not_allowed", "GET is required."); }
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => fail(res, 401, "authentication_required", message) }); if (!user) return;
  try { const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true }); requireDraftProServerCapability(access, "scenarios"); const scenarioId = id.parse(req.query.id); const { data, error } = await serviceRoleClient.from("draft_pro_scenarios").select("*").eq("id", scenarioId).eq("user_id", user.id).maybeSingle(); if (error) throw error; if (!data) return fail(res, 404, "scenario_not_found", "Scenario not found."); return res.status(200).json({ data }); } catch (cause) { const error = cause as { statusCode?: number; code?: string; message?: string }; if (error.statusCode) return fail(res, error.statusCode, error.code ?? "draft_pro_required", error.message ?? "Draft Pro access is required."); if (cause instanceof z.ZodError) return fail(res, 400, "invalid_request", "Invalid scenario id."); return fail(res, 500, "scenarios_unavailable", "Scenarios are unavailable."); }
}
