// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertNstJobActive, currentNstJob, markNstJobUncertain, nstLifecycleRpc, runNstJob, withNstJobLifecycle, withGoalieJob, withNstJobDispatch, type NstLifecycleRpc } from "./jobLifecycle.server";
import { admitSharedNstAttempt } from "./sharedAdmission";

beforeEach(() => { vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "true"); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function fixture() {
  const rpc = vi.fn<NstLifecycleRpc>(async (name, args) => ({ status: name.includes("begin") ? "started" : name.includes("finish") ? "finished" : "held", token: args.p_token }));
  const input = { owner: "fixture", deadlineAt: Date.now() + 120_000, settled: (value: boolean) => value, rpc };
  return { input, rpc };
}
describe("explicit enclosing NST lifecycle", () => {
  it("stays disabled without any control-plane request", async () => {
    vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "false"); const f = fixture();
    expect(await runNstJob(f.input, async () => currentNstJob() === undefined)).toBe(true);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("finishes only after provider bodies and awaited output settle", async () => {
    const f = fixture(); const events: string[] = [];
    await runNstJob(f.input, async () => {
      expect(currentNstJob()?.kind).toBe("direct");
      await withNstJobDispatch(async () => { events.push("body"); });
      await Promise.resolve().then(() => events.push("output"));
      expect(f.rpc).toHaveBeenCalledTimes(1); return true;
    });
    expect(events).toEqual(["body", "output"]);
    expect(f.rpc.mock.calls.map(c => c[0])).toEqual(["nst_job_begin_v1", "nst_job_finish_v1"]);
    expect(currentNstJob()).toBeUndefined();
  });
  it.each(["rejected", "unsettled", "unfinished", "finish-unknown"])("holds %s without claiming clearance", async kind => {
    const f = fixture(); let release: (() => void) | undefined;
    if (kind === "finish-unknown") f.rpc.mockImplementation(async (name, args) => {
      if (name.includes("finish")) throw new Error("Lost finish acknowledgement");
      return { status: name.includes("begin") ? "started" : "held", token: args.p_token };
    });
    const work = async () => {
      if (kind === "rejected") throw new Error("Write unknown");
      if (kind === "unfinished") {
        void withNstJobDispatch(() => new Promise<void>(resolve => { release = resolve; })).catch(() => {});
        await Promise.resolve();
      }
      return kind !== "unsettled";
    };
    await expect(runNstJob(f.input, work)).rejects.toThrow(); release?.();
    expect(f.rpc.mock.calls.at(-1)?.[0]).toBe("nst_job_hold_v1");
    expect(f.rpc.mock.calls.filter(c => c[0] === "nst_job_finish_v1")).toHaveLength(kind === "finish-unknown" ? 1 : 0);
  });
  it("never starts work after an unknown begin and rejects late detached dispatch", async () => {
    const f = fixture(); f.rpc.mockRejectedValueOnce(new Error("begin unknown")); const work = vi.fn(async () => true);
    await expect(runNstJob(f.input, work)).rejects.toThrow(); expect(work).not.toHaveBeenCalled(); expect(f.rpc).toHaveBeenCalledTimes(1);
    const g = fixture(); let later: Promise<unknown> | undefined; let release: (() => void) | undefined;
    await runNstJob(g.input, async () => {
      later = new Promise<void>(resolve => { release = resolve; }).then(() => withNstJobDispatch(async () => true)); return true;
    });
    const assertion = expect(later).rejects.toThrow("closed"); release?.(); await assertion;
  });
  it("binds direct and goalie attempt admission to the correct durable token", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://offline.invalid"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture");
    const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response(JSON.stringify({ version: 1, scope: "global-nst", allowed: true, waitMs: 0, permitTtlMs: 1000 })));
    vi.stubGlobal("fetch", fetch); const f = fixture();
    await runNstJob(f.input, async () => { await admitSharedNstAttempt(Date.now() + 5000, async () => true); return true; });
    expect(String(fetch.mock.calls[0][0])).toContain("nst_admit_job_attempt_v1");
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({ p_kind: "direct", p_token: f.rpc.mock.calls[0][1].p_token });
    const token = "00000000-0000-4000-8000-000000000001";
    await withGoalieJob(token, Date.now() + 5000, () => admitSharedNstAttempt(Date.now() + 5000, async () => true));
    expect(JSON.parse(fetch.mock.calls[1][1]!.body as string)).toMatchObject({ p_kind: "goalie", p_token: token });
  });
  it("buffers the audited JSON result until finish and fails closed on a lost finish", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://offline.invalid"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture");
    for (const lost of [false, true]) {
      const sent = vi.fn();
      const res: any = { statusCode: 200, headersSent: false, status(code: number) { this.statusCode = code; return this; }, json: sent };
      vi.stubGlobal("fetch", vi.fn(async (url, init) => {
        const name = String(url).split("/").at(-1)!; const body = JSON.parse(init!.body as string);
        expect(sent).not.toHaveBeenCalled();
        if (lost && name === "nst_job_finish_v1") throw new Error("ack lost");
        return new Response(JSON.stringify({ status: name.includes("begin") ? "started" : name.includes("finish") ? "finished" : "held", token: body.p_token }));
      }));
      const handler = withNstJobLifecycle(async (_req, output) => { output.json({ success: true, auditPersisted: true }); }, "fixture-route");
      await handler({} as any, res);
      expect(res.statusCode).toBe(lost ? 503 : 200);
      expect(sent).toHaveBeenCalledTimes(1);
      expect(sent.mock.calls[0][0]).toMatchObject(lost ? { success: false, retrySafe: false } : { success: true, auditPersisted: true });
    }
  });
  it("bounds control-plane transport even if AbortSignal is ignored", async () => {
    vi.useFakeTimers(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://offline.invalid"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture");
    const fetch = vi.fn((_url: unknown, _init?: RequestInit) => new Promise(() => {})); vi.stubGlobal("fetch", fetch);
    const assertion = expect(nstLifecycleRpc("nst_job_begin_v1", {}, Date.now() + 60000)).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(5000); await assertion;
    expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true);
  });
  it.each(["default-success-false", "default-retry-false", "review", "audit", "http"])(
    "never weakens generic or common settlement vetoes: %s", async failure => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://offline.invalid"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture");
      const calls: string[] = [];
      vi.stubGlobal("fetch", vi.fn(async (url, init) => {
        const name = String(url).split("/").at(-1)!; calls.push(name);
        const args = JSON.parse(init!.body as string);
        return new Response(JSON.stringify({ status: name.includes("begin") ? "started" : "held", token: args.p_token }));
      }));
      const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json: vi.fn() };
      const route = withNstJobLifecycle(async (_req, output) => {
        output.status(failure === "http" ? 503 : 207).json({ success: failure !== "default-success-false",
          retrySafe: failure !== "default-retry-false", requiresReview: failure === "review", auditPersisted: failure !== "audit" });
      }, "fixture", undefined, failure.startsWith("default") ? undefined : { settled: () => true });
      await route({} as any, res);
      expect(res.statusCode).toBe(503);
      expect(calls).toEqual(["nst_job_begin_v1", "nst_job_hold_v1"]);
    });
  it("opens no lifecycle for cached reads, but shares one begin across concurrent cache misses", async () => {
    const f = fixture();
    await runNstJob({ ...f.input, lazy: true }, async () => true);
    expect(f.rpc).not.toHaveBeenCalled();
    const tokens: unknown[] = [];
    await runNstJob({ ...f.input, lazy: true }, async () => {
      await Promise.all([1, 2].map(() => withNstJobDispatch(async () => { tokens.push(currentNstJob()?.token); })));
      expect(f.rpc).toHaveBeenCalledTimes(1);
      return true;
    });
    expect(new Set(tokens).size).toBe(1);
    expect(f.rpc.mock.calls.map(c => c[0])).toEqual(["nst_job_begin_v1", "nst_job_finish_v1"]);
  });
  it("holds swallowed output errors and prevents a later write", async () => {
    const f = fixture(); const write = vi.fn();
    await expect(runNstJob(f.input, async () => {
      markNstJobUncertain();
      expect(() => { assertNstJobActive(); write(); }).toThrow("uncertain");
      return true;
    })).rejects.toThrow("reconciliation");
    expect(write).not.toHaveBeenCalled();
    expect(f.rpc.mock.calls.map(c => c[0])).toEqual(["nst_job_begin_v1", "nst_job_hold_v1"]);
  });
  it("rejects an unscoped dispatch when enabled", async () => {
    const dispatch = vi.fn(async () => true);
    await expect(withNstJobDispatch(dispatch)).rejects.toThrow("enclosing job");
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("holds a detached admission wait and never dispatches its late permit", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://offline.invalid"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture");
    const f = fixture(); let release!: (value: Response) => void;
    let entered!: () => void; const admissionStarted = new Promise<void>(resolve => { entered = resolve; });
    vi.stubGlobal("fetch", vi.fn(() => { entered(); return new Promise<Response>(resolve => { release = resolve; }); }));
    const dispatch = vi.fn(async () => true); let late!: Promise<unknown>;
    await expect(runNstJob(f.input, async () => {
      late = admitSharedNstAttempt(Date.now() + 5000, dispatch);
      void late.catch(() => {});
      await admissionStarted;
      return true;
    })).rejects.toThrow("reconciliation");
    release(new Response(JSON.stringify({ version: 1, scope: "global-nst", allowed: true, waitMs: 0, permitTtlMs: 1000 })));
    await expect(late).rejects.toThrow("closed");
    expect(dispatch).not.toHaveBeenCalled();
    expect(f.rpc.mock.calls.at(-1)?.[0]).toBe("nst_job_hold_v1");
  });
  it("checks the enclosing deadline again after admission acknowledgement", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://offline.invalid"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture");
    const f = fixture(); const dispatch = vi.fn(async () => true);
    vi.stubGlobal("fetch", vi.fn(async () => {
      vi.setSystemTime(f.input.deadlineAt);
      return new Response(JSON.stringify({ version: 1, scope: "global-nst", allowed: true, waitMs: 0, permitTtlMs: 1000 }));
    }));
    await expect(runNstJob(f.input, () => admitSharedNstAttempt(f.input.deadlineAt + 5000, dispatch))).rejects.toThrow("expired");
    expect(dispatch).not.toHaveBeenCalled();
    expect(f.rpc.mock.calls.at(-1)?.[0]).toBe("nst_job_hold_v1");
  });

  it("refuses a lifecycle RPC to any project but the pinned one, without a request", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://otherproject.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "mock");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(nstLifecycleRpc("nst_job_begin_v1", {}, Date.now() + 60000)).rejects.toThrow("pinned production project");
    expect(fetch).not.toHaveBeenCalled();
  });
});
