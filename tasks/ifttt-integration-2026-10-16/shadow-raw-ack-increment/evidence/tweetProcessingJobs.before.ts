import { randomUUID } from "node:crypto";
import { tweetPipelineFlags } from "./tweetInterpretation";

const leases = new WeakMap<object, { key: string; owner: string }>();

async function readJob(supabase: any, key: string) {
  const result = await supabase.from("tweet_pipeline_jobs").select("job_key,owner,status,lease_expires_at,attempts,failure_stage").eq("job_key", key).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

export async function claimTweetEvents<T extends { id: string }>(supabase: any, table: string, events: T[], reprocess: boolean): Promise<T[]> {
  if (!tweetPipelineFlags().interpretation) return events;
  const claimed: T[] = [];
  for (const event of events) {
    const key = `ingest:${table}:${event.id}`;
    const owner = randomUUID();
    let data: boolean;
    try {
      const result = await supabase.rpc("claim_tweet_pipeline_job", { p_key: key, p_owner: owner, p_reprocess: reprocess });
      if (result.error) throw result.error;
      data = result.data;
    } catch (error) {
      // Reconcile this exact attempt; never issue a second claim after an uncertain reply.
      const state = await readJob(supabase, key);
      if (state?.owner !== owner || state.status !== "running" || !(Date.parse(state.lease_expires_at) > Date.now())) throw error;
      data = true;
    }
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
    await settleEvent(supabase, event, "complete");
  }
}

export async function failTweetEvents(supabase: any, events: object[], stage: string) {
  for (const event of events) {
    await settleEvent(supabase, event, "failed", stage);
  }
}

async function settleEvent(supabase: any, event: object, status: "complete" | "failed", stage?: string) {
  const lease = leases.get(event);
  if (!lease) return;
  const now = new Date().toISOString();
  let failure: unknown;
  try {
    const result = await supabase.from("tweet_pipeline_jobs").update({
      status, failure_stage: status === "failed" ? stage : null, lease_expires_at: null, updated_at: now,
      ...(status === "failed" ? { next_attempt_at: new Date(Date.now() + 60_000).toISOString() } : {}),
    }).eq("job_key", lease.key).eq("owner", lease.owner).eq("status", "running").gt("lease_expires_at", now)
      .select("job_key,owner,status,failure_stage").maybeSingle();
    if (result.error) throw result.error;
    if (result.data?.owner === lease.owner && result.data.status === status) { leases.delete(event); return; }
  } catch (error) { failure = error; }
  // A lost response is acknowledged only by the retained terminal state of this owner.
  // In particular, a route catch must never turn committed completion into failure.
  const retained = await readJob(supabase, lease.key);
  if (retained?.owner === lease.owner && (retained.status === "complete" ||
    (status === "failed" && retained.status === "failed" && retained.failure_stage === stage))) {
    leases.delete(event); return;
  }
  if (failure) throw failure;
  throw new Error("Tweet job ownership or lease lost before acknowledgment");
}
