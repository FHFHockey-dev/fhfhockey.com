import { GOALIE_DATASETS } from "lib/nst/goalieCatchup";
import { createMemoryRouteRunnerStore, makeJob } from "lib/routeRunner/memoryStore.testHelper";
import { runRouteRunnerTick } from "lib/routeRunner/tick";
const { auditInsertMock } = vi.hoisted(()=>({auditInsertMock:vi.fn(async(_row:any)=>({error:null}))}));
vi.mock("lib/supabase/server",()=>({default:{from:()=>({insert:auditInsertMock})}}));
import { NstExecutionLimitError } from "lib/nst/requestBudget";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  fetchCurrentSeasonMock,
  fetchNstTextByUrlMock,
  isNstConfigErrorMock,
  upsertMock, existsMock, checkpointRpcMock, exactIdentityMock
} = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

  const existsMock = vi.fn().mockResolvedValue({ data: [], error: null });
  const upsertMock = vi.fn().mockResolvedValue({ error: null });

  const checkpointRpcMock = vi.fn();
  const exactIdentityMock = vi.fn().mockResolvedValue({ data: { id: 8478402 }, error: null });
  const supabaseClient = {
    rpc: checkpointRpcMock,
    from(table: string) {
      if (table === "players") {
        return {
          select() {
            return {
              eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: exactIdentityMock }) }) }),
              ilike() {
                return {
                  eq() {
                    return {
                      limit() {
                        return {
                          maybeSingle: vi.fn().mockResolvedValue({
                            data: { id: 8478402 },
                            error: null
                          })
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }

      return {
        select() {
          return {
            eq() {
              return {
                limit: existsMock
              };
            }
          };
        },
        upsert: upsertMock
      };
    }
  };

  return {
    createClientMock: vi.fn(() => supabaseClient),
    fetchCurrentSeasonMock: vi.fn(),
    fetchNstTextByUrlMock: vi.fn(),
    isNstConfigErrorMock: vi.fn((error: unknown) =>
      error instanceof Error && error.name === "NstConfigError"
    ),
    upsertMock, existsMock, checkpointRpcMock, exactIdentityMock
  };
});

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock
}));

vi.mock("../../../../../utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: fetchCurrentSeasonMock
}));

vi.mock("../../../../../lib/nst/client", () => ({
  fetchNstTextByUrl: fetchNstTextByUrlMock,
  isNstAuthError: vi.fn(() => false),
  isNstConfigError: isNstConfigErrorMock,
  isNstRateLimitError: vi.fn(() => false)
}));

vi.mock("dotenv", () => ({
  default: {
    config: vi.fn()
  }
}));

import handler from "../../../../../pages/api/v1/db/update-nst-goalies";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  } as any;
}

