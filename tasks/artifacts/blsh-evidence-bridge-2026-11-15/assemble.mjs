// Assemble prepare_packet.py input (fhfh.blsh.native-packet-inputs.v1) from one or more converted packets,
// their official frames, the CURRENT-REQUEST and CONTEXTS. Offline. Also reports latest-five window coverage;
// the gate never admits a window (capturedWindows.completeLatestFiveEstablished is hard-coded false).
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { approvedFor } from "./convert.mjs";
import { BridgeRefusal, GROUPS, MIB, createOutput, encode, need, parseJson, readBound, sha } from "./lib.mjs";

const PROCESS = { individual: "individual", onIce: "onIce" };

function loadCompleted(dir) {
  const manifestBytes = readBound(join(dir, "MANIFEST.json"), 4 * MIB), manifest = parseJson(manifestBytes, "input_manifest_invalid");
  const files = new Map();
  for (const f of manifest.files) {
    const bytes = readBound(join(dir, f.file), 8 * MIB);
    need(sha(bytes) === f.sha256 && bytes.length === f.bytes, "input_dir_hash_drift");
    files.set(f.file, bytes);
  }
  need(readdirSync(dir).every(n => n === "MANIFEST.json" || files.has(n)), "input_dir_unlisted_file");
  return { manifest, manifestBytes, files };
}

