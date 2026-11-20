// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createOfficialPilotStore, type OfficialPilotTarget } from "./officialPilotStore";
import { type ContextTransport } from "./requestContextStore";

const run = "11111111-2222-4333-8444-555555555555", sha = "1".repeat(64);
const target: OfficialPilotTarget = { sourceDate: "2026-11-21", nativeRunId: run, nativeManifestSHA256: sha,
  scheduleSHA256: "2".repeat(64), deploymentId: "dpl_pilot", gitCommitSha: "3".repeat(40), gameIds: [2026020301,2026020302] };
const encoded = (data: unknown) => Buffer.from(JSON.stringify(data));
const hash = (data: Buffer) => createHash("sha256").update(new Uint8Array(data)).digest("hex");
const json = (data: Buffer | undefined) => JSON.parse(data!.toString("utf8"));
const fixture = (send: ContextTransport) => {
  const transport = vi.fn(send);
  return { store: createOfficialPilotStore({ serviceKey: "synthetic-test-only", transport }), transport };
};

describe("official pilot custody transport", () => {
  it("makes one fixed-origin claim and propagates only a fresh run or a consumed claim", async () => {
    let first = true;
    const { store, transport } = fixture(async r => {
      expect(r.url).toBe("https://fyhftlxokyjtpndbkfse.supabase.co/rest/v1/rpc/blsh_official_claim_v1");
      expect(r).toMatchObject({method:"POST",timeoutMs:5000,limit:65536});
      expect(json(r.body)).toEqual({ p_source_date: target.sourceDate,p_native_run_id:run,p_native_manifest_sha256:sha,
        p_deployment_id: target.deploymentId,p_git_commit_sha:target.gitCommitSha,p_schedule_sha256:target.scheduleSHA256,p_game_ids:target.gameIds });
      const ack = first ? { claimed: true, runId: run } : { claimed: false };
      first = false;
      return encoded(ack);
    });
    expect(await store.claim(target)).toEqual({claimed:true,runId:run});
    expect(await store.claim(target)).toEqual({claimed:false});
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it("rejects a widened slate, an invalid date, and ambiguous acknowledgements", async () => {
    const {store,transport}=fixture(async () => encoded({claimed:false,runId:run}));
    for (const patch of [{gameIds:[]},{gameIds:[...target.gameIds].reverse()},{gameIds:Array(17).fill(2026020301)},{sourceDate:"2026-11-22"},{sourceDate:"2026-11-20"}]) {
      await expect(store.claim({...target,...patch})).rejects.toThrow("official_target_invalid");
    }
    expect(transport).not.toHaveBeenCalled();
    await expect(store.claim(target)).rejects.toThrow("official_claim_unacknowledged");
  });
  it("commits original journal bytes and intent in one bounded RPC", async () => {
    const {store,transport}=fixture(async () => encoded(true));
    const name="operation-1-STARTED.json", bytes=encoded({operation:1,method:"GET",url:"https://api-web.nhle.com/v1/gamecenter/2026020301/boxscore"});
    await store.putObject(run,target.sourceDate,2,name,bytes,hash(bytes),()=>731);
    const path="official-v1/"+target.sourceDate+"/"+run+"/"+name;
    expect(transport).toHaveBeenCalledTimes(1);
    const [r]=transport.mock.calls[0];
    expect(r).toMatchObject({method:"POST",timeoutMs:731,url:"https://fyhftlxokyjtpndbkfse.supabase.co/rest/v1/rpc/blsh_official_object_v1"});
    expect(json(r.body)).toEqual({p_run_id:run,p_ordinal:2,p_path:path,p_bytes:bytes.length,p_sha256:hash(bytes),p_body_base64:bytes.toString("base64")});
  });
  it("never retries a lost append acknowledgement and never sends an expired RPC",async () => {
    const {store,transport}=fixture(async () => {throw new Error("sensitive transport details");});
    const bytes=encoded({x:"test"});
    await expect(store.putObject(run,target.sourceDate,2,"operation-1-STARTED.json",bytes,hash(bytes))).rejects.toThrow("official_store_transport_failed");
    await expect(store.close(run,"failed","lost_ack",null,null,()=>0)).rejects.toThrow("official_store_deadline");
    await expect(store.claim(target,()=>Number.NaN)).rejects.toThrow("official_store_deadline");
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("refuses wrong bytes, bounds or paths and binds both terminal states",async () => {
    const {store,transport}=fixture(async () => encoded(true));
    const bytes=encoded({files:[]}),oversize=Buffer.alloc(4*1024*1024+1);
    for(const [file, data, h] of [["../game",bytes,hash(bytes)],["RUNTIME.json",bytes,sha],
      ["boxscore-2026020301.body.json",oversize,hash(oversize)]] as const){
      await expect(store.putObject(run,target.sourceDate,1,file,data,h)).rejects.toThrow("official_object_invalid");
    }
    await expect(store.close(run,"failed","bad reason",null,null)).rejects.toThrow("official_failure_invalid");
    await expect(store.close(run,"packet_complete_pending_review",null,sha,bytes)).rejects.toThrow("official_manifest_invalid");
    expect(transport).not.toHaveBeenCalled();
    await store.close(run,"packet_complete_pending_review",null,hash(bytes),bytes);
    await store.close(run,"failed","uncertain",null,null);
    expect(transport.mock.calls.map(([r]) => json(r.body))).toEqual([
      {p_run_id:run,p_state:"packet_complete_pending_review",p_reason:null,p_manifest_sha256:hash(bytes),p_manifest_text:bytes.toString()},
      {p_run_id:run,p_state:"failed",p_reason:"uncertain",p_manifest_sha256:null,p_manifest_text:null},
    ]);
  });
});
