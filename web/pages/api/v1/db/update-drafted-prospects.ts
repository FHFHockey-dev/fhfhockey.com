import { randomUUID } from "node:crypto";
import adminOnly from "utils/adminOnlyMiddleware";
import { previewNhlDraftBatch, importNhlIdentity } from "lib/sources/nhlProspectIdentity";
import { tweetPipelineFlags } from "lib/sources/tweetInterpretation";

export const config = { maxDuration: 120 };

export default adminOnly(async (req, res) => {
  if (!["GET", "POST"].includes(req.method ?? "")) return res.status(405).end();
  const scheduled = req.query.scheduled === "true";
  const dryRun = req.query.dryRun === "true" || (!scheduled && req.query.dryRun !== "false");
  if (!dryRun && (!tweetPipelineFlags().interpretation || process.env.NHL_PROSPECT_REFRESH_ENABLED !== "true")) {
    return res.json({ success: true, skipped: true, reason: "Prospect writes are disabled." });
  }
  const supabase = req.supabase as any;
  const key = "nhl-prospect-refresh", owner = randomUUID();
  let claimed = false;
  try {
    // Before July the current year's draft can be incomplete; retain the last completed class.
    const now = new Date();
    const latestYear = now.getUTCFullYear() - (now.getUTCMonth() < 6 ? 1 : 0);
    let year = Number(req.query.year ?? latestYear), after = Number(req.query.after ?? 0);
    if (scheduled && !dryRun) {
      const claim = await supabase.rpc("claim_tweet_pipeline_job", { p_key: key, p_owner: owner });
      if (claim.error) throw claim.error;
      if (!claim.data) return res.json({ success: true, skipped: true, reason: "Refresh claimed, backing off, or retry limit reached." });
      claimed = true;
      const state = await supabase.from("tweet_pipeline_jobs").select("payload").eq("job_key", key).single();
      if (state.error) throw state.error;
      const cursor = state.data?.payload;
      if (cursor?.latestYear === latestYear) { year = cursor.year; after = cursor.after; }
    }
    const preview = await previewNhlDraftBatch({ year, after, limit: Number(req.query.limit ?? 25) });
    const imports = [];
    if (!dryRun) for (const player of preview.players) imports.push(await importNhlIdentity(supabase, player));
    if (claimed) {
      const nextYear = preview.nextCursor == null ? (year > latestYear - 5 ? year - 1 : latestYear) : year;
      const finish = await supabase.from("tweet_pipeline_jobs").update({ status: "pending", attempts: 0, lease_expires_at: null,
        payload: { latestYear, year: nextYear, after: preview.nextCursor ?? 0 }, next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
        failure_stage: null, updated_at: new Date().toISOString(),
      }).eq("job_key", key).eq("owner", owner);
      if (finish.error) throw finish.error;
    }
    return res.json({ success: true, dryRun, ...preview, imports });
  } catch (error) {
    if (claimed) await supabase.from("tweet_pipeline_jobs").update({ status: "failed", lease_expires_at: null,
      failure_stage: "prospect_identity_refresh", next_attempt_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }).eq("job_key", key).eq("owner", owner);
    return res.status(400).json({ success: false, message: error instanceof Error ? error.message : "Prospect refresh failed." });
  }
});
