import { randomUUID } from "node:crypto";
import { extractDurableTweetClaims, tweetClaimContentHash, claimCanonicalJson, type TweetClaimEnvelope, type TweetClaimGame } from "./tweetClaimExtraction";
import { captureForwardTweetClaimSample } from "./tweetClaimEvaluation";
import { tweetClaimAttribution, type TweetSourceCoverage } from "./tweetSourceDirectory";
import type { ParsedLinesCccSource } from "./linesCccIngestion";
import { failTweetEvents, finishTweetEvents } from "./tweetProcessingJobs";
import { assertImmutableTweetClaimRetry, retainQualifiedTweetClaimScope } from "./tweetClaimQualificationStorage";
import { boundedTweetClaimEvaluationConfig } from "./tweetClaimEvaluationBounds";
import { applyTweetClaimSourceHints } from "./tweetClaimSourceHints";

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }> };
async function rpc(db: RpcClient, name: string, args: Record<string, unknown>) {
  const result = await db.rpc(name, args);
  if (result.error) throw result.error;
  return result.data;
}

/** Bounded optimistic retries handle racing processors and lost commit acknowledgements. */
export async function retainTweetClaimScope(db: RpcClient, incoming: TweetClaimEnvelope[], asOf: string) {
  const scope = incoming[0]?.scopeKey;
  if (!scope || incoming.some(item => item.scopeKey !== scope)) throw new Error("Exactly one claim scope is required");
  for (const item of incoming) if (item.contentHash !== tweetClaimContentHash(item) || item.semantic.id !== `tweet-observation-v2:${item.contentHash}`) {
    throw new Error("Immutable claim payload fingerprint mismatch");
  }
  // Exact full-payload check before any compatibility normalization or omission.
  const snapshot = await rpc(db, "read_tweet_claim_scope", { p_scope: scope });
  assertImmutableTweetClaimRetry(snapshot.observations, incoming);
  return retainQualifiedTweetClaimScope(db, incoming, asOf);
}

/** Actual processor hook. Explicit shadow mode captures evidence and held proposals only. */
export async function persistTweetClaimSources(supabase: any, sources: ParsedLinesCccSource[], asOf = new Date().toISOString()) {
  if (process.env.TWEET_CLAIMS_MODE !== "shadow") return { skipped: true as const, scopes: [] };
  if (sources.length > 25) throw new Error("Claim capture is limited to 25 source candidates per pass");
  const cohort = boundedTweetClaimEvaluationConfig();
  if (cohort) await rpc(supabase, "register_bounded_tweet_claim_evaluation", { p_id: cohort.id, p_start: cohort.startsAt, p_end: cohort.endsAt, p_max: cohort.maxSamples, p_version: cohort.extractionVersion });
  const ids = [...new Set(sources.flatMap(source => source.gameId ? [source.gameId] : []))];
  const handles = [...new Set(sources.flatMap(source => {
    const identity = tweetClaimAttribution(source);
    return [identity.original?.handle, identity.quoted?.handle].filter((handle): handle is string => Boolean(handle));
  }))];
  let games: TweetClaimGame[] = [], directory: TweetSourceCoverage[] = [];
  if (ids.length) {
    const result = await supabase.from("games").select("id,date,startTime,homeTeamId,awayTeamId").in("id", ids);
    if (result.error) throw result.error;
    games = result.data ?? [];
  }
  if (handles.length) {
    const result = await supabase.from("tweet_source_coverage").select("payload").in("handle", handles).limit(100);
    if (result.error) throw result.error;
    if (result.data?.length === 100) throw new Error("Source directory scope exceeds bounded lookup; review required");
    directory = (result.data ?? []).map((row: any) => row.payload);
  }
  const groups = new Map<string, TweetClaimEnvelope[]>();
  const receipts = new Map<string, TweetClaimEnvelope[]>();
  const hinted = await applyTweetClaimSourceHints(supabase, sources, directory, games, asOf);
  games = hinted.games;
  for (const source of hinted.sources) {
    const claims = extractDurableTweetClaims({ source, game: games.find(game => game.id === source.gameId) ?? null, interpretedAt: asOf, directory });
    for (const claim of claims) receipts.set(claim.lineageKey, [...(receipts.get(claim.lineageKey) ?? []), claim]);
    for (const claim of claims) groups.set(claim.scopeKey, [...(groups.get(claim.scopeKey) ?? []), claim]);
  }
  if (cohort) for (const claims of receipts.values()) {
    const sample = captureForwardTweetClaimSample(claims, cohort, asOf);
    if (sample && Date.parse(asOf) < Date.parse(cohort.endsAt)) for (const claim of claims) claim.evaluation = sample;
  }
  const scopes = [];
  for (const claims of groups.values()) {
    if (cohort) {
      const prior = await rpc(supabase, "read_tweet_claim_scope", { p_scope: claims[0]!.scopeKey });
      for (const claim of claims) {
        const old = (prior.observations as TweetClaimEnvelope[]).find(item => item.semantic.id === claim.semantic.id);
        if (!old) continue;
        // Capture predictions once. Reprocessing must reuse the first frozen
        // sample instead of refreshing its admission clock or adding it later.
        const withoutClock = (value: Record<string, unknown> | undefined) => {
          if (!value) return null;
          const { capturedAt: _time, ...rest } = value; return rest;
        };
        if (!claim.evaluation || claimCanonicalJson(withoutClock(old.evaluation)) === claimCanonicalJson(withoutClock(claim.evaluation))) claim.evaluation = old.evaluation;
      }
    }
    scopes.push(await retainTweetClaimScope(supabase, claims, asOf));
  }
  return { skipped: false as const, scopes };
}

