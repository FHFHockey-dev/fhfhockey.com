import { z } from "zod";
import adminOnly from "utils/adminOnlyMiddleware";
import { buildStarterBoardOperationsReport } from "lib/projections/starterBoardOperations";
import { boardReleaseSchema, boardReviewSchema, boardValidationPolicySchema, boardComponentDecisions } from "lib/projections/starterBoardValidation";
import { projectionInputHash } from "lib/projections/inputCapture";

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("select"), gameId: z.number().int().positive(), revisionId: z.string().uuid().nullable(), reason: z.string().trim().min(1).max(500) }).strict(),
  z.object({ action: z.literal("visibility"), probeId: z.string().uuid(), revisionIds: z.array(z.string().uuid()).min(1).max(16), renderedAt: z.string().datetime({ offset: true }).optional() }).strict(),
  z.object({ action: z.literal("report"), from: z.string().datetime({ offset: true }), until: z.string().datetime({ offset: true }), asOf: z.string().datetime({ offset: true }).optional() }).strict(),
  z.object({ action: z.literal("register_release"), release: boardReleaseSchema }).strict(),
  z.object({ action: z.literal("activate_release"), releaseId: z.string().uuid().nullable(), reason: z.string().trim().min(1).max(500) }).strict(),
  z.object({ action: z.literal("publish_review"), releaseId: z.string().uuid(), kind: z.enum(["weekly", "day14", "day30"]), report: boardReviewSchema }).strict(),
]);

export default adminOnly(async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  const parsed = action.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid release action" });
  const body = parsed.data;
  if (body.action === "register_release") {
    const release = body.release;
    const { data, error } = await (req.supabase as any).from("forge_board_releases").insert({
      release_key: release.releaseKey, code_version: release.codeVersion, model_identity: release.modelIdentity,
      evaluation_version: release.evaluationVersion, policy: release.policy, policy_hash: projectionInputHash(release.policy),
    }).select("id,policy_hash").single();
    if (error) return res.status(409).json({ error: "Release registration could not be applied" });
    return res.status(200).json({ success: true, release: data });
  }
  if (body.action === "activate_release") {
    const { data, error } = await (req.supabase as any).rpc("activate_starter_board_release", { p_release_id: body.releaseId, p_reason: body.reason });
    if (error) return res.status(409).json({ error: "Release tracking could not be activated" });
    return res.status(200).json({ success: true, activationId: data });
  }
  if (body.action === "publish_review") {
    const { data: release, error: releaseError } = await (req.supabase as any).from("forge_board_releases").select("policy,policy_hash,evaluation_version").eq("id", body.releaseId).single();
    const policy = boardValidationPolicySchema.safeParse(release?.policy);
    if (releaseError || !policy.success || release.policy_hash !== body.report.policyHash
      || release.evaluation_version !== body.report.evaluationVersion || projectionInputHash(policy.data) !== release.policy_hash
      || Date.parse(body.report.asOf) > Date.now()) return res.status(409).json({ error: "Review does not match the frozen release policy" });
    const reportHash = projectionInputHash(body.report);
    const { data, error } = await (req.supabase as any).from("forge_board_validation_reviews").insert({
      release_id: body.releaseId, kind: body.kind, report_hash: reportHash, report: body.report,
    }).select("id").single();
    if (error) return res.status(409).json({ error: "Review could not be published; verify milestone and report identity" });
    return res.status(200).json({ success: true, reviewId: data.id, reportHash, decisions: boardComponentDecisions(body.report, policy.data),
      modelActivated: false, intervalsActivated: false });
  }
  if (body.action === "report") {
    const asOf = body.asOf ?? new Date().toISOString();
    if (Date.parse(body.from) >= Date.parse(body.until) || Date.parse(body.until) > Date.parse(asOf)
      || Date.parse(asOf) > Date.now() || Date.parse(body.until) - Date.parse(body.from) > 31 * 86_400_000) {
      return res.status(400).json({ error: "Invalid operational report window" });
    }
    const { data, error } = await (req.supabase as any).rpc("read_starter_board_operational_events", {
      p_from: body.from, p_until: body.until, p_as_of: asOf,
    });
    if (error) return res.status(503).json({ error: "Operational report unavailable" });
    try {
      return res.status(200).json(buildStarterBoardOperationsReport({ events: data ?? [], from: body.from, until: body.until, asOf }));
    } catch { return res.status(503).json({ error: "Operational evidence could not be validated" }); }
  }
  const { data, error } = body.action === "select"
    ? await (req.supabase as any).rpc("select_starter_board_revision", { p_game_id: body.gameId, p_revision_id: body.revisionId, p_reason: body.reason })
    : await (req.supabase as any).rpc(body.renderedAt ? "record_starter_board_visibility_timed" : "record_starter_board_visibility", { p_probe_id: body.probeId, p_revision_ids: body.revisionIds,
      ...(body.renderedAt ? { p_rendered_at: body.renderedAt } : {}),
    });
  if (error) return res.status(409).json({ error: "Revision action could not be applied" });
  return res.status(200).json({ success: true, result: data });
});
