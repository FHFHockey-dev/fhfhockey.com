// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ serviceRoleClient: { from: vi.fn(() => { throw new Error("service-role client must not be used"); }) }, createClientWithToken: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: mocks.serviceRoleClient }));
vi.mock("lib/supabase", () => ({ createClientWithToken: mocks.createClientWithToken }));
vi.mock("node:https", () => ({ Agent: class { constructor() { throw new Error("real HTTPS forbidden"); } }, request: () => { throw new Error("real HTTPS forbidden"); } }));
vi.mock("node:tls", () => ({ rootCertificates: ["fixture-bundled-root"], getCACertificates: () => ["fixture-default-root"], connect: () => { throw new Error("TLS forbidden"); } }));

import { CaptureRunError, type CaptureResultV6 } from "./core";
import { createFakeCaptureStore } from "./fakeCaptureStore.testHelper";
import { createBlshNativeCaptureHandler, type BlshNativeCaptureDeps } from "./handler";

const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co", CRON = "fixture-cron-secret";
const okResult: CaptureResultV6 = { state: "packet_complete_pending_review", retained: ["individual", "onIce"], operationCount: 5, lifecycleMode: "disabled",
  independentlyAccepted: false, advancedAdmission: false, score: null };
let now: number, fake: ReturnType<typeof createFakeCaptureStore>, run: ReturnType<typeof vi.fn>, precheck: string | null, storesCreated: number;
let selfTest: () => Promise<string | null>, selfTestCalls: number;
const response = () => {
  const res = { statusCode: 0, body: undefined as unknown, headers: {} as Record<string, unknown>,
    status(code: number) { res.statusCode = code; return res; }, json(value: unknown) { res.body = value; return res; }, setHeader(name: string, value: unknown) { res.headers[name] = value; } };
  return res;
};
const call = async (authorization = `Bearer ${CRON}`, method = "POST") => {
  const deps: BlshNativeCaptureDeps = { now: () => now, precheck: () => precheck, createStore: () => { storesCreated++; return fake.store; },
    createAdapter: sourceDate => ({ supabaseOrigin: ORIGIN, sourceDate, schedule: vi.fn(), nst: vi.fn() }),
    createSink: (_store, runId, sourceDate) => ({ runId, sourceDate, write: vi.fn(), checkpoint: vi.fn(), intent: vi.fn(), publishManifest: vi.fn(), close: vi.fn(), dispose: vi.fn() }),
    run: run as unknown as BlshNativeCaptureDeps["run"], selfTest: () => { selfTestCalls++; return selfTest(); }, routeBundlePath: null };
  const res = response();
  await createBlshNativeCaptureHandler(deps)({ method, headers: { authorization }, query: {} } as never, res as never);
  return res;
};