/** End the shadow lane before any legacy snapshots, consumers or review email. */
export async function processTweetClaimShadowBatch(args: {
  supabase: any; table: "line_source_ifttt_events" | "lines_ccc_ifttt_events";
  sources: ParsedLinesCccSource[]; events: Array<{ id: string; raw_payload: Record<string, unknown> }>;
  pendingEvents: Array<{ id: string }>;
  deferredUpdates: Array<{ id: string; processing_status: string; raw_payload: Record<string, unknown>; updated_at: string }>;
}) {
  const capturedAt = new Date().toISOString();
  const capture = await persistTweetClaimSources(args.supabase, args.sources, capturedAt);
  const processed = [...new Map(args.events.map(event => [event.id, event])).values()];
  for (const event of processed) {
    const write = await args.supabase.from(args.table).update({ processing_status: "processed", updated_at: capturedAt,
      raw_payload: { ...event.raw_payload, tweetClaimShadow: { capturedAt, lane: "shadow", delivery: "not_requested" } } }).eq("id", event.id);
    if (write.error) throw write.error;
  }
  for (const update of args.deferredUpdates) {
    const { id, ...values } = update;
    const write = await args.supabase.from(args.table).update(values).eq("id", id);
    if (write.error) throw write.error;
  }
  await finishTweetEvents(args.supabase, args.pendingEvents.filter(event => processed.some(done => done.id === event.id)));
  await failTweetEvents(args.supabase, args.pendingEvents, "enrichment_deferred");
  // Raw processing completion means evidence retained, never delivery confirmed.
  // Later legacy replay requires an explicit separate decision, not flag fallback.
  return { mode: "claim_shadow", capture, eventsProcessed: processed.length, eventsDeferred: args.deferredUpdates.length, delivery: "not_requested" };
}

export type TweetClaimSink = {
  /** A sink must durably enforce the exact action key, including concurrent sends. */
  idempotency: "durable_action_key";
  send: (key: string, payload: unknown) => Promise<{ status: "applied"; receipt: unknown } | { status: "not_applied" | "unknown" }>;
  reconcile: (key: string) => Promise<{ status: "applied"; receipt: unknown } | { status: "not_applied" | "unknown" }>;
};

/** Never called by ingestion. A future approved worker supplies an idempotent sink. */
export async function deliverTweetClaim(args: { db: RpcClient; key: string; sink: TweetClaimSink; enabled?: boolean }) {
  if (!args.enabled) return { status: "disabled" as const };
  if (args.sink.idempotency !== "durable_action_key") throw new Error("Durable sink idempotency is required");
  const owner = randomUUID();
  const reservation = await rpc(args.db, "claim_tweet_claim_delivery", { p_key: args.key, p_owner: owner });
  if (!reservation) return { status: "held_or_busy" as const };
  let outcome: Awaited<ReturnType<TweetClaimSink["send"]>>, error: string | null = null;
  try {
    outcome = reservation.mode === "reconcile" ? await args.sink.reconcile(args.key) : await args.sink.send(args.key, reservation.payload);
  } catch (failure) {
    outcome = { status: "unknown" }; error = failure instanceof Error ? failure.message : String(failure);
  }
  const acknowledged = await rpc(args.db, "settle_tweet_claim_delivery", { p_key: args.key, p_owner: owner, p_outcome: outcome.status,
    p_receipt: outcome.status === "applied" ? outcome.receipt : null, p_error: error });
  return { status: acknowledged ? outcome.status : "ownership_lost", mode: reservation.mode };
}
