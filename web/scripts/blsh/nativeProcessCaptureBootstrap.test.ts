// @vitest-environment node
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ factory: vi.fn(), runner: vi.fn(), resolve: vi.fn() }));
vi.mock("node:module", () => ({ createRequire: () => ({ resolve: calls.resolve }) }));
vi.mock("./nativeProcessCaptureAdapter", () => ({ createNativeProcessCaptureAdapter: calls.factory }));
vi.mock("./nativeProcessCaptureRunner", () => ({ runNativeProcessCapture: calls.runner }));
vi.mock("node:fs", async original => {
  const real = await original<typeof import("node:fs")>();
  return { ...real, readFileSync: vi.fn(real.readFileSync), lstatSync: vi.fn(real.lstatSync) };
});
// An accidental real transport is never part of this suite.
vi.mock("node:http", () => { throw new Error("real HTTP forbidden"); });
vi.mock("node:https", () => { throw new Error("real HTTPS forbidden"); });
vi.mock("node:net", () => { throw new Error("real sockets forbidden"); });
vi.mock("node:tls", () => { throw new Error("real TLS forbidden"); });

const WEB = "/Users/tim/Code/fhfhockey.com/web";
const OUTPUT = "/Users/tim/Library/Application Support/fhfh-blsh-native-20261113T140500Z";
const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const SLOT = "2026-11-13T14:05:00.000Z";
const originalArgs = process.execArgv;
let directory: string;
let bootstrap: typeof import("./nativeProcessCaptureBootstrap").nativeProcessCaptureBootstrap;
let runtimeResolve: (target: string) => string;
const hash = (path: string) => createHash("sha256").update(new Uint8Array(fs.readFileSync(path))).digest("hex");
const receipt = () => ({ version: "fhfh.blsh.native-pilot-authorization.v1", approvedBy: "TJ", approvedAtUTC: "2026-11-12T20:00:00.000Z",
  approvalReference: "fixture:not-real-approval", operator: "fixture-operator", bootstrapSHA256: hash(resolve(__dirname, "nativeProcessCaptureBootstrap.ts")),
  slotStartUTC: SLOT, outputDirectory: OUTPUT, supabaseOrigin: ORIGIN, lifecycleMode: "disabled", maximumHTTPAttempts: 5,
  coordinationReceipt: "fixture:coordination", runtimeReceipt: "fixture:runtime", admissionReceipt: "fixture:admission" });
