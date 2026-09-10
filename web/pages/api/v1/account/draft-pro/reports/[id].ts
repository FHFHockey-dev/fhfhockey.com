import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "lib/api/requireApiUser";
import serviceRoleClient from "lib/supabase/server";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";

const fail = (res: NextApiResponse, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return fail(res, 405, "method_not_allowed", "GET is required."); }
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => fail(res, 401, "authentication_required", message) });
  if (!user) return;
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!UUID_PATTERN.test(id)) return fail(res, 400, "invalid_request", "A valid report ID is required.");
  try {
    const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true });
    requireDraftProServerCapability(access, "reports");
    const { data, error } = await serviceRoleClient.from("draft_pro_reports").select("id,report_type,source_fingerprint,created_at,payload").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!data) return fail(res, 404, "report_not_found", "Report not found.");
    return res.status(200).json({ data });
  } catch (cause) {
    const error = cause as { statusCode?: number; code?: string; message?: string };
    if (error.statusCode) return fail(res, error.statusCode, error.code ?? "draft_pro_required", error.message ?? "Draft Pro access is required.");
    return fail(res, 500, "reports_unavailable", "Reports are unavailable.");
  }
}
