// Offline source reproduction; no application edits or real database calls.
// Run: env -i PATH=/usr/local/bin:/usr/bin:/bin node <this-file>
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const deny = () => { throw new Error('CTPI_AUDIT_NETWORK_DENIED'); };
net.connect = net.createConnection = deny;
net.Socket.prototype.connect = deny;
http.get = http.request = https.get = https.request = deny;
globalThis.fetch = deny;
require('node:module').syncBuiltinESMExports();

const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'web/node_modules/typescript/lib/typescript.js'));
const routePath = 'web/pages/api/v1/db/update-team-ctpi-daily.ts';
const helperPath = 'web/lib/trends/ctpi.ts';
const hash = source => crypto.createHash('sha256').update(source).digest('hex');
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-22T10:10:00.000Z'])); }
  static now() { return new Date('2026-10-22T10:10:00.000Z').getTime(); }
}

function load(source, file, imports) {
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({
    module, exports: module.exports, Date: FixedDate,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://unit-tests.supabase.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-only' } },
    console: { error() {}, warn() {}, log() {} },
    require(name) {
      if (!Object.hasOwn(imports, name)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
    fetch: deny,
  });
  new vm.Script(output, { filename: file }).runInContext(context);
  return module.exports;
}

function sourceFor(ref, file) {
  return ref === 'canonical'
    ? fs.readFileSync(path.join(root, file), 'utf8')
    : childProcess.execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, encoding: 'utf8' });
}

async function invoke(routeSource, helper, rows, query = {}) {
  const batches = [];
  const from = table => {
    const builder = {
      table, select() { return this; }, eq() { return this; }, order() { return this; },
      limit: async () => ({ data: [], error: null }), // No current-season stored date: start at season start.
      then: resolve => Promise.resolve({ count: 0, error: null }).then(resolve),
      async upsert(batch, options) {
        assert.equal(table, 'team_ctpi_daily');
        assert.equal(options.onConflict, 'season_id,team,date');
        const copy = JSON.parse(JSON.stringify(batch));
        batches.push(copy);
        const keys = copy.map(row => `${row.season_id}|${row.team}|${row.date}`);
        // Explicitly a simulated database contract, not a PostgreSQL execution.
        return { error: new Set(keys).size < keys.length
          ? { code: '21000', message: 'ON CONFLICT DO UPDATE command cannot affect row a second time' }
          : null };
      },
    };
    return builder;
  };
  const handler = load(routeSource, routePath, {
    '@supabase/supabase-js': { createClient: () => ({ from }) },
    dotenv: { config() {} },
    'lib/cron/withCronJobAudit': { withCronJobAudit: fn => fn },
    'lib/cron/nhlOffSeason': { withNhlOffSeasonSkip: fn => fn },
    'utils/adminOnlyMiddleware': fn => fn,
    'utils/fetchCurrentSeason': { fetchCurrentSeason: async () => ({ id: 20262027, startDate: '2026-10-07', endDate: '2027-06-20' }) },
    'lib/power-ratings': { fetchPaginatedRows: async factory => factory().table === 'nst_team_gamelogs_as_rates' ? rows : [] },
    'lib/trends/ctpi': helper,
  }).default;
  const res = { statusCode: 200, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'GET', query }, res);
  return { status: res.statusCode, body: res.body, batches };
}

(async () => {
  const output = { node: process.version, network: 'denied; all service boundaries mocked', database: 'simulated duplicate-key rejection; no PostgreSQL execution', refs: [] };
  for (const ref of ['canonical', 'origin/master']) {
    const source = sourceFor(ref, routePath), helperSource = sourceFor(ref, helperPath);
    const helper = load(helperSource, helperPath, {});
    const row = (team, date) => ({ team_abbreviation: team, date, gp: 1, xgf_per_60: 3, xga_per_60: 2, gf_per_60: 2, hdcf_per_60: 4, hdca_per_60: 3, ca_per_60: 45, cf_pct: 55, pdo: 100 });
    const delayed = [row('AAA', '2026-10-08'), row('BBB', '2026-10-09')];

    const failure = await invoke(source, helper, delayed);
    assert.equal(failure.status, 500);
    assert.equal(failure.body.error, 'ON CONFLICT DO UPDATE command cannot affect row a second time');
    const blanks = failure.batches[0].filter(r => r.date === '2026-10-07');
    assert.equal(blanks.length, 2);
    assert.ok(blanks.every(r => r.team === '' && r.payload.sourceGameCount === 0));

    const currentDate = await invoke(source, helper, delayed, { start: '2026-10-22' });
    assert.equal(currentDate.status, 200);
    assert.equal(currentDate.batches[0].length, 2);
    assert.ok(currentDate.batches[0].every(r => r.team && r.payload.sourceGameCount > 0));

    const singleMissing = await invoke(source, helper, [row('AAA', '2026-10-07'), row('BBB', '2026-10-08')]);
    assert.equal(singleMissing.status, 200);
    assert.equal(singleMissing.batches[0].filter(r => r.team === '' && r.date === '2026-10-07').length, 1);

    const duplicateInput = await invoke(source, helper, [row('AAA', '2026-10-07'), row('AAA', '2026-10-07')]);
    assert.equal(duplicateInput.status, 200); // Same raw team rows group once; not enough to create this collision.
    const empty = await invoke(source, helper, []);
    assert.equal(empty.body.reason, 'no_source_rows');
    assert.equal(empty.batches.length, 0);
    output.refs.push({ ref, routeSha256: hash(source), helperSha256: hash(helperSource),
      checks: ['two empty histories produce duplicate blank-team keys and 500', 'current-date history emits distinct valid team keys', 'one empty history silently emits one invalid blank-team row', 'duplicate input rows alone do not duplicate destination team keys', 'empty season source is skipped without upsert'],
      reproducedStatus: failure.status, reproducedMessage: failure.body.error,
      conflictingKeys: blanks.map(r => [r.season_id, r.team, r.date]),
      capturedFirstBatchRows: failure.batches[0].length,
    });
  }
  console.log(JSON.stringify(output, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
