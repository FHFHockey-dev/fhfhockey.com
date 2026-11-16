// Reviewer reproducer helper (independent of the bridge's tests/fixtures.mjs).
// Builds a runner-format packet in a SCRATCH directory from caller-supplied source bytes.
// Every fact in it is hand-written: no network, no real TLS, no real NST or NHL bytes.
// Usage: imported by the repro-*.mjs scripts. Writes only under the directory it is given.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const REPO = "/Users/tim/Code/fhfhockey.com";
export const BRIDGE = join(REPO, "tasks/artifacts/blsh-evidence-bridge-2026-11-15");
export const SUCC = join(REPO, "tasks/artifacts/blsh-successor-candidate-2026-11-15");
// REVIEW_SUCC_REHEARSAL overrides the folder holding expected-pins.json + verify-packet.mjs (e.g. the bridge's vendored approved/v4).
const SUCC_REHEARSAL = process.env.REVIEW_SUCC_REHEARSAL ?? join(SUCC, "rehearsal");
export const SUCC_PINS = join(SUCC_REHEARSAL, "expected-pins.json");
export const SUCC_VERIFIER = join(SUCC_REHEARSAL, "verify-packet.mjs");
export const LINEAGE = "/Users/tim/Documents/Codex/2026-10-27/task-3/nst-lineage-and-gs-alternatives-20261101-01/nst_lineage.py";
export const NODE_SHA256 = "daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef"; // bootstrap NODE_SHA256 (SUCCESSOR.patch)
export const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
export const sha = b => createHash("sha256").update(b).digest("hex");
const enc = v => Buffer.from(`${JSON.stringify(v, null, 2)}\n`);
const iso = ms => new Date(ms).toISOString();

const ROLE_PATHS = { runner: "scripts/blsh/nativeProcessCaptureRunner.ts", adapter: "scripts/blsh/nativeProcessCaptureAdapter.ts",
  preparation: "scripts/blsh/nativeProcessCapturePreparation.ts", client: "lib/nst/client.ts", budget: "lib/nst/requestBudget.ts",
  admission: "lib/nst/sharedAdmission.ts", admissionOrigin: "lib/nst/admissionOrigin.ts", lifecycle: "lib/nst/jobLifecycle.server.ts",
  ratePolicy: "lib/cron/nstRateLimitPolicy.ts" };

/** Source bytes for every role: `patchedWeb` (scratch copy of web/ with SUCCESSOR.patch applied) for runner/adapter,
 * the live web/ tree for the other seven (unchanged by the patch). `override` replaces any role's bytes. */
export function sources(patchedWeb, override = {}) {
  return Object.entries(ROLE_PATHS).map(([role, p]) => [role, override[role] ??
    readFileSync(join(["runner", "adapter"].includes(role) ? patchedWeb : join(REPO, "web"), p))]);
}

export function canonicalNstUrl(date, group) {
  const url = new URL("https://data.naturalstattrick.com/playerteams.php");
  const q = { fromseason: "20262027", thruseason: "20262027", stype: "2", sit: "all", score: "all", stdoi: group === "individual" ? "std" : "oi",
    rate: "n", team: "ALL", pos: "S", loc: "B", toi: "0", gpfilt: "gpdate", fd: date, td: date, lines: "single", draftteam: "ALL" };
  for (const [k, v] of Object.entries(q)) url.searchParams.set(k, v);
  return url.toString();
}

/** Hand-written TLS facts in the successor's exact field set (HANDOFF §2). NOT an observation. */
export const tlsFor = (url, seq, over = {}) => ({ channel: "undici:client:sendHeaders", authorized: true, authorizationError: null,
  servername: new URL(url).hostname, alpnProtocol: "http/1.1", protocol: "TLSv1.3",
  cipher: { name: "TLS_AES_128_GCM_SHA256", standardName: "TLS_AES_128_GCM_SHA256", version: "TLSv1.3" },
  sessionReused: false, connectionReused: false, connectionSequence: seq, resumedFromOperation: null, connectionFromOperation: null,
  peerCertificate: { fingerprint256: Array(32).fill("EE").join(":"), valid_from: "HAND WRITTEN", valid_to: "HAND WRITTEN", subjectCN: "hand.written", issuerCNChain: ["HAND WRITTEN CA"] },
  ...over });

