import { retryTweetAttribution } from "lib/sources/tweetAttribution";
import { randomUUID } from "node:crypto";
import adminOnly from "utils/adminOnlyMiddleware";
import { tweetPipelineFlags } from "lib/sources/tweetInterpretation";
import { fetchRosterEntriesByTeam, fetchPlayerNameAliases, applyPlayerNameAliasesToRosterMap, sendPlayerAliasReviewEmailForQueuedNames } from "lib/sources/lineSourceProcessing";
import { resolvePlayerIdentity, rosterSeasonForDate } from "lib/sources/playerIdentity";
import { easternReportDate } from "lib/sources/projectedLineups";
import { tweetPublicationFromUrl } from "lib/sources/linesCccIngestion";

export default adminOnly(async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).end();
  if (!tweetPipelineFlags().interpretation) return res.json({ skipped: true });
  const { data: jobs, error } = await (req.supabase as any).from("tweet_pipeline_jobs").select("job_key,payload")
    .like("job_key", "alias-replay:%").in("status", ["pending", "failed", "running"])
    .lt("attempts", 8)
    .lte("next_attempt_at", new Date().toISOString()).order("job_key").limit(1);
  if (error) throw error;
  let resolved = 0;
  for (const job of jobs ?? []) {
    const owner = randomUUID();
    const { data: claimed, error: claimError } = await (req.supabase as any).rpc("claim_tweet_pipeline_job", { p_key: job.job_key, p_owner: owner });
    if (claimError) throw claimError;
    if (!claimed) continue;
    try {
      let query = (req.supabase as any).from("lineup_unresolved_player_names").select("id,raw_name,tweet_id,source,status,created_at,metadata")
        .eq("normalized_name", job.payload.normalizedName).eq("team_id", job.payload.teamId);
      if (job.payload.afterId) query = query.gt("id", job.payload.afterId);
      const { data: rows, error: rowsError } = await query.order("id").limit(10);
      if (rowsError) throw rowsError;
      const rosterCache = new Map<number, Awaited<ReturnType<typeof fetchRosterEntriesByTeam>>>();
      const aliases = await fetchPlayerNameAliases({ supabase: req.supabase, teamIds: [job.payload.teamId] });
      let consumed = 0, currentCalls = 0;
      for (const row of rows ?? []) {
        const published = tweetPublicationFromUrl(row.tweet_id ? `https://x.com/i/status/${row.tweet_id}` : null);
        if (!published) { consumed++; continue; }
        const date = easternReportDate(published);
        const isCurrent = date === easternReportDate(new Date().toISOString());
        if (isCurrent && currentCalls >= 2) break;
        consumed++;
        const seasonId = rosterSeasonForDate(date);
        if (!rosterCache.has(seasonId)) rosterCache.set(seasonId, applyPlayerNameAliasesToRosterMap({
          rosterByTeam: await fetchRosterEntriesByTeam({ supabase: req.supabase, teamIds: [job.payload.teamId], seasonId }), aliases,
        }));
        const roster = rosterCache.get(seasonId)!;
        const match = resolvePlayerIdentity(row.raw_name, roster.get(job.payload.teamId) ?? []);
        if (match.status !== "matched" || match.player.playerId !== job.payload.playerId) continue;
        if (row.status === "pending") {
          const { error: updateError } = await (req.supabase as any).from("lineup_unresolved_player_names")
            .update({ status: "resolved", resolved_player_id: match.player.playerId, updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", "pending");
          if (updateError) throw updateError;
          resolved++;
        }
        // Historical queue reconciliation never calls a publishing processor.
        if (!isCurrent) continue;
        currentCalls++;
        const base = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
        if (!base) throw new Error("A configured origin is required for current-day replay");
        const origin = new URL(base);
        if (origin.username || origin.password || !["https:", "http:"].includes(origin.protocol) || (origin.protocol === "http:" && !["localhost", "127.0.0.1"].includes(origin.hostname))) throw new Error("Invalid replay origin");
        const ccc = row.source === "lines_ccc";
        const params = new URLSearchParams({ date, tweetId: row.tweet_id, reprocess: "true", limit: "1", ...(ccc ? {} : { sourceKey: row.metadata?.sourceKey ?? row.source }) });
        const response = await fetch(new URL(`/api/v1/db/${ccc ? "update-lines-ccc" : "update-line-sources"}?${params}`, origin.origin), {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(25_000), headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
        });
        if (!response.ok) throw new Error(`Replay processor returned ${response.status}`);
      }
      const more = rows?.length === 10 || consumed < (rows?.length ?? 0);
      const { error: finishError } = await (req.supabase as any).from("tweet_pipeline_jobs").update({ status: more ? "pending" : "complete", lease_expires_at: null,
        attempts: 0, payload: { ...job.payload, afterId: rows?.[consumed - 1]?.id ?? job.payload.afterId }, updated_at: new Date().toISOString() }).eq("job_key", job.job_key).eq("owner", owner);
      if (finishError) throw finishError;
    } catch (failure) {
      await (req.supabase as any).from("tweet_pipeline_jobs").update({ status: "failed", lease_expires_at: null, next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString() }).eq("job_key", job.job_key).eq("owner", owner);
      throw failure;
    }
  }
  const attribution = await retryTweetAttribution(req.supabase);
  let digest = null;
  if (tweetPipelineFlags().publishing) {
    const pending = await (req.supabase as any).from("lineup_unresolved_player_names").select("id", { count: "exact", head: true }).eq("status", "pending").is("metadata->>aliasReviewNotifiedAt", null);
    if (pending.error) throw pending.error;
    if (pending.count) digest = await sendPlayerAliasReviewEmailForQueuedNames({ req, unresolvedNamesQueued: pending.count });
  }
  return res.json({ success: true, resolved, attribution, digest });
});