beforeEach(() => {
  now = Date.parse("2026-11-20T12:05:00.000Z"); vi.useFakeTimers(); vi.setSystemTime(now);
  fake = createFakeCaptureStore(); run = vi.fn(async () => okResult); precheck = null; storesCreated = 0;
  selfTest = async () => null; selfTestCalls = 0;
  vi.stubEnv("CRON_SECRET", CRON); vi.stubEnv("NST_KEY", "k"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "s"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN);
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_Fixture"); vi.stubEnv("VERCEL_ENV", "production");
  delete process.env.NST_JOB_LIFECYCLE_ENABLED;
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("v6 route handler gates", () => {
  it("refuses any caller without the cron bearer (an admin JWT included) before any store access", async () => {
    const res = await call("Bearer some-admin-jwt");
    expect(res.statusCode).toBe(403); expect(storesCreated).toBe(0); expect(run).not.toHaveBeenCalled();
  });

  it("applies the clock gates with no I/O: pilot fence and window", async () => {
    now = Date.parse("2026-11-17T12:05:00.000Z");
    expect(await call()).toMatchObject({ statusCode: 200, body: { success: true, skipped: "pilot_fence" } });
    now = Date.parse("2026-11-20T12:31:00.000Z");
    expect(await call()).toMatchObject({ statusCode: 409, body: { success: false, error: "outside_window" } });
    expect(storesCreated).toBe(0);
  });

  it("refuses environment drift and a failed runtime precheck before the store (503, date not burned)", async () => {
    vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", "false");
    expect(await call()).toMatchObject({ statusCode: 503, body: { error: "capture_adapter_lifecycle_key_present" } });
    delete process.env.NST_JOB_LIFECYCLE_ENABLED; vi.stubEnv("VERCEL_DEPLOYMENT_ID", "");
    expect(await call()).toMatchObject({ statusCode: 503, body: { error: "deployment_id_missing" } });
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_Fixture"); vi.stubEnv("VERCEL_ENV", "preview");
    expect(await call()).toMatchObject({ statusCode: 503, body: { error: "deployment_not_production" } });
    vi.stubEnv("VERCEL_ENV", "production"); precheck = "global_dispatcher_not_runner_load_default";
    expect(await call()).toMatchObject({ statusCode: 503, body: { error: "global_dispatcher_not_runner_load_default" } });
    expect(storesCreated).toBe(0); expect(fake.runs.size).toBe(0);
  });

  it("refuses a failed or throwing observer self-test (gate 5.5) with a 503 before the claim: the date is not burned", async () => {
    selfTest = async () => "observer_selftest_failed";
    let res = await call();
    expect(res.statusCode).toBe(503); expect(res.body).toMatchObject({ success: false, error: "observer_selftest_failed", sourceDate: "2026-11-19" });
    selfTest = async () => { throw new Error("listen EACCES"); };
    res = await call();
    expect(res.statusCode).toBe(503); expect(res.body).toMatchObject({ success: false, error: "observer_selftest_failed" });
    expect(fake.runs.size).toBe(0); expect(run).not.toHaveBeenCalled(); expect(selfTestCalls).toBe(2);
    selfTest = async () => null;
    res = await call();
    expect(res.statusCode).toBe(200); expect(run).toHaveBeenCalledTimes(1); expect(fake.runs.size).toBe(1);
  });

  it("skips while the kill switch is off, without claiming", async () => {
    fake.setEnabled(false);
    expect(await call()).toMatchObject({ statusCode: 200, body: { success: true, skipped: "disabled", sourceDate: "2026-11-19" } });
    expect(selfTestCalls).toBe(0); // the self-test runs only once the kill switch is on
    expect(fake.runs.size).toBe(0); expect(run).not.toHaveBeenCalled();
  });

  it("claims once: the backup trigger gets a 200 already_claimed skip and never runs", async () => {
    const first = await call();
    expect(first).toMatchObject({ statusCode: 200, body: { success: true, state: "packet_complete_pending_review", sourceDate: "2026-11-19", operationCount: 5 } });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toMatchObject({ sourceDate: "2026-11-19", supabaseOrigin: ORIGIN, plan: { input: { date: "2026-11-19", plannedAtUTC: "2026-11-20T12:05:00.000Z" } } });
    now = Date.parse("2026-11-20T12:20:00.000Z"); vi.setSystemTime(now);
    expect(await call()).toMatchObject({ statusCode: 200, body: { success: true, skipped: "already_claimed" } });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("reports a refused slate as 422 and a failed capture as 500 (both final for D)", async () => {
    run = vi.fn(async () => { throw new CaptureRunError("refused_schedule", "schedule_game_incomplete_or_wrong_scope", true); });
    expect(await call()).toMatchObject({ statusCode: 422, body: { success: false, state: "refused_schedule", runClosed: true } });
    now = Date.parse("2026-11-21T12:05:00.000Z"); vi.setSystemTime(now);
    run = vi.fn(async () => { throw new CaptureRunError("failed", "permit_not_usable", true); });
    expect(await call()).toMatchObject({ statusCode: 500, body: { success: false, state: "failed", reason: "permit_not_usable", sourceDate: "2026-11-20" } });
  });

  it("an unreadable kill switch or an unacknowledged claim is a 503 that does not run the capture", async () => {
    fake.store.enabled = async () => { throw new Error("down"); };
    expect(await call()).toMatchObject({ statusCode: 503, body: { error: "kill_switch_unreadable" } });
    fake = createFakeCaptureStore(); fake.store.claim = async () => { throw new Error("timeout"); };
    expect(await call()).toMatchObject({ statusCode: 503, body: { error: "claim_unacknowledged" } });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("route module", () => {
  it("runs as its own function: maxDuration 250 in the route and in vercel.json, unlike the shared 240 (M1)", () => {
    const vercel = JSON.parse(readFileSync(resolve(__dirname, "../../../vercel.json"), "utf8"));
    expect(vercel.functions).toEqual({
      "pages/api/**/*.ts": { maxDuration: 240 },
      "pages/api/v1/db/blsh-native-capture.ts": { maxDuration: 250 },
      // The BLSH hosted fixture-replay route (test mode) runs as its own 300 s function too.
      "pages/api/v1/db/blsh-replay-run.ts": { maxDuration: 300 },
      "pages/api/v1/db/forge-pregame-capture.ts": { maxDuration: 420 },
    });
  });

  it("is POST-only behind adminOnly", async () => {
    const route = await import("../../../pages/api/v1/db/blsh-native-capture");
    expect(route.config).toEqual({ maxDuration: 250 });
    const unauthenticated = response();
    await route.default({ method: "POST", headers: {}, query: {} } as never, unauthenticated as never);
    expect(unauthenticated.statusCode).toBe(401);
    const get = response();
    await route.default({ method: "GET", headers: { authorization: `Bearer ${CRON}` }, query: {} } as never, get as never);
    expect(get.statusCode).toBe(405);
    expect(mocks.serviceRoleClient.from).not.toHaveBeenCalled();
  });
});
