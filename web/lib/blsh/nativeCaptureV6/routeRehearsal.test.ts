// @vitest-environment node
/** Offline rehearsal of the deployed shape: the real route module (adminOnly ->
 * withOperationalRouteAuth -> withCronJobAudit -> handler), the real isolated writer whose
 * node:https is routed to an in-process fake Supabase (PostgREST RPCs + Storage, modelling the
 * migration's rules), the real core, adapter, canonical NST client and shared admission.
 * Provider/admission HTTP is a mocked fetch that publishes synthetic undici TLS events.
 * Zero real network: node:net/node:tls/node:http are forbidden and fetch is the mock. The gate-5.5
 * observer self-test needs a real loopback server, so it is substituted here (its real run and its
 * refusal path are covered in tlsObservation.test.ts and handler.test.ts); here it gates the claim.
 * Set BLSH_V6_REHEARSAL_OUT=<file> to write the scenario results as JSON. */
import { channel } from "node:diagnostics_channel";
import { randomUUID, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const selfTestState = vi.hoisted(() => ({ result: null as string | null, calls: 0 }));
const fakeSupabase = vi.hoisted(() => {
  type Run = { runId: string; sourceDate: string; state: string; reason: string | null; manifest: string | null; intents: string[] };
  const state = {
    enabled: true, runs: new Map<string, Run>(), storage: new Map<string, Buffer>(), objects: [] as { runId: string; ordinal: number; path: string; sha256: string }[],
    log: [] as string[], agents: [] as unknown[], audits: [] as unknown[], failRpc: undefined as string | undefined, sendHeadersDuringWrites: 0,
  };
  const rpc = (name: string, args: Record<string, unknown>): unknown => {
    if (state.failRpc === name) throw new Error("fake rpc failure");
    const run = typeof args.p_run_id === "string" ? state.runs.get(args.p_run_id) : undefined;
    switch (name) {
      case "blsh_capture_enabled_v1": return state.enabled;
      case "blsh_capture_claim_v1": {
        if (!state.enabled) throw new Error("disabled");
        if ([...state.runs.values()].some(r => r.sourceDate === args.p_source_date)) return { claimed: false };
        const runId = randomUUID(); state.runs.set(runId, { runId, sourceDate: String(args.p_source_date), state: "claimed", reason: null, manifest: null, intents: [] });
        return { claimed: true, run_id: runId };
      }
      case "blsh_capture_intent_v1": {
        if (!run || run.state !== "claimed" || run.intents.length !== (args.p_group === "individual" ? 0 : 1)) throw new Error("intent refused");
        run.intents.push(String(args.p_group)); return true;
      }
      case "blsh_capture_object_v1": {
        const path = String(args.p_path), existing = state.objects.filter(o => o.runId === run?.runId);
        if (!run || run.state !== "claimed" || !path.startsWith(`native-v6/${run.sourceDate}/${run.runId}/`) || args.p_ordinal !== existing.length + 1
          || existing.some(o => o.path.endsWith("/MANIFEST.json")) || state.storage.get(path)?.length !== args.p_bytes) throw new Error("object refused");
        state.objects.push({ runId: run.runId, ordinal: args.p_ordinal as number, path, sha256: String(args.p_sha256) }); return true;
      }
      case "blsh_capture_close_v1": {
        if (!run || run.state !== "claimed") throw new Error("close refused");
        const last = state.objects.filter(o => o.runId === run.runId).at(-1);
        if (["packet_complete_pending_review", "no_slate"].includes(String(args.p_state)) && (!last?.path.endsWith("/MANIFEST.json") || last.sha256 !== args.p_manifest_sha256)) throw new Error("close refused");
        Object.assign(run, { state: args.p_state, reason: args.p_reason, manifest: args.p_manifest_sha256 }); return true;
      }
      default: throw new Error(`unknown rpc ${name}`);
    }
  };
  // node:https stand-in for the writer only. It answers in-process; nothing connects.
  const https = {
    Agent: class { constructor(options: unknown) { state.agents.push(options); } },
    request: (url: string, options: { method: string; headers: Record<string, string> }, onResponse: (response: unknown) => void) => {
      const chunks: Uint8Array[] = [];
      const respond = (status: number, body: unknown) => {
        const handlers: Record<string, (value?: unknown) => void> = {};
        const response = { statusCode: status, on(event: string, handler: (value?: unknown) => void) { handlers[event] = handler; return response; }, destroy() {} };
        onResponse(response);
        queueMicrotask(() => { handlers.data?.(Buffer.from(JSON.stringify(body))); handlers.end?.(); });
      };
      return {
        on() { return this; }, destroy() {},
        end(body?: Buffer) {
          if (body) chunks.push(new Uint8Array(body));
          const parsed = new URL(url), bytes = Buffer.concat(chunks);
          queueMicrotask(() => {
            if (parsed.pathname.startsWith("/storage/v1/object/blsh-native-packets/")) {
              const key = decodeURIComponent(parsed.pathname.slice("/storage/v1/object/blsh-native-packets/".length));
              if (options.headers["x-upsert"] !== "false" || state.storage.has(key)) return respond(409, { error: "Duplicate" });
              state.storage.set(key, bytes); state.log.push(`upload:${key.split("/").at(-1)}`); return respond(200, { Key: key });
            }
            const name = parsed.pathname.replace("/rest/v1/rpc/", "");
            state.log.push(`rpc:${name}`);
            try { respond(200, rpc(name, JSON.parse(bytes.toString("utf8") || "{}"))); } catch { respond(400, { message: "refused" }); }
          });
        },
      };
    },
  };
  const serviceRoleClient = { from: (table: string) => ({ insert: (row: unknown) => { state.audits.push({ table, row }); state.log.push(`audit:${table}`); return Promise.resolve({ error: null }); } }) };
  return { state, https, serviceRoleClient };
});
vi.mock("node:https", () => fakeSupabase.https);
vi.mock("node:http", () => { throw new Error("real HTTP forbidden"); });
vi.mock("./tlsObservation", async original => ({
  ...await original<typeof import("./tlsObservation")>(),
  observerSelfTest: vi.fn(async () => { selfTestState.calls++; return selfTestState.result; }),
}));
vi.mock("node:net", () => { throw new Error("real sockets forbidden"); });
vi.mock("node:tls", () => ({ rootCertificates: ["fixture-bundled-root"], getCACertificates: () => ["fixture-default-root"],
  connect: () => { throw new Error("real TLS forbidden"); }, createSecureContext: () => { throw new Error("real TLS forbidden"); } }));
vi.mock("lib/supabase/server", () => ({ default: fakeSupabase.serviceRoleClient }));
vi.mock("lib/supabase", () => ({ createClientWithToken: () => { throw new Error("JWT path must not run"); } }));
vi.mock("../../nst/requestBudget", async original => ({
  ...await original<typeof import("../../nst/requestBudget")>(),
  withNstRequestBudget: vi.fn(async (_url: string, control: { attemptsStarted: number; maxAttempts: number }, start: () => Promise<unknown>) => {
    if (control.attemptsStarted >= control.maxAttempts) throw new Error("fixture attempt cap");
    control.attemptsStarted++;
    return start();
  }),
}));

import route from "../../../pages/api/v1/db/blsh-native-capture";

const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co", CRON = "fixture-cron-secret", KEY = "fixture-NST-key-789", SERVICE = "fixture-service-key-012";
const DATE = "2026-11-19";
const results: { scenario: string; status: number; body: unknown; fetches: string[]; runState: string | null; objects: number; ok: boolean }[] = [];
let fetches: string[], noGames = false, admissionAllowed = true, resumedAdmission = false;
const sendHeaders = channel("undici:client:sendHeaders"), requestCreate = channel("undici:request:create");
let undiciEvents = 0;
const countEvents = () => { undiciEvents++; };
const socket = (host: string, resumed: boolean) => {
  const root: Record<string, unknown> = { issuer: { CN: "Fixture Root" } }; root.issuerCertificate = root;
  const leaf = { fingerprint256: Array(32).fill("EF").join(":"), valid_from: "Nov  1 00:00:00 2026 GMT", valid_to: "Jan 30 00:00:00 2027 GMT", subject: { CN: host },
    issuer: { CN: "Fixture Intermediate" }, issuerCertificate: { issuer: { CN: "Fixture Root" }, issuerCertificate: root } };
  return { encrypted: true, authorized: true, servername: host, alpnProtocol: "http/1.1", isSessionReused: () => resumed, getProtocol: () => "TLSv1.3",
    getCipher: () => ({ name: "TLS_AES_128_GCM_SHA256", standardName: "TLS_AES_128_GCM_SHA256", version: "TLSv1.3" }), getPeerCertificate: () => resumed ? {} : leaf };
};
const response = (body: string, url: string) => { const value = new Response(body); Object.defineProperties(value, { url: { value: url }, redirected: { value: false } }); return value; };
const res = () => {
  const r = { statusCode: 200, headersSent: false, body: undefined as unknown, headers: {} as Record<string, unknown>,
    status(code: number) { r.statusCode = code; return r; }, json(value: unknown) { r.body = value; r.headersSent = true; return r; },
    send(value: unknown) { r.body = value; r.headersSent = true; return r; }, setHeader(name: string, value: unknown) { r.headers[name] = value; }, getHeader: () => undefined };
  return r;
};
async function trigger(scenario: string, at = "2026-11-20T12:05:00.000Z") {
  vi.setSystemTime(at); fetches = [];
  const r = res();
  const pending = route({ method: "POST", headers: { authorization: `Bearer ${CRON}` }, query: {}, body: {} } as never, r as never);
  await vi.runAllTimersAsync(); await pending;
  const run = [...fakeSupabase.state.runs.values()].find(item => item.sourceDate === DATE) ?? null;
  const entry = { scenario, status: r.statusCode, body: r.body, fetches: [...fetches], runState: run?.state ?? null,
    objects: fakeSupabase.state.objects.filter(o => o.runId === run?.runId).length, ok: true };
  results.push(entry);
  return { r, run, entry };
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(fakeSupabase.state, { enabled: true, runs: new Map(), storage: new Map(), objects: [], log: [], audits: [], failRpc: undefined });
  noGames = false; admissionAllowed = true; resumedAdmission = false; undiciEvents = 0;
  selfTestState.result = null; selfTestState.calls = 0;
  sendHeaders.subscribe(countEvents);
  for (const [key, value] of Object.entries({ CRON_SECRET: CRON, NST_KEY: KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE, NEXT_PUBLIC_SUPABASE_URL: ORIGIN,
    VERCEL_DEPLOYMENT_ID: "dpl_Rehearsal01", VERCEL_ENV: "production", VERCEL_REGION: "iad1", VERCEL_GIT_COMMIT_SHA: "b".repeat(40) })) vi.stubEnv(key, value);
  delete process.env.NST_JOB_LIFECYCLE_ENABLED;
  vi.stubGlobal("fetch", vi.fn(async (target: string | URL | Request, init: RequestInit = {}) => {
    const url = String(target), parsed = new URL(url);
    let kind: string, body: string;
    if (parsed.hostname === "api-web.nhle.com") {
      kind = "schedule";
      body = JSON.stringify({ gameWeek: [{ date: DATE, games: noGames ? [] : [{ id: 2026020310, season: 20262027, gameType: 2, gameState: "FINAL", gameScheduleState: "OK",
        homeTeam: { id: 1, abbrev: "EDM" }, awayTeam: { id: 2, abbrev: "CGY" } }] }] });
    } else if (parsed.hostname === "data.naturalstattrick.com") { kind = `nst:${parsed.searchParams.get("stdoi") === "std" ? "individual" : "onIce"}`; body = `<table><tr><td>${kind}</td></tr></table>`; }
    else if (parsed.origin === ORIGIN && parsed.pathname === "/rest/v1/rpc/nst_admit_attempt_v1") {
      kind = fetches.includes("admission:individual") ? "admission:onIce" : "admission:individual";
      body = JSON.stringify({ version: 1, scope: "global-nst", permitTtlMs: 1000, allowed: admissionAllowed, waitMs: 0 });
    } else throw new Error("unexpected network target blocked");
    fetches.push(kind); fakeSupabase.state.log.push(`fetch:${kind}`);
    // Like undici: the request object is created in the caller's async context, then its headers go out.
    const request = { origin: parsed.origin, path: `${parsed.pathname}${parsed.search}`, method: init.method ?? "GET" };
    requestCreate.publish({ request });
    sendHeaders.publish({ request, headers: [], socket: socket(parsed.hostname, resumedAdmission && kind.startsWith("admission:")) });
    return response(body, url);
  }));
});
afterEach(() => { sendHeaders.unsubscribe(countEvents); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("v6 offline rehearsal through the real route module", () => {
  it("happy path, then the 12:20 backup trigger: one capture, manifest last, audit after the handler, writer isolated", async () => {
    const { r, run } = await trigger("happy_path");
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ success: true, state: "packet_complete_pending_review", sourceDate: DATE, operationCount: 5 });
    expect(fetches).toEqual(["schedule", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce"]);
    expect(run?.state).toBe("packet_complete_pending_review");
    const objects = fakeSupabase.state.objects.filter(o => o.runId === run!.runId);
    expect(objects.at(-1)!.path.endsWith("/MANIFEST.json")).toBe(true);
    for (const object of objects) expect(createHash("sha256").update(new Uint8Array(fakeSupabase.state.storage.get(object.path)!)).digest("hex")).toBe(object.sha256);
    expect(fakeSupabase.state.agents).toEqual([{ keepAlive: false, maxCachedSessions: 0 }]);
    expect(undiciEvents).toBe(5); // only the five dispatched operations; the writer never publishes on the undici channel
    const log = fakeSupabase.state.log;
    expect(log.indexOf("upload:operation-1-STARTED.json")).toBeLessThan(log.indexOf("fetch:schedule"));
    for (const group of ["individual", "onIce"]) {
      const a = log.indexOf(`fetch:admission:${group}`), n = log.indexOf(`fetch:nst:${group}`);
      expect(log.slice(a + 1, n).filter(entry => !entry.startsWith("fetch:"))).toEqual([]);
    }
    expect(log.at(-1)).toBe("audit:cron_job_audit");
    for (const bytes of fakeSupabase.state.storage.values()) { expect(bytes.toString()).not.toContain(KEY); expect(bytes.toString()).not.toContain(SERVICE); }
    const backup = await trigger("backup_trigger_1220", "2026-11-20T12:20:00.000Z");
    expect(backup.r.body).toMatchObject({ success: true, skipped: "already_claimed" });
    expect(backup.entry.fetches).toEqual([]);
  });

  it("no_slate, admission denial, warm-instance TLS resumption and kill switch off", async () => {
    noGames = true;
    expect((await trigger("no_slate")).r.body).toMatchObject({ success: true, state: "no_slate", operationCount: 1 });
    Object.assign(fakeSupabase.state, { runs: new Map(), objects: [], storage: new Map() }); noGames = false; admissionAllowed = false;
    const denied = await trigger("admission_denied");
    expect(denied.r.statusCode).toBe(500); expect(denied.entry.fetches).toEqual(["schedule", "admission:individual"]); expect(denied.run?.state).toBe("failed");
    Object.assign(fakeSupabase.state, { runs: new Map(), objects: [], storage: new Map() }); admissionAllowed = true; resumedAdmission = true;
    const warm = await trigger("warm_instance_resumed_tls");
    expect(warm.r.statusCode).toBe(500); expect(warm.run).toMatchObject({ state: "failed", reason: "tls_observation_missing" });
    Object.assign(fakeSupabase.state, { runs: new Map(), objects: [], storage: new Map(), enabled: false }); resumedAdmission = false;
    const off = await trigger("kill_switch_off");
    expect(off.r.body).toMatchObject({ success: true, skipped: "disabled" }); expect(off.entry.fetches).toEqual([]); expect(off.run).toBeNull();
  });

  it("an observer self-test refusal (gate 5.5) is a 503 before the claim: no row, no network, and the backup trigger still captures D", async () => {
    selfTestState.result = "observer_selftest_failed";
    const refused = await trigger("observer_selftest_refused");
    expect(refused.r.statusCode).toBe(503);
    expect(refused.r.body).toMatchObject({ success: false, error: "observer_selftest_failed", sourceDate: DATE });
    expect(refused.run).toBeNull(); expect(refused.entry.fetches).toEqual([]); expect(selfTestState.calls).toBe(1);
    selfTestState.result = null;
    const backup = await trigger("observer_selftest_backup_ok", "2026-11-20T12:20:00.000Z");
    expect(backup.r.body).toMatchObject({ success: true, state: "packet_complete_pending_review", operationCount: 5 });
    expect(selfTestState.calls).toBe(2);
  });

  it("a run killed mid-capture (close unacknowledged) leaves the row claimed with its intents for the watchdog", async () => {
    fakeSupabase.state.failRpc = "blsh_capture_close_v1";
    const killed = await trigger("close_unacknowledged_left_claimed");
    expect(killed.r.statusCode).toBe(500);
    expect(killed.run).toMatchObject({ state: "claimed", intents: ["individual", "onIce"] });
    expect(killed.entry.fetches).toHaveLength(5);
    if (process.env.BLSH_V6_REHEARSAL_OUT) writeFileSync(process.env.BLSH_V6_REHEARSAL_OUT, `${JSON.stringify({ version: "fhfh.blsh.cron-v6.rehearsal.v1",
      realNetworkAttempts: 0, scenarios: results.map(({ scenario, status, body, fetches: calls, runState, objects }) => ({ scenario, status, body, fetches: calls, runState, objects })) }, null, 2)}\n`);
  });
});
