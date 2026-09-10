import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireApiUser } from "lib/api/requireApiUser";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import { loadDraftProAccess, requireDraftProServerCapability } from "lib/draft-pro/server";
import { assertReportSnapshotMatch, buildDraftProReport, buildScenarioReportInput, reportInputSchema, type DraftProReportType, type ReportInput } from "lib/draft-pro/reports";
import serviceRoleClient from "lib/supabase/server";
import { readSavedDraft } from "lib/draft-pro/savedDraftsServer";
import { evaluateRosterDust, validateAnalysisReferences } from "lib/draft-pro/scenariosServer";
import { scenarioAnalysisSchema } from "lib/draft-pro/scenariosContract";
import { consumeRecommendationRequest } from "lib/draft-pro/recommendationsRateLimit";

const requestSchema = z.object({ draftId: z.string().uuid().nullable().optional(), privateImportDraftId: z.string().uuid().nullable().optional(), scenarioId: z.string().uuid().nullable().optional(), reportType: z.enum(["draft_summary", "scenario_comparison"]), input: z.unknown(), snapshot: z.unknown().optional() }).strict();
const fail = (res: NextApiResponse, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST"].includes(req.method ?? "")) { res.setHeader("Allow", "GET, POST"); return fail(res, 405, "method_not_allowed", "GET or POST is required."); }
  const user = await requireApiUser(req, res, { onUnauthorized: (message) => fail(res, 401, "authentication_required", message) });
  if (!user) return;
  try {
    if (req.method === "GET") {
      const { data, error } = await serviceRoleClient.from("draft_pro_reports").select("id,report_type,created_at,source_fingerprint").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return res.status(200).json({ data: data ?? [] });
    }
    const access = await loadDraftProAccess(user.id, { now: new Date(), flags: getDraftProFeatureFlags(), patreonVerificationAvailable: true });
    requireDraftProServerCapability(access, "reports");
    if (!consumeRecommendationRequest(`report:${user.id}`)) return fail(res, 429, "rate_limited", "Too many report requests. Try again shortly.");
    const parsed = requestSchema.parse(req.body ?? {});
    let input = reportInputSchema.parse(parsed.input) as ReportInput;
    let effectiveDraftId = parsed.draftId ?? null;
    if (parsed.scenarioId) {
      const { data, error } = await serviceRoleClient.from("draft_pro_scenarios").select("id,user_id,draft_id,input").eq("id", parsed.scenarioId).eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (!data) return fail(res, 404, "scenario_not_found", "Saved scenario not found.");
      if (parsed.draftId && data.draft_id !== parsed.draftId) return fail(res, 409, "scenario_draft_mismatch", "The saved scenario does not belong to this saved draft.");
      effectiveDraftId = data.draft_id;
      input = buildScenarioReportInput(scenarioAnalysisSchema.parse(data.input));
    } else if (parsed.draftId) {
      const saved = await readSavedDraft(user.id, parsed.draftId);
      assertReportSnapshotMatch(saved.snapshot, input, false);
    } else {
      if (!parsed.snapshot) return fail(res, 400, "snapshot_required", "A validated completed draft snapshot is required.");
      assertReportSnapshotMatch(parsed.snapshot, input, true);
    }
    if (!input) return fail(res, 400, "invalid_request", "A current draft, owned saved draft, or owned scenario is required.");
    const sourceCheck = await validateAnalysisReferences(user.id, input.source, effectiveDraftId ?? parsed.privateImportDraftId ?? null);
    if (sourceCheck === "draft_not_found") return fail(res, 404, sourceCheck, "Saved draft not found.");
    if (sourceCheck === "private_import_not_saved") return fail(res, 403, sourceCheck, "Private projections must come from an explicitly saved, owned draft import.");
    const dust = await evaluateRosterDust({ roster: input.roster, candidates: [], source: input.source });
    const report = buildDraftProReport(parsed.reportType as DraftProReportType, input, new Date(), dust);
    const { data, error } = await serviceRoleClient.from("draft_pro_reports").insert({ user_id: user.id, draft_id: effectiveDraftId, scenario_id: parsed.scenarioId ?? null, report_type: parsed.reportType, schema_version: 1, source_fingerprint: report.sourceFingerprint, payload: report as unknown as import("lib/supabase/database-generated.types").Json }).select("id,report_type,source_fingerprint,created_at,payload").single();
    if (error) throw error;
    return res.status(201).json({ data });
  } catch (cause) {
    const error = cause as { statusCode?: number; code?: string; message?: string };
    if (error.statusCode) return fail(res, error.statusCode, error.code ?? "draft_pro_required", error.message ?? "Draft Pro access is required.");
    if (cause instanceof z.ZodError) return fail(res, 400, "invalid_request", cause.issues[0]?.message ?? "Invalid report request.");
    return fail(res, 500, "reports_unavailable", "Reports are unavailable. Your draft is unchanged.");
  }
}
