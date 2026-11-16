// @vitest-environment node
import { AsyncResource } from "node:async_hooks";
import { channel } from "node:diagnostics_channel";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the canonical NST client and shared admission. Substitute only HTTP, the local
// ledger and the Supabase writer (an in-memory store); production-shaped URLs never resolve.
vi.mock("../../nst/requestBudget", async original => ({
  ...await original<typeof import("../../nst/requestBudget")>(),
  withNstRequestBudget: vi.fn(async (_url: string, control: { attemptsStarted: number; maxAttempts: number }, start: () => Promise<unknown>) => {
    if (control.attemptsStarted >= control.maxAttempts) throw new Error("fixture attempt cap");
    control.attemptsStarted++;
    return start();
  }),
}));
vi.mock("node:http", () => { throw new Error("real HTTP forbidden"); });
// The writer module imports node:https; any real use is forbidden here.
vi.mock("node:https", () => ({ Agent: class { constructor() { throw new Error("real HTTPS forbidden"); } }, request: () => { throw new Error("real HTTPS forbidden"); } }));
vi.mock("node:net", () => { throw new Error("real sockets forbidden"); });
vi.mock("node:tls", () => ({ rootCertificates: ["fixture-bundled-root"], getCACertificates: () => ["fixture-default-root"],
  connect: () => { throw new Error("real TLS forbidden"); }, createSecureContext: () => { throw new Error("real TLS forbidden"); } }));

import { prepareNativeProcessCapture } from "../../../scripts/blsh/nativeProcessCapturePreparation";
import { createNativeCaptureAdapterV6 } from "./adapter";
import { CaptureRunError, runNativeCaptureV6, runtimePrecheckV6, type NativeCaptureRunInputV6 } from "./core";
import { createFakeCaptureStore } from "./fakeCaptureStore.testHelper";
import { createPacketSink, type PacketSink } from "./sink";

const NOW = "2026-11-20T12:05:00.000Z", DATE = "2026-11-19", ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const KEY = "fixture-NST-secret-123", SERVICE = "fixture-service-secret-456";
const html = `<table><tr><td>Fixture é 🏒 /?key=${KEY}&x=1</td></tr></table>\r\n`;
type Game = { id: number; gameState?: string; gameScheduleState?: string };
let games: Game[];
const schedule = () => ({ gameWeek: [{ date: DATE, games: games.map((game, index) => ({ id: game.id, season: 20262027, gameType: 2, gameState: game.gameState ?? "OFF",
  gameScheduleState: game.gameScheduleState ?? "OK", homeTeam: { id: index * 2 + 1, abbrev: ["NJD", "TOR", "BOS"][index] }, awayTeam: { id: index * 2 + 2, abbrev: ["NYI", "MTL", "OTT"][index] } })) }] });
type Event = { kind: string; at: number };
let directory: string, events: Event[], fetchKinds: string[];
let fake: ReturnType<typeof createFakeCaptureStore>;
let failAt: string | undefined, admissionAllowed: boolean;
let tlsFaults: Partial<Record<string, "resumed" | "missing" | "extra">>;
let foreignTraffic: string[];
const sendHeaders = channel("undici:client:sendHeaders"), requestCreate = channel("undici:request:create");
// Created at module load, outside any observed action: work run in its scope is "another invocation".
const foreignContext = new AsyncResource("blsh-v6-test-foreign-invocation");
const fakeSocket = (host: string, resumed = false, fingerprintByte = "CD") => {
  const root: Record<string, unknown> = { issuer: { CN: "Fixture Root" } }; root.issuerCertificate = root;
  const leaf = { fingerprint256: Array(32).fill(fingerprintByte).join(":"), valid_from: "Nov  1 00:00:00 2026 GMT", valid_to: "Jan 30 00:00:00 2027 GMT",
    subject: { CN: host }, issuer: { CN: "Fixture Intermediate" }, issuerCertificate: { issuer: { CN: "Fixture Root" }, issuerCertificate: root } };
  return { encrypted: true, authorized: true, servername: host, alpnProtocol: "http/1.1", isSessionReused: () => resumed, getProtocol: () => "TLSv1.3",
    getCipher: () => ({ name: "TLS_AES_128_GCM_SHA256", standardName: "TLS_AES_128_GCM_SHA256", version: "TLSv1.3" }), getPeerCertificate: () => resumed ? {} : leaf };
};
const response = (body: string, url: string, status = 200) => {
  const value = new Response(body, { status });
  Object.defineProperties(value, { url: { value: url }, redirected: { value: false } });
  return value;
};

