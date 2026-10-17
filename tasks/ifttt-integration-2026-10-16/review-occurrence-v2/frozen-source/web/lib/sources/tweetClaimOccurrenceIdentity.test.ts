// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import { emptyOccurrenceIdentity,occurrenceIdentityAnchor,planOccurrenceIdentity,verifyDistinctOccurrenceDocument,
  type OccurrenceIdentityInput,type OccurrenceIdentityProof } from "./tweetClaimOccurrenceIdentity";

const asOf="2026-10-15T18:00:00Z",text="Jordan Staal will not play tonight.";
const input=(id="a"):OccurrenceIdentityInput=>({derivationId:`fixture-derivation:${id}`,receiptId:"fixture-receipt:retained",
  sourceText:text,subjectSpan:{start:0,end:12,text:"Jordan Staal"},predicateSpan:{start:13,end:26,text:"will not play"},original:null});
const verified=(id="b"):OccurrenceIdentityInput=>({...input(id),original:{tweetId:"9900000000000000001",author:"fixture_a",publishedAt:"2026-10-15T12:00:00Z"}});
const bind=(prior:ReturnType<typeof planOccurrenceIdentity>,next=verified()):OccurrenceIdentityProof=>({kind:"unique_retained_occurrence",
  occurrenceId:prior.occurrenceId!,priorAnchor:prior.nextState.occurrences[0]!.anchors[0]!,nextAnchor:occurrenceIdentityAnchor(next),
  original:next.original!,knownAt:"2026-10-15T17:00:00Z",basis:"explicit isolated exact receipt/lexical proof"});
const cases=JSON.parse(readFileSync(join(__dirname,"../../../tasks/ifttt-integration-2026-10-16/handoff/extracted-reviewed/ifttt-claim-replay-tests-2026-10-15/acceptance-cases.json"),"utf8")).cases;