const writeReceipt = (change: Record<string, unknown> = {}) => {
  const path = join(directory, "synthetic-approval.json");
  fs.writeFileSync(path, JSON.stringify({ ...receipt(), ...change }), { mode: 0o600 });
  return path;
};
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  const real = await vi.importActual<typeof import("node:fs")>("node:fs");
  const modules = await vi.importActual<typeof import("node:module")>("node:module");
  const nodeResolve = modules.createRequire(resolve(__dirname, "nativeProcessCaptureBootstrap.ts")).resolve;
  // Vitest does not install ts-node's .ts extension hook. Preserve Node's .js
  // preference, then model the explicit .ts fallback used by the approved CLI.
  runtimeResolve = target => {
    try { return nodeResolve(target); } catch (error) {
      if (target.startsWith(`${WEB}/`) && real.existsSync(`${target}.ts`)) return nodeResolve(`${target}.ts`);
      throw error;
    }
  };
  calls.resolve.mockImplementation(runtimeResolve);
  vi.mocked(fs.readFileSync).mockImplementation(real.readFileSync);
  vi.mocked(fs.lstatSync).mockImplementation(real.lstatSync);
  vi.useFakeTimers(); vi.setSystemTime(SLOT);
  process.execArgv = ["--require", "./node_modules/ts-node/register/transpile-only"];
  vi.stubEnv("NODE_PATH", "."); vi.stubEnv("DISABLE_V8_COMPILE_CACHE", "1");
  vi.stubEnv("TS_NODE_COMPILER_OPTIONS", '{"module":"commonjs","moduleResolution":"node"}');
  for (const key of ["NODE_OPTIONS", "NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY", "SSL_CERT_FILE", "SSL_CERT_DIR",
    "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "https_proxy", "http_proxy", "all_proxy", "TS_NODE_PROJECT", "TS_NODE_SKIP_PROJECT", "TS_NODE_COMPILER", "TS_NODE_TRANSPILE_ONLY", "TS_NODE_REQUIRE",
    "TS_NODE_CWD", "TS_NODE_DIR", "TS_NODE_COMPILER_HOST", "TS_NODE_EMIT", "TS_NODE_SCOPE", "TS_NODE_SCOPE_DIR", "TS_NODE_SWC", "TS_NODE_TRANSPILER"])
    vi.stubEnv(key, undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN); vi.stubEnv("NST_JOB_LIFECYCLE_ENABLED", undefined);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("real fetch forbidden"); }));
  directory = fs.mkdtempSync(join(tmpdir(), "blsh-bootstrap-fixture-"));
  calls.factory.mockReturnValue({ synthetic: true }); calls.runner.mockResolvedValue({ state: "packet_complete_pending_review" });
  bootstrap = (await import("./nativeProcessCaptureBootstrap")).nativeProcessCaptureBootstrap;
});
afterEach(() => {
  process.execArgv = originalArgs; vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("one-shot native capture bootstrap, entirely offline", () => {
  it("defaults to check-only with no credential access, adapter call or output creation", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    const env = process.env;
    process.env = new Proxy(env, { get(target, key) {
      if (key === "NST_KEY" || key === "SUPABASE_SERVICE_ROLE_KEY") throw new Error("credential read forbidden");
      return Reflect.get(target, key);
    } });
    try {
      expect(await bootstrap([])).toMatchObject({ state: "offline_preflight_only", project: "unset", credentialsInspected: false, outputCreated: false, sourcePinsMatched: 9 });
    } finally { process.env = env; }
    expect(calls.factory).not.toHaveBeenCalled(); expect(calls.runner).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    expect(fs.existsSync(OUTPUT)).toBe(false);
  });

  it("invokes exactly one synthetic adapter and runner with fresh fixed scope and reviewed pins", async () => {
    const approved = writeReceipt();
    expect(await bootstrap(["--run", approved])).toMatchObject({ state: "packet_complete_pending_review", sourceAcceptance: false });
    expect(calls.factory).toHaveBeenCalledTimes(1); expect(calls.runner).toHaveBeenCalledTimes(1);
    const [input, adapter, output] = calls.runner.mock.calls[0];
    expect(input).toMatchObject({ lifecycleMode: "disabled", supabaseOrigin: ORIGIN, plan: { input: { plannedAtUTC: SLOT, date: "2026-11-07", groups: ["individual", "onIce"] } } });
    expect(input.sourceSHA256.runner).toBe("5ef3a631cdc4abb8a6a8f5a2f3a379c75640fa82fb7b563a0feb9444c94099eb");
    expect(Object.keys(input.sourceSHA256)).toHaveLength(9); expect(adapter).toEqual({ synthetic: true }); expect(output).toBe(OUTPUT);
    await expect(bootstrap(["--run", approved])).rejects.toThrow("bootstrap_already_attempted");
    expect(calls.runner).toHaveBeenCalledTimes(1); expect(fetch).not.toHaveBeenCalled(); expect(fs.existsSync(OUTPUT)).toBe(false);
  });

  it.each([[], ["--run"], ["--run", "x", "--force"], ["--force"]].slice(1))("rejects malformed CLI %j before adapter access", async (...args) => {
    await expect(bootstrap(args as string[])).rejects.toThrow("bootstrap_arguments"); expect(calls.factory).not.toHaveBeenCalled();
  });

  it.each([
    { bootstrapSHA256: "0".repeat(64) }, { lifecycleMode: "enabled" }, { maximumHTTPAttempts: 8 },
    { outputDirectory: "/tmp/alternate" }, { supabaseOrigin: "https://example.invalid" }, { slotStartUTC: "2026-11-14T14:05:00.000Z" },
    { approvedBy: "fixture-no-human" }, { approvedAtUTC: "2026-11-14T14:05:00.000Z" }, { coordinationReceipt: "" }, { force: true },
  ])("rejects scope/evidence mismatch %j without adapter construction", async change => {
    await expect(bootstrap(["--run", writeReceipt(change)])).rejects.toThrow();
    expect(calls.factory).not.toHaveBeenCalled(); expect(calls.runner).not.toHaveBeenCalled();
  });

  it.each(["2026-11-13T14:04:59.999Z", "2026-11-13T14:06:00.000Z", "2026-11-15T00:00:00.000Z"])("rejects outside the one start window: %s", async now => {
    vi.setSystemTime(now); await expect(bootstrap(["--run", writeReceipt()])).rejects.toThrow("bootstrap_outside_approved_slot");
    expect(calls.factory).not.toHaveBeenCalled();
  });

  it.each([["NEXT_PUBLIC_SUPABASE_URL", undefined], ["NST_JOB_LIFECYCLE_ENABLED", "true"]])("rejects configured environment mismatch %s", async (key, value) => {
    vi.stubEnv(key!, value); await expect(bootstrap(["--run", writeReceipt()])).rejects.toThrow("bootstrap_configured_environment_mismatch"); expect(calls.factory).not.toHaveBeenCalled();
  });

  it("rejects runtime overrides during check without importing the adapter", async () => {
    vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "0"); await expect(bootstrap(["--check"])).rejects.toThrow("bootstrap_runtime_override"); expect(calls.factory).not.toHaveBeenCalled();
  });

  it("rejects source drift instead of refreshing expected pins", async () => {
    const real = await vi.importActual<typeof import("node:fs")>("node:fs");
    vi.mocked(fs.readFileSync).mockImplementation(((path: fs.PathOrFileDescriptor, ...args: unknown[]) =>
      path === join(WEB, "lib/nst/client.ts") ? Buffer.from("changed source") : Reflect.apply(real.readFileSync, real, [path, ...args])) as typeof fs.readFileSync);
    await expect(bootstrap(["--run", writeReceipt()])).rejects.toThrow("bootstrap_source_pin_mismatch"); expect(calls.factory).not.toHaveBeenCalled();
  });

  it.each(["scripts/blsh/nativeProcessCaptureRunner", "scripts/blsh/nativeProcessCaptureAdapter", "scripts/blsh/nativeProcessCapturePreparation", "lib/nst/client"])("rejects a JS shadow of pinned source %s before any adapter call", async relative => {
    calls.resolve.mockImplementation((target: string) => target === join(WEB, relative) ? `${target}.js` : runtimeResolve(target));
    await expect(bootstrap(["--run", writeReceipt()])).rejects.toThrow("bootstrap_source_resolution_mismatch");
    expect(calls.factory).not.toHaveBeenCalled(); expect(calls.runner).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an existing output before adapter construction", async () => {
    const real = await vi.importActual<typeof import("node:fs")>("node:fs");
    vi.mocked(fs.lstatSync).mockImplementation(((path: fs.PathLike, ...args: unknown[]) =>
      path === OUTPUT ? real.lstatSync(directory) : Reflect.apply(real.lstatSync, real, [path, ...args])) as typeof fs.lstatSync);
    await expect(bootstrap(["--run", writeReceipt()])).rejects.toThrow("bootstrap_output_exists"); expect(calls.factory).not.toHaveBeenCalled();
  });

  it.each(["public", "symlink", "oversize"])("rejects %s authorization files", async kind => {
    let path = writeReceipt();
    if (kind === "public") fs.chmodSync(path, 0o644);
    if (kind === "oversize") fs.writeFileSync(path, "x".repeat(16_385));
    if (kind === "symlink") { const link = join(directory, "linked.json"); fs.symlinkSync(path, link); path = link; }
    await expect(bootstrap(["--run", path])).rejects.toThrow(); expect(calls.factory).not.toHaveBeenCalled();
  });

  it("sanitizes runner failure and never retries it", async () => {
    calls.runner.mockRejectedValueOnce(new Error("synthetic sensitive upstream failure"));
    const approved = writeReceipt();
    await expect(bootstrap(["--run", approved])).rejects.toThrow("bootstrap_capture_failed_preserve_packet_no_retry");
    await expect(bootstrap(["--run", approved])).rejects.toThrow("bootstrap_already_attempted"); expect(calls.runner).toHaveBeenCalledTimes(1);
  });

  it("rechecks the start window after adapter construction before runner dispatch", async () => {
    calls.factory.mockImplementationOnce(() => { vi.setSystemTime("2026-11-13T14:06:00.000Z"); return { synthetic: true }; });
    await expect(bootstrap(["--run", writeReceipt()])).rejects.toThrow("bootstrap_capture_failed_preserve_packet_no_retry"); expect(calls.runner).not.toHaveBeenCalled();
  });
});
