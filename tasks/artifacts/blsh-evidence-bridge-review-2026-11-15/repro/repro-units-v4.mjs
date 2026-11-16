// Recheck probes on the bridge's OWN v4 checks (no verifier in the loop), imported read-only. No files written. No network.
import { join } from "node:path";
import { BRIDGE, NODE_SHA256, runtimeFor, sha, tlsFor } from "./packet.mjs";

const { checkRuntime, checkLaunch, verifyTlsChain, APPROVED } = await import(join(BRIDGE, "convert.mjs"));
const { framesFromBoxscores, APPROVED_ACQUISITION_TOOLS } = await import(join(BRIDGE, "frames.mjs"));
const code = fn => { try { fn(); return "accepted"; } catch (e) { return e.code ?? `uncaught:${e.message}`; } };
const out = [];
const CA = "5aab51f94c9a1ad6b5185229b65ca308fcae0e6fdb31bdf6f34278e099fb024c";
const WEB = "/Users/tim/Code/fhfhockey.com/web", BOOT = `${WEB}/scripts/blsh/nativeProcessCaptureBootstrap.ts`;
const LAUNCH_ENV = ["NODE_PATH", "DISABLE_V8_COMPILE_CACHE", "TS_NODE_COMPILER_OPTIONS", "OPENSSL_CONF", "TS_NODE_PROJECT", "TS_NODE_SKIP_PROJECT", "TS_NODE_COMPILER",
  "TS_NODE_TRANSPILE_ONLY", "TS_NODE_REQUIRE", "TS_NODE_CWD", "TS_NODE_DIR", "TS_NODE_COMPILER_HOST", "TS_NODE_EMIT", "TS_NODE_SCOPE", "TS_NODE_SCOPE_DIR", "TS_NODE_SWC", "TS_NODE_TRANSPILER"];
const launch = (o = {}) => ({ entryScript: BOOT, entryScriptSHA256: APPROVED.bootstrapSHA256, cwd: WEB, bootstrapPath: BOOT, bootstrapSHA256: APPROVED.bootstrapSHA256,
  entryIsBootstrap: true, environmentPresence: Object.fromEntries(LAUNCH_ENV.map((k, i) => [k, i < 3])), otherTsNodeKeysPresent: [], ...o });
const started = { startedAtUTC: "2026-11-17T14:05:10.000Z" };
const rt = (o = {}) => code(() => checkRuntime(runtimeFor(started.startedAtUTC, { launch: launch(), ...o }), started, NODE_SHA256, false, APPROVED.bootstrapSHA256));
out.push(["checkRuntime", "baseline", rt()]);
out.push(["checkRuntime", "extra_top_key", rt({ syntheticTestOnly: true })]);
out.push(["checkRuntime", "node_extra_key", rt({ node: { version: "v22.23.4", execPath: "/usr/local/bin/node", execPathSHA256: NODE_SHA256, execArgv: [], extra: 1 } })]);
out.push(["checkRuntime", "lifecycle_present", rt({ adapterEnvironmentPresence: { NST_KEY: true, SUPABASE_SERVICE_ROLE_KEY: true, NEXT_PUBLIC_SUPABASE_URL: true, NST_JOB_LIFECYCLE_ENABLED: true } })]);
out.push(["checkRuntime", "launch_missing", rt({ launch: undefined })]);
out.push(["checkLaunch", "unlisted_ts_node_key", code(() => checkLaunch(launch({ otherTsNodeKeysPresent: ["TS_NODE_FOO"] }), APPROVED.bootstrapSHA256, false))]);
out.push(["checkLaunch", "required_key_absent", code(() => checkLaunch(launch({ environmentPresence: Object.fromEntries(LAUNCH_ENV.map(k => [k, false])) }), APPROVED.bootstrapSHA256, false))]);
out.push(["checkLaunch", "entry_hash_differs_but_flag_true", code(() => checkLaunch(launch({ entryScriptSHA256: "f".repeat(64) }), APPROVED.bootstrapSHA256, false))]);
out.push(["checkLaunch", "synthetic_mode_rehearsal_entry", code(() => checkLaunch(launch({ entryScript: "/x/rehearse.ts", entryIsBootstrap: false, cwd: "/tmp" }), APPROVED.bootstrapSHA256, true))]);
// verifyTlsChain: exact 14 keys + CA store, directly.
const URLS = ["https://api-web.nhle.com/v1/schedule/2026-11-11", "https://fyhftlxokyjtpndbkfse.supabase.co/rest/v1/rpc/nst_admit_attempt_v1",
  "https://data.naturalstattrick.com/playerteams.php?a", "https://fyhftlxokyjtpndbkfse.supabase.co/rest/v1/rpc/nst_admit_attempt_v1", "https://data.naturalstattrick.com/playerteams.php?b"];
