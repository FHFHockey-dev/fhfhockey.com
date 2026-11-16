// @vitest-environment node
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const caStore = vi.hoisted(() => ({ current: ["fixture-default-root"] as string[] | undefined }));
vi.mock("node:tls", () => ({ rootCertificates: ["fixture-bundled-root"], getCACertificates: () => caStore.current,
  connect: () => { throw new Error("TLS forbidden"); } }));

import { buildRuntimeReceiptV6, RUNTIME_VERSION_V6 } from "./runtimeReceipt";

const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const SECRET = "fixture-secret-value-never-recorded";
const dispatcher = { present: true, constructorName: "Agent", sameAsRunnerLoad: true };
let directory: string;
beforeEach(() => { caStore.current = ["fixture-default-root"]; directory = fs.mkdtempSync(join(tmpdir(), "blsh-v6-runtime-")); });
afterEach(() => { vi.unstubAllEnvs(); fs.rmSync(directory, { recursive: true, force: true }); });

describe("v6 runtime receipt", () => {
  it("has the exact key set, presence-only environment and deployment facts", () => {
    vi.stubEnv("NST_KEY", SECRET); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SECRET); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGIN);
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_Fixture123"); vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("VERCEL_REGION", "iad1");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "a".repeat(40)); vi.stubEnv("VERCEL_GIT_COMMIT_REF", "master");
    const bundle = join(directory, "route.js"); fs.writeFileSync(bundle, "module.exports = 1;\n");
    const receipt = buildRuntimeReceiptV6({ startedAtUTC: "2026-11-20T12:05:00.000Z", supabaseOrigin: ORIGIN, routeBundlePath: bundle, dispatcher, instance: { invocationOrdinal: 1 } });
    expect(Object.keys(receipt).sort()).toEqual(["adapterEnvironmentPresence", "deployment", "environmentPresence", "globalDispatcher", "instance", "lifecycleMode",
      "node", "startedAtUTC", "supabaseOrigin", "tls", "valuesRecorded", "version"]);
    expect(receipt.version).toBe(RUNTIME_VERSION_V6);
    expect(Object.keys(receipt.environmentPresence)).toHaveLength(15);
    expect(Object.values(receipt.environmentPresence).every(value => typeof value === "boolean")).toBe(true);
    expect(receipt.adapterEnvironmentPresence).toEqual({ NST_KEY: true, SUPABASE_SERVICE_ROLE_KEY: true, NEXT_PUBLIC_SUPABASE_URL: true, NST_JOB_LIFECYCLE_ENABLED: false });
    expect(receipt.deployment).toMatchObject({ provider: "vercel", deploymentId: "dpl_Fixture123", env: "production", region: "iad1", gitCommitSha: "a".repeat(40),
      gitCommitRef: "master", routeBundleUnavailable: null });
    expect(receipt.deployment.routeBundleSHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.instance).toMatchObject({ coldStart: true, invocationOrdinal: 1 });
    expect(receipt.tls).toMatchObject({ rootCertificateCount: 1, defaultCACertificateCount: 1 });
    expect(receipt.lifecycleMode).toBe("disabled"); expect(receipt.valuesRecorded).toBe(false);
    expect(JSON.stringify(receipt)).not.toContain(SECRET);
  });

  it("records missing or malformed deployment facts as null (a CLI deploy has no git SHA)", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", ""); vi.stubEnv("VERCEL_DEPLOYMENT_ID", "bad id with spaces");
    const receipt = buildRuntimeReceiptV6({ startedAtUTC: "2026-11-20T12:05:00.000Z", supabaseOrigin: ORIGIN, routeBundlePath: null, dispatcher, instance: { invocationOrdinal: 3 } });
    expect(receipt.deployment).toMatchObject({ gitCommitSha: null, deploymentId: null, routeBundleSHA256: null, routeBundleUnavailable: "path_unknown" });
    expect(receipt.instance.coldStart).toBe(false);
  });

  it("refuses when the default CA store cannot be hashed", () => {
    caStore.current = undefined;
    expect(() => buildRuntimeReceiptV6({ startedAtUTC: "2026-11-20T12:05:00.000Z", supabaseOrigin: ORIGIN, routeBundlePath: null, dispatcher, instance: { invocationOrdinal: 1 } }))
      .toThrow("runtime_ca_store_unavailable");
  });
});
