// Packet -> NativeReceipts + definition + producer allowlist + bound copies.
// Offline only. Refuses on any readback veto, missing/unauthorized TLS, scope drift or stale capture.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { BridgeRefusal, GATE_REPRESENTATION, GROUPS, MIB, SEASON, TOI_CONTRACT, canonicalNstUrl, createOutput, encode, isDay, isHash, need, parseJson, readBound, sha, stamp } from "./lib.mjs";

const DAY_MS = 86_400_000;
const PLAN_LIFETIME_MS = 15 * 60_000;

/** The ONE label mapping. The runner's NST bytes are `Buffer.from(redactNstMessage(text))` from
 * client.ts fetchNstTextByUrl (adapter :124-137), retained unmodified (runner :280-296). That is exactly
 * the gate's "parser input after redaction". The schedule's "original_decoded_body" is not NST parser
 * input and never becomes a NativeReceipt. Anything else is refused, never renamed. */
export const REPRESENTATION_MAP = Object.freeze({ client_redacted_parser_input: GATE_REPRESENTATION });

const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
/** Reviewed inputs. The `candidate_pending_independent_review` class is reachable ONLY with exactly these bytes
 * (review Q3): an operator-written pins file, another verifier, node binary or parser yields a refusal.
 * Changing any value is a reviewed code change, never a CLI argument. */
export const APPROVED = Object.freeze({
  // Successor v5 (SUCCESSOR.patch e8be50de…; vendored in approved/v5/). v4 (pins f2f639ea…, verifier 04a632ba…) and
  // v3 are superseded and refused.
  pinsSHA256: "a2a1e694dfa79ba9ebc110a3e45a249540b739c0061e0558fc6887e0f30367d1",     // successor rehearsal/expected-pins.json (v5)
  verifierSHA256: "b86af692e5c4b3b9b1650f949171cbbaeed6663c6d1668efdc443e91fa0ad5c5", // successor rehearsal/verify-packet.mjs (v5)
  bootstrapSHA256: "dbf69c474bedefd9c34fbd783d4beccc1840e8288fd2fa3435b5d89e8521bb46",  // v5 bootstrap (== pins._bootstrapSHA256)
  nodeSHA256: "daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef",     // bootstrap NODE_SHA256 (SUCCESSOR.patch:310)
  lineageSHA256: "14e0816c65fd8988b1401e21952b0873fcb142da6866523f6c87d8f1b72ff4da",  // pinned nst_lineage.py
});
/** Candidate sets, chosen EXPLICITLY by the caller (`candidate` option / `--candidate` CLI argument); never inferred from a
 * packet. `v5` is APPROVED above (the 2026-11-17 slot). `v5-1118` is the PARKED 2026-11-18 fallback (FALLBACK.patch
 * 209b34eb…, vendored in approved/v5-1118/): only the pins file and bootstrap differ. Not approved until TJ approves it. */
export const CANDIDATES = Object.freeze({
  v5: APPROVED,
  "v5-1118": Object.freeze({ ...APPROVED,
    pinsSHA256: "3f61f9d4725fb66efc3d0f2f201e74c46998d67856b84f9c9c7230357b866376",     // fallback-1118/rehearsal/expected-pins.json
    bootstrapSHA256: "849009ee3b68527858f93512c050ef5d0c01c20ef740c9e62addec4df21b4465" }), // fallback bootstrap (slot 11-18T14:05Z)
});
export function approvedFor(candidate) { need(typeof candidate === "string" && Object.hasOwn(CANDIDATES, candidate), "candidate_unknown"); return CANDIDATES[candidate]; }
const ALLOWED_EXEC_ARGV = [[], ["--require", "./node_modules/ts-node/register/transpile-only"]];
/** Exact key set of RUNTIME.json.environmentPresence (successor HANDOFF §3). Every one must be false. */
export const RUNTIME_ENV = Object.freeze(["NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_OPTIONS", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "all_proxy", "no_proxy"]);
const ADAPTER_ENV = ["NST_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NST_JOB_LIFECYCLE_ENABLED"];
const HEX64 = /^[0-9a-f]{64}$/;
const FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const sameKeys = (o, keys) => !!o && typeof o === "object" && !Array.isArray(o) && JSON.stringify(Object.keys(o).sort()) === JSON.stringify([...keys].sort());
/** Exact key sets (review "Interface"): extra keys, including any synthetic marker, are refused. */
const RUNTIME_KEYS = ["version", "startedAtUTC", "node", "tls", "environmentPresence", "supabaseOrigin", "lifecycleMode", "adapterEnvironmentPresence", "launch",
  "globalDispatcher", "valuesRecorded"];
