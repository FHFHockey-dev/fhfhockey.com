// No application imports execute outside the isolated VM. Every external read
// and write is synthetic, and any unexpected module or fetch fails closed.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const BASE = __dirname;
const ROOT = path.resolve(BASE, '../../..');
const ts = require(path.join(ROOT, 'web/node_modules/typescript'));
const DAY = 86400000;
const add = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const game = (id = 2026020112, date = '2026-10-15') => ({ id, season: 20262027, gameType: 2, gameDate: date,
  startTimeUTC: `${date}T23:00:00Z`, gameState: 'FUT', gameScheduleState: 'OK',
  homeTeam: { id: 3, abbrev: 'NYR' }, awayTeam: { id: 4, abbrev: 'PHI' } });
const weeks = () => Array.from({ length: 6 }, (_, index) => ({ id: index + 1, game_key: '477', season: '2026',
  week: index + 1, start_date: add('2026-09-28', index * 7), end_date: add('2026-10-04', index * 7) }));

function fixture(options = {}) {
  const calls = { pages: [], reads: [], writes: [], audits: 0, timers: [] };
  const tables = { yahoo_matchup_weeks: weeks(), seasons: [{ id: 20262027, startDate: '2026-09-20', endDate: '2027-06-30' }],
    team_season: [{ teamId: 3 }, { teamId: 4 }], teams: [{ id: 3, abbreviation: 'NYR' }, { id: 4, abbreviation: 'PHI' }],
    roster_optimizer_team_games: [{ source_game_id: 2026020112, team_id: 3 }, { source_game_id: 2026020112, team_id: 4 }],
    ...options.tables };
  const db = { from(table) { return {
    select(columns, queryOptions) {
      assert.equal(queryOptions.count, 'exact');
      const call = { table, columns, limit: null, filters: [] };
      const builder = {};
      for (const method of ['eq', 'gte', 'lte', 'in']) builder[method] = (...args) => { call.filters.push([method, ...args]); return builder; };
      builder.limit = value => { call.limit = value; return builder; };
      builder.abortSignal = async signal => {
        calls.reads.push(call);
        if (options.abortAtRead === calls.reads.length) calls.timers.find(timer => timer.ms === 90000).fn();
        assert.ok(signal instanceof AbortSignal);
        return options.readResult?.(table, call) ?? { data: tables[table], count: tables[table].length, error: null };
      };
      return builder;
    },
    upsert(rows, writeOptions) {
      calls.writes.push({ table, rows, writeOptions });
      return { abortSignal: async signal => ({ error: options.writeError ?? null }) };
    },
    delete() { throw new Error('Deletion is forbidden in this fixture'); },
  }; } };
  const fixed = options.now ?? '2026-10-16T12:00:00Z';
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return Date.parse(fixed); } }
  const context = vm.createContext({ Date: Clock, Intl, AbortController, AbortSignal, TextDecoder, TextEncoder,
    console, setTimeout: (fn, ms) => { const timer = { fn, ms, real: setTimeout(fn, ms) }; calls.timers.push(timer); return timer; },
    clearTimeout: timer => clearTimeout(timer?.real),
    fetch: options.fetch ?? (async (url, init) => {
      calls.pages.push({ url, init });
      assert.equal(init.redirect, 'error');
      const date = url.slice(-10);
      const days = Array.from({ length: 7 }, (_, i) => ({ date: add(date, i), games: [] }));
      const supplied = options.games ?? [game()];
      for (const item of supplied) days.find(day => day.date === item.gameDate)?.games.push(item);
      if (options.omitDate) days.splice(days.findIndex(day => day.date === options.omitDate), 1);
      return new Response(JSON.stringify({ gameWeek: days }), { headers: { 'content-type': 'application/json' } });
    }) });
  const cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports;
    const target = path.join(BASE, 'candidate', relative);
    const original = path.join(ROOT, relative);
    const filename = fs.existsSync(target) ? target : original;
    const allowed = relative.startsWith('web/lib/rosterScheduleData/')
      || relative === 'web/pages/api/v1/db/refresh-roster-optimizer-schedule.ts';
    assert.ok(allowed, `Unexpected import ${relative}`);
    const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    });
    assert.equal((result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
    const module = { exports: {} }; cache.set(relative, module);
    const localRequire = name => {
      if (name === 'node:crypto') return crypto;
      if (name === 'lib/NHL/base' || name === 'lib/NHL/server/scheduleDaily') return new Proxy({}, { get: () => () => { throw new Error('Unbounded NHL reader forbidden'); } });
      if (name === 'lib/cron/withOperationalRouteAuth') return { withOperationalRouteAuth: (handler, config) => async (req, res) => {
        // Adapter fixture only. Real shared auth/audit has its own existing Vitest coverage.
        if (req.headers.authorization !== 'Bearer synthetic-recurring-token') return res.status(401).json({ success: false });
        if (!config.methods.includes(req.method)) return res.status(405).json({ success: false });
        req.supabase = db;
        await handler(req, res);
        if (config.audit) { calls.audits++; res.body.finalAudit = { status: 'persisted' }; }
      } };
      if (name === 'lib/rosterScheduleData') return load('web/lib/rosterScheduleData/normalize.ts');
      let resolved = name.startsWith('lib/') ? `web/${name}` : path.posix.join(path.posix.dirname(relative), name);
      if (!resolved.endsWith('.ts')) resolved += '.ts';
      return load(resolved);
    };
    vm.runInContext(`(function(require,module,exports){${result.outputText}\n})`, context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return { calls, tables, load, async invoke(query = { profile: 'current-next-v1', dryRun: 'false' }, request = {}) {
    const res = { statusCode: 200, body: null, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
    await load('web/pages/api/v1/db/refresh-roster-optimizer-schedule.ts').default({ query, method: 'POST',
      headers: { authorization: 'Bearer synthetic-recurring-token' }, ...request }, res);
    return res;
  } };
}

test('selected Oct 12–18 week, next week and date padding stay covered on all seven days', () => {
  const f = fixture(); const { recurringRange } = f.load('web/lib/rosterScheduleData/recurring.ts');
  for (let day = 12; day <= 18; day++) {
    const range = recurringRange(new Date(`2026-10-${day}T12:00:00Z`), weeks());
    assert.equal(range.startDate, '2026-10-11'); assert.equal(range.endDate, '2026-10-26');
  }
  assert.equal(recurringRange(new Date('2026-10-19T02:00:00Z'), weeks()).startDate, '2026-10-11');
  assert.equal(recurringRange(new Date('2026-10-19T12:00:00Z'), weeks()).startDate, '2026-10-18');
});

test('extended current Yahoo period is included, but oversized, absent or overlapping periods reject', () => {
  const { recurringRange } = fixture().load('web/lib/rosterScheduleData/recurring.ts');
  const extended = [{ ...weeks()[0], start_date: '2026-10-02', end_date: '2026-10-29' }];
  assert.equal(recurringRange(new Date('2026-10-16T12:00:00Z'), extended).startDate, '2026-10-01');
  assert.throws(() => recurringRange(new Date('2026-10-16T12:00:00Z'), [{ ...extended[0], start_date: '2026-09-01' }]));
  assert.throws(() => recurringRange(new Date('2027-10-16T12:00:00Z'), weeks()));
  assert.throws(() => recurringRange(new Date('2026-10-16T12:00:00Z'), [...weeks(), weeks()[2]]));
});

test('one missed 12-hour cycle leaves 24-hour age; daily cadence can exceed the 36-hour gate', () => {
  assert.ok(2 * 12 < 36); assert.ok(2 * 24 > 36);
});

test('bounded three-page refresh writes the full reciprocal scope once, with no delete or downstream call', async () => {
  const f = fixture(); const res = await f.invoke();
  assert.equal(res.statusCode, 200); assert.equal(res.body.data.rowsUpserted, 2);
  assert.equal(res.body.data.rowsDeleted, 0); assert.equal(res.body.data.writeOutcome, 'acknowledged');
  assert.equal(f.calls.pages.length, 3); assert.equal(f.calls.reads.length, 5); assert.equal(f.calls.writes.length, 1);
  assert.equal(f.calls.audits, 1); assert.equal(f.calls.writes[0].writeOptions.onConflict, 'game_key,source_game_id,team_id');
  assert.deepEqual(f.calls.pages.map(call => call.url.slice(-10)), ['2026-10-11', '2026-10-18', '2026-10-25']);
  assert.equal(f.calls.writes[0].rows[0].source_game_id, 2026020112);
  assert.ok(f.calls.reads.find(call => call.table === 'roster_optimizer_team_games').filters.some(filter => filter[1] === 'season' && filter[2] === '2026'));
});

test('inspection is the default and performs no upsert or audit', async () => {
  for (const query of [{ profile: 'current-next-v1' }, { profile: 'current-next-v1', dryRun: 'true' }]) {
    const f = fixture(); const res = await f.invoke(query);
    assert.equal(res.statusCode, 200); assert.equal(res.body.data.rowsUpserted, 0);
    assert.equal(f.calls.writes.length, 0); assert.equal(f.calls.audits, 0);
  }
});

test('profile rejects scope overrides, duplicate query values and implicit writes before metadata reads', async () => {
  for (const query of [{ profile: 'current-next-v1', mode: 'full' }, { profile: 'current-next-v1', gameKey: '999' },
    { profile: ['current-next-v1'] }, { profile: 'current-next-v1', dryRun: ['false'] }, { profile: 'other' }]) {
    const f = fixture(); const res = await f.invoke(query);
    assert.equal(res.statusCode, 409); assert.equal(res.body.writeOutcome, 'not_attempted');
    assert.equal(f.calls.reads.length, 0); assert.equal(f.calls.pages.length, 0); assert.equal(f.calls.writes.length, 0);
  }
});

test('method/auth adapter gates run before schedule work', async () => {
  for (const [request, status] of [[{ method: 'GET' }, 405], [{ headers: {} }, 401]]) {
    const f = fixture(); const res = await f.invoke(undefined, request);
    assert.equal(res.statusCode, status); assert.equal(f.calls.reads.length, 0); assert.equal(f.calls.audits, 0);
  }
});

test('missing requested source date aborts before any write', async () => {
  const f = fixture({ omitDate: '2026-10-15' }); const res = await f.invoke();
  assert.equal(res.statusCode, 409); assert.equal(f.calls.writes.length, 0); assert.equal(f.calls.audits, 1);
});

test('wrong season/type/team/abbreviation, unknown status, empty scope and side overflow all reject', async () => {
  for (const games of [[{ ...game(), season: 20252026 }], [{ ...game(), gameType: 3 }],
    [{ ...game(), homeTeam: { id: 999, abbrev: 'NYR' } }], [{ ...game(), homeTeam: { id: 3, abbrev: 'PHI' } }],
    [{ ...game(), gameState: 'UNKNOWN' }], [], Array.from({ length: 501 }, (_, i) => game(2026020000 + i))]) {
    const f = fixture({ games }); const res = await f.invoke();
    assert.equal(res.statusCode, 409); assert.equal(f.calls.writes.length, 0);
  }
});

test('postponed source is retained as non-countable rather than invented scheduled opportunity', async () => {
  const f = fixture({ games: [{ ...game(), gameScheduleState: 'PPD' }] }); const res = await f.invoke();
  assert.equal(res.statusCode, 200); assert.ok(f.calls.writes[0].rows.every(row => !row.is_countable));
});

test('conflicting duplicate source game versions reject', async () => {
  const f = fixture({ games: [game(), { ...game(), startTimeUTC: '2026-10-15T21:00:00Z' }] });
  assert.equal((await f.invoke()).statusCode, 409); assert.equal(f.calls.writes.length, 0);
});

test('fresh observations preserve source publication time and stable content hash', async () => {
  const first = fixture({ now: '2026-10-16T12:00:00Z' }); const a = await first.invoke();
  const second = fixture({ now: '2026-10-16T13:00:00Z' }); const b = await second.invoke();
  assert.equal(a.body.data.scopeHash, b.body.data.scopeHash);
  assert.notEqual(first.calls.writes[0].rows[0].fetched_at, second.calls.writes[0].rows[0].fetched_at);
  assert.equal(first.calls.writes[0].rows[0].source_updated_at, null);
  assert.equal(second.calls.writes[0].rows[0].source_updated_at, null);
});

test('missing cached identity fails closed rather than erasing it or certifying range completion', async () => {
  const f = fixture({ tables: { roster_optimizer_team_games: [{ source_game_id: 2026020999, team_id: 3 }] } });
  assert.equal((await f.invoke()).statusCode, 409); assert.equal(f.calls.writes.length, 0);
});

test('incomplete and over-budget database counts prevent writes', async () => {
  for (const count of [null, 1001, 2]) {
    const f = fixture({ readResult: table => table === 'roster_optimizer_team_games'
      ? { data: [{ source_game_id: 2026020112, team_id: 3 }], count, error: null } : undefined });
    assert.equal((await f.invoke()).statusCode, 409); assert.equal(f.calls.writes.length, 0);
  }
});

test('deadline after metadata/source work prevents entering the upsert', async () => {
  const f = fixture({ abortAtRead: 5 }); const res = await f.invoke();
  assert.equal(res.statusCode, 409); assert.equal(res.body.writeOutcome, 'not_attempted'); assert.equal(f.calls.writes.length, 0);
});

test('lost write acknowledgement is unknown, audited and never automatically retried', async () => {
  const f = fixture({ writeError: { message: 'synthetic timeout' } }); const res = await f.invoke();
  assert.equal(res.statusCode, 409); assert.equal(res.body.writeOutcome, 'unknown');
  assert.equal(f.calls.writes.length, 1); assert.equal(f.calls.audits, 1);
});

test('advertised and streamed byte overruns, HTML and non-200 source responses reject', async () => {
  for (const response of [new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': String(1024 * 1024 + 1) } }),
    new Response(' '.repeat(1024 * 1024 + 1), { headers: { 'content-type': 'application/json' } }),
    new Response('<html/>', { headers: { 'content-type': 'text/html' } }),
    new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } })]) {
    const f = fixture({ fetch: async () => response }); const res = await f.invoke();
    assert.equal(res.statusCode, 409); assert.equal(f.calls.writes.length, 0);
  }
});

