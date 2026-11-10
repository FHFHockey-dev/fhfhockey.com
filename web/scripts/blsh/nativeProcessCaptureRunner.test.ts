// @vitest-environment node
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareNativeProcessCapture } from "./nativeProcessCapturePreparation";
import { runNativeProcessCapture, type CaptureDispatchSpec, type CaptureOperation, type CaptureResponse, type NativeCaptureAdapter, type NativeCaptureRunInput } from "./nativeProcessCaptureRunner";

vi.mock("node:fs", async original => ({ ...await original<typeof import("node:fs")>() }));
vi.mock("../../lib/nst/client", () => { throw new Error("real client forbidden"); });
vi.mock("../../lib/nst/requestBudget", () => { throw new Error("real ledger forbidden"); });
vi.mock("../../lib/nst/sharedAdmission", () => { throw new Error("real admission forbidden"); });
vi.mock("../../lib/nst/jobLifecycle.server", () => { throw new Error("real lifecycle forbidden"); });
vi.mock("node:http", () => { throw new Error("HTTP forbidden"); });
vi.mock("node:https", () => { throw new Error("HTTPS forbidden"); });
vi.mock("node:net", () => { throw new Error("sockets forbidden"); });
vi.mock("node:tls", () => { throw new Error("TLS forbidden"); });

const NOW = "2026-11-09T01:00:00.000Z";
const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const MIB = 1024 * 1024;
const jobReference = { jobToken: "11111111-1111-4111-8111-111111111111" };
const sha = (bytes: Uint8Array | Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const sourceFiles = {
  runner: resolve(__dirname, "nativeProcessCaptureRunner.ts"),
  preparation: resolve(__dirname, "nativeProcessCapturePreparation.ts"),
  client: resolve(__dirname, "../../lib/nst/client.ts"), budget: resolve(__dirname, "../../lib/nst/requestBudget.ts"),
  admission: resolve(__dirname, "../../lib/nst/sharedAdmission.ts"), lifecycle: resolve(__dirname, "../../lib/nst/jobLifecycle.server.ts"),
  admissionOrigin: resolve(__dirname, "../../lib/nst/admissionOrigin.ts"),
  ratePolicy: resolve(__dirname, "../../lib/cron/nstRateLimitPolicy.ts"), adapter: __filename,
};
const schedule = () => ({ gameWeek: [{ date: "2026-11-07", games: [{ id: 2026020201, season: 20262027, gameType: 2, gameState: "OFF", gameScheduleState: "OK", homeTeam: { id: 1, abbrev: "NJD" }, awayTeam: { id: 2, abbrev: "NYI" } }] }] });
const html = Buffer.from('<!doctype html>\r\n<table><thead><tr><th>Player</th></tr></thead><tbody><tr><td>Synthetic é 🏒 &amp;key=[REDACTED]</td></tr></tbody></table>\n');
let directory: string;
let sent: { operation: CaptureOperation; at: number; spec: CaptureDispatchSpec }[];
let adapter: NativeCaptureAdapter, input: NativeCaptureRunInput;
let failOperation: CaptureOperation | undefined;
let mutateResponse: ((operation: CaptureOperation, response: CaptureResponse) => void) | undefined;
const out = () => join(directory, "packet");
const read = (file: string) => JSON.parse(fs.readFileSync(join(out(), file), "utf8"));
const exists = (file: string) => fs.existsSync(join(out(), file));
const invoke = async (operation: CaptureOperation, spec: CaptureDispatchSpec) => {
  sent.push({ operation, at: Date.now(), spec });
  if (failOperation === operation) throw new Error("synthetic NST_KEY=must-not-be-retained");
  await Promise.resolve();
  return operation.startsWith("admission:") ? { kind: "admission", httpStatus: 200, valid: true, allowed: true, waitMs: 0 } : { ok: true };
};
const response = async (operation: CaptureOperation, spec: CaptureDispatchSpec): Promise<CaptureResponse> => {
  await invoke(operation, spec);
  const result = { status: 200, finalUrl: spec.url, redirected: false, bytes: operation === "schedule" ? Buffer.from(JSON.stringify(schedule())) : html };
  mutateResponse?.(operation, result);
  return result;
};
function makeAdapter(mode: "enabled" | "disabled"): NativeCaptureAdapter {
  return {
    supabaseOrigin: ORIGIN, lifecycleMode: mode, sourcePath: __filename,
    schedule: dispatch => dispatch("schedule", spec => response("schedule", spec)),
    async withJob({ dispatch, settled }, work) {
      if (mode === "enabled") await dispatch("begin", spec => invoke("begin", spec), jobReference);
      try {
        await work(); expect(settled()).toBe(true);
        if (mode === "enabled") await dispatch("finish", spec => invoke("finish", spec), jobReference);
      } catch (error) {
        if (mode === "enabled") { try { await dispatch("hold", spec => invoke("hold", spec), jobReference); } catch { /* Existing cleanup is best-effort, never retried. */ } }
        throw error;
      }
    },
    async nst(group, url, options) {
      expect(options).toMatchObject({ retries: 0, allowQueryKeyFallback: false, timeoutMs: 15000, maxResponseBytes: 2 * MIB, maxAdmissionCalls: 1,
        requestControl: { maxAttempts: 2, plannedRequestCount: 2, minIntervalMs: 22000 } });
      if (group === "onIce") expect(exists("individual.TRANSPORT-OBSERVATION.json")).toBe(true);
      options.requestControl.attemptsStarted++;
      await options.dispatch(`admission:${group}`, spec => invoke(`admission:${group}`, spec));
      return options.dispatch(`nst:${group}`, spec => { expect(spec.url).toBe(url); return response(`nst:${group}`, spec); });
    },
  };
}
async function run(ok = true) {
  const promise = runNativeProcessCapture(input, adapter, out());
  // Attach the rejection handler before advancing mock clocks.
  const check = ok ? expect(promise).resolves.toMatchObject({ state: "packet_complete_pending_review", advancedAdmission: false }) : expect(promise).rejects.toThrow();
  await vi.runAllTimersAsync(); await check;
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("network forbidden"); }));
  directory = fs.mkdtempSync(join(tmpdir(), "blsh-durable-runner-test-")); sent = []; failOperation = undefined; mutateResponse = undefined;
  adapter = makeAdapter("disabled");
  input = {
    plan: prepareNativeProcessCapture({ seasonId: 20262027, date: "2026-11-07", plannedAtUTC: NOW, groups: ["individual", "onIce"] }),
    supabaseOrigin: ORIGIN, lifecycleMode: "disabled",
    sourceSHA256: Object.fromEntries(Object.entries(sourceFiles).map(([role, path]) => [role, sha(fs.readFileSync(path))])) as NativeCaptureRunInput["sourceSHA256"],
  };
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); fs.rmSync(directory, { recursive: true, force: true }); });

