/** Durable capture orchestration. No client import, credentials or CLI in this core.
 * An adapter must route EVERY HTTP attempt through dispatch, retain the existing
 * shared/local NST controls, and consume bodies inside that dispatch. The adapter
 * may attach the canonical client's redacted text afterward, keeping its witness.
 * Source pins bind a candidate; they do not certify the adapter or accept evidence.
 */
import { createHash } from "node:crypto";
import * as tlsModule from "node:tls";
import { closeSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { load } from "cheerio";
import { prepareNativeProcessCapture, type NativeProcessCapturePlan } from "./nativeProcessCapturePreparation";

const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const DATE = "2026-11-11";
const MIB = 1024 * 1024;
const GROUPS = ["individual", "onIce"] as const;
type Group = typeof GROUPS[number];
export type CaptureOperation = "schedule" | "begin" | "finish" | "hold" | `admission:${Group}` | `nst:${Group}`;
type Mode = "enabled" | "disabled";
const fail = (code: string): never => { throw new Error(code); };
const need = (value: unknown, code: string): void => { if (!value) fail(code); };
type CaptureBytes = Uint8Array | Buffer;
const hash = (bytes: CaptureBytes) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const json = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
const nullableText = (value: unknown, max: number) => value === null ? null : text(value, max) ?? fail("tls_field_invalid");
function peerFacts(value: unknown) {
  if (value === null) return null;
  need(isObject(value), "tls_peer_shape");
  const leaf = value as Record<string, unknown>;
  need(typeof leaf.fingerprint256 === "string" && /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(leaf.fingerprint256), "tls_fingerprint");
  need(Array.isArray(leaf.issuerCNChain) && leaf.issuerCNChain.length > 0 && leaf.issuerCNChain.length <= 10, "tls_chain");
  const peer = { fingerprint256: leaf.fingerprint256 as string, valid_from: text(leaf.valid_from, 64), valid_to: text(leaf.valid_to, 64),
    subjectCN: nullableText(leaf.subjectCN, 200), issuerCNChain: (leaf.issuerCNChain as unknown[]).map(name => nullableText(name, 200)) };
  need(peer.valid_from && peer.valid_to, "tls_required_field");
  return peer;
}
interface TlsFacts {
  channel: string; authorized: boolean; authorizationError: string | null; servername: string; alpnProtocol: string | null; protocol: string | null;
  cipher: { name: string | null; standardName: string | null; version: string | null };
  sessionReused: boolean; connectionReused: boolean; connectionSequence: number; resumedFromOperation: number | null; connectionFromOperation: number | null;
  peerCertificate: ReturnType<typeof peerFacts>;
}
type DispatcherFacts = { present: boolean; constructorName: string | null; identityUnchanged: boolean };
type TlsRecord = { index: number; tls: TlsFacts & { defaultCACertificatesSHA256: string | null; globalDispatcher: DispatcherFacts } };
/** Copies the adapter's socket-level TLS observation field by field, bound to this
 * request's host and to this run's earlier observations. Returns null when it is
 * missing, malformed or unbound. Recording is not verification: TLSVerified stays
 * null and the evidence bridge decides.
 * The one-shot process starts with an empty TLS session cache, so a resumed session
 * (no peer certificate in Node 22.23.4) must descend from a full handshake that this
 * run already observed for the same servername. A keep-alive reuse must bind to the
 * operation that opened that connection. Anything else fails closed. */
function tlsFacts(value: unknown, url: string, earlier: readonly TlsRecord[]): TlsFacts | null {
  try {
    need(isObject(value) && value.channel === "undici:client:sendHeaders" && typeof value.authorized === "boolean", "tls_shape");
    const tls = value as Record<string, unknown>, cipher = tls.cipher;
    need(tls.servername === new URL(url).hostname && isObject(cipher), "tls_shape");
    need(typeof tls.sessionReused === "boolean" && typeof tls.connectionReused === "boolean"
      && Number.isSafeInteger(tls.connectionSequence) && (tls.connectionSequence as number) > 0, "tls_reuse_shape");
    const suite = cipher as Record<string, unknown>, peerCertificate = peerFacts(tls.peerCertificate);
    const servername = tls.servername as string, sequence = tls.connectionSequence as number;
    let resumedFromOperation: number | null = null, connectionFromOperation: number | null = null;
    if (tls.sessionReused) {
      need(tls.authorized === true, "tls_resumed_unauthorized");
      const full = earlier.find(record => record.tls.servername === servername && !record.tls.sessionReused && !record.tls.connectionReused && record.tls.peerCertificate !== null);
      need(full, "tls_resumed_without_full_handshake");
      resumedFromOperation = full!.index;
    } else need(peerCertificate !== null, "tls_peer_missing");
    const opener = earlier.find(record => record.tls.connectionSequence === sequence);
    if (tls.connectionReused) {
      need(opener && opener.tls.servername === servername, "tls_connection_unbound");
      connectionFromOperation = opener!.index;
    } else need(!opener, "tls_connection_sequence_reused");
    const facts: TlsFacts = { channel: "undici:client:sendHeaders", authorized: tls.authorized as boolean, authorizationError: nullableText(tls.authorizationError, 200),
      servername, alpnProtocol: nullableText(tls.alpnProtocol, 32), protocol: text(tls.protocol, 32),
      cipher: { name: text(suite.name, 100), standardName: nullableText(suite.standardName, 100), version: nullableText(suite.version, 32) },
      sessionReused: tls.sessionReused as boolean, connectionReused: tls.connectionReused as boolean, connectionSequence: sequence,
      resumedFromOperation, connectionFromOperation, peerCertificate };
    need(facts.protocol && facts.cipher.name, "tls_required_field");
    return facts;
  } catch { return null; }
}

// Non-secret runtime facts bound into the packet before any dispatch. Environment
// entries are key presence only; values are never read into the packet.
const RUNTIME_OVERRIDE_KEYS = ["NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_OPTIONS", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "all_proxy", "no_proxy"] as const;
const ADAPTER_ENV_KEYS = ["NST_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NST_JOB_LIFECYCLE_ENABLED"] as const;
// Launch facts: presence only. The bootstrap requires the first three and forbids the rest.
const LAUNCH_ENV_KEYS = ["NODE_PATH", "DISABLE_V8_COMPILE_CACHE", "TS_NODE_COMPILER_OPTIONS", "OPENSSL_CONF", "TS_NODE_PROJECT", "TS_NODE_SKIP_PROJECT",
  "TS_NODE_COMPILER", "TS_NODE_TRANSPILE_ONLY", "TS_NODE_REQUIRE", "TS_NODE_CWD", "TS_NODE_DIR", "TS_NODE_COMPILER_HOST", "TS_NODE_EMIT", "TS_NODE_SCOPE",
  "TS_NODE_SCOPE_DIR", "TS_NODE_SWC", "TS_NODE_TRANSPILER"] as const;
const present = (key: string) => Object.prototype.hasOwnProperty.call(process.env, key);
const fileSHA256 = (path: string) => { try { return lstatSync(path).isFile() ? hash(readFileSync(path)) : null; } catch { return null; } };
/** Hash of Node's effective default CA store (tls.getCACertificates("default"), present in
 * Node 22.23.4). tls.setDefaultCACertificates can change it in-process, so it is re-read
 * before and after every dispatch and compared with RUNTIME.json. Null if unavailable. */
const defaultCAStoreSHA256 = () => {
  const list = (tlsModule as { getCACertificates?: (type: string) => unknown }).getCACertificates?.("default");
  return Array.isArray(list) && list.every(item => typeof item === "string") ? hash(Buffer.from(list.join("\n"))) : null;
};
// Fetch sends through the undici dispatcher registered under this symbol. Loading this module's
// cheerio import loads npm undici, which registers its default Agent at import time, so the
// registry is populated by the time this line runs; the bootstrap refuses a registry that
// was populated before its imports. That load-time object is the anchor: the same object
// must be in place at run start and before and after every dispatch. A replacement (for
// example an Agent with a private CA) is honored by fetch, so it fails closed.
const GLOBAL_DISPATCHER = Symbol.for("undici.globalDispatcher.1");
const globalDispatcher = () => (globalThis as unknown as Record<symbol, unknown>)[GLOBAL_DISPATCHER];
const dispatcherName = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const name = (value as { constructor?: { name?: unknown } }).constructor?.name;
  return typeof name === "string" ? name : null;
};
const DISPATCHER_AT_RUNNER_LOAD = globalDispatcher();
let execPathDigest: { path: string; sha256: string } | undefined;
function runtimeReceipt(input: NativeCaptureRunInput, startedAtUTC: string) {
  if (execPathDigest?.path !== process.execPath) execPathDigest = { path: process.execPath, sha256: hash(readFileSync(process.execPath)) };
  const defaultCAs = (tlsModule as { getCACertificates?: (type: string) => string[] }).getCACertificates?.("default");
  const defaultCACertificatesSHA256 = defaultCAStoreSHA256();
  need(defaultCACertificatesSHA256, "runtime_ca_store_unavailable");
  const dispatcherAtStart = globalDispatcher();
  need(DISPATCHER_AT_RUNNER_LOAD !== undefined && dispatcherAtStart === DISPATCHER_AT_RUNNER_LOAD && dispatcherName(dispatcherAtStart) === "Agent",
    "global_dispatcher_not_runner_load_default");
  const entryScript = typeof process.argv[1] === "string" ? resolve(process.argv[1]) : null;
  const entryScriptSHA256 = entryScript ? fileSHA256(entryScript) : null;
  const bootstrapPath = resolve(__dirname, "nativeProcessCaptureBootstrap.ts"), bootstrapSHA256 = fileSHA256(bootstrapPath);
  return { version: "fhfh.blsh.native-capture-runtime.v1", startedAtUTC,
    node: { version: process.version, execPath: process.execPath, execPathSHA256: execPathDigest.sha256, execArgv: [...process.execArgv] },
    tls: { rootCertificatesSHA256: hash(Buffer.from(tlsModule.rootCertificates.join("\n"))), rootCertificateCount: tlsModule.rootCertificates.length,
      defaultCACertificatesSHA256, defaultCACertificateCount: Array.isArray(defaultCAs) ? defaultCAs.length : null },
    environmentPresence: Object.fromEntries(RUNTIME_OVERRIDE_KEYS.map(key => [key, present(key)])),
    supabaseOrigin: input.supabaseOrigin, lifecycleMode: input.lifecycleMode,
    adapterEnvironmentPresence: Object.fromEntries(ADAPTER_ENV_KEYS.map(key => [key, present(key)])),
    launch: { entryScript, entryScriptSHA256, cwd: process.cwd(), bootstrapPath, bootstrapSHA256,
      entryIsBootstrap: entryScript === bootstrapPath && entryScriptSHA256 !== null && entryScriptSHA256 === bootstrapSHA256,
      environmentPresence: Object.fromEntries(LAUNCH_ENV_KEYS.map(key => [key, present(key)])),
      otherTsNodeKeysPresent: Object.keys(process.env).filter(key => key.startsWith("TS_NODE_") && !(LAUNCH_ENV_KEYS as readonly string[]).includes(key)).sort() },
    globalDispatcher: { present: dispatcherAtStart !== undefined, constructorName: dispatcherName(dispatcherAtStart), sameAsRunnerLoad: dispatcherAtStart === DISPATCHER_AT_RUNNER_LOAD },
    valuesRecorded: false };
}

