/** BLSH native capture v6 core: the reviewed v5 runner (web/scripts/blsh/nativeProcessCaptureRunner.ts
 * @ 348a122d6) edited in place. `diff` against v5 shows exactly the deviations listed in
 * tasks/artifacts/blsh-cron-v6-2026-11-15/CORE-DEVIATIONS.md; unchanged code keeps v5's text.
 * An adapter must route EVERY HTTP attempt through dispatch, retain the existing
 * shared/local NST controls, and consume bodies inside that dispatch.
 */
import { createHash } from "node:crypto";
import { load } from "cheerio";
import { prepareNativeProcessCapture, type NativeProcessCapturePlan } from "../../../scripts/blsh/nativeProcessCapturePreparation";
import { buildRuntimeReceiptV6, defaultCAStoreSHA256, type RuntimeReceiptV6 } from "./runtimeReceipt";
import type { PacketFile, PacketSink } from "./sink";
import type { RunState } from "./writer";

const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
export const PINNED_SUPABASE_ORIGIN = ORIGIN;
const MIB = 1024 * 1024;
const GROUPS = ["individual", "onIce"] as const;
export type Group = typeof GROUPS[number];
export type CaptureOperation = "schedule" | `admission:${Group}` | `nst:${Group}`;
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
/** v6: pre-claim runtime gate (no I/O). A refusal here never burns the date. */
export function runtimePrecheckV6(): string | null {
  if (!defaultCAStoreSHA256()) return "runtime_ca_store_unavailable";
  const now = globalDispatcher();
  if (DISPATCHER_AT_RUNNER_LOAD === undefined || now !== DISPATCHER_AT_RUNNER_LOAD || dispatcherName(now) !== "Agent") return "global_dispatcher_not_runner_load_default";
  return null;
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
export type CaptureDispatch = <T>(operation: CaptureOperation, action: (spec: CaptureDispatchSpec) => Promise<T>) => Promise<Captured<T>>;
export interface CaptureResponse {
  status: number;
  finalUrl: string;
  redirected: boolean;
  // Schedule: original decoded body. NST: exact UTF-8 parser input returned by
  // the authenticated redacting client. Never re-redact or normalize in this core.
  bytes: CaptureBytes;
}
export interface NativeCaptureAdapterV6 {
  supabaseOrigin: string;
  sourceDate: string;
  schedule(dispatch: CaptureDispatch): Promise<Captured<CaptureResponse>>;
  nst(group: Group, url: string, options: {
    dispatch: CaptureDispatch; requestControl: {
      deadlineAt: number; maxAttempts: 2; attemptsStarted: number; minIntervalMs: 22000; plannedRequestCount: 2;
    };
    retries: 0; allowQueryKeyFallback: false; timeoutMs: 15000; maxResponseBytes: 2097152;
    // Enforced by the canonical client's optional admission-call control.
    maxAdmissionCalls: 1;
  }): Promise<Captured<CaptureResponse>>;
}
export interface NativeCaptureRunInputV6 {
  plan: NativeProcessCapturePlan;
  sourceDate: string;
  supabaseOrigin: string;
  runId: string;
  routeBundlePath: string | null;
  invocationOrdinal: number;
}
export type CaptureResultV6 = { state: "packet_complete_pending_review" | "no_slate"; retained: Group[]; operationCount: number; lifecycleMode: "disabled";
  independentlyAccepted: false; advancedAdmission: false; score: null };
export class CaptureRunError extends Error {
  constructor(readonly state: Exclude<RunState, "packet_complete_pending_review" | "no_slate">, readonly reason: string, readonly closed: boolean) { super(`native_capture_${state}`); }
}
/** v6: refusal codes that end a run as refused_schedule rather than failed. */
const SCHEDULE_REFUSALS = new Set(["schedule_day_ambiguous", "schedule_game_incomplete_or_wrong_scope"]);
/** v6 (L2): the pre-schedule checkpoint's own budget; the schedule GET's 15 s timer is armed after it. */
const PRE_SCHEDULE_CHECKPOINT_MS = 20_000;
const CODE = /^[a-z][a-z0-9_:]{2,100}$/;

/** v6: the source date is a parameter. D's day entry must be present: an empty `games`
 * list is an off-day ([] -> no_slate); a body without D is schedule_shape_invalid (L1). */
function completedGames(bytes: CaptureBytes, date: string) {
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
  const days = (data as { gameWeek: unknown[] }).gameWeek.filter(day => isObject(day) && day.date === date);
  need(days.length > 0, "schedule_shape_invalid");
  need(days.length === 1, "schedule_day_ambiguous");
  need(isObject(days[0]) && Array.isArray(days[0].games), "schedule_shape_invalid");
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

export async function runNativeCaptureV6(input: NativeCaptureRunInputV6, adapter: NativeCaptureAdapterV6, sink: PacketSink): Promise<CaptureResultV6> {
  const start = Date.now(), monotonicStart = performance.now(), deadlineAt = start + 120_000;
  const remainingRunMs = () => Math.min(deadlineAt - Date.now(), monotonicStart + 120_000 - performance.now());
  // v6: the first refusal code becomes the run row's reason. Call sites keep v5's need(...).
  let firstFailure: string | undefined;
  const need = (value: unknown, code: string): void => { if (!value) { firstFailure ??= code; fail(code); } };
  const DATE = input.sourceDate;
  let runtime!: RuntimeReceiptV6;
  let deploymentBinding: { deploymentId: string | null; gitCommitSha: string | null; routeBundleSHA256: string | null } | undefined;
  const scheduleUrl = `https://api-web.nhle.com/v1/schedule/${DATE}`;
  const files: PacketFile[] = [];
  let retainedBytes = 0;
  const write = (file: string, bytes: CaptureBytes) => {
    need(retainedBytes + bytes.byteLength <= 8 * MIB, "packet_byte_limit");
    // Count before writing; a partial failed write cannot buy another attempt.
    retainedBytes += bytes.byteLength;
    files.push(sink.write(file, Buffer.from(new Uint8Array(bytes))));
  };
  const writeJson = (file: string, value: unknown) => write(file, json(value));

  let active = false, stopped = false, phase: "schedule" | Group | "settled" = "schedule";
  let activeAbort: AbortController | undefined;
  let lastNstStart: number | undefined;
  const calls = new Map<CaptureOperation, { startedAt: number; state: "started" | "settled" | "uncertain"; completedAtUTC?: string }>();
  const observed = new Map<CaptureOperation, Captured<unknown>>();
  const permits = new Map<Group, { wall: number; monotonic: number }>();
  const tlsObserved = new Map<CaptureOperation, TlsRecord>();
  const dispatch: CaptureDispatch = async (operation, action) => {
    const guard = (value: unknown, code: string) => { if (!value) { stopped = true; firstFailure ??= code; fail(code); } };
    const now = Date.now(), monotonicNow = performance.now();
    guard(!active, "concurrent_operation_blocked");
    guard(!stopped, "operation_after_failure");
    guard(!calls.has(operation) && calls.size < 5, "operation_budget_exhausted");
    guard(now >= start && remainingRunMs() > 0, "capture_deadline");
    guard(defaultCAStoreSHA256() === runtime.tls.defaultCACertificatesSHA256, "ca_store_changed_before_dispatch");
    guard(globalDispatcher() === DISPATCHER_AT_RUNNER_LOAD, "global_dispatcher_changed_before_dispatch");
    if (operation === "schedule") guard(phase === "schedule" && calls.size === 0, "schedule_order_invalid");
    else {
      guard(phase === "individual" || phase === "onIce", "provider_order_invalid");
      guard(operation === `admission:${phase}` || operation === `nst:${phase}`, "provider_group_invalid");
      if (operation.startsWith("nst:")) {
        const permit = permits.get(phase as Group);
        guard(calls.get(`admission:${phase as Group}`)?.state === "settled" && now < (permit?.wall ?? 0) && monotonicNow < (permit?.monotonic ?? 0), "provider_without_current_permit");
        guard(lastNstStart === undefined || monotonicNow - lastNstStart >= 22_000, "provider_spacing_invalid");
      }
    }
    const provider = operation === "schedule" || operation.startsWith("nst:");
    const rpc = "nst_admit_attempt_v1";
    const url = operation === "schedule" ? scheduleUrl : operation.startsWith("nst:") ? input.plan.pages.find(page => operation === `nst:${page.group}`)!.url : `${ORIGIN}/rest/v1/rpc/${rpc}`;
    const record = { startedAt: now, state: "started" as "started" | "settled" | "uncertain", completedAtUTC: undefined as string | undefined };
    // Persist the attempted call before transmission. Interruption means unknown,
    // never a made-up success or permission to repeat the operation.
    try {
      writeJson(`operation-${calls.size + 1}-STARTED.json`, { operation, url, method: provider ? "GET" : "POST", startedAtUTC: new Date(now).toISOString() });
      calls.set(operation, record);
    } catch { stopped = true; record.state = "uncertain"; firstFailure ??= "operation_journal_failed"; return fail("operation_journal_failed"); }
    // v6 (L2): only the schedule GET is preceded by a remote checkpoint (its STARTED journal is in
    // Storage before transmission). It has its own budget and runs before the operation timer is
    // armed. Admission and NST sit inside the 1000 ms permit window: local journaling only.
    let armedAt = now, armedMonotonic = monotonicNow;
    if (operation === "schedule") {
      let budgetTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([sink.checkpoint(), new Promise<never>((_, reject) => { budgetTimer = setTimeout(() => reject(new Error("budget")), Math.max(0, Math.min(PRE_SCHEDULE_CHECKPOINT_MS, remainingRunMs()))); })]);
      } catch { stopped = true; firstFailure ??= "pre_schedule_checkpoint_failed_nothing_sent"; return fail("pre_schedule_checkpoint_failed"); }
      finally { clearTimeout(budgetTimer); }
      guard(remainingRunMs() > 0, "capture_deadline");
      armedAt = Date.now(); armedMonotonic = performance.now();
    }
    const timeoutMs = Math.min(provider ? 15_000 : 5000, remainingRunMs());
    const operationDeadline = armedAt + timeoutMs;
    const monotonicDeadline = armedMonotonic + timeoutMs;
    active = true;
    const controller = new AbortController();
    activeAbort = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("operation_timeout")); }, Math.max(0, Math.min(operationDeadline - Date.now(), monotonicDeadline - performance.now()))); });
    const pending = Promise.resolve().then(() => {
      // Durable writes can consume a permit or deadline while timers cannot run.
      // Recheck at the actual action boundary; never extend the original budget.
      const dispatchedAt = Date.now(), dispatchedMonotonic = performance.now();
      guard(!controller.signal.aborted && !stopped && remainingRunMs() > 0 && dispatchedAt >= now && dispatchedAt < operationDeadline && dispatchedMonotonic < monotonicDeadline, "dispatch_after_stop_or_deadline");
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
      need(!controller.signal.aborted && remainingRunMs() > 0 && Date.now() >= now && Date.now() < operationDeadline && performance.now() < monotonicDeadline, "operation_timeout");
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
      // The CA store is re-read after settlement and recorded with the TLS facts.
      const caStore = defaultCAStoreSHA256();
      const observedTls = tlsFacts(isObject(value) ? value.tls : undefined, url, [...tlsObserved.values()]);
      const dispatcherNow = globalDispatcher();
      const dispatcherFacts: DispatcherFacts = { present: dispatcherNow !== undefined, constructorName: dispatcherName(dispatcherNow),
        identityUnchanged: dispatcherNow === DISPATCHER_AT_RUNNER_LOAD };
      const tls = observedTls && { ...observedTls, defaultCACertificatesSHA256: caStore, globalDispatcher: dispatcherFacts };
      writeJson(`operation-${calls.size}-SETTLED.json`, { operation, completedAtUTC: record.completedAtUTC, permit, transport: facts, tls });
      need(permit === null || permit === "allowed", "permit_not_usable");
      need(tls !== null, "tls_observation_missing");
      need(caStore === runtime.tls.defaultCACertificatesSHA256, "ca_store_changed");
      need(dispatcherFacts.identityUnchanged, "global_dispatcher_changed");
      if (tls) tlsObserved.set(operation, { index: calls.size, tls });
      const captured = { operation, completedAtUTC: record.completedAtUTC, witness: Object.freeze({}), value };
      observed.set(operation, captured);
      return captured;
    } catch {
      stopped = true; if (record.state === "started") record.state = "uncertain";
      firstFailure ??= `operation_failed_or_uncertain:${operation}`;
      // Do not persist thrown text, headers, credentials, RPC bodies or local paths.
      return fail("operation_failed_or_uncertain");
    } finally { if (timer !== undefined) clearTimeout(timer); if (activeAbort === controller) activeAbort = undefined; }
  };

  let scheduleGames: number[] | undefined;
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
    const file = `${name}.${name === "schedule" ? "raw.json" : "parser-input.html"}`;
    if (name === "schedule") {
      // v6: retain the schedule body before judging finality, so a refused slate is diagnosable.
      write(file, bytes);
      try { games = completedGames(bytes, DATE); } catch (error) { firstFailure ??= (error as Error).message; throw error; }
      scheduleGames = games;
    } else {
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes)); } catch { return need(false, "parser_utf8_invalid"); }
      const $ = load(text);
      parsedRows = $("table tr").filter((_, element) => $(element).children("td").length > 0).length;
      need(parsedRows > 0 && parsedRows <= 5000, "parser_shape_or_row_limit");
      need(remainingRunMs() > 0, "retention_after_stop");
      write(file, bytes);
    }
    need(remainingRunMs() > 0, "retention_after_stop");
    writeJson(`${name}.TRANSPORT-OBSERVATION.json`, {
      status: "candidate_requires_adapter_and_source_review", operation, file, sha256: hash(bytes), bytes: bytes.length,
      retrievedAtUTC: captured.completedAtUTC, retainedAtUTC: new Date().toISOString(), httpStatus: response.status,
      finalUrl: response.finalUrl, redirected: response.redirected, TLSVerified: null, tls,
      tlsEvidence: "pending_runtime_review", representation: name === "schedule" ? "original_decoded_body" : "client_redacted_parser_input",
      deploymentBinding, parsedRows, completedGameIds: games,
      originalPublicationUTC: null, modelDefinition: "unknown", independentlyAccepted: false, advancedAdmission: false, score: null,
    });
    need(remainingRunMs() > 0, "retention_after_stop");
  };

  const retained: Group[] = [];
  let state: CaptureResultV6["state"] = "packet_complete_pending_review";
  const stopTimer = setTimeout(() => { stopped = true; activeAbort?.abort(); }, Math.max(0, remainingRunMs()));
  let terminalTimer: ReturnType<typeof setTimeout> | undefined;
  const terminal = new Promise<never>((_, reject) => {
    terminalTimer = setTimeout(() => { stopped = true; activeAbort?.abort(); firstFailure ??= "capture_deadline"; reject(new Error("capture_deadline")); }, Math.max(0, remainingRunMs()));
  });
  try {
    // v6 (L3): start-of-run refusals sit inside the try, so they close the run as failed with their code.
    // Rebuild the plan; never accept caller-modified URLs/budgets or a substituted date.
    need(JSON.stringify(input.plan) === JSON.stringify(prepareNativeProcessCapture(input.plan.input)), "plan_modified");
    need(input.plan.input.date === DATE && sink.sourceDate === DATE && sink.runId === input.runId, "plan_date_or_run_mismatch");
    need(input.supabaseOrigin === ORIGIN && adapter.supabaseOrigin === ORIGIN, "wrong_project");
    need(adapter.sourceDate === DATE, "adapter_date_mismatch");
    const dispatcherAtStart = globalDispatcher();
    need(DISPATCHER_AT_RUNNER_LOAD !== undefined && dispatcherAtStart === DISPATCHER_AT_RUNNER_LOAD && dispatcherName(dispatcherAtStart) === "Agent",
      "global_dispatcher_not_runner_load_default");
    runtime = buildRuntimeReceiptV6({ startedAtUTC: new Date(start).toISOString(), supabaseOrigin: ORIGIN, routeBundlePath: input.routeBundlePath,
      instance: { invocationOrdinal: input.invocationOrdinal }, dispatcher: { present: true, constructorName: dispatcherName(dispatcherAtStart), sameAsRunnerLoad: true } });
    deploymentBinding = { deploymentId: runtime.deployment.deploymentId, gitCommitSha: runtime.deployment.gitCommitSha, routeBundleSHA256: runtime.deployment.routeBundleSHA256 };
    need(remainingRunMs() > 0, "capture_deadline");
    writeJson("STARTED.json", { version: "fhfh.blsh.native-capture-run.v6", startedAtUTC: new Date(start).toISOString(), supabaseOrigin: ORIGIN,
      lifecycleMode: "disabled", sourceDate: DATE, runId: input.runId, deploymentBinding });
    writeJson("PLAN.json", input.plan);
    writeJson("RUNTIME.json", runtime);
    const work = (async () => {
      need(remainingRunMs() > 0, "capture_deadline");
      retain("schedule", await adapter.schedule(dispatch));
      await sink.checkpoint();
      if (scheduleGames!.length === 0) { state = "no_slate"; phase = "settled"; return; }
      phase = "individual";
      const requestControl = { deadlineAt, maxAttempts: 2 as const, attemptsStarted: 0, minIntervalMs: 22000 as const, plannedRequestCount: 2 as const };
      try {
        for (const group of GROUPS) {
          phase = group;
          if (lastNstStart !== undefined) {
            const wait = Math.max(0, lastNstStart + 22_000 - performance.now());
            need(wait + 20_000 < remainingRunMs(), "capture_deadline");
            if (wait > 0) await new Promise<void>(resolveWait => setTimeout(resolveWait, wait));
          }
          // v6: outside the permit window, one intent row (the pair may be consumed from here on), then a checkpoint.
          need(!stopped && !active, "intent_after_stop");
          try { await sink.intent(group, [`admission:${group}`, `nst:${group}`]); await sink.checkpoint(); } catch { need(false, "intent_or_checkpoint_failed"); }
          const url = input.plan.pages.find(page => page.group === group)!.url;
          retain(group, await adapter.nst(group, url, { dispatch, requestControl, retries: 0, allowQueryKeyFallback: false, timeoutMs: 15_000, maxResponseBytes: 2097152, maxAdmissionCalls: 1 }));
          retained.push(group);
          await sink.checkpoint();
        }
        phase = "settled";
      } catch { stopped = true; fail("capture_work_failed"); }
      need(retained.length === 2 && !active && !stopped && remainingRunMs() > 0, "capture_not_settled");
    })();
    await Promise.race([work, terminal]);
    const result: CaptureResultV6 = { state, retained, operationCount: calls.size, lifecycleMode: "disabled",
      independentlyAccepted: false, advancedAdmission: false, score: null };
    // Completion is the final durable step: MANIFEST.json uploaded last, then the run row
    // closed. A manifest without the closed row is NOT complete (all three are required).
    const manifest = json({ ...result, sourceDate: DATE, runId: input.runId, files, completedAtUTC: new Date().toISOString() });
    need(!stopped && remainingRunMs() > 0, "publication_after_deadline");
    await sink.publishManifest(manifest);
    need(!stopped && remainingRunMs() > 0, "publication_after_deadline");
    await sink.close(state, null, hash(manifest));
    return result;
  } catch (error) {
    stopped = true;
    if (firstFailure === undefined && error instanceof Error && CODE.test(error.message)) firstFailure = error.message;
    const reason = CODE.test(firstFailure ?? "") ? firstFailure! : "capture_or_retention_failed";
    const runState: CaptureRunError["state"] = SCHEDULE_REFUSALS.has(reason) ? "refused_schedule" : "failed";
    // A best-effort failure receipt is never a completion marker. Keep successful
    // pages and STARTED call receipts. If the close fails, the watchdog reconciles the row.
    let closed = false;
    try {
      writeJson("FAILED.json", { state: "partial_packet", runState, reason, retained, operations: [...calls].map(([operation, record]) => ({ operation, ...record })),
        activeTransportUnsettled: active, independentlyAccepted: false });
    } catch { /* Preserve partial files. */ }
    try { await sink.checkpoint(); } catch { /* Partial objects remain; no manifest. */ }
    try { await sink.close(runState, reason, null); closed = true; } catch { /* Watchdog reconciles. */ }
    throw new CaptureRunError(runState, reason, closed);
  } finally { clearTimeout(stopTimer); if (terminalTimer !== undefined) clearTimeout(terminalTimer); }
}
