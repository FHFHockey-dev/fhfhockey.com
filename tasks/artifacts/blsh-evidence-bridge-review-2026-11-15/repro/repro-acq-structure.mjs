// Recheck-2 probes (4b, 4c) on the UNCHANGED bridge frames.mjs, imported read-only.
// Usage: node repro-acq-structure.mjs <completedAcquisitionDir> <conversionDir> <scratchDir>
// Copies the completed acquisition into <scratchDir>/<case> and damages each copy one way. No network.
import { cpSync, chmodSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { BRIDGE } from "./packet.mjs";

const { framesFromAcquisition } = await import(process.env.REVIEW_FRAMES ?? join(BRIDGE, "frames.mjs")); // REVIEW_FRAMES: scratch-approved copy only
const [acq, convDir, scratch] = process.argv.slice(2);
const sha = b => createHash("sha256").update(b).digest("hex");
const conv = JSON.parse(readFileSync(join(convDir, "CONVERSION.json"), "utf8")), convSHA = sha(readFileSync(join(convDir, "CONVERSION.json")));
const enc = v => Buffer.from(`${JSON.stringify(v, null, 2)}\n`);
const reseal = dir => { const p = join(dir, "MANIFEST.json"), m = JSON.parse(readFileSync(p, "utf8"));
  m.files = readdirSync(dir).filter(n => n !== "MANIFEST.json").sort().map(file => { const b = readFileSync(join(dir, file)); return { file, bytes: b.length, sha256: sha(b) }; });
  chmodSync(p, 0o600); writeFileSync(p, enc(m)); };
const probe = (name, damage, opts = {}) => {
  const dir = join(scratch, name); rmSync(dir, { recursive: true, force: true }); cpSync(acq, dir, { recursive: true });
  for (const f of readdirSync(dir)) chmodSync(join(dir, f), 0o600);
  damage(dir);
  try { const r = framesFromAcquisition(conv.scheduleFacts, convSHA, dir, opts); return { name, result: `accepted:${r.frames.length}` }; }
  catch (e) { return { name, result: e.code ?? `uncaught:${e.message}` }; }
};
const ids = conv.scheduleFacts.games.map(g => g.gameId).sort((a, b) => a - b);
const out = [];
out.push(probe("baseline_production", () => {}));
out.push(probe("baseline_test_mode", () => {}, { testMode: true }));
out.push(probe("prefix_drop_last_game_resealed", d => { const id = ids.at(-1); for (const f of [`boxscore-${id}.body.json`, `boxscore-${id}.receipt.json`, `operation-${ids.length}-STARTED.json`]) unlinkSync(join(d, f)); reseal(d); }, { testMode: true }));
out.push(probe("extra_file_resealed", d => { writeFileSync(join(d, "NOTE.json"), "{}\n"); reseal(d); }, { testMode: true }));
out.push(probe("extra_file_unlisted", d => writeFileSync(join(d, "NOTE.json"), "{}\n"), { testMode: true }));
out.push(probe("retry_second_started_resealed", d => { writeFileSync(join(d, `operation-${ids.length + 1}-STARTED.json`), readFileSync(join(d, "operation-1-STARTED.json"))); reseal(d); }, { testMode: true }));
out.push(probe("failed_json_present", d => writeFileSync(join(d, "FAILED.json"), "{}\n"), { testMode: true }));
out.push(probe("temp_manifest_present", d => writeFileSync(join(d, ".MANIFEST.json.tmp"), "{}\n"), { testMode: true }));
out.push(probe("manifest_missing", d => unlinkSync(join(d, "MANIFEST.json")), { testMode: true }));
out.push(probe("body_byte_flip_not_resealed", d => { const p = join(d, `boxscore-${ids[0]}.body.json`), b = readFileSync(p); b[5] ^= 1; writeFileSync(p, b); }, { testMode: true }));
// 4c on a resealed copy (production path; tool still unapproved, so the furthest reachable code is the tool check)
const editReceipt = (d, fn) => { const p = join(d, `boxscore-${ids[1]}.receipt.json`); writeFileSync(p, enc(fn(JSON.parse(readFileSync(p, "utf8"))))); reseal(d); };
out.push(probe("receipt_redirected_true", d => editReceipt(d, r => ({ ...r, redirected: true }))));
out.push(probe("receipt_finalUrl_differs", d => editReceipt(d, r => ({ ...r, finalUrl: r.url + "?x" }))));
out.push(probe("runtime_node_not_approved", d => { const p = join(d, "ACQUISITION-RUNTIME.json"), rt = JSON.parse(readFileSync(p, "utf8")); rt.node.execPathSHA256 = "9".repeat(64); writeFileSync(p, enc(rt)); reseal(d); }));
out.push(probe("runtime_launch_openssl_conf", d => { const p = join(d, "ACQUISITION-RUNTIME.json"), rt = JSON.parse(readFileSync(p, "utf8")); rt.launch.environmentPresence.OPENSSL_CONF = true; writeFileSync(p, enc(rt)); reseal(d); }));
out.push(probe("runtime_testTransport_key", d => { const p = join(d, "ACQUISITION-RUNTIME.json"), rt = JSON.parse(readFileSync(p, "utf8")); rt.testTransport = "x"; writeFileSync(p, enc(rt)); reseal(d); }));
out.push(probe("tool_source_edited", d => { const p = join(d, "source-tool.mjs"); writeFileSync(p, readFileSync(p, "utf8") + "\n// edited\n"); reseal(d); }));
for (const r of out) console.log(JSON.stringify(r));
