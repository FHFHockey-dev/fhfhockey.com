// Artifact-only historical projection. No apply mode, app imports or transports.
// Run: node tasks/artifacts/wigo-player-card-investigation-2026-10-24/dry-run-only/calculate.cjs
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
assert.equal(process.argv.length, 2, 'This program has no arguments or apply mode.');
const investigation = path.resolve(__dirname, '..');
const root = path.resolve(investigation, '../../..');
const ts = require(path.join(root, 'web/node_modules/typescript'));
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const inputHashes = {};
function read(relative) {
  const text = fs.readFileSync(path.join(investigation, relative), 'utf8');
  inputHashes[relative] = sha(text);
  return text;
}
const source = read('local-fix/candidate/web/pages/api/v1/db/calculate-wigo-stats.ts');
assert.equal(sha(source), 'f438eb129e1f70dd0691151916e78a8ea2225412ec63847ce93e334bc9ee9fa6');
const rows1 = JSON.parse(read('production-diagnostic/query-1-rows.json'));
const rows2 = JSON.parse(read('production-diagnostic/query-2-rows.json'));
const diagnostic = JSON.parse(read('production-diagnostic/summary.json'));
assert.equal(rows1.find(row => row.source === 'player').payload.id, 8476453);
const preimage = rows1.find(row => row.source === 'wigo_recent').payload;
const captured = name => rows2.filter(row => row.source === name).map(row => row.payload);
const input = { playerId: 8476453, nhl: captured('nhl_log'), individual: captured('nst_individual_log'), onIce: captured('nst_on_ice_log') };
for (const rows of [input.nhl, input.individual, input.onIce]) assert.equal(rows.length, 20);