export function assemble({ requestPath, contextPath, conversionDirs, frameDirs, outDir, candidate = "v5" }) {
  const APPROVED = approvedFor(candidate); // explicit choice (v5 | v5-1118); never inferred from a conversion
  const requestBytes = readBound(requestPath, 32 * MIB), request = parseJson(requestBytes, "request_invalid");
  const contextBytes = readBound(contextPath, 8 * MIB), context = parseJson(contextBytes, "context_invalid");
  const artifacts = new Map(); // sha -> bytes
  const add = bytes => { const d = sha(bytes); artifacts.set(d, bytes); return d; };
  const conversions = new Map(), frames = new Map(), allow = { producerSHA256: new Set(), redactorSHA256: new Set() };
  const extraBound = new Set();
  for (const dir of conversionDirs) {
    const { files } = loadCompleted(dir);
    const c = parseJson(files.get("CONVERSION.json"));
    // Recheck §1: never take a candidate class as written; re-derive it from the approved input hashes.
    if (c.evidenceClass !== "diagnostic_only_synthetic_adapter") need(c.evidenceClass === "candidate_pending_independent_review" && c.approvedInputs === true &&
      c.pinsSHA256 === APPROVED.pinsSHA256 && c.verifierSHA256 === APPROVED.verifierSHA256 && c.nodeSHA256 === APPROVED.nodeSHA256 &&
      c.lineageSHA256 === APPROVED.lineageSHA256, "conversion_not_approved");
    extraBound.add(add(files.get("CONVERSION.json"))); // review Q6: pins/verifier/node/lineage hashes and TLS facts used
    need(!conversions.has(c.date), "duplicate_native_date");
    for (const a of c.artifacts) { add(files.get(a.file)); if (!/^(native_|producer_|redactor_|definition)/.test(a.role)) extraBound.add(a.sha256); }
    allow.producerSHA256.add(c.producerSHA256); allow.redactorSHA256.add(c.redactorSHA256);
    conversions.set(c.date, c);
  }
  const frameModes = new Set();
  for (const dir of frameDirs) {
    const { files, manifestBytes } = loadCompleted(dir);
    extraBound.add(add(manifestBytes)); // recheck §2 Low: the frames directory's own completion manifest
    frameModes.add(parseJson(files.get("FRAMES.json")).mode);
    for (const [name, bytes] of files) {
      if (/^frame-/.test(name)) { const f = parseJson(bytes); frames.set(`${f.playerId}|${f.gameId}`, add(bytes)); }
      else if (/^(boxscore-|acquisition-|ACQUISITION-RUNTIME\.json$|FRAMES\.json$)/.test(name)) extraBound.add(add(bytes));
    }
  }
  const selected = new Set(context.profiles.flatMap(p => p.sourceIds));
  const wgo = new Map(request.wgo.rows.map(r => [r.id, r]));
  const rows = [], skipped = [];
  for (const sid of [...selected].sort((a, b) => a - b)) {
    const r = wgo.get(sid);
    need(r, "selected_wgo_row_missing");
    const c = conversions.get(r.date);
    if (!c) continue; // no native capture for this date: prepare_packet holds it (native_receipt_not_supplied)
    const frame = frames.get(`${r.player_id}|${r.game_id}`);
    for (const group of GROUPS) {
      const process = (request[PROCESS[group]]?.rows ?? []).filter(p => p.player_id === r.player_id && p.date_scraped === r.date);
      if (process.length !== 1 || !frame) { skipped.push({ wgoSourceId: sid, group, reason: !frame ? "official_frame_not_supplied" : "no_unique_stored_process_row" }); continue; }
      rows.push({ group, wgoSourceId: sid, processSourceId: process[0].id,
        nativeBodySHA256: c.receipts[group].bodySHA256, nativeReceiptSHA256: c.receipts[group].receiptSHA256,
        producerSHA256: c.producerSHA256, redactorSHA256: c.redactorSHA256, definitionSHA256: c.definitionSHA256, officialFrameSHA256: frame });
    }
  }
  // Window coverage (bridge-layer; the gate never establishes a complete latest five).
  const windows = context.profiles.map(p => {
    const dates = p.sourceIds.map(id => wgo.get(id)?.date);
    const missingDates = dates.filter(d => !conversions.has(d)).length;
    const missingFrames = p.sourceIds.filter(id => { const r = wgo.get(id); return !r || !frames.has(`${r.player_id}|${r.game_id}`); }).length;
    const reasons = ["latest_five_membership_not_established_by_bridge"];
    if (p.sourceIds.length !== 5) reasons.push("short_window");
    if (missingDates) reasons.push(`window_dates_without_native_capture:${missingDates}`);
    if (missingFrames) reasons.push(`window_members_without_official_frame:${missingFrames}`);
    return { playerId: p.playerId, members: p.sourceIds.length, windowComplete: false, reasons };
  });
  const allowlist = encode({ producerSHA256: [...allow.producerSHA256].sort(), redactorSHA256: [...allow.redactorSHA256].sort() });
  const out = createOutput(outDir);
  for (const [digest, bytes] of artifacts) out.write(digest, bytes);
  out.write("producer-allowlist.json", allowlist);
  out.writeJson("native-inputs.json", { version: "fhfh.blsh.native-packet-inputs.v1", sourceRequestSHA256: sha(requestBytes), contextSHA256: sha(contextBytes),
    producerAllowlistSHA256: sha(allowlist), artifacts: [...artifacts].map(([d, b]) => ({ path: d, sha256: d, bytes: b.length })), rows });
  const report = { version: "fhfh.blsh.evidence-bridge.assembly.v1", candidate, nativeDates: [...conversions.keys()].sort(),
    evidenceClasses: [...new Set([...conversions.values()].map(c => c.evidenceClass))], frameModes: [...frameModes].sort(), proposedEntries: rows.length,
    skipped: skipped.length, skippedReasons: skipped.reduce((m, s) => ({ ...m, [s.reason]: (m[s.reason] ?? 0) + 1 }), {}),
    extraBoundArtifactSHA256: [...extraBound].sort(), windows, completeWindows: 0, independentlyAccepted: false };
  out.writeJson("ASSEMBLY.json", report);
  out.complete("assembled_pending_prepare_packet");
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = n => process.argv.flatMap((a, i) => a === `--${n}` ? [process.argv[i + 1]] : []);
  try {
    need(all("candidate").length === 1, "candidate_required"); // --candidate v5 | v5-1118, always explicit on the CLI
    const r = assemble({ requestPath: all("request")[0], contextPath: all("context")[0], conversionDirs: all("conversion"), frameDirs: all("frames"), outDir: all("out")[0], candidate: all("candidate")[0] });
    process.stdout.write(`${JSON.stringify({ ok: true, proposedEntries: r.proposedEntries, skipped: r.skipped })}\n`);
  } catch (e) {
    process.stdout.write(`${JSON.stringify({ ok: false, refusal: e instanceof BridgeRefusal ? e.code : e?.code === "EEXIST" ? "output_exists" : "assemble_error" })}\n`); process.exitCode = 2;
  }
}
