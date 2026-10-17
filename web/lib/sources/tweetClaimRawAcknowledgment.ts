import { isDeepStrictEqual } from "node:util";
import { timestampMicros } from "../projections/evidenceTime";

type RawTable = "line_source_ifttt_events" | "lines_ccc_ifttt_events";
type Db = { from: (table: string) => any; rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }> };

/** Explicit shadow-only caller; a completion receipt confirms retained evidence,
 * never forecast delivery. An uncertain response causes reads, not another RPC.
 */
export async function acknowledgeTweetClaimRawEvent(args: {
  db: Db; table: RawTable; eventId: string; key: string; owner: string;
  expectedPayload: Record<string, unknown>; observationIds: string[]; enabled?: boolean;
}) {
  if (!args.enabled) return { status: "disabled" as const };
  if (!["line_source_ifttt_events", "lines_ccc_ifttt_events"].includes(args.table)
    || args.key !== `ingest:${args.table}:${args.eventId}` || !args.observationIds.length
    || args.observationIds.length > 256 || new Set(args.observationIds).size !== args.observationIds.length) {
    throw new Error("Invalid bounded shadow acknowledgment identity");
  }
  const ids = [...args.observationIds].sort();
  const matches = (receipt: any) => receipt?.version === "shadow-raw-ack-v1" && receipt.jobKey === args.key
    && receipt.owner === args.owner && receipt.table === args.table && receipt.eventId === args.eventId
    && typeof receipt.tweetId === "string" && receipt.tweetId.length > 0 && timestampMicros(receipt.receivedAt) !== null
    && receipt.delivery === "not_requested" && isDeepStrictEqual(receipt.beforePayload, args.expectedPayload)
    && isDeepStrictEqual(receipt.observationIds, ids) && receipt.marker?.lane === "shadow"
    && receipt.marker.delivery === "not_requested" && receipt.marker.acknowledgmentKey === args.key
    && timestampMicros(receipt.marker.capturedAt) !== null
    && timestampMicros(receipt.marker.capturedAt) === timestampMicros(receipt.acknowledgedAt)
    && timestampMicros(receipt.acknowledgedAt)! >= timestampMicros(receipt.receivedAt)!;
  let failure: unknown;
  try {
    const result = await args.db.rpc("settle_tweet_claim_shadow_raw_event", { p_table: args.table, p_id: args.eventId,
      p_owner: args.owner, p_expected: args.expectedPayload, p_observation_ids: ids });
    if (result.error) throw result.error;
    if (!matches(result.data)) throw new Error("Shadow acknowledgment response does not match this attempt");
    return { status: "acknowledged" as const, receipt: result.data };
  } catch (error) { failure = error; }
  const job = await args.db.from("tweet_pipeline_jobs").select("status,owner,payload").eq("job_key", args.key).maybeSingle();
  if (job.error) throw job.error;
  const receipt = job.data?.payload?.tweetClaimShadowAck;
  if (job.data?.status !== "complete" || job.data.owner !== args.owner || !matches(receipt)) throw failure;
  const raw = await args.db.from(args.table).select("processing_status,raw_payload,tweet_id,received_at").eq("id", args.eventId).maybeSingle();
  if (raw.error) throw raw.error;
  if (raw.data?.processing_status !== "processed" || raw.data.tweet_id !== receipt.tweetId
    || timestampMicros(raw.data.received_at) !== timestampMicros(receipt.receivedAt) || !isDeepStrictEqual(raw.data.raw_payload,
    { ...args.expectedPayload, tweetClaimShadow: receipt.marker })) throw new Error("Raw event disagrees with shadow acknowledgment");
  return { status: "acknowledged" as const, receipt };
}