/** v5 (successor HANDOFF "v5" + "Corrections"): the live transport is npm undici (loaded by cheerio at runner load), whose
 * default Agent the runner anchors at load. RUNTIME records it exactly as below; every operation records it unchanged. */
export const RUNTIME_DISPATCHER = Object.freeze({ present: true, constructorName: "Agent", sameAsRunnerLoad: true });
const LAUNCH_KEYS = ["entryScript", "entryScriptSHA256", "cwd", "bootstrapPath", "bootstrapSHA256", "entryIsBootstrap", "environmentPresence", "otherTsNodeKeysPresent"];
const LAUNCH_ENV = ["NODE_PATH", "DISABLE_V8_COMPILE_CACHE", "TS_NODE_COMPILER_OPTIONS", "OPENSSL_CONF", "TS_NODE_PROJECT", "TS_NODE_SKIP_PROJECT", "TS_NODE_COMPILER",
  "TS_NODE_TRANSPILE_ONLY", "TS_NODE_REQUIRE", "TS_NODE_CWD", "TS_NODE_DIR", "TS_NODE_COMPILER_HOST", "TS_NODE_EMIT", "TS_NODE_SCOPE", "TS_NODE_SCOPE_DIR",
  "TS_NODE_SWC", "TS_NODE_TRANSPILER"];
const LAUNCH_REQUIRED = ["NODE_PATH", "DISABLE_V8_COMPILE_CACHE", "TS_NODE_COMPILER_OPTIONS"]; // the bootstrap's own launcher keys
export const WEB_ROOT = "/Users/tim/Code/fhfhockey.com/web";
const TLS_KEYS = ["channel", "authorized", "authorizationError", "servername", "alpnProtocol", "protocol", "cipher", "sessionReused", "connectionReused",
  "connectionSequence", "resumedFromOperation", "connectionFromOperation", "peerCertificate", "defaultCACertificatesSHA256"];
const PACKET_TLS_KEYS = [...TLS_KEYS, "globalDispatcher"]; // v5 packets; acquisition receipts keep the 14-key set
const NODE_KEYS = ["version", "execPath", "execPathSHA256", "execArgv"];
const CA_KEYS = ["rootCertificatesSHA256", "rootCertificateCount", "defaultCACertificatesSHA256", "defaultCACertificateCount"];

/** Shared node/CA/environment checks (packet RUNTIME.json and the official-acquisition runtime). */
export function checkRuntimeCore(rt, nodeSHA256) {
  need(sameKeys(rt.node, NODE_KEYS) && typeof rt.node.version === "string" && /^v\d+\.\d+\.\d+$/.test(rt.node.version) && typeof rt.node.execPath === "string", "runtime_node_shape");
  need(HEX64.test(nodeSHA256 ?? "") && rt.node.execPathSHA256 === nodeSHA256, "runtime_node_binary_not_pinned");
  need(Array.isArray(rt.node.execArgv) && ALLOWED_EXEC_ARGV.some(x => JSON.stringify(x) === JSON.stringify(rt.node.execArgv)), "runtime_override_exec_argv");
  need(sameKeys(rt.environmentPresence, RUNTIME_ENV) && Object.values(rt.environmentPresence).every(v => typeof v === "boolean"), "runtime_environment_presence_shape");
  need(RUNTIME_ENV.every(k => rt.environmentPresence[k] === false), "runtime_override_env_present");
  const t = rt.tls;
  need(sameKeys(t, CA_KEYS) && HEX64.test(t.rootCertificatesSHA256 ?? "") && Number.isSafeInteger(t.rootCertificateCount) && t.rootCertificateCount > 0, "runtime_ca_store_shape");
  need(t.defaultCACertificatesSHA256 === t.rootCertificatesSHA256 && t.defaultCACertificateCount === t.rootCertificateCount, "runtime_default_ca_store_not_bundled");
  need(rt.valuesRecorded === false, "runtime_receipt_incoherent");
  return true;
}