// Compile exact pure statement ranges from the pinned accepted source. Never
// load the route module, invoke its handler, simulate its queries or copy a
// separately maintained version of the metric formulas.
const sourceRanges = [];
function between(name, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a && source.indexOf(start, a + 1) === -1, name);
  const fragment = source.slice(a, b);
  sourceRanges.push({ name, startLine: source.slice(0, a).split('\n').length,
    endLine: source.slice(0, b).split('\n').length - 1, sha256: sha(fragment) });
  return fragment;
}
const fragments = [
  between('pure arithmetic helpers', '// Helper functions for calculations', '// Pagination helper for fetching player IDs'),
  between('NHL identity/frame validation', '      const gameIds = new Set<number>();', '      // Keep the existing cross-season NHL window;'),
  between('season/date join and missing-value mapping', '      // --- Combine Game Log Data ---', '      // --- End Combine Game Log ---'),
  between('recent window calculation and coverage gates', '      // --- Calculate L5, L10, L20 for recentStats ---', '      // --- End L5/L10/L20 Calcs ---')
];
assert(!/\b(?:supabase|handler|fetch|require|process)\b|\.upsert\s*\(/.test(fragments.join('\n')), 'Transport/handler code is forbidden in the projection.');
const program = `(function(input) {
const playerId = input.playerId;
const wgoLogs = input.nhl;
const nstIndGamelogRes = { data: input.individual };
const nstOiGamelogRes = { data: input.onIce };
const recentStats = { player_id: playerId };
${fragments.join('\n')}
return recentStats;
})(__input);`;
const compiled = ts.transpileModule(program, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const projected = new vm.Script(compiled, { filename: 'pinned-pure-wigo-projection.js' })
  .runInNewContext({ __input: input, fetch: undefined, require: undefined, process: undefined },
    { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });

// Whitelist only metrics whose required source columns were in the approved
// capture. Unqueried columns must not become proposed null writes.
const capturedMetrics = ['gp', 'atoi', 'pptoi', 'g', 'a', 'pts', 'pts1_pct', 'sog', 's_pct', 'ixg', 'ipp', 'oi_sh_pct', 'icf', 'ppp',
  'g_per_60', 'a_per_60', 'pts_per_60', 'pts1_per_60', 'sog_per_60', 'ixg_per_60', 'icf_per_60', 'ihdcf_per_60', 'iscf_per_60', 'ppp_per_60'];
const historicalProjection = { player_id: 8476453 };
for (const n of [5, 10, 20]) for (const metric of capturedMetrics) historicalProjection[`l${n}_${metric}`] = projected[`l${n}_${metric}`];
const dependent = ['atoi', 'ixg', 'icf', 'ipp', 'oi_sh_pct', 'g_per_60', 'a_per_60', 'pts_per_60', 'pts1_per_60', 'sog_per_60',
  'ixg_per_60', 'icf_per_60', 'ihdcf_per_60', 'iscf_per_60'];
for (const n of [10, 20]) for (const metric of dependent) assert.equal(historicalProjection[`l${n}_${metric}`], null);
assert.equal(historicalProjection.l5_gp, 5);
assert.equal(historicalProjection.l5_ixg, 1.82);
assert.equal(historicalProjection.l5_icf, 35);
assert.equal(historicalProjection.l5_atoi * 60, 1262.6);

// A deliberately partial repair mask: only historical L5 nulls that have full
// captured support. Existing populated values, L10/L20, all uncaptured metrics,
// and timestamps are excluded from the proposed change set.
const fieldValues = {};
const changes = [];
for (const metric of capturedMetrics) {
  const field = `l5_${metric}`, after = historicalProjection[field];
  if (preimage[field] === null && typeof after === 'number' && Number.isFinite(after)) {
    fieldValues[field] = after;
    changes.push({ field, before: null, after });
  }
}
assert.equal(changes.length, 14);
const key = (season, date) => `${season}:${date}`;
const coverage = [5, 10, 20].map(n => {
  const games = input.nhl.slice(0, n);
  return { window: n, nhlAppearances: games.length,
    sources: ['individual', 'onIce'].map(name => {
      const keys = new Set(input[name].map(row => key(row.season, row.date_scraped)));
      const unmatched = games.filter(game => !keys.has(key(game.season_id, game.date))).map(game => ({ season: game.season_id, date: game.date }));
      return { source: name, matchedInCapture: games.length - unmatched.length,
        provenAbsentInCapturedLatest20: unmatched.filter(game => game.date === '2026-10-05'),
        notCapturedBelowOldLimit: unmatched.filter(game => game.date !== '2026-10-05') };
    }) };
});
const result = {
  mode: 'DRY_RUN_ONLY_PARTIAL_HISTORICAL_PROJECTION', commitAllowed: false,
  target: { projectRef: diagnostic.project.id, table: 'public.wigo_recent', playerId: 8476453, maximumForwardRows: 1 },
  source: { acceptedBuilderSha256: sha(source), exactSourceRanges: sourceRanges, compiledProjectionSha256: sha(compiled), inputHashes,
    capturedAt: diagnostic.queries.map(q => q.start_utc), cutoff: '2026-10-23', preimageLastUpdated: preimage.last_updated,
    execution: 'Exact pure source ranges only; no route/handler, application module imports, database client, credentials, transport, endpoint or write mode.' },
  candidatePatch: { kind: 'partial field mask, not a complete row or executable mutation', fieldValues, changes,
    timestamp: 'A later approved operation must supply one fixed new last_updated after fresh input/preimage validation.' },
  historicalProjection, coverage,
  preservedButNotRevalidatedMetrics: ['hit', 'blk', 'pim', 'ppg', 'ppa', 'pp_pct', 'ozs_pct', 'hit_per_60', 'blk_per_60', 'pim_per_60', 'ppg_per_60', 'ppa_per_60'],
  blockers: [
    'Historical capture only; no fresh production input/preimage read is authorized by this preparation.',
    'Six older L20 NST individual/on-ice rows were below the old capture limit; their existence is unknown.',
    'NHL hits/blocks/PIM/PP-goals/PP-assists/PP-share and on-ice zone-start source fields were not captured; a complete row cannot be certified.',
    'The preimage and source rows came from separate read-only transactions; no common atomic source/preimage version is proven.',
    'No reviewed bounded apply path or production release verification exists in this artifact.'
  ],
  requiredBeforeAnyLaterCommit: [
    'Separate approval and independently reviewed bounded executor; this program must remain unable to write.',
    'Verify approved production project and exact accepted calculation/runner hashes; verify hosted release separately so old scheduled code cannot overwrite the repair.',
    'Capture fresh complete source frame and full target preimage with an explicit cutoff; retain both hashes and a newly reviewed exact candidate/field mask.',
    'Conditional single-row UPDATE with target preimage equality and exact input/frame version equality at the write snapshot; reject changes, missing target or non-one row count.',
    'Fixed operation ID/timestamp, five-second statement timeout, one-second lock timeout, sixty-second total budget; retain prior/postimage and no blind retry on uncertainty.',
    'Any compensating restore must be separately within approval and require this operation exact postimage; no October5 repair or other table/player writes.'
  ]
};
fs.writeFileSync(path.join(__dirname, 'historical-preimage.json'), `${JSON.stringify(preimage, null, 2)}\n`);
fs.writeFileSync(path.join(__dirname, 'dry-run.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ mode: result.mode, commitAllowed: result.commitAllowed, changes, coverage, blockers: result.blockers }, null, 2)}\n`);
