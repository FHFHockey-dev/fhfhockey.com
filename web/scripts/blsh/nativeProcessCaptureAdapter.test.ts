// @vitest-environment node
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the canonical NST client, shared admission and lifecycle. Substitute
// only HTTP and the local ledger; the real production-shaped URL never resolves.
vi.mock("../../lib/nst/requestBudget", async original => ({
  ...await original<typeof import("../../lib/nst/requestBudget")>(),
  withNstRequestBudget: vi.fn(async (_url: string, control: { attemptsStarted: number; maxAttempts: number }, start: () => Promise<unknown>) => {
    if (control.attemptsStarted >= control.maxAttempts) throw new Error("fixture attempt cap");
    control.attemptsStarted++;
    return start();
  }),
}));
vi.mock("node:http", () => { throw new Error("real HTTP forbidden"); });
vi.mock("node:https", () => { throw new Error("real HTTPS forbidden"); });
vi.mock("node:net", () => { throw new Error("real sockets forbidden"); });
vi.mock("node:tls", () => { throw new Error("real TLS forbidden"); });

import { createNativeProcessCaptureAdapter } from "./nativeProcessCaptureAdapter";
import { prepareNativeProcessCapture } from "./nativeProcessCapturePreparation";
import { runNativeProcessCapture, type NativeCaptureRunInput } from "./nativeProcessCaptureRunner";
import { withNstRequestBudget } from "../../lib/nst/requestBudget";

