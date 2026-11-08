// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertNstJobActive, currentNstJob, markNstJobUncertain, requireNstJob, runNstJob, withNstJobDispatch, withNstJobLifecycle, type NstLifecycleRpc } from "./jobLifecycle.server";

const { aggregate } = vi.hoisted(() => ({ aggregate: vi.fn() }));
vi.mock("lib/api/averages/statsService", () => ({ getAggregatedCountsData: aggregate, getAggregatedRatesData: aggregate }));
import averages from "../../pages/api/Averages/[playerId]";

beforeEach(() => {
  vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://offline.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture");
  aggregate.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

// Execute the real private function without loading route-level credentials,
// clients or long-running orchestration. Dependencies below are fixture-only.
function isolatedFunction(path: string, name: string, globals: Record<string, unknown>) {
  const source = ts.createSourceFile(path, readFileSync(resolve(path), "utf8"), ts.ScriptTarget.Latest, true);
  const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  if (!fn) throw new Error(`Missing function ${name}`);
  const js = ts.transpileModule(fn.getText(source).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(globals), `${js}; return ${name};`)(...Object.values(globals));
}

describe("NST caller enclosing settlement", () => {
  it.each(["Teams/[teamAbbreviation]", "CareerAverages/[playerId]", "ThreeYearAverages/[playerId]"])("%s encloses its full aggregation and rejects failed parsing", async route => {
    for (const failed of [false, true]) {
      const events: string[] = [];
      const stats = vi.fn(async () => {
        await withNstJobDispatch(async () => { events.push("body"); });
        events.push("parse");
        if (failed) throw new Error("parse failed");
        return {};
      });
      const source = readFileSync(resolve(`pages/api/${route}.ts`), "utf8");
      expect(source).toContain(`export default withNstJobLifecycle(handler, "${route}", undefined, { lazy: true })`);
      const handler = isolatedFunction(`pages/api/${route}.ts`, "handler", { getStats: stats,
        GetThreeYearStats: stats, GetThreeYearRates: stats, GetCareerStats: stats, GetCareerRates: stats });
      vi.stubGlobal("fetch", vi.fn(async (url, init) => {
        const name = String(url).split("/").at(-1)!; events.push(name);
        return new Response(JSON.stringify({ status: name.includes("begin") ? "started" : name.includes("finish") ? "finished" : "held", token: JSON.parse(init!.body as string).p_token }));
      }));
      const res: any = { statusCode: 200, headersSent: false, status(code: number) { this.statusCode = code; return this; }, json() { events.push("json"); return this; } };
      await withNstJobLifecycle(handler, route, undefined, { lazy: true })({ query: { playerId: "fixture" } } as any, res);
      expect(events.at(-2)).toBe(failed ? "nst_job_hold_v1" : "nst_job_finish_v1");
      expect(stats).toHaveBeenCalledTimes(failed || !route.startsWith("ThreeYear") ? 1 : 4);
      expect(res.statusCode).toBe(failed ? 503 : 200);
    }
  });

  it("requires the Averages helper's parent scope before fetching", async () => {
    const fetch = vi.fn();
    const helper = isolatedFunction("lib/api/averages/helpers.ts", "fetchPlayerData", { requireNstJob,
      buildNstUrlString: () => "fixture", fetchNstTextWithCacheByUrl: fetch });
    await expect(helper("fixture", "n")).rejects.toThrow("enclosing job");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the CTPI CLI's seasons and report generation inside one job", async () => {
    const events: string[] = []; const tokens: unknown[] = [];
    const main = isolatedFunction("scripts/audit-ctpi-multiseason.ts", "main", {
      parseArg: () => undefined, assertNstJobActive,
      fetchSeasonData: async (seasonId: number) => {
        await withNstJobDispatch(async () => { events.push("body"); tokens.push(currentNstJob()?.token); });
        return { seasonId, coverage: {} };
      },
      buildSamples: () => ({ samples: [], candidateEligibility: {} }), validationSummary: () => ({}), rankStability: () => ({}),
      RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION: "fixture", RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION: "fixture",
      process: { stderr: { write() {} }, stdout: { write(value: string) { expect(JSON.parse(value).readOnly).toBe(true); events.push("output"); } } }
    });
    const rpc: NstLifecycleRpc = async (name, args) => { events.push(name); return { status: name.includes("begin") ? "started" : "finished", token: args.p_token }; };
    await runNstJob({ owner: "fixture-cli", deadlineAt: Date.now() + 1000, settled: () => true, rpc }, main);
    expect(events).toEqual(["nst_job_begin_v1", "body", "body", "body", "output", "nst_job_finish_v1"]);
    expect(new Set(tokens).size).toBe(1);
  });
  it.each([false, true])("keeps all four Averages reports inside one job (cache only: %s)", async cached => {
    const events: string[] = []; const tokens: unknown[] = [];
    const res: any = { statusCode: 200, headersSent: false,
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { events.push("json"); expect(body.success).toBe(true); return this; } };
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      const name = String(url).split("/").at(-1)!; events.push(name);
      const args = JSON.parse(init!.body as string);
      return new Response(JSON.stringify({ status: name.includes("begin") ? "started" : "finished", token: args.p_token }));
    }));
    aggregate.mockImplementation(async () => {
      if (!cached) await withNstJobDispatch(async () => { tokens.push(currentNstJob()?.token); events.push("body"); });
      events.push("aggregate"); return { yearlyData: [], averages: {} };
    });
    await averages({ query: { playerId: "fixture" } } as any, res);
    expect(aggregate).toHaveBeenCalledTimes(4);
    expect(events).toEqual(cached ? ["aggregate", "aggregate", "aggregate", "aggregate", "json"] :
      ["nst_job_begin_v1", "body", "aggregate", "body", "aggregate", "body", "aggregate", "body", "aggregate", "nst_job_finish_v1", "json"]);
    if (!cached) expect(new Set(tokens).size).toBe(1);
  });

  const legacy = ["check-missing-goalie-data", "update-nst-player-reports", "update-nst-last-ten"];
  it.each(legacy)("%s holds a swallowed write failure and refuses an expired write", async route => {
    vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {});
    const upsert = vi.fn(async () => ({ error: { message: "fixture rejected" } }));
    const fn = isolatedFunction(`pages/api/v1/db/${route}.ts`, "upsertData", {
      assertNstJobActive, markNstJobUncertain, getTableName: () => "fixture", getGoalieTableName: () => "fixture",
      getGoalieIdByName: async () => 1, supabase: { from: () => ({ upsert }) }, console
    });
    const rpc = vi.fn<NstLifecycleRpc>(async (name, args) => ({ status: name.includes("begin") ? "started" : "held", token: args.p_token }));
    const input = { owner: route, deadlineAt: Date.now() + 1000, settled: () => true, rpc };
    await expect(runNstJob(input, () => fn("fixture", [{ player_name: "fixture", team: "BOS" }]))).rejects.toThrow("reconciliation");
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.map(c => c[0])).toEqual(["nst_job_begin_v1", "nst_job_hold_v1"]);
    upsert.mockClear(); vi.useFakeTimers();
    await expect(runNstJob(input, async () => { vi.setSystemTime(input.deadlineAt); await fn("fixture", [{}]); })).rejects.toThrow("expired");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rechecks the goalie write fence after awaited identity lookups", async () => {
    vi.useFakeTimers(); vi.spyOn(console, "log").mockImplementation(() => {});
    const deadlineAt = Date.now() + 1000; const upsert = vi.fn();
    const fn = isolatedFunction("pages/api/v1/db/check-missing-goalie-data.ts", "upsertData", {
      assertNstJobActive, markNstJobUncertain, getGoalieTableName: () => "fixture", console,
      getGoalieIdByName: async () => { vi.setSystemTime(deadlineAt); return 1; }, supabase: { from: () => ({ upsert }) }
    });
    await expect(runNstJob({ owner: "fixture", deadlineAt, settled: () => true,
      rpc: async (name, args) => ({ status: name.includes("begin") ? "started" : "held", token: args.p_token }) },
    () => fn("fixture", [{ player_name: "fixture", team: "BOS" }]))).rejects.toThrow("expired");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("awaits player-report work before its enabled route response", async () => {
    let release!: () => void; const events: string[] = [];
    const work = new Promise<void>(resolve => { release = resolve; });
    const handler = isolatedFunction("pages/api/v1/db/update-nst-player-reports.ts", "handler", {
      main: async () => { events.push("work"); await work; events.push("settled"); }, process, console
    });
    const res: any = { status() { return this; }, json() { events.push("json"); return this; } };
    const pending = handler({ method: "POST" }, res);
    await Promise.resolve(); expect(events).toEqual(["work"]);
    release(); await pending; expect(events).toEqual(["work", "settled", "json"]);
  });
});
