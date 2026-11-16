// REHEARSAL ONLY (dress-rehearsal.sh). Builds scratch inputs with the bridge's test fixtures, and runs the REAL gate under a
// labelled synthetic review. Never used on the day. Every output goes to the scratch path given on the command line.
// Every command names its candidate explicitly (v5 | v5-1118); nothing is inferred.
//   <candidate> inputs      <scratch>                                  request.json, context.json, packet-candidate/, attestation-*/OPERATOR-ATTESTATION.json
//   <candidate> harness-spec <scratch> <conversionDir> <outDir> <certDir> <specPath> [toolPath]   spec for tests/acquire-harness.mjs (loopback only)
//   <candidate> acquisition <scratch> <conversionDir> <outDir>         hand-built acquisition directory (custody limit: hand-written facts + real tool bytes)
//   <candidate> gate        <preparedDir> <proposal.json> <evaluatedAt> REAL gate, synthetic review filled in; prints coverage
// Leg B uses 2026-10-01: the only date with a real NST page and real stored rows retained offline. Times keep the real
// offsets from the source date: v5 = the next day (as the suite does); v5-1118 = +7 d 14 h 05 m, the 11-11 -> 11-18T14:05Z
// fallback slot, so the evaluation-date limit (source date + 7 days) binds exactly as it will on 2026-11-18.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APPROVED } from "../convert.mjs";
import { EXT, FALLBACK_BOOTSTRAP_SHA256, PREP, TOOL_PATH, WEB, fallbackSources, launchFor, makeAcquisitionDir, makePacket, runtimeFor, sha, successorSources, syntheticDay } from "../tests/fixtures.mjs";

