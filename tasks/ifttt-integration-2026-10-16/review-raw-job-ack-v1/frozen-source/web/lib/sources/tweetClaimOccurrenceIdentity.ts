import { createHash } from "node:crypto";
import type { ClaimSpan } from "./tweetSourceClaimRegistry";

/** Pure compatibility candidate. No storage, qualification or dispatch caller is wired. */
export type OccurrenceOriginal = { tweetId: string; author: string; publishedAt: string };
export type OccurrenceAnchor = { receiptId: string; textHash: string; subjectSpan: ClaimSpan; predicateSpan: ClaimSpan };
export type OccurrenceIdentityInput = {
  derivationId: string; receiptId: string; sourceText: string; subjectSpan: ClaimSpan; predicateSpan: ClaimSpan;
  /** Verified by an upstream retained-source contract, never guessed from text. */
  original: OccurrenceOriginal | null;
};
export type OccurrenceIdentityProof = {
  kind: "unique_retained_occurrence"; occurrenceId: string; priorAnchor: OccurrenceAnchor; nextAnchor: OccurrenceAnchor;
  original: OccurrenceOriginal; knownAt: string; basis: string;
};
export type OccurrenceIdentityState = {
  version: "tweet-occurrence-identity-v1"; namespace: string; nextToken: number;
  occurrences: { id: string; token: number; anchors: OccurrenceAnchor[] }[];
  derivations: { id: string; payloadHash: string; occurrenceId: string }[];
  bindings: { occurrenceId: string; original: OccurrenceOriginal; proof: OccurrenceIdentityProof | null }[];
};
const json = (v: any): string => {
  if (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v)) return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(json).join(",")}]`;
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype)
    return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${json(v[k])}`).join(",")}}`;
  throw new Error("Occurrence inputs must be finite plain JSON");
};
const digest = (v: unknown) => createHash("sha256").update(json(v)).digest("hex");
const clone = <T>(v: T): T => JSON.parse(json(v));
const same = (a: unknown,b: unknown) => json(a) === json(b);
const nonblank = (s: string) => typeof s === "string" && Boolean(s.trim());
const clock = (s: string) => typeof s === "string" && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s) ? Date.parse(s) : NaN;
const original = (o: OccurrenceOriginal) => ({ ...o,author: o.author.toLowerCase() });
const validOriginal = (o: OccurrenceOriginal,asOf: number) => Boolean(o) && /^\d+$/.test(o.tweetId) && /^[A-Za-z0-9_]{1,15}$/.test(o.author)
  && !/^(?:null|undefined|unknown|none)$/i.test(o.author) && Number.isFinite(clock(o.publishedAt)) && clock(o.publishedAt)<=asOf;
const exact = (s: ClaimSpan,text: string) => Boolean(s) && typeof text==="string" && Number.isSafeInteger(s.start) && Number.isSafeInteger(s.end)
  && s.start>=0 && s.end>s.start && s.end<=text.length && text.slice(s.start,s.end)===s.text;

export function emptyOccurrenceIdentity(namespace: string): OccurrenceIdentityState {
  return { version: "tweet-occurrence-identity-v1",namespace,nextToken: 1,occurrences: [],derivations: [],bindings: [] };
}
export function occurrenceIdentityAnchor(input: OccurrenceIdentityInput): OccurrenceAnchor {
  return { receiptId: input.receiptId,textHash: digest(input.sourceText),subjectSpan: clone(input.subjectSpan),predicateSpan: clone(input.predicateSpan) };
}

/** Allocates once; provenance proof appends a binding without rewriting old derivations. */
export function planOccurrenceIdentity(state: OccurrenceIdentityState,input: OccurrenceIdentityInput,asOf: string,proof?: OccurrenceIdentityProof) {
  const fail = (reason: string) => ({ accepted: false as const,reason,occurrenceId: null,nextState: clone(state) });
  const cutoff=clock(asOf);
  try { json(state);json(input);if(proof)json(proof); } catch { return fail("non_json_occurrence_input"); }
  if(state.version!=="tweet-occurrence-identity-v1" || !nonblank(state.namespace) || !Number.isSafeInteger(state.nextToken) || state.nextToken<1
    || !Number.isFinite(cutoff) || state.occurrences.length>256 || state.derivations.length>512
    || state.occurrences.some(o=>!Number.isSafeInteger(o.token) || o.token<1 || o.id!==`${state.namespace}:occurrence:${o.token}` || o.token>=state.nextToken || !o.anchors.length)
    || new Set(state.occurrences.map(o=>o.id)).size!==state.occurrences.length
    || new Set(state.derivations.map(d=>d.id)).size!==state.derivations.length
    || new Set(state.bindings.map(b=>b.occurrenceId)).size!==state.bindings.length
    || state.derivations.some(d=>!state.occurrences.some(o=>o.id===d.occurrenceId))
    || state.bindings.some(b=>!state.occurrences.some(o=>o.id===b.occurrenceId) || !validOriginal(b.original,cutoff))) return fail("occurrence_state_invalid");
  if(!nonblank(input.derivationId) || !nonblank(input.receiptId) || !exact(input.subjectSpan,input.sourceText) || !exact(input.predicateSpan,input.sourceText)
    || input.original && !validOriginal(input.original,cutoff)) return fail("occurrence_evidence_invalid");
  const payloadHash=digest(input),anchor=occurrenceIdentityAnchor(input),retained=state.derivations.find(d=>d.id===input.derivationId);
  if(retained && retained.payloadHash!==payloadHash) return fail("immutable_occurrence_derivation_collision");
  const sameReceipt=state.occurrences.filter(o=>o.anchors.some(a=>same(a,anchor)));
  const originalBindings=input.original ? state.bindings.filter(b=>b.original.tweetId===input.original!.tweetId) : [];
  if(input.original && originalBindings.some(b=>!same(b.original,original(input.original!)))) return fail("retained_original_binding_conflict");
  const bindings=input.original ? state.bindings.filter(b=>same(b.original,original(input.original!))) : [];
  const related=state.occurrences.filter(o=>originalBindings.some(b=>b.occurrenceId===o.id)
    || o.anchors.some(a=>a.receiptId===input.receiptId));
  const sameOriginal=state.occurrences.filter(o=>bindings.some(b=>b.occurrenceId===o.id) && o.anchors.some(a=>a.textHash===anchor.textHash
    && same(a.subjectSpan,anchor.subjectSpan) && same(a.predicateSpan,anchor.predicateSpan)));
  const candidates=[...new Map([...sameReceipt,...sameOriginal].map(o=>[o.id,o])).values()];
  if(candidates.length>1) return fail("multiple_retained_allocations_require_component_proof");
  let selected=candidates[0];
  if(proof){
    const target=state.occurrences.find(o=>o.id===proof.occurrenceId);
    if(proof.kind!=="unique_retained_occurrence" || !nonblank(proof.basis) || !Number.isFinite(clock(proof.knownAt)) || clock(proof.knownAt)>cutoff
      || !input.original || !same(original(proof.original),original(input.original)) || !same(proof.nextAnchor,anchor)
      || !target?.anchors.some(a=>same(a,proof.priorAnchor)) || proof.priorAnchor.textHash!==anchor.textHash
      || !same(proof.priorAnchor.subjectSpan,anchor.subjectSpan) || !same(proof.priorAnchor.predicateSpan,anchor.predicateSpan)
      || selected && selected.id!==target.id) return fail("unique_retained_occurrence_proof_invalid");
    selected=target;
  }
  if(retained && (!selected || retained.occurrenceId!==selected.id)) return fail("retained_derivation_rebind");
  const priorBinding=selected && state.bindings.find(b=>b.occurrenceId===selected!.id);
  if(priorBinding && input.original && !same(priorBinding.original,original(input.original))) return fail("retained_original_binding_conflict");
  if(selected && !priorBinding && input.original && !proof) return fail("provenance_upgrade_requires_unique_retained_proof");
  const overlaps=(a:ClaimSpan,b:ClaimSpan)=>a.start<b.end && b.start<a.end;
  if(!selected && related.some(o=>o.anchors.some(a=>a.textHash===anchor.textHash
    && overlaps(a.subjectSpan,anchor.subjectSpan) && overlaps(a.predicateSpan,anchor.predicateSpan))))
    return fail("overlapping_same_text_anchor_change_held");
  if(!selected && related.some(o=>o.anchors.some(a=>a.textHash!==anchor.textHash)))
    return fail("cross_text_occurrence_proof_required");
  if(!selected && state.occurrences.length===256 || !retained && state.derivations.length===512) return fail("occurrence_capacity_requires_review");
  const next=clone(state);
  if(!selected){const token=next.nextToken++;selected={id:`${next.namespace}:occurrence:${token}`,token,anchors:[]};next.occurrences.push(selected);}
  else selected=next.occurrences.find(o=>o.id===selected!.id)!;
  if(!selected.anchors.some(a=>same(a,anchor))) selected.anchors.push(anchor);
  if(!retained) next.derivations.push({id:input.derivationId,payloadHash,occurrenceId:selected.id});
  if(input.original && !priorBinding) next.bindings.push({occurrenceId:selected.id,original:original(input.original),proof:proof?clone(proof):null});
  return {accepted:true as const,reason:null,occurrenceId:selected.id,nextState:next};
}

export type DistinctOccurrenceDocumentProof = {
  original: OccurrenceOriginal; text: string; receiptId: string; knownAt: string; basis: string;
  left: { clause: ClaimSpan; subject: ClaimSpan; predicate: ClaimSpan };
  right: { clause: ClaimSpan; subject: ClaimSpan; predicate: ClaimSpan };
};
/** Game IDs or two snippets cannot establish two lexical occurrences in one original. */
export function verifyDistinctOccurrenceDocument(proof: DistinctOccurrenceDocumentProof,left: OccurrenceIdentityInput,right: OccurrenceIdentityInput,asOf: string) {
  const cutoff=clock(asOf),contains=(a:ClaimSpan,b:ClaimSpan)=>a.start<=b.start && a.end>=b.end;
  if(!Number.isFinite(cutoff) || !validOriginal(proof.original,cutoff) || !Number.isFinite(clock(proof.knownAt)) || clock(proof.knownAt)>cutoff
    || !nonblank(proof.receiptId) || !nonblank(proof.basis) || !left.original || !right.original
    || !same(original(proof.original),original(left.original)) || !same(original(proof.original),original(right.original))) return false;
  const sides=[proof.left,proof.right];
  if(sides.some(side=>![side.clause,side.subject,side.predicate].every(s=>exact(s,proof.text))
    || !contains(side.clause,side.subject) || !contains(side.clause,side.predicate))) return false;
  if(!(proof.left.clause.end<=proof.right.clause.start || proof.right.clause.end<=proof.left.clause.start)) return false;
  return sides.every((side,index)=>{const input=[left,right][index]!;return side.clause.text===input.sourceText
    && exact(input.subjectSpan,input.sourceText) && exact(input.predicateSpan,input.sourceText)
    && side.subject.start-side.clause.start===input.subjectSpan.start && side.subject.text===input.subjectSpan.text
    && side.subject.end-side.clause.start===input.subjectSpan.end
    && side.predicate.start-side.clause.start===input.predicateSpan.start && side.predicate.text===input.predicateSpan.text
    && side.predicate.end-side.clause.start===input.predicateSpan.end;});
}
