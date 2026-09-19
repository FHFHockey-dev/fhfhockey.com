import { randomUUID } from "node:crypto";
import { sanitizePublicNewsText } from "lib/newsFeed";
import { easternReportDate, verifiedOriginalTweetUrl, type ProjectionReport } from "./projectedLineups";
import { tweetPipelineFlags } from "./tweetInterpretation";

/** An API retweeted reference is evidence of origin; an RT author's name alone is not. */
export function verifiedRetweetFromPayload(payload: any, report: ProjectionReport) {
  if (payload?.data?.id !== report.provenance?.relayTweetId) return null;
  const reference = payload.data.referenced_tweets?.find((entry: any) => entry.type === "retweeted");
  const original = payload.includes?.tweets?.find((entry: any) => entry.id === reference?.id);
  const author = payload.includes?.users?.find((entry: any) => entry.id === original?.author_id);
  if (!original?.text || !author?.username || !original.created_at || !Number.isFinite(Date.parse(original.created_at))) return null;
  const url = verifiedOriginalTweetUrl(`https://x.com/${author.username}/status/${original.id}`);
  const comparable = (text: string) => sanitizePublicNewsText(text).replace(/^RT\s+@\w+:\s*/i, "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  if (!url || comparable(original.text) !== comparable(report.text)) return null;
  return { url, id: original.id as string, publishedAt: original.created_at as string };
}

export async function retryTweetAttribution(supabase: any) {
  const token = process.env.X_API_BEARER_TOKEN ?? process.env.X_BEARER_TOKEN;
  if (!tweetPipelineFlags().publishing || !token) return { resolved: 0, skipped: true };
  const { data, error } = await supabase.from("tweet_projection_reports").select("report_key,payload,attribution_attempts")
    .is("payload->>originalUrl", null).gte("received_at", new Date(Date.now() - 7 * 86400_000).toISOString())
    .lt("attribution_attempts", 8).lte("attribution_next_attempt_at", new Date().toISOString())
    .order("received_at", { ascending: false }).limit(20);
  if (error) throw error;
  let resolved = 0, attempted = 0;
  for (const row of data ?? []) {
    const report = row.payload as ProjectionReport;
    if (!report.provenance?.relayTweetId || attempted === 3) continue;
    const key = `attribution:${row.report_key}`, owner = randomUUID();
    const claim = await supabase.rpc("claim_tweet_pipeline_job", { p_key: key, p_owner: owner });
    if (claim.error) throw claim.error;
    if (!claim.data) continue;
    attempted++;
    let complete = false;
    try {
      const url = new URL(`https://api.x.com/2/tweets/${report.provenance.relayTweetId}`);
      url.searchParams.set("expansions", "referenced_tweets.id,referenced_tweets.id.author_id");
      url.searchParams.set("tweet.fields", "author_id,created_at,referenced_tweets,text");
      url.searchParams.set("user.fields", "username");
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000), redirect: "error" });
      if (!response.ok) throw new Error("Original reference lookup unavailable");
      const original = verifiedRetweetFromPayload(await response.json(), report);
      if (original) {
        const date = easternReportDate(original.publishedAt);
        const updated: ProjectionReport = { ...report, originalUrl: original.url, publishedAt: original.publishedAt,
          originalPublishedAt: original.publishedAt, date, gameId: date === report.date ? report.gameId : null,
          provenance: { ...report.provenance, originalTweetId: original.id, attributionStatus: "resolved" } };
        const write = await supabase.from("tweet_projection_reports").update({ payload: updated, published_at: updated.publishedAt, report_date: date, game_id: updated.gameId }).eq("report_key", row.report_key);
        if (write.error) throw write.error;
        resolved++; complete = true;
      }
    } catch { /* Keep the validated text card; retry source lookup separately. */ }
    const retry = await supabase.from("tweet_projection_reports").update({ attribution_attempts: row.attribution_attempts + 1, attribution_next_attempt_at: new Date(Date.now() + 6 * 3600_000).toISOString() }).eq("report_key", row.report_key);
    if (retry.error) throw retry.error;
    const finish = await supabase.from("tweet_pipeline_jobs").update({ status: complete ? "complete" : "failed",
      failure_stage: complete ? null : "original_attribution", lease_expires_at: null,
      next_attempt_at: new Date(Date.now() + 6 * 3600_000).toISOString(), updated_at: new Date().toISOString(),
    }).eq("job_key", key).eq("owner", owner);
    if (finish.error) throw finish.error;
  }
  return { resolved, attempted };
}
