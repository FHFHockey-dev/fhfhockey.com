import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { advanceRollingForgeStage, acquireRollingForgeStage, isRollingForgeStageLeaseDead,
  readRollingForgeRunState, readRollingForgeStageFailedAttempts, readRollingForgeStageKills,
  recordRollingForgeStageKill } from "./rollingForgePipelineRunState";
import { advanceProjectionPipelineLease, finishProjectionPipelineLease } from "./projections/projectionPipelineState";

// Review-only, memory-backed model of the inspected revision/owner/expiry SQL rules.
// It is not a database concurrency or deployment test.
const state = new Map<string, any>();
const key = (pipeline: string, scope: string, operation: string) => `${pipeline}|${scope}|${operation}`;
const from = () => {
 const filters: Record<string, unknown> = {};
 const rows = () => [...state.values()].filter(row => Object.entries(filters).every(([k,v]) => row[k] === v)).map(row=>({...row}));
 const q: any = {select:()=>q,eq:(c:string,v:unknown)=>{filters[c]=v;return q;},
 maybeSingle:async()=>({data:rows()[0]??null,error:null}),then:(resolve:any,reject:any)=>Promise.resolve({data:rows(),error:null}).then(resolve,reject)};
 return q;
};
let failReceiptCompletion = false;
const rpc = async (_name: string, a: any) => {
 const k=key(a.p_pipeline_key,a.p_scope_key,a.p_operation_key), current=state.get(k);
 const fail=(message:string)=>({data:null,error:{message}});
 if (!current && (a.p_transition!=="acquire" || a.p_expected_revision!==0)) return fail("PROJECTION_PIPELINE_STATE_ABSENT");
 if (current) {
  if (current.revision!==a.p_expected_revision) return fail("PROJECTION_PIPELINE_REVISION_MISMATCH");
  if (a.p_transition==="acquire" && current.status==="complete") return {data:[{...current}],error:null};
  if (a.p_transition==="acquire" && current.status==="running" && Date.parse(current.lease_expires_at)>Date.now() && current.lease_owner!==a.p_lease_owner) return fail("PROJECTION_PIPELINE_LEASE_HELD");
  if (a.p_transition!=="acquire" && (current.status!=="running" || current.lease_owner!==a.p_lease_owner)) return fail("PROJECTION_PIPELINE_LEASE_MISMATCH");
  if (["advance","complete"].includes(a.p_transition) && Date.parse(current.lease_expires_at)<=Date.now()) return fail("PROJECTION_PIPELINE_LEASE_EXPIRED");
  if (current.cursor_date && (a.p_next_cursor_date==null || a.p_next_cursor_date<current.cursor_date)) return fail("PROJECTION_PIPELINE_CURSOR_REGRESSION");
  if (current.cursor_date===a.p_next_cursor_date && current.cursor_game_id!=null && (a.p_next_cursor_game_id==null || a.p_next_cursor_game_id<current.cursor_game_id)) return fail("PROJECTION_PIPELINE_CURSOR_REGRESSION");
 }
 if (a.p_transition==="complete" && a.p_operation_key.includes(":kill:") && failReceiptCompletion) {
  failReceiptCompletion=false;return fail("SYNTHETIC_RECORDER_INTERRUPTED");
 }
 const running=a.p_next_status==="running";
 const row={pipeline_key:a.p_pipeline_key,scope_key:a.p_scope_key,operation_key:a.p_operation_key,revision:(current?.revision??0)+1,
 status:a.p_next_status,cursor_game_id:a.p_next_cursor_game_id,cursor_date:a.p_next_cursor_date,range_start_date:a.p_range_start_date,
 range_end_date:a.p_range_end_date,lease_owner:running?a.p_lease_owner:null,lease_expires_at:running?a.p_lease_expires_at:null,
 last_error:a.p_next_status==="failed"?a.p_last_error:null,updated_at:new Date().toISOString()};
 state.set(k,row);return {data:[{...row}],error:null};
};
const db={from,rpc} as any, scopeKey="daily_incremental:2026-10-19",runDate="2026-10-19",stageId="rolling_player_recompute" as const;
const args={supabase:db,scopeKey,runDate,stageId};
const acquire=()=>acquireRollingForgeStage({...args,leaseExpiresAtMs:Date.now()+270000});
const read=()=>readRollingForgeRunState(args);
beforeEach(()=>{state.clear();failReceiptCompletion=false;vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-10-19T10:00:00Z"));});
afterEach(()=>vi.useRealTimers());

it("review: a late in-flight checkpoint retains the long lease then becomes dead after expiry",async()=>{
 let lease=await acquire();vi.setSystemTime(Date.now()+215000);
 lease=await advanceRollingForgeStage({supabase:db,lease,cursorGameId:8478402,leaseExpiresAtMs:Date.parse("2026-10-19T10:04:30Z")});
 expect(lease.leaseExpiresAt).toBe("2026-10-19T10:04:30.000Z");
 expect(isRollingForgeStageLeaseDead((await read()).get(stageId))).toBe(false);
 vi.setSystemTime(new Date("2026-10-19T10:05:01Z"));
 expect(isRollingForgeStageLeaseDead((await read()).get(stageId))).toBe(true);
 expect(await recordRollingForgeStageKill({...args,expiredLeaseOwner:lease.leaseOwner})).toBe(1);
 const resumed=await acquire();expect(resumed.cursorGameId).toBe(8478402);expect(resumed.leaseOwner).not.toBe(lease.leaseOwner);
});
it("review: handoff releases ownership immediately without a failed attempt or kill",async()=>{
 const lease=await acquire();const handed=await advanceRollingForgeStage({supabase:db,lease,cursorGameId:8478402});
 expect(handed).toMatchObject({status:"failed",lastError:"stage_handoff",leaseOwner:null,leaseExpiresAt:null,cursorGameId:8478402});
 const states=await read();expect(readRollingForgeStageFailedAttempts(states.get(stageId))).toBe(0);expect(isRollingForgeStageLeaseDead(states.get(stageId))).toBe(false);
 expect(readRollingForgeStageKills(states,stageId)).toBe(0);expect((await acquire()).cursorGameId).toBe(8478402);
});
it("review: live ownership and stale-writer revision checks survive takeover",async()=>{
 const old=await acquire();await expect(acquire()).rejects.toThrow("LEASE_HELD");
 vi.setSystemTime(Date.now()+271000);const next=await acquire();expect(next.leaseOwner).not.toBe(old.leaseOwner);
 await expect(advanceProjectionPipelineLease({supabase:db,lease:old,nextCursorDate:runDate,nextCursorGameId:99})).rejects.toThrow("REVISION_MISMATCH");
 await expect(finishProjectionPipelineLease({supabase:db,lease:old,outcome:"complete"})).rejects.toThrow("REVISION_MISMATCH");
 expect((await read()).get(stageId)?.status).toBe("running");
});
it("review: expiry rejects checkpoint and completion under the inspected SQL contract",async()=>{
 const lease=await acquire();vi.setSystemTime(Date.now()+271000);
 await expect(advanceProjectionPipelineLease({supabase:db,lease,nextCursorDate:runDate,nextCursorGameId:99})).rejects.toThrow("LEASE_EXPIRED");
 await expect(finishProjectionPipelineLease({supabase:db,lease,outcome:"complete"})).rejects.toThrow("LEASE_EXPIRED");
});
it("review: same-owner concurrent and stale recorders spend one kill, distinct owners spend separate kills",async()=>{
 const kill={...args,expiredLeaseOwner:"owner-one"};
 const results=await Promise.allSettled(Array.from({length:8},()=>recordRollingForgeStageKill(kill)));
 expect(results.some(x=>x.status==="fulfilled"&&x.value===1)).toBe(true);
 expect(readRollingForgeStageKills(await read(),stageId)).toBe(1);
 expect(await recordRollingForgeStageKill(kill)).toBe(1);
 expect(await recordRollingForgeStageKill({...kill,expiredLeaseOwner:"owner-two"})).toBe(2);
 await expect(recordRollingForgeStageKill({...kill,expiredLeaseOwner:null})).rejects.toThrow("no owner identity");
});
it("review: interrupted receipt finalization leaves one counted receipt and resumes after expiry",async()=>{
 const kill={...args,expiredLeaseOwner:"interrupted-owner"};failReceiptCompletion=true;
 await expect(recordRollingForgeStageKill(kill)).rejects.toThrow("RECORDER_INTERRUPTED");
 expect(readRollingForgeStageKills(await read(),stageId)).toBe(1);
 await expect(recordRollingForgeStageKill(kill)).rejects.toThrow("LEASE_HELD");
 vi.setSystemTime(Date.now()+31000);expect(await recordRollingForgeStageKill(kill)).toBe(1);
 expect([...state.values()].filter(r=>r.operation_key.includes(":kill:"))).toHaveLength(1);
});
it("review: legacy counts remain additive and malformed companion suffixes do not count",async()=>{
 await recordRollingForgeStageKill({...args,expiredLeaseOwner:"new-owner"});
 const receipt=[...state.values()][0];
 for (const [operation_key,cursor_game_id] of [[`${stageId}:kills`,2],[`${stageId}:kill:malformed`,1]] as const)
 state.set(key(receipt.pipeline_key,scopeKey,operation_key),{...receipt,operation_key,cursor_game_id});
 expect(readRollingForgeStageKills(await read(),stageId)).toBe(3);
});
