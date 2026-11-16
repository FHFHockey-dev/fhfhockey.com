// RECHECK-5 probe: drive the bridge's own successorSources()/exportBase() (imported read-only from the bridge's
// tests/fixtures.mjs) through every tree state, using only scratch copies. Nothing in the checkout is written.
// Usage: env -u GIT_DIR TMPDIR=<scratch> node probe-successor-states.mjs <scratchDir>
// Run once with the default PATH `patch` and once with PATH=/usr/bin:... to cover GNU and Apple patch.
import { appendFileSync, copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const BRIDGE = "/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15";
const { successorSources, exportBase, WEB, SUCCESSOR_PATCH } = await import(join(BRIDGE, "tests/fixtures.mjs"));
const S = process.argv[2]; mkdirSync(S, { recursive: true });
const sha = b => createHash("sha256").update(b).digest("hex");
const patchBin = spawnSync("sh", ["-c", "command -v patch; patch --version 2>&1 | head -1"], { encoding: "utf8" }).stdout.trim().replace(/\n/g, " | ");

const base = join(exportBase(join(S, "base"), ["web/scripts/blsh"]), "web/scripts/blsh");
const live = join(WEB, "scripts/blsh");
const variant = (name, from, edit) => { const d = join(S, `in-${name}`); cpSync(from, d, { recursive: true }); edit?.(d); return d; };
const cases = [
  ["live_applied_tree", live],
  ["base_export", base],
  ["partial_runner_only_v5", variant("partial", base, d => copyFileSync(join(live, "nativeProcessCaptureRunner.ts"), join(d, "nativeProcessCaptureRunner.ts")))],
  ["partial_all_but_bootstrap_v5", variant("partial2", live, d => copyFileSync(join(base, "nativeProcessCaptureBootstrap.ts"), join(d, "nativeProcessCaptureBootstrap.ts")))],
  ["v5_adapter_drift_eof", variant("adrift", live, d => appendFileSync(join(d, "nativeProcessCaptureAdapter.ts"), "// drift\n"))],
  ["v5_preparation_drift", variant("pdrift", live, d => appendFileSync(join(d, "nativeProcessCapturePreparation.ts"), "// drift\n"))],
  ["v5_runner_drift_eof", variant("rdrift", live, d => appendFileSync(join(d, "nativeProcessCaptureRunner.ts"), "// drift\n"))],
  ["v5_bootstrap_garbage", variant("bgarb", live, d => writeFileSync(join(d, "nativeProcessCaptureBootstrap.ts"), "// neither\n"))],
  ["base_runner_drift_eof", variant("bdrift", base, d => appendFileSync(join(d, "nativeProcessCaptureRunner.ts"), "// drift\n"))],
  ["base_preparation_drift", variant("bpdrift", base, d => appendFileSync(join(d, "nativeProcessCapturePreparation.ts"), "// drift\n"))],
  ["v5_test_file_drift_nonrole", variant("tdrift", live, d => appendFileSync(join(d, "nativeProcessCaptureRunner.test.ts"), "// drift\n"))],
  ["empty_dir", variant("empty", live, d => { for (const f of ["nativeProcessCaptureRunner.ts", "nativeProcessCaptureAdapter.ts", "nativeProcessCaptureBootstrap.ts", "nativeProcessCaptureRunner.test.ts", "nativeProcessCaptureAdapter.test.ts", "nativeProcessCaptureBootstrap.test.ts"]) writeFileSync(join(d, f), ""); })],
];
const liveBefore = sha(readFileSync(join(live, "nativeProcessCaptureRunner.ts")));
const out = { patch: patchBin, results: [] };
for (const [name, from] of cases) {
  let result;
  try { const r = successorSources(S, { from, name: `tree-${name}` }); result = `${r.state} runner=${sha(r.runner).slice(0, 8)} adapter=${sha(r.adapter).slice(0, 8)} bootstrap=${sha(r.bootstrap).slice(0, 8)}`; }
  catch (e) { result = `refused:${e.message.split("\n")[0].slice(0, 90)}`; }
  out.results.push({ name, result });
}
out.liveRunnerUnchanged = liveBefore === sha(readFileSync(join(live, "nativeProcessCaptureRunner.ts")));
out.patchSHA256 = sha(readFileSync(SUCCESSOR_PATCH)).slice(0, 8);
console.log(JSON.stringify(out, null, 1));
