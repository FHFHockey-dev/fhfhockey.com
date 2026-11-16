// TEST-ONLY fixtures. Everything generated here is written to a scratch directory and labelled synthetic.
// Real bytes used read-only: NST 2026-10-01 pages, retained CURRENT-REQUEST (11-01), retained boxscore.
// No private names/IDs are written into the repository.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalNstUrl } from "../lib.mjs";

export const HERE = resolve(new URL(".", import.meta.url).pathname);
export const BRIDGE = resolve(HERE, "..");
export const REPO = resolve(BRIDGE, "../../..");
export const WEB = join(REPO, "web");
export const PREP = join(REPO, "tasks/artifacts/blsh-native-packet-preparation-2026-11-08"); // pinned in place (resolves siblings by its own path)
// Upstream inputs are VENDORED into approved/ (successor v4 + Chef's older rehearsal files), never read from live upstream
// folders, which other lanes overwrite. Every vendored and in-place pin is checked here, at import, before any test runs.
export const APPROVED_DIR = join(BRIDGE, "approved");
export const UPSTREAM_PINS = JSON.parse(readFileSync(join(APPROVED_DIR, "UPSTREAM-PINS.json"), "utf8"));
const pinSHA = b => createHash("sha256").update(b).digest("hex");
for (const v of UPSTREAM_PINS.vendored) if (pinSHA(readFileSync(join(APPROVED_DIR, v.file))) !== v.sha256) throw new Error(`vendored_upstream_drift:${v.file}`);
for (const v of UPSTREAM_PINS.pinnedInPlace) if (pinSHA(readFileSync(v.path.startsWith("/") ? v.path : join(REPO, v.path))) !== v.sha256) throw new Error(`upstream_pin_drift:${v.path}`);
export const CHEF_VERIFIER = join(APPROVED_DIR, "chef/verify-packet.mjs"); // pre-successor verifier (vetoes successor packets)
export const SUCCESSOR_PINS = join(APPROVED_DIR, "v5/expected-pins.json");   // the APPROVED candidate (v5)
export const SUCCESSOR_PATCH = join(APPROVED_DIR, "v5/SUCCESSOR.patch");
export const FALLBACK_PINS = join(APPROVED_DIR, "v5-1118/expected-pins.json");    // PARKED 11-18 fallback (explicit candidate "v5-1118")
export const FALLBACK_PATCH = join(APPROVED_DIR, "v5-1118/FALLBACK.patch");
export const FALLBACK_VERIFIER = join(APPROVED_DIR, "v5-1118/verify-packet.mjs");
export const FALLBACK_BOOTSTRAP_SHA256 = "849009ee3b68527858f93512c050ef5d0c01c20ef740c9e62addec4df21b4465";
export const V4_VERIFIER = join(APPROVED_DIR, "v4/verify-packet.mjs");          // superseded: refusal tests only
export const V4_PINS = join(APPROVED_DIR, "v4/expected-pins.json");
// Overridable so the suite follows the tree it runs on: after SUCCESSOR.patch is applied, point BRIDGE_PINS at the
// v5 pins (the live runner must match them). The successor's verifier (TLS + RUNTIME.json aware) is the default. Chef's
// older verifier vetoes every successor packet: its credential scan matches the presence key name
// SUPABASE_SERVICE_ROLE_KEY inside RUNTIME.json.
export const VERIFIER = process.env.BRIDGE_VERIFIER ?? join(APPROVED_DIR, "v5/verify-packet.mjs");
export const PINS = process.env.BRIDGE_PINS ?? join(APPROVED_DIR, "chef/expected-pins.json");
// The UNPATCHED runner (test 14) always runs from a `git archive` export of the base commit, never the live tree, so it
// uses Chef's vendored rehearse.ts, pins and clock whatever the live tree holds. BRIDGE_REHEARSE and
// BRIDGE_REHEARSAL_CLOCK are no longer read.
export const BASE_COMMIT = "a955107671ee7c1b2521891393a6bad6d95e9f89";
export const BASE_PINS = join(APPROVED_DIR, "chef/expected-pins.json");
export const BASE_REHEARSE = join(APPROVED_DIR, "chef/rehearse.ts");
export const BASE_REHEARSAL_CLOCK = "2026-11-08T01:00:00.000Z";
export const PREP_PINS = JSON.parse(readFileSync(join(PREP, "SOURCE-PINS.json"), "utf8"));
export const LINEAGE = PREP_PINS.lineage.path;
export const INTAKE = PREP_PINS.intake.path;
export const EXT = {
  nstCounts: "/Users/tim/Documents/Codex/2026-10-11/task-2/ingestion-reliability/nst-source-capture-v3/2026-10-01-allStrengthsCounts.html",
  nstRates: "/Users/tim/Documents/Codex/2026-10-11/task-2/ingestion-reliability/nst-source-capture-v3/2026-10-01-allStrengthsRates.html",
  nstPkOi: "/Users/tim/Documents/Codex/2026-10-11/task-2/ingestion-reliability/nst-source-capture-v3/2026-09-30-penaltyKillRatesOi.html",
  request: "/Users/tim/Documents/Codex/2026-10-27/task-3/current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json",
  boxBody: "/Users/tim/Documents/Codex/2026-10-27/task-3/source-vintage-20261101-01/live-02/057-2026020187-boxscore.body.json",
  boxReceipt: "/Users/tim/Documents/Codex/2026-10-27/task-3/source-vintage-20261101-01/live-02/057-2026020187-boxscore.receipt.json",
};
export const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
export const sha = b => createHash("sha256").update(b).digest("hex");
const enc = v => Buffer.from(`${JSON.stringify(v, null, 2)}\n`);
export const SYNTHETIC_ADAPTER = Buffer.from("// SYNTHETIC TEST ADAPTER: never real capture code. blsh-evidence-bridge tests only.\n");
const ROLE_PATHS = { runner: "scripts/blsh/nativeProcessCaptureRunner.ts", preparation: "scripts/blsh/nativeProcessCapturePreparation.ts",
  client: "lib/nst/client.ts", budget: "lib/nst/requestBudget.ts", admission: "lib/nst/sharedAdmission.ts",
  admissionOrigin: "lib/nst/admissionOrigin.ts", lifecycle: "lib/nst/jobLifecycle.server.ts", ratePolicy: "lib/cron/nstRateLimitPolicy.ts" };