async function setup(delayMs = 0) {
  fake = createFakeCaptureStore();
  const store = fake.store;
  const wrap = <K extends keyof typeof store>(name: K) => {
    const original = store[name] as (...args: unknown[]) => Promise<unknown>;
    (store as unknown as Record<string, unknown>)[name] = async (...args: unknown[]) => { const value = await original(...args); events.push({ kind: `store:${name}${name === "putObject" ? `:${args[3]}` : ""}`, at: Date.now() }); return value; };
  };
  (["intent", "putObject", "close"] as const).forEach(wrap);
  const claim = await fake.store.claim({ sourceDate: DATE, deployment: {} });
  if (!claim.claimed) throw new Error("claim");
  fake.setDelay(delayMs);
  const sink = createPacketSink({ store: fake.store, runId: claim.runId, sourceDate: DATE, journalRoot: directory });
  const input: NativeCaptureRunInputV6 = { plan: prepareNativeProcessCapture({ seasonId: 20262027, date: DATE, plannedAtUTC: NOW, groups: ["individual", "onIce"] }),
    sourceDate: DATE, supabaseOrigin: ORIGIN, runId: claim.runId, routeBundlePath: null, invocationOrdinal: 1 };
  return { sink, input, runId: claim.runId };
}
async function run(sink: PacketSink, input: NativeCaptureRunInputV6) {
  const pending = runNativeCaptureV6(input, createNativeCaptureAdapterV6({ supabaseOrigin: ORIGIN, sourceDate: DATE }), sink);
  const settled = pending.then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error: error as CaptureRunError }));
  await vi.runAllTimersAsync();
  return settled;
}
const objectFiles = (runId: string) => fake.files(runId).map(item => item.file);
const object = (runId: string, file: string) => JSON.parse(fake.files(runId).find(item => item.file === file)!.bytes.toString("utf8"));

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW); vi.clearAllMocks();
  vi.stubEnv("NST_KEY", KEY); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN);
  delete process.env.NST_JOB_LIFECYCLE_ENABLED;
  directory = fs.mkdtempSync(join(tmpdir(), "blsh-v6-core-test-")); events = []; fetchKinds = []; failAt = undefined; admissionAllowed = true; tlsFaults = {}; foreignTraffic = [];
  games = [{ id: 2026020301 }, { id: 2026020302 }];
  vi.stubGlobal("fetch", vi.fn(async (target: string | URL | Request, init: RequestInit = {}) => {
    const url = String(target), parsed = new URL(url);
    let kind: string, body: string;
    if (parsed.hostname === "api-web.nhle.com") { kind = "schedule"; body = JSON.stringify(schedule()); expect(url).toBe(`https://api-web.nhle.com/v1/schedule/${DATE}`); }
    else if (parsed.hostname === "data.naturalstattrick.com") {
      kind = parsed.searchParams.get("stdoi") === "std" ? "nst:individual" : "nst:onIce"; body = html;
      expect(new Headers(init.headers).get("nst-key")).toBe(KEY); expect(parsed.searchParams.get("fd")).toBe(DATE);
    } else if (parsed.origin === ORIGIN && parsed.pathname === "/rest/v1/rpc/nst_admit_attempt_v1") {
      kind = fetchKinds.includes("admission:individual") ? "admission:onIce" : "admission:individual";
      expect(JSON.parse(String(init.body)).p_token).toBeUndefined();
      body = JSON.stringify({ version: 1, scope: "global-nst", permitTtlMs: 1000, allowed: admissionAllowed, waitMs: admissionAllowed ? 0 : 5000 });
    } else throw new Error("unexpected network target blocked");
    fetchKinds.push(kind); events.push({ kind: `fetch:${kind}`, at: Date.now() });
    // Like undici: the request object is created in the caller's async context, then its headers go out.
    const request = { origin: parsed.origin, path: `${parsed.pathname}${parsed.search}`, method: init.method ?? "GET" };
    const send = (item: object, socket: object) => { requestCreate.publish({ request: item }); sendHeaders.publish({ request: item, headers: [], socket }); };
    // Another invocation's request to the SAME origin, path and method, on its own socket (fingerprint EE).
    const foreign = () => foreignContext.runInAsyncScope(() => send({ ...request }, fakeSocket(parsed.hostname, false, "EE")));
    if (foreignTraffic.includes(kind)) foreign();
    if (tlsFaults[kind] === "missing") requestCreate.publish({ request });
    else send(request, fakeSocket(parsed.hostname, tlsFaults[kind] === "resumed"));
    if (tlsFaults[kind] === "extra") send({ ...request }, fakeSocket(parsed.hostname));
    if (foreignTraffic.includes(kind)) foreign();
    expect(init.redirect).toBe("error");
    if (kind === failAt) throw new Error(`fixture transport failure ${KEY} ${SERVICE}`);
    return response(body, url);
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); fs.rmSync(directory, { recursive: true, force: true }); });