export interface CaptureDispatchSpec {
  url: string;
  method: "GET" | "POST";
  redirect: "error";
  signal: AbortSignal;
  timeoutMs: number;
  maxResponseBytes: number;
}
export interface Captured<T> { operation: CaptureOperation; completedAtUTC: string; witness: object; value: T }
export type CaptureDispatch = <T>(operation: CaptureOperation, action: (spec: CaptureDispatchSpec) => Promise<T>, reference?: { jobToken: string }) => Promise<Captured<T>>;
export interface CaptureResponse {
  status: number;
  finalUrl: string;
  redirected: boolean;
  // Schedule: original decoded body. NST: exact UTF-8 parser input returned by
  // the authenticated redacting client. Never re-redact or normalize in this core.
  bytes: CaptureBytes;
}
export interface NativeCaptureAdapter {
  supabaseOrigin: string;
  lifecycleMode: Mode;
  // Pinned source of the adapter actually supplied. Review must establish this
  // binding, the runtime TLS policy, authentication/redaction and all hook paths.
  sourcePath: string;
  schedule(dispatch: CaptureDispatch): Promise<Captured<CaptureResponse>>;
  withJob(options: { deadlineAt: number; settled: () => boolean; dispatch: CaptureDispatch }, work: () => Promise<void>): Promise<void>;
  nst(group: Group, url: string, options: {
    dispatch: CaptureDispatch; requestControl: {
      deadlineAt: number; maxAttempts: 2; attemptsStarted: number; minIntervalMs: 22000; plannedRequestCount: 2;
    };
    retries: 0; allowQueryKeyFallback: false; timeoutMs: 15000; maxResponseBytes: 2097152;
    // Enforced by the canonical client's optional admission-call control.
    maxAdmissionCalls: 1;
  }): Promise<Captured<CaptureResponse>>;
}

