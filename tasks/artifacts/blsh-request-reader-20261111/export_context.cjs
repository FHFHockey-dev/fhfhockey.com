/* Offline export: one captured CURRENT-REQUEST -> the bridge's request.json + context.json (POST-CAPTURE step 4).
 * Adapted from Codex current-refresh-reader-20261101-01/export_context.cjs (01b21d2d...). Pure function of the capture:
 * no network, no credentials, no database. It can be re-run offline into new paths without a second live read.
 * Changes from upstream (each is listed in RUNBOOK.md "Adaptations"):
 *   - paths are arguments; outputs are written with flag "wx" only after every check passes;
 *   - the 11-01-capture-specific checks are not carried over: contexts.length===740, qualification-01 SOURCE-DIFFERENCES,
 *     and the DISCREPANCIES.json binding (it throws if any October WGO value was corrected since; not knowable offline);
 *   - productionReference.ts is re-pinned (9a56af85 -> ec3afb69; commit db7a64c58 is +89/-0, outcomes/FHFH_WEIGHTS equal,
 *     see tests/test_export.cjs);
 *   - new: exact-key request contract, RAW-file hash binding, native-date coverage against the conversion's schedule,
 *     and the prepare_packet.py selected-row bound (<= 5000).
 * CLI: node export_context.cjs --capture DIR --conversion DIR --request-out FILE --context-out FILE --summary-out FILE
 *      [--allow-simulated]   (tests only: accepts an offline_fixture capture and a diagnostic conversion) */
"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), Module = require("node:module");

const ROOT = __dirname, WEB = "/Users/tim/Code/fhfhockey.com/web";
const PINS = {
  currentInput: "58a87ea119a98b33d7d67fb6849a269e375c22210610b607dfa30ba034c76232",
  productionReference: "ec3afb69ff6001068586d50faf718585f17392524196cb343020f3b98eda192e",
  productionContext: "198fe2a74e3011bf87c59b6c3239c5758501fe7e6d4c722930ebddaacc673510",
  typescript: "0fba5508ecbe50cd00a45f132a76582fb22a4ec55769fd3d794fd0e026f9fb67",
};
const MIB = 1024 * 1024, SELECTED_ROW_BOUND = 5000, ROWS_PER_GAME = 36;
const COLUMNS = JSON.parse(fs.readFileSync(path.join(ROOT, "COLUMNS.json"), "utf8"));
const CONTEXT_KEYS = COLUMNS.wgo.slice(0, 12);

class Refusal extends Error { constructor(code) { super(code); this.code = code; } }
const need = (ok, code) => { if (!ok) throw new Refusal(code); };
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const sameKeys = (obj, keys) => obj !== null && typeof obj === "object" && !Array.isArray(obj) &&
  JSON.stringify(Object.keys(obj).sort()) === JSON.stringify([...keys].sort());

function readFile(p, max) {
  const info = fs.lstatSync(p);
  need(info.isFile() && !info.isSymbolicLink() && info.size > 0 && info.size <= max, "input_not_regular_or_bound");
  return fs.readFileSync(p);
}
const parse = (b, code) => { try { return JSON.parse(b.toString("utf8")); } catch { throw new Refusal(code); } };

function loadTs(rel, pin) {
  const p = path.join(WEB, rel), src = fs.readFileSync(p, "utf8");
  need(sha(Buffer.from(src)) === pin, `shared_source_changed:${path.basename(rel)}`);
  const tsPath = path.join(WEB, "node_modules/typescript/lib/typescript.js");
  need(sha(fs.readFileSync(tsPath)) === PINS.typescript, "typescript_changed");
  const ts = require(tsPath), m = new Module(p);
  m._compile(ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, p);
  return m.exports;
}

/** Exact request contract written by capture_reader.build_request (+ captureContext). */
function checkRequestShape(request) {
  need(sameKeys(request, ["seasonId", "eventThroughDate", "asOfUTC", "freshnessPolicy", "wgo", "individual", "onIce", "calendar", "captureContext"]), "request_top_level_keys");
  need(request.seasonId === 20262027, "request_season");
  need(sameKeys(request.freshnessPolicy, ["id", "maxEventAgeDays", "maxCaptureAgeHours"]) && request.freshnessPolicy.maxEventAgeDays === 7 &&
    request.freshnessPolicy.maxCaptureAgeHours === 24, "request_freshness_policy");
  for (const feed of ["wgo", "individual", "onIce", "calendar"]) {
    const f = request[feed], process = feed === "individual" || feed === "onIce";
    need(sameKeys(f, process ? ["capture", "rows", "strengthScope", "dateMeaning", "toiUnit"] : ["capture", "rows"]), `request_feed_keys:${feed}`);
    need(sameKeys(f.capture, ["source", "sha256", "retrievedAtUTC", "sourceAvailableThroughUTC", "revisionId"]), `request_capture_keys:${feed}`);
    need(Array.isArray(f.rows), `request_rows:${feed}`);
    const rowKeys = feed === "wgo" ? [...CONTEXT_KEYS, "counts"] : COLUMNS[feed];
    const countKeys = COLUMNS.wgo.filter(k => !CONTEXT_KEYS.includes(k));
    for (const r of f.rows) {
      need(sameKeys(r, rowKeys), `request_row_keys:${feed}`);
      if (feed === "wgo") need(sameKeys(r.counts, countKeys), "request_row_keys:wgo.counts");
    }
  }
}