describe("new pure occurrence identity compatibility candidate",()=>{
  it("preserves the provisional token under exact proof and never changes the earlier derivation",()=>{
    const first=planOccurrenceIdentity(emptyOccurrenceIdentity("fixture-identity"),input(),asOf),before=structuredClone(first.nextState);
    const next=planOccurrenceIdentity(first.nextState,verified(),asOf,bind(first));
    expect(next.accepted).toBe(true);expect(next.occurrenceId).toBe(first.occurrenceId);
    expect(next.nextState.nextToken).toBe(2);expect(next.nextState.occurrences).toHaveLength(1);
    expect(next.nextState.derivations[0]).toEqual(before.derivations[0]);expect(first.nextState).toEqual(before);
  });
  it("does not upgrade provenance without the unique retained proof",()=>{
    const first=planOccurrenceIdentity(emptyOccurrenceIdentity("fixture-identity"),input(),asOf);
    const next=planOccurrenceIdentity(first.nextState,verified(),asOf);
    expect(next).toMatchObject({accepted:false,reason:"provenance_upgrade_requires_unique_retained_proof",nextState:first.nextState});
  });
  it("rejects forged anchors, receipt links and future proof clocks",()=>{
    const first=planOccurrenceIdentity(emptyOccurrenceIdentity("fixture-identity"),input(),asOf);
    for(const proof of [{...bind(first),knownAt:"2026-10-16T00:00:00Z"},
      {...bind(first),nextAnchor:{...bind(first).nextAnchor,receiptId:"other"}},
      {...bind(first),priorAnchor:{...bind(first).priorAnchor,textHash:"forged"}}]){
      expect(planOccurrenceIdentity(first.nextState,verified(),asOf,proof)).toMatchObject({accepted:false,nextState:first.nextState});
    }
  });
  it("keeps immutable derivation collisions rejected after serialization/retry",()=>{
    const first=planOccurrenceIdentity(emptyOccurrenceIdentity("fixture-identity"),input(),asOf);
    const retry=planOccurrenceIdentity(JSON.parse(JSON.stringify(first.nextState)),input(),asOf);
    expect(retry.nextState).toEqual(first.nextState);
    expect(planOccurrenceIdentity(first.nextState,{...input(),original:verified().original},asOf,bind(first))).toMatchObject({accepted:false,reason:"immutable_occurrence_derivation_collision"});
  });
  it("holds different original IDs, authors and clocks after binding",()=>{
    const first=planOccurrenceIdentity(emptyOccurrenceIdentity("fixture-identity"),verified("a"),asOf);
    for(const original of [{...verified().original!,tweetId:"9900000000000000009"},{...verified().original!,author:"other"},
      {...verified().original!,publishedAt:"2026-10-15T13:00:00Z"}])
      expect(planOccurrenceIdentity(first.nextState,{...verified(),original},asOf)).toMatchObject({accepted:false,reason:"retained_original_binding_conflict"});
  });
  it("holds convergence of already allocated provisional roots without component-wide proof",()=>{
    const left=planOccurrenceIdentity(emptyOccurrenceIdentity("fixture-identity"),input("left"),asOf);
    const right=planOccurrenceIdentity(left.nextState,{...input("right"),receiptId:"other-receipt"},asOf);
    expect(right.nextState.occurrences).toHaveLength(2);
    const bound=planOccurrenceIdentity(right.nextState,verified("left-bound"),asOf,bind(left,verified("left-bound")));
    const other=planOccurrenceIdentity(bound.nextState,{...verified("right-bound"),receiptId:"other-receipt"},asOf);
    expect(other).toMatchObject({accepted:false,reason:"multiple_retained_allocations_require_component_proof",nextState:bound.nextState});
  });
  it("keeps unchanged CR011/CR051 text variants held without inventing lexical proof from game IDs",()=>{
    for(const c of cases.filter((c:any)=>["CR011","CR051"].includes(c.id))){
      const [a,b]=c.records;const convert=(r:any):OccurrenceIdentityInput=>({derivationId:`fixture-text:${r.sourceText.sha256}`,
        receiptId:r.source.retainedSourceId,sourceText:r.sourceText.text,subjectSpan:r.occurrence.subjectSpan,predicateSpan:r.occurrence.predicateSpan,
        original:{tweetId:r.source.originalId,author:r.source.originalAuthor,publishedAt:r.time.originalPublishedAt}});
      const first=planOccurrenceIdentity(emptyOccurrenceIdentity("fixture-identity"),convert(a),asOf);
      expect(planOccurrenceIdentity(first.nextState,convert(b),asOf)).toMatchObject({accepted:false,reason:"cross_text_occurrence_proof_required"});
    }
  });
  it("checks an explicit retained document for disjoint lexical occurrences, not just a changed scope",()=>{
    const left=verified("left"),right={...verified("right"),sourceText:"Jordan Staal will not play tomorrow."};
    const document=`${left.sourceText} ${right.sourceText}`,offset=left.sourceText.length+1;
    const side=(i:OccurrenceIdentityInput,start:number)=>({clause:{start,end:start+i.sourceText.length,text:i.sourceText},
      subject:{...i.subjectSpan,start:start+i.subjectSpan.start,end:start+i.subjectSpan.end},predicate:{...i.predicateSpan,start:start+i.predicateSpan.start,end:start+i.predicateSpan.end}});
    const proof={original:left.original!,text:document,receiptId:"fixture-full-original",knownAt:asOf,basis:"explicit synthetic full retained document",
      left:side(left,0),right:side(right,offset)};
    expect(verifyDistinctOccurrenceDocument(proof,left,right,asOf)).toBe(true);
    expect(verifyDistinctOccurrenceDocument({...proof,right:proof.left},left,right,asOf)).toBe(false);
    expect(verifyDistinctOccurrenceDocument({...proof,original:{...proof.original,tweetId:"wrong"}},left,right,asOf)).toBe(false);
    expect(verifyDistinctOccurrenceDocument({...proof,text:left.sourceText},left,right,asOf)).toBe(false);
  });
  it("rejects inconsistent persisted bindings instead of selecting a convenient version",()=>{
    const first=planOccurrenceIdentity(emptyOccurrenceIdentity("fixture-identity"),verified("a"),asOf),state=structuredClone(first.nextState);
    state.bindings.push({...state.bindings[0]!,original:{...state.bindings[0]!.original,tweetId:"other"}});
    expect(planOccurrenceIdentity(state,verified(),asOf)).toMatchObject({accepted:false,reason:"occurrence_state_invalid"});
  });
  it("never allocates another token when a retained derivation's anchor cannot be read back",()=>{
    const first=planOccurrenceIdentity(emptyOccurrenceIdentity("fixture-identity"),input(),asOf),state=structuredClone(first.nextState);
    state.occurrences[0]!.anchors[0]!.textHash="different";
    expect(planOccurrenceIdentity(state,input(),asOf)).toMatchObject({accepted:false,reason:"retained_derivation_rebind",nextState:state});
  });
  it("holds overlapping anchor changes across the same receipt or verified original",()=>{
    for(const original of [null,verified().original]){
      const first=planOccurrenceIdentity(emptyOccurrenceIdentity("fixture-overlap"),{...input(),original},asOf);
      for(const receiptId of original?[input().receiptId,"second-receipt"]:[input().receiptId])
        expect(planOccurrenceIdentity(first.nextState,{...input("narrowed"),original,receiptId,
          predicateSpan:{start:18,end:26,text:"not play"}},asOf)).toMatchObject({accepted:false,
          reason:"overlapping_same_text_anchor_change_held",nextState:first.nextState});
    }
  });
  it("holds same-original text changes and identity conflicts even when the receipt changes",()=>{
    const first=planOccurrenceIdentity(emptyOccurrenceIdentity("fixture-cross-receipt"),verified("a"),asOf);
    expect(planOccurrenceIdentity(first.nextState,{...verified(),receiptId:"other-receipt",
      sourceText:"Jordan Staal will not play tomorrow."},asOf)).toMatchObject({accepted:false,
      reason:"cross_text_occurrence_proof_required",nextState:first.nextState});
    for(const original of [{...verified().original!,author:"other"},{...verified().original!,publishedAt:"2026-10-15T13:00:00Z"}])
      expect(planOccurrenceIdentity(first.nextState,{...verified(),original,receiptId:"other-receipt"},asOf)).toMatchObject({accepted:false,
        reason:"retained_original_binding_conflict",nextState:first.nextState});
  });
  it("allows disjoint repeated lexical occurrences in the same immutable original text",()=>{
    const sourceText=`${text} ${text}`,left={...verified("left"),sourceText},offset=text.length+1;
    const right={...verified("right"),sourceText,receiptId:"second-receipt",
      subjectSpan:{...left.subjectSpan,start:offset+left.subjectSpan.start,end:offset+left.subjectSpan.end},
      predicateSpan:{...left.predicateSpan,start:offset+left.predicateSpan.start,end:offset+left.predicateSpan.end}};
    const first=planOccurrenceIdentity(emptyOccurrenceIdentity("fixture-disjoint"),left,asOf);
    const next=planOccurrenceIdentity(first.nextState,right,asOf);
    expect(next.accepted).toBe(true);expect(next.occurrenceId).not.toBe(first.occurrenceId);
  });
  it.each(["subjectSpan","predicateSpan"] as const)("requires exact input %s endpoints in a full-document proof",field=>{
    const left=verified("left"),right={...verified("right"),sourceText:"Jordan Staal will not play tomorrow."},offset=text.length+1;
    const side=(i:OccurrenceIdentityInput,start:number)=>({clause:{start,end:start+i.sourceText.length,text:i.sourceText},
      subject:{...i.subjectSpan,start:start+i.subjectSpan.start,end:start+i.subjectSpan.end},predicate:{...i.predicateSpan,start:start+i.predicateSpan.start,end:start+i.predicateSpan.end}});
    const proof={original:left.original!,text:`${left.sourceText} ${right.sourceText}`,receiptId:"fixture-full-original",knownAt:asOf,
      basis:"explicit synthetic full retained document",left:side(left,0),right:side(right,offset)};
    for(const end of [0,999]) for(const which of ["left","right"]){
      const target=which==="left"?left:right,malformed={...target,[field]:{...target[field],end}};
      expect(verifyDistinctOccurrenceDocument(proof,which==="left"?malformed:left,which==="right"?malformed:right,asOf)).toBe(false);
    }
  });
});