const NOW = "2026-11-09T15:10:00.000Z", ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const KEY = "fixture-NST-secret-123", SERVICE = "fixture-service-secret-456";
const MIB = 1024 * 1024;
const html = `<table><tr><td>Fixture é 🏒 /?key=${KEY}&x=1</td></tr></table>\r\n`;
const schedule = () => ({ gameWeek: [{ date: "2026-11-07", games: [{ id: 2026020201, season: 20262027, gameType: 2, gameState: "OFF", gameScheduleState: "OK", homeTeam: { id: 1, abbrev: "NJD" }, awayTeam: { id: 2, abbrev: "NYI" } }] }] });
const sourceFiles = {
  runner: resolve(__dirname, "nativeProcessCaptureRunner.ts"), preparation: resolve(__dirname, "nativeProcessCapturePreparation.ts"),
  adapter: resolve(__dirname, "nativeProcessCaptureAdapter.ts"), client: resolve(__dirname, "../../lib/nst/client.ts"),
  budget: resolve(__dirname, "../../lib/nst/requestBudget.ts"), admission: resolve(__dirname, "../../lib/nst/sharedAdmission.ts"),
  admissionOrigin: resolve(__dirname, "../../lib/nst/admissionOrigin.ts"), lifecycle: resolve(__dirname, "../../lib/nst/jobLifecycle.server.ts"),
  ratePolicy: resolve(__dirname, "../../lib/cron/nstRateLimitPolicy.ts"),
};
type Call = { kind: string; url: string; at: number; init: RequestInit };
let directory: string, input: NativeCaptureRunInput, calls: Call[];
let failAt: string | undefined;
let customize: ((call: Call, body: string) => string | Response | Promise<Response>) | undefined;
const out = () => join(directory, "packet");
const exists = (file: string) => fs.existsSync(join(out(), file));
const read = (file: string) => JSON.parse(fs.readFileSync(join(out(), file), "utf8"));
const response = (body: string | ReadableStream<Uint8Array>, url: string, status = 200, redirected = false) => {
  const value = new Response(body, { status });
  Object.defineProperties(value, { url: { value: url }, redirected: { value: redirected } });
  return value;
};
async function run(ok = true) {
  const adapter = createNativeProcessCaptureAdapter(input);
  const pending = runNativeProcessCapture(input, adapter, out());
  const assertion = ok ? expect(pending).resolves.toMatchObject({ state: "packet_complete_pending_review", advancedAdmission: false }) : expect(pending).rejects.toThrow();
  await vi.runAllTimersAsync(); await assertion;
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW); vi.clearAllMocks();
  vi.stubEnv("NST_KEY", KEY); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN); vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "false");
  directory = fs.mkdtempSync(join(tmpdir(), "blsh-actual-adapter-test-")); calls = []; failAt = undefined; customize = undefined;
  input = { plan: prepareNativeProcessCapture({ seasonId: 20262027, date: "2026-11-07", plannedAtUTC: NOW, groups: ["individual", "onIce"] }),
    supabaseOrigin: ORIGIN, lifecycleMode: "disabled", sourceSHA256: Object.fromEntries(Object.entries(sourceFiles).map(([role, path]) => [role, createHash("sha256").update(new Uint8Array(fs.readFileSync(path))).digest("hex")])) as NativeCaptureRunInput["sourceSHA256"] };
  vi.stubGlobal("fetch", vi.fn(async (target: string | URL | Request, init: RequestInit = {}) => {
    const url = String(target), parsed = new URL(url), name = parsed.pathname.split("/").at(-1);
    let kind: string, body: string;
    if (parsed.hostname === "api-web.nhle.com") { kind = "schedule"; body = JSON.stringify(schedule()); }
    else if (parsed.hostname === "data.naturalstattrick.com") {
      kind = parsed.searchParams.get("stdoi") === "std" ? "nst:individual" : "nst:onIce"; body = html;
      expect(new Headers(init.headers).get("nst-key")).toBe(KEY); expect(parsed.searchParams.has("key")).toBe(false);
      if (kind === "nst:onIce") expect(exists("individual.TRANSPORT-OBSERVATION.json")).toBe(true);
    } else if (parsed.origin === ORIGIN && name?.startsWith("nst_admit_")) {
      kind = calls.some(call => call.kind === "admission:individual") ? "admission:onIce" : "admission:individual";
      expect(new Headers(init.headers).get("apikey")).toBe(SERVICE);
      body = JSON.stringify({ version: 1, scope: "global-nst", permitTtlMs: 1000, allowed: true, waitMs: 0 });
    } else if (parsed.origin === ORIGIN && ["nst_job_begin_v1", "nst_job_finish_v1", "nst_job_hold_v1"].includes(name ?? "")) {
      kind = name!.split("_")[2]; const args = JSON.parse(String(init.body));
      body = JSON.stringify({ status: { begin: "started", finish: "finished", hold: "held" }[kind], token: args.p_token });
    } else throw new Error("unexpected network target blocked");
    const call = { kind, url, at: Date.now(), init }; calls.push(call);
    expect(init.redirect).toBe("error"); expect(init.signal).toBeInstanceOf(AbortSignal);
    if (kind === failAt) throw new Error(`fixture transport failure ${KEY} ${SERVICE}`);
    const customized = await customize?.(call, body);
    return typeof customized === "string" ? response(customized, url) : customized ?? response(body, url);
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); fs.rmSync(directory, { recursive: true, force: true }); });