export const DATE = "2026-10-01";
export const TIMES = {
  v5: { started: "2026-10-02T12:00:00.000Z", box: "2026-10-02T12:10:00.000Z", capture: "2026-10-02T12:30:00.000Z", eval: "2026-10-02T13:00:00.000Z" },
  "v5-1118": { started: "2026-10-08T14:05:00.000Z", box: "2026-10-08T14:20:00.000Z", capture: "2026-10-08T14:40:00.000Z", eval: "2026-10-08T20:00:00.000Z" },
};
const [CANDIDATE, cmd, ...args] = process.argv.slice(2);
if (!Object.hasOwn(TIMES, CANDIDATE ?? "")) { process.stdout.write(`${JSON.stringify({ ok: false, refusal: "candidate_unknown" })}\n`); process.exit(2); }
const T = TIMES[CANDIDATE];
const enc = v => Buffer.from(`${JSON.stringify(v, null, 2)}\n`);
const put = (path, value) => writeFileSync(path, Buffer.isBuffer(value) ? value : enc(value), { flag: "wx", mode: 0o600 });
const day = () => syntheticDay(DATE, { captureAtUTC: T.capture, boxscoreAtUTC: T.box });
const G3_STDOUT = readFileSync(join(PREP, "../blsh-pilot-readiness-2026-11-14/g1-canonical/G3-LOADED-912041a5.json"), "utf8").trim(); // a real G3 --loaded line
// Operator attestations are built from the REAL contract (RECHECK-11 C1): launcher-shaped input files, including the launcher's
// own log lines (json.dumps(obj, sort_keys=True), as nst-pilot-launcher*.py log()), then written by the operator lane's
// tools/operator-attestation.py `write`, never hand-assembled JSON.
const OP = join(PREP, "../blsh-pilot-operator-2026-11-15");
const OPERATOR = {
  v5: { name: "v5-1117", date: "2026-11-17", launcher: join(OP, "tools/nst-pilot-launcher.py"), baseline: join(OP, "evidence/DEPENDENCY-TREE-BASELINE.json") },
  "v5-1118": { name: "v5-1118", date: "2026-11-18", launcher: join(OP, "tools/nst-pilot-launcher-1118.py"), baseline: join(OP, "evidence/DEPENDENCY-TREE-BASELINE-1118.json") },
};
const ALLOW = ["DISABLE_V8_COMPILE_CACHE", "NEXT_PUBLIC_SUPABASE_URL", "NODE_PATH", "NST_KEY", "PATH", "SUPABASE_SERVICE_ROLE_KEY", "TMPDIR", "TS_NODE_COMPILER_OPTIONS"];
const PY = "/usr/bin/python3";
const pyDumps = objs => {
  const r = spawnSync("/usr/bin/env", ["-i", "PATH=/usr/bin:/bin", PY, "-I", "-c", "import json,sys\nfor o in json.load(sys.stdin): print(json.dumps(o, sort_keys=True))"],
    { input: JSON.stringify(objs), encoding: "utf8" });
  if (r.status !== 0) throw new Error(`py_dumps_failed: ${r.stderr}`);
  return r.stdout;
};
/** Write one attestation directory the way the day's RUNBOOK commands do, then run operator-attestation.py write on it. */
function operatorAttestation(dir, { t1Stdout = `${G3_STDOUT}\n`, shellCount = 0, g3Exit = 0, exec = {} } = {}) {
  const o = OPERATOR[CANDIDATE], d = o.date;
  mkdirSync(dir, { mode: 0o700 });
  const w = (name, text) => writeFileSync(join(dir, name), text, { flag: "wx", mode: 0o600 });
  const inputs = `${sha(readFileSync(join(OP, "tools/dependency-tree-hash.mjs")))}  ${join(OP, "tools/dependency-tree-hash.mjs")}\n${sha(readFileSync(o.baseline))}  ${o.baseline}\n`;
  for (const [phase, start, end, stdout] of [["T-0", "14:03:00", "14:03:01", `${G3_STDOUT}\n`], ["T+0", "14:07:00", "14:07:01", t1Stdout]]) {
    w(`g3-${phase}.stdout`, stdout); w(`g3-${phase}.exit`, "0\n"); w(`g3-${phase}.inputs-sha256`, inputs);
    w(`g3-${phase}.shell-start-utc`, `${d}T${start}Z\n`); w(`g3-${phase}.shell-end-utc`, `${d}T${end}Z\n`);
  }
  w("shell-dyld-devdir.count", `${shellCount}\n`);
  w("launcher.log", pyDumps([{ launcher: "g3", exitCode: g3Exit, stdout: G3_STDOUT },
    { launcher: "exec", atUTC: `${d}T14:05:00.412345Z`, launcherSHA256: sha(readFileSync(o.launcher)), cwd: "/Users/tim/Code/fhfhockey.com/web",
      argv0: "/usr/local/bin/node", envKeys: ALLOW, dyldKeysPresent: false, lifecycleKeyPresent: false, pythonIsolated: true,
      pythonExecutable: "/Library/Developer/CommandLineTools/usr/bin/python3", ...exec }]) + '{"state":"REHEARSAL capture output (not launcher)"}\n');
  w("capture.exit", "0\n"); w("capture.ended-utc", `${d}T14:06:10Z\n`);
  const r = spawnSync("/usr/bin/env", ["-i", "PATH=/usr/bin:/bin", PY, "-I", join(OP, "tools/operator-attestation.py"), "write", "--candidate", o.name, "--dir", dir], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`operator_attestation_write_failed: ${r.stdout}${r.stderr}`);
  return join(dir, "OPERATOR-ATTESTATION.json");
}