const NAMES = ["schedule", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce"];
const chain = (edit = {}, ca = CA) => { const ops = {}; URLS.forEach((u, k) => { const base = { ...tlsFor(u, k + 1), defaultCACertificatesSHA256: CA };
  ops[k + 1] = { started: { url: u, operation: NAMES[k] }, settled: { tls: edit[k + 1] ? edit[k + 1](base) : base } }; });
  return code(() => verifyTlsChain(ops, { schedule: { tls: ops[1].settled.tls }, individual: { tls: ops[3].settled.tls }, onIce: { tls: ops[5].settled.tls } }, ca)); };
out.push(["verifyTlsChain", "baseline_v4", chain()]);
out.push(["verifyTlsChain", "13_keys_v3_shape", chain({ 2: t => { const { defaultCACertificatesSHA256, ...r } = t; return r; } })]);
out.push(["verifyTlsChain", "extra_key", chain({ 2: t => ({ ...t, x: 1 }) })]);
out.push(["verifyTlsChain", "ca_changed_op2", chain({ 2: t => ({ ...t, defaultCACertificatesSHA256: "e".repeat(64) }) })]);
out.push(["verifyTlsChain", "runtime_ca_missing", chain({}, null)]);
out.push(["verifyTlsChain", "mirror_differs_bridge_only", (() => { const ops = {}; URLS.forEach((u, k) => { ops[k + 1] = { started: { url: u, operation: NAMES[k] }, settled: { tls: { ...tlsFor(u, k + 1), defaultCACertificatesSHA256: CA } } }; });
  return code(() => verifyTlsChain(ops, { schedule: { tls: ops[1].settled.tls }, individual: { tls: ops[3].settled.tls }, onIce: { tls: { ...ops[5].settled.tls, protocol: "TLSv1.2" } } }, CA)); })()]);
// frames production mode
out.push(["frames", "APPROVED_ACQUISITION_TOOLS_length", String(APPROVED_ACQUISITION_TOOLS.length)]);
const facts = { date: "2026-11-11", scheduleSHA256: "c".repeat(64), retrievedAtUTC: "2026-11-17T14:05:10.500Z", games: [2026020293, 2026020294].map((id, i) => ({ gameId: id, home: `H${i}A`, away: `A${i}A`, gameState: "OFF" })) };
const body = id => Buffer.from(JSON.stringify({ id, season: 20262027, gameType: 2, gameDate: "2026-11-11", gameState: "OFF", gameScheduleState: "OK",
  awayTeam: { abbrev: `A${id - 2026020293}A` }, homeTeam: { abbrev: `H${id - 2026020293}A` }, playerByGameStats: { awayTeam: { forwards: [{ playerId: id - 2026020000, toi: "10:00" }], defense: [] }, homeTeam: { forwards: [], defense: [] } } }));
const acqStart = "2026-11-17T14:30:00.000Z";
const acqRt = { version: "fhfh.blsh.official-acquisition-runtime.v1", startedAtUTC: acqStart, toolSHA256: "a".repeat(64),
  node: { version: "v22.23.4", execPath: "/usr/local/bin/node", execPathSHA256: NODE_SHA256, execArgv: [] }, tls: runtimeFor(started.startedAtUTC).tls,
  environmentPresence: runtimeFor(started.startedAtUTC).environmentPresence, valuesRecorded: false };
const v2 = (id, op) => { const b = body(id), url = `https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`;
  return { bodyBytes: b, receiptBytes: Buffer.from(JSON.stringify({ version: "fhfh.blsh.official-boxscore-receipt.v2", operation: op, url, httpStatus: 200, redirected: false,
    retrievedAtUTC: `2026-11-17T14:30:0${op}.000Z`, sha256: sha(b), bytes: b.length, acquisitionStartedAtUTC: acqStart, tls: { ...tlsFor(url, op), defaultCACertificatesSHA256: CA } })) }; };
const fr = (pairs, rtm = acqRt, node = NODE_SHA256) => code(() => framesFromBoxscores(facts, pairs, { acquisitionRuntime: rtm, nodeSHA256: node }));
out.push(["frames", "wellformed_v2_both_games", fr([v2(2026020293, 1), v2(2026020294, 2)])]);
out.push(["frames", "wellformed_v2_prefix_subset_1_of_2", fr([v2(2026020293, 1)])]);
out.push(["frames", "node_pin_is_caller_supplied", fr([v2(2026020293, 1)], { ...acqRt, node: { ...acqRt.node, execPathSHA256: "9".repeat(64) } }, "9".repeat(64))]);
const legacy = (() => { const b = body(2026020293); return { bodyBytes: b, receiptBytes: Buffer.from(JSON.stringify({ at: "2026-11-17T13:00:00.000Z", url: "https://api-web.nhle.com/v1/gamecenter/2026020293/boxscore", httpStatus: 200, TLSVerified: true, sha256: sha(b), bytes: b.length, state: "verified" })) }; })();
out.push(["frames", "legacy_self_asserted_receipt_production", fr([legacy])]);
out.push(["frames", "legacy_receipt_test_mode", code(() => framesFromBoxscores(facts, [legacy], { testMode: true }))]);
for (const [fn, name, result] of out) console.log(JSON.stringify({ fn, name, result }));