describe("durable native capture runner with blocked real transports", () => {
  it.each(["disabled", "enabled"] as const)("retains exact bytes/clocks, pins, private modes and %s lifecycle accounting", async mode => {
    adapter = makeAdapter(mode); input.lifecycleMode = mode;
    await run();
    const sequence = sent.map(call => call.operation);
    expect(sequence).toEqual(mode === "enabled" ? ["schedule", "begin", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce", "finish"] : ["schedule", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce"]);
    expect(sent[0].spec.url).toBe("https://api-web.nhle.com/v1/schedule/2026-11-07");
    for (const call of sent.filter(call => call.operation.startsWith("admission:"))) expect(call.spec.url).toBe(`${ORIGIN}/rest/v1/rpc/${mode === "enabled" ? "nst_admit_job_attempt_v1" : "nst_admit_attempt_v1"}`);
    const gets = sent.filter(call => call.operation.startsWith("nst:"));
    expect(gets.map(call => call.spec.url)).toEqual(input.plan.pages.map(page => page.url)); expect(gets[1].at - gets[0].at).toBe(22000);
    for (const call of sent) { expect(call.spec.redirect).toBe("error"); expect(call.spec.timeoutMs).toBe(call.spec.method === "GET" ? 15000 : 5000); }
    expect(fs.readFileSync(join(out(), "schedule.raw.json"))).toEqual(Buffer.from(JSON.stringify(schedule())));
    expect(fs.readFileSync(join(out(), "individual.parser-input.html"))).toEqual(html);
    expect(read("individual.TRANSPORT-OBSERVATION.json")).toMatchObject({ retrievedAtUTC: new Date(gets[0].at).toISOString(), TLSVerified: null, originalPublicationUTC: null, modelDefinition: "unknown", parsedRows: 1, independentlyAccepted: false });
    const manifest = read("MANIFEST.json"); expect(manifest.operationCount).toBe(mode === "enabled" ? 7 : 5);
    expect(exists(".MANIFEST.json.tmp")).toBe(false); expect(exists("FAILED.json")).toBe(false);
    expect(fs.statSync(out()).mode & 0o777).toBe(0o700);
    for (const file of manifest.files) { const bytes = fs.readFileSync(join(out(), file.file)); expect(sha(bytes)).toBe(file.sha256); expect(bytes.length).toBe(file.bytes); expect(fs.statSync(join(out(), file.file)).mode & 0o777).toBe(0o600); }
  });

  it.each(["target", "adapter_target", "mode", "pin", "stale", "date", "url", "existing", "symlink"])("refuses %s before transport", async kind => {
    if (kind === "target") input.supabaseOrigin = "https://example.org";
    if (kind === "adapter_target") adapter.supabaseOrigin = `${ORIGIN}/different`;
    if (kind === "mode") adapter.lifecycleMode = "enabled";
    if (kind === "pin") input.sourceSHA256.client = "0".repeat(64);
    if (kind === "stale") vi.setSystemTime(Date.now() + 15 * 60000 + 1);
    if (kind === "date") input.plan = prepareNativeProcessCapture({ ...input.plan.input, date: "2026-11-08" });
    if (kind === "url") input.plan.pages[0].url = "https://example.org";
    if (kind === "existing") fs.mkdirSync(out());
    if (kind === "symlink") fs.symlinkSync(directory, out());
    await run(false); expect(sent).toEqual([]); expect(exists("STARTED.json")).toBe(false);
  });

  it.each(["missing_day", "duplicate_day", "empty", "season", "type", "live", "postponed", "duplicate_game", "duplicate_team", "identity", "duplicate_key"])("rejects ambiguous/incomplete schedule: %s", async kind => {
    mutateResponse = (operation, result) => {
      if (operation !== "schedule") return;
      const body = schedule(), day = body.gameWeek[0], game = day.games[0];
      if (kind === "missing_day") day.date = "2026-11-08";
      if (kind === "duplicate_day") body.gameWeek.push(day);
      if (kind === "empty") day.games = [];
      if (kind === "season") game.season = 20252026;
      if (kind === "type") game.gameType = 3;
      if (kind === "live") game.gameState = "LIVE";
      if (kind === "postponed") game.gameScheduleState = "PPD";
      if (kind === "duplicate_game") day.games.push(game);
      if (kind === "duplicate_team") game.awayTeam.id = game.homeTeam.id;
      if (kind === "identity") game.id = 2025020201;
      const text = JSON.stringify(body);
      result.bytes = Buffer.from(kind === "duplicate_key" ? text.replace('"gameState":"OFF"', '"gameState":"LIVE","game\\u0053tate":"OFF"') : text);
    };
    await run(false); expect(sent.map(call => call.operation)).toEqual(["schedule"]); expect(exists("MANIFEST.json")).toBe(false);
  });

  it.each(["schedule", "begin", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce", "finish"] as const)("stops on %s failure, preserves completed pages, counts at most one hold", async operation => {
    adapter = makeAdapter("enabled"); input.lifecycleMode = "enabled"; failOperation = operation;
    await run(false);
    expect(sent.filter(call => call.operation === operation)).toHaveLength(1);
    expect(sent.filter(call => call.operation === "hold").length).toBe(operation === "schedule" || operation === "begin" ? 0 : 1);
    expect(sent.length).toBeLessThanOrEqual(8); expect(exists("MANIFEST.json")).toBe(false);
    if (["admission:onIce", "nst:onIce", "finish"].includes(operation)) expect(exists("individual.TRANSPORT-OBSERVATION.json")).toBe(true);
    if (operation === "finish") { expect(sent).toHaveLength(8); expect(read("FAILED.json").operations.find((call: { operation: string }) => call.operation === "finish").state).toBe("uncertain"); }
    expect(fs.readdirSync(out()).filter(file => file.endsWith(".json")).map(file => fs.readFileSync(join(out(), file), "utf8")).join()).not.toContain("must-not-be-retained");
  });

  it("stops after a denied permit without provider dispatch or polling", async () => {
    adapter.nst = async (group, _url, options) => {
      await options.dispatch(`admission:${group}`, async spec => { const receipt = await invoke(`admission:${group}`, spec); return { ...receipt, allowed: false }; });
      return options.dispatch(`nst:${group}`, spec => response(`nst:${group}`, spec));
    };
    await run(false); expect(sent.map(call => call.operation)).toEqual(["schedule", "admission:individual"]);
    expect(read("operation-2-SETTLED.json").permit).toBe("denied");
  });

  it.each(["expired_response", "expired_before_dispatch", "malformed"])("rejects an unusable shared permit: %s", async kind => {
    adapter.nst = async (group, _url, options) => {
      await options.dispatch(`admission:${group}`, async spec => {
        const receipt = await invoke(`admission:${group}`, spec);
        if (kind === "expired_response") vi.setSystemTime(Date.now() + 1000);
        return kind === "malformed" ? { ...receipt, valid: false } : receipt;
      });
      if (kind === "expired_before_dispatch") vi.setSystemTime(Date.now() + 1000);
      return options.dispatch(`nst:${group}`, spec => response(`nst:${group}`, spec));
    };
    await run(false); expect(sent.map(call => call.operation)).toEqual(["schedule", "admission:individual"]);
  });

  it.each([
    ["permit", "operation-3-STARTED.json", 1001],
    ["operation_timeout", "operation-1-STARTED.json", 15001],
    ["work_deadline", "operation-3-STARTED.json", 120001],
    ["clock_rollback", "operation-3-STARTED.json", -1],
  ] as const)("blocks %s crossed during the durable STARTED write before invoking transport", async (_kind, file, elapsed) => {
    const open = fs.openSync, sync = fs.fsyncSync;
    let target: number | undefined, delayed = false;
    vi.spyOn(fs, "openSync").mockImplementation((path, flags, mode) => { const fd = open(path, flags, mode); if (String(path).endsWith(file)) target = fd; return fd; });
    vi.spyOn(fs, "fsyncSync").mockImplementation(fd => { sync(fd); if (fd === target && !delayed) { delayed = true; vi.setSystemTime(Date.now() + elapsed); } });
    await run(false);
    expect(delayed).toBe(true); expect(sent.map(call => call.operation)).toEqual(file === "operation-1-STARTED.json" ? [] : ["schedule", "admission:individual"]);
    expect(exists(file)).toBe(true); expect(exists("MANIFEST.json")).toBe(false);
  });

  it("anchors spacing to transport dispatch after durable writes", async () => {
    const open = fs.openSync, sync = fs.fsyncSync;
    let target: number | undefined, delayed = false;
    vi.spyOn(fs, "openSync").mockImplementation((path, flags, mode) => { const fd = open(path, flags, mode); if (String(path).endsWith("operation-3-STARTED.json")) target = fd; return fd; });
    vi.spyOn(fs, "fsyncSync").mockImplementation(fd => { sync(fd); if (fd === target && !delayed) { delayed = true; vi.setSystemTime(Date.now() + 500); } });
    await run();
    const providers = sent.filter(call => call.operation.startsWith("nst:"));
    expect(providers[1].at - providers[0].at).toBe(22000);
  });

  it.each([["permit", "operation-3-STARTED.json", 1001], ["operation_timeout", "operation-1-STARTED.json", 15001]] as const)(
    "blocks monotonic %s expiry when the wall clock understates durable-write time", async (_kind, file, elapsed) => {
      const open = fs.openSync, sync = fs.fsyncSync;
      let target: number | undefined, delayed = false, monotonic = 0;
      vi.spyOn(performance, "now").mockImplementation(() => monotonic);
      vi.spyOn(fs, "openSync").mockImplementation((path, flags, mode) => { const fd = open(path, flags, mode); if (String(path).endsWith(file)) target = fd; return fd; });
      vi.spyOn(fs, "fsyncSync").mockImplementation(fd => { sync(fd); if (fd === target && !delayed) { delayed = true; monotonic += elapsed; vi.setSystemTime(Date.now() + 500); } });
      await run(false);
      expect(sent.map(call => call.operation)).toEqual(file === "operation-1-STARTED.json" ? [] : ["schedule", "admission:individual"]);
    });

  it("deducts durable-write time from the transport timeout", async () => {
    const open = fs.openSync, sync = fs.fsyncSync;
    let target: number | undefined, delayed = false;
    vi.spyOn(fs, "openSync").mockImplementation((path, flags, mode) => { const fd = open(path, flags, mode); if (String(path).endsWith("operation-1-STARTED.json")) target = fd; return fd; });
    vi.spyOn(fs, "fsyncSync").mockImplementation(fd => { sync(fd); if (fd === target && !delayed) { delayed = true; vi.setSystemTime(Date.now() + 8000); } });
    await run();
    expect(sent[0].spec.timeoutMs).toBe(7000);
  });

  it("rejects an accidental second admission call before dispatch", async () => {
    adapter.nst = async (group, _url, options) => {
      await options.dispatch(`admission:${group}`, spec => invoke(`admission:${group}`, spec));
      await options.dispatch(`admission:${group}`, spec => invoke(`admission:${group}`, spec));
      throw new Error("unreachable");
    };
    await run(false); expect(sent.map(call => call.operation)).toEqual(["schedule", "admission:individual"]);
  });

  it.each(["status", "redirect", "origin", "schedule_size", "nst_size", "utf8", "rows", "empty_html"])("withholds completion on %s and never fetches beyond failure", async kind => {
    mutateResponse = (operation, result) => {
      if (kind === "schedule_size" && operation === "schedule") result.bytes = Buffer.alloc(MIB + 1);
      if (operation !== "nst:individual") return;
      if (kind === "status") result.status = 429;
      if (kind === "redirect") result.redirected = true;
      if (kind === "origin") result.finalUrl = "https://example.org";
      if (kind === "nst_size") result.bytes = Buffer.alloc(2 * MIB + 1);
      if (kind === "utf8") result.bytes = Buffer.from([0xc0, 0x80]);
      if (kind === "rows") result.bytes = Buffer.from(`<table>${"<tr><td>x</td></tr>".repeat(5001)}</table>`);
      if (kind === "empty_html") result.bytes = Buffer.from("<html>challenge</html>");
    };
    await run(false); expect(sent.some(call => call.operation.includes("onIce"))).toBe(false); expect(exists("MANIFEST.json")).toBe(false);
  });

  it("rejects a fabricated clock/response that did not come from the dispatch observation", async () => {
    const original = adapter.schedule;
    adapter.schedule = async dispatch => ({ ...await original(dispatch), completedAtUTC: "2026-11-09T00:59:59.000Z" });
    await run(false); expect(sent).toHaveLength(1); expect(exists("schedule.raw.json")).toBe(false);
  });

  it("binds the canonical client's returned parser text to the original body-completion witness", async () => {
    const original = adapter.nst;
    const parserInput = Buffer.from("<table><tr><td>exact client-returned parser text</td></tr></table>\r\n");
    adapter.nst = async (...args) => {
      const captured = await original(...args);
      return { ...captured, value: { ...captured.value, bytes: parserInput } };
    };
    await run(); expect(fs.readFileSync(join(out(), "individual.parser-input.html"))).toEqual(parserInput);
    expect(read("individual.TRANSPORT-OBSERVATION.json").retrievedAtUTC).toBe(NOW);
  });

  it("aborts a slow body after 15 seconds and starts no follow-up", async () => {
    let signal: AbortSignal | undefined;
    adapter.schedule = dispatch => dispatch("schedule", spec => { sent.push({ operation: "schedule", at: Date.now(), spec }); signal = spec.signal; return new Promise((_resolve, reject) => spec.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })); });
    await run(false); expect(signal?.aborted).toBe(true); expect(sent).toHaveLength(1); expect(Date.now() - Date.parse(NOW)).toBe(15000);
  });

  it("bounds an adapter stalled outside HTTP dispatch by the total work deadline", async () => {
    adapter.withJob = async () => new Promise<void>(() => {});
    await run(false); expect(sent).toHaveLength(1); expect(Date.now() - Date.parse(NOW)).toBe(120000); expect(exists("MANIFEST.json")).toBe(false);
  });

  it.each(["missing", "changed"])("rejects a %s lifecycle reference before transmission", async kind => {
    adapter = makeAdapter("enabled"); input.lifecycleMode = "enabled";
    adapter.withJob = async ({ dispatch }, work) => {
      await dispatch("begin", spec => invoke("begin", spec), kind === "missing" ? undefined : jobReference);
      await work();
      await dispatch("finish", spec => invoke("finish", spec), { jobToken: "22222222-2222-4222-8222-222222222222" });
    };
    await run(false);
    expect(sent.some(call => call.operation === "finish")).toBe(false);
    if (kind === "missing") expect(sent.map(call => call.operation)).toEqual(["schedule"]);
    expect(exists("MANIFEST.json")).toBe(false);
  });

  it("records an unsettled timed-out transport without allowing overlapping cleanup", async () => {
    adapter.schedule = dispatch => dispatch("schedule", spec => { sent.push({ operation: "schedule", at: Date.now(), spec }); return new Promise(() => {}); });
    await run(false); expect(sent).toHaveLength(1); expect(read("FAILED.json").activeTransportUnsettled).toBe(true);
  });

  it("refuses concurrent operations before the queued transport starts", async () => {
    adapter.schedule = async dispatch => {
      const first = dispatch("schedule", spec => response("schedule", spec));
      await expect(dispatch("schedule", spec => response("schedule", spec))).rejects.toThrow("concurrent_operation_blocked");
      return first;
    };
    await run(false); expect(sent).toHaveLength(0); expect(exists("MANIFEST.json")).toBe(false);
  });

  it("preserves the first page when second-page retention fails", async () => {
    const open = fs.openSync;
    vi.spyOn(fs, "openSync").mockImplementation((path, flags, mode) => { if (String(path).endsWith("onIce.parser-input.html")) throw new Error("disk full"); return open(path, flags, mode); });
    adapter = makeAdapter("enabled"); input.lifecycleMode = "enabled";
    await run(false); expect(exists("individual.TRANSPORT-OBSERVATION.json")).toBe(true); expect(exists("MANIFEST.json")).toBe(false); expect(sent.at(-1)?.operation).toBe("hold");
  });

  it("enforces the whole-directory byte budget including source snapshots", async () => {
    const originalRead = fs.readFileSync;
    const largeSource = Buffer.from(`/*${"x".repeat(MIB / 2 - 4)}*/`);
    const paths = new Set(Object.values(sourceFiles));
    vi.spyOn(fs, "readFileSync").mockImplementation(((path: fs.PathOrFileDescriptor, options?: { encoding?: string } | string | null) => {
      if (paths.has(String(path))) return largeSource;
      return originalRead(path, options as Parameters<typeof fs.readFileSync>[1]);
    }) as typeof fs.readFileSync);
    for (const role of Object.keys(input.sourceSHA256) as (keyof typeof input.sourceSHA256)[]) input.sourceSHA256[role] = sha(largeSource);
    mutateResponse = (operation, result) => {
      if (operation === "schedule") {
        const base = JSON.stringify({ ...schedule(), padding: "" });
        result.bytes = Buffer.from(base.replace('"padding":""', `"padding":"${"x".repeat(MIB - Buffer.byteLength(base))}"`));
      } else if (operation.startsWith("nst:")) {
        const start = "<table><tr><td>", end = "</td></tr></table>";
        result.bytes = Buffer.from(`${start}${"x".repeat(2 * MIB - start.length - end.length)}${end}`);
      }
    };
    await run(false);
    expect(exists("individual.TRANSPORT-OBSERVATION.json")).toBe(true); expect(exists("MANIFEST.json")).toBe(false);
    const total = fs.readdirSync(out()).reduce((bytes, file) => bytes + fs.statSync(join(out(), file)).size, 0);
    expect(total).toBeLessThanOrEqual(8 * MIB);
  });

  it("cannot publish a truncated manifest after an injected mid-write failure", async () => {
    const open = fs.openSync, write = fs.writeFileSync;
    let manifestFd: number | undefined;
    vi.spyOn(fs, "openSync").mockImplementation((path, flags, mode) => { const fd = open(path, flags, mode); if (String(path).endsWith(".MANIFEST.json.tmp")) manifestFd = fd; return fd; });
    vi.spyOn(fs, "writeFileSync").mockImplementation((file, bytes, options) => { if (file === manifestFd) { write(file, String(bytes).slice(0, 40), options); throw new Error("mid-write"); } return write(file, bytes, options); });
    await run(false); expect(exists(".MANIFEST.json.tmp")).toBe(true); expect(exists("MANIFEST.json")).toBe(false); expect(exists("onIce.TRANSPORT-OBSERVATION.json")).toBe(true);
  });

  it("refuses a manifest fsync failure before publication", async () => {
    const open = fs.openSync, sync = fs.fsyncSync;
    let manifestFd: number | undefined;
    vi.spyOn(fs, "openSync").mockImplementation((path, flags, mode) => { const fd = open(path, flags, mode); if (String(path).endsWith(".MANIFEST.json.tmp")) manifestFd = fd; return fd; });
    vi.spyOn(fs, "fsyncSync").mockImplementation(fd => { if (fd === manifestFd) throw new Error("fsync failed"); sync(fd); });
    await run(false); expect(exists("MANIFEST.json")).toBe(false);
  });

  it("atomically refuses to replace an existing completion manifest", async () => {
    const link = fs.linkSync;
    vi.spyOn(fs, "linkSync").mockImplementation((source, target) => { fs.writeFileSync(target, "existing", { flag: "wx" }); link(source, target); });
    await run(false); expect(fs.readFileSync(join(out(), "MANIFEST.json"), "utf8")).toBe("existing"); expect(exists(".MANIFEST.json.tmp")).toBe(true);
  });
});
