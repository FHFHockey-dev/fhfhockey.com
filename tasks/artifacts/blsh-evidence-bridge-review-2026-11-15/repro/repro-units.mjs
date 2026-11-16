// Reviewer probes on the UNCHANGED bridge functions (imported read-only). No files written. No network.
// Usage: node repro-units.mjs [<proposal.json from propose-policy.mjs>]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { BRIDGE, REPO, sha, tlsFor } from "./packet.mjs";

const { verifyTlsChain, checkRuntime } = await import(join(BRIDGE, "convert.mjs"));
const { framesFromBoxscores } = await import(join(BRIDGE, "frames.mjs"));
const code = fn => { try { fn(); return "accepted"; } catch (e) { return e.code ?? `uncaught:${e.constructor.name}:${e.message}`; } };
const out = [];

// ---- verifyTlsChain: five ops in the runner's order -------------------------------------------------------------
const URLS = ["https://api-web.nhle.com/v1/schedule/2026-11-11", "https://fyhftlxokyjtpndbkfse.supabase.co/rest/v1/rpc/nst_admit_attempt_v1",
  "https://data.naturalstattrick.com/playerteams.php?fd=2026-11-11", "https://fyhftlxokyjtpndbkfse.supabase.co/rest/v1/rpc/nst_admit_attempt_v1",
  "https://data.naturalstattrick.com/playerteams.php?fd=2026-11-11"];
