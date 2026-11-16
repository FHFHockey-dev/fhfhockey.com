// Official boxscore acquisition tool (ACQUISITION-SPEC.md). Builds evidence for frames.mjs; NOT approved.
// Its sha256 is NOT in frames.mjs APPROVED_ACQUISITION_TOOLS: adding it is a reviewed change after independent review.
// Running it for real is an external read of official NHL endpoints that needs TJ's separate approval.
//
// SELF-CONTAINED (RECHECK-2 F1): this file imports ONLY `node:` builtins, so its sha256 pins everything that runs
// besides Node itself (pinned by execPath hash). Launch with an EMPTY execArgv (no ts-node, no --require/--import):
//   cd /Users/tim/Code/fhfhockey.com/web && env -i PATH=/usr/bin:/bin HOME="$HOME" TMPDIR="$TMPDIR" \
//     /usr/local/bin/node /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15/acquire-boxscores.mjs \
//     --conversion <approved conversion dir>
// The output path is FIXED per source date (F3): /Users/tim/Library/Application Support/fhfh-blsh-boxscores-<YYYYMMDD>.
//
// Budget: exactly one GET per game on the converted packet's verified schedule (6 for 2026-11-11), sequential,
// concurrency 1, 0 retries, redirect "error", 15 s per request, 120 s total, 4 MiB per body, 1 s spacing, hard cap 16.
// No schedule call, no NST, no Supabase, no credentials, no writes outside the fixed output directory.
import { channel } from "node:diagnostics_channel";
import { createHash } from "node:crypto";
import * as tlsModule from "node:tls";
import { closeSync, constants, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, unlinkSync, writeSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TOOL_PATH = fileURLToPath(import.meta.url);
export const BUDGET = Object.freeze({ maxGames: 16, perRequestTimeoutMs: 15_000, totalMs: 120_000, maxBodyBytes: 4 * 1024 * 1024, spacingMs: 1000, retries: 0 });
export const fixedOutputPath = date => `/Users/tim/Library/Application Support/fhfh-blsh-boxscores-${date.replaceAll("-", "")}`;
/** Same values as convert.mjs APPROVED (a test asserts they are equal). The tool acts only for an approved candidate.
 * Successor v5 (pins a2a1e694…, verifier b86af692…); v4 conversions are refused.
 * APPROVED_PINS: the candidate pins files whose conversions this tool serves, as convert.mjs CANDIDATES: v5 (the 11-17
 * slot) and v5-1118 (the 11-18 fallback; same verifier, node and parser). The candidate is chosen explicitly at
 * conversion time and recorded as CONVERSION.json.pinsSHA256; this tool never chooses one. */
export const APPROVED_PINS = Object.freeze([
  "a2a1e694dfa79ba9ebc110a3e45a249540b739c0061e0558fc6887e0f30367d1", // v5
  "3f61f9d4725fb66efc3d0f2f201e74c46998d67856b84f9c9c7230357b866376", // v5-1118
]);
export const APPROVED = Object.freeze({
  pinsSHA256: "a2a1e694dfa79ba9ebc110a3e45a249540b739c0061e0558fc6887e0f30367d1",
  verifierSHA256: "b86af692e5c4b3b9b1650f949171cbbaeed6663c6d1668efdc443e91fa0ad5c5",
  nodeSHA256: "daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef",
  lineageSHA256: "14e0816c65fd8988b1401e21952b0873fcb142da6866523f6c87d8f1b72ff4da",
});
const MIB = 1024 * 1024;

// ---- Helpers copied from lib.mjs (BridgeRefusal, need, sha, readBound, parseJson subset, encode) ----
export class BridgeRefusal extends Error { constructor(code) { super(code); this.code = code; } }
const need = (ok, code) => { if (!ok) throw new BridgeRefusal(code); };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function readBound(path, maximum) {
  const info = lstatSync(path);
  need(info.isFile() && !info.isSymbolicLink(), "input_not_regular_file");
  need(info.size > 0 && info.size <= maximum, "input_byte_bound");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const size = fstatSync(fd).size; need(size === info.size, "input_changed_while_reading");
    const buffer = Buffer.alloc(size); let offset = 0;
    while (offset < size) { const n = readSync(fd, buffer, offset, size - offset, offset); if (!n) break; offset += n; }
    need(offset === size, "input_short_read"); return buffer;
  } finally { closeSync(fd); }
}
const parseJson = (bytes, code = "invalid_json") => { try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new BridgeRefusal(code); } };
const encode = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

