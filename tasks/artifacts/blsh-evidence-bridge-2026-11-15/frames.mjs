// OfficialFrame builder. Offline: consumes ALREADY-retrieved official boxscores; never fetches.
//
// Official source (one call per GAME, not per player):
//   GET https://api-web.nhle.com/v1/gamecenter/{gameId}/boxscore
// Body shape verified offline against retained bodies (source-vintage-20261101-01/live-02/*-boxscore.body.json).
//
// PRODUCTION accepts ONLY a completed acquisition directory written by acquire-boxscores.mjs (ACQUISITION-SPEC.md):
//   - completion MANIFEST.json present, no FAILED.json / temp manifest, every file listed and hash-equal;
//   - EXACTLY one operation journal + body + receipt per game on the packet's verified schedule (no prefix, extra, retry);
//   - runtime (v2): exact keys incl. a launch block (canonical tool path, cwd = web root, NO launch/ts-node keys), execArgv [],
//     node pinned to APPROVED.nodeSHA256 (never caller-supplied), global dispatcher unset at start, the fixed output path
//     for the date, bound to this conversion; per-request TLS chain (convert.mjs verifyTlsChain) incl. CA-store re-read;
//   - receipts (v3): exact keys, finalUrl == url, redirected === false, HTTP 200, exactly one sendHeaders, dispatcher unchanged,
//     bound to the acquisition start;
//   - tool hash computed HERE from the bound source-tool.mjs (never trusted as self-reported) and in
//     APPROVED_ACQUISITION_TOOLS, which stays EMPTY until the tool is independently reviewed.
// `testMode` (function option only, never CLI) skips the launch / tool / pin checks, and its output is marked so
// assemble/propose refuse it. A receipt's own `TLSVerified: true` is never accepted outside test mode.
//
// Finality/completion: completedByUTC = the EARLIEST retrieval of an official observation showing the game final
// (the packet's TLS-verified schedule call, or the boxscore itself). Never start time plus a guess.
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APPROVED, WEB_ROOT, checkRuntimeCore, verifyTlsChain } from "./convert.mjs";
import { fixedOutputPath } from "./acquire-boxscores.mjs"; // node:-only module; importing it runs nothing
import { BridgeRefusal, MIB, SEASON, createOutput, encode, isDay, need, parseJson, readBound, sha, stamp } from "./lib.mjs";

/** sha256 of reviewed acquisition-tool sources. Adding a hash is a reviewed change, not the bridge lane's.
 * aa8a9cb7…: RECHECK-4 APPROVE; added by Chef (non-author) at TJ's direction, 2026-11-15; reviewer check RECHECK-10. */
export const APPROVED_ACQUISITION_TOOLS = Object.freeze(["aa8a9cb7e90b057e53524f3ebabc261f32f67b06eac79b4e75d64298e432b107"]);
export const ACQUISITION_TOOL_PATH = join(dirname(fileURLToPath(import.meta.url)), "acquire-boxscores.mjs");
const RECEIPT_KEYS = ["version", "operation", "url", "finalUrl", "httpStatus", "redirected", "retrievedAtUTC", "sha256", "bytes", "tls",
  "sendHeadersEvents", "globalDispatcher", "acquisitionStartedAtUTC"];
const ACQ_RUNTIME_KEYS = ["version", "startedAtUTC", "toolSHA256", "conversionSHA256", "outputDirectory", "node", "tls", "environmentPresence", "launch",
  "globalDispatcherAtStart", "valuesRecorded"];
const ACQ_LAUNCH_KEYS = ["entryScript", "entryScriptSHA256", "cwd", "environmentPresence", "otherTsNodeKeysPresent"];
const LAUNCH_ENV = ["NODE_PATH", "DISABLE_V8_COMPILE_CACHE", "TS_NODE_COMPILER_OPTIONS", "OPENSSL_CONF", "TS_NODE_PROJECT", "TS_NODE_SKIP_PROJECT", "TS_NODE_COMPILER",
  "TS_NODE_TRANSPILE_ONLY", "TS_NODE_REQUIRE", "TS_NODE_CWD", "TS_NODE_DIR", "TS_NODE_COMPILER_HOST", "TS_NODE_EMIT", "TS_NODE_SCOPE", "TS_NODE_SCOPE_DIR",
  "TS_NODE_SWC", "TS_NODE_TRANSPILER"];