const sourcePaths = {
  runner: __filename,
  preparation: resolve(__dirname, "nativeProcessCapturePreparation.ts"),
  client: resolve(__dirname, "../../lib/nst/client.ts"),
  budget: resolve(__dirname, "../../lib/nst/requestBudget.ts"),
  admission: resolve(__dirname, "../../lib/nst/sharedAdmission.ts"),
  admissionOrigin: resolve(__dirname, "../../lib/nst/admissionOrigin.ts"),
  lifecycle: resolve(__dirname, "../../lib/nst/jobLifecycle.server.ts"),
  ratePolicy: resolve(__dirname, "../../lib/cron/nstRateLimitPolicy.ts"),
};
type SourceRole = keyof typeof sourcePaths | "adapter";
export interface NativeCaptureRunInput {
  plan: NativeProcessCapturePlan;
  supabaseOrigin: string;
  lifecycleMode: Mode;
  sourceSHA256: Record<SourceRole, string>;
}

function sourceSnapshot(input: NativeCaptureRunInput, adapter: NativeCaptureAdapter) {
  const paths = { ...sourcePaths, adapter: adapter.sourcePath };
  need(Object.keys(input.sourceSHA256).sort().join() === Object.keys(paths).sort().join(), "source_roles_invalid");
  return Object.entries(paths).map(([role, path]) => {
    const stat = lstatSync(path);
    need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= MIB / 2, "source_file_invalid");
    const bytes = readFileSync(path);
    need(bytes.length <= MIB / 2 && hash(bytes) === input.sourceSHA256[role as SourceRole], "source_pin_mismatch");
    return { role, file: `source-${role}.ts`, sha256: hash(bytes), bytes };
  });
}