if (cmd === "inputs") {
  const [scratch] = args, d = day();
  put(join(scratch, "request.json"), d.request); put(join(scratch, "context.json"), d.context);
  // Candidate packet: REAL v5 runner/adapter/bootstrap bytes; TLS/RUNTIME facts hand-written (custody limit), as in test 3.
  const src = CANDIDATE === "v5-1118" ? fallbackSources(scratch) : successorSources(scratch);
  const real = runtimeFor(T.started);
  makePacket(join(scratch, "packet-candidate"), { date: DATE, startedAtUTC: T.started, bodies: { individual: readFileSync(EXT.nstCounts), onIce: d.onIcePage },
    scheduleBody: d.scheduleBody, sources: src, runtimeOver: { node: { ...real.node, execPathSHA256: APPROVED.nodeSHA256 }, launch: CANDIDATE === "v5-1118" ? launchFor(true, FALLBACK_BOOTSTRAP_SHA256) : launchFor(true),
      adapterEnvironmentPresence: { NST_KEY: true, SUPABASE_SERVICE_ROLE_KEY: true, NEXT_PUBLIC_SUPABASE_URL: true, NST_JOB_LIFECYCLE_ENABLED: false } } });
  // REHEARSAL attestations, each written by operator-attestation.py from launcher-shaped files (synthetic day files; real tools).
  const att = (name, opts) => operatorAttestation(join(scratch, `attestation-${name}`), opts);
  att("ok");
  att("bad-g3", { t1Stdout: `${G3_STDOUT.replace('"dependencyTree":"match"', '"dependencyTree":"differs"')}\n` }); // T+0 G3 not match
  att("bad-dyld", { shellCount: 1 });                                         // operator shell had a DYLD_/DEVELOPER_DIR key
  att("g3-wrapper-exit-1", { g3Exit: 1 });                                    // launcher's own G3 run failed
  att("stub-argv0", { exec: { argv0: "/tmp/stub-node" } });                   // C2: not the real node
  att("fake-cwd", { exec: { cwd: "/tmp/fake-web" } });                        // C2: not the canonical web/
  att("late-exec", { exec: { atUTC: `${OPERATOR[CANDIDATE].date}T14:05:50.000001Z` } }); // C2: outside the 14:05:00-14:05:50 window
  // The pre-RECHECK-11 fixture shape: g3Line as the RAW G3 line (not the launcher's wrapper). Must be refused.
  mkdirSync(join(scratch, "attestation-raw-g3line"), { mode: 0o700 });
  const okAtt = JSON.parse(readFileSync(join(scratch, "attestation-ok/OPERATOR-ATTESTATION.json"), "utf8"));
  put(join(scratch, "attestation-raw-g3line/OPERATOR-ATTESTATION.json"), { ...okAtt, launcher: { ...okAtt.launcher, g3Line: G3_STDOUT } });
  process.stdout.write(`${JSON.stringify({ ok: true, candidate: CANDIDATE, date: DATE, times: T, successorTree: src.state, wgoRows: d.counts.wgo, games: d.counts.games })}\n`);
} else if (cmd === "harness-spec") {
  const [, conversionDir, outDir, certDir, specPath, toolPath = TOOL_PATH] = args;
  put(specPath, { keyPath: join(certDir, "key.pem"), certPath: join(certDir, "cert.pem"), bodies: day().servedBodies, fault: null,
    toolPath, conversionDir, outDir, undiciFrom: join(WEB, "package.json") });
} else if (cmd === "acquisition") {
  const [, conversionDir, outDir] = args;
  makeAcquisitionDir(outDir, { boxscores: day().boxscores, startedAtUTC: T.box, conversionSHA256: sha(readFileSync(join(conversionDir, "CONVERSION.json"))) });
  process.stdout.write(`${JSON.stringify({ ok: true, outDir, label: "REHEARSAL hand-built acquisition (custody limit)" })}\n`);
} else if (cmd === "gate") {
  const [preparedDir, proposalPath, evaluatedAt] = args;
  const gate = createRequire(import.meta.url)(join(PREP, "closed_gate.cjs")).loadGate();
  const proposal = JSON.parse(readFileSync(proposalPath, "utf8"));
  const review = Buffer.from("SYNTHETIC REVIEW ARTIFACT FOR THE DRESS REHEARSAL ONLY; NOT A REVIEW\n");
  const artifacts = new Map(readdirSync(join(preparedDir, "artifacts")).map(n => [n, readFileSync(join(preparedDir, "artifacts", n))]));
  artifacts.set(sha(review), review);
  const filled = { ...proposal.acceptance, reviewSHA256: sha(review), requiredArtifactSHA256: [...proposal.acceptance.requiredArtifactSHA256, sha(review)] };
  const r = gate.createCurrentProcessEvidenceGate({ acceptances: [filled] })(readFileSync(join(preparedDir, "CURRENT-REQUEST.json")), evaluatedAt,
    readFileSync(join(preparedDir, "PROPOSED-BUNDLE.json")), artifacts);
  const closed = gate.createCurrentProcessEvidenceGate()(readFileSync(join(preparedDir, "CURRENT-REQUEST.json")), evaluatedAt, readFileSync(join(preparedDir, "PROPOSED-BUNDLE.json")), artifacts);
  process.stdout.write(`${JSON.stringify({ evaluatedAt, individualQualified: r.coverage.individualQualified, onIceQualified: r.coverage.onIceQualified,
    sourceObservationIndividualQualified: r.coverage.sourceObservationIndividualQualified, closedPolicyQualified: closed.coverage.individualQualified + closed.coverage.onIceQualified })}\n`);
} else { process.stdout.write(`${JSON.stringify({ ok: false, refusal: "unknown_command" })}\n`); process.exitCode = 2; }