export const NST_TEAM = { NJD: "N.J", SJS: "S.J", TBL: "T.B", LAK: "L.A" }; // NST's dotted codes

const iso = ms => new Date(ms).toISOString();

/** Plan object shaped exactly like prepareNativeProcessCapture's return (preparation :37-62). */
export function planFor(date, plannedAtUTC) {
  return { version: "fhfh.blsh.native-process-capture-preparation.v1",
    input: { seasonId: 20262027, date, plannedAtUTC, groups: ["individual", "onIce"] },
    expiresAtUTC: iso(Date.parse(plannedAtUTC) + 15 * 60_000),
    pages: ["individual", "onIce"].map(group => ({ group, url: canonicalNstUrl(date, group) })),
    futureExecution: { client: "web/lib/nst/client.ts:fetchNstTextByUrl", plannedProviderPages: 2, maxProviderAttempts: 2, concurrency: 1, retries: 0,
      timeoutMs: 15_000, deadlineMs: 120_000, maxAttempts: 2, plannedRequestCount: 2, minInterval: "NST_MIN_REQUEST_INTERVAL_MS", allowQueryKeyFallback: false,
      sharedControls: ["withNstRequestBudget", "admitSharedNstAttempt"], sharedAdmissionRPC: { maxCalls: null, deadlineBounded: true, mayWriteProductionLedger: true } },
    limits: { retainedParserInputBytesPerPage: 2097152, responseConsumptionBytes: null,
      note: "Retention is checked after text consumption. It does not bound downloaded bytes. The frozen client uses response.clone().text()." },
    executionAllowed: false, blockers: ["bounded_response_client_change_required", "shared_admission_write_authorization_required", "official_completed_date_review_required"],
    completionVerified: false, originalPublicationUTC: null, modelDefinition: "unknown",
    score: null, advancedAdmission: false, independentlyAccepted: false, productionAdopted: false };
}