const sameKeys = (o, keys) => !!o && typeof o === "object" && !Array.isArray(o) && JSON.stringify(Object.keys(o).sort()) === JSON.stringify([...keys].sort());
const boxscoreUrl = gameId => `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`;
const toiSeconds = text => {
  need(typeof text === "string" && /^\d{1,3}:[0-5]\d$/.test(text), "official_toi_format");
  const [m, s] = text.split(":").map(Number); return m * 60 + s;
};

/** Read a completed acquisition directory. Structural refusals apply in every mode. */
export function readAcquisition(dir, scheduleFacts) {
  const names = readdirSync(dir);
  need(!names.includes("FAILED.json"), "acquisition_failed_or_partial");
  need(!names.includes(".MANIFEST.json.tmp"), "acquisition_unpublished_manifest");
  need(names.includes("MANIFEST.json"), "acquisition_manifest_missing");
  const manifestBytes = readBound(join(dir, "MANIFEST.json"), 4 * MIB), manifest = parseJson(manifestBytes, "acquisition_manifest_invalid");
  need(manifest.status === "acquisition_complete_pending_review" && Array.isArray(manifest.files), "acquisition_manifest_invalid");
  const files = new Map();
  for (const f of manifest.files) {
    const bytes = readBound(join(dir, f.file), 4 * MIB);
    need(!files.has(f.file) && sha(bytes) === f.sha256 && bytes.length === f.bytes, "acquisition_hash_drift");
    files.set(f.file, bytes);
  }
  need(names.every(n => n === "MANIFEST.json" || files.has(n)), "acquisition_unlisted_file");
  // Exactly one journal + body + receipt per scheduled game, in schedule (sorted id) order. Prefixes, extras and
  // retries (a second STARTED, a duplicate game) all change this set.
  const ids = scheduleFacts.games.map(g => g.gameId).sort((a, b) => a - b);
  const expected = ["ACQUISITION-RUNTIME.json", "source-tool.mjs", ...ids.flatMap((id, k) => [`operation-${k + 1}-STARTED.json`, `boxscore-${id}.body.json`, `boxscore-${id}.receipt.json`])];
  need(JSON.stringify([...files.keys()].sort()) === JSON.stringify(expected.sort()), "acquisition_incomplete_or_extra");
  return { ids, files, manifestBytes };
}

