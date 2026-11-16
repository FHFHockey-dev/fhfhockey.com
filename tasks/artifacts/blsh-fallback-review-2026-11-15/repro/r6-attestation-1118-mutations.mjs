// R6: mutate the bridge rehearsal's accepted v5-1118 attestation and confirm check-attestation.mjs b9531830 refuses each.
// Usage: node r6-attestation-1118-mutations.mjs <bridge rehearsal scratch (v5-1118)> <new scratch>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
const [scr, out] = process.argv.slice(2);
if (existsSync(out)) { console.log("scratch exists"); process.exit(2); }
mkdirSync(out, { recursive: true });
const m = await import("/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-evidence-bridge-2026-11-15/post-capture/check-attestation.mjs");
const att = join(scr, "B/attestation-ok/OPERATOR-ATTESTATION.json"), packet = join(scr, "B/packet-candidate");
const base = JSON.parse(readFileSync(att, "utf8"));
const expect = { argv0: m.EXEC_ARGV0, cwd: m.EXEC_CWD }; // the CLI defaults (B2 runs the CLI)
const run = (label, mutate, candidate = "v5-1118") => {
  const a = structuredClone(base); mutate(a); const p = join(out, label + ".json"); writeFileSync(p, JSON.stringify(a));
  try { const r = m.checkAttestation({ attestationPath: p, packetDir: packet, candidate, expect }); console.log(label, "ACCEPT", r.execAtUTC); }
  catch (e) { console.log(label, "refuse", e.code ?? e.message); }
};
const exec = (a, f) => { const e = JSON.parse(a.launcher.execLine); f(e); a.launcher.execLine = JSON.stringify(e); };
run("baseline-unchanged", () => {});
run("launcher-1117-hash", a => { a.launcher.sha256 = m.OPERATOR_PINS.v5.launcherSHA256; exec(a, e => { e.launcherSHA256 = m.OPERATOR_PINS.v5.launcherSHA256; }); });
run("g3-baseline-1117", a => { a.g3.baseline.sha256 = m.OPERATOR_PINS.v5.g3BaselineSHA256; });
run("exec-on-1117", a => exec(a, e => { e.atUTC = e.atUTC.replace("2026-11-18", "2026-11-17"); }));
run("exec-14:05:50", a => exec(a, e => { e.atUTC = "2026-11-18T14:05:50.000001Z"; }));
run("candidate-field-1117", a => { a.candidate = "v5-1117"; });
run("capture-exit-1", a => { a.capture.exitCode = 1; });
run("refuse-line-present", a => { a.launcher.refuseLine = '{"launcher":"refuse"}'; });
run("checked-as-v5", () => {}, "v5");