// ---- Copied from the v4 capture adapter (nativeProcessCaptureAdapter.ts aa6237bd…, lines 19-75), TypeScript types removed.
// A test runs both implementations on the same channel messages and requires identical results. ----
export const TLS_OBSERVATION_CHANNEL = "undici:client:sendHeaders";
const str = (value) => typeof value === "string" ? value : null;
const connections = new WeakMap();
let connectionCount = 0;
function socketTls(socket) {
  // Duck-typed: importing node:tls here would load TLS for every adapter caller.
  if (!socket || socket.encrypted !== true || typeof socket.getPeerCertificate !== "function"
    || typeof socket.getProtocol !== "function" || typeof socket.getCipher !== "function") return null;
  const sessionReused = typeof socket.isSessionReused === "function" && socket.isSessionReused() === true;
  const leaf = socket.getPeerCertificate(true);
  const hasLeaf = !!leaf && typeof leaf.fingerprint256 === "string";
  // Node 22.23.4 exposes no peer certificate on a resumed session ({}). Only then is
  // it absent; the runner binds the resumption to this run's earlier full handshake.
  if (!hasLeaf && !sessionReused) return null;
  const connectionReused = connections.has(socket);
  if (!connectionReused) connections.set(socket, ++connectionCount);
  const issuerCNChain = [], seen = new Set();
  for (let cert = hasLeaf ? leaf : undefined; cert && !seen.has(cert) && issuerCNChain.length < 10; cert = cert.issuerCertificate) {
    seen.add(cert); issuerCNChain.push(str(cert.issuer?.CN));
  }
  const cipher = socket.getCipher();
  return { channel: TLS_OBSERVATION_CHANNEL, authorized: socket.authorized === true,
    authorizationError: socket.authorizationError == null ? null : String(socket.authorizationError),
    servername: str(socket.servername), alpnProtocol: str(socket.alpnProtocol), protocol: str(socket.getProtocol()),
    cipher: { name: str(cipher?.name), standardName: str(cipher?.standardName), version: str(cipher?.version) },
    sessionReused, connectionReused, connectionSequence: connections.get(socket),
    peerCertificate: hasLeaf ? { fingerprint256: leaf.fingerprint256, valid_from: str(leaf.valid_from), valid_to: str(leaf.valid_to), subjectCN: str(leaf.subject?.CN), issuerCNChain } : null };
}
/** Runs one HTTPS action and attaches the TLS facts of the single request it sent
 * to this origin, path and method. Records in the listener (which never throws);
 * enforces after the action settles. No matching TLS observation fails closed. */
export async function withTlsObservation(url, method, action) {
  const expected = new URL(url), events = [];
  const listener = (message) => {
    try {
      const { request, socket } = message;
      const path = typeof request?.path === "string" ? request.path.split("?")[0] : null;
      const matches = request?.origin != null && new URL(String(request.origin)).origin === expected.origin && path === expected.pathname && request.method === method;
      events.push(matches ? socketTls(socket) : null);
    } catch { events.push(null); }
  };
  const observation = channel(TLS_OBSERVATION_CHANNEL);
  observation.subscribe(listener);
  let result;
  try { result = await action(); } finally { observation.unsubscribe(listener); }
  if (!(events.length === 1 && events[0] !== null)) throw new Error("capture_tls_observation_missing");
  return { ...result, tls: events[0] };
}
// ---- end of the adapter copy ----