/** Production checks on a read acquisition (skipped only in test mode). */
function verifyAcquisition({ ids, files }, conversionSHA256, scheduleDate) {
  const runtimeBytes = files.get("ACQUISITION-RUNTIME.json"), runtime = parseJson(runtimeBytes, "acquisition_runtime_invalid");
  const receipts = ids.map(id => parseJson(files.get(`boxscore-${id}.receipt.json`), "boxscore_receipt_invalid"));
  need(receipts.every(r => !Object.hasOwn(r, "syntheticTestOnly")) && !Object.hasOwn(runtime, "syntheticTestOnly"), "boxscore_receipt_synthetic_marker");
  need(receipts.every(r => !Object.hasOwn(r, "TLSVerified")), "boxscore_receipt_self_asserted_tls");
  need(runtime.version === "fhfh.blsh.official-acquisition-runtime.v2" && sameKeys(runtime, ACQ_RUNTIME_KEYS), "acquisition_runtime_missing_or_shape");
  need(runtime.conversionSHA256 === conversionSHA256, "acquisition_not_for_this_conversion");
  need(runtime.outputDirectory === fixedOutputPath(scheduleDate), "acquisition_output_path_not_fixed");
  // RECHECK-2 F1: the tool is self-contained (node: builtins only), so nothing may be preloaded and no global dispatcher may exist.
  need(Array.isArray(runtime.node?.execArgv) && runtime.node.execArgv.length === 0, "acquisition_exec_argv_not_empty");
  checkRuntimeCore(runtime, APPROVED.nodeSHA256); // node pin is the constant, never a caller argument
  need(runtime.globalDispatcherAtStart === "unset", "acquisition_global_dispatcher_preinstalled");
  const toolSHA256 = sha(files.get("source-tool.mjs")); // computed here, not taken from the runtime's claim
  const l = runtime.launch;
  need(sameKeys(l, ACQ_LAUNCH_KEYS) && sameKeys(l.environmentPresence, LAUNCH_ENV) && Object.values(l.environmentPresence).every(v => typeof v === "boolean") &&
    Array.isArray(l.otherTsNodeKeysPresent), "acquisition_launch_shape");
  need(LAUNCH_ENV.every(k => l.environmentPresence[k] === false) && l.otherTsNodeKeysPresent.length === 0, "acquisition_launch_override_present");
  need(l.entryScript === ACQUISITION_TOOL_PATH && l.entryScriptSHA256 === toolSHA256 && runtime.toolSHA256 === toolSHA256 && l.cwd === WEB_ROOT, "acquisition_not_launched_canonically");
  const ops = {};
  receipts.forEach((r, k) => {
    const id = ids[k], started = parseJson(files.get(`operation-${k + 1}-STARTED.json`), "acquisition_journal_invalid");
    need(sameKeys(r, RECEIPT_KEYS) && r.version === "fhfh.blsh.official-boxscore-receipt.v3", "boxscore_receipt_shape");
    need(r.sendHeadersEvents === 1 && r.globalDispatcher === "unchanged", "boxscore_wire_or_dispatcher_unqualified");
    need(r.operation === k + 1 && started.operation === k + 1 && r.url === boxscoreUrl(id) && started.url === r.url, "boxscore_operation_sequence");
    need(r.httpStatus === 200 && r.redirected === false && r.finalUrl === r.url, "boxscore_transport_unqualified");
    need(r.acquisitionStartedAtUTC === runtime.startedAtUTC && stamp(r.retrievedAtUTC) >= stamp(started.startedAtUTC) &&
      stamp(started.startedAtUTC) >= stamp(runtime.startedAtUTC), "boxscore_receipt_not_bound_to_acquisition");
    ops[k + 1] = { started: { url: r.url, operation: `boxscore:${k + 1}` }, settled: { tls: r.tls } };
  });
  verifyTlsChain(ops, {}, runtime.tls.defaultCACertificatesSHA256);
  need(APPROVED_ACQUISITION_TOOLS.includes(toolSHA256), "acquisition_tool_not_reviewed");
  return receipts;
}