/** Packet-bound runtime receipt: RUNTIME.json written IN-PROCESS by the successor runner before the first dispatch
 * (successor HANDOFF §3, `fhfh.blsh.native-capture-runtime.v1`). "Default CA, no overrides" means ALL of:
 *   - every environmentPresence key (exact set) is false (no extra/system CA, no reject-unauthorized override, no proxy, no NODE_OPTIONS);
 *   - the effective default CA store equals Node's bundled root store (defaultCACertificatesSHA256 == rootCertificatesSHA256, same count);
 *   - execArgv is allowlisted and the node binary hash equals the pinned NODE_SHA256 (bootstrap);
 *   - startedAtUTC equals STARTED.json; disabled lifecycle; the pinned project; valuesRecorded false. */
/** v4 launch proof. Overrides (OPENSSL_CONF, any TS_NODE_* except COMPILER_OPTIONS, unlisted TS_NODE_* names) refused
 * always; the bootstrap hash must equal the pins' `_bootstrapSHA256`; launched-by-bootstrap required unless synthetic. */
export function checkLaunch(l, bootstrapSHA256, synthetic) {
  need(sameKeys(l, LAUNCH_KEYS) && sameKeys(l.environmentPresence, LAUNCH_ENV) && Object.values(l.environmentPresence).every(v => typeof v === "boolean") &&
    Array.isArray(l.otherTsNodeKeysPresent) && typeof l.entryIsBootstrap === "boolean", "runtime_launch_shape");
  need(LAUNCH_ENV.filter(k => !LAUNCH_REQUIRED.includes(k)).every(k => l.environmentPresence[k] === false), "runtime_launch_override_present");
  need(l.otherTsNodeKeysPresent.length === 0, "runtime_launch_unlisted_ts_node_keys");
  need(HEX64.test(bootstrapSHA256 ?? "") && l.bootstrapSHA256 === bootstrapSHA256, "runtime_bootstrap_not_candidate");
  if (!synthetic) need(l.entryIsBootstrap === true && l.entryScript === l.bootstrapPath && l.entryScriptSHA256 === l.bootstrapSHA256 &&
    l.cwd === WEB_ROOT && l.bootstrapPath === `${WEB_ROOT}/scripts/blsh/nativeProcessCaptureBootstrap.ts` &&
    LAUNCH_REQUIRED.every(k => l.environmentPresence[k] === true), "runtime_not_launched_by_bootstrap");
  return true;
}

export function checkRuntime(rt, started, nodeSHA256, synthetic, bootstrapSHA256) {
  need(rt && rt.version === "fhfh.blsh.native-capture-runtime.v1", "runtime_receipt_missing_or_wrong_version");
  need(sameKeys(rt, RUNTIME_KEYS), "runtime_unexpected_keys");
  need(rt.startedAtUTC === started.startedAtUTC, "runtime_receipt_not_bound_to_packet");
  need(rt.supabaseOrigin === ORIGIN && rt.lifecycleMode === "disabled", "runtime_receipt_incoherent");
  checkRuntimeCore(rt, nodeSHA256);
  need(sameKeys(rt.adapterEnvironmentPresence, ADAPTER_ENV) && Object.values(rt.adapterEnvironmentPresence).every(v => typeof v === "boolean"), "runtime_adapter_environment_shape");
  // Lifecycle key must be ABSENT (not merely "false"): the operator plan forbids launching with it set at all.
  need(rt.adapterEnvironmentPresence.NST_JOB_LIFECYCLE_ENABLED === false, "runtime_lifecycle_key_present");
  if (!synthetic) need(["NST_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"].every(k => rt.adapterEnvironmentPresence[k] === true), "runtime_adapter_environment_absent");
  checkLaunch(rt.launch, bootstrapSHA256, synthetic);
  // v5: exactly the anchored import-time default. Missing, preinstalled (sameAsRunnerLoad false) or another class: refused.
  need(sameKeys(rt.globalDispatcher, Object.keys(RUNTIME_DISPATCHER)) && Object.entries(RUNTIME_DISPATCHER).every(([k, v]) => rt.globalDispatcher[k] === v), "runtime_global_dispatcher_invalid");
  return true;
}

