import { boundedTweetClaimEvaluationConfig } from "./tweetClaimEvaluationBounds";

export const tweetClaimEvaluationIntakeWindow = () => process.env.TWEET_CLAIMS_MODE === "shadow" ? boundedTweetClaimEvaluationConfig() : null;

/** Stop a configured prospective pilot before roster loads, enrichment or publishers. */
export async function admitTweetClaimEvaluationIntake<T extends { id: string }>(db: any,
  table: "line_source_ifttt_events" | "lines_ccc_ifttt_events", events: T[]) {
  const cohort = tweetClaimEvaluationIntakeWindow();
  if (!cohort) return { active: false, events, reason: null };
  const registered = await db.rpc("register_bounded_tweet_claim_evaluation", { p_id: cohort.id,p_start: cohort.startsAt,
    p_end: cohort.endsAt,p_max: cohort.maxSamples,p_version: cohort.extractionVersion });
  if (registered.error) throw registered.error;
  const reserved = await db.rpc("reserve_tweet_claim_evaluation_intake", { p_id: cohort.id,p_table: table,p_ids: events.slice(0,25).map(event => event.id) });
  if (reserved.error) throw reserved.error;
  const allowed = new Set<string>(reserved.data.allowed);
  return { active: true,events: events.filter(event => allowed.has(event.id)),reason: String(reserved.data.status) };
}
