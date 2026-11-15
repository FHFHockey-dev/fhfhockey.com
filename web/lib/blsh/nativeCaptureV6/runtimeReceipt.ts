/** BLSH native capture v6: RUNTIME.json for a Vercel function (DESIGN.md §4.1; PROFILE-SPEC.md).
 * Replaces v5's laptop pins (node binary pin, launch/bootstrap, cwd, DYLD) with deployment facts.
 * Environment entries are key presence only; no value is ever read into the receipt. */
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import * as tlsModule from "node:tls";

export const RUNTIME_VERSION_V6 = "fhfh.blsh.native-capture-runtime.v6-vercel";
/** Same 15 override keys as v5 (RUNTIME.json.environmentPresence). */
export const RUNTIME_OVERRIDE_KEYS = ["NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_OPTIONS", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "all_proxy", "no_proxy"] as const;
/** Same 4 adapter keys as v5. v6 requires NST_JOB_LIFECYCLE_ENABLED to be absent (disabled mode). */
export const ADAPTER_ENV_KEYS = ["NST_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NST_JOB_LIFECYCLE_ENABLED"] as const;

const sha = (bytes: Uint8Array) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const utf8 = (value: string) => new Uint8Array(Buffer.from(value, "utf8"));
const present = (key: string) => Object.prototype.hasOwnProperty.call(process.env, key);
const envText = (key: string, pattern: RegExp) => { const value = process.env[key]; return typeof value === "string" && pattern.test(value) ? value : null; };

/** Hash of Node's effective default CA store; null when the API is unavailable. */
export function defaultCAStoreSHA256(): string | null {
  const list = (tlsModule as { getCACertificates?: (type: string) => unknown }).getCACertificates?.("default");
  return Array.isArray(list) && list.every(item => typeof item === "string") ? sha(utf8(list.join("\n"))) : null;
}

type FileDigest = { sha256: string | null; unavailable: string | null };
let execPathDigest: { path: string; digest: FileDigest } | undefined;
function digestFile(path: string | null | undefined, maxBytes: number): FileDigest {
  if (!path) return { sha256: null, unavailable: "path_unknown" };
  try {
    const stat = lstatSync(path);
    if (!stat.isFile()) return { sha256: null, unavailable: "not_regular_file" };
    if (stat.size > maxBytes) return { sha256: null, unavailable: "too_large" };
    return { sha256: sha(new Uint8Array(readFileSync(path))), unavailable: null };
  } catch { return { sha256: null, unavailable: "unreadable" }; }
}

export type DispatcherFacts = { present: boolean; constructorName: string | null; sameAsRunnerLoad: boolean };
export interface RuntimeReceiptInput {
  startedAtUTC: string;
  supabaseOrigin: string;
  /** Path of this route's compiled server file, when the bundle exposes one. */
  routeBundlePath: string | null;
  dispatcher: DispatcherFacts;
  instance: { invocationOrdinal: number };
}

/** Builds RUNTIME.json. Throws runtime_ca_store_unavailable when the default CA store cannot be hashed. */
export function buildRuntimeReceiptV6(input: RuntimeReceiptInput) {
  const defaultCAs = (tlsModule as { getCACertificates?: (type: string) => string[] }).getCACertificates?.("default");
  const defaultCACertificatesSHA256 = defaultCAStoreSHA256();
  if (!defaultCACertificatesSHA256) throw new Error("runtime_ca_store_unavailable");
  if (execPathDigest?.path !== process.execPath) execPathDigest = { path: process.execPath, digest: digestFile(process.execPath, 512 * 1024 * 1024) };
  const route = digestFile(input.routeBundlePath, 64 * 1024 * 1024);
  return {
    version: RUNTIME_VERSION_V6,
    startedAtUTC: input.startedAtUTC,
    node: { version: process.version, execPath: process.execPath, execPathSHA256: execPathDigest.digest.sha256,
      execPathUnavailable: execPathDigest.digest.unavailable, execArgv: [...process.execArgv] },
    tls: { rootCertificatesSHA256: sha(utf8(tlsModule.rootCertificates.join("\n"))), rootCertificateCount: tlsModule.rootCertificates.length,
      defaultCACertificatesSHA256, defaultCACertificateCount: Array.isArray(defaultCAs) ? defaultCAs.length : null },
    environmentPresence: Object.fromEntries(RUNTIME_OVERRIDE_KEYS.map(key => [key, present(key)])),
    supabaseOrigin: input.supabaseOrigin,
    lifecycleMode: "disabled" as const,
    adapterEnvironmentPresence: Object.fromEntries(ADAPTER_ENV_KEYS.map(key => [key, present(key)])),
    deployment: {
      provider: "vercel" as const,
      deploymentId: envText("VERCEL_DEPLOYMENT_ID", /^[A-Za-z0-9_-]{1,128}$/),
      env: envText("VERCEL_ENV", /^(production|preview|development)$/),
      region: envText("VERCEL_REGION", /^[a-z0-9-]{1,32}$/),
      gitCommitSha: envText("VERCEL_GIT_COMMIT_SHA", /^[0-9a-f]{40}$/),
      gitCommitRef: envText("VERCEL_GIT_COMMIT_REF", /^[A-Za-z0-9._\/-]{1,200}$/),
      routeBundleSHA256: route.sha256,
      routeBundleUnavailable: route.unavailable,
    },
    instance: { coldStart: input.instance.invocationOrdinal === 1, invocationOrdinal: input.instance.invocationOrdinal,
      processUptimeMs: Math.round(process.uptime() * 1000) },
    globalDispatcher: input.dispatcher,
    valuesRecorded: false as const,
  };
}
export type RuntimeReceiptV6 = ReturnType<typeof buildRuntimeReceiptV6>;
