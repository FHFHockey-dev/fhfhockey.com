// @vitest-environment node
import {describe,expect,it} from "vitest";
import {loadEvidence,reconcile} from "./reconcile";

describe("original52 assertion and evidence accounting",()=>{
 it("accounts for every original assertion and keeps approved replacements separate",()=>{
  const result=reconcile(loadEvidence());
  expect(result.rows).toHaveLength(52);
  expect(result.original).toMatchObject({assertions:227,matchingAssertions:225,nonmatchingAssertions:2,caseRowsWithAllAssertionsMatching:50});
  expect(result.original.separatePersistence).toEqual({cases:9,assertions:31,matchingAssertions:31});
  expect(result.approvedVersionedFixtures).toMatchObject({positiveCases:2,positiveAssertions:12,originalAssertionsRetained:7,ambiguousOriginalNegativeControls:2});
  expect(result.full52EndToEndAccepted).toBe(false);
 });
 it("rejects missing and duplicate original cases rather than improving the denominator",()=>{
  const missing=loadEvidence();missing.pure.results.pop();expect(()=>reconcile(missing)).toThrow("missing/extra cases");
  const duplicate=loadEvidence();duplicate.pure.results[1]=structuredClone(duplicate.pure.results[0]);expect(()=>reconcile(duplicate)).toThrow("duplicate/missing case ID");
 });
 it("rejects a passing flag that hides changed actual durable evidence",()=>{
  const data=loadEvidence();data.durable.results[0].assertions[0].actual=false;
  expect(()=>reconcile(data)).toThrow("forged/stale pass flag");
 });
 it("rejects omitted or altered original assertions",()=>{
  const missing=loadEvidence();missing.parent.results[0].assertions.pop();expect(()=>reconcile(missing)).toThrow("assertion count mismatch");
  const changed=loadEvidence();changed.parent.results[0].assertions[0].assertion.value=false;expect(()=>reconcile(changed)).toThrow("original assertion changed");
 });
 it("rejects a pure persistence pass without the actual accepted storage boundary",()=>{
  const data=loadEvidence();data.pure.results.find((r:any)=>r.id==="CR042").status="passed";
  expect(()=>reconcile(data)).toThrow("pure result improperly scores persistence");
 });
 it("requires all original game-separation assertions and zero effects for ambiguous originals",()=>{
  const weakened=loadEvidence();weakened.corrections.positiveCases[0].assertions.shift();expect(()=>reconcile(weakened)).toThrow("positive dropped original assertion");
  const unsafe=loadEvidence();unsafe.versioned.results.find((r:any)=>r.id==="CR011-AMBIGUOUS-NEGATIVE-v2").outcome.plan.reviewableEffects.push({key:"unsafe"});
  expect(()=>reconcile(unsafe)).toThrow("ambiguous original was not held");
 });
 it("requires the deliberate immutable-row rewrite to fail the original oracle",()=>{
  const data=loadEvidence();data.mutation.results.find((r:any)=>r.id==="CR019").status="passed";
  expect(()=>reconcile(data)).toThrow("mutation control not detected");
 });
 it("rejects collapsed durable game identities or a dispatchable ambiguous carrier",()=>{
  const collapsed=loadEvidence();collapsed.gameStorage.results[0].assertions[0].actual=["same","same"];
  expect(()=>reconcile(collapsed)).toThrow("forged/stale pass flag");
  const unsafe=loadEvidence();unsafe.gameStorage.results.find((r:any)=>r.id==="CR051-AMBIGUOUS-NEGATIVE-durable").outbox[0].requires_review=false;
  expect(()=>reconcile(unsafe)).toThrow("durable ambiguous variants escaped review");
 });
 it("reports changed live dependencies separately from historical accepted snapshot evidence",()=>{
  const data=loadEvidence();data.liveDependencies[0]={...data.liveDependencies[0],liveSha256:"changed-owner-bytes",liveMatchesAccepted:false};
  const result=reconcile(data);expect(result.dependencyStatus.liveDrift).toContainEqual(data.liveDependencies[0]);
  expect(result.original.matchingAssertions).toBe(225);expect(result.currentCombinedRuntimeAccepted).toBe(false);
 });
});