/** Per-operation TLS facts (successor HANDOFF §2): operation-N-SETTLED.json.tls for ALL five operations, mirrored
 * byte-for-byte in {schedule,individual,onIce}.TRANSPORT-OBSERVATION.json.tls. Re-derives the binding rules
 * independently of the runner and verifier:
 *   - authorized, no authorizationError, TLS 1.2/1.3, channel undici:client:sendHeaders, servername == request host;
 *   - not resumed => full peer certificate, resumedFromOperation null;
 *   - resumed => resumedFromOperation == the EARLIEST earlier full handshake (not resumed, not reused, certificate present)
 *     for the same servername; peerCertificate null or full;
 *   - keep-alive reuse => connectionFromOperation == the earlier operation that opened that connectionSequence, same host;
 *     a new connection never repeats a sequence. */
/** `packetDispatcher` = RUNTIME.globalDispatcher for a capture packet (v5: per-op 15-key tls incl. globalDispatcher);
 * omitted for acquisition receipts (14-key tls; their dispatcher facts sit at receipt level, see frames.mjs). */
export function verifyTlsChain(ops, observations, caStoreSHA256, packetDispatcher = undefined) {
  const certOk = c => c && typeof c === "object" && FINGERPRINT.test(c.fingerprint256 ?? "") && Array.isArray(c.issuerCNChain) && c.issuerCNChain.length > 0 && c.issuerCNChain.length <= 10;
  const opened = new Map(), seen = [];
  const count = Object.keys(ops).length;
  need(count > 0, "tls_observation_missing");
  for (let i = 1; i <= count; i++) {
    const t = ops[i]?.settled?.tls, host = new URL(ops[i].started.url).hostname;
    need(t && typeof t === "object", "tls_observation_missing");
    need(sameKeys(t, packetDispatcher === undefined ? TLS_KEYS : PACKET_TLS_KEYS), "tls_observation_shape");
    if (packetDispatcher !== undefined) {
      const d = t.globalDispatcher;
      need(sameKeys(d, ["present", "constructorName", "identityUnchanged"]) && d.present === true && d.identityUnchanged === true &&
        typeof packetDispatcher?.constructorName === "string" && d.constructorName === packetDispatcher.constructorName, "tls_global_dispatcher_changed");
    }
    // v4: the default CA store re-read after settlement must equal the runtime snapshot (no mid-run CA change).
    need(HEX64.test(caStoreSHA256 ?? "") && t.defaultCACertificatesSHA256 === caStoreSHA256, "tls_ca_store_changed");
    const name = ops[i].started.operation, obsName = name === "schedule" ? "schedule" : name.startsWith("nst:") ? name.slice(4) : null;
    if (obsName) need(JSON.stringify(observations[obsName]?.tls) === JSON.stringify(t), "tls_observation_inconsistent");
    need(t.channel === "undici:client:sendHeaders", "tls_channel_unqualified");
    need(t.authorized === true && t.authorizationError === null, "tls_peer_unauthorized");
    need(t.protocol === "TLSv1.3" || t.protocol === "TLSv1.2", "tls_protocol_unqualified");
    need(t.servername === host, "tls_servername_mismatch");
    need(typeof t.sessionReused === "boolean" && typeof t.connectionReused === "boolean" && Number.isSafeInteger(t.connectionSequence) && t.connectionSequence > 0, "tls_binding_shape");
    if (t.sessionReused) {
      const full = seen.find(x => x.t.servername === t.servername && !x.t.sessionReused && !x.t.connectionReused && certOk(x.t.peerCertificate));
      need(full && t.resumedFromOperation === full.i && (t.peerCertificate === null || certOk(t.peerCertificate)), "tls_resumed_session_unbound");
    } else {
      need(t.resumedFromOperation === null, "tls_binding_shape");
      need(certOk(t.peerCertificate), "tls_peer_certificate_missing");
    }
    if (t.connectionReused) {
      const opener = opened.get(t.connectionSequence);
      need(opener && opener.t.servername === t.servername && t.connectionFromOperation === opener.i, "tls_connection_reuse_unbound");
    } else {
      need(!opened.has(t.connectionSequence) && t.connectionFromOperation === null, "tls_connection_sequence_repeated");
      opened.set(t.connectionSequence, { i, t });
    }
    seen.push({ i, t });
  }
  return true;
}

