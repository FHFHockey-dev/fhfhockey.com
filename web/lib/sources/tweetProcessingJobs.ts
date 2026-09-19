import { randomUUID } from "node:crypto";
import { tweetPipelineFlags } from "./tweetInterpretation";

const leases = new WeakMap<object, { key: string; owner: string }>();

export async function claimTweetEvents<T extends { id: string }>(supabase: any, table: string, events: T[], reprocess: boolean): Promise<T[]> {
  if (!tweetPipelineFlags().interpretation) return events;
  const claimed: T[] = [];
  for (const event of events) {
    const key = `ingest:${table}:${event.id}`;
    const owner = randomUUID();
    const { data, error } = await supabase.rpc("claim_tweet_pipeline_job", { p_key: key, p_owner: owner, p_reprocess: reprocess });
    if (error) throw error;
    if (data) { leases.set(event, { key, owner }); claimed.push(event); }
    else {
      const state = await supabase.from("tweet_pipeline_jobs").select("attempts,status,lease_expires_at").eq("job_key", key).maybeSingle();
      if (state.error) throw state.error;
      if (state.data?.attempts >= 8 && (state.data.status !== "running" || Date.parse(state.data.lease_expires_at) < Date.now())) {
        // Remove exhausted events from the head of the pending queue; explicit replay can retry them.
        const failed = await supabase.from(table).update({ processing_status: "failed", updated_at: new Date().toISOString() }).eq("id", event.id).eq("processing_status", "pending");
        if (failed.error) throw failed.error;
      }
    }
  }
  return claimed;
}

export async function finishTweetEvents(supabase: any, events: object[]) {
  for (const event of events) {
    const lease = leases.get(event);
    if (!lease) continue;
    const { error } = await supabase.from("tweet_pipeline_jobs").update({ status: "complete", lease_expires_at: null, updated_at: new Date().toISOString() })
      .eq("job_key", lease.key).eq("owner", lease.owner);
    if (error) throw error;
    leases.delete(event);
  }
}

export async function failTweetEvents(supabase: any, events: object[], stage: string) {
  for (const event of events) {
    const lease = leases.get(event);
    if (!lease) continue;
    const { error } = await supabase.from("tweet_pipeline_jobs").update({
      status: "failed", failure_stage: stage, lease_expires_at: null,
      next_attempt_at: new Date(Date.now() + 60_000).toISOString(), updated_at: new Date().toISOString(),
    }).eq("job_key", lease.key).eq("owner", lease.owner);
    if (error) throw error;
    leases.delete(event);
  }
}
