// @vitest-environment node
import { describe,expect,it } from "vitest";
import { emptySourceClaimRegistry } from "../../../web/lib/sources/tweetSourceClaimRegistry";
import { emptyOccurrenceIdentity,planOccurrenceIdentity } from "../../../web/lib/sources/tweetClaimOccurrenceIdentity";
import { snapshotImmutableRegistry,changedPriorImmutableRows } from "../offline-completion/immutable-registry-audit";

// Deliberate byte-level adversarial audit fixtures; no planner or delivery is inferred from them.
const fixture=()=>Object.assign(emptySourceClaimRegistry("audit"),{
  roots:[{sourceRootId:"root",retained:"original"}],sourceTexts:[{sourceTextVersionId:"text",text:"exact source"}],
  claims:[{sourceClaimId:"claim",sourceRootId:"root",occurrenceToken:1,anchors:[{span:"anchor"}]}],
  evidenceVersions:[{evidenceVersionId:"evidence",evidence:{text:"governing qualifier"}}],
  interpretationVersions:[{interpretationVersionId:"interpretation",interpretation:{parserVersion:"before",validation:{status:"pending"}}}],
  associations:[{kind:"association"}],scenarioHolds:[{kind:"hold"}],alignments:[{kind:"alignment"}],
  legacyBindings:[{kind:"binding"}],legacyCoverage:[{kind:"coverage"}],
  legacyRows:[{kind:"event",key:"legacy",payload:{text:"original"},links:[{evidenceVersionId:"evidence"}]}],
  effects:[{effectKey:"effect",acceptedTimes:{effectiveAt:"2026-10-15T12:00:00Z"},plannedAtAsOf:"2026-10-15T13:00:00Z",
    status:"reserved",disputeStatus:"clear",sourceClaimIds:["claim"]}],
}) as any;

describe("complete prior immutable registry audit",()=>{
  it.each(["roots","sourceTexts","claims","evidenceVersions","interpretationVersions","associations","scenarioHolds",
    "alignments","legacyBindings","legacyCoverage","legacyRows","effects"])("detects an old %s row rewrite and removal",table=>{
    const registry=fixture(),before=snapshotImmutableRegistry(registry);
    registry[table][0].deliberateRewrite=true;
    expect(changedPriorImmutableRows(before,snapshotImmutableRegistry(registry)).length).toBeGreaterThan(0);
    registry[table]=[];
    expect(changedPriorImmutableRows(before,snapshotImmutableRegistry(registry)).length).toBeGreaterThan(0);
  });
  it("detects parser rewrites before any effect was present",()=>{
    const registry=fixture();registry.effects=[];
    const before=snapshotImmutableRegistry(registry);
    registry.interpretationVersions[0].interpretation.parserVersion="DELIBERATE_OLD_ROW_REWRITE";
    expect(changedPriorImmutableRows(before,snapshotImmutableRegistry(registry))).toEqual(['interpretationVersions:"interpretation"']);
  });
  it("allows new evidence/links and mutable effect status while retaining all old immutable bytes",()=>{
    const registry=fixture(),before=snapshotImmutableRegistry(registry);
    registry.evidenceVersions.push({evidenceVersionId:"new-evidence",evidence:{text:"additional retained version"}});
    registry.claims[0].anchors.push({span:"new anchor"});registry.legacyRows[0].links.push({evidenceVersionId:"new-evidence"});
    registry.effects[0].status="committed";registry.effects[0].disputeStatus="disputed";registry.effects[0].sourceClaimIds.push("another-claim");
    expect(changedPriorImmutableRows(before,snapshotImmutableRegistry(registry))).toEqual([]);
  });
  it("detects removal of earlier anchors/links/effect membership and duplicate immutable IDs",()=>{
    for(const mutate of [(r:any)=>r.claims[0].anchors.pop(),(r:any)=>r.legacyRows[0].links.pop(),
      (r:any)=>r.effects[0].sourceClaimIds.pop(),(r:any)=>r.evidenceVersions.push(structuredClone(r.evidenceVersions[0]))]){
      const registry=fixture(),before=snapshotImmutableRegistry(registry);mutate(registry);
      expect(changedPriorImmutableRows(before,snapshotImmutableRegistry(registry)).length).toBeGreaterThan(0);
    }
  });
  it("retains complete earlier identity derivation and anchor evidence",()=>{
    const registry=fixture(),identity=planOccurrenceIdentity(emptyOccurrenceIdentity("audit-identity"),{derivationId:"a",receiptId:"receipt",
      sourceText:"Player out",subjectSpan:{start:0,end:6,text:"Player"},predicateSpan:{start:7,end:10,text:"out"},original:null},"2026-10-15T18:00:00Z").nextState;
    const before=snapshotImmutableRegistry(registry,identity);
    identity.derivations[0]!.payloadHash="rewritten";
    expect(changedPriorImmutableRows(before,snapshotImmutableRegistry(registry,identity))).toEqual(['identityDerivations:"a"']);
  });
});