function loadConversion(dir) {
  const manifest = parse(readFile(path.join(dir, "MANIFEST.json"), 4 * MIB), "conversion_manifest_invalid"), files = new Map();
  for (const f of manifest.files) {
    const bytes = readFile(path.join(dir, f.file), 8 * MIB);
    need(sha(bytes) === f.sha256 && bytes.length === f.bytes, "conversion_hash_drift");
    files.set(f.file, bytes);
  }
  need(fs.readdirSync(dir).every(n => n === "MANIFEST.json" || files.has(n)), "conversion_unlisted_file");
  return parse(files.get("CONVERSION.json"), "conversion_invalid");
}

function exportContext({ captureDir, conversionDir, requestOut, contextOut, summaryOut, allowSimulated = false }) {
  for (const p of [requestOut, contextOut, summaryOut]) need(path.isAbsolute(p) && !fs.existsSync(p), "output_exists_or_relative");
  need(sha(fs.readFileSync(path.join(ROOT, "production_context.cjs"))) === PINS.productionContext, "production_context_changed");
  const result = parse(readFile(path.join(captureDir, "RESULT.json"), MIB), "capture_result_invalid");
  const live = result.state === "CAPTURED_READ_ONLY_UNQUALIFIED" && result.executionMode === "authorized_read_only_session";
  const simulated = result.state === "OFFLINE_CAPTURE_SIMULATION_COMPLETE" && result.executionMode === "offline_fixture";
  need(live || (allowSimulated && simulated), "capture_not_complete_or_simulated");
  need(result.sessionClosed === true && result.atomicDatabaseSnapshot === true, "capture_not_closed_or_not_atomic");
  const requestName = live ? "CURRENT-REQUEST.json" : "SIMULATED-REQUEST.json";
  const requestBytes = readFile(path.join(captureDir, requestName), 32 * MIB);
  need(sha(requestBytes) === result.artifacts[requestName], "capture_request_hash_drift");
  const request = parse(requestBytes, "request_invalid");
  checkRequestShape(request);
  need(request.captureContext === result.executionMode && request.asOfUTC === result.asOfUTC && request.eventThroughDate === result.eventThroughDate, "request_result_binding");
  for (const feed of ["wgo", "individual", "onIce", "calendar"]) {
    const raw = readFile(path.join(captureDir, `RAW-${feed}.json`), 16 * MIB);
    need(sha(raw) === request[feed].capture.sha256 && result.artifacts[`RAW-${feed}.json`] === request[feed].capture.sha256, `raw_hash_binding:${feed}`);
    need(request[feed].rows.length === result.rows[feed], `row_count_binding:${feed}`);
  }

  // Native-date coverage against the conversion (POST-CAPTURE step 8 stops on proposedEntries 0; catch it here first).
  const conversion = loadConversion(conversionDir);
  need(conversion.evidenceClass === "candidate_pending_independent_review" || (allowSimulated && conversion.evidenceClass === "diagnostic_only_synthetic_adapter"), "conversion_class_not_candidate");
  const D = conversion.date;
  need(D === request.eventThroughDate, "conversion_date_not_event_through_date");
  // The calendar feed only holds games that captured WGO rows reference, so a game missing from WGO is missing here too.
  // Shortfalls are REPORTED (assemble still yields entries for the rest); stop only when nothing on D can yield an entry.
  const scheduleIds = conversion.scheduleFacts.games.map(g => g.gameId).sort((a, b) => a - b);
  const calendarIds = request.calendar.rows.filter(g => g.date === D).map(g => g.id).sort((a, b) => a - b);
  const wgoD = request.wgo.rows.filter(r => r.date === D), inSchedule = wgoD.filter(r => scheduleIds.includes(r.game_id));
  need(inSchedule.length > 0, "no_wgo_rows_on_native_date_games");
  const unique = feed => inSchedule.filter(r => request[feed].rows.filter(p => p.player_id === r.player_id && p.date_scraped === D).length === 1).length;
  const coverage = { date: D, games: scheduleIds.length, expectedWgoRows: ROWS_PER_GAME * scheduleIds.length, wgoRows: inSchedule.length,
    individualUnique: unique("individual"), onIceUnique: unique("onIce"),
    scheduleGamesMissingFromCapture: scheduleIds.filter(id => !calendarIds.includes(id)),
    capturedGamesNotInSchedule: calendarIds.filter(id => !scheduleIds.includes(id)), wgoRowsOutsideSchedule: wgoD.length - inSchedule.length };
  coverage.wgoRowsComplete = coverage.wgoRows === coverage.expectedWgoRows && !coverage.scheduleGamesMissingFromCapture.length;
  need(coverage.individualUnique > 0 || coverage.onIceUnique > 0, "no_stored_nst_rows_on_native_date");

  const { qualifyCurrentInputs } = loadTs("lib/buyLowSellHigh/currentInput.ts", PINS.currentInput);
  const { outcomes, FHFH_WEIGHTS } = loadTs("lib/buyLowSellHigh/productionReference.ts", PINS.productionReference);
  const { buildProductionContexts } = require(path.join(ROOT, "production_context.cjs"));
  const qualified = qualifyCurrentInputs(request);
  // discrepancies: [] -- the October DISCREPANCIES.json binding is not applied (see header).
  const contexts = buildProductionContexts(qualified.records, { outcomes, eventThroughDate: request.eventThroughDate, capturedAtUTC: request.asOfUTC, discrepancies: [] });
  need(contexts.length > 0 && contexts.every(p => p.supportScore === null && p.buySellLabel === null), "unsupported_scoring_or_empty_population");
  const selectedRows = contexts.reduce((n, p) => n + p.sourceIds.length, 0);
  need(selectedRows <= SELECTED_ROW_BOUND, "selected_row_bound");
  const selectedOnD = contexts.reduce((n, p) => n + p.dates.filter(d => d === D).length, 0);
  need(selectedOnD > 0, "no_selected_rows_on_native_date");

  const contextBytes = Buffer.from(JSON.stringify({ version: "fhfh.blsh.current-production-context.v1", scoring: "FHFH Standard", weights: FHFH_WEIGHTS,
    captureSHA256: sha(requestBytes), discrepancyEvidence: "not_bound_in_this_export", profiles: contexts }) + "\n");
  const summary = { version: "fhfh.blsh.request-reader-20261111.export.v1", captureContext: request.captureContext, asOfUTC: request.asOfUTC,
    eventThroughDate: request.eventThroughDate, feedCapturedAtUTC: request.wgo.capture.retrievedAtUTC, rows: result.rows,
    requestSHA256: sha(requestBytes), contextSHA256: sha(contextBytes), profiles: contexts.length, selectedSourceRows: selectedRows,
    selectedRowsOnNativeDate: selectedOnD, fullFiveRecords: contexts.filter(p => p.selectedRecords === 5).length, nativeDateCoverage: coverage,
    supportScores: 0, buySellLabels: 0, discrepancyEvidence: "not_bound_in_this_export", pins: PINS, networkRequests: 0 };
  fs.writeFileSync(requestOut, requestBytes, { flag: "wx", mode: 0o600 });
  fs.writeFileSync(contextOut, contextBytes, { flag: "wx", mode: 0o600 });
  fs.writeFileSync(summaryOut, JSON.stringify(summary, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  return summary;
}

module.exports = { exportContext, checkRequestShape, PINS };

if (require.main === module) {
  const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  try {
    const s = exportContext({ captureDir: arg("capture"), conversionDir: arg("conversion"), requestOut: arg("request-out"), contextOut: arg("context-out"),
      summaryOut: arg("summary-out"), allowSimulated: process.argv.includes("--allow-simulated") });
    process.stdout.write(`${JSON.stringify({ ok: true, requestSHA256: s.requestSHA256, contextSHA256: s.contextSHA256, profiles: s.profiles,
      selectedSourceRows: s.selectedSourceRows, selectedRowsOnNativeDate: s.selectedRowsOnNativeDate, nativeDateCoverage: s.nativeDateCoverage })}\n`);
  } catch (e) {
    process.stdout.write(`${JSON.stringify({ ok: false, refusal: e instanceof Refusal ? e.code : `export_error_${e?.constructor?.name ?? "unknown"}` })}\n`);
    process.exitCode = 2;
  }
}