const RUNTIME_OVERRIDE_KEYS = ["NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_OPTIONS", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "all_proxy", "no_proxy"];
const LAUNCH_ENV_KEYS = ["NODE_PATH", "DISABLE_V8_COMPILE_CACHE", "TS_NODE_COMPILER_OPTIONS", "OPENSSL_CONF", "TS_NODE_PROJECT", "TS_NODE_SKIP_PROJECT",
  "TS_NODE_COMPILER", "TS_NODE_TRANSPILE_ONLY", "TS_NODE_REQUIRE", "TS_NODE_CWD", "TS_NODE_DIR", "TS_NODE_COMPILER_HOST", "TS_NODE_EMIT", "TS_NODE_SCOPE",
  "TS_NODE_SCOPE_DIR", "TS_NODE_SWC", "TS_NODE_TRANSPILER"];
const GLOBAL_DISPATCHER = Symbol.for("undici.globalDispatcher.1");
const FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const present = key => Object.prototype.hasOwnProperty.call(process.env, key);
const caStoreSHA256 = () => {
  const list = typeof tlsModule.getCACertificates === "function" ? tlsModule.getCACertificates("default") : null;
  return Array.isArray(list) && list.every(x => typeof x === "string") ? sha(Buffer.from(list.join("\n"))) : null;
};
const boxscoreUrl = id => `https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`;

/** Runtime facts recorded BEFORE the first request (presence only; no values). */
function acquisitionRuntime({ startedAtUTC, toolBytes, conversionSHA256, outDir, testTransport }) {
  const roots = tlsModule.rootCertificates, defaults = tlsModule.getCACertificates?.("default");
  const entryScript = typeof process.argv[1] === "string" ? resolve(process.argv[1]) : null;
  let entryScriptSHA256 = null; try { entryScriptSHA256 = entryScript ? sha(readFileSync(entryScript)) : null; } catch { /* recorded as null */ }
  return { version: "fhfh.blsh.official-acquisition-runtime.v2", startedAtUTC, toolSHA256: sha(toolBytes), conversionSHA256, outputDirectory: resolve(outDir),
    node: { version: process.version, execPath: process.execPath, execPathSHA256: sha(readFileSync(process.execPath)), execArgv: [...process.execArgv] },
    tls: { rootCertificatesSHA256: sha(Buffer.from(roots.join("\n"))), rootCertificateCount: roots.length,
      defaultCACertificatesSHA256: caStoreSHA256(), defaultCACertificateCount: Array.isArray(defaults) ? defaults.length : null },
    environmentPresence: Object.fromEntries(RUNTIME_OVERRIDE_KEYS.map(k => [k, present(k)])),
    launch: { entryScript, entryScriptSHA256, cwd: process.cwd(),
      environmentPresence: Object.fromEntries(LAUNCH_ENV_KEYS.map(k => [k, present(k)])),
      otherTsNodeKeysPresent: Object.keys(process.env).filter(k => k.startsWith("TS_NODE_") && !LAUNCH_ENV_KEYS.includes(k)).sort() },
    globalDispatcherAtStart: globalThis[GLOBAL_DISPATCHER] === undefined ? "unset" : "preinstalled",
    // A test transport is a FUNCTION option only. Recording it adds a key, so frames.mjs (exact key set) refuses the output.
    ...(testTransport ? { testTransport: "loopback_dispatcher_TEST_ONLY" } : {}),
    valuesRecorded: false };
}

