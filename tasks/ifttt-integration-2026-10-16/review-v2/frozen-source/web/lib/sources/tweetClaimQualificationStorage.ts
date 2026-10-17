import { claimCanonicalJson, type TweetClaimEnvelope } from "./tweetClaimExtraction";
import { qualifyTweetClaimScope } from "./tweetClaimLineage";
import { planReviewedTweetClaimCompatibility } from "./tweetClaimCompatibility";
import { reduceTweetSemanticEvents } from "./tweetSemanticEvents";

type Rpc = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: any; error: any }> };
async function call(db: Rpc, name: string, args: Record<string, unknown>) {
  const result = await db.rpc(name, args); if (result.error) throw result.error; return result.data;
}
export function immutableTweetClaimPayload(claim: TweetClaimEnvelope) {
  const { interpretedAt: _clock, ...semantic } = claim.semantic;
  return claimCanonicalJson({ ...claim, semantic });
}
export function assertImmutableTweetClaimRetry(retained: TweetClaimEnvelope[], incoming: TweetClaimEnvelope[]) {
  const known = new Map(retained.map(claim => [claim.semantic.id, claim]));
  for (const claim of incoming) {
    const old = known.get(claim.semantic.id);
    if (old && immutableTweetClaimPayload(old) !== immutableTweetClaimPayload(claim)) throw new Error("Immutable claim identity collision");
    known.set(claim.semantic.id, claim);
  }
}

/** Global context CAS serializes cross-scope receipt/origin alignment with raw retention and held effects. */
export async function retainQualifiedTweetClaimScope(db: Rpc, incoming: TweetClaimEnvelope[], asOf: string) {
  const scope = incoming[0]!.scopeKey;
  for (let attempt = 0; attempt < 3; attempt++) {
    const context = await call(db, "read_tweet_claim_context", { p_scope: scope, p_incoming: incoming, p_asof: asOf });
    const snapshot = context.scope, retained = snapshot.observations as TweetClaimEnvelope[];
    assertImmutableTweetClaimRetry(retained, incoming);
    const known = new Map(retained.map(c => [c.semantic.id, c]));
    const added = incoming.filter(c => !known.has(c.semantic.id));
    const all = [...retained, ...added];
    if (all.length > 256) throw new Error("Claim scope capacity exceeded; review required");
    const reduction = reduceTweetSemanticEvents(all.map(c => c.semantic), asOf);
    // The frozen planner rejects source-root upgrades. Keep its last accepted
    // state and explicit rejection while the additive canonical view resolves it.
    let reviewed: any;
    try {
      const plan = planReviewedTweetClaimCompatibility(scope, snapshot.reviewedState, all, asOf);
      reviewed = { state: plan.nextState, holds: plan.holds, noDispatch: true, reviewableEffects: plan.reviewableEffects };
    } catch (error) {
      reviewed = { state: snapshot.reviewedState, holds: [String(error)], noDispatch: true, reviewableEffects: [] };
    }
    const global = new Map((context.observations as TweetClaimEnvelope[]).map(c => [c.semantic.id, c]));
    for (const c of all) if (!global.has(c.semantic.id)) global.set(c.semantic.id, c);
    const qualified = qualifyTweetClaimScope(scope, [...global.values()], context.evidence, context.links, asOf);
    try {
      const committed = await call(db, "commit_qualified_tweet_claim_scope", { p_scope: scope, p_expected: snapshot.version,
        p_clock: context.clock, p_observations: incoming, p_reduction: reduction, p_reviewed: reviewed, p_qualified: qualified });
      if (committed) return { scope, version: Number(snapshot.version) + 1, added: added.length, proposals: reduction.actions.length,
        exceptions: qualified.holds.length + qualified.plan.holds.length, qualifiedProposals: qualified.plan.reviewableEffects.length };
    } catch (error) {
      const after = await call(db, "read_tweet_claim_context", { p_scope: scope, p_incoming: incoming, p_asof: asOf });
      assertImmutableTweetClaimRetry(after.scope.observations, incoming);
      if (Number(after.scope.version) > Number(snapshot.version) && after.qualificationFingerprint === qualified.fingerprint
        && incoming.every(c => after.scope.observations.some((old: TweetClaimEnvelope) => old.semantic.id === c.semantic.id))) {
        return { scope, version: Number(after.scope.version), added: added.length, proposals: reduction.actions.length,
          exceptions: qualified.holds.length + qualified.plan.holds.length, qualifiedProposals: qualified.plan.reviewableEffects.length };
      }
      throw error;
    }
  }
  throw new Error("Claim context contention exceeded three attempts; retry from durable receipt");
}