const NAMES = ["schedule", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce"];
const chain = (edit = {}) => {
  const ops = {}, obs = {};
  URLS.forEach((url, k) => { const n = k + 1; const t = edit[n] ? edit[n](tlsFor(url, n)) : tlsFor(url, n);
    ops[n] = { started: { url, operation: NAMES[k] }, settled: { tls: t } }; });
  obs.schedule = { tls: ops[1].settled.tls }; obs.individual = { tls: ops[3].settled.tls }; obs.onIce = { tls: ops[5].settled.tls };
  return [ops, obs];
};
const probe = (name, edit, obsEdit) => { const [ops, obs] = chain(edit); obsEdit?.(obs); out.push({ fn: "verifyTlsChain", name, result: code(() => verifyTlsChain(ops, obs)) }); };
probe("baseline_all_full_handshakes");
probe("resumed_op3_no_prior_full_handshake_same_host", { 3: t => ({ ...t, sessionReused: true, peerCertificate: null, resumedFromOperation: 1 }) });
probe("resumed_op5_bound_to_op3_ok", { 5: t => ({ ...t, sessionReused: true, peerCertificate: null, resumedFromOperation: 3 }) });
probe("resumed_op5_bound_to_wrong_op", { 5: t => ({ ...t, sessionReused: true, peerCertificate: null, resumedFromOperation: 1 }) });
probe("resumed_op5_unauthorized", { 5: t => ({ ...t, sessionReused: true, authorized: false, peerCertificate: null, resumedFromOperation: 3 }) });
probe("keepalive_op5_on_op3_ok", { 5: t => ({ ...t, connectionReused: true, connectionSequence: 3, connectionFromOperation: 3 }) });
probe("keepalive_op5_wrong_opener_index", { 5: t => ({ ...t, connectionReused: true, connectionSequence: 3, connectionFromOperation: 2 }) });
probe("keepalive_op5_onto_other_host_conn", { 5: t => ({ ...t, connectionReused: true, connectionSequence: 2, connectionFromOperation: 2 }) });
probe("new_conn_repeats_sequence", { 5: t => ({ ...t, connectionSequence: 3 }) });
probe("admission_tls_null", { 2: () => null });
probe("admission_authorizationError_string", { 2: t => ({ ...t, authorizationError: "CERT_HAS_EXPIRED" }) });
probe("tls_1_1", { 3: t => ({ ...t, protocol: "TLSv1.1" }) });
probe("servername_mismatch", { 3: t => ({ ...t, servername: "www.naturalstattrick.com" }) });
probe("mirror_differs", {}, obs => { obs.onIce = { tls: { ...obs.onIce.tls, cipher: { name: "X", standardName: "X", version: "X" } } }; });
probe("keepalive_fingerprint_differs", { 5: t => ({ ...t, connectionReused: true, connectionSequence: 3, connectionFromOperation: 3, peerCertificate: { ...t.peerCertificate, fingerprint256: Array(32).fill("11").join(":") } }) });
probe("keepalive_and_resumed_on_resumed_conn", { 4: t => ({ ...t, sessionReused: true, peerCertificate: null, resumedFromOperation: 2 }),
  5: t => ({ ...t, sessionReused: true, peerCertificate: null, resumedFromOperation: 3 }) });
probe("issuer_chain_is_any_string", { 3: t => ({ ...t, peerCertificate: { ...t.peerCertificate, issuerCNChain: ["Anything At All"] } }) });

// ---- checkRuntime ----------------------------------------------------------------------------------------------
const { runtimeFor, NODE_SHA256 } = await import("./packet.mjs");
const started = { startedAtUTC: "2026-11-17T14:05:10.000Z" };
const rt = over => code(() => checkRuntime(runtimeFor(started.startedAtUTC, over), started, NODE_SHA256, false));
out.push({ fn: "checkRuntime", name: "baseline", result: rt({}) });
out.push({ fn: "checkRuntime", name: "extra_keys_syntheticTestOnly", result: rt({ syntheticTestOnly: true }) });
out.push({ fn: "checkRuntime", name: "lifecycle_key_present_false_value", result: rt({ adapterEnvironmentPresence: { NST_KEY: true, SUPABASE_SERVICE_ROLE_KEY: true, NEXT_PUBLIC_SUPABASE_URL: true, NST_JOB_LIFECYCLE_ENABLED: true } }) });
out.push({ fn: "checkRuntime", name: "default_ca_null_(getCACertificates_missing)", result: rt({ tls: { rootCertificatesSHA256: "a".repeat(64), rootCertificateCount: 116, defaultCACertificatesSHA256: null, defaultCACertificateCount: null } }) });
out.push({ fn: "checkRuntime", name: "execArgv_empty_allowed", result: rt({ node: { version: "v22.23.4", execPath: "/x", execPathSHA256: NODE_SHA256, execArgv: [] } }) });
out.push({ fn: "checkRuntime", name: "node_version_not_pinned_v99", result: rt({ node: { version: "v99.0.0", execPath: "/x", execPathSHA256: NODE_SHA256, execArgv: [] } }) });

// ---- frames: receipt TLSVerified is self-asserted; synthetic markers ignored ----------------------------------
const facts = { date: "2026-11-11", scheduleSHA256: "c".repeat(64), retrievedAtUTC: "2026-11-17T14:05:10.500Z", games: [{ gameId: 2026020293, home: "AAA", away: "BBB", gameState: "OFF" }] };
const body = Buffer.from(JSON.stringify({ id: 2026020293, season: 20262027, gameType: 2, gameDate: "2026-11-11", gameState: "OFF", gameScheduleState: "OK",
  awayTeam: { abbrev: "BBB" }, homeTeam: { abbrev: "AAA" }, playerByGameStats: { awayTeam: { forwards: [{ playerId: 1, toi: "10:00" }], defense: [] }, homeTeam: { forwards: [{ playerId: 2, toi: "0:00" }], defense: [] } } }));
const receipt = extra => Buffer.from(JSON.stringify({ at: "2026-11-17T13:00:00.000Z", url: "https://api-web.nhle.com/v1/gamecenter/2026020293/boxscore", httpStatus: 200, TLSVerified: true, sha256: sha(body), bytes: body.length, state: "verified", ...extra }));
const fr = extra => { try { const f = framesFromBoxscores(facts, [{ bodyBytes: body, receiptBytes: receipt(extra) }]); return `accepted:${f.length}_frames:completedByUTC=${f[0]?.completedByUTC}`; } catch (e) { return e.code; } };
out.push({ fn: "framesFromBoxscores", name: "hand_written_receipt_marked_synthetic", result: fr({ syntheticTestOnly: true, note: "never fetched" }) });
out.push({ fn: "framesFromBoxscores", name: "receipt_TLSVerified_false", result: fr({ TLSVerified: false }) });
const nonFinal = Buffer.from(body.toString().replace('"gameState":"OFF"', '"gameState":"LIVE"'));
out.push({ fn: "framesFromBoxscores", name: "non_final_boxscore", result: code(() => framesFromBoxscores(facts, [{ bodyBytes: nonFinal, receiptBytes: Buffer.from(JSON.stringify({ ...JSON.parse(receipt({})), sha256: sha(nonFinal), bytes: nonFinal.length })) }])) });

const goodReceipt = b => Buffer.from(JSON.stringify({ ...JSON.parse(receipt({})), url: `https://api-web.nhle.com/v1/gamecenter/${JSON.parse(b).id}/boxscore`, sha256: sha(b), bytes: b.length }));
const offSched = Buffer.from(body.toString().replace('"id":2026020293', '"id":2026020299'));
out.push({ fn: "framesFromBoxscores", name: "off_schedule_game", result: code(() => framesFromBoxscores(facts, [{ bodyBytes: offSched, receiptBytes: goodReceipt(offSched) }])) });
out.push({ fn: "framesFromBoxscores", name: "duplicate_game", result: code(() => framesFromBoxscores(facts, [{ bodyBytes: body, receiptBytes: goodReceipt(body) }, { bodyBytes: body, receiptBytes: goodReceipt(body) }])) });
const dupPlayer = Buffer.from(body.toString().replace('{"playerId":2,"toi":"0:00"}', '{"playerId":1,"toi":"9:00"}'));
out.push({ fn: "framesFromBoxscores", name: "duplicate_player_on_date", result: code(() => framesFromBoxscores(facts, [{ bodyBytes: dupPlayer, receiptBytes: goodReceipt(dupPlayer) }])) });

// ---- gate constructor on the proposal as written ---------------------------------------------------------------
const proposalPath = process.argv[2];
if (proposalPath) {
  const gate = createRequire(import.meta.url)(join(REPO, "tasks/artifacts/blsh-native-packet-preparation-2026-11-08/closed_gate.cjs")).loadGate();
  const p = JSON.parse(readFileSync(proposalPath, "utf8"));
  out.push({ fn: "createCurrentProcessEvidenceGate", name: "proposal_as_written", result: code(() => gate.createCurrentProcessEvidenceGate({ acceptances: [p.acceptance] })) });
}
for (const r of out) console.log(JSON.stringify(r));
