// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync,writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll,describe,expect,it } from "../../../web/node_modules/vitest";
import { execute,project } from "./run-acceptance";
import { qualifiedFixture } from "../../../web/lib/sources/fixtures/tweetClaimQualificationFixture";
import { qualifyTweetClaimScope } from "../../../web/lib/sources/tweetClaimLineage";
import { tweetClaimAttribution } from "../../../web/lib/sources/tweetSourceDirectory";
import { verifyDistinctOccurrenceDocument } from "../../../web/lib/sources/tweetClaimOccurrenceIdentity";

const path=join(__dirname,"../handoff/extracted-reviewed/ifttt-claim-replay-tests-2026-10-15/acceptance-cases.json");
const originalBytes=readFileSync(path),original=JSON.parse(originalBytes.toString());
const fixture=JSON.parse(readFileSync(join(__dirname,"../game-scope-fixtures-v2/cases.json"),"utf8"));
const results:any[]=[];
const check=(c:any,outcome:any)=>c.assertions.map((a:any)=>{
  const actual=a.op==="equals"?a.path.split(".").reduce((v:any,key:string)=>v?.[key],outcome):a.records.map((id:string)=>outcome.records[id]?.[a.field]);
  if(a.op==="equals")expect(actual).toEqual(a.value);
  else {expect(actual.every((v:any)=>v!==null && v!==undefined)).toBe(true);
    if(a.op==="same")expect(new Set(actual).size).toBe(1);else expect(new Set(actual).size).toBe(actual.length);}
  return {assertion:a,actual,pass:true};
});
afterAll(()=>writeFileSync(join(__dirname,"outputs/versioned-game-results.json"),JSON.stringify({version:fixture.version,
  originalOracleSha256:createHash("sha256").update(originalBytes.toString("utf8")).digest("hex"),noNetwork:true,noDatabase:true,noDispatch:true,
  fullOriginalAcceptance:false,results},null,2)+"\n"));

describe("approved versioned game-separation fixture corrections",()=>{
  it("preserves the exact original oracle and strengthens every original game-separation assertion",()=>{
    expect(createHash("sha256").update(originalBytes.toString("utf8")).digest("hex")).toBe("d9fe45ca44042673ff0381cd0f1981074b196da99fb6fdf9da573ac5df84fd8b");
    expect(fixture.originalOracleSha256).toBe(createHash("sha256").update(originalBytes.toString("utf8")).digest("hex"));
    for(const c of fixture.positiveCases){
      const prior=original.cases.find((p:any)=>c.id.startsWith(p.id+"-"));
      for(const a of prior.assertions)expect(c.assertions).toContainEqual(a);
      for(const record of c.records){expect(record.interpretation.scope.date).toBe(record.sourceApplicability.date);
        const contradictory=structuredClone(record);contradictory.interpretation.scope.date="2026-10-15";
        expect(()=>project(contradictory,c.records)).toThrow("Supplied game scope/applicability date");}
    }
  });
  it.each(fixture.positiveCases)("$id supplies a single full synthetic original with two disjoint exact claims",(...[c]:any[])=>{
    const [left,right]=c.records,text=left.sourceText.text;
    expect(right.sourceText.text).toBe(text);expect(left.source.originalId).toBe(right.source.originalId);
    for(const record of c.records)for(const span of [record.occurrence.subjectSpan,record.occurrence.predicateSpan,record.occurrence.governingClauseSpan])
      expect(text.slice(span.start,span.end)).toBe(span.text);
    const a=left.occurrence.governingClauseSpan,b=right.occurrence.governingClauseSpan;expect(a.end).toBeLessThanOrEqual(b.start);
    if(c.id.startsWith("CR011"))expect(left.sourceApplicability.date).not.toBe(right.sourceApplicability.date);
    else {expect(left.sourceApplicability.date).toBe(right.sourceApplicability.date);expect(a.text).toContain("Game one");expect(b.text).toContain("Game two");}
    const asOf=c.steps.find((s:any)=>s.asOf).asOf;
    const convert=(r:any)=>{const clause=r.occurrence.governingClauseSpan;return {derivationId:r.recordId,receiptId:r.source.retainedSourceId,sourceText:clause.text,
      subjectSpan:{...r.occurrence.subjectSpan,start:r.occurrence.subjectSpan.start-clause.start,end:r.occurrence.subjectSpan.end-clause.start},
      predicateSpan:{...r.occurrence.predicateSpan,start:r.occurrence.predicateSpan.start-clause.start,end:r.occurrence.predicateSpan.end-clause.start},
      original:{tweetId:r.source.originalId,author:r.source.originalAuthor,publishedAt:r.time.originalPublishedAt}};};
    const sides=(r:any)=>({clause:r.occurrence.governingClauseSpan,subject:r.occurrence.subjectSpan,predicate:r.occurrence.predicateSpan});
    expect(verifyDistinctOccurrenceDocument({original:convert(left).original,text,receiptId:left.source.retainedSourceId,knownAt:asOf,
      basis:"explicit version2 complete synthetic source document",left:sides(left),right:sides(right)},convert(left),convert(right),asOf)).toBe(true);
    const outcome=execute(c),assertions=check(c,outcome);results.push({id:c.id,status:"passed",assertions,outcome});
  });
  it.each(fixture.negativeCases)("retains original $originalCaseId variants as a lineage hold with no effects",(...[negative]:any[])=>{
    const c=original.cases.find((p:any)=>p.id===negative.originalCaseId),f=qualifiedFixture();
    const claims=c.records.map((r:any)=>{
      const source={...f.source,rawText:r.sourceText.text,tweetId:r.source.originalId,sourceHandle:r.source.originalAuthor,
        sourceUrl:`https://x.com/${r.source.originalAuthor}/status/${r.source.originalId}`,tweetPostedAt:r.time.originalPublishedAt,observedAt:r.time.receivedAt};
      return {...f.claims[0],source,attribution:tweetClaimAttribution(source),lineageKey:r.source.retainedSourceId,
        scopeKey:`fixture-game:${r.interpretation.scope.gameId}`,semantic:project(r,c.records).observation,
        claimAnchor:{subjectSpan:r.occurrence.subjectSpan,predicateSpan:r.occurrence.predicateSpan}};
    });
    const outcome=qualifyTweetClaimScope(claims[0].scopeKey,claims,f.evidence,[],c.steps.find((s:any)=>s.asOf).asOf);
    expect(outcome.holds).toHaveLength(2);expect(outcome.holds.every(h=>h.reason===negative.expectedHold)).toBe(true);
    expect(outcome.plan.reviewableEffects).toHaveLength(negative.expectedEffectProposals);expect(outcome.plan.dispatchInstructions).toEqual([]);
    results.push({id:c.id+"-AMBIGUOUS-NEGATIVE-v2",status:"passed",outcome});
  });
  it.each(fixture.revisionCases)("$id preserves occurrence lineage and holds a material edit as a revision",(...[c]:any[])=>{
    const outcome=execute(c),assertions=check(c,outcome);
    expect((outcome.result as any).interpretationVersionCount??new Set(Object.values(outcome.records).map((r:any)=>r.interpretationVersionId)).size).toBe(2);
    expect(outcome.rawHolds.some((h:string)=>/correction|material|conflict/.test(h))).toBe(true);
    results.push({id:c.id,status:"passed",assertions,outcome});
  });
});
