import { randomUUID } from "node:crypto";
import { persistTweetProjectionReports } from "./tweetProjectionStorage";
import { claimHash } from "./tweetClaimExtraction";
import type { ParsedLinesCccSource } from "./linesCccIngestion";
import { tweetPipelineFlags } from "./tweetInterpretation";

// No route, ingestion handler or scheduler activates this boundary. A future
// approved worker supplies an existing action and exact retained proof.
type Db = { from: (table: string) => any; rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }> };
export type TweetForecastConsumerPlan = { version: "tweet-forecast-consumer-v1"; parent: Record<string, any>;
  snapshot: Record<string, any>; assignments: Record<string, any>[]; queues: Record<string, any>[] };
export type TweetForecastPriorProof = { status: "verified_not_dispatched" | "unknown" | "verified_delivered";
  basis: string; retentionEvidence: string; writerFenceEvidence: string; knownAt: string;
  effectId: string; transitionId: string; planHash: string };
async function rpc(db: Db, name: string, args: Record<string, unknown>) {
  const result = await db.rpc(name, args); if (result.error) throw result.error; return result.data;
}

/** Use the real producer AND forecast consumer to freeze their exact write plan.
 * Only the consumer RPCs are recorded; producer parent/report writes still use
 * the existing exact readback path. Schedule reads remain real and bounded.
 */
export async function prepareTweetClaimForecastDelivery(args: { db: Db; source: ParsedLinesCccSource; enabled?: boolean }) {
  if (!args.enabled) return { status: "disabled" as const };
  if (process.env.TWEET_CLAIMS_MODE === "shadow" || !tweetPipelineFlags().publishing) throw new Error("Forecast consumer planning requires the explicit publishing lane");
  const captures: Array<{ snapshot: any; assignments: any[] }> = [], queues: any[] = [];
  const allowedTables = new Set(["tweet_projection_reports", "tweet_player_events", "line_source_snapshots", "lines_ccc", "games", "roster_optimizer_team_games"]);
  const planningDb = { from: (table: string) => {
    if (!allowedTables.has(table)) throw new Error(`Unexpected forecast plan relation: ${table}`); return args.db.from(table);
  }, rpc: async (name: string, values: Record<string, any>) => {
    if (name === "capture_starter_board_lineup") {
      captures.push({ snapshot: values.p_snapshot, assignments: values.p_assignments });
      return { data: { snapshotId: null, insertedSnapshot: false, insertedAssignments: 0 }, error: null };
    }
    if (name === "enqueue_player_forecast_job") { queues.push(values); return { data: null, error: null }; }
    throw new Error(`Unexpected forecast plan write: ${name}`);
  } };
  await persistTweetProjectionReports(planningDb, [args.source]);
  if (captures.length !== 1 || captures[0]!.snapshot.classification !== "injury" || !captures[0]!.assignments.length
    || !queues.length || queues.length > 10 || new Set(queues.map(q => q.p_scope_key)).size !== queues.length) throw new Error("Exactly one supported injury capture and bounded queue plan are required");
  const capture = captures[0]!;
  const parent = await args.db.from("line_source_snapshots").select("*").eq("capture_key", capture.snapshot.source_capture_key);
  if (parent.error) throw parent.error;
  if (parent.data?.length !== 1) throw new Error("Exact forecast parent readback required");
  const plan: TweetForecastConsumerPlan = JSON.parse(JSON.stringify({ version: "tweet-forecast-consumer-v1", parent: parent.data[0],
    snapshot: capture.snapshot, assignments: capture.assignments, queues: queues.sort((a, b) => a.p_scope_key.localeCompare(b.p_scope_key)) }));
  return { status: "prepared" as const, plan, planHash: claimHash(plan) };
}

/** Register a bounded, already-retained action; never allocate or rename IDs.
 * Proofs describe complete retained transport history, not a current empty read.
 */
export async function bindTweetClaimForecastDelivery(args: { db: Db; key: string; transitionId: string;
  plan: TweetForecastConsumerPlan; proof: TweetForecastPriorProof; enabled?: boolean }) {
  if (!args.enabled) return { status: "disabled" as const };
  const planHash = claimHash(args.plan);
  if (!args.proof.effectId || args.proof.transitionId !== args.transitionId || args.proof.planHash !== planHash) throw new Error("Exact retained forecast action proof required");
  return rpc(args.db, "bind_tweet_claim_forecast_delivery", { p_key: args.key, p_transition: args.transitionId,
    p_plan: args.plan, p_hash: planHash, p_proof: args.proof });
}

/** Reconciliation precedes any new lease, including for expired historical
 * sources. New application is always checked against the real DB clock.
 */
export async function recoverTweetClaimForecastDelivery(args: { db: Db; key: string; enabled?: boolean }) {
  if (!args.enabled) return { status: "disabled" as const };
  const prior = await rpc(args.db, "read_tweet_claim_forecast_delivery", { p_key: args.key });
  if (!prior) return { status: "unknown" as const, holdReasons: ["retained_action_binding_missing"] };
  const identity = { effectId: prior.effectId, transitionId: prior.transitionId };
  if (prior.status === "applied") {
    await rpc(args.db, "acknowledge_tweet_claim_forecast_delivery", { p_key: args.key });
    return { ...identity, status: "applied" as const, receipt: prior.receipt, resendPlanCount: 0 };
  }
  if (prior.status !== "not_applied") return { ...identity, status: "unknown" as const, holdReasons: ["delivery_outcome_unknown"], resendPlanCount: 0 };
  const owner = randomUUID();
  const reservation = await rpc(args.db, "claim_tweet_claim_delivery", { p_key: args.key, p_owner: owner });
  if (!reservation) return { ...identity, status: "held" as const, resendPlanCount: 0 };
  if (reservation.mode === "reconcile") {
    // The atomic consumer has no committed partial effect without a receipt.
    // Positive retained coverage must already have established not_applied.
    await rpc(args.db, "settle_tweet_claim_delivery", { p_key: args.key, p_owner: owner, p_outcome: "not_applied", p_receipt: null, p_error: null });
    return { ...identity, status: "retry_ready" as const, resendPlanCount: 0 };
  }
  try {
    const receipt = await rpc(args.db, "apply_tweet_claim_forecast_delivery", { p_key: args.key, p_owner: owner });
    const settled = await rpc(args.db, "settle_tweet_claim_delivery", { p_key: args.key, p_owner: owner, p_outcome: "applied", p_receipt: receipt, p_error: null });
    if (!settled) await rpc(args.db, "acknowledge_tweet_claim_forecast_delivery", { p_key: args.key });
    return { ...identity, status: "applied" as const, receipt, resendPlanCount: 0 };
  } catch (error) {
    // A thrown response can mean commit happened. Exact durable readback is
    // required; a failed readback propagates without resending anything.
    const retained = await rpc(args.db, "read_tweet_claim_forecast_delivery", { p_key: args.key });
    if (retained?.status === "applied") {
      await rpc(args.db, "acknowledge_tweet_claim_forecast_delivery", { p_key: args.key });
      return { ...identity, status: "applied" as const, receipt: retained.receipt, resendPlanCount: 0 };
    }
    await rpc(args.db, "settle_tweet_claim_delivery", { p_key: args.key, p_owner: owner, p_outcome: "unknown", p_receipt: null, p_error: String(error) });
    return { ...identity, status: "unknown" as const, holdReasons: ["delivery_outcome_unknown"], resendPlanCount: 0 };
  }
}