export const NODE_TEST_SHA256 = sha(Buffer.from("SYNTHETIC NODE BINARY FOR BRIDGE TESTS"));
export const CA_TEST_SHA256 = sha(Buffer.from("SYNTHETIC ROOTS"));
export const CANDIDATE_BOOTSTRAP_SHA256 = "dbf69c474bedefd9c34fbd783d4beccc1840e8288fd2fa3435b5d89e8521bb46"; // v5
/** TEST-ONLY pins for synthetic packets built from the LIVE tree: Chef's pins (live runner) + the v4 bootstrap hash
 * the v4 verifier requires in RUNTIME.launch. Never the approved pins; synthetic mode only. */
export function makeTestPins(scratch, pinsPath = PINS, name = "test-pins.json") {
  const pins = JSON.parse(readFileSync(pinsPath, "utf8"));
  pins._bootstrapSHA256 = CANDIDATE_BOOTSTRAP_SHA256; pins._source = "TEST ONLY: tree pins + v5 bootstrap hash";
  const path = join(scratch, name); writeFileSync(path, enc(pins), { mode: 0o600 }); return path;
}
/** SYNTHETIC tls facts in the successor's final shape (HANDOFF §2). Not an observation. */
export const tlsFor = (url, connectionSequence = 1, over = {}) => ({ channel: "undici:client:sendHeaders", authorized: true, authorizationError: null,
  servername: new URL(url).hostname, alpnProtocol: "http/1.1", protocol: "TLSv1.3",
  cipher: { name: "TLS_AES_128_GCM_SHA256", standardName: "TLS_AES_128_GCM_SHA256", version: "TLSv1.3" },
  sessionReused: false, connectionReused: false, connectionSequence, resumedFromOperation: null, connectionFromOperation: null,
  peerCertificate: { fingerprint256: Array(32).fill("AB").join(":"), valid_from: "SYNTHETIC", valid_to: "SYNTHETIC", subjectCN: "synthetic.test", issuerCNChain: ["SYNTHETIC TEST CA"] },
  defaultCACertificatesSHA256: CA_TEST_SHA256, globalDispatcher: { present: true, constructorName: "Agent", identityUnchanged: true }, ...over });
