// @vitest-environment node
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createLunaBindingProbe, BINDING_TARGET } from "./bindingProbe";
import type { IftttRpcClient } from "../iftttRpcDeadline";
import route, { config as routeConfig } from "../../../pages/api/internal/luna-binding-check";
import { getServiceRoleClient } from "lib/supabase/server";
vi.mock("lib/supabase/server", () => ({ getServiceRoleClient: vi.fn() }));
const NOW = Date.parse("2026-11-05T15:01:00Z"), ID = "00000000-0000-4000-8000-000000000001";
const SECRET = "synthetic-probe-only-secret-00000000000";
const config = { version: "luna-binding-check-v1", startsAt: "2026-11-05T15:00:00Z", expiresAt: "2026-11-05T16:00:00Z" };
function probeQuery(args: Record<string,unknown>, data: unknown, error: unknown = null, override: Record<string,unknown> = {}) {
  const url = new URL(`${BINDING_TARGET}/rest/v1/rpc/luna_hosted_review_rpc`);
  for (const [key,value] of Object.entries(args)) url.searchParams.set(key,String(value));
  return { method: "GET", url, body: undefined,
    abortSignal: vi.fn(async () => ({ error, data })), ...override };
}
function fixture() {
  const env: Record<string,string|undefined> = { VERCEL_ENV: "production", IFTTT_LUNA_BINDING_CHECK_CONFIG: JSON.stringify(config),
    IFTTT_LUNA_WORKER_SECRET: SECRET, NEXT_PUBLIC_SUPABASE_URL: BINDING_TARGET };
  const rpc = vi.fn((_name: string, args: Record<string,unknown>, _options?: {get?:boolean}) => probeQuery(args, {
    version: "luna-hosted-review-v1", status: "refused", jobId: args.p_job_id,
  }));
  const client = vi.fn(() => ({ rpc }) as unknown as IftttRpcClient);
  const deps = { env: () => env, client, now: () => NOW, nonce: () => ID };
  return { env, rpc, client, deps, handler: createLunaBindingProbe(deps) };
}
function request(change: Record<string,unknown> = {}) { return { method: "GET", query: {}, headers: { authorization: `Bearer ${SECRET}` }, ...change } as NextApiRequest; }
function response() { const r = { code: 0, body: {} as any, setHeader: vi.fn(), status(n: number) { this.code=n;return this; }, json(b: unknown) {this.body=b;return this;} };return r as typeof r & NextApiResponse; }
afterEach(() => { vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();vi.useRealTimers(); });
describe("disabled bounded binding probe", () => {
  it.each([undefined,"","{}","null","broken","x".repeat(1025),JSON.stringify({...config,extra:true}),JSON.stringify({...config,expiresAt:config.startsAt}),JSON.stringify({...config,expiresAt:"2026-11-05T16:00:00.001Z"})])("refuses invalid config %#", async raw => {
    const f=fixture();f.env.IFTTT_LUNA_BINDING_CHECK_CONFIG=raw;const r=response();await f.handler(request(),r);expect(r.code).toBe(503);expect(f.client).not.toHaveBeenCalled();
  });
  it.each(["preview","development",undefined])("refuses environment %s", async value=>{const f=fixture();f.env.VERCEL_ENV=value;const r=response();await f.handler(request(),r);expect(r.body.status).toBe("disabled");expect(f.client).not.toHaveBeenCalled();});
  it.each(["IFTTT_LUNA_CAPTURE_ENABLED","IFTTT_LUNA_REVIEW_ENABLED"])("refuses active %s",async key=>{const f=fixture();f.env[key]="true";await f.handler(request(),response());expect(f.client).not.toHaveBeenCalled();});
  it.each([Date.parse(config.startsAt)-1,Date.parse(config.expiresAt),NaN])("refuses out of window %s",async time=>{const f=fixture();f.deps.now=()=>time;const r=response();await createLunaBindingProbe(f.deps)(request(),r);expect(r.code).toBe(503);expect(f.client).not.toHaveBeenCalled();});
  it.each([undefined,"wrong",`Bearer ${"x".repeat(SECRET.length)}`,[`Bearer ${SECRET}`],"x".repeat(4097)])("rejects malformed authentication %#",async authorization=>{const f=fixture(),r=response();await f.handler(request({headers:{authorization}}),r);expect(r.code).toBe(401);expect(f.client).not.toHaveBeenCalled();});
  it("rejects short configured secrets",async()=>{const f=fixture();f.env.IFTTT_LUNA_WORKER_SECRET="short";const r=response();await f.handler(request(),r);expect(r.code).toBe(401);expect(f.client).not.toHaveBeenCalled();});
  it.each([{method:"POST"},{query:{action:"claim"}},{body:{}},{headers:{authorization:`Bearer ${SECRET}`,"content-length":"1"}},{headers:{authorization:`Bearer ${SECRET}`,"transfer-encoding":"chunked"}}])("rejects request-controlled inputs %#",async change=>{const f=fixture(),r=response();await f.handler(request(change),r);expect(r.code).toBeGreaterThanOrEqual(400);expect(f.client).not.toHaveBeenCalled();});
  it.each([undefined,"https://other.supabase.co",BINDING_TARGET+"/"])("refuses target mismatch %s",async url=>{const f=fixture();f.env.NEXT_PUBLIC_SUPABASE_URL=url;const r=response();await f.handler(request(),r);expect(r.body).toEqual({status:"unverified"});expect(f.client).not.toHaveBeenCalled();});
  it("sends one pinned GET RPC and validates the exact refusal echo",async()=>{const f=fixture(),r=response();await f.handler(request(),r);expect(f.rpc).toHaveBeenCalledExactlyOnceWith("luna_hosted_review_rpc",{p_action:"luna_binding_probe_v1",p_job_id:ID,p_payload:"{}"},{get:true});expect(r.code).toBe(200);expect(r.body).toEqual({status:"verified",version:config.version,challenge:ID,checkedAt:new Date(NOW).toISOString()});expect(r.setHeader).toHaveBeenCalledWith("Cache-Control","no-store");expect(JSON.stringify(r.body)).not.toContain(SECRET);});
  it.each([null,{}, {version:"wrong",jobId:ID,status:"refused"},{version:"luna-hosted-review-v1",jobId:ID,status:"claimed"},{version:"luna-hosted-review-v1",jobId:"00000000-0000-4000-8000-000000000002",status:"refused"},{version:"luna-hosted-review-v1",jobId:ID,status:"refused",extra:true}])("refuses response mismatch %#",async data=>{const f=fixture();f.rpc.mockImplementation((_name,args)=>probeQuery(args,data));const r=response();await f.handler(request(),r);expect(r.code).toBe(503);expect(f.rpc).toHaveBeenCalledOnce();});
  it.each([{method:"POST"},{url:new URL("https://other.supabase.co/rest/v1/rpc/luna_hosted_review_rpc")},{url:new URL(`${BINDING_TARGET}/rest/v1/rpc/other`)},{body:{write:true}},{url:new URL(`${BINDING_TARGET}/rest/v1/rpc/luna_hosted_review_rpc?p_action=luna_binding_probe_v1&p_job_id=${ID}&p_payload=%7B%7D&extra=x`)}])("refuses non-pinned RPC transport %#",async override=>{const f=fixture();f.rpc.mockImplementation((_name,args)=>probeQuery(args,{version:"luna-hosted-review-v1",jobId:ID,status:"refused"},null,override));const r=response();await f.handler(request(),r);expect(r.code).toBe(503);expect(f.rpc).toHaveBeenCalledOnce();expect(f.rpc.mock.results[0].value.abortSignal).not.toHaveBeenCalled();});
  it("contains upstream errors and never retries",async()=>{const f=fixture();f.rpc.mockImplementation(()=>{throw new Error(SECRET);});const r=response();await f.handler(request(),r);expect(r.body).toEqual({status:"unverified"});expect(f.rpc).toHaveBeenCalledOnce();});
  it("contains nonthrowing RPC errors",async()=>{const f=fixture();f.rpc.mockImplementation((_name,args)=>probeQuery(args,null,SECRET));const r=response();await f.handler(request(),r);expect(r.body).toEqual({status:"unverified"});});
  it.each(["expiry","config","url","secret","activation"])("fails closed on midflight %s",async change=>{const f=fixture();let time=NOW;f.deps.now=()=>time;f.rpc.mockImplementation((_n,args)=>probeQuery(args,{version:"luna-hosted-review-v1",jobId:args.p_job_id,status:"refused"},null,{abortSignal:vi.fn(async()=>{if(change==="expiry")time=Date.parse(config.expiresAt);if(change==="config")f.env.IFTTT_LUNA_BINDING_CHECK_CONFIG="{}";if(change==="url")f.env.NEXT_PUBLIC_SUPABASE_URL="wrong";if(change==="secret")f.env.IFTTT_LUNA_WORKER_SECRET="changed";if(change==="activation")f.env.IFTTT_LUNA_CAPTURE_ENABLED="true";return {error:null,data:{version:"luna-hosted-review-v1",jobId:args.p_job_id,status:"refused"}};})}));const r=response();await createLunaBindingProbe(f.deps)(request(),r);expect(r.code).toBe(503);expect(f.rpc).toHaveBeenCalledOnce();});
  it("aborts an ignored transport at the deadline without retry or late success",async()=>{vi.useFakeTimers();const f=fixture();let signal:AbortSignal|undefined;let finish:(x:any)=>void=()=>{};f.rpc.mockImplementation((_name,args)=>probeQuery(args,null,null,{abortSignal:vi.fn((s:AbortSignal)=>{signal=s;return new Promise(resolve=>{finish=resolve;});})}));const r=response(),p=f.handler(request(),r);await vi.advanceTimersByTimeAsync(2000);await p;expect(signal?.aborted).toBe(true);expect(r.code).toBe(503);finish({error:null,data:{version:"luna-hosted-review-v1",jobId:ID,status:"refused"}});await Promise.resolve();expect(r.code).toBe(503);expect(f.rpc).toHaveBeenCalledOnce();});
});
describe("actual route composition, only Supabase client mocked",()=>{
  it("uses the shared client and fresh challenges with no capture/review activation",async()=>{const f=fixture();const routeNow=Date.now();f.env.IFTTT_LUNA_BINDING_CHECK_CONFIG=JSON.stringify({...config,startsAt:new Date(routeNow-30000).toISOString(),expiresAt:new Date(routeNow+30000).toISOString()});for(const [k,v] of Object.entries(f.env))vi.stubEnv(k,v);vi.stubEnv("IFTTT_LUNA_CAPTURE_ENABLED","false");vi.stubEnv("IFTTT_LUNA_REVIEW_ENABLED","false");vi.stubEnv("VERCEL_ENV","production");expect(process.env.VERCEL_ENV).toBe("production");expect(process.env.IFTTT_LUNA_BINDING_CHECK_CONFIG).toBe(f.env.IFTTT_LUNA_BINDING_CHECK_CONFIG);vi.mocked(getServiceRoleClient).mockReturnValue(f.client() as any);vi.stubGlobal("fetch",vi.fn(()=>{throw new Error("no provider/network");}));const a=response(),b=response();await route(request(),a);await route(request(),b);expect(a.code,JSON.stringify(a.body)).toBe(200);expect(b.code,JSON.stringify(b.body)).toBe(200);expect(a.body.challenge).not.toBe(b.body.challenge);expect(getServiceRoleClient).toHaveBeenCalledTimes(2);expect(f.rpc).toHaveBeenCalledTimes(2);expect(fetch).not.toHaveBeenCalled();expect(routeConfig.api.bodyParser).toBe(false);});
  it("does not construct the real client when disabled",async()=>{vi.stubEnv("IFTTT_LUNA_BINDING_CHECK_CONFIG","");const r=response();await route(request(),r);expect(r.body).toEqual({status:"disabled"});expect(getServiceRoleClient).not.toHaveBeenCalled();});
  it("checks the actual Supabase GET URL and method before mocked transport",async()=>{
    const routeNow=Date.now(), f=fixture();
    f.env.IFTTT_LUNA_BINDING_CHECK_CONFIG=JSON.stringify({...config,startsAt:new Date(routeNow-30000).toISOString(),expiresAt:new Date(routeNow+30000).toISOString()});
    for(const [k,v] of Object.entries(f.env))vi.stubEnv(k,v);
    vi.stubEnv("IFTTT_LUNA_CAPTURE_ENABLED","false");vi.stubEnv("IFTTT_LUNA_REVIEW_ENABLED","false");
    const calls:any[]=[];
    vi.stubGlobal("fetch",vi.fn(async(input:any,init:any)=>{const url=new URL(String(input));calls.push({url,init});return new Response(JSON.stringify({version:"luna-hosted-review-v1",jobId:url.searchParams.get("p_job_id"),status:"refused"}),{status:200,headers:{"Content-Type":"application/json"}});}));
    const client=createClient(BINDING_TARGET,"synthetic-only-not-a-credential-key",{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
    vi.mocked(getServiceRoleClient).mockReturnValue(client as any);
    const r=response();await route(request(),r);
    expect(r.code).toBe(200);expect(calls).toHaveLength(1);expect(calls[0].url.origin).toBe(BINDING_TARGET);
    expect(calls[0].url.pathname).toBe("/rest/v1/rpc/luna_hosted_review_rpc");expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.body).toBeUndefined();expect(calls[0].url.searchParams.get("p_action")).toBe("luna_binding_probe_v1");
    expect(calls[0].url.searchParams.get("p_payload")).toBe("{}");expect(routeConfig.api.bodyParser).toBe(false);
  });
  it("rejects a cached Supabase client targeting another project before transport",async()=>{
    const routeNow=Date.now(), f=fixture();
    f.env.IFTTT_LUNA_BINDING_CHECK_CONFIG=JSON.stringify({...config,startsAt:new Date(routeNow-30000).toISOString(),expiresAt:new Date(routeNow+30000).toISOString()});
    for(const [k,v] of Object.entries(f.env))vi.stubEnv(k,v);
    vi.stubEnv("IFTTT_LUNA_CAPTURE_ENABLED","false");vi.stubEnv("IFTTT_LUNA_REVIEW_ENABLED","false");
    const fetchMock=vi.fn();vi.stubGlobal("fetch",fetchMock);
    const client=createClient("https://different.supabase.co","synthetic-only-not-a-credential-key");
    vi.mocked(getServiceRoleClient).mockReturnValue(client as any);
    const r=response();await route(request(),r);expect(r.body).toEqual({status:"unverified"});expect(fetchMock).not.toHaveBeenCalled();
  });
});
