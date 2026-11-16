// Recheck reproducers for bridge convert.mjs eea43c7f… against successor v4 (patch 66b4eb30…). Imports the bridge read-only.
// Usage: node repro-convert-v4.mjs <scratchDir> <patchedV4WebDir>
// Writes only under <scratchDir>. No network. Every TLS/RUNTIME fact is hand-written.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BRIDGE, LINEAGE, NODE_SHA256, SUCC_PINS, SUCC_VERIFIER, makePacket, sha, sources } from "./packet.mjs";

const { convertPacket } = await import(join(BRIDGE, "convert.mjs"));
const [scratch, patchedWeb] = process.argv.slice(2);
mkdirSync(scratch, { recursive: true });
const DATE = "2026-11-11", START = "2026-11-17T14:05:10.000Z";
const CA = "5aab51f94c9a1ad6b5185229b65ca308fcae0e6fdb31bdf6f34278e099fb024c";
const WEB = "/Users/tim/Code/fhfhockey.com/web", BOOT = `${WEB}/scripts/blsh/nativeProcessCaptureBootstrap.ts`;
const BOOT_SHA = JSON.parse(readFileSync(SUCC_PINS, "utf8"))._bootstrapSHA256;
const LAUNCH_ENV = ["NODE_PATH", "DISABLE_V8_COMPILE_CACHE", "TS_NODE_COMPILER_OPTIONS", "OPENSSL_CONF", "TS_NODE_PROJECT", "TS_NODE_SKIP_PROJECT", "TS_NODE_COMPILER",
  "TS_NODE_TRANSPILE_ONLY", "TS_NODE_REQUIRE", "TS_NODE_CWD", "TS_NODE_DIR", "TS_NODE_COMPILER_HOST", "TS_NODE_EMIT", "TS_NODE_SCOPE", "TS_NODE_SCOPE_DIR", "TS_NODE_SWC", "TS_NODE_TRANSPILER"];
const launch = (over = {}) => ({ entryScript: BOOT, entryScriptSHA256: BOOT_SHA, cwd: WEB, bootstrapPath: BOOT, bootstrapSHA256: BOOT_SHA, entryIsBootstrap: true,
  environmentPresence: Object.fromEntries(LAUNCH_ENV.map((k, i) => [k, i < 3])), otherTsNodeKeysPresent: [], ...over });
const v4tls = Object.fromEntries([1, 2, 3, 4, 5].map(n => [n, t => ({ ...t, defaultCACertificatesSHA256: CA })]));
const run = (name, { pins = SUCC_PINS, verifier = SUCC_VERIFIER, synthetic = false, node = NODE_SHA256, override = {}, runtime = {}, tls = v4tls } = {}) => {
  const dir = join(scratch, `pkt-${name}`), out = join(scratch, `conv-${name}`);
  makePacket(dir, { date: DATE, startedAtUTC: START, srcs: sources(patchedWeb, override), tls, runtime: { launch: launch(), ...runtime } });
  try {
    const c = convertPacket({ packetDir: dir, pinsPath: pins, verifierPath: verifier, nodeSHA256: node, lineagePath: LINEAGE, outDir: out, syntheticAdapterOk: synthetic });
    return { case: name, ok: true, evidenceClass: c.evidenceClass, receiptTLSVerified: JSON.parse(readFileSync(join(out, "receipt-individual.json"))).TLSVerified,
      boundRoles: [...new Set(c.artifacts.map(a => a.role))].length, artifacts: c.artifacts.length };
  } catch (e) { return { case: name, ok: false, refusal: e.code ?? `uncaught:${e.message}` }; }
};
const R = [];
// Q7 / Q1: custody limit. Real v4-pinned source bytes, hand-written TLS + RUNTIME + launch proof, zero network.
R.push(run("v4_forged_real_pins"));
// Q3: operator-supplied inputs, non-synthetic.
const synth = Buffer.from("// any adapter bytes at all\n");
const pins = JSON.parse(readFileSync(SUCC_PINS, "utf8")); pins.adapter = sha(synth);
const customPins = join(scratch, "operator-written-pins.json"); writeFileSync(customPins, JSON.stringify(pins));
R.push(run("custom_pins_nonsynthetic", { pins: customPins, override: { adapter: synth } }));
R.push(run("custom_pins_synthetic_flag", { pins: customPins, override: { adapter: synth }, synthetic: true }));
const otherVerifier = join(scratch, "other-verifier.mjs"); writeFileSync(otherVerifier, readFileSync(SUCC_VERIFIER, "utf8") + "\n// edited\n");
R.push(run("other_verifier_nonsynthetic", { verifier: otherVerifier }));
R.push(run("other_node_pin_nonsynthetic", { node: "1".repeat(64) }));
R.push(run("synthetic_adapter_under_approved_pins", { override: { adapter: synth } }));
R.push(run("approved_inputs_with_synthetic_flag", { synthetic: true }));
// Bootstrap: launch proof variants.
R.push(run("launch_not_bootstrap", { runtime: { launch: launch({ entryScript: "/x/rehearse.ts", entryScriptSHA256: "c".repeat(64), entryIsBootstrap: false }) } }));
R.push(run("launch_other_bootstrap_hash", { runtime: { launch: launch({ bootstrapSHA256: "d".repeat(64), entryScriptSHA256: "d".repeat(64) }) } }));
R.push(run("launch_openssl_conf_present", { runtime: { launch: launch({ environmentPresence: Object.fromEntries(LAUNCH_ENV.map((k, i) => [k, i < 3 || k === "OPENSSL_CONF"])) }) } }));
R.push(run("launch_cwd_elsewhere", { runtime: { launch: launch({ cwd: "/tmp" }) } }));
// Q3 (msg item 3): exact key sets.
R.push(run("runtime_extra_key", { runtime: { syntheticTestOnly: true } }));
R.push(run("launch_extra_key", { runtime: { launch: { ...launch(), note: "x" } } }));
R.push(run("tls_extra_key", { tls: { ...v4tls, 3: t => ({ ...t, defaultCACertificatesSHA256: CA, extra: 1 }) } }));
R.push(run("tls_missing_ca_key", { tls: { ...v4tls, 3: t => t } }));
R.push(run("tls_ca_changed_op4", { tls: { ...v4tls, 4: t => ({ ...t, defaultCACertificatesSHA256: "e".repeat(64) }) } }));
R.push(run("lifecycle_key_present", { runtime: { adapterEnvironmentPresence: { NST_KEY: true, SUPABASE_SERVICE_ROLE_KEY: true, NEXT_PUBLIC_SUPABASE_URL: true, NST_JOB_LIFECYCLE_ENABLED: true } } }));
for (const r of R) console.log(JSON.stringify(r));
