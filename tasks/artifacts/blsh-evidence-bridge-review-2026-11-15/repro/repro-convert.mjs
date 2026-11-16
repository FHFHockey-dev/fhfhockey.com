// Reviewer reproducers against the UNCHANGED bridge convert.mjs (imported read-only).
// Usage: node repro-convert.mjs <scratchDir> <patchedWebDir>
//   <patchedWebDir> = a scratch copy of web/ with SUCCESSOR.patch applied (runner 5dc46ec8…, adapter aa6237bd…).
// Writes only under <scratchDir>. No network. Prints one JSON line per case.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BRIDGE, LINEAGE, NODE_SHA256, SUCC_PINS, SUCC_VERIFIER, makePacket, sha, sources } from "./packet.mjs";

const { convertPacket } = await import(join(BRIDGE, "convert.mjs"));
const [scratch, patchedWeb] = process.argv.slice(2);
mkdirSync(scratch, { recursive: true });
const DATE = "2026-11-11", START = "2026-11-17T14:05:10.000Z";
const run = (name, { packet = {}, pins = SUCC_PINS, synthetic = false, node = NODE_SHA256 } = {}) => {
  const dir = join(scratch, `pkt-${name}`), out = join(scratch, `conv-${name}`);
  makePacket(dir, { date: DATE, startedAtUTC: START, srcs: sources(patchedWeb, packet.override), ...packet });
  try {
    const c = convertPacket({ packetDir: dir, pinsPath: pins, verifierPath: SUCC_VERIFIER, nodeSHA256: node, lineagePath: LINEAGE, outDir: out, syntheticAdapterOk: synthetic });
    const receipt = JSON.parse(readFileSync(join(out, "receipt-individual.json"), "utf8"));
    return { case: name, ok: true, evidenceClass: c.evidenceClass, receiptTLSVerified: receipt.TLSVerified, producerSHA256: c.producerSHA256.slice(0, 8) };
  } catch (e) { return { case: name, ok: false, refusal: e.code ?? `uncaught:${e.message}` }; }
};
const results = [];

// Q1-A. Fabricated packet: real successor-pinned source bytes, hand-written TLS + RUNTIME, zero network.
results.push(run("forged_real_pins"));

// Q3. Synthetic adapter bytes + a pins file the operator wrote naming that adapter: class is NOT diagnostic.
const synth = Buffer.from("// any adapter bytes at all\n");
const pins = JSON.parse(readFileSync(SUCC_PINS, "utf8")); pins.adapter = sha(synth);
const customPins = join(scratch, "operator-written-pins.json"); writeFileSync(customPins, JSON.stringify(pins));
results.push(run("synthetic_adapter_custom_pins", { pins: customPins, packet: { override: { adapter: synth } } }));

// Q1. Brief probes at packet level (successor verifier + bridge).
results.push(run("resumed_without_prior_full", { packet: { tls: { 3: t => ({ ...t, sessionReused: true, peerCertificate: null, resumedFromOperation: 1 }) } } }));
results.push(run("keepalive_wrong_opener", { packet: { tls: { 5: t => ({ ...t, connectionReused: true, connectionSequence: 1, connectionFromOperation: 1 }) } } }));
results.push(run("repeated_sequence_new_conn", { packet: { tls: { 5: t => ({ ...t, connectionSequence: 3 }) } } }));
results.push(run("admission_tls_null", { packet: { tls: { 2: null } } }));
// Accepted variants worth knowing: keep-alive whose fingerprint differs from its opener's; resumed op carrying a different cert.
results.push(run("keepalive_fingerprint_differs_from_opener", { packet: { tls: { 5: t => ({ ...t, connectionReused: true, connectionSequence: 3, connectionFromOperation: 3,
  peerCertificate: { ...t.peerCertificate, fingerprint256: Array(32).fill("11").join(":") } }) } } }));
results.push(run("resumed_with_different_cert", { packet: { tls: { 5: t => ({ ...t, sessionReused: true, resumedFromOperation: 3,
  peerCertificate: { ...t.peerCertificate, fingerprint256: Array(32).fill("22").join(":") } }) } } }));
// RUNTIME extras and a synthetic marker are ignored.
results.push(run("runtime_extra_synthetic_marker", { packet: { runtime: { syntheticTestOnly: true, note: "not a real run" } } }));
// Node pin: bridge needs --node-sha256; wrong value refuses.
results.push(run("node_sha_wrong", { node: "0".repeat(64) }));

// Q4. Freshness boundaries at retrieval (ops 3 and 5 completedAtUTC; startedAt moved so chronology holds).
const fresh = (name, at3, at5, start) => {
  const dir = join(scratch, `pkt-${name}`), out = join(scratch, `conv-${name}`);
  makePacket(dir, { date: DATE, startedAtUTC: start, srcs: sources(patchedWeb), retrieved: { 3: at3, 5: at5 } });
  try { convertPacket({ packetDir: dir, pinsPath: SUCC_PINS, verifierPath: SUCC_VERIFIER, nodeSHA256: NODE_SHA256, lineagePath: LINEAGE, outDir: out });
    return { case: name, ok: true }; } catch (e) { return { case: name, ok: false, refusal: e.code ?? `uncaught:${e.message}` }; }
};
results.push(fresh("same_utc_day", "2026-11-11T23:50:00.000Z", "2026-11-11T23:50:30.000Z", "2026-11-11T23:49:00.000Z"));
results.push(fresh("first_instant_next_day", "2026-11-12T00:00:00.000Z", "2026-11-12T00:00:30.000Z", "2026-11-11T23:59:50.000Z"));
results.push(fresh("exactly_8_days", "2026-11-19T00:00:00.000Z", "2026-11-19T00:00:30.000Z", "2026-11-18T23:59:50.000Z"));
results.push(fresh("8_days_minus_1ms_then_after", "2026-11-18T23:59:59.999Z", "2026-11-19T00:00:22.000Z", "2026-11-18T23:59:50.000Z"));
results.push(fresh("both_under_8_days", "2026-11-18T23:59:30.000Z", "2026-11-18T23:59:59.999Z", "2026-11-18T23:59:20.000Z"));
results.push(fresh("offset_plus_same_utc_day", "2026-11-12T00:30:00.000+01:00", "2026-11-12T00:30:30.000+01:00", "2026-11-11T23:29:00.000Z"));
results.push(fresh("offset_minus_next_utc_day", "2026-11-11T20:00:00.000-05:00", "2026-11-11T20:00:30.000-05:00", "2026-11-12T00:59:00.000Z"));

// Q10. Existing --out: never overwritten.
const again = (() => { try { convertPacket({ packetDir: join(scratch, "pkt-forged_real_pins"), pinsPath: SUCC_PINS, verifierPath: SUCC_VERIFIER, nodeSHA256: NODE_SHA256,
  lineagePath: LINEAGE, outDir: join(scratch, "conv-forged_real_pins") }); return { case: "existing_out", ok: true }; }
  catch (e) { return { case: "existing_out", ok: false, refusal: e.code ?? e.message.split(",")[0] }; } })();
results.push(again);
for (const r of results) console.log(JSON.stringify(r));