export function definitionArtifact(lineageSHA256) {
  return {
    version: "fhfh.blsh.native-process-definition.v1",
    source: "Natural Stat Trick playerteams.php, all-strength single-game-date count tables",
    query: { fromseason: "20262027", thruseason: "20262027", stype: "2 (regular season)", sit: "all (all strengths)", score: "all",
      rate: "n (counts, not rates)", team: "ALL", pos: "S", loc: "B", toi: "0", gpfilt: "gpdate", fd: "= td = the game date", lines: "single", draftteam: "ALL", tgp: "permitted by the gate, unused" },
    groups: {
      individual: { stdoi: "std", storedTable: "public.nst_gamelog_as_counts", cells: { GP: "gp", TOI: "toi", Goals: "goals", Shots: "shots", ixG: "ixg" } },
      onIce: { stdoi: "oi", storedTable: "public.nst_gamelog_as_counts_oi", cells: { GP: "gp", TOI: "toi", xGF: "xgf", xGA: "xga" } },
    },
    headerMatching: "header text with whitespace removed and lower-cased; each required header exactly once; one table; player identity from the playerreport.php playerid link",
    toiParsingContract: { id: TOI_CONTRACT, rule: "M:SS -> 60*M+S; decimal minutes -> round_half_up(minutes*60) to whole seconds" },
    qualifiedScope: { strengthScope: "all_strength", dateMeaning: "game_date", toiUnit: "seconds" },
    cellParser: { file: "nst_lineage.py", sha256: lineageSHA256 },
    model: "unknown: NST's xG model is not independently defined or qualified by this artifact",
    originalPublicationUTC: null,
  };
}

/** Freshness rule of nativeProcessCapturePreparation.ts:48, applied at retrieval time (exported for boundary tests). */
export function nativeDateFresh(date, retrievedAtUTC) {
  const retrieved = stamp(retrievedAtUTC);
  return date < new Date(retrieved).toISOString().slice(0, 10) && retrieved - Date.parse(`${date}T00:00:00Z`) < 8 * DAY_MS;
}
/** The runner never asserts TLS in an observation; only this bridge decides (exported for a direct test). */
export function checkObservationClaims(obs) { need(obs.TLSVerified === null, "observation_overclaims_tls"); return true; }

function runReadback(verifier, packetDir, pinsPath, synthetic) {
  const args = [verifier, packetDir, pinsPath, ...(synthetic ? ["--synthetic-adapter-ok"] : [])];
  const r = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 60_000, env: { PATH: process.env.PATH ?? "/usr/bin:/bin" } });
  let readback;
  try { readback = JSON.parse(r.stdout.trim()); } catch { throw new BridgeRefusal("readback_unparsed"); }
  need(r.status === 0 && readback.verdict === "complete_pending_review" && readback.reasons?.length === 0,
    `packet_vetoed:${(readback.reasons ?? []).slice(0, 8).join("|") || "unknown"}`);
  return { readback, bytes: Buffer.from(r.stdout) };
}

