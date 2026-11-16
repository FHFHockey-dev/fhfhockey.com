// F2 probes: where can game ids come from? Loopback only (common.mjs guard); outputs in scratch via the function API.
import { cfg, loopbackAgent, report } from "./common.mjs";
import { cpSync, chmodSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
const { acquire } = await import(cfg.tool);
const sha = b => createHash("sha256").update(b).digest("hex"), enc = v => Buffer.from(`${JSON.stringify(v, null, 2)}\n`);
const reseal = d => { const p = join(d, "MANIFEST.json"), m = JSON.parse(readFileSync(p, "utf8")); m.files = readdirSync(d).filter(n => n !== "MANIFEST.json").sort().map(file => { const b = readFileSync(join(d, file)); return { file, bytes: b.length, sha256: sha(b) }; }); chmodSync(p, 0o600); writeFileSync(p, enc(m)); };
const copy = (src, name) => { const d = `${cfg.out}-f2-${name}`; cpSync(src, d, { recursive: true }); chmodSync(d, 0o700); for (const f of readdirSync(d)) chmodSync(join(d, f), 0o600); return d; };
const run = async (name, dir) => console.log(JSON.stringify({ case: name, ...(await report(acquire({ conversionDir: dir, outDir: `${cfg.out}-f2out-${name}`, dispatcher: loopbackAgent(), spacingMs: 0 }))) }));
const approved = cfg.conversion, diagnostic = process.env.REVIEW_DIAG;
await run("diagnostic_conversion", diagnostic);
{ const d = copy(approved, "flip"); const p = join(d, "schedule.raw.json"), b = readFileSync(p); b[10] ^= 1; writeFileSync(p, b); await run("schedule_byte_flip_not_resealed", d); }
{ const d = copy(approved, "swap"); const p = join(d, "schedule.raw.json"), s = JSON.parse(readFileSync(p, "utf8")); s.gameWeek[0].games.push({ ...s.gameWeek[0].games[0], id: 2026020299 }); writeFileSync(p, JSON.stringify(s)); reseal(d); await run("schedule_extra_game_resealed", d); }
{ const d = copy(approved, "ids"); const p = join(d, "CONVERSION.json"), c = JSON.parse(readFileSync(p, "utf8")); c.scheduleFacts.games.push({ gameId: 2026020299, home: "X", away: "Y", gameState: "OFF" }); writeFileSync(p, enc(c)); reseal(d); await run("conversion_ids_added_resealed", d); }
{ const d = copy(approved, "unlisted"); writeFileSync(join(d, "NOTE.txt"), "x"); await run("unlisted_file", d); }
{ const d = copy(diagnostic, "relabel"); const p = join(d, "CONVERSION.json"), c = JSON.parse(readFileSync(p, "utf8"));
  Object.assign(c, { evidenceClass: "candidate_pending_independent_review", approvedInputs: true, pinsSHA256: "f2f639ea8b368ffdf930a2a66c766fff366d369e2ebda3d51e0115fa0a45f21c",
    verifierSHA256: "04a632baefda512b4fe463991cc55dbb05c7b0f0c85e50f9589923ebf1f92101", nodeSHA256: "daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef",
    lineageSHA256: "14e0816c65fd8988b1401e21952b0873fcb142da6866523f6c87d8f1b72ff4da" }); writeFileSync(p, enc(c)); reseal(d); await run("hand_relabelled_diagnostic_conversion_custody", d); }
process.exit(0);
