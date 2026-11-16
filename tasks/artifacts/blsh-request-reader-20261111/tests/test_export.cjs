// Offline tests for export_context.cjs. Needs READER_CAPTURES=<scratch with cap-full, cap-no-nst-1111> (tests/run_all.sh).
"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), os = require("node:os");
const { spawnSync } = require("node:child_process");
const Module = require("node:module");
const ROOT = path.resolve(__dirname, ".."), REPO = "/Users/tim/Code/fhfhockey.com", WEB = path.join(REPO, "web");
const { exportContext, checkRequestShape, PINS } = require(path.join(ROOT, "export_context.cjs"));
const CAPS = process.env.READER_CAPTURES;
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const tmp = () => fs.mkdtempSync(path.join(CAPS, "exp-"));

function conversion(dir, { date = "2026-11-11", games, klass = "candidate_pending_independent_review" }) {
  fs.mkdirSync(dir);
  const files = { "CONVERSION.json": Buffer.from(JSON.stringify({ evidenceClass: klass, date, scheduleFacts: { date, games: games.map(gameId => ({ gameId })) } })) };
  for (const [n, b] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), b);
  fs.writeFileSync(path.join(dir, "MANIFEST.json"), JSON.stringify({ files: Object.entries(files).map(([file, b]) => ({ file, sha256: sha(b), bytes: b.length })) }));
  return dir;
}
const request = cap => JSON.parse(fs.readFileSync(path.join(CAPS, cap, "SIMULATED-REQUEST.json"), "utf8"));
const gamesOn = (req, d) => req.calendar.rows.filter(g => g.date === d).map(g => g.id);
function run(over = {}) {
  const d = tmp(), req = request(over.cap ?? "cap-full");
  const conv = conversion(path.join(d, "conv"), { games: over.games ?? gamesOn(req, "2026-11-11"), date: over.date });
  const o = { captureDir: path.join(CAPS, over.cap ?? "cap-full"), conversionDir: conv, requestOut: path.join(d, "request.json"),
    contextOut: path.join(d, "context.json"), summaryOut: path.join(d, "SUMMARY.json"), allowSimulated: over.allowSimulated ?? true };
  return { d, o, run: () => exportContext(o) };
}
const refuses = (fn, code) => assert.throws(fn, e => e.code === code, `expected ${code}`);

function loadTsBytes(src, p) {
  const ts = require(path.join(WEB, "node_modules/typescript/lib/typescript.js")), m = new Module(p);
  m._compile(ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, p);
  return m.exports;
}

test("productionReference re-pin: outcomes and FHFH_WEIGHTS equal across 9a56af85 -> ec3afb69 on every retained WGO row", () => {
  const rel = "web/lib/buyLowSellHigh/productionReference.ts";
  const old = spawnSync("/usr/bin/git", ["-C", REPO, "show", `db7a64c58~1:${rel}`], { env: { PATH: "/usr/bin:/bin" }, maxBuffer: 1 << 24 }).stdout;
  assert.equal(sha(old), "9a56af85486c850aebc2df4d3ad218b43ca2bbeb3a7073453a0c38189a4be85e");
  const nowBytes = fs.readFileSync(path.join(REPO, rel));
  assert.equal(sha(nowBytes), PINS.productionReference);
  const a = loadTsBytes(old.toString("utf8"), path.join(WEB, "lib/buyLowSellHigh/productionReference.ts"));
  const b = loadTsBytes(nowBytes.toString("utf8"), path.join(WEB, "lib/buyLowSellHigh/productionReference.ts"));
  assert.deepEqual(b.FHFH_WEIGHTS, a.FHFH_WEIGHTS);
  const retained = JSON.parse(fs.readFileSync("/Users/tim/Documents/Codex/2026-10-27/task-3/current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json", "utf8"));
  assert.equal(retained.wgo.rows.length, 8135);
  for (const r of retained.wgo.rows) assert.deepEqual(b.outcomes(r.counts), a.outcomes(r.counts));
});