/** Convert ONE verified runner packet. Never mutates the packet. */
export function convertPacket({ packetDir, pinsPath, verifierPath, nodeSHA256, lineagePath, outDir, syntheticAdapterOk = false, candidate = "v5" }) {
  const A = approvedFor(candidate); // explicit choice; the packet never selects its own candidate
  const verifierBytes = readBound(verifierPath, 256 * 1024);
  const pinsBytes = readBound(pinsPath, 64 * 1024), pins = parseJson(pinsBytes, "pins_invalid");
  const lineageSHA256 = sha(readBound(lineagePath, 256 * 1024));
  // Review Q3: the candidate class needs the reviewed pins, verifier, node pin and parser, byte for byte.
  // The synthetic path may use other inputs but can only ever produce the diagnostic class.
  const approvedInputs = sha(pinsBytes) === A.pinsSHA256 && sha(verifierBytes) === A.verifierSHA256 &&
    nodeSHA256 === A.nodeSHA256 && lineageSHA256 === A.lineageSHA256;
  if (!syntheticAdapterOk) {
    need(sha(pinsBytes) === A.pinsSHA256, "pins_not_approved");
    need(sha(verifierBytes) === A.verifierSHA256, "verifier_not_approved");
    need(nodeSHA256 === A.nodeSHA256, "node_pin_not_approved");
    need(lineageSHA256 === A.lineageSHA256, "lineage_not_approved");
    need(pins._bootstrapSHA256 === A.bootstrapSHA256, "pins_not_approved");
  }
  const { readback, bytes: readbackBytes } = runReadback(resolve(verifierPath), resolve(packetDir), resolve(pinsPath), syntheticAdapterOk);
  // Re-read everything ourselves after the readback; nothing is trusted from it except the veto.
  const names = new Set(readdirSync(packetDir));
  const file = (name, max = 2 * MIB) => { need(names.has(name), `packet_file_missing:${name}`); return readBound(join(packetDir, name), max); };
  const startedBytes = file("STARTED.json", 64 * 1024), started = parseJson(startedBytes);
  const plan = parseJson(file("PLAN.json", 64 * 1024));
  const binding = Object.fromEntries(started.sourceBindings.map(b => [b.role, b]));
  // Producer/redactor come from the PINS input, never from the packet (packet must agree).
  need(isHash(pins.client) && binding.client?.sha256 === pins.client, "redactor_not_pinned");
  const producerSHA256 = syntheticAdapterOk ? binding.adapter?.sha256 : pins.adapter;
  need(isHash(producerSHA256) && binding.adapter?.sha256 === producerSHA256, "producer_not_pinned");
  const producerBytes = file(binding.adapter.file, MIB / 2), redactorBytes = file(binding.client.file, MIB / 2);
  need(sha(producerBytes) === producerSHA256 && sha(redactorBytes) === pins.client, "producer_or_redactor_bytes_changed");

  // Plan scope, re-derived (no trust in PLAN text beyond its date).
  const date = plan?.input?.date;
  need(plan?.input?.seasonId === SEASON && isDay(date) && date >= "2026-07-01" && date <= "2027-06-30", "plan_scope_invalid");
  for (const group of GROUPS) need(plan.pages?.find(p => p.group === group)?.url === canonicalNstUrl(date, group), "plan_url_not_canonical");
  const startedAt = stamp(started.startedAtUTC), plannedAt = stamp(plan.input.plannedAtUTC);
  need(plannedAt <= startedAt && startedAt - plannedAt <= PLAN_LIFETIME_MS, "plan_expired_at_start");

  // Operations, in the readback's verified order.
  const ops = {}, journal = [];
  for (let i = 1; i <= 5; i++) {
    const sb = file(`operation-${i}-STARTED.json`, 64 * 1024), db = file(`operation-${i}-SETTLED.json`, 64 * 1024);
    const s = parseJson(sb), d = parseJson(db);
    need(s.operation === d.operation, "operation_journal_mismatch"); ops[s.operation] = { started: s, settled: d };
    journal.push([`operation-${i}-STARTED.json`, sb], [`operation-${i}-SETTLED.json`, db]);
  }
  const planBytes = file("PLAN.json", 64 * 1024), manifestBytes = file("MANIFEST.json", 4 * MIB);
  const runtimeBytes = file("RUNTIME.json", 64 * 1024), runtime = parseJson(runtimeBytes, "runtime_receipt_invalid");

  // Schedule: finality witness for the native date (used by frames for completedByUTC).
  const scheduleBytes = file("schedule.raw.json", MIB), scheduleObsBytes = file("schedule.TRANSPORT-OBSERVATION.json", 64 * 1024), scheduleObs = parseJson(scheduleObsBytes);
  need(scheduleObs.representation === "original_decoded_body" && scheduleObs.sha256 === sha(scheduleBytes), "schedule_observation_mismatch");
  need(scheduleObs.finalUrl === `https://api-web.nhle.com/v1/schedule/${date}` && scheduleObs.httpStatus === 200 && scheduleObs.redirected === false, "schedule_scope_invalid");
  const scheduleSHA256 = sha(scheduleBytes);
  const day = parseJson(scheduleBytes).gameWeek.filter(d => d.date === date);
  need(day.length === 1, "schedule_day_ambiguous");
  const games = day[0].games.map(g => ({ gameId: g.id, home: g.homeTeam.abbrev, away: g.awayTeam.abbrev, gameState: g.gameState }));
  need(games.length > 0 && games.every(g => ["OFF", "FINAL"].includes(g.gameState)), "schedule_not_final");
  need(JSON.stringify(games.map(g => g.gameId).sort((a, b) => a - b)) === JSON.stringify(scheduleObs.completedGameIds), "schedule_games_drift");
  const scheduleFacts = { date, scheduleSHA256, retrievedAtUTC: scheduleObs.retrievedAtUTC, games };
  need(stamp(scheduleObs.retrievedAtUTC) >= startedAt && scheduleObs.retrievedAtUTC === ops.schedule?.settled.completedAtUTC, "schedule_chronology");

  // Validate every group fully BEFORE any output exists: a refusal leaves no output directory.
  const validated = GROUPS.map(group => {
    const url = canonicalNstUrl(date, group);
    const obsBytes = file(`${group}.TRANSPORT-OBSERVATION.json`, 64 * 1024);
    const bodyName = `${group}.parser-input.html`, obs = parseJson(obsBytes);
    const body = file(bodyName, 2 * MIB);
    need(obs.file === bodyName && obs.sha256 === sha(body) && obs.bytes === body.length, "native_body_hash_mismatch");
    need(Object.hasOwn(REPRESENTATION_MAP, obs.representation), "representation_unmapped");
    need(obs.httpStatus === 200 && obs.redirected === false && obs.finalUrl === url && ops[`nst:${group}`]?.started.url === url, "native_transport_or_url_invalid");
    checkObservationClaims(obs);
    // Freshness rule kept intact (nativeProcessCapturePreparation.ts:48), applied at retrieval time.
    const retrieved = stamp(obs.retrievedAtUTC);
    need(retrieved >= startedAt && obs.retrievedAtUTC === ops[`nst:${group}`].settled.completedAtUTC, "native_retrieval_chronology");
    need(nativeDateFresh(date, obs.retrievedAtUTC), "future_incomplete_or_stale_date");
    need(stamp(scheduleObs.retrievedAtUTC) <= retrieved, "schedule_after_native");
    return { group, url, obs, obsBytes, body, tls: ops[`nst:${group}`].settled.tls };
  });
  // TLSVerified is decided HERE, once, for the whole run: TLS facts on all five operations (the schedule supplies
  // finality and completedByUTC for every frame, so it gets the same standard) AND the packet-bound runtime receipt.
  // Field order matters: missing TLS is reported before runtime problems.
  verifyTlsChain(Object.fromEntries(Object.values(ops).map((o, k) => [k + 1, o])),
    { schedule: scheduleObs, ...Object.fromEntries(validated.map(v => [v.group, v.obs])) }, runtime?.tls?.defaultCACertificatesSHA256, runtime?.globalDispatcher ?? null);
  checkRuntime(runtime, started, nodeSHA256, syntheticAdapterOk, syntheticAdapterOk ? pins._bootstrapSHA256 : A.bootstrapSHA256);

  const out = createOutput(outDir);
  const artifacts = [];
  const keep = (role, name, bytes) => { const digest = out.write(name, bytes); artifacts.push({ role, file: name, sha256: digest, bytes: bytes.length }); return digest; };
  keep("producer_source", "producer.source-adapter.ts", producerBytes);
  keep("redactor_source", "redactor.source-client.ts", redactorBytes);
  const definitionSHA256 = keep("definition", "definition.json", encode(definitionArtifact(lineageSHA256)));
  keep("packet_started", "STARTED.json", startedBytes);
  keep("packet_readback", "READBACK.json", readbackBytes);
  keep("runtime_receipt", "RUNTIME.json", runtimeBytes);

  keep("schedule_body", "schedule.raw.json", scheduleBytes);
  // Review Q6: bind the TLS basis and the packet's own record, not only the conclusion drawn from them.
  keep("packet_plan", "PLAN.json", planBytes);
  keep("packet_manifest", "packet-MANIFEST.json", manifestBytes);
  for (const [name, bytes] of journal) keep("packet_operation_journal", name, bytes);
  keep("packet_transport_observation", "schedule.TRANSPORT-OBSERVATION.json", scheduleObsBytes);
  for (const v of validated) keep("packet_transport_observation", `${v.group}.TRANSPORT-OBSERVATION.json`, v.obsBytes);
  const receipts = {};
  for (const { group, url, obs, body, tls } of validated) {
    const bodySHA256 = keep(`native_body_${group}`, `native-${group}.parser-input.html`, body);
    const receipt = { url, status: "success", httpStatus: 200, TLSVerified: true, representation: REPRESENTATION_MAP[obs.representation],
      parserInputSHA256: bodySHA256, parserInputBytes: body.length, producerSHA256, redactorSHA256: pins.client,
      toiParsingContract: TOI_CONTRACT, retrievedAtUTC: obs.retrievedAtUTC };
    receipts[group] = { receiptSHA256: keep(`native_receipt_${group}`, `receipt-${group}.json`, encode(receipt)), bodySHA256, tls };
  }
  out.writeJson("producer-allowlist.json", { producerSHA256: [producerSHA256], redactorSHA256: [pins.client] });
  const evidenceClass = syntheticAdapterOk ? "diagnostic_only_synthetic_adapter" : approvedInputs ? "candidate_pending_independent_review" : "refused";
  need(evidenceClass !== "refused", "inputs_not_approved");
  const conversion = { version: "fhfh.blsh.evidence-bridge.conversion.v1", evidenceClass, date, packet: basename(resolve(packetDir)),
    verifierSHA256: sha(verifierBytes), pinsSHA256: sha(pinsBytes), nodeSHA256, lineageSHA256, approvedInputs, readbackVerdict: readback.verdict, readbackClass: readback.evidenceClass,
    producerSHA256, redactorSHA256: pins.client, definitionSHA256, representationMap: REPRESENTATION_MAP, receipts, scheduleFacts, artifacts,
    independentlyAccepted: false, networkRequests: 0 };
  out.writeJson("CONVERSION.json", conversion);
  out.complete("converted_pending_independent_review");
  return conversion;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  try {
    const syntheticAdapterOk = process.argv.includes("--synthetic-adapter-ok");
    // The CLI never defaults the candidate for a real conversion: --candidate v5 | v5-1118 is required.
    need(syntheticAdapterOk || arg("candidate") !== undefined, "candidate_required");
    const r = convertPacket({ packetDir: arg("packet"), pinsPath: arg("pins"), verifierPath: arg("verifier"), nodeSHA256: arg("node-sha256"),
      lineagePath: arg("lineage"), outDir: arg("out"), syntheticAdapterOk, candidate: arg("candidate") ?? "v5" });
    process.stdout.write(`${JSON.stringify({ ok: true, evidenceClass: r.evidenceClass, date: r.date })}\n`);
  } catch (e) {
    process.stdout.write(`${JSON.stringify({ ok: false, refusal: e instanceof BridgeRefusal ? e.code : e?.code === "EEXIST" ? "output_exists" : "bridge_error" })}\n`); process.exitCode = 2;
  }
}