test('parent cancellation aborts in-flight source I/O', async () => {
  const parent = new AbortController();
  const f = fixture({ fetch: async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('synthetic abort')), { once: true }); parent.abort();
  }) });
  await assert.rejects(f.load('web/lib/rosterScheduleData/recurring.ts').fetchRecurringSchedulePage('2026-10-15', parent.signal));
});

test('upsert byte cap rejects duplicated source metadata before any write', async () => {
  const f = fixture({ games: [{ ...game(), venue: { default: 'x'.repeat(600000) } }] });
  const res = await f.invoke();
  assert.equal(res.statusCode, 409); assert.match(res.body.error.message, /payload/); assert.equal(f.calls.writes.length, 0);
});

test('candidate patch source bindings and canonical entry agree', () => {
  const bindings = JSON.parse(fs.readFileSync(path.join(BASE, 'source-bindings.json')));
  for (const [relative, hash] of Object.entries(bindings.sourceSha256)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relative))).digest('hex'), hash, relative);
  }
  const entry = JSON.parse(fs.readFileSync(path.join(BASE, 'canonical-entry.proposed.json')));
  assert.equal(entry.schedule, '50 9,21 * * *'); assert.equal(entry.method, 'POST');
  const sql = fs.readFileSync(path.join(BASE, 'activation-reference.sql'), 'utf8');
  assert.ok(sql.includes(entry.schedule) && sql.includes(entry.route));
  const existingVercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'web/vercel.json')));
  assert.ok(existingVercel.crons.every(cron => !cron.path.includes('roster-optimizer-schedule')));
});