test("happy export (simulated capture): verbatim request, contexts with 11-11 members, coverage 288/8 games", () => {
  const { o, run: go } = run(), s = go();
  assert.deepEqual(fs.readFileSync(o.requestOut), fs.readFileSync(path.join(CAPS, "cap-full/SIMULATED-REQUEST.json")));
  const ctx = JSON.parse(fs.readFileSync(o.contextOut, "utf8"));
  assert.equal(ctx.version, "fhfh.blsh.current-production-context.v1");
  assert.equal(ctx.captureSHA256, s.requestSHA256); assert.equal(sha(fs.readFileSync(o.contextOut)), s.contextSHA256);
  assert.ok(ctx.profiles.length > 0 && ctx.profiles.every(p => p.sourceIds.length >= 1 && p.sourceIds.length <= 5 && p.supportScore === null));
  for (const p of ctx.profiles) for (const k of ["playerId", "name", "sourceIds", "shots"]) assert.ok(k in p); // intake.py fields
  assert.deepEqual(s.nativeDateCoverage, { date: "2026-11-11", games: 8, expectedWgoRows: 288, wgoRows: 288, individualUnique: s.nativeDateCoverage.individualUnique,
    onIceUnique: s.nativeDateCoverage.onIceUnique, scheduleGamesMissingFromCapture: [], capturedGamesNotInSchedule: [], wgoRowsOutsideSchedule: 0,
    wgoRowsComplete: true });
  assert.ok(s.nativeDateCoverage.individualUnique > 0 && s.nativeDateCoverage.onIceUnique > 0);
  assert.ok(s.selectedRowsOnNativeDate > 0 && s.selectedSourceRows <= 5000);
  for (const p of [o.requestOut, o.contextOut, o.summaryOut]) assert.equal(fs.statSync(p).mode & 0o777, 0o600);
});

test("live mode refuses a simulated capture", () => refuses(run({ allowSimulated: false }).run, "capture_not_complete_or_simulated"));

test("outputs are never overwritten", () => {
  const r = run(); fs.writeFileSync(r.o.contextOut, "{}"); refuses(r.run, "output_exists_or_relative");
  assert.equal(fs.existsSync(r.o.requestOut), false);
});

test("conversion date must match; schedule shortfalls are reported, a disjoint schedule stops", () => {
  refuses(run({ date: "2026-11-10" }).run, "conversion_date_not_event_through_date");
  refuses(run({ games: [2026029993, 2026029994] }).run, "no_wgo_rows_on_native_date_games");
  const ids = gamesOn(request("cap-full"), "2026-11-11");
  const extra = run({ games: [...ids, 2026029999] }).run().nativeDateCoverage; // a scheduled game the capture lacks (no WGO rows)
  assert.deepEqual([extra.scheduleGamesMissingFromCapture, extra.wgoRowsComplete, extra.expectedWgoRows, extra.wgoRows], [[2026029999], false, 324, 288]);
  const fewer = run({ games: ids.slice(1) }).run().nativeDateCoverage; // capture holds a game the schedule lacks
  assert.deepEqual([fewer.capturedGamesNotInSchedule, fewer.wgoRowsOutsideSchedule > 0, fewer.wgoRows > 0], [[ids[0]], true, true]);
});

test("no stored NST rows on 11-11 is a stop before assemble (it would yield 0 entries)", () => {
  refuses(run({ cap: "cap-no-nst-1111" }).run, "no_stored_nst_rows_on_native_date");
});

test("capture tamper: request bytes, RAW binding", () => {
  const d = tmp(), cap = path.join(d, "cap");
  fs.cpSync(path.join(CAPS, "cap-full"), cap, { recursive: true });
  const r = run(); r.o.captureDir = cap;
  fs.appendFileSync(path.join(cap, "SIMULATED-REQUEST.json"), " ");
  refuses(r.run, "capture_request_hash_drift");
  const cap2 = path.join(d, "cap2"); fs.cpSync(path.join(CAPS, "cap-full"), cap2, { recursive: true });
  fs.appendFileSync(path.join(cap2, "RAW-onIce.json"), " "); r.o.captureDir = cap2;
  refuses(r.run, "raw_hash_binding:onIce");
});

test("exact request contract: extra or missing keys at every level", () => {
  const base = request("cap-full");
  const cases = [
    [q => { q.extra = 1; }, "request_top_level_keys"], [q => { delete q.captureContext; }, "request_top_level_keys"],
    [q => { q.freshnessPolicy.maxEventAgeDays = 8; }, "request_freshness_policy"],
    [q => { q.onIce.extra = 1; }, "request_feed_keys:onIce"], [q => { delete q.individual.toiUnit; }, "request_feed_keys:individual"],
    [q => { q.wgo.capture.extra = 1; }, "request_capture_keys:wgo"],
    [q => { q.calendar.rows[0].extra = 1; }, "request_row_keys:calendar"], [q => { delete q.individual.rows[0].ixg; }, "request_row_keys:individual"],
    [q => { q.wgo.rows[0].goals = 1; }, "request_row_keys:wgo"], [q => { delete q.wgo.rows[0].counts.shots; }, "request_row_keys:wgo.counts"],
  ];
  checkRequestShape(structuredClone(base));
  for (const [mutate, code] of cases) { const q = structuredClone(base); mutate(q); refuses(() => checkRequestShape(q), code); }
});

test("CLI: one JSON line, exit 2 on refusal", () => {
  const out = spawnSync("/usr/local/bin/node", [path.join(ROOT, "export_context.cjs"), "--capture", path.join(CAPS, "cap-full")], { env: { PATH: "/usr/bin:/bin" } });
  assert.equal(out.status, 2);
  assert.equal(JSON.parse(out.stdout.toString()).ok, false);
});
