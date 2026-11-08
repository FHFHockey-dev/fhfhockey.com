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

vi.mock("/Users/tim/Code/fhfhockey.com/web/lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock
}));

vi.mock("/Users/tim/Code/fhfhockey.com/web/utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: fetchCurrentSeasonMock
}));

vi.mock("/Users/tim/Code/fhfhockey.com/web/lib/nst/client", () => ({
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

import handler from "/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-goalies";

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


describe("independent enabled goalie lifecycle reproduction", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01T13:00:00Z"));
    vi.stubEnv("CRON_SECRET", "unit-test-cron-secret"); vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "true");
    vi.clearAllMocks();
    existsMock.mockReset().mockResolvedValue({data:[],error:null});
    fetchCurrentSeasonMock.mockResolvedValue({id:20252026,startDate:"2025-10-01",endDate:"2025-10-01"});
    fetchNstTextByUrlMock.mockResolvedValue({text:'<table><thead><tr><th>Player</th><th>Team</th><th>GP</th></tr></thead><tbody><tr><td>John Goalie</td><td>TOR</td><td>1</td></tr></tbody></table>'});
  });
  afterEach(() => {vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();});
  it.each(["complete","bounded partial"])("reproduces false global hold for %s", async mode => {
    const calls:string[]=[];
    vi.stubGlobal("fetch",vi.fn(async(url,init)=>{
      const name=String(url).split("/").at(-1)!; calls.push(name);
      const args=JSON.parse(init!.body as string);
      return new Response(JSON.stringify({status:name.includes("begin")?"started":name.includes("finish")?"finished":"held",token:args.p_token}));
    }));
    const res=createMockRes();
    const pending=handler({method:"GET",headers:{authorization:"Bearer unit-test-cron-secret"},query:{startDate:"2025-10-01",maxDays:"1",...(mode==="complete"?{datasetType:"allCounts"}:{maxUrls:"1"})}} as any,res);
    await vi.runAllTimersAsync();await pending;
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(503);
    expect(calls).toEqual(["nst_job_begin_v1","nst_job_hold_v1"]);
    expect(res.body.operationResponse).toMatchObject(mode==="complete"?{success:true,complete:true,operationStatus:"complete",retrySafe:false}:{success:false,complete:false,operationStatus:"partial",retrySafe:true});
    console.log(JSON.stringify({mode,statusCode:res.statusCode,lifecycle:calls,operationResponse:res.body.operationResponse}));
  });
});