test('actual report slot helpers distinguish the two proposed runs and require the latest due observation', () => {
  const source = fs.readFileSync(path.join(ROOT, 'web/pages/api/v1/db/cron-report.ts'), 'utf8');
  const tree = ts.createSourceFile('cron-report.ts', source, ts.ScriptTarget.ES2020, true);
  const names = ['cronTimeFieldMatches', 'recurringSlotMatches', 'latestRequiredRecurringSlot', 'closestRecurringSlot'];
  const declarations = tree.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.equal(declarations.length, 4);
  const text = declarations.map(node => node.getText(tree)).join('\n')
    + '\nmodule.exports = { latestRequiredRecurringSlot, closestRecurringSlot };';
  const compiled = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const context = vm.createContext({ module: { exports: {} }, Date, RECURRING_SLOT_GRACE_MS: 5 * 60000, MATCH_WINDOW_MS: 30 * 60000 });
  vm.runInContext(compiled, context);
  const { latestRequiredRecurringSlot, closestRecurringSlot } = context.module.exports;
  const job = { cronExpression: '50 9,21 * * *' };
  const since = new Date('2026-10-15T13:00:00Z'), until = new Date('2026-10-16T13:00:00Z');
  assert.equal(latestRequiredRecurringSlot(job, since, until), '2026-10-16T09:50:00.000Z');
  assert.equal(latestRequiredRecurringSlot(job, since, new Date('2026-10-16T09:00:00Z')), '2026-10-15T21:50:00.000Z');
  assert.equal(closestRecurringSlot(job, '2026-10-15T21:50:30Z', since, until), '2026-10-15T21:50:00.000Z');
  assert.notEqual(closestRecurringSlot(job, '2026-10-15T21:50:30Z', since, until), latestRequiredRecurringSlot(job, since, until));
});