function buildFrames(scheduleFacts, boxscores, receipts, receiptClass) {
  const date = scheduleFacts.date, scheduleAt = stamp(scheduleFacts.retrievedAtUTC);
  const scheduled = new Map(scheduleFacts.games.map(g => [g.gameId, g]));
  const teamGames = new Map();
  for (const g of scheduleFacts.games) for (const t of [g.home, g.away]) teamGames.set(t, (teamGames.get(t) ?? 0) + 1);
  const frames = [], seenGames = new Set(), seenPlayers = new Set();
  boxscores.forEach(({ receiptBytes, bodyBytes }, k) => {
    const receipt = receipts[k], body = parseJson(bodyBytes, "boxscore_body_invalid");
    const gameId = body?.id;
    need(Number.isSafeInteger(gameId) && scheduled.has(gameId) && !seenGames.has(gameId), "boxscore_game_not_scheduled_or_duplicate");
    seenGames.add(gameId);
    const at = receipt.retrievedAtUTC ?? receipt.at; // `at` only in legacy (test-mode) receipts
    need(receipt.url === boxscoreUrl(gameId) && receipt.httpStatus === 200 && receipt.redirected !== true, "boxscore_transport_unqualified");
    need(receipt.sha256 === sha(bodyBytes) && receipt.bytes === bodyBytes.length, "boxscore_hash_mismatch");
    const observedAt = stamp(at, "boxscore_time_invalid");
    need(body.season === SEASON && body.gameType === 2 && body.gameDate === date && ["OFF", "FINAL"].includes(body.gameState) && body.gameScheduleState === "OK", "boxscore_not_final_regular_season_on_date");
    const s = scheduled.get(gameId);
    need(body.homeTeam?.abbrev === s.home && body.awayTeam?.abbrev === s.away, "boxscore_teams_drift");
    const completedByUTC = scheduleAt <= observedAt ? scheduleFacts.retrievedAtUTC : at;
    for (const side of ["awayTeam", "homeTeam"]) {
      const team = body[side].abbrev, stats = body.playerByGameStats?.[side];
      need(stats && Array.isArray(stats.forwards) && Array.isArray(stats.defense), "boxscore_player_stats_missing");
      for (const p of [...stats.forwards, ...stats.defense]) {
        need(Number.isSafeInteger(p.playerId) && p.playerId > 0, "boxscore_player_identity");
        need(!seenPlayers.has(p.playerId), "player_on_multiple_rows_for_date"); seenPlayers.add(p.playerId);
        const totalToiSeconds = toiSeconds(p.toi);
        if (totalToiSeconds === 0) continue; // listed without exposure: no frame, never a zero-TOI appearance
        const gamesOnNativeDate = teamGames.get(team) ?? 0;
        frames.push({
          seasonId: SEASON, playerId: p.playerId, gameId, date, team, final: true, gamesPlayed: 1, totalToiSeconds,
          completedByUTC, observedAtUTC: at, gamesOnNativeDate, dateMembershipComplete: gamesOnNativeDate === 1,
          provenance: { boxscoreSHA256: receipt.sha256, boxscoreReceiptSHA256: sha(receiptBytes), scheduleSHA256: scheduleFacts.scheduleSHA256, receiptClass },
        });
      }
    }
  });
  return frames;
}

const checkFacts = f => need(isDay(f?.date) && Array.isArray(f.games) && f.games.length > 0, "schedule_facts_invalid");

/** Production (or test-mode) frames from ONE completed acquisition directory. */
export function framesFromAcquisition(scheduleFacts, conversionSHA256, acquisitionDir, { testMode = false } = {}) {
  checkFacts(scheduleFacts);
  const acq = readAcquisition(acquisitionDir, scheduleFacts);
  const boxscores = acq.ids.map(id => ({ bodyBytes: acq.files.get(`boxscore-${id}.body.json`), receiptBytes: acq.files.get(`boxscore-${id}.receipt.json`) }));
  const receipts = testMode ? boxscores.map(b => parseJson(b.receiptBytes, "boxscore_receipt_invalid")) : verifyAcquisition(acq, conversionSHA256, scheduleFacts.date);
  return { acq, frames: buildFrames(scheduleFacts, boxscores, receipts, testMode ? "test_mode_unverified_transport" : "acquisition_v2_tls_verified") };
}

/** TEST MODE ONLY: frames from loose body/receipt pairs (e.g. retained legacy receipts). Production must use a directory. */
export function framesFromBoxscores(scheduleFacts, boxscores, { testMode = false } = {}) {
  checkFacts(scheduleFacts);
  need(Array.isArray(boxscores) && boxscores.length > 0, "no_official_boxscores_supplied");
  const receipts = boxscores.map(b => parseJson(b.receiptBytes, "boxscore_receipt_invalid"));
  if (!testMode) {
    need(receipts.every(r => !Object.hasOwn(r, "TLSVerified")), "boxscore_receipt_self_asserted_tls");
    throw new BridgeRefusal("acquisition_directory_required");
  }
  return buildFrames(scheduleFacts, boxscores, receipts, "test_mode_unverified_transport");
}