describe("v6 core + adapter through the canonical NST client (mocked transports)", () => {
  it("captures D with exactly five ordered operations, 22 s NST spacing and manifest-last storage", async () => {
    expect(runtimePrecheckV6()).toBeNull();
    const { sink, input, runId } = await setup();
    const result = await run(sink, input);
    expect(result).toMatchObject({ ok: true, value: { state: "packet_complete_pending_review", operationCount: 5, retained: ["individual", "onIce"], lifecycleMode: "disabled" } });
    expect(fetchKinds).toEqual(["schedule", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce"]);
    const nst = events.filter(event => event.kind.startsWith("fetch:nst:"));
    expect(nst[1].at - nst[0].at).toBe(22000);
    const files = objectFiles(runId);
    expect(files.at(-1)).toBe("MANIFEST.json");
    expect(new Set(files)).toEqual(new Set(["STARTED.json", "PLAN.json", "RUNTIME.json", "operation-1-STARTED.json", "operation-1-SETTLED.json", "schedule.raw.json",
      "schedule.TRANSPORT-OBSERVATION.json", "operation-2-STARTED.json", "operation-2-SETTLED.json", "operation-3-STARTED.json", "operation-3-SETTLED.json",
      "individual.parser-input.html", "individual.TRANSPORT-OBSERVATION.json", "operation-4-STARTED.json", "operation-4-SETTLED.json", "operation-5-STARTED.json",
      "operation-5-SETTLED.json", "onIce.parser-input.html", "onIce.TRANSPORT-OBSERVATION.json", "MANIFEST.json"]));
    expect(fake.files(runId).find(item => item.file === "individual.parser-input.html")!.bytes.toString("utf8")).toBe(html.replace(KEY, "[REDACTED]"));
    expect(object(runId, "RUNTIME.json")).toMatchObject({ version: "fhfh.blsh.native-capture-runtime.v6-vercel", lifecycleMode: "disabled",
      adapterEnvironmentPresence: { NST_JOB_LIFECYCLE_ENABLED: false }, valuesRecorded: false });
    expect(object(runId, "schedule.TRANSPORT-OBSERVATION.json")).toMatchObject({ completedGameIds: [2026020301, 2026020302], TLSVerified: null });
    const manifest = object(runId, "MANIFEST.json");
    expect(manifest).toMatchObject({ state: "packet_complete_pending_review", sourceDate: DATE, runId, operationCount: 5 });
    for (const entry of manifest.files as { file: string; sha256: string }[]) expect(fake.files(runId).find(item => item.file === entry.file)!.sha256).toBe(entry.sha256);
    expect(fake.runs.get(runId)).toMatchObject({ state: "packet_complete_pending_review", reason: null });
    expect(fake.runs.get(runId)!.manifestSHA256).toBe(fake.files(runId).at(-1)!.sha256);
    expect(JSON.stringify([...fake.objects.values()].map(item => item.bytes.toString("utf8")))).not.toContain(SERVICE);
  });

  it("keeps remote writes out of the permit window: STARTED in Storage before the schedule GET, intent before each admission, nothing between admission and NST", async () => {
    const { sink, input } = await setup(400); // A 400 ms remote write: three of them inside the window would expire the 1000 ms permit.
    const result = await run(sink, input);
    expect(result.ok).toBe(true);
    const order = events.map(event => event.kind);
    expect(order.indexOf("store:putObject:operation-1-STARTED.json")).toBeLessThan(order.indexOf("fetch:schedule"));
    for (const group of ["individual", "onIce"]) {
      const admission = order.indexOf(`fetch:admission:${group}`), nst = order.indexOf(`fetch:nst:${group}`);
      expect(order.lastIndexOf("store:intent", admission)).toBeGreaterThan(-1);
      expect(order.slice(admission + 1, nst).filter(kind => kind.startsWith("store:"))).toEqual([]);
    }
  });

  it("ends a date without games as no_slate after one schedule GET", async () => {
    games = [];
    const { sink, input, runId } = await setup();
    expect(await run(sink, input)).toMatchObject({ ok: true, value: { state: "no_slate", operationCount: 1, retained: [] } });
    expect(fetchKinds).toEqual(["schedule"]);
    expect(fake.runs.get(runId)?.state).toBe("no_slate");
    expect(objectFiles(runId).at(-1)).toBe("MANIFEST.json");
  });

  it("refuses a postponed or unfinished slate (refused_schedule) with no NST or admission traffic, and keeps the schedule body", async () => {
    games = [{ id: 2026020301 }, { id: 2026020302, gameState: "OFF", gameScheduleState: "PPD" }];
    const { sink, input, runId } = await setup();
    const result = await run(sink, input);
    expect(result).toMatchObject({ ok: false, error: { state: "refused_schedule", reason: "schedule_game_incomplete_or_wrong_scope", closed: true } });
    expect(fetchKinds).toEqual(["schedule"]);
    expect(fake.runs.get(runId)).toMatchObject({ state: "refused_schedule", reason: "schedule_game_incomplete_or_wrong_scope" });
    expect(objectFiles(runId)).toContain("schedule.raw.json"); expect(objectFiles(runId)).toContain("FAILED.json");
    expect(objectFiles(runId)).not.toContain("MANIFEST.json");
  });

  it("an admission denial is final: one admission, no NST GET, no wait and no retry", async () => {
    admissionAllowed = false;
    const { sink, input, runId } = await setup();
    const result = await run(sink, input);
    expect(result.ok).toBe(false);
    expect(fetchKinds).toEqual(["schedule", "admission:individual"]);
    expect(fake.runs.get(runId)?.state).toBe("failed");
    expect(fake.runs.get(runId)?.intents).toEqual([{ group: "individual", operations: ["admission:individual", "nst:individual"] }]);
  });

  it("an NST transport failure stops with no retry and no credential in any object", async () => {
    failAt = "nst:individual";
    const { sink, input, runId } = await setup();
    const result = await run(sink, input);
    expect(result).toMatchObject({ ok: false, error: { state: "failed", closed: true } });
    expect(fetchKinds).toEqual(["schedule", "admission:individual", "nst:individual"]);
    const failed = object(runId, "FAILED.json");
    expect(failed.reason).toMatch(/^operation_failed_or_uncertain:nst:individual$|^[a-z_:]+$/);
    for (const item of fake.objects.values()) { expect(item.bytes.toString("utf8")).not.toContain(KEY); expect(item.bytes.toString("utf8")).not.toContain(SERVICE); }
  });

  it("fails closed on a resumed TLS session with no full handshake observed in this run (the warm-instance case)", async () => {
    tlsFaults = { "admission:individual": "resumed" };
    const { sink, input, runId } = await setup();
    const result = await run(sink, input);
    expect(result.ok).toBe(false);
    expect(fetchKinds).toEqual(["schedule", "admission:individual"]);
    expect(fake.runs.get(runId)).toMatchObject({ state: "failed", reason: "tls_observation_missing" });
  });

  it("ignores another invocation's requests during admission and NST (M1, Fluid): same origin, path and method, before and after ours", async () => {
    foreignTraffic = ["schedule", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce"];
    let seen = 0; const count = () => { seen++; }; sendHeaders.subscribe(count);
    try {
      const { sink, input, runId } = await setup();
      const result = await run(sink, input);
      expect(result).toMatchObject({ ok: true, value: { state: "packet_complete_pending_review", operationCount: 5 } });
      expect(fetchKinds).toEqual(["schedule", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce"]);
      expect(seen).toBe(15); // 5 ours + 10 foreign events in the process: v5's observer would have failed at the schedule
      const stored = [...fake.objects.values()].map(item => item.bytes.toString("utf8")).join("\n");
      expect(stored).toContain(Array(32).fill("CD").join(":"));
      expect(stored).not.toContain(Array(32).fill("EE").join(":")); // no foreign socket fact was attributed
      expect(fake.runs.get(runId)).toMatchObject({ state: "packet_complete_pending_review", reason: null });
    } finally { sendHeaders.unsubscribe(count); }
  });

  it.each(["admission:individual", "nst:individual"])("still requires exactly one attributed request: a second request created inside %s fails closed", async kind => {
    tlsFaults = { [kind]: "extra" };
    foreignTraffic = [kind];
    const { sink, input, runId } = await setup();
    const result = await run(sink, input);
    expect(result.ok).toBe(false);
    expect(fetchKinds).toEqual(["schedule", "admission:individual", "nst:individual"].slice(0, kind === "nst:individual" ? 3 : 2));
    expect(fake.runs.get(runId)).toMatchObject({ state: "failed" });
  });

  it("an intent-row failure stops before any admission", async () => {
    const { sink, input, runId } = await setup();
    fake.store.intent = async () => { throw new Error("store down"); };
    const result = await run(sink, input);
    expect(result.ok).toBe(false);
    expect(fetchKinds).toEqual(["schedule"]);
    expect(fake.runs.get(runId)?.state).toBe("failed");
  });

  it("refuses a present NST_JOB_LIFECYCLE_ENABLED key (any value), and a substituted date closes the run as failed with its code before any network (L3)", async () => {
    vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "false");
    expect(() => createNativeCaptureAdapterV6({ supabaseOrigin: ORIGIN, sourceDate: DATE })).toThrow("capture_adapter_lifecycle_key_present");
    delete process.env.NST_JOB_LIFECYCLE_ENABLED;
    const { sink, input, runId } = await setup();
    const result = await run(sink, { ...input, sourceDate: "2026-11-18" });
    expect(result).toMatchObject({ ok: false, error: { state: "failed", reason: "plan_date_or_run_mismatch", closed: true } });
    expect(fetchKinds).toEqual([]);
    expect(fake.runs.get(runId)).toMatchObject({ state: "failed", reason: "plan_date_or_run_mismatch" });
  });

  it("a schedule body without D's day entry is schedule_shape_invalid (failed), not no_slate (L1)", async () => {
    vi.mocked(fetch).mockImplementationOnce(async (target: string | URL | Request) => {
      const url = String(target); fetchKinds.push("schedule");
      const request = { origin: new URL(url).origin, path: new URL(url).pathname, method: "GET" };
      requestCreate.publish({ request }); sendHeaders.publish({ request, headers: [], socket: fakeSocket("api-web.nhle.com") });
      return response(JSON.stringify({ gameWeek: [{ date: "2026-11-20", games: [] }] }), url);
    });
    const { sink, input, runId } = await setup();
    expect(await run(sink, input)).toMatchObject({ ok: false, error: { state: "failed", reason: "schedule_shape_invalid" } });
    expect(fetchKinds).toEqual(["schedule"]);
    expect(fake.runs.get(runId)?.state).toBe("failed");
  });

  it("the pre-schedule checkpoint has its own 20 s budget: 4 s writes now complete the run (V-R2), 6 s writes fail with nothing sent (L2)", async () => {
    const slow = await setup(4000);
    expect(await run(slow.sink, slow.input)).toMatchObject({ ok: true, value: { state: "packet_complete_pending_review" } });
    expect(fetchKinds).toHaveLength(5);
    fetchKinds = []; fake.setDelay(0);
    const slower = await setup(6000);
    expect(await run(slower.sink, slower.input)).toMatchObject({ ok: false, error: { state: "failed", reason: "pre_schedule_checkpoint_failed_nothing_sent" } });
    expect(fetchKinds).toEqual([]);
  });
});
