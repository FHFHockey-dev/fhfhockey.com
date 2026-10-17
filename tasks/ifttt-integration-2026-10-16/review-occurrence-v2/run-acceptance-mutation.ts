/** Task-local pure DSL adapter. No application/source/SQL file is modified. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { emptySourceClaimRegistry, planSourceClaims, sourceClaimSemanticFingerprint,
  sourceClaimTextVersionId, legacyClaimPayloadFingerprint } from "../../../web/lib/sources/tweetSourceClaimRegistry";
import { reduceTweetSemanticEvents } from "../../../web/lib/sources/tweetSemanticEvents";
import { qualifiedFixture } from "../../../web/lib/sources/fixtures/tweetClaimQualificationFixture";
import { qualifyTweetClaimScope } from "../../../web/lib/sources/tweetClaimLineage";
import { claimHash } from "../../../web/lib/sources/tweetClaimExtraction";
import { tweetClaimAttribution } from "../../../web/lib/sources/tweetSourceDirectory";
import { emptyOccurrenceIdentity,occurrenceIdentityAnchor,planOccurrenceIdentity,
  type OccurrenceIdentityInput,type OccurrenceIdentityProof } from "../../../web/lib/sources/tweetClaimOccurrenceIdentity";
import { snapshotImmutableRegistry,changedPriorImmutableRows } from "./immutable-registry-audit";

const canonical = (v: any): string => v && typeof v === "object"
  ? Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`
  : JSON.stringify(v);
const hash = (v: any) => createHash("sha256").update(canonical(v)).digest("hex");
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const span = (v: any) => ({ start: v.start, end: v.end, text: v.text });
const rule = { ruleId: "availability", ruleVersion: "fixture-v1", effectType: "game_availability" };
const fixturePath = join(__dirname,"../handoff/extracted-reviewed/ifttt-claim-replay-tests-2026-10-15/acceptance-cases.json");
const fixtureBytes = readFileSync(fixturePath);
const spec = JSON.parse(fixtureBytes.toString());
const identityCandidate=process.argv.includes("--occurrence-identity-candidate");
const mutationControl=process.argv.includes("--mutation-control");
const mutationTargets:Array<{caseId:string;interpretationVersionId:string}>=[];

// These fixture preconditions have no faithful projection into the pure r3 API.
// Do not invent source authority, preloaded records or delivery results to score them.
const unsupported: Record<string,string> = {};

function project(record: any, records: any[]) {
  const raw = clone(record); delete raw.recordId;
  const id = `dsl-derivation:${hash(raw)}`;
  const i = record.interpretation, t = record.time, s = record.source;
  const scope = i.scope.status === "known" ? { kind: "game", teamId: i.scope.teamId, gameId: i.scope.gameId,
    phase: i.scope.phase, group: i.scope.group } : null;
  const fact = i.fact?.kind === "availability" && ["out","available"].includes(i.fact.status) ? clone(i.fact) : null;
  const original = { tweetId: s.originalId, author: s.originalAuthor, publishedAt: t.originalPublishedAt };
  const target = (label: string) => { const r = records.find(r => r.recordId === label); if (!r) throw new Error(`Missing fixture relation ${label}`); const payload=clone(r);delete payload.recordId;return `dsl-derivation:${hash(payload)}`; };
  const observation: any = { id, reportId: `dsl-report:${hash([s.retainedSourceId,record.sourceText])}`,sourceKey: s.namespace,
    original,wrapper: s.relayId && t.wrapperPublishedAt ? { tweetId: s.relayId,publishedAt: t.wrapperPublishedAt } : null,
    receivedAt: t.receivedAt,interpretedAt: t.interpretedAt,evidence: span(record.occurrence.governingClauseSpan),scope,fact,
    effectiveAt: t.effectiveAt,modality: i.modality,
    support: i.validation.status === "supported" ? { status: "supported",basis: i.validation.basis,validUntil: t.validUntil }
      : { status: "pending",reason: i.validation.basis },
    relation: i.relation ? { kind: i.relation.kind,targetObservationIds: [...(i.relation.targetRecordIds ?? []).map(target),...(i.relation.targetSourceClaimIds ?? [])] } : null };
  const verified = s.provenanceVerification === "synthetic_verified";
  const root: any = verified ? { sourceRootId: `dsl-original:${s.originalId}:${s.originalAuthor.toLowerCase()}`,
    originalTweetId: s.originalId,originalAuthor: s.originalAuthor,verification: { status: "verified",basis: "explicit synthetic fixture precondition" } }
    : { sourceRootId: `dsl-retained:${s.retainedSourceId}`,retainedSourceId: s.retainedSourceId,
      originalTweetId: s.originalId,originalAuthor: s.originalAuthor,verification: { status: "pending",reason: s.provenanceVerification } };
  const interpretation: any = { parserVersion: i.ruleVersion,resolverVersion: "fixture-prebound-v1",
    subject: { playerId: i.subject.status === "known" ? i.subject.playerId : null,teamId: i.subject.status === "known" ? i.subject.teamId : null },
    scope: scope ? { kind: "game",gameId: scope.gameId,teamId: scope.teamId,date: t.effectiveAt.slice(0,10) } : null,
    fact: fact ? { kind: "availability",status: fact.status } : null,
    polarity: i.polarity === "affirmed" ? "positive" : i.polarity === "negated" ? "negative" : "unknown",
    assertionStrength: i.assertionStrength,
    validation: i.validation.status === "supported" ? { status: "supported",basis: i.validation.basis }
      : { status: "pending",reason: i.validation.basis } };
  const times = { originalPublishedAt: t.originalPublishedAt,wrapperPublishedAt: t.wrapperPublishedAt,
    receivedAt: t.receivedAt,interpretedAt: t.interpretedAt,effectiveAt: t.effectiveAt,validUntil: t.validUntil };
  return { observation,root,interpretation,times };
}

const normalizedHold = (reason: string) => ({
  legacy_or_prior_effect_history_unknown: "legacy_delivery_unknown",
  material_qualified_reinterpretation_requires_resolution: "material_rebind_after_effect",
  modality_not_actionable: "assertion_strength_not_verified",
  outside_reporting_cutoff: "outside_cutoff",
}[reason] ?? reason);

function dedicated(c:any){
  const r=c.records[0],p=project(r,c.records),asOf=c.steps.find((s:any)=>s.asOf).asOf;
  if(c.id==="CR015"){
    // Explicit precondition supplies an already accepted unrelated scope. Its arbitrary
    // synthetic fact is isolated; the test compares the exact retained scenario before/after.
    const text="Synthetic retained unrelated availability.";
    const unrelated={...clone(p.observation),id:`dsl-unrelated:${hash(c.preconditions)}`,wrapper:null,
      evidence:{start:0,end:text.length,text},scope:{...p.observation.scope,gameId:c.preconditions.unrelatedAcceptedScenarioGameId},
      fact:{kind:"availability",playerId:r.interpretation.subject.playerId,status:"out"},relation:null};
    const before=reduceTweetSemanticEvents([unrelated],asOf),after=reduceTweetSemanticEvents([unrelated,p.observation],asOf);
    const key=before.scenarios[0]?.key,prior=before.scenarios[0],current=after.scenarios.find((s:any)=>s.key===key);
    const held=after.associations.find((a:any)=>a.observationIndex===1);
    return {records:{},result:{newEffectProposalCount:after.actions.filter((a:any)=>a.scenarioKey!==key).length,
      unrelatedAcceptedScenarioChanged:!isDeepStrictEqual(prior,current),
      holdReasons:held?.reason && /relation|target_unresolved/.test(held.reason)?["relation_target_unresolved_or_scope_mismatch"]:[held?.reason]},rawHold:held};
  }
  const f=qualifiedFixture(),source:any={...f.source,rawText:r.sourceText.text,tweetId:r.source.retainedOriginalId??r.source.originalId,
    sourceUrl:`https://x.com/${r.source.originalAuthor}/status/${r.source.claimedOriginalId??r.source.originalId}`,
    tweetPostedAt:r.time.originalPublishedAt,observedAt:r.time.receivedAt};
  const claim:any={...f.claims[0],lineageKey:`dsl-retained:${r.source.retainedSourceId}`,semantic:p.observation,source,
    attribution:tweetClaimAttribution(source),claimAnchor:{subjectSpan:span(r.occurrence.subjectSpan),predicateSpan:span(r.occurrence.predicateSpan)}};
  const link={receipt:claim.lineageKey,originId:r.source.originalId,author:r.source.originalAuthor.toLowerCase(),
    publishedAt:r.time.originalPublishedAt,textHash:claimHash(r.sourceText.text)};
  // Two explicit synthetic candidate identities realize the declared cardinality;
  // neither candidate is selected or treated as a genuine platform identity.
  const links=c.id==="CR029"?[link,{...link,originId:r.source.relayId}]:[];
  const q=qualifyTweetClaimScope(claim.scopeKey,[claim],f.evidence,links,asOf);
  const actual=q.holds.map((h:any)=>h.reason);
  return {records:{},result:{newEffectProposalCount:q.plan.reviewableEffects.length,parentPublishPlanCount:q.plan.dispatchInstructions.length,
    autoAliasCount:q.bindings.length,holdReasons:actual.map((reason:string)=>reason==="original_lineage_evidence_conflict"?"source_lineage_ambiguous"
      :reason==="original_lineage_unresolved"&&r.source.claimedOriginalId!==r.source.retainedOriginalId?"retained_original_identity_conflict":reason)},rawHolds:actual,
    normalization:"Actual provenance/qualification preflight; synthetic retained context only, no database or source acquisition."};
}

function execute(c: any, order?: string[]) {
  const before = canonical(c), byId = new Map(c.records.map((r: any) => [r.recordId,r]));
  const sequence = (order ?? c.steps.filter((s: any) => s.op === "ingest").map((s: any) => s.recordId)).map((id: string) => byId.get(id));
  const asOf = c.steps.find((s: any) => s.asOf)?.asOf;
  const projected = c.records.map((r: any) => project(r,c.records));
  const get = (r: any) => projected[c.records.indexOf(r)];
  const useIdentity=identityCandidate && c.records.some((r:any)=>!r.source.originalId) && c.records.some((r:any)=>r.source.originalId);
  let identityState=emptyOccurrenceIdentity(`dsl-identity:${c.id}`);
  let registry: any = emptySourceClaimRegistry(`dsl:${c.id}`), reduction: any;
  const outputs: any = {}, proposals: any[] = [], allHolds = new Set<string>();
  let firstEffectTimes: any = null,lastPlan: any=null,occurrenceBeforeForcedReuse: any=null;
  const immutableReplacements=new Set<string>();
  const apply = (record: any, active: any[], cutoff: string) => {
    const priorImmutable=snapshotImmutableRegistry(registry,useIdentity?identityState:undefined);
    const p = get(record), index = active.findIndex(r => r === record);
    reduction = reduceTweetSemanticEvents(active.map(r => get(r).observation),cutoff);
    const a = reduction.associations[index], scenario = reduction.scenarios.find((s: any) => s.key === a.scenarioKey);
    const association = { scenarioId: a.scenarioKey ?? `dsl-pending:${hash([p.interpretation.subject,p.interpretation.scope])}`,
      revisionId: a.revisionKey ?? `dsl-pending-revision:${hash(p.interpretation)}`,
      disposition: scenario?.status === "accepted" && ["accepted","corroboration","replay"].includes(a.disposition)
        ? a.disposition === "accepted" ? "initial_acceptance" : "corroboration" : a.disposition === "conflict" ? "conflict" : "pending" };
    const textVersion = sourceClaimTextVersionId(p.root.sourceRootId,record.sourceText.text);
    const candidate: any = { subjectSpan: span(record.occurrence.subjectSpan),predicateSpan: span(record.occurrence.predicateSpan),
      evidence: { representationVersion: record.evidence.ruleVersion,governingClauseSpan: span(record.occurrence.governingClauseSpan),
        displaySpans: [span(record.evidence.displaySpan)],contextSpans: record.occurrence.contextSpans.map(span) },
      interpretation: p.interpretation,association,times: p.times,legacyRefs: [] };
    const oldClaim = registry.claims.find((claim: any) => claim.sourceRootId === p.root.sourceRootId);
    if (oldClaim && !oldClaim.anchors.some((anchor: any) => anchor.sourceTextVersionId === textVersion)
      && c.preconditions.sourceTextVariantProof && record.occurrence.alignmentProof.includes("unique_1_to_1"))
      candidate.alignment = { kind: "verified_one_to_one",sourceClaimId: oldClaim.sourceClaimId,sourceRootId: p.root.sourceRootId,
        priorAnchor: oldClaim.anchors[0],basis: c.preconditions.sourceTextVariantProof };
    const retainedMultiplicity=record.occurrence.candidateRetainedOccurrences?.length ?? record.occurrence.legacyOccurrences?.length;
    if(retainedMultiplicity && oldClaim && registry.claims.length<retainedMultiplicity){
      // Explicit synthetic precondition: two already-retained allocations with the same exact anchor.
      while(registry.claims.length<retainedMultiplicity){const token=registry.nextOccurrenceToken++;registry.claims.push({...clone(oldClaim),
        sourceClaimId:`${oldClaim.sourceRootId}:occurrence:${token}`,occurrenceToken:token});}
    }
    if(record.forcedIdentityReuse){
      const id=outputs[record.forcedIdentityReuse.fromRecordId]?.sourceClaimId;
      const target=registry.claims.find((claim:any)=>claim.sourceClaimId===id);occurrenceBeforeForcedReuse=clone(target);
      candidate.alignment={kind:"verified_one_to_one",sourceRootId:p.root.sourceRootId,sourceClaimId:id,priorAnchor:target.anchors[0],basis:"explicit adversarial fixture attempts cross-root reuse"};
    }
    if (record.legacy && record.legacy.keyEvidence !== "diagnostic_only_not_retained_historical_identity") {
      for (const [field,kind] of [["reportKey","report"],["eventKey","event"],["captureKey","capture"]]) if (record.legacy[field]) {
        const ref: any = { kind,key: record.legacy[field],payload: { key: record.legacy[field],immutablePayloadHash: record.legacy.immutablePayloadHash } };
        if (c.preconditions.verifiedLegacyMapping === "unique_1_to_1" || c.preconditions.positivePriorNonDeliveryProof)
          ref.bindingProof = { sourceRootId: p.root.sourceRootId,anchor: { sourceTextVersionId: textVersion,subjectSpan: candidate.subjectSpan,predicateSpan: candidate.predicateSpan },basis: "explicit synthetic fixture mapping" };
        candidate.legacyRefs.push(ref);
      }
    }
    const coveredLegacyRefs = candidate.legacyRefs.map((ref: any) => ({ kind: ref.kind,key: ref.key,payloadFingerprint: legacyClaimPayloadFingerprint(ref.payload) }));
    const prior = c.preconditions.durablePriorEffect;
    candidate.effectHistory = prior === "verified_absent" ? { status: "known_clear",basis: "explicit synthetic fixture absence; no live proof",coveredLegacyRefs }
      : prior === "verified_delivered" && (!c.preconditions.existingAcceptedRecord || record.recordId === c.preconditions.existingAcceptedRecord)
        ? { status: "committed",effectKey: c.preconditions.durableEffectReceipt?.effectId ?? "fixture-effect-1",scenarioId: association.scenarioId,
          semanticFingerprint: sourceClaimSemanticFingerprint(p.interpretation,p.times.effectiveAt),acceptedTimes: p.times,basis: "explicit synthetic delivered fixture",coveredLegacyRefs }
        : { status: "unknown",reason: "no synthetic committed receipt for this interpretation" };
    const claims=record.occurrence.candidateOccurrences ? record.occurrence.candidateOccurrences.map(()=>clone(candidate)) : [candidate];
    const result = planSourceClaims(registry,{ source: p.root,sourceTextVersionId: textVersion,sourceText: record.sourceText.text,
      asOf: cutoff,rule,claims });
    lastPlan=result;
    registry = JSON.parse(JSON.stringify(result.nextRegistry));
    // SAME REVIEW NEGATIVE CONTROL AS V1: deliberately rewrite the earlier held row.
    if(c.id === "CR019" && record.source.provenanceVerification === "synthetic_verified") {
      const prior = registry.interpretationVersions.find((v: any) => v.interpretation.validation.status === "pending");
      if(!prior) throw new Error("Reviewer mutation target missing");
      prior.interpretation.parserVersion = "REVIEW_DELIBERATE_OLD_ROW_REWRITE";
      console.log("REVIEW_MUTATION",JSON.stringify({caseId:c.id,rowId:prior.interpretationVersionId,row:prior}));
    }

    // Explicit negative-control run only: prove that the unchanged oracle detects an old row rewrite.
    if(mutationControl && useIdentity && record.source.provenanceVerification==="synthetic_verified"){
      const prior=registry.interpretationVersions.find((v:any)=>v.interpretation.validation.status==="pending");
      if(prior){prior.interpretation.parserVersion="DELIBERATE_NEGATIVE_CONTROL_OLD_ROW_REWRITE";
        mutationTargets.push({caseId:c.id,interpretationVersionId:prior.interpretationVersionId});}
    }
    proposals.push(...result.proposals);
    for (const proposal of result.proposals) if (proposal.kind === "hold") allHolds.add(proposal.reason === "validation_not_supported"
      && /uncertain|uncertainty/.test(record.interpretation.validation.basis) ? "assertion_strength_not_verified" : proposal.reason);
    const link: any = result.proposals.find(p => p.kind === "record_evidence");
    let stableIdentity: string|null=link?.sourceClaimId??null;
    if(useIdentity){
      const request:OccurrenceIdentityInput={derivationId:p.observation.id,receiptId:record.source.retainedSourceId,sourceText:record.sourceText.text,
        subjectSpan:span(record.occurrence.subjectSpan),predicateSpan:span(record.occurrence.predicateSpan),
        original:record.source.provenanceVerification==="synthetic_verified"?{tweetId:record.source.originalId,author:record.source.originalAuthor,publishedAt:record.time.originalPublishedAt}:null};
      const anchor=occurrenceIdentityAnchor(request),pending=identityState.occurrences.filter(o=>!identityState.bindings.some(b=>b.occurrenceId===o.id)
        && o.anchors.some(a=>canonical(a)===canonical(anchor)));
      const proof:OccurrenceIdentityProof|undefined=request.original && pending.length===1 && c.preconditions.resolutionProof==="unique_retained_relay_to_original_mapping"
        ? {kind:"unique_retained_occurrence",occurrenceId:pending[0]!.id,priorAnchor:pending[0]!.anchors[0]!,nextAnchor:anchor,
          original:request.original,knownAt:record.time.interpretedAt,basis:c.preconditions.resolutionProof}:undefined;
      const identity=planOccurrenceIdentity(identityState,request,cutoff,proof);identityState=identity.nextState;
      stableIdentity=identity.accepted && link ? identity.occurrenceId : null;
    }
    for(const key of changedPriorImmutableRows(priorImmutable,snapshotImmutableRegistry(registry,useIdentity?identityState:undefined)))
      immutableReplacements.add(key);
    const effect = registry.effects.find((effect: any) => effect.scenarioId === association.scenarioId && effect.revisionId === association.revisionId);
    outputs[record.recordId] = { ...clone(record),sourceClaimId: stableIdentity,nativeSourceClaimId:link?.sourceClaimId??null,evidenceVersionId: link?.evidenceVersionId ?? null,
      interpretationVersionId: link?.interpretationVersionId ?? null,resolvedSemantics: sourceClaimSemanticFingerprint(p.interpretation,p.times.effectiveAt),
      scenarioId: a.scenarioKey,scenarioRevisionId: a.revisionKey,effectId: effect?.effectKey ?? null,
      sharedPredicateSpan: candidate.predicateSpan,initialAcceptanceProposalCount: result.proposals.filter(p => p.kind === "propose_effect").length };
    if (!firstEffectTimes && registry.effects.length) firstEffectTimes=clone(registry.effects[0].acceptedTimes);
  };
  // Explicit delivered preconditions preload an isolated pure ledger, never a real receipt.
  const existing = c.preconditions.existingAcceptedRecord;
  if (existing) { const record:any=byId.get(existing);apply(record,[record],get(record).times.interpretedAt); }
  if (c.id === "CR026") apply(sequence[0],[sequence[0]],get(sequence[0]).times.interpretedAt);
  for (const record of sequence) apply(record,sequence,asOf);
  reduction = reduceTweetSemanticEvents(sequence.map((r: any) => get(r).observation),asOf);
  const eligible = registry.effects.filter((e: any) => e.status === "reserved" && e.disputeStatus === "clear"
    && reduction.actions.some((a: any) => a.scenarioKey === e.scenarioId && a.revisionKey === e.revisionId));
  const unchangedClocks = Boolean(firstEffectTimes) && isDeepStrictEqual(firstEffectTimes,registry.effects[0]?.acceptedTimes);
  const evidenceExact = registry.evidenceVersions.length>0 && registry.evidenceVersions.every((v: any) => {
    const text = registry.sourceTexts.find((t: any) => t.sourceTextVersionId === v.anchor.sourceTextVersionId)?.text;
    return [v.anchor.subjectSpan,v.anchor.predicateSpan,v.evidence.governingClauseSpan,...v.evidence.displaySpans,...v.evidence.contextSpans]
      .every((s: any) => typeof text === "string" && text.slice(s.start,s.end) === s.text);
  });
  const finalHolds=lastPlan?.accepted === false ? lastPlan.proposals.filter((p:any)=>p.kind==="hold").map((p:any)=>p.reason) : [...allHolds];
  const normalize=(reason:string)=> reason==="ambiguous_occurrence_alignment" ? c.preconditions.verifiedLegacyMapping===false ? "occurrence_split_or_merge_ambiguous" : "occurrence_alignment_ambiguous"
    : ["duplicate_or_split_occurrence_alignment","split_merge_alignment_held"].includes(reason) ? "occurrence_split_or_merge_ambiguous" : normalizedHold(reason);
  const result = { sourceClaimCount: registry.claims.length,evidenceVersionCount: registry.evidenceVersions.length,
    initialAcceptanceProposalCount: eligible.length,newEffectProposalCount: eligible.length,
    totalUniqueEffectIdentityCount: new Set(registry.effects.map((e: any) => e.effectKey)).size,
    effectId: registry.effects.length === 1 ? registry.effects[0].effectKey : null,
    immutableRowReplacementCount: immutableReplacements.size,
    legacyKeysUnchanged: canonical(c) === before && registry.legacyRows.every((row: any) => sequence.some((r: any) => r.legacy
      && [r.legacy.reportKey,r.legacy.eventKey,r.legacy.captureKey].includes(row.key))),
    allEvidenceSpansExact: evidenceExact,holdReasons: [...new Set(finalHolds.map(normalize))].sort(),
    autoAliasCount: registry.alignments.filter((a:any)=>a.alignment.kind==="verified_one_to_one").length,
    identityCollision: finalHolds.includes("alignment_target_invalid_or_conflicting"),
    originalOccurrenceRecordUnchanged: Boolean(occurrenceBeforeForcedReuse) && isDeepStrictEqual(occurrenceBeforeForcedReuse,
      registry.claims.find((claim:any)=>claim.sourceClaimId===occurrenceBeforeForcedReuse.sourceClaimId)),
    scenarioCount: reduction.scenarios.length,scenarioStatus: reduction.scenarios[0]?.status ?? "pending",
    supportedOriginCount: new Set(reduction.scenarios.flatMap((s: any) => s.revisions.flatMap((r: any) => r.supportedOrigins.map((o: any) => o.originalTweetId)))).size,
    firstAcceptanceClocksUnchanged: unchangedClocks,firstAcceptanceValidUntil: registry.effects[0]?.acceptedTimes.validUntil ?? null,
    conflictRetained: reduction.scenarios.some((s: any) => s.status === "unresolved"),
    contraryEvidenceDiscarded: sequence.some((r: any) => !reduction.associations.some((a: any) => a.observationIndex === sequence.indexOf(r))),
    historicalAcceptanceRetained: registry.effects.some((e: any) => e.status === "committed"),
    evidenceRecordCount: registry.evidenceVersions.length,
    crossWrapperAutoAliasCount: registry.claims.filter((claim: any) => new Set(registry.evidenceVersions.filter((e: any) => e.sourceClaimId === claim.sourceClaimId)
      .map((e: any) => registry.sourceTexts.find((t: any) => t.sourceTextVersionId === e.anchor.sourceTextVersionId)?.sourceRootId)).size>1).length,
    compensatingEffectCount: registry.effects.filter((e: any) => e.rule.effectType !== rule.effectType).length,
    retractionReplacementFact: sequence.find((r: any) => r.interpretation.relation?.kind === "retraction") ? reduction.actions[0]?.fact ?? null : null,
    requiresApprovedTransitionPolicy: c.preconditions.laterTransitionAuthority === "absent" && reduction.scenarios.some((s: any) => s.status === "unresolved"),
    promotedAssertedClaimCount: registry.effects.filter((e: any) => registry.interpretationVersions.some((i: any) => i.interpretationVersionId === e.interpretationVersionId
      && i.interpretation.assertionStrength === "asserted")).length };
  return { records: outputs,result,rawHolds: [...allHolds],identityState:useIdentity?identityState:null,
    changedImmutableRows:[...immutableReplacements].sort(),
    normalization: "Pure r3 registry plus complete-final semantic reducer; optional separately versioned occurrence-identity candidate projects its allocated stable ID and retains native r3 IDs. No persistence, parent publisher or compensator is invoked." };
}

const results = spec.cases.map((c: any) => {
  if (c.layer === "future_persistence_gate") return { id: c.id,layer: c.layer,status: "deferred_persistence",reason: "Unchanged DSL requires separate actual storage/consumer gate; pure results cannot satisfy it.",assertions: [] };
  if (unsupported[c.id]) return { id: c.id,layer: c.layer,status: "unsupported_projection",reason: unsupported[c.id],assertions: [] };
  try {
    const outcome: any = ["CR015","CR028","CR029"].includes(c.id) ? dedicated(c) : c.steps[0]?.op === "evaluate_permutations" ? { permutations: Object.fromEntries(c.steps[0].recordOrders.map((order: string[]) => [order.join("_then_"),execute(c,order).result])) } : execute(c);
    const assertions = c.assertions.map((a: any,index: number) => {
      const values = a.op === "equals" ? a.path.split(".").reduce((v: any,k: string) => v?.[k],outcome) : a.records.map((id: string) => outcome.records[id]?.[a.field]);
      const pass = a.op === "equals" ? isDeepStrictEqual(values,a.value) : values.every((v: any) => v !== null && v !== undefined)
        && (a.op === "same" ? values.every((v: any) => isDeepStrictEqual(v,values[0])) : new Set(values.map(canonical)).size === values.length);
      return { index,assertion: a,pass,actual: values ?? null };
    });
    return { id: c.id,layer: c.layer,status: assertions.every((a: any) => a.pass) ? "passed" : "failed",assertions,outcome };
  } catch (error) { return { id: c.id,layer: c.layer,status: "adapter_error",error: String(error),assertions: [] }; }
});
const candidateManifest="../occurrence-increment/owned-source-v2-sha256.json";
const report = { fixtureSha256: createHash("sha256").update(fixtureBytes).digest("hex"),candidateManifest,
  candidateManifestSha256:createHash("sha256").update(readFileSync(join(__dirname,candidateManifest))).digest("hex"),
  runtimeBaselineManifest:"../next-increment/owned-source-v4-sha256.json",
  noNetwork: true,noDatabase: true,noDispatch: true,fullAcceptance: false,identityCandidate,mutationControl,mutationTargets,results,
  counts: Object.fromEntries([...new Set(results.map((r: any) => r.status))].map(status => [status,results.filter((r: any) => r.status === status).length])) };
writeFileSync(join(__dirname,mutationControl?"acceptance-identity-negative-control-results.json":identityCandidate?"reviewer-mutation-candidate-results.json":"reviewer-mutation-baseline-results.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({ counts: report.counts,assertionsChecked: results.flatMap((r: any) => r.assertions).length,
  failedCases: results.filter((r: any) => r.status === "failed" || r.status === "adapter_error").map((r: any) => ({ id:r.id,error:r.error,failed:r.assertions.filter((a: any) => !a.pass) })) },null,2));
process.exitCode = results.some((r: any) => r.status === "failed" || r.status === "adapter_error") ? 1 : 0;