function emit(out, scheduleFacts, frames, mode, gamesWithBoxscore) {
  const index = frames.map(f => ({ playerId: f.playerId, gameId: f.gameId, sha256: out.write(`frame-${f.gameId}-${f.playerId}.json`, encode(f)) }));
  out.writeJson("FRAMES.json", { version: "fhfh.blsh.official-frames.v1", date: scheduleFacts.date, mode, frames: index, gamesWithBoxscore: gamesWithBoxscore.size,
    scheduledGamesWithoutBoxscore: scheduleFacts.games.map(g => g.gameId).filter(id => !gamesWithBoxscore.has(id)), networkRequests: 0 });
  out.complete("frames_built_from_supplied_official_bytes");
  return { frames, index };
}

/** Frames from a completed acquisition directory; every acquisition file is copied and bound (prefix `acquisition-`). */
export function writeFramesFromAcquisition({ conversionDir, acquisitionDir, outDir, testMode = false }) {
  const conversionBytes = readBound(join(conversionDir, "CONVERSION.json"), MIB), conversion = parseJson(conversionBytes);
  const { acq, frames } = framesFromAcquisition(conversion.scheduleFacts, sha(conversionBytes), acquisitionDir, { testMode });
  const out = createOutput(outDir);
  out.write("acquisition-MANIFEST.json", acq.manifestBytes);
  for (const [name, bytes] of acq.files) out.write(`acquisition-${name}`, bytes);
  return emit(out, conversion.scheduleFacts, frames, testMode ? "test_mode" : "production", new Set(acq.ids));
}

/** TEST MODE ONLY: frames from loose pairs (synthetic fixtures, retained legacy receipts). */
export function writeFrames({ scheduleFacts, boxscores, outDir, acquisitionRuntimeBytes = null, testMode = false }) {
  need(testMode === true, "acquisition_directory_required");
  const frames = framesFromBoxscores(scheduleFacts, boxscores, { testMode: true });
  const out = createOutput(outDir);
  for (const { receiptBytes, bodyBytes } of boxscores) {
    const id = parseJson(bodyBytes).id;
    out.write(`boxscore-${id}.body.json`, bodyBytes); out.write(`boxscore-${id}.receipt.json`, receiptBytes);
  }
  if (acquisitionRuntimeBytes) out.write("ACQUISITION-RUNTIME.json", acquisitionRuntimeBytes);
  return emit(out, scheduleFacts, frames, "test_mode", new Set(boxscores.map(b => parseJson(b.bodyBytes).id)));
}

/** Exact acquisition arithmetic for latest-five windows. Input: [{ playerId, games: [{ date, gameId }] }]. */
export function acquisitionPlan(windows) {
  const games = new Set(), dates = new Set();
  let shortWindows = 0;
  for (const w of windows) {
    if (w.games.length !== 5) shortWindows++;
    for (const g of w.games) { games.add(g.gameId); dates.add(g.date); }
  }
  return { players: windows.length, shortWindows,
    perPlayer: { boxscoreCalls: 5, nativeCaptureDates: 5, nstRequests: 10 },
    cohort: { boxscoreCalls: games.size, nativeCaptureDates: dates.size, nstRequests: 2 * dates.size, scheduleCalls: dates.size } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  try {
    // Production only: a converted packet directory and a completed acquisition directory. No node pin argument.
    const r = writeFramesFromAcquisition({ conversionDir: arg("conversion"), acquisitionDir: arg("acquisition"), outDir: arg("out") });
    process.stdout.write(`${JSON.stringify({ ok: true, frames: r.frames.length })}\n`);
  } catch (e) {
    process.stdout.write(`${JSON.stringify({ ok: false, refusal: e instanceof BridgeRefusal ? e.code : e?.code === "EEXIST" ? "output_exists" : "frames_error" })}\n`); process.exitCode = 2;
  }
}