/** Same binding rules as the v4 runner's tlsFacts, plus a peerCertificate shape check (F3). */
function bindTls(tls, url, earlier) {
  need(tls && tls.channel === "undici:client:sendHeaders" && tls.servername === new URL(url).hostname, "tls_observation_invalid");
  const pc = tls.peerCertificate;
  need(pc === null || (typeof pc === "object" && FINGERPRINT.test(pc.fingerprint256 ?? "") && Array.isArray(pc.issuerCNChain) &&
    pc.issuerCNChain.length >= 1 && pc.issuerCNChain.length <= 10 && ["valid_from", "valid_to", "subjectCN"].every(k => pc[k] === null || typeof pc[k] === "string")), "tls_peer_certificate_shape");
  let resumedFromOperation = null, connectionFromOperation = null;
  if (tls.sessionReused) {
    need(tls.authorized === true, "tls_resumed_unauthorized");
    const full = earlier.find(r => r.tls.servername === tls.servername && !r.tls.sessionReused && !r.tls.connectionReused && r.tls.peerCertificate !== null);
    need(full, "tls_resumed_without_full_handshake"); resumedFromOperation = full.index;
  } else need(pc !== null, "tls_peer_missing");
  const opener = earlier.find(r => r.tls.connectionSequence === tls.connectionSequence);
  if (tls.connectionReused) { need(opener && opener.tls.servername === tls.servername, "tls_connection_unbound"); connectionFromOperation = opener.index; }
  else need(!opener, "tls_connection_sequence_reused");
  const { channel: ch, authorized, authorizationError, servername, alpnProtocol, protocol, cipher, sessionReused, connectionReused, connectionSequence, peerCertificate } = tls;
  return { channel: ch, authorized, authorizationError, servername, alpnProtocol, protocol, cipher, sessionReused, connectionReused, connectionSequence,
    resumedFromOperation, connectionFromOperation, peerCertificate };
}

/** Ids re-derived from the conversion's hash-checked schedule.raw.json (F2), never trusted from CONVERSION.json alone. */
function approvedScheduleIds(conversionDir) {
  const manifest = parseJson(readBound(join(conversionDir, "MANIFEST.json"), 4 * MIB), "conversion_manifest_invalid");
  const listed = new Map(manifest.files.map(f => [f.file, f]));
  need(readdirSync(conversionDir).every(n => n === "MANIFEST.json" || listed.has(n)), "conversion_unlisted_file");
  const file = name => { const b = readBound(join(conversionDir, name), 4 * MIB); need(listed.get(name)?.sha256 === sha(b) && listed.get(name)?.bytes === b.length, "conversion_hash_drift"); return b; };
  const conversionBytes = file("CONVERSION.json"), c = parseJson(conversionBytes);
  need(c.evidenceClass === "candidate_pending_independent_review" && c.approvedInputs === true && APPROVED_PINS.includes(c.pinsSHA256) &&
    c.verifierSHA256 === APPROVED.verifierSHA256 && c.nodeSHA256 === APPROVED.nodeSHA256 && c.lineageSHA256 === APPROVED.lineageSHA256, "conversion_not_approved");
  const scheduleBytes = file("schedule.raw.json");
  need(sha(scheduleBytes) === c.scheduleFacts?.scheduleSHA256, "schedule_hash_drift");
  const days = parseJson(scheduleBytes).gameWeek?.filter(d => d.date === c.date) ?? [];
  need(days.length === 1 && Array.isArray(days[0].games) && days[0].games.length > 0, "schedule_day_invalid");
  need(days[0].games.every(g => ["OFF", "FINAL"].includes(g.gameState)), "schedule_not_final");
  const ids = days[0].games.map(g => g.id).sort((a, b) => a - b);
  need(ids.length <= BUDGET.maxGames && ids.every(id => Number.isSafeInteger(id) && /^202602\d{4}$/.test(String(id))) && new Set(ids).size === ids.length, "schedule_games_invalid");
  need(JSON.stringify(ids) === JSON.stringify(c.scheduleFacts.games.map(g => g.gameId).sort((a, b) => a - b)), "schedule_ids_drift");
  return { ids, date: c.date, conversionSHA256: sha(conversionBytes) };
}

