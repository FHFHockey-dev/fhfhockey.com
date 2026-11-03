// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { admitSharedNstAttempt } from "./sharedAdmission";
const permit = (allowed = true, waitMs = 0) => ({ version: 1, scope: "global-nst", allowed, waitMs, permitTtlMs: 1000 });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const setup = () => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://offline.invalid"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "mock"); };
describe("shared NST dispatch admission", () => {
  it("fails closed before fetch or dispatch when configuration is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const dispatch = vi.fn(); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(admitSharedNstAttempt(Date.now() + 5000, dispatch)).rejects.toThrow("not configured");
    expect(dispatch).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it.each([null, { ...permit(), scope: "local" }, { ...permit(), waitMs: -1 }, { ...permit(), allowed: 1 }])("rejects an invalid receipt: %j", async (receipt) => {
    setup(); vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(receipt)))); const dispatch = vi.fn();
    await expect(admitSharedNstAttempt(Date.now() + 5000, dispatch)).rejects.toThrow("invalid receipt"); expect(dispatch).not.toHaveBeenCalled();
  });
  it("rechecks shared headroom after waiting and dispatches only with a valid permit", async () => {
    setup(); vi.useFakeTimers(); const dispatch = vi.fn(async () => "fixture");
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(permit(false, 22000))))
      .mockResolvedValueOnce(new Response(JSON.stringify(permit()))); vi.stubGlobal("fetch", fetch);
    const pending = admitSharedNstAttempt(Date.now() + 50000, dispatch);
    await vi.advanceTimersByTimeAsync(0); expect(dispatch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(22000); expect(await pending).toBe("fixture"); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not dispatch or retry after an uncertain failed admission", async () => {
    setup(); const fetch = vi.fn(async () => { throw new Error("transport"); }); vi.stubGlobal("fetch", fetch); const dispatch = vi.fn();
    await expect(admitSharedNstAttempt(Date.now() + 5000, dispatch)).rejects.toThrow("outcome may be unknown");
    expect(fetch).toHaveBeenCalledTimes(1); expect(dispatch).not.toHaveBeenCalled();
  });
  it("consumes but never dispatches an expired permit", async () => {
    setup(); const clock = vi.spyOn((await import("node:perf_hooks")).performance, "now").mockReturnValueOnce(0).mockReturnValue(1001);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(permit())))); const dispatch = vi.fn();
    await expect(admitSharedNstAttempt(Date.now() + 5000, dispatch)).rejects.toThrow("expired"); expect(dispatch).not.toHaveBeenCalled(); clock.mockRestore();
  });
  it.each([1,20,39,40,78])("sends complete eligible plan%s without forcing21s pacing", async (count) => {
    setup(); const fetch = vi.fn(async (_url: any, _init?: RequestInit) => new Response(JSON.stringify(permit()))); vi.stubGlobal("fetch",fetch);
    const dispatch = vi.fn(async () => "fixture");
    expect(await admitSharedNstAttempt(Date.now()+10000,dispatch,{minIntervalMs:0,plannedRequestCount:count})).toBe("fixture");
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({p_burst:true,p_planned_requests:count});
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
  it.each([undefined,0,1.5,79])("never promotes an unknown or oversized plan%s to burst", async (count) => {
    setup(); const fetch = vi.fn(async (_url: any, _init?: RequestInit) => new Response(JSON.stringify(permit()))); vi.stubGlobal("fetch",fetch);
    await admitSharedNstAttempt(Date.now()+10000,async()=>{}, {minIntervalMs:0,plannedRequestCount:count});
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({p_burst:false,p_planned_requests:null});
  });
  it("uses actual rolling expiry and rechecks racing waiters instead of wall-clock minute boundaries", async () => {
    setup();vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-27T12:00:59.900Z"));
    let admissions=39;const dispatchTimes:number[]=[];
    const origin=Date.now();
    vi.stubGlobal("fetch",vi.fn(async()=>{
      if(Date.now()<origin+61001)return new Response(JSON.stringify(permit(false,origin+61001-Date.now())));
      if(admissions>=78)return new Response(JSON.stringify(permit(false,61001)));
      admissions++;return new Response(JSON.stringify(permit()));
    }));
    const requests=Array.from({length:2},()=>admitSharedNstAttempt(origin+120000,async()=>{dispatchTimes.push(Date.now());}, {minIntervalMs:0,plannedRequestCount:40}));
    await vi.advanceTimersByTimeAsync(100);expect(dispatchTimes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(60901);await Promise.all(requests);
    expect(dispatchTimes).toEqual([origin+61001,origin+61001]);expect(admissions).toBe(41);
  });
  it("defers before dispatch when aggregate headroom cannot fit the admission deadline",async()=>{
    setup();const dispatch=vi.fn();vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify(permit(false,61001)))));
    await expect(admitSharedNstAttempt(Date.now()+50000,dispatch,{minIntervalMs:0,plannedRequestCount:40})).rejects.toThrow("deadline");
    expect(dispatch).not.toHaveBeenCalled();
  });

});
