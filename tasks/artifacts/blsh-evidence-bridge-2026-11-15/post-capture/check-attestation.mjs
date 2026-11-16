// Post-capture gate 2: check the operator attestation BEFORE any conversion (RUNTIME-RECEIPT-PLAN §3c, RECHECK-7).
// Offline and read-only. Imports only node: builtins. Schema: fhfh.blsh.operator-attestation.v1, as WRITTEN by the operator
// lane's tools/operator-attestation.py (`write`) from the launcher's real log (tools/nst-pilot-launcher*.py `log()`):
//   launcher.g3Line   = the launcher's wrapper line {"exitCode":…,"launcher":"g3","stdout":"<G3 --loaded JSON line>"}
//   launcher.execLine = {"argv0","atUTC","cwd","dyldKeysPresent","envKeys","launcher":"exec","launcherSHA256",
//                        "lifecycleKeyPresent","pythonExecutable","pythonIsolated"}
// Standing: custody. G3 and the DYLD check ran outside the capture process. POST-CAPTURE step 2b also runs the operator's own
// `operator-attestation.py check`; both must accept.
// Usage: node check-attestation.mjs --candidate v5|v5-1118 --attestation <OPERATOR-ATTESTATION.json> --packet <packet dir>
// The candidate is always explicit and must match the attestation's own `candidate` (v5 -> v5-1117, v5-1118 -> v5-1118).
// Exit 0 = {"ok":true,...}; exit 2 = {"ok":false,"refusal":...}. A refusal quarantines the packet: no conversion.
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { sep } from "node:path";

export const G3_TOOL_SHA256 = "912041a513f0dabf034797d6c4d93fcb2a22ded6d2019f44463ce82f56103bf4";
export const G3_TREE_SHA256 = "76c7d466725ea13208b87adfb5ac6688a42454b66382996fbd9a7ab36432473a"; // unchanged by the fallback
export const EXEC_ARGV0 = "/usr/local/bin/node";
export const EXEC_CWD = "/Users/tim/Code/fhfhockey.com/web";
/** Per bridge candidate: the operator's candidate name, launcher and G3 baseline hashes and slot date
 * (operator-attestation.py CANDIDATES; launcher-1118 and baseline-1118 built by the operator lane). */
export const OPERATOR_PINS = Object.freeze({
  v5: Object.freeze({ operatorCandidate: "v5-1117", date: "2026-11-17",
    g3BaselineSHA256: "4534fd65c30d7c6e86ac84fd0664074074c039980ba207d5f5928277a52c1bb3",
    launcherSHA256: "31c370c3110ddb5d4cf90e730e9650639e36bd442959f7a7c791bbc28926197b" }),   // tools/nst-pilot-launcher.py
  "v5-1118": Object.freeze({ operatorCandidate: "v5-1118", date: "2026-11-18",
    g3BaselineSHA256: "e9c7ec5a8afc627c231331a7c7ace6488064ee414244947a078325b7a4ccd7e9",   // evidence/DEPENDENCY-TREE-BASELINE-1118.json
    launcherSHA256: "2670353dff80d47a642fd657cfa22449a703acdbc6068a33971692f2621cd444" }),  // tools/nst-pilot-launcher-1118.py
});
const LOADED = { files: 256, roles: 9, bootstrap: 1, packageFiles: 245, packages: 34, builtins: 15 };

class Refusal extends Error { constructor(code) { super(code); this.code = code; } }
const need = (ok, code) => { if (!ok) throw new Refusal(code); };
const sha = b => createHash("sha256").update(b).digest("hex");
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const emptyList = v => Array.isArray(v) && v.length === 0;

/** §3c "Required": one G3 --loaded JSON line, match, pinned tree, no DYLD keys, the full loaded census. */
function g3LineMatches(text, code) {
  const lines = String(text ?? "").trim().split("\n");
  need(lines.length === 1 && lines[0] !== "", `${code}_not_one_line`);
  let g; try { g = JSON.parse(lines[0]); } catch { need(false, `${code}_unparsed`); }
  need(g.dependencyTree === "match" && g.treeSHA256 === G3_TREE_SHA256 && g.baselineTreeSHA256 === G3_TREE_SHA256 &&
    g.checkerTypeScript === "verified_before_load" && g.dyldKeysPresent === false && emptyList(g.differences), `${code}_not_match`);
  need(isObj(g.loaded) && emptyList(g.loaded.uncovered) && Object.entries(LOADED).every(([k, v]) => g.loaded[k] === v), `${code}_loaded_census`);
}

/** One operator G3 run (T−0 or T+0): exit 0, stdout hash, the verbatim line, shell times. */
function checkG3Run(run, label) {
  need(isObj(run) && run.exitCode === 0 && typeof run.stdout === "string", `g3_${label}_not_exit_0`);
  need(sha(Buffer.from(run.stdout)) === run.stdoutSHA256, `g3_${label}_stdout_hash_mismatch`);
  g3LineMatches(run.stdout, `g3_${label}`);
  need(typeof run.shellStartUTC === "string" && typeof run.shellEndUTC === "string" && run.shellStartUTC <= run.shellEndUTC, `g3_${label}_times`);
  return run;
}