function completedGames(bytes: CaptureBytes) {
  let data: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(new Uint8Array(bytes));
    data = JSON.parse(text);
    // JSON.parse collapses duplicate names. Scan its already-valid tokens so a
    // contradictory (including escaped) status/date key cannot become finality.
    const tokens = [...text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:,]/g)].map(match => match[0]);
    const objects: (Set<string> | null)[] = [];
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      if (token === "{" || token === "[") { objects.push(token === "{" ? new Set() : null); need(objects.length <= 32, "schedule_json_depth"); }
      else if (token === "}" || token === "]") objects.pop();
      else if (token.startsWith('"') && tokens[index + 1] === ":") {
        const key = JSON.parse(token) as string, keys = objects[objects.length - 1];
        need(keys && !keys.has(key), "schedule_duplicate_key"); keys!.add(key);
      }
    }
  } catch { return fail("schedule_json_invalid"); }
  need(isObject(data) && Array.isArray(data.gameWeek), "schedule_shape_invalid");
  const days = (data as { gameWeek: unknown[] }).gameWeek.filter(day => isObject(day) && day.date === DATE);
  need(days.length === 1 && isObject(days[0]) && Array.isArray(days[0].games) && days[0].games.length > 0, "schedule_day_ambiguous_or_empty");
  const games = (days[0] as { games: unknown[] }).games;
  const ids = new Set<number>(), teamIds = new Set<number>(), abbreviations = new Set<string>();
  for (const game of games) {
    need(isObject(game), "schedule_game_invalid");
    const row = game as Record<string, unknown>;
    need(Number.isSafeInteger(row.id) && /^202602\d{4}$/.test(String(row.id)) && !ids.has(row.id as number), "schedule_game_identity_invalid");
    need(row.season === 20262027 && row.gameType === 2 && ["OFF", "FINAL"].includes(String(row.gameState)) && row.gameScheduleState === "OK", "schedule_game_incomplete_or_wrong_scope");
    ids.add(row.id as number);
    for (const team of [row.homeTeam, row.awayTeam]) {
      need(isObject(team), "schedule_team_invalid");
      const item = team as Record<string, unknown>;
      need(Number.isSafeInteger(item.id) && (item.id as number) > 0 && !teamIds.has(item.id as number) && typeof item.abbrev === "string" && /^[A-Z]{2,3}$/.test(item.abbrev) && !abbreviations.has(item.abbrev), "schedule_team_identity_invalid");
      teamIds.add(item.id as number); abbreviations.add(item.abbrev as string);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

export async function runNativeProcessCapture(input: NativeCaptureRunInput, adapter: NativeCaptureAdapter, outputDirectory: string) {
  const start = Date.now(), monotonicStart = performance.now(), deadlineAt = start + 120_000;
  const remainingRunMs = (cleanup = false) => {
    const extra = cleanup && input.lifecycleMode === "enabled" ? 5000 : 0;
    return Math.min(deadlineAt + extra - Date.now(), monotonicStart + 120_000 + extra - performance.now());
  };
  // Rebuild the plan; never accept caller-modified URLs/budgets or a substituted date.
  need(JSON.stringify(input.plan) === JSON.stringify(prepareNativeProcessCapture(input.plan.input)), "plan_modified");
  need(input.plan.input.date === DATE, "pilot_date_not_approved");
  need(input.supabaseOrigin === ORIGIN && adapter.supabaseOrigin === ORIGIN, "wrong_project");
  need(["enabled", "disabled"].includes(input.lifecycleMode) && adapter.lifecycleMode === input.lifecycleMode, "lifecycle_mode_mismatch");
  const sources = sourceSnapshot(input, adapter);
  const runtime = runtimeReceipt(input, new Date(start).toISOString());
  need(remainingRunMs() > 0, "capture_deadline");
  const scheduleUrl = `https://api-web.nhle.com/v1/schedule/${DATE}`;
  const files: { file: string; bytes: number; sha256: string }[] = [];
  let retainedBytes = 0;
  mkdirSync(outputDirectory, { mode: 0o700 }); // Existing file/directory/symlink fails before any network.
  const write = (file: string, bytes: CaptureBytes) => {
    need(retainedBytes + bytes.byteLength <= 8 * MIB, "packet_byte_limit");
    const fd = openSync(join(outputDirectory, file), "wx", 0o600);
    // Count before writing; a partial failed write cannot buy another attempt.
    retainedBytes += bytes.byteLength;
    try { writeFileSync(fd, new Uint8Array(bytes)); fsyncSync(fd); } finally { closeSync(fd); }
    files.push({ file, bytes: bytes.byteLength, sha256: hash(bytes) });
  };
  const writeJson = (file: string, value: unknown) => write(file, json(value));
  const syncDirectory = (directory = outputDirectory) => { const fd = openSync(directory, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } };
  // A durable file also needs its directory entry, including the new packet's.
  syncDirectory(dirname(resolve(outputDirectory)));
  const bindings = sources.map(source => ({ role: source.role, file: source.file, sha256: source.sha256, bytes: source.bytes.length }));
  writeJson("STARTED.json", { version: "fhfh.blsh.native-capture-run.v1", startedAtUTC: new Date(start).toISOString(), supabaseOrigin: ORIGIN, lifecycleMode: input.lifecycleMode, sourceBindings: bindings });
  writeJson("PLAN.json", input.plan);
  writeJson("RUNTIME.json", runtime);
  for (const source of sources) write(source.file, source.bytes);
  syncDirectory();

  let active = false, stopped = false, phase: "schedule" | Group | "settled" = "schedule";
  let activeAbort: AbortController | undefined;
  let lastNstStart: number | undefined;
  let jobToken: string | undefined;
  const calls = new Map<CaptureOperation, { startedAt: number; state: "started" | "settled" | "uncertain"; completedAtUTC?: string }>();
  const observed = new Map<CaptureOperation, Captured<unknown>>();
  const permits = new Map<Group, { wall: number; monotonic: number }>();
  const tlsObserved = new Map<CaptureOperation, TlsRecord>();
  const dispatch: CaptureDispatch = async (operation, action, reference) => {
    const guard = (value: unknown, code: string) => { if (!value) { stopped = true; fail(code); } };
    const now = Date.now(), monotonicNow = performance.now(), hold = operation === "hold";
    const enabled = input.lifecycleMode === "enabled";
    guard(!active, "concurrent_operation_blocked");
    guard(!stopped || hold, "operation_after_failure");
    guard(!calls.has(operation) && calls.size < (enabled ? 8 : 5), "operation_budget_exhausted");
    guard(now >= start && remainingRunMs(hold) > 0, "capture_deadline");
    guard(defaultCAStoreSHA256() === runtime.tls.defaultCACertificatesSHA256, "ca_store_changed_before_dispatch");
    guard(globalDispatcher() === DISPATCHER_AT_RUNNER_LOAD, "global_dispatcher_changed_before_dispatch");
    const lifecycle = ["begin", "finish", "hold"].includes(operation);
    if (lifecycle) {
      guard(reference && Object.keys(reference).join() === "jobToken" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(reference.jobToken), "lifecycle_reference_missing_or_invalid");
      guard(operation === "begin" ? jobToken === undefined : jobToken === reference!.jobToken, "lifecycle_reference_changed");
    } else guard(reference === undefined, "unexpected_operation_reference");
    if (operation === "schedule") guard(phase === "schedule" && calls.size === 0, "schedule_order_invalid");
    else if (["begin", "finish", "hold"].includes(operation)) {
      guard(enabled && phase !== "schedule", "lifecycle_operation_invalid");
      if (operation === "begin") guard(phase === "individual" && calls.size === 1, "begin_order_invalid");
      else guard(calls.has("begin"), "lifecycle_without_begin");
      if (operation === "finish") guard(phase === "settled", "finish_before_retention");
      if (hold) guard(stopped && !active, "hold_without_failure");
    } else {
      guard(phase === "individual" || phase === "onIce", "provider_order_invalid");
      guard(operation === `admission:${phase}` || operation === `nst:${phase}`, "provider_group_invalid");
      if (enabled) guard(calls.get("begin")?.state === "settled", "provider_before_begin");
      if (operation.startsWith("nst:")) {
        const permit = permits.get(phase as Group);
        guard(calls.get(`admission:${phase as Group}`)?.state === "settled" && now < (permit?.wall ?? 0) && monotonicNow < (permit?.monotonic ?? 0), "provider_without_current_permit");
        guard(lastNstStart === undefined || monotonicNow - lastNstStart >= 22_000, "provider_spacing_invalid");
      }
    }
    const provider = operation === "schedule" || operation.startsWith("nst:");
    const rpc = operation.startsWith("admission:") ? (enabled ? "nst_admit_job_attempt_v1" : "nst_admit_attempt_v1") : `nst_job_${operation}_v1`;
    const url = operation === "schedule" ? scheduleUrl : operation.startsWith("nst:") ? input.plan.pages.find(page => operation === `nst:${page.group}`)!.url : `${ORIGIN}/rest/v1/rpc/${rpc}`;
    const timeoutMs = Math.min(provider ? 15_000 : 5000, remainingRunMs(hold));
    const operationDeadline = now + timeoutMs;
    const monotonicDeadline = monotonicNow + timeoutMs;
    const record = { startedAt: now, state: "started" as "started" | "settled" | "uncertain", completedAtUTC: undefined as string | undefined };
    // Persist the attempted call before transmission. Interruption means unknown,
    // never a made-up success or permission to repeat the operation.
    try {
      writeJson(`operation-${calls.size + 1}-STARTED.json`, { operation, url, method: provider ? "GET" : "POST", startedAtUTC: new Date(now).toISOString(),
        ...(reference ? { jobToken: reference.jobToken } : {}) });
      if (operation === "begin") jobToken = reference!.jobToken;
      calls.set(operation, record);
      syncDirectory();
    } catch { stopped = true; record.state = "uncertain"; return fail("operation_journal_failed"); }
    active = true;
    const controller = new AbortController();
    activeAbort = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("operation_timeout")); }, Math.max(0, Math.min(operationDeadline - Date.now(), monotonicDeadline - performance.now()))); });
    const pending = Promise.resolve().then(() => {
      // Durable writes can consume a permit or deadline while timers cannot run.
      // Recheck at the actual action boundary; never extend the original budget.
      const dispatchedAt = Date.now(), dispatchedMonotonic = performance.now();
      guard(!controller.signal.aborted && (!stopped || hold) && remainingRunMs(hold) > 0 && dispatchedAt >= now && dispatchedAt < operationDeadline && dispatchedMonotonic < monotonicDeadline, "dispatch_after_stop_or_deadline");
      if (operation.startsWith("nst:")) {
        const permit = permits.get(phase as Group);
        guard(dispatchedAt < (permit?.wall ?? 0) && dispatchedMonotonic < (permit?.monotonic ?? 0), "provider_without_current_permit");
        guard(lastNstStart === undefined || dispatchedMonotonic - lastNstStart >= 22_000, "provider_spacing_invalid");
        lastNstStart = dispatchedMonotonic;
      }
      return action({ url, method: provider ? "GET" : "POST", redirect: "error", signal: controller.signal, timeoutMs: Math.min(operationDeadline - dispatchedAt, monotonicDeadline - dispatchedMonotonic), maxResponseBytes: operation === "schedule" ? MIB : provider ? 2 * MIB : 64 * 1024 });
    });
    // Keep the concurrency guard until the underlying adapter settles, including
    // after timeout. An uncooperative transport cannot start cleanup/follow-ups.
    void pending.then(() => { active = false; }, () => { active = false; });
    try {
      const value = await Promise.race([pending, timeout]);
      need(!controller.signal.aborted && remainingRunMs(hold) > 0 && Date.now() >= now && Date.now() < operationDeadline && performance.now() < monotonicDeadline, "operation_timeout");
      record.state = "settled"; record.completedAtUTC = new Date().toISOString();
      let permit: "allowed" | "denied" | "expired" | "invalid" | null = null;
      if (operation.startsWith("admission:")) {
        const receipt: Record<string, unknown> = isObject(value) ? value : {};
        // The canonical hook exposes its validation result, not the raw RPC body.
        // Its pinned validator checks version/scope/TTL before valid can be true.
        const valid = receipt.kind === "admission" && receipt.httpStatus === 200 && receipt.valid === true && typeof receipt.allowed === "boolean" && Number.isSafeInteger(receipt.waitMs) && (receipt.waitMs as number) >= 0;
        permit = !valid ? "invalid" : !receipt.allowed ? "denied" : Date.now() - now >= 1000 || performance.now() - monotonicNow >= 1000 ? "expired" : "allowed";
        if (permit === "allowed") permits.set(phase as Group, { wall: now + 1000, monotonic: monotonicNow + 1000 });
      }
      const facts = provider && isObject(value) ? {
        httpStatus: Number.isInteger(value.status) && (value.status as number) >= 100 && (value.status as number) <= 599 ? value.status : null,
        finalUrlMatchesRequested: value.finalUrl === url, redirected: typeof value.redirected === "boolean" ? value.redirected : null,
        decodedBytes: value.bytes instanceof Uint8Array ? value.bytes.byteLength : Number.isSafeInteger(value.decodedBytes) && (value.decodedBytes as number) >= 0 ? value.decodedBytes : null,
      } : null;
      // Every dispatched HTTPS provider/admission operation needs its TLS observation.
      // Lifecycle receipts (enabled mode only) are not covered by this observation.
      // The CA store is re-read after settlement and recorded with the TLS facts.
      const caStore = defaultCAStoreSHA256();
      const observedTls = lifecycle ? null : tlsFacts(isObject(value) ? value.tls : undefined, url, [...tlsObserved.values()]);
      const dispatcherNow = globalDispatcher();
      const dispatcherFacts: DispatcherFacts = { present: dispatcherNow !== undefined, constructorName: dispatcherName(dispatcherNow),
        identityUnchanged: dispatcherNow === DISPATCHER_AT_RUNNER_LOAD };
      const tls = observedTls && { ...observedTls, defaultCACertificatesSHA256: caStore, globalDispatcher: dispatcherFacts };
      writeJson(`operation-${calls.size}-SETTLED.json`, { operation, completedAtUTC: record.completedAtUTC, permit, transport: facts, ...(lifecycle ? {} : { tls }) });
      need(permit === null || permit === "allowed", "permit_not_usable");
      need(lifecycle || tls !== null, "tls_observation_missing");
      need(caStore === runtime.tls.defaultCACertificatesSHA256, "ca_store_changed");
      need(dispatcherFacts.identityUnchanged, "global_dispatcher_changed");
      if (tls) tlsObserved.set(operation, { index: calls.size, tls });
      const captured = { operation, completedAtUTC: record.completedAtUTC, witness: Object.freeze({}), value };
      observed.set(operation, captured);
      return captured;
    } catch {
      stopped = true; if (record.state === "started") record.state = "uncertain";
      // Do not persist thrown text, headers, credentials, RPC bodies or local paths.
      return fail("operation_failed_or_uncertain");
    } finally { if (timer !== undefined) clearTimeout(timer); if (activeAbort === controller) activeAbort = undefined; }
  };

  const retain = (name: "schedule" | Group, captured: Captured<CaptureResponse>) => {
    need(!stopped && remainingRunMs() > 0, "retention_after_stop");
    const operation: CaptureOperation = name === "schedule" ? "schedule" : `nst:${name}`;
    const record = calls.get(operation);
    const observation = observed.get(operation);
    need(observation && observation.witness === captured.witness && captured.operation === operation && record?.state === "settled" && record.completedAtUTC === captured.completedAtUTC, "response_without_observed_dispatch");
    const expectedUrl = name === "schedule" ? scheduleUrl : input.plan.pages.find(page => page.group === name)!.url;
    const response = captured.value;
    const transport = observation!.value;
    need(isObject(transport) && transport.status === response.status && transport.finalUrl === response.finalUrl && transport.redirected === response.redirected, "response_transport_facts_changed");
    need(response.status === 200 && response.finalUrl === expectedUrl && response.redirected === false, "response_transport_invalid");
    const tls = tlsObserved.get(operation)?.tls;
    need(tls, "response_without_tls_observation");
    need(response.bytes instanceof Uint8Array && response.bytes.length > 0 && response.bytes.length <= (name === "schedule" ? MIB : 2 * MIB), "response_byte_limit");
    const bytes = Buffer.from(new Uint8Array(response.bytes));
    let parsedRows: number | null = null, games: number[] | null = null;
    if (name === "schedule") games = completedGames(bytes);
    else {
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes)); } catch { return fail("parser_utf8_invalid"); }
      const $ = load(text);
      parsedRows = $("table tr").filter((_, element) => $(element).children("td").length > 0).length;
      need(parsedRows > 0 && parsedRows <= 5000, "parser_shape_or_row_limit");
    }
    const file = `${name}.${name === "schedule" ? "raw.json" : "parser-input.html"}`;
    need(remainingRunMs() > 0, "retention_after_stop");
    write(file, bytes);
    need(remainingRunMs() > 0, "retention_after_stop");
    writeJson(`${name}.TRANSPORT-OBSERVATION.json`, {
      status: "candidate_requires_adapter_and_source_review", operation, file, sha256: hash(bytes), bytes: bytes.length,
      retrievedAtUTC: captured.completedAtUTC, retainedAtUTC: new Date().toISOString(), httpStatus: response.status,
      finalUrl: response.finalUrl, redirected: response.redirected, TLSVerified: null, tls,
      tlsEvidence: "pending_runtime_review", representation: name === "schedule" ? "original_decoded_body" : "client_redacted_parser_input",
      sourceBindings: bindings, parsedRows, completedGameIds: games,
      originalPublicationUTC: null, modelDefinition: "unknown", independentlyAccepted: false, advancedAdmission: false, score: null,
    });
    syncDirectory();
    need(remainingRunMs() > 0, "retention_after_stop");
  };

  const retained: Group[] = [];
  let workStarted = false;
  let completionLinked = false;
  const stopTimer = setTimeout(() => { stopped = true; activeAbort?.abort(); }, Math.max(0, remainingRunMs()));
  let terminalTimer: ReturnType<typeof setTimeout> | undefined;
  const terminal = new Promise<never>((_, reject) => {
    terminalTimer = setTimeout(() => { stopped = true; activeAbort?.abort(); reject(new Error("capture_deadline")); }, Math.max(0, remainingRunMs(true)));
  });
  try {
    const work = (async () => {
      need(remainingRunMs() > 0, "capture_deadline");
      retain("schedule", await adapter.schedule(dispatch));
      phase = "individual";
      const requestControl = { deadlineAt, maxAttempts: 2 as const, attemptsStarted: 0, minIntervalMs: 22000 as const, plannedRequestCount: 2 as const };
      await adapter.withJob({ deadlineAt, settled: () => retained.length === 2 && !active && !stopped, dispatch }, async () => {
        need(!workStarted, "duplicate_job_work"); workStarted = true;
        try {
          for (const group of GROUPS) {
            phase = group;
            if (lastNstStart !== undefined) {
              const wait = Math.max(0, lastNstStart + 22_000 - performance.now());
              need(wait + 20_000 < remainingRunMs(), "capture_deadline");
              if (wait > 0) await new Promise<void>(resolveWait => setTimeout(resolveWait, wait));
            }
            const url = input.plan.pages.find(page => page.group === group)!.url;
            retain(group, await adapter.nst(group, url, { dispatch, requestControl, retries: 0, allowQueryKeyFallback: false, timeoutMs: 15_000, maxResponseBytes: 2097152, maxAdmissionCalls: 1 }));
            retained.push(group);
          }
          phase = "settled";
        } catch { stopped = true; fail("capture_work_failed"); }
      });
      need(workStarted && retained.length === 2 && !active && !stopped && remainingRunMs() > 0, "capture_not_settled");
      need(input.lifecycleMode === "disabled" || calls.get("finish")?.state === "settled", "lifecycle_not_finished");
    })();
    await Promise.race([work, terminal]);
    const result = { state: "packet_complete_pending_review", retained, operationCount: calls.size, lifecycleMode: input.lifecycleMode,
      independentlyAccepted: false, advancedAdmission: false, score: null };
    // Completion is the final durable step, after lifecycle settlement. Never
    // replace another marker; withdraw ours if final durability/deadline fails.
    const manifest = json({ ...result, files, completedAtUTC: new Date().toISOString() });
    write(".MANIFEST.json.tmp", manifest);
    syncDirectory();
    need(!stopped && remainingRunMs() > 0, "publication_after_deadline");
    linkSync(join(outputDirectory, ".MANIFEST.json.tmp"), join(outputDirectory, "MANIFEST.json"));
    completionLinked = true;
    syncDirectory();
    need(!stopped && remainingRunMs() > 0, "publication_after_deadline");
    unlinkSync(join(outputDirectory, ".MANIFEST.json.tmp"));
    need(!stopped && remainingRunMs() > 0, "publication_after_deadline");
    return result;
  } catch {
    stopped = true;
    let completionMarkerUncertain = false;
    if (completionLinked) {
      try { unlinkSync(join(outputDirectory, "MANIFEST.json")); syncDirectory(); }
      catch { completionMarkerUncertain = true; }
    }
    // A best-effort failure receipt is never a completion marker. Keep successful
    // pages and STARTED call receipts if storage itself is unavailable.
    try { writeJson("FAILED.json", { state: "partial_packet", retained, operations: [...calls].map(([operation, record]) => ({ operation, ...record })), activeTransportUnsettled: active, completionMarkerUncertain, reason: "capture_or_retention_failed", independentlyAccepted: false }); syncDirectory(); } catch { /* Preserve partial files. */ }
    return fail("native_capture_incomplete_see_retained_packet");
  } finally { clearTimeout(stopTimer); if (terminalTimer !== undefined) clearTimeout(terminalTimer); }
}