async function boundedGet(url, signal, dispatcher) {
  const response = await fetch(url, { method: "GET", redirect: "error", cache: "no-store", signal, headers: { Accept: "application/json" }, ...(dispatcher ? { dispatcher } : {}) });
  need(response.status === 200 && response.url === url && response.redirected === false && response.body, "boxscore_transport_response_invalid");
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      need(value.byteLength <= BUDGET.maxBodyBytes - size, "boxscore_body_limit"); size += value.byteLength; chunks.push(value.slice());
    }
  } catch (e) { void reader.cancel().catch(() => {}); throw e; }
  return { bytes: Buffer.concat(chunks.map(c => Buffer.from(c))), status: response.status, finalUrl: response.url, redirected: response.redirected };
}

/** Acquire. `outDir`, `dispatcher` and `spacingMs` are FUNCTION options for offline tests only; the CLI pins the output
 * path and never passes a dispatcher. Frames refuse any output whose runtime is not the fixed path / has a test transport. */
export async function acquire({ conversionDir, outDir = null, dispatcher = null, spacingMs = BUDGET.spacingMs }) {
  const t0 = Date.now(), deadline = t0 + BUDGET.totalMs;
  // Environment, before anything is written or sent.
  need(process.execArgv.length === 0, "runtime_exec_argv_not_empty");
  need(RUNTIME_OVERRIDE_KEYS.every(k => !present(k)), "runtime_override_env_present");
  need(LAUNCH_ENV_KEYS.every(k => !present(k)) && !Object.keys(process.env).some(k => k.startsWith("TS_NODE_")), "runtime_launch_override_present");
  need(globalThis[GLOBAL_DISPATCHER] === undefined, "global_dispatcher_preinstalled");
  const snapshot = caStoreSHA256();
  need(snapshot && snapshot === sha(Buffer.from(tlsModule.rootCertificates.join("\n"))), "runtime_default_ca_store_not_bundled");
  const { ids, date, conversionSHA256 } = approvedScheduleIds(conversionDir);
  const out = outDir ?? fixedOutputPath(date);
  const toolBytes = readFileSync(TOOL_PATH);

  mkdirSync(out, { mode: 0o700 }); // existing path refused (EEXIST) before any request
  const files = [];
  const write = (name, bytes) => {
    const fd = openSync(join(out, name), "wx", 0o600);
    try { let o = 0; while (o < bytes.length) o += writeSync(fd, bytes, o); fsyncSync(fd); } finally { closeSync(fd); }
    files.push({ file: name, bytes: bytes.length, sha256: sha(bytes) });
  };
  const syncDir = () => { const fd = openSync(out, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } };
  const startedAtUTC = new Date(t0).toISOString();
  const runtime = acquisitionRuntime({ startedAtUTC, toolBytes, conversionSHA256, outDir: out, testTransport: !!dispatcher });
  need(runtime.tls.defaultCACertificatesSHA256 === snapshot && runtime.globalDispatcherAtStart === "unset", "runtime_snapshot_changed");
  write("ACQUISITION-RUNTIME.json", encode(runtime));
  write("source-tool.mjs", toolBytes);
  syncDir();
  // Dispatcher identity (F1 defence in depth): unset before the first request; afterwards whatever the first bundled
  // fetch created, and the SAME object at every later check. With a test dispatcher option the global must stay unset.
  let firstDispatcher;
  const checkDispatcher = (before, operation) => {
    const d = globalThis[GLOBAL_DISPATCHER];
    if (dispatcher || (before && operation === 1)) need(d === undefined, "global_dispatcher_changed");
    else if (firstDispatcher === undefined) { need(d !== undefined, "global_dispatcher_changed"); firstDispatcher = d; }
    else need(d === firstDispatcher, "global_dispatcher_changed");
  };
  const earlier = [];
  let completed = 0, sendHeadersEvents = null;
  try {
    for (const [k, id] of ids.entries()) {
      const operation = k + 1, url = boxscoreUrl(id);
      if (k > 0 && spacingMs > 0) await new Promise(r => setTimeout(r, spacingMs));
      need(Date.now() + BUDGET.perRequestTimeoutMs <= deadline, "acquisition_deadline");
      need(caStoreSHA256() === snapshot, "ca_store_changed_before_dispatch"); // nothing sent if the store moved
      // Journal BEFORE dispatch: an interrupted request stays visible as STARTED without a receipt.
      write(`operation-${operation}-STARTED.json`, encode({ operation, url, method: "GET", startedAtUTC: new Date().toISOString() })); syncDir();
      // Count every sendHeaders for this game's path (wire-level duplicate cap; any count other than 1 fails closed).
      const path = new URL(url).pathname; sendHeadersEvents = 0;
      const counter = m => { try { if (typeof m?.request?.path === "string" && m.request.path.split("?")[0] === path) sendHeadersEvents++; } catch { sendHeadersEvents = -1; } };
      const sendHeaders = channel(TLS_OBSERVATION_CHANNEL); sendHeaders.subscribe(counter);
      let result;
      try {
        result = await withTlsObservation(url, "GET", () => { checkDispatcher(true, operation); return boundedGet(url, AbortSignal.timeout(BUDGET.perRequestTimeoutMs), dispatcher); });
      } finally { sendHeaders.unsubscribe(counter); }
      need(sendHeadersEvents === 1, "send_headers_count_not_one");
      checkDispatcher(false, operation);
      const after = caStoreSHA256();
      need(after === snapshot, "ca_store_changed");
      const tls = { ...bindTls(result.tls, url, earlier), defaultCACertificatesSHA256: after };
      earlier.push({ index: operation, tls });
      const retrievedAtUTC = new Date().toISOString();
      write(`boxscore-${id}.body.json`, result.bytes);
      write(`boxscore-${id}.receipt.json`, encode({ version: "fhfh.blsh.official-boxscore-receipt.v3", operation, url, finalUrl: result.finalUrl,
        httpStatus: result.status, redirected: result.redirected, retrievedAtUTC, sha256: sha(result.bytes), bytes: result.bytes.length, tls,
        sendHeadersEvents, globalDispatcher: "unchanged", acquisitionStartedAtUTC: startedAtUTC }));
      syncDir(); completed = operation;
    }
  } catch (e) {
    // Never persist thrown text (it may hold paths). Whitelisted code only; no completion manifest.
    const code = e instanceof BridgeRefusal ? e.code : "request_failed_or_uncertain";
    try { write("FAILED.json", encode({ state: "partial_acquisition_not_evidence", completedOperations: completed, plannedOperations: ids.length, reason: code,
      sendHeadersEventsAtFailure: sendHeadersEvents })); syncDir(); } catch { /* keep partial files */ }
    throw new BridgeRefusal(`acquisition_failed:${code}`);
  }
  const manifestBytes = encode({ status: "acquisition_complete_pending_review", requests: ids.length, retries: 0, files: [...files], completedAtUTC: new Date().toISOString() });
  write(".MANIFEST.json.tmp", manifestBytes); files.pop();
  linkSync(join(out, ".MANIFEST.json.tmp"), join(out, "MANIFEST.json")); unlinkSync(join(out, ".MANIFEST.json.tmp")); syncDir();
  return { requests: ids.length, gameIds: ids, outDir: out, runtime };
}

if (process.argv[1] && resolve(process.argv[1]) === TOOL_PATH) {
  const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  // F3: there is no --out. The output path is fixed per source date; any --out argument is refused.
  (process.argv.includes("--out") ? Promise.reject(new BridgeRefusal("output_path_is_fixed")) : acquire({ conversionDir: arg("conversion") })).then(r => {
    process.stdout.write(`${JSON.stringify({ ok: true, requests: r.requests, outDir: r.outDir })}\n`);
  }, e => {
    process.stdout.write(`${JSON.stringify({ ok: false, refusal: e instanceof BridgeRefusal ? e.code : e?.code === "EEXIST" ? "output_exists" : "acquisition_error" })}\n`); process.exitCode = 2;
  });
}