describe("/api/v1/db/update-nst-goalies", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("CRON_SECRET", "unit-test-cron-secret");
    vi.clearAllMocks();
    existsMock.mockReset().mockResolvedValue({ data: [], error: null });
    checkpointRpcMock.mockReset();
    exactIdentityMock.mockReset().mockResolvedValue({ data: { id: 8478402 }, error: null });
  });

  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it("keeps disabled daily preparation bounded and separate from provider work", async () => {
    checkpointRpcMock.mockResolvedValue({ data: { version: 1, enabled: false, reviewRequired: false }, error: null });
    const res = createMockRes();
    await handler({ method: "GET", headers: { authorization: "Bearer unit-test-cron-secret" }, query: { prepareCatchup: "true" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: "disabled", sourceRequests: 0 });
    expect(checkpointRpcMock).toHaveBeenCalledTimes(1);
    expect(fetchNstTextByUrlMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
    const mixed = createMockRes();
    await handler({ method: "GET", headers: { authorization: "Bearer unit-test-cron-secret" }, query: { prepareCatchup: "true", startDate: "2026-10-31" } } as any, mixed);
    expect(mixed.statusCode).toBe(400); expect(checkpointRpcMock).toHaveBeenCalledTimes(1);
  });

  it("preserves representative playerteams goalie upsert shape through the migrated NST client", async () => {
    fetchCurrentSeasonMock.mockResolvedValue({
      id: 20252026,
      startDate: "2025-10-01",
      endDate: "2025-10-01"
    });

    fetchNstTextByUrlMock.mockResolvedValue({
      text: `
        <html>
          <body>
            <table>
              <thead>
                <tr><th>Player</th><th>Team</th><th>GP</th><th>TOI</th><th>Shots Against</th><th>Saves</th><th>Goals Against</th><th>SV%</th></tr>
              </thead>
              <tbody>
                <tr><td>John Goalie</td><td>TOR</td><td>1</td><td>60</td><td>30</td><td>28</td><td>2</td><td>93.3</td></tr>
              </tbody>
            </table>
          </body>
        </html>
      `,
      response: new Response("", { status: 200, statusText: "OK" })
    });

    const req: any = {
      method: "GET",
      headers: { host: "localhost", authorization: "Bearer unit-test-cron-secret" },
      query: {
        startDate: "2025-10-01",
        maxUrls: "1",
        maxDays: "1"
      }
    };
    const res = createMockRes();

    const pending = handler(req, res);
    await vi.runAllTimersAsync();
    await pending;

    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          player_name: "John Goalie",
          team: "TOR",
          player_id: 8478402,
          date_scraped: "2025-10-01",
          season: 20252026,
          gp: 1,
          toi: 60,
          shots_against: 30,
          saves: 28,
          goals_against: 2,
          sv_percentage: 93.3
        })
      ],
      { onConflict: "player_id,date_scraped" }
    );
    expect(res.statusCode).toBe(207);
    expect(res.body).toMatchObject({
      pendingUrlsProcessed: 1,
      totalQueuedUrls: 10,
      datesQueued: 1,
      stoppedEarly: true
    });
    expect(res.body.nstRequestPlan).toMatchObject({ burstAllowed: true, requestIntervalMs: 0 });
    expect(fetchNstTextByUrlMock.mock.calls[0][1].requestControl).toMatchObject({minIntervalMs:0,plannedRequestCount:10});
  });

  it("fails fast on missing NST configuration instead of retrying it", async () => {
    fetchCurrentSeasonMock.mockResolvedValue({
      id: 20252026,
      startDate: "2025-10-01",
      endDate: "2025-10-01"
    });
    fetchNstTextByUrlMock.mockRejectedValue(
      Object.assign(new Error("NST_KEY missing"), {
        name: "NstConfigError"
      })
    );

    const res = createMockRes();
    const pending = handler(
      {
        method: "GET",
        headers: { host: "localhost", authorization: "Bearer unit-test-cron-secret" },
        query: {
          startDate: "2025-10-01",
          maxUrls: "1",
          maxDays: "1"
        }
      } as any,
      res
    );
    await vi.runAllTimersAsync();
    await pending;

    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({success:false,complete:false,pendingUrlsProcessed:0,operationStatus:"failed"});
  });
  async function invoke(query:Record<string,string>={}, route=handler) {
    const res=createMockRes();const pending=route({method:"GET",headers:{host:"localhost",authorization:"Bearer unit-test-cron-secret"},
      query:{startDate:"2025-10-01",maxDays:"1",...query}} as any,res);
    await vi.runAllTimersAsync();await pending;return res;
  }
  const html=`<table><thead><tr><th>Player</th><th>Team</th><th>GP</th></tr></thead><tbody><tr><td>John Goalie</td><td>TOR</td><td>1</td></tr></tbody></table>`;
  it("excludes the current New York date from provider work", async () => {
    vi.setSystemTime(new Date("2026-11-01T13:00:00Z"));
    fetchCurrentSeasonMock.mockResolvedValue({ id: 20262027, startDate: "2026-10-28", endDate: "2027-04-15" });
    fetchNstTextByUrlMock.mockResolvedValue({ text: html });
    const result = await invoke({ startDate: "2026-10-28", maxDays: "5", datasetType: "allCounts" });
    expect(result.body).toMatchObject({ datesQueued: 4, totalQueuedUrls: 4, plannedUrls: 4 });
    expect(result.body.urlProgress.map((row: any) => row.date)).toEqual(["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"]);
  });
  it("plans all missing URLs before applying a per-call cap and freezes that plan across continuation", async () => {
    fetchCurrentSeasonMock.mockResolvedValue({ id: 20252026, startDate: "2025-10-01", endDate: "2025-10-04" });
    fetchNstTextByUrlMock.mockResolvedValue({ text: html });
    existsMock.mockResolvedValueOnce({ data: [{ player_id: 1 }], error: null });
    const first = await invoke({ maxDays: "4", maxUrls: "1" });
    expect(first.body).toMatchObject({ totalQueuedUrls: 40, plannedUrls: 39, pendingUrlsAtStart: 39, requestIntervalMs: 0, nextCursor: 2 });
    const second = await invoke(first.body.resume.request.query);
    expect(second.body).toMatchObject({ plannedUrls: 39, pendingUrlsAtStart: 38, nextCursor: 3 });
    expect(second.body.resume.request.query.resumeScope).toBe(first.body.resume.request.query.resumeScope);
  });
  it("retains strict pacing when a 40-URL plan has fewer than 40 URLs remaining", async () => {
    fetchCurrentSeasonMock.mockResolvedValue({ id: 20252026, startDate: "2025-10-01", endDate: "2025-10-04" });
    fetchNstTextByUrlMock.mockResolvedValue({ text: html });
    const first = await invoke({ maxDays: "4", maxUrls: "1" });
    const second = await invoke(first.body.resume.request.query);
    expect(second.body).toMatchObject({ plannedUrls: 40, pendingUrlsAtStart: 39, requestIntervalMs: 21000 });
  });
  it.each(["error", "timeout"])("fails closed on a coverage read %s before NST dispatch", async kind => {
    fetchCurrentSeasonMock.mockResolvedValue({ id: 20252026, startDate: "2025-10-01", endDate: "2025-10-01" });
    if (kind === "error") existsMock.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    else existsMock.mockImplementation(() => new Promise(() => {}));
    const result = await invoke();
    expect(result.statusCode).toBe(500);
    expect(fetchNstTextByUrlMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });
  it("does not start NST when the runner deadline leaves insufficient headroom", async () => {
    fetchCurrentSeasonMock.mockResolvedValue({ id: 20252026, startDate: "2025-10-01", endDate: "2025-10-01" });
    const result = await invoke({ deadlineAt: String(Date.now() + 30_000) });
    expect(result.statusCode).toBe(500);
    expect(fetchNstTextByUrlMock).not.toHaveBeenCalled();
  });
  it.each([{ plannedUrls: "1" }, { cursor: "1", resumeScope: "a".repeat(64) }] as Record<string, string>[])("rejects unscoped or legacy request plans", async query => {
    fetchCurrentSeasonMock.mockResolvedValue({ id: 20252026, startDate: "2025-10-01", endDate: "2025-10-01" });
    const result = await invoke(query);
    expect(result.statusCode).toBe(500);
    expect(fetchNstTextByUrlMock).not.toHaveBeenCalled();
  });
  it.each(["minute headroom","five-minute headroom","late deadline"])("defers %s without dispatch, upsert, completed URL or cursor advance",async(reason)=>{
    fetchCurrentSeasonMock.mockResolvedValue({id:20252026,startDate:"2025-10-01",endDate:"2025-10-01"});
    fetchNstTextByUrlMock.mockRejectedValue(new NstExecutionLimitError(reason));
    const result=await invoke();
    expect(result.statusCode).toBe(207);expect(result.body).toMatchObject({success:false,complete:false,stoppedEarly:true,pendingUrlsProcessed:0,totalQueuedUrls:10,nextStartDate:"2025-10-01",nextCursor:0});
    expect(result.body.urlProgress[0].status).toBe("deferred");expect(result.body.unattemptedUrls).toBe(10);
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(1);expect(upsertMock).not.toHaveBeenCalled();
  });
  it("retains prior acknowledged writes and resumes exactly at the deferred URL even with overwrite",async()=>{
    fetchCurrentSeasonMock.mockResolvedValue({id:20252026,startDate:"2025-10-01",endDate:"2025-10-01"});
    fetchNstTextByUrlMock.mockReset().mockResolvedValueOnce({text:html}).mockRejectedValueOnce(new NstExecutionLimitError("shared deadline"));
    const first=await invoke({overwrite:"yes"});
    expect(first.body).toMatchObject({success:false,complete:false,pendingUrlsProcessed:1,nextCursor:1,acknowledgedWriteUrls:1});
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const completedUrl=fetchNstTextByUrlMock.mock.calls[0][0];const deferredUrl=fetchNstTextByUrlMock.mock.calls[1][0];
    const callsBefore=fetchNstTextByUrlMock.mock.calls.length;
    const changedScope=await invoke({...first.body.resume.request.query,resumeScope:"changed"});
    expect(changedScope.statusCode).toBe(500);expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(callsBefore);
    fetchNstTextByUrlMock.mockReset().mockResolvedValue({text:html});
    const second=await invoke(first.body.resume.request.query);
    expect(second.body.complete).toBe(true);expect(fetchNstTextByUrlMock.mock.calls[0][0]).toBe(deferredUrl);
    expect(fetchNstTextByUrlMock.mock.calls.some(([url])=>url===completedUrl)).toBe(false);expect(upsertMock).toHaveBeenCalledTimes(10);
  });
  it("separates a valid empty table from malformed HTML and provider failure",async()=>{
    fetchCurrentSeasonMock.mockResolvedValue({id:20252026,startDate:"2025-10-01",endDate:"2025-10-01"});
    fetchNstTextByUrlMock.mockResolvedValue({text:'<table><thead><tr><th>Player</th><th>Team</th><th>GP</th></tr></thead><tbody></tbody></table>'});
    const empty=await invoke({datasetType:"5v5Counts"});expect(empty.body).toMatchObject({complete:true,emptyValidUrls:1,acknowledgedWriteUrls:0});
    fetchNstTextByUrlMock.mockResolvedValue({text:"gateway page"});const malformed=await invoke();
    expect(malformed.statusCode).toBe(500);expect(malformed.body).toMatchObject({success:false,complete:false,nextCursor:0});
    expect(malformed.body.urlProgress[0].status).toBe("failed");expect(malformed.body.resume).toBeUndefined();
    fetchNstTextByUrlMock.mockRejectedValue(new Error("upstream timeout"));const failed=await invoke();
    expect(failed.statusCode).toBe(500);expect(failed.body.complete).toBe(false);expect(failed.body.pendingUrlsProcessed).toBe(0);
  });
  it("does not offer automatic replay after provider completion acknowledgment or database uncertainty",async()=>{
    fetchCurrentSeasonMock.mockResolvedValue({id:20252026,startDate:"2025-10-01",endDate:"2025-10-01"});
    fetchNstTextByUrlMock.mockRejectedValue(Object.assign(new NstExecutionLimitError("completion acknowledgment missing"),{dispatchStarted:true}));
    const postDispatch=await invoke();expect(postDispatch.statusCode).toBe(500);expect(postDispatch.body.resume).toBeUndefined();
    fetchNstTextByUrlMock.mockResolvedValue({text:html});upsertMock.mockRejectedValueOnce(new Error("lost database acknowledgment"));
    const database=await invoke();expect(database.body).toMatchObject({success:false,complete:false,requiresReview:true,retrySafe:false});
    expect(database.body.resume).toBeUndefined();expect(database.body.nextCursor).toBe(0);
  });

  it("records actual wrapped deferral as continued and provider failure as failure, never healthy completion",async()=>{
    const actual=await vi.importActual<typeof import("lib/cron/withCronJobAudit")>("lib/cron/withCronJobAudit");
    fetchCurrentSeasonMock.mockResolvedValue({id:20252026,startDate:"2025-10-01",endDate:"2025-10-01"});
    fetchNstTextByUrlMock.mockRejectedValue(new NstExecutionLimitError("shared headroom"));
    const deferred=await invoke({},actual.withCronJobAudit(handler as any) as any);
    expect(deferred.statusCode).toBe(207);expect(deferred.body).toMatchObject({success:false,complete:false,nextCursor:0});
    expect(auditInsertMock).toHaveBeenLastCalledWith(expect.objectContaining({status:"continued",rows_affected:null}));
    fetchNstTextByUrlMock.mockRejectedValue(new Error("upstream timeout"));
    const failed=await invoke({},actual.withCronJobAudit(handler as any) as any);
    expect(failed.statusCode).toBe(500);expect(auditInsertMock).toHaveBeenLastCalledWith(expect.objectContaining({status:"failure"}));
  });

  it.each(["rows","admission pause","initial admission pause","empty valid"])("real route and tick finish ten distinct goalie URLs with %s",async(mode)=>{
    vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
    fetchCurrentSeasonMock.mockResolvedValue({id:20252026,startDate:"2025-10-01",endDate:"2025-10-01"});
    upsertMock.mockReset().mockResolvedValue({error:null});auditInsertMock.mockReset().mockResolvedValue({error:null});
    const dispatched:string[]=[];let paused=false;
    fetchNstTextByUrlMock.mockReset().mockImplementation(async(url:string)=>{
      if(((mode==="admission pause"&&dispatched.length===1)||(mode==="initial admission pause"&&dispatched.length===0))&&!paused){paused=true;throw new NstExecutionLimitError("shared admission cannot fit deadline");}
      dispatched.push(url);return {text:mode==="empty valid"?html.replace(/<tbody>.*<\/tbody>/,"<tbody></tbody>"):html};
    });
    const path="/api/v1/db/update-nst-goalies";
    const query={startDate:"2025-10-01",maxDays:"1",overwrite:"yes",maxUrls:"1"};
    // Existing queued jobs carry the old stored contract; the tick must use the registry.
    const job=makeJob({route_path:path,contract:"next_start_date",initial_query:query,next_query:query,
      created_at:new Date().toISOString(),expires_at:"2026-10-30T10:00:00Z"});
    const memory=createMemoryRouteRunnerStore([job]);
    const actual=await vi.importActual<typeof import("lib/cron/withCronJobAudit")>("lib/cron/withCronJobAudit");
    const audited=actual.withCronJobAudit(handler as any);
    for(let n=0;n<15;n++){
      const pending=runRouteRunnerTick({store:memory.store,handlers:{[path]:audited},cronSecret:"unit-test-cron-secret",now:Date.now});
      await vi.runAllTimersAsync();await pending;
      const current=memory.jobs.get(job.id)!;
      expect(current.status).not.toBe("failed");
      if(current.status==="completed")break;
      if(current.status==="waiting"){
        expect(current.next_query.cursor).toBe(mode==="initial admission pause"?"0":"1");expect(current.next_query.resumeScope).toMatch(/^[a-f0-9]{64}$/);
        expect(current.progress).toMatchObject({stalls:0});vi.setSystemTime(new Date(current.not_before!));
      }
    }
    expect(memory.jobs.get(job.id)!.status).toBe("completed");
    expect(dispatched).toHaveLength(10);expect(new Set(dispatched).size).toBe(10);
    expect(upsertMock).toHaveBeenCalledTimes(mode==="empty valid"?0:10);
    expect(memory.events.some(event=>event.message.includes("No progress"))).toBe(false);
    expect(auditInsertMock.mock.calls.every(([row])=>row.status==="continued"||row.status==="success")).toBe(true);
  });

  it.each(["changed scope","extra field","unpersisted audit"])("real goalie runner stops on %s instead of replaying the first URL",async(kind)=>{
    vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
    fetchCurrentSeasonMock.mockResolvedValue({id:20252026,startDate:"2025-10-01",endDate:"2025-10-01"});
    upsertMock.mockReset().mockResolvedValue({error:null});fetchNstTextByUrlMock.mockReset().mockResolvedValue({text:html});
    auditInsertMock.mockReset().mockResolvedValue({error:null});
    if(kind==="unpersisted audit")auditInsertMock.mockResolvedValueOnce({error:{message:"audit rejected"}} as any);
    const actual=await vi.importActual<typeof import("lib/cron/withCronJobAudit")>("lib/cron/withCronJobAudit");
    const audited=actual.withCronJobAudit(handler as any);const path="/api/v1/db/update-nst-goalies";
    const query={startDate:"2025-10-01",maxDays:"1",overwrite:"yes",maxUrls:"1"};
    const job=makeJob({route_path:path,initial_query:query,next_query:query,expires_at:"2026-10-30T10:00:00Z"});
    const memory=createMemoryRouteRunnerStore([job]);
    const route=async(req:any,res:any)=>{
      const json=res.json.bind(res);
      res.json=(body:any)=>{
        if(kind==="changed scope")body.resume.request.query.startDate="2025-10-02";
        if(kind==="extra field")body.resume.request.query.unapproved="value";
        return json(body);
      };
      await audited(req,res);
    };
    const pending=runRouteRunnerTick({store:memory.store,handlers:{[path]:route},cronSecret:"unit-test-cron-secret",now:Date.now});
    await vi.runAllTimersAsync();const result=await pending;
    expect(result.outcome).toBe("fail");expect(memory.jobs.get(job.id)!.status).toBe("failed");
    expect(upsertMock).toHaveBeenCalledTimes(1);expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(1);
  });

  it.each(["legacy date-only progress","abandoned tick"])("holds %s before another goalie write",async(kind)=>{
    vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
    fetchNstTextByUrlMock.mockReset();upsertMock.mockReset();
    const path="/api/v1/db/update-nst-goalies";const query={startDate:"2025-10-01",maxUrls:"1",overwrite:"yes"};
    const job=makeJob({route_path:path,contract:"next_start_date",initial_query:query,next_query:query,steps:1,
      status:kind==="abandoned tick"?"running":"queued",lease_until:kind==="abandoned tick"?"2026-10-27T09:55:00Z":null,
      expires_at:"2026-10-30T10:00:00Z"});const memory=createMemoryRouteRunnerStore([job]);
    const result=await runRouteRunnerTick({store:memory.store,handlers:{[path]:handler},cronSecret:"unit-test-cron-secret",now:Date.now});
    expect(result.outcome).toBe("fail");expect(memory.jobs.get(job.id)!).toMatchObject({status:"failed",next_query:query});
    expect(fetchNstTextByUrlMock).not.toHaveBeenCalled();expect(upsertMock).not.toHaveBeenCalled();
  });
  it("holds a timed-out actual goalie write rather than scheduling an unsafe replay",async()=>{
    vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
    fetchCurrentSeasonMock.mockResolvedValue({id:20252026,startDate:"2025-10-01",endDate:"2025-10-01"});
    fetchNstTextByUrlMock.mockReset().mockResolvedValue({text:html});upsertMock.mockReset().mockImplementation(()=>new Promise(()=>{}));
    const path="/api/v1/db/update-nst-goalies";const query={startDate:"2025-10-01",maxDays:"1",maxUrls:"1",overwrite:"yes"};
    const job=makeJob({route_path:path,initial_query:query,next_query:query,expires_at:"2026-10-30T10:00:00Z"});
    const memory=createMemoryRouteRunnerStore([job]);
    const pending=runRouteRunnerTick({store:memory.store,handlers:{[path]:handler},cronSecret:"unit-test-cron-secret",now:Date.now});
    await vi.runAllTimersAsync();const result=await pending;
    expect(result).toMatchObject({ action: "stepped", outcome: "fail" });expect(memory.jobs.get(job.id)!.status).toBe("failed");
    expect(Date.now()).toBe(new Date("2026-10-27T10:00:15Z").getTime());
    expect(upsertMock).toHaveBeenCalledTimes(1);
    await runRouteRunnerTick({store:memory.store,handlers:{[path]:handler},cronSecret:"unit-test-cron-secret",now:Date.now});
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  function checkpointFixture() {
    vi.setSystemTime(new Date("2026-11-01T11:10:00Z"));
    const scope = "a".repeat(64), claimId = "00000000-0000-4000-8000-000000000001";
    const units = GOALIE_DATASETS.map(dataset => ({ key: `20262027/2026-10-31/${dataset}`, date: "2026-10-31", dataset,
      state: dataset === "allCounts" ? "pending" : "complete", reason: null }));
    checkpointRpcMock.mockImplementation(async (name: string, args: any) => {
      if (name === "nst_goalie_read_state_v1") return { data: { manifest: { version: 1, season: "20262027", sourceVersion: "fixture",
        scope, startDate: "2026-10-31", endDate: "2026-10-31", plannedRequestCount: 1, nextUnplannedDate: null, units },
        budget: { utcDate: "2026-11-01", steps: 0, attempts: 0 }, sharedJobActive: false, reviewRequired: false, lastDirectJobFinishedAt: null }, error: null };
      if (name === "nst_goalie_claim_step_v1") return { data: { status: "claimed", scope, claimId, utcDate: "2026-11-01",
        unitKeys: args.p_unit_keys, plannedRequestCount: 1, attemptsReserved: 3, deadlineAt: args.p_deadline_at }, error: null };
      if (name === "nst_goalie_commit_unit_v1") return { data: { status: "committed", scope, claimId, unitKey: args.p_unit_key,
        receiptId: "00000000-0000-4000-8000-000000000002", sourceFingerprint: args.p_source_fingerprint,
        completionStatus: "complete", parsedRows: 1, mappedRows: 1, writtenRows: 1, allCountsCoverage: "complete" }, error: null };
      if (name === "nst_goalie_finish_step_v1") return { data: { status: "finished", scope, claimId, attemptsUsed: 1,
        attemptsCharged: 3, unusedReleased: 0, committedUnitKeys: args.p_committed_unit_keys }, error: null };
      if (name === "nst_goalie_hold_step_v1") return { data: { status: "held", scope, claimId }, error: null };
      throw new Error("unexpected RPC");
    });
    const body = `<table><thead><tr><th>Player</th><th>Team</th><th>GP</th><th>TOI</th><th>Shots Against</th><th>Saves</th><th>Goals Against</th><th>xG Against</th><th>HD Shots Against</th><th>HD Saves</th></tr></thead><tbody><tr><td>John Goalie</td><td>TOR</td><td>1</td><td>60</td><td>30</td><td>28</td><td>2</td><td>2.1</td><td>5</td><td>4</td></tr></tbody></table>`;
    fetchNstTextByUrlMock.mockImplementation(async (_url, options) => { options.requestControl.attemptsStarted++; return { text: body }; });
    return { scope, body };
  }
  async function invokeCheckpoint(query: Record<string, string>) {
    const res = createMockRes();
    const pending = handler({ method: "GET", headers: { host: "localhost", authorization: "Bearer unit-test-cron-secret" }, query } as any, res);
    await vi.runAllTimersAsync(); await pending; return res;
  }
  it("uses the actual checkpoint adapter to atomically commit output without legacy upserts", async () => {
    const { scope } = checkpointFixture(); const res = await invokeCheckpoint({ catchupScope: scope });
    expect(res.statusCode).toBe(200); expect(res.body).toMatchObject({ checkpointVersion: 1, status: "complete", complete: true });
    expect(upsertMock).not.toHaveBeenCalled(); expect(fetchCurrentSeasonMock).not.toHaveBeenCalled();
    const commit = checkpointRpcMock.mock.calls.find(([name]) => name === "nst_goalie_commit_unit_v1")![1];
    expect(commit.p_rows[0]).toMatchObject({ player_id: 8478402, date_scraped: "2026-10-31", hd_saves: 4 });
    expect(commit.p_source_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fetchNstTextByUrlMock.mock.calls[0][1].requestControl).toMatchObject({ plannedRequestCount: 1, maxAttempts: 3 });
  });
  it("runs the checkpoint route through the audited runner and completes its frozen scope", async () => {
    const { scope } = checkpointFixture();
    auditInsertMock.mockReset().mockResolvedValue({ error: null });
    const actual = await vi.importActual<typeof import("lib/cron/withCronJobAudit")>("lib/cron/withCronJobAudit");
    const path = "/api/v1/db/update-nst-goalies", query = { catchupScope: scope };
    const job = makeJob({ route_path: path, contract: null, initial_query: query, next_query: query, expires_at: "2026-11-04T11:10:00Z" });
    const memory = createMemoryRouteRunnerStore([job]);
    const pending = runRouteRunnerTick({ store: memory.store, handlers: { [path]: actual.withCronJobAudit(handler as any) },
      cronSecret: "unit-test-cron-secret", now: Date.now });
    await vi.runAllTimersAsync();
    expect((await pending).outcome).toBe("complete");
    expect(memory.jobs.get(job.id)!.status).toBe("completed");
    expect(fetchNstTextByUrlMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).not.toHaveBeenCalled();
  });
  it("makes no provider call when checkpoint SQL is absent or scope is mixed", async () => {
    const { scope } = checkpointFixture(); checkpointRpcMock.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect((await invokeCheckpoint({ catchupScope: scope })).body.status).toBe("deferred");
    expect((await invokeCheckpoint({ catchupScope: scope, startDate: "2026-10-31" })).statusCode).toBe(400);
    expect(fetchNstTextByUrlMock).not.toHaveBeenCalled();
  });
  it.each(["ambiguous identity", "missing empty headers", "blank core field"])("holds checkpoint source on %s", async kind => {
    const { scope, body } = checkpointFixture();
    if (kind === "ambiguous identity") exactIdentityMock.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    else fetchNstTextByUrlMock.mockImplementation(async (_url, options) => {
      options.requestControl.attemptsStarted++;
      return { text: kind === "missing empty headers" ? "<table><thead><tr><th>Player</th><th>Team</th></tr></thead><tbody></tbody></table>" : body.replace("<td>4</td>", "<td></td>") };
    });
    const res = await invokeCheckpoint({ catchupScope: scope });
    expect(res.statusCode).toBe(409); expect(res.body.requiresReview).toBe(true);
    expect(checkpointRpcMock.mock.calls.some(([name]) => name === "nst_goalie_commit_unit_v1")).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

});