/** `expect` is a TEST SEAM only (as operator-attestation.py check(expect=…)): the operator's dress rehearsal records a stub
 * node and a fake web/. The CLI never passes it, so on the day argv0 and cwd are always the real ones. */
export function checkAttestation({ attestationPath, packetDir, candidate, expect = { argv0: EXEC_ARGV0, cwd: EXEC_CWD } }) {
  need(typeof attestationPath === "string" && typeof packetDir === "string", "usage_attestation_and_packet_required");
  need(typeof candidate === "string" && Object.hasOwn(OPERATOR_PINS, candidate), "candidate_unknown");
  const pin = OPERATOR_PINS[candidate];
  const packetReal = realpathSync(packetDir), attReal = realpathSync(attestationPath);
  need(!attReal.startsWith(packetReal + sep), "attestation_inside_capture_output"); // §3c: never in the capture output directory
  const bytes = readFileSync(attReal);
  need(bytes.length <= 1024 * 1024, "attestation_oversized");
  let a; try { a = JSON.parse(bytes); } catch { need(false, "attestation_unparsed"); }
  need(isObj(a) && a.version === "fhfh.blsh.operator-attestation.v1", "attestation_version");
  need(a.candidate === pin.operatorCandidate, "attestation_candidate_mismatch");
  // The two fields RECHECK-7 names, strictly.
  need(isObj(a.g3) && a.g3.bothMatch === true, "g3_both_match_not_true");
  need(isObj(a.launcher) && a.launcher.dyldKeysPresent === false, "launcher_dyld_keys_present_not_false");
  // Re-derive bothMatch from the verbatim runs rather than trusting the flag alone.
  need(isObj(a.g3.tool) && a.g3.tool.sha256 === G3_TOOL_SHA256, "g3_tool_not_pinned");
  need(isObj(a.g3.baseline) && a.g3.baseline.sha256 === pin.g3BaselineSHA256, "g3_baseline_not_pinned");
  const tMinus = checkG3Run(a.g3.tMinus0, "tMinus0"), tPlus = checkG3Run(a.g3.tPlus0, "tPlus0");
  need(tMinus.shellEndUTC <= tPlus.shellStartUTC, "g3_runs_out_of_order");
  const l = a.launcher;
  need(l.sha256 === pin.launcherSHA256, "launcher_not_pinned");
  need(emptyList(l.dyldKeysInEnvFile) && emptyList(l.dyldKeysInLauncherEnv) && l.operatorShellDyldCount === 0, "launcher_dyld_evidence");
  need(l.refuseLine === null || l.refuseLine === undefined, "launcher_refused");
  // The exec line, bound to the real capture (RECHECK-11 C2): real node, canonical web/, inside the slot's exec window.
  let exec; try { exec = JSON.parse(l.execLine); } catch { need(false, "launcher_exec_line_unparsed"); }
  need(exec?.launcher === "exec" && exec.dyldKeysPresent === false && exec.lifecycleKeyPresent === false && exec.launcherSHA256 === pin.launcherSHA256, "launcher_exec_line");
  need(exec.argv0 === expect.argv0, "launcher_argv0_not_real_node");
  need(exec.cwd === expect.cwd, "launcher_cwd_not_canonical_web");
  const at = typeof exec.atUTC === "string" ? exec.atUTC : "";
  need(at.startsWith(`${pin.date}T14:05:`) && at.slice(10, 19) >= "T14:05:00" && at.slice(10, 19) < "T14:05:50" &&
    Number.isFinite(Date.parse(at)), `launcher_exec_time_outside_${pin.date}_window`);
  // The launcher's G3 line is a WRAPPER (RECHECK-11 C1): {"launcher":"g3","exitCode":0,"stdout":"<G3 line>"}.
  let w; try { w = JSON.parse(l.g3Line); } catch { need(false, "launcher_g3_line_unparsed"); }
  need(isObj(w) && w.launcher === "g3" && w.exitCode === 0 && typeof w.stdout === "string", "launcher_g3_line_not_wrapper_exit_0");
  g3LineMatches(w.stdout, "launcher_g3_line");
  need(isObj(a.capture) && a.capture.exitCode === 0, "capture_exit_not_0");
  return { ok: true, candidate, operatorCandidate: pin.operatorCandidate, version: a.version, g3BothMatch: true, launcherDyldKeysPresent: false,
    execAtUTC: at, tMinus0: tMinus.shellStartUTC, tPlus0: tPlus.shellStartUTC, attestationSHA256: sha(bytes),
    standing: "operator-attested custody; not bridge-verifiable" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  try { process.stdout.write(`${JSON.stringify(checkAttestation({ attestationPath: arg("attestation"), packetDir: arg("packet"), candidate: arg("candidate") }))}\n`); }
  catch (e) { process.stdout.write(`${JSON.stringify({ ok: false, refusal: e instanceof Refusal ? e.code : e?.code === "ENOENT" ? "attestation_or_packet_missing" : "attestation_check_error" })}\n`); process.exitCode = 2; }
}