/** Hand-written RUNTIME.json with the successor's exact shape and the values a clean live run would show. */
export const runtimeFor = (startedAtUTC, over = {}) => ({ version: "fhfh.blsh.native-capture-runtime.v1", startedAtUTC,
  node: { version: "v22.23.4", execPath: "/usr/local/bin/node", execPathSHA256: NODE_SHA256, execArgv: ["--require", "./node_modules/ts-node/register/transpile-only"] },
  tls: { rootCertificatesSHA256: "5aab51f94c9a1ad6b5185229b65ca308fcae0e6fdb31bdf6f34278e099fb024c", rootCertificateCount: 116,
    defaultCACertificatesSHA256: "5aab51f94c9a1ad6b5185229b65ca308fcae0e6fdb31bdf6f34278e099fb024c", defaultCACertificateCount: 116 },
  environmentPresence: Object.fromEntries(["NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_OPTIONS", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY",
    "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "all_proxy", "no_proxy"].map(k => [k, false])),
  supabaseOrigin: ORIGIN, lifecycleMode: "disabled",
  adapterEnvironmentPresence: { NST_KEY: true, SUPABASE_SERVICE_ROLE_KEY: true, NEXT_PUBLIC_SUPABASE_URL: true, NST_JOB_LIFECYCLE_ENABLED: false },
  valuesRecorded: false, ...over });

/** Synthetic 6-game slate (ids only; no teams or players from any real source beyond public team codes). */
export function scheduleBody(date) {
  const teams = [["AAA", "BBB"], ["CCC", "DDD"], ["EEE", "FFF"], ["GGG", "HHH"], ["III", "JJJ"], ["KKK", "LLL"]];
  return Buffer.from(JSON.stringify({ gameWeek: [{ date, games: teams.map(([h, a], i) => ({ id: 2026020293 + i, season: 20262027, gameType: 2,
    gameState: "OFF", gameScheduleState: "OK", homeTeam: { id: 2 * i + 1, abbrev: h }, awayTeam: { id: 2 * i + 2, abbrev: a } })) }] }));
}

/** Writes a runner-format packet. `times` gives ms offsets from startedAt for each operation's completion,
 * or `retrieved` overrides the exact completedAtUTC strings for ops 3 and 5. */
export function makePacket(dir, { date, startedAtUTC, srcs, tls = {}, runtime = {}, retrieved = {}, html = "<table><tr><td>HAND WRITTEN</td></tr></table>\n" }) {
  mkdirSync(dir, { mode: 0o700 });
  const files = [];
  const write = (name, bytes) => { writeFileSync(join(dir, name), bytes, { flag: "wx", mode: 0o600 }); files.push({ file: name, bytes: bytes.length, sha256: sha(bytes) }); };
  const json = (name, v) => write(name, enc(v));
  const t0 = Date.parse(startedAtUTC);
  const bindings = srcs.map(([role, bytes]) => ({ role, file: `source-${role}.ts`, sha256: sha(bytes), bytes: bytes.length }));
  json("STARTED.json", { version: "fhfh.blsh.native-capture-run.v1", startedAtUTC, supabaseOrigin: ORIGIN, lifecycleMode: "disabled", sourceBindings: bindings });
  const plannedAtUTC = iso(t0 - 30_000);
  const pages = ["individual", "onIce"].map(group => ({ group, url: canonicalNstUrl(date, group) }));
  json("PLAN.json", { version: "fhfh.blsh.native-process-capture-preparation.v1", input: { seasonId: 20262027, date, plannedAtUTC, groups: ["individual", "onIce"] },
    expiresAtUTC: iso(t0 + 14 * 60_000 + 30_000), pages });
  json("RUNTIME.json", runtimeFor(startedAtUTC, runtime));
  for (const [role, bytes] of srcs) write(`source-${role}.ts`, bytes);
  const sched = scheduleBody(date), body = Buffer.from(html);
  const ops = [["schedule", `https://api-web.nhle.com/v1/schedule/${date}`, 500], ["admission:individual", `${ORIGIN}/rest/v1/rpc/nst_admit_attempt_v1`, 700],
    ["nst:individual", pages[0].url, 1500], ["admission:onIce", `${ORIGIN}/rest/v1/rpc/nst_admit_attempt_v1`, 23_000], ["nst:onIce", pages[1].url, 24_000]];
  ops.forEach(([operation, url, offset], k) => {
    const n = k + 1, provider = !operation.startsWith("admission:");
    json(`operation-${n}-STARTED.json`, { operation, url, method: provider ? "GET" : "POST", startedAtUTC: iso(t0 + offset - 300) });
    const completedAtUTC = retrieved[n] ?? iso(t0 + offset);
    const bytes = operation === "schedule" ? sched : provider ? body : null;
    const facts = tls[n] === undefined ? tlsFor(url, n) : typeof tls[n] === "function" ? tls[n](tlsFor(url, n)) : tls[n];
    json(`operation-${n}-SETTLED.json`, { operation, completedAtUTC, permit: provider ? null : "allowed",
      transport: provider ? { httpStatus: 200, finalUrlMatchesRequested: true, redirected: false, decodedBytes: bytes.length } : null, tls: facts });
    if (provider) {
      const name = operation === "schedule" ? "schedule" : operation.slice(4), file = `${name}.${name === "schedule" ? "raw.json" : "parser-input.html"}`;
      write(file, bytes);
      json(`${name}.TRANSPORT-OBSERVATION.json`, { status: "candidate_requires_adapter_and_source_review", operation, file, sha256: sha(bytes), bytes: bytes.length,
        retrievedAtUTC: completedAtUTC, retainedAtUTC: completedAtUTC, httpStatus: 200, finalUrl: url, redirected: false, TLSVerified: null,
        tlsEvidence: "pending_runtime_review", representation: name === "schedule" ? "original_decoded_body" : "client_redacted_parser_input",
        sourceBindings: bindings, parsedRows: name === "schedule" ? null : 1,
        completedGameIds: name === "schedule" ? JSON.parse(sched).gameWeek[0].games.map(g => g.id) : null, tls: facts,
        originalPublicationUTC: null, modelDefinition: "unknown", independentlyAccepted: false, advancedAdmission: false, score: null });
    }
  });
  writeFileSync(join(dir, "MANIFEST.json"), enc({ state: "packet_complete_pending_review", retained: ["individual", "onIce"], operationCount: 5, lifecycleMode: "disabled",
    independentlyAccepted: false, advancedAdmission: false, score: null, files, completedAtUTC: iso(t0 + 25_000) }), { flag: "wx", mode: 0o600 });
}
