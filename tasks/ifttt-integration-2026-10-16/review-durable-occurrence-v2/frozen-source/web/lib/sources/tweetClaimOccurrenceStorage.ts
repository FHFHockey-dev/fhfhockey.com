import { claimCanonicalJson,type TweetClaimEnvelope } from "./tweetClaimExtraction";
import { getPrimaryTextForSource } from "./linesCccIngestion";
import { emptyOccurrenceIdentity,occurrenceIdentityAnchor,planOccurrenceIdentity,
  type OccurrenceIdentityState,type OccurrenceIdentityInput,type OccurrenceIdentityProof } from "./tweetClaimOccurrenceIdentity";

export type TweetClaimOccurrenceContext={
  protocol:"durable-tweet-occurrence-v1";namespace:string;componentIds:string[];
  fingerprint:string|null;state:OccurrenceIdentityState|null;hold:string|null;
};
export type DurableTweetClaimOccurrences=ReturnType<typeof planDurableTweetClaimOccurrences>;

/** Called only inside the existing read/plan/global-CAS transaction protocol. No I/O or effects. */
export function planDurableTweetClaimOccurrences(claims:readonly TweetClaimEnvelope[],context:TweetClaimOccurrenceContext,asOf:string,
  legacyCanonicalState=false){
  if(context?.protocol!=="durable-tweet-occurrence-v1") throw new Error("Durable occurrence protocol unavailable; keep rollout off");
  let state=context.state??emptyOccurrenceIdentity(context.namespace);
  const holds:Array<{observationId:string;reason:string}>=[],bindings:Array<{observationId:string;occurrenceId:string}>=[];
  const globalHold=context.hold??(legacyCanonicalState?"legacy_canonical_state_requires_occurrence_mapping":null);
  if(!globalHold)for(const claim of claims){
    if(!claim.claimAnchor){holds.push({observationId:claim.semantic.id,reason:"lexical_anchor_unresolved"});continue;}
    const attribution=claim.attribution;
    const original=attribution.status==="resolved" && attribution.originalTweetId && attribution.original?.handle && attribution.originalPublishedAt
      ? {tweetId:attribution.originalTweetId,author:attribution.original.handle,publishedAt:attribution.originalPublishedAt}:null;
    const input:OccurrenceIdentityInput={derivationId:claim.semantic.id,receiptId:claim.lineageKey,sourceText:getPrimaryTextForSource(claim.source),
      subjectSpan:claim.claimAnchor.subjectSpan,predicateSpan:claim.claimAnchor.predicateSpan,original};
    const anchor=occurrenceIdentityAnchor(input),pending=state.occurrences.filter(o=>!state.bindings.some(b=>b.occurrenceId===o.id)
      && o.anchors.some(a=>claimCanonicalJson(a)===claimCanonicalJson(anchor)));
    const proof:OccurrenceIdentityProof|undefined=original && pending.length===1?{
      kind:"unique_retained_occurrence",occurrenceId:pending[0]!.id,priorAnchor:pending[0]!.anchors.find(a=>claimCanonicalJson(a)===claimCanonicalJson(anchor))!,
      nextAnchor:anchor,original,knownAt:claim.semantic.interpretedAt,
      basis:"validated original attribution and unique retained receipt/text/subject/predicate"}:undefined;
    const plan=planOccurrenceIdentity(state,input,asOf,proof);
    if(plan.accepted){state=plan.nextState;bindings.push({observationId:claim.semantic.id,occurrenceId:plan.occurrenceId});}
    else holds.push({observationId:claim.semantic.id,reason:plan.reason});
  }
  if(globalHold)for(const claim of claims)holds.push({observationId:claim.semantic.id,reason:globalHold});
  return {protocol:context.protocol,namespace:context.namespace,componentIds:context.componentIds,expectedFingerprint:context.fingerprint,
    asOf,state:globalHold?context.state:state,globalHold,bindings,holds};
}