describe("actual native capture adapter through mocked transports", () => {
  it.each(["disabled", "enabled"] as const)("runs the canonical modules in %s mode with exact operation and source receipts", async mode => {
    input.lifecycleMode = mode; vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", mode === "enabled" ? "true" : "false");
    await run();
    expect(calls.map(call => call.kind)).toEqual(mode === "disabled" ? ["schedule", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce"] : ["schedule", "begin", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce", "finish"]);
    const nst = calls.filter(call => call.kind.startsWith("nst:"));
    expect(nst.map(call => call.url)).toEqual(input.plan.pages.map(page => page.url)); expect(nst[1].at - nst[0].at).toBe(22000);
    expect(withNstRequestBudget).toHaveBeenCalledTimes(2);
    const controls = vi.mocked(withNstRequestBudget).mock.calls.map(call => call[1]);
    expect(controls[0]).toBe(controls[1]); expect(controls[0]).toMatchObject({ attemptsStarted: 2, maxAttempts: 2, plannedRequestCount: 2, minIntervalMs: 22000 });
    for (const admission of calls.filter(call => call.kind.startsWith("admission:"))) {
      expect(admission.url).toBe(`${ORIGIN}/rest/v1/rpc/${mode === "enabled" ? "nst_admit_job_attempt_v1" : "nst_admit_attempt_v1"}`);
      const args = JSON.parse(String(admission.init.body)); expect(args.p_burst).toBe(false);
      if (mode === "enabled") { expect(args.p_kind).toBe("direct"); expect(args.p_token).toBe(JSON.parse(String(calls.find(call => call.kind === "begin")!.init.body)).p_token); }
      else expect(args.p_token).toBeUndefined();
    }
    expect(fs.readFileSync(join(out(), "individual.parser-input.html"), "utf8")).toBe(html.replace(KEY, "[REDACTED]"));
    expect(read("individual.TRANSPORT-OBSERVATION.json")).toMatchObject({ retrievedAtUTC: new Date(nst[0].at).toISOString(), TLSVerified: null, independentlyAccepted: false });
    const manifest = read("MANIFEST.json"); expect(manifest.operationCount).toBe(mode === "enabled" ? 7 : 5);
    if (mode === "enabled") expect(read("operation-2-STARTED.json").jobToken).toBe(JSON.parse(String(calls.find(call => call.kind === "begin")!.init.body)).p_token);
    for (const file of manifest.files) {
      const bytes = fs.readFileSync(join(out(), file.file)); expect(createHash("sha256").update(new Uint8Array(bytes)).digest("hex")).toBe(file.sha256);
      expect(bytes.toString()).not.toContain(KEY); expect(bytes.toString()).not.toContain(SERVICE);
    }
  });

  it.each(["wrong_project", "offline_host", "credentials", "mode"])("refuses %s before any network or ledger call", async kind => {
    if (kind === "wrong_project") vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://other.supabase.co");
    if (kind === "offline_host") vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://offline.invalid");
    if (kind === "credentials") vi.stubEnv("NST_KEY", "");
    if (kind === "mode") vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "true");
    expect(() => createNativeProcessCaptureAdapter(input)).toThrow(); expect(calls).toHaveLength(0); expect(withNstRequestBudget).not.toHaveBeenCalled();
  });

  it("rejects a stale sharedAdmission source pin before network", async () => {
    input.sourceSHA256.admission = "9ae8a67237656131db3f5e8e9ab2347827bc44fd5be63351821d9cad3c94bec6";
    await run(false); expect(calls).toHaveLength(0); expect(withNstRequestBudget).not.toHaveBeenCalled();
  });

  it.each(["schedule", "begin", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce", "finish"])("stops on %s failure without retry and preserves settled work", async kind => {
    input.lifecycleMode = "enabled"; vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "true"); failAt = kind;
    await run(false); expect(exists("MANIFEST.json")).toBe(false); expect(calls.filter(call => call.kind === kind)).toHaveLength(1);
    expect(calls.filter(call => call.kind === "hold")).toHaveLength(["schedule", "begin"].includes(kind) ? 0 : 1);
    if (["admission:onIce", "nst:onIce", "finish"].includes(kind)) expect(exists("individual.TRANSPORT-OBSERVATION.json")).toBe(true);
    if (kind === "finish") expect(calls).toHaveLength(8);
    if (kind === "begin") expect(read("operation-2-STARTED.json").jobToken).toBe(JSON.parse(String(calls.find(call => call.kind === "begin")!.init.body)).p_token);
    const records = fs.readdirSync(out()).filter(file => file.endsWith(".json")).map(file => fs.readFileSync(join(out(), file), "utf8")).join();
    expect(records).not.toContain(KEY); expect(records).not.toContain(SERVICE);
  });

  it.each(["denied", "invalid", "expired"])("stops an %s permit after one admission and no NST request", async kind => {
    customize = (call, body) => {
      if (call.kind !== "admission:individual") return body;
      if (kind === "expired") vi.setSystemTime(Date.now() + 1001);
      const receipt = JSON.parse(body); if (kind === "denied") receipt.allowed = false; if (kind === "invalid") receipt.permitTtlMs = 2000;
      return JSON.stringify(receipt);
    };
    await run(false); expect(calls.map(call => call.kind)).toEqual(["schedule", "admission:individual"]);
    expect(read("operation-2-SETTLED.json").permit).toBe(kind);
  });

  it.each(["schedule", "nst:individual", "finish"])("rejects a response over its retained byte limit: %s", async kind => {
    input.lifecycleMode = "enabled"; vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "true");
    customize = (call, body) => call.kind === kind ? "x".repeat((kind === "schedule" ? MIB : kind === "finish" ? 65536 : 2 * MIB) + 1) : body;
    await run(false); expect(exists("MANIFEST.json")).toBe(false); expect(calls.filter(call => call.kind === kind)).toHaveLength(1);
    if (kind === "nst:individual") expect(calls.some(call => call.kind === "nst:onIce")).toBe(false);
  });

  it("rejects an unacknowledged lifecycle finish and attempts exactly one hold", async () => {
    input.lifecycleMode = "enabled"; vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "true");
    customize = (call, body) => call.kind === "finish" ? JSON.stringify({ status: "finished", token: "wrong-token" }) : body;
    await run(false); expect(calls.map(call => call.kind).slice(-2)).toEqual(["finish", "hold"]); expect(calls).toHaveLength(8);
  });

  it("does not retry an uncertain hold after an uncertain finish", async () => {
    input.lifecycleMode = "enabled"; vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "true"); failAt = "finish";
    customize = (call, body) => { if (call.kind === "hold") throw new Error("fixture hold timeout"); return body; };
    await run(false); expect(calls.map(call => call.kind).slice(-2)).toEqual(["finish", "hold"]); expect(calls).toHaveLength(8);
    expect(read("FAILED.json").operations.at(-1)).toMatchObject({ operation: "hold", state: "uncertain" });
    expect(exists("MANIFEST.json")).toBe(false);
  });

  it.each(["schedule", "nst:individual"])("rejects redirects or wrong final origins: %s", async kind => {
    customize = (call, body) => call.kind === kind ? response(body, "https://other.invalid", 200, true) : body;
    await run(false); expect(calls.filter(call => call.kind === kind)).toHaveLength(1); expect(calls.some(call => call.kind === "nst:onIce")).toBe(false);
  });

  it("fails when runtime mode changes after the schedule without opening a job", async () => {
    customize = (call, body) => { if (call.kind === "schedule") vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "true"); return body; };
    await run(false); expect(calls.map(call => call.kind)).toEqual(["schedule"]); expect(withNstRequestBudget).not.toHaveBeenCalled();
  });

  it.each([KEY, SERVICE])("refuses a credential echo in client-returned text", async secret => {
    customize = (call, body) => call.kind === "nst:individual" ? `<table><tr><td>${secret}</td></tr></table>` : body;
    await run(false); expect(exists("individual.parser-input.html")).toBe(false); expect(calls.some(call => call.kind === "nst:onIce")).toBe(false);
  });

  it.each(["schedule", "nst:individual"])("aborts stalled body consumption for %s", async kind => {
    let bodyStopped = false;
    customize = (call, body) => call.kind === kind ? response(new ReadableStream<Uint8Array>({
      start(controller) {
        // A fetched response's body errors when its fetch signal aborts. A bare
        // synthetic Response has no such linkage, so model that transport fact.
        call.init.signal?.addEventListener("abort", () => { bodyStopped = true; controller.error(new Error("fixture body aborted")); }, { once: true });
      },
      cancel() { bodyStopped = true; },
    }), call.url) : body;
    const pending = run(false);
    await pending;
    expect(calls.find(call => call.kind === kind)?.init.signal?.aborted).toBe(true); expect(bodyStopped).toBe(true);
    expect(exists("MANIFEST.json")).toBe(false); expect(calls.some(call => call.kind === "nst:onIce")).toBe(false);
  });
});
