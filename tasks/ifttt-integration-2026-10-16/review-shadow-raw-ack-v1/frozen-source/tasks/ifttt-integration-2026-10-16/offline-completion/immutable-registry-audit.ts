import { createHash } from "node:crypto";
import type { SourceClaimRegistry } from "../../../web/lib/sources/tweetSourceClaimRegistry";
import type { OccurrenceIdentityState } from "../../../web/lib/sources/tweetClaimOccurrenceIdentity";

const canonical=(value:any):string=>value && typeof value==="object"
  ? Array.isArray(value)?`[${value.map(canonical).join(",")}]`:`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
  : JSON.stringify(value);
export type ImmutableSnapshot=Map<string,string[]>;

/** Full prior row bytes; only documented mutable status fields and append-only containers are projected. */
export function snapshotImmutableRegistry(registry:SourceClaimRegistry,identity?:OccurrenceIdentityState):ImmutableSnapshot {
  const rows:ImmutableSnapshot=new Map();
  const add=(table:string,key:unknown,value:unknown)=>{
    const id=`${table}:${canonical(key)}`,values=rows.get(id)??[];
    rows.set(id,[...values,canonical(value)].sort());
  };
  const append=(table:string,values:readonly unknown[])=>values.forEach(value=>
    add(table,createHash("sha256").update(canonical(value)).digest("hex"),value));
  add("registry","header",{schemaVersion:registry.schemaVersion,registryId:registry.registryId});
  for(const row of registry.roots) add("roots",row.sourceRootId,row);
  for(const row of registry.sourceTexts) add("sourceTexts",row.sourceTextVersionId,row);
  for(const {anchors,...row} of registry.claims){
    add("claims",row.sourceClaimId,row);
    append("claimAnchors",anchors.map(anchor=>({sourceClaimId:row.sourceClaimId,anchor})));
  }
  for(const row of registry.evidenceVersions) add("evidenceVersions",row.evidenceVersionId,row);
  for(const row of registry.interpretationVersions) add("interpretationVersions",row.interpretationVersionId,row);
  for(const table of ["associations","scenarioHolds","alignments","legacyBindings","legacyCoverage"] as const) append(table,registry[table]);
  for(const {links,...row} of registry.legacyRows){
    add("legacyRows",[row.kind,row.key],row);
    append("legacyLinks",links.map(link=>({kind:row.kind,key:row.key,link})));
  }
  for(const {status:_status,disputeStatus:_dispute,sourceClaimIds,...row} of registry.effects){
    add("effects",row.effectKey,row);
    append("effectSources",sourceClaimIds.map(sourceClaimId=>({effectKey:row.effectKey,sourceClaimId})));
  }
  if(identity){
    add("identity","header",{version:identity.version,namespace:identity.namespace});
    for(const {anchors,...row} of identity.occurrences){
      add("identityOccurrences",row.id,row);
      append("identityAnchors",anchors.map(anchor=>({occurrenceId:row.id,anchor})));
    }
    for(const row of identity.derivations) add("identityDerivations",row.id,row);
    for(const row of identity.bindings) add("identityBindings",row.occurrenceId,row);
  }
  return rows;
}

/** Detects deletions, rewrites and duplicate immutable IDs at every ingest boundary. New rows are allowed. */
export function changedPriorImmutableRows(before:ImmutableSnapshot,after:ImmutableSnapshot):string[] {
  return [...before].filter(([key,values])=>canonical(values)!==canonical(after.get(key)??[])).map(([key])=>key);
}