/** v4 launch block. `byBootstrap` = what a real bootstrap launch records; false = a harness launch (synthetic). */
export const launchFor = (byBootstrap, bootstrapSHA256 = CANDIDATE_BOOTSTRAP_SHA256) => {
  const bootstrapPath = `${WEB}/scripts/blsh/nativeProcessCaptureBootstrap.ts`;
  const env = Object.fromEntries(["NODE_PATH", "DISABLE_V8_COMPILE_CACHE", "TS_NODE_COMPILER_OPTIONS", "OPENSSL_CONF", "TS_NODE_PROJECT", "TS_NODE_SKIP_PROJECT",
    "TS_NODE_COMPILER", "TS_NODE_TRANSPILE_ONLY", "TS_NODE_REQUIRE", "TS_NODE_CWD", "TS_NODE_DIR", "TS_NODE_COMPILER_HOST", "TS_NODE_EMIT", "TS_NODE_SCOPE",
    "TS_NODE_SCOPE_DIR", "TS_NODE_SWC", "TS_NODE_TRANSPILER"].map(k => [k, ["NODE_PATH", "DISABLE_V8_COMPILE_CACHE", "TS_NODE_COMPILER_OPTIONS"].includes(k)]));
  return { entryScript: byBootstrap ? bootstrapPath : `${HERE}harness.ts`, entryScriptSHA256: byBootstrap ? bootstrapSHA256 : sha(Buffer.from("HARNESS")),
    cwd: WEB, bootstrapPath, bootstrapSHA256, entryIsBootstrap: byBootstrap, environmentPresence: env, otherTsNodeKeysPresent: [] };
};
/** SYNTHETIC RUNTIME.json in the successor's v4 shape (HANDOFF §3). */
export const runtimeFor = (startedAtUTC, over = {}) => ({ version: "fhfh.blsh.native-capture-runtime.v1", startedAtUTC,
  node: { version: process.version, execPath: "/usr/local/bin/node", execPathSHA256: NODE_TEST_SHA256, execArgv: ["--require", "./node_modules/ts-node/register/transpile-only"] },
  tls: { rootCertificatesSHA256: CA_TEST_SHA256, rootCertificateCount: 116, defaultCACertificatesSHA256: CA_TEST_SHA256, defaultCACertificateCount: 116 },
  environmentPresence: Object.fromEntries(["NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_OPTIONS", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY",
    "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "all_proxy", "no_proxy"].map(k => [k, false])),
  supabaseOrigin: ORIGIN, lifecycleMode: "disabled",
  adapterEnvironmentPresence: { NST_KEY: false, SUPABASE_SERVICE_ROLE_KEY: false, NEXT_PUBLIC_SUPABASE_URL: false, NST_JOB_LIFECYCLE_ENABLED: false },
  launch: launchFor(false),
  globalDispatcher: { present: true, constructorName: "Agent", sameAsRunnerLoad: true },
  valuesRecorded: false, ...over }); // exact successor key set: extra keys (e.g. a synthetic marker) are refused

/** Write a packet in the runner's on-disk format (nativeProcessCaptureRunner.ts :153-305). SYNTHETIC adapter. */
export function makePacket(dir, { date, startedAtUTC, bodies, scheduleBody, tls = true, tlsOver = {}, runtime = true, edit = {}, sources: override = {}, runtimeOver = {} }) {
  mkdirSync(dir, { mode: 0o700 });
  const files = [];
  const write = (name, bytes) => { writeFileSync(join(dir, name), bytes, { flag: "wx", mode: 0o600 }); files.push({ file: name, bytes: bytes.length, sha256: sha(bytes) }); };
  const json = (name, value) => write(name, enc(edit[name] ? edit[name](value) : value));
  const t0 = Date.parse(startedAtUTC);
  const sources = Object.entries(ROLE_PATHS).map(([role, p]) => [role, override[role] ?? readFileSync(join(WEB, p))]).concat([["adapter", override.adapter ?? SYNTHETIC_ADAPTER]]);
  const bindings = sources.map(([role, bytes]) => ({ role, file: `source-${role}.ts`, sha256: sha(bytes), bytes: bytes.length }));
  json("STARTED.json", { version: "fhfh.blsh.native-capture-run.v1", startedAtUTC, supabaseOrigin: ORIGIN, lifecycleMode: "disabled", sourceBindings: bindings });
  const plan = planFor(date, iso(t0 - 60_000));
  json("PLAN.json", plan);
  if (runtime) json("RUNTIME.json", runtimeFor(startedAtUTC, runtimeOver));
  for (const [role, bytes] of sources) write(`source-${role}.ts`, bytes);
  const ops = [["schedule", `https://api-web.nhle.com/v1/schedule/${date}`, 500], ["admission:individual", `${ORIGIN}/rest/v1/rpc/nst_admit_attempt_v1`, 700],
    ["nst:individual", plan.pages[0].url, 1500], ["admission:onIce", `${ORIGIN}/rest/v1/rpc/nst_admit_attempt_v1`, 23_000], ["nst:onIce", plan.pages[1].url, 24_000]];
  let n = 0;
  for (const [operation, url, offset] of ops) {
    n++;
    const provider = !operation.startsWith("admission:");
    json(`operation-${n}-STARTED.json`, { operation, url, method: provider ? "GET" : "POST", startedAtUTC: iso(t0 + offset - 300) });
    const completedAtUTC = iso(t0 + offset);
    const bytes = operation === "schedule" ? scheduleBody : provider ? bodies[operation.slice(4)] : null;
    const transport = provider ? { httpStatus: 200, finalUrlMatchesRequested: true, redirected: false, decodedBytes: bytes.length } : null;
    const facts = tls ? tlsFor(url, n, tlsOver[n] ?? {}) : null;
    json(`operation-${n}-SETTLED.json`, { operation, completedAtUTC, permit: provider ? null : "allowed", transport, ...(tls ? { tls: facts } : {}) });
    if (provider) {
      const name = operation === "schedule" ? "schedule" : operation.slice(4), file = `${name}.${name === "schedule" ? "raw.json" : "parser-input.html"}`;
      write(file, bytes);
      const games = name === "schedule" ? JSON.parse(bytes).gameWeek.find(d => d.date === date).games.map(g => g.id).sort((a, b) => a - b) : null;
      json(`${name}.TRANSPORT-OBSERVATION.json`, { status: "candidate_requires_adapter_and_source_review", operation, file, sha256: sha(bytes), bytes: bytes.length,
        retrievedAtUTC: completedAtUTC, retainedAtUTC: iso(t0 + offset + 5), httpStatus: 200, finalUrl: url, redirected: false, TLSVerified: null,
        tlsEvidence: "pending_runtime_review", representation: name === "schedule" ? "original_decoded_body" : "client_redacted_parser_input",
        sourceBindings: bindings, parsedRows: name === "schedule" ? null : 1, completedGameIds: games, ...(tls ? { tls: facts } : {}),
        originalPublicationUTC: null, modelDefinition: "unknown", independentlyAccepted: false, advancedAdmission: false, score: null });
    }
  }
  const manifest = { state: "packet_complete_pending_review", retained: ["individual", "onIce"], operationCount: 5, lifecycleMode: "disabled",
    independentlyAccepted: false, advancedAdmission: false, score: null, files, completedAtUTC: iso(t0 + 25_000) };
  writeFileSync(join(dir, "MANIFEST.json"), enc(manifest), { flag: "wx", mode: 0o600 });
  return { startedAtUTC, bindings, plan };
}

/** Re-seal a packet after an edit: recompute MANIFEST file hashes (simulates a coherent forgery). */
export function reseal(dir) {
  const path = join(dir, "MANIFEST.json"), manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.files = readdirSync(dir).filter(n => n !== "MANIFEST.json").sort().map(file => { const b = readFileSync(join(dir, file)); return { file, bytes: b.length, sha256: sha(b) }; });
  chmodSync(path, 0o600); writeFileSync(path, enc(manifest), { mode: 0o600 });
}
export function editJson(dir, name, fn) { const p = join(dir, name); chmodSync(p, 0o600); writeFileSync(p, enc(fn(JSON.parse(readFileSync(p, "utf8"))))); }

/** Export base-commit paths into `dir` with `git archive` (read-only: nothing in the checkout changes; GIT_* unset). */
export function exportBase(dir, paths) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  const a = spawnSync("git", ["-C", REPO, "archive", "--format=tar", BASE_COMMIT, ...paths], { env, maxBuffer: 64 * 1024 * 1024 });
  if (a.status !== 0) throw new Error(`base_export_failed: ${a.stderr}`);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const x = spawnSync("tar", ["-x", "-f", "-", "-C", dir], { input: a.stdout });
  if (x.status !== 0) throw new Error(`base_export_failed: ${x.stderr}`);
  return dir;
}
const V5_ROLE_FILES = { runner: "nativeProcessCaptureRunner.ts", adapter: "nativeProcessCaptureAdapter.ts", preparation: "nativeProcessCapturePreparation.ts",
  bootstrap: "nativeProcessCaptureBootstrap.ts" };
// --dry-run writes nothing; -f never asks (and never assumes a reversed patch), so a mismatch is a plain failure.
const patchRun = (root, ...flags) => spawnSync("patch", ["-p1", "-s", "-f", ...flags, "-d", root, "-i", SUCCESSOR_PATCH], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
/** REAL successor runner/adapter bytes. Copy `from` (default: the live web/scripts/blsh) into scratch, then by state:
 *  - base (SUCCESSOR.patch applies forward, not in reverse): apply it there with plain `patch`;
 *  - already v5 (applies in reverse only): skip the apply;
 *  - anything else: refuse (successor_tree_unrecognised).
 * Either way the runner/adapter/preparation/bootstrap must then equal the v5 pins (successor_tree_role_mismatch).
 * Nothing in the checkout is touched. Used to build a packet under the APPROVED pins. */
export function successorSources(scratch, { from = join(WEB, "scripts/blsh"), name = "successor-tree" } = {}) {
  const root = join(scratch, name), blsh = join(root, "web/scripts/blsh");
  let state;
  if (!existsSync(root)) {
    mkdirSync(join(root, "web/scripts"), { recursive: true });
    cpSync(from, blsh, { recursive: true });
    const forward = patchRun(root, "--dry-run").status === 0, reverse = patchRun(root, "-R", "--dry-run").status === 0;
    if (forward && !reverse) {
      const r = patchRun(root);
      if (r.status !== 0) throw new Error(`successor_patch_failed: ${r.stdout}${r.stderr}`);
      state = "patched_in_scratch";
    } else if (reverse && !forward) state = "already_v5";
    else throw new Error(`successor_tree_unrecognised: forward=${forward} reverse=${reverse}`);
    const pins = JSON.parse(readFileSync(SUCCESSOR_PINS, "utf8")), want = { ...pins, bootstrap: pins._bootstrapSHA256 };
    for (const [role, file] of Object.entries(V5_ROLE_FILES)) if (sha(readFileSync(join(blsh, file))) !== want[role]) throw new Error(`successor_tree_role_mismatch:${role}`);
    writeFileSync(join(root, "STATE"), state);
    // A runnable scratch web root: the v5 scripts plus read-only symlinks to lib and node_modules.
    symlinkSync(join(WEB, "lib"), join(root, "web/lib")); symlinkSync(join(WEB, "node_modules"), join(root, "web/node_modules"));
  }
  return { runner: readFileSync(join(blsh, V5_ROLE_FILES.runner)), adapter: readFileSync(join(blsh, V5_ROLE_FILES.adapter)),
    bootstrap: readFileSync(join(blsh, V5_ROLE_FILES.bootstrap)), webRoot: join(root, "web"), state: readFileSync(join(root, "STATE"), "utf8") };
}

/** REAL fallback (v5-1118) bytes: the v5 scratch tree from successorSources() plus FALLBACK.patch, applied in scratch only.
 * Only the bootstrap changes; it must equal the fallback pins' _bootstrapSHA256. */
export function fallbackSources(scratch) {
  const v5 = successorSources(scratch), root = join(scratch, "fallback-tree"), blsh = join(root, "web/scripts/blsh");
  if (!existsSync(root)) {
    mkdirSync(join(root, "web/scripts"), { recursive: true });
    cpSync(join(scratch, "successor-tree/web/scripts/blsh"), blsh, { recursive: true });
    const r = spawnSync("patch", ["-p1", "-s", "-f", "-d", root, "-i", FALLBACK_PATCH], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (r.status !== 0) throw new Error(`fallback_patch_failed: ${r.stdout}${r.stderr}`);
    const pins = JSON.parse(readFileSync(FALLBACK_PINS, "utf8"));
    if (sha(readFileSync(join(blsh, V5_ROLE_FILES.bootstrap))) !== pins._bootstrapSHA256 || pins._bootstrapSHA256 !== FALLBACK_BOOTSTRAP_SHA256) throw new Error("fallback_tree_role_mismatch:bootstrap");
    for (const role of ["runner", "adapter", "preparation"]) if (sha(readFileSync(join(blsh, V5_ROLE_FILES[role]))) !== pins[role]) throw new Error(`fallback_tree_role_mismatch:${role}`);
  }
  return { ...v5, bootstrap: readFileSync(join(blsh, V5_ROLE_FILES.bootstrap)), state: "fallback_patched_in_scratch" };
}

/** Acquisition fixtures in the exact shape acquire-boxscores.mjs writes and frames.mjs verifies. The tool source bytes are
 * the REAL tool; the launch block is the canonical one; node is the APPROVED pin. Facts are hand-written (custody limit). */
export const TOOL_PATH = join(BRIDGE, "acquire-boxscores.mjs");
export const APPROVED_NODE_SHA256 = "daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef";
export const V4_ADAPTER_SHA256 = "aa6237bdb8d977cbd21f3ed769d9f5c7f9028e23a921965f41e278e021947be0";
export const fixedAcqPath = date => `/Users/tim/Library/Application Support/fhfh-blsh-boxscores-${date.replaceAll("-", "")}`;
/** The real tool with its final byte changed (same length): a tool that is NOT on APPROVED_ACQUISITION_TOOLS. Bound with
 * consistent runtime/launch hashes, it keeps the "unreviewed tool" refusal covered now that the list holds the real tool. */
export const UNREVIEWED_TOOL_BYTES = (() => {
  const b = Buffer.from(readFileSync(TOOL_PATH));
  if (b[b.length - 1] !== 0x0a) throw new Error("tool_last_byte_not_newline");
  b[b.length - 1] = 0x20; return b;
})();
export const acquisitionRuntimeFor = (startedAtUTC, { conversionSHA256 = "0".repeat(64), nodeSHA256 = APPROVED_NODE_SHA256, date = "2026-10-01", over = {}, toolBytes = readFileSync(TOOL_PATH) } = {}) => {
  const { supabaseOrigin, lifecycleMode, adapterEnvironmentPresence, launch, globalDispatcher, ...core } = runtimeFor(startedAtUTC);
  const tool = sha(toolBytes);
  const noLaunchKeys = Object.fromEntries(Object.keys(launchFor(true).environmentPresence).map(k => [k, false]));
  return { ...core, version: "fhfh.blsh.official-acquisition-runtime.v2", toolSHA256: tool, conversionSHA256, outputDirectory: fixedAcqPath(date),
    node: { ...core.node, execPathSHA256: nodeSHA256, execArgv: [] },
    launch: { entryScript: TOOL_PATH, entryScriptSHA256: tool, cwd: WEB, environmentPresence: noLaunchKeys, otherTsNodeKeysPresent: [] },
    globalDispatcherAtStart: "unset", ...over };
};
/** Write a COMPLETED acquisition directory (0700/0600, manifest last) for the given scheduled boxscores. */
export function makeAcquisitionDir(dir, { boxscores, startedAtUTC, conversionSHA256, runtimeOver = {}, nodeSHA256, toolBytes = readFileSync(TOOL_PATH) } = {}) {
  mkdirSync(dir, { mode: 0o700 });
  const w = (name, bytes) => writeFileSync(join(dir, name), bytes, { flag: "wx", mode: 0o600 });
  const date = JSON.parse(boxscores[0].bodyBytes).gameDate;
  w("ACQUISITION-RUNTIME.json", enc(acquisitionRuntimeFor(startedAtUTC, { conversionSHA256, nodeSHA256, date, over: runtimeOver, toolBytes })));
  w("source-tool.mjs", toolBytes);
  const sorted = [...boxscores].map(b => ({ ...b, id: JSON.parse(b.bodyBytes).id })).sort((x, y) => x.id - y.id);
  sorted.forEach((b, k) => {
    const receipt = JSON.parse(b.receiptBytes);
    w(`operation-${k + 1}-STARTED.json`, enc({ operation: k + 1, url: receipt.url, method: "GET", startedAtUTC }));
    w(`boxscore-${b.id}.body.json`, b.bodyBytes);
    w(`boxscore-${b.id}.receipt.json`, enc({ ...receipt, operation: k + 1, acquisitionStartedAtUTC: startedAtUTC }));
  });
  resealAcquisition(dir);
  return dir;
}
export function resealAcquisition(dir) {
  const p = join(dir, "MANIFEST.json");
  const files = readdirSync(dir).filter(n => n !== "MANIFEST.json").sort().map(file => { const b = readFileSync(join(dir, file)); return { file, bytes: b.length, sha256: sha(b) }; });
  try { chmodSync(p, 0o600); } catch { /* new */ }
  writeFileSync(p, enc({ status: "acquisition_complete_pending_review", requests: files.filter(f => f.file.endsWith(".receipt.json")).length, retries: 0, files }), { mode: 0o600 });
}

/** Acquisition receipts keep the 14-key tls (their dispatcher facts are receipt-level fields). */
export const acqTls = (url, op) => { const { globalDispatcher, ...t } = tlsFor(url, op); return t; };
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const teamsByGame = rows => { const m = new Map(); for (const r of rows) { const s = m.get(r.game_id) ?? new Set(); s.add(r.team_abbrev); m.set(r.game_id, s); } return m; };

/** SYNTHETIC request/context/schedule/on-ice page/boxscores for ONE date, from REAL retained stored rows.
 * Only clocks are re-stamped (to make a coherent timeline); stored values stay real. Scratch only. */
export function syntheticDay(date, { captureAtUTC, boxscoreAtUTC, acquisitionStartedAtUTC = boxscoreAtUTC }) {
  const real = JSON.parse(readFileSync(EXT.request, "utf8"));
  const pick = (rows, key) => rows.filter(r => r[key] === date);
  const wgo = pick(real.wgo.rows, "date"), ind = pick(real.individual.rows, "date_scraped"), oi = pick(real.onIce.rows, "date_scraped");
  const cal = real.calendar.rows.filter(r => r.date === date).sort((a, b) => a.id - b.id);
  const feed = (name, rows, process) => ({ capture: { ...real[name].capture, retrievedAtUTC: captureAtUTC }, rows, ...(process ? { strengthScope: "unknown", dateMeaning: "unknown", toiUnit: "unknown" } : {}) });
  const request = { seasonId: 20262027, eventThroughDate: date, asOfUTC: captureAtUTC, freshnessPolicy: real.freshnessPolicy,
    calendar: feed("calendar", cal), wgo: feed("wgo", wgo), individual: feed("individual", ind, true), onIce: feed("onIce", oi, true) };
  const context = { profiles: wgo.map(r => ({ playerId: r.player_id, name: r.player_name, sourceIds: [r.id], shots: r.counts.shots })) };
  const teams = teamsByGame(wgo);
  const games = cal.map((g, i) => { const [home, away] = [...teams.get(g.id)].sort(); return { id: g.id, season: 20262027, gameType: 2, gameState: "OFF", gameScheduleState: "OK",
    homeTeam: { id: 2 * i + 1, abbrev: home }, awayTeam: { id: 2 * i + 2, abbrev: away } }; });
  const scheduleBody = Buffer.from(JSON.stringify({ gameWeek: [{ date, games }] }));
  // On-ice page: SYNTHETIC markup (no real all-strength on-ice counts page was retained), values from stored rows.
  const byPlayer = new Map(oi.map(r => [r.player_id, r]));
  const head = ["", "Player", "Team", "Position", "GP", "TOI", "CF", "CA", "xGF", "xGA"];
  const body = wgo.map((w, i) => { const r = byPlayer.get(w.player_id); return `<tr><td>${i + 1}</td><td class="lh"><a href="playerreport.php?fromseason=20262027&amp;thruseason=20262027&amp;playerid=${w.player_id}&amp;sit=all&amp;stype=2">P${i}</a></td><td>${NST_TEAM[w.team_abbrev] ?? w.team_abbrev}</td><td>F</td><td>${r.gp}</td><td>${(r.toi / 60).toFixed(12)}</td><td>0</td><td>0</td><td>${r.xgf}</td><td>${r.xga}</td></tr>`; }).join("\n");
  const onIcePage = Buffer.from(`<!-- SYNTHETIC on-ice page for bridge tests -->\n<table><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>\n${body}\n</tbody></table>\n`);
  const boxscores = games.map(g => {
    const side = abbrev => ({ forwards: wgo.filter(w => w.game_id === g.id && w.team_abbrev === abbrev).map(w => ({ playerId: w.player_id, position: "C", toi: mmss(w.toi_per_game) })), defense: [], goalies: [] });
    const b = Buffer.from(JSON.stringify({ id: g.id, season: 20262027, gameType: 2, gameDate: date, gameState: "OFF", gameScheduleState: "OK",
      awayTeam: { abbrev: g.awayTeam.abbrev }, homeTeam: { abbrev: g.homeTeam.abbrev }, playerByGameStats: { awayTeam: side(g.awayTeam.abbrev), homeTeam: side(g.homeTeam.abbrev) } }));
    const url = `https://api-web.nhle.com/v1/gamecenter/${g.id}/boxscore`, op = games.indexOf(g) + 1;
    const receipt = Buffer.from(JSON.stringify({ version: "fhfh.blsh.official-boxscore-receipt.v3", operation: op, url, finalUrl: url, httpStatus: 200, redirected: false,
      retrievedAtUTC: boxscoreAtUTC, sha256: sha(b), bytes: b.length, tls: acqTls(url, op), sendHeadersEvents: 1, globalDispatcher: "unchanged", acquisitionStartedAtUTC }));
    return { bodyBytes: b, receiptBytes: receipt };
  });
  const acquisitionRuntimeBytes = Buffer.from(JSON.stringify(acquisitionRuntimeFor(acquisitionStartedAtUTC)));
  const servedBodies = Object.fromEntries(boxscores.map(b => [JSON.parse(b.bodyBytes).id, b.bodyBytes.toString("utf8")]));
  return { request, context, scheduleBody, onIcePage, boxscores, acquisitionRuntimeBytes, servedBodies, counts: { wgo: wgo.length, games: games.length, dottedTeamRows: wgo.filter(w => NST_TEAM[w.team_abbrev]).length } };
}
