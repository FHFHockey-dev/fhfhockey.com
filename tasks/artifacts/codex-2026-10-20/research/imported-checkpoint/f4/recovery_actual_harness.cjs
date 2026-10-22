#!/usr/bin/env node
/* Actual exported FHFH functions + one injected in-memory database client.
 * No copied persistence/lifecycle implementation, real DB, or app edits.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');

const WEB = '/workspace/shared/fhfhockey.com/web';
const OUT = __dirname;
const FIXED = Date.parse('2026-10-20T02:00:00.000Z');
const NativeDate = Date;
let clockNow = FIXED;
class FixedDate extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [clockNow])); }
  static now() { return clockNow; }
}
global.Date = FixedDate;
const clone = value => structuredClone(value);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const readColumn = (row, name) => {
  const match = /^(\w+)->(\w+)->>(\w+)$/.exec(name);
  return match ? row[match[1]]?.[match[2]]?.[match[3]] : row[name];
};

const db = {
  tables: {}, events: [], delays: [], sequence: 0,
  reset() { this.tables = {}; this.events = []; this.delays = []; this.sequence = 0; },
  delayNext(match, errorAfterCommit = null) {
    const started = deferred(), released = deferred();
    const delay = { match, errorAfterCommit, started, released, armed: true };
    this.delays.push(delay);
    return { started: started.promise, release: () => released.resolve() };
  },
  from(table) {
    const filters = [];
    let operation = 'select', rows = [], patch = {}, conflict = '', returning = false;
    let order = null, limit = Infinity;
    const execute = async single => {
      const event = { table, operation, filters: filters.map(x => ({ column: x.column, kind: x.kind, value: clone(x.value) })),
                      conflict: conflict || null, rows: clone(rows), patch: clone(patch) };
      this.events.push({ phase: 'dispatch', ...event });
      const wait = this.delays.find(x => x.armed && x.match(event));
      if (wait) { wait.armed = false; wait.started.resolve(); await wait.released.promise; }
      const stored = this.tables[table] ??= [];
      const matches = row => filters.every(x => x.kind === 'in' ? x.value.includes(readColumn(row, x.column)) : readColumn(row, x.column) === x.value);
      let matched = stored.filter(matches);
      if (operation === 'update') {
        for (const row of matched) Object.assign(row, clone(patch));
      } else if (operation === 'delete') {
        this.tables[table] = stored.filter(row => !matches(row));
      } else if (operation === 'insert') {
        matched = rows.map(row => ({ run_id: `created-run-${++this.sequence}`, created_at: new Date().toISOString(), updated_at: null, ...clone(row) }));
        stored.push(...matched);
      } else if (operation === 'upsert') {
        const columns = conflict.split(',');
        for (const row of rows) {
          const found = stored.find(existing => columns.every(key => existing[key] === row[key]));
          if (found) Object.assign(found, clone(row)); else stored.push(clone(row));
        }
        matched = rows;
      }
      if (order) matched = [...matched].sort((a, b) => (a[order.key] < b[order.key] ? -1 : a[order.key] > b[order.key] ? 1 : 0) * (order.ascending ? 1 : -1));
      matched = matched.slice(0, limit);
      const error = wait?.errorAfterCommit ?? null;
      this.events.push({ phase: 'commit', table, operation, matched: matched.length, errorAfterCommit: clone(error) });
      return { data: error ? null : (single ? clone(matched[0] ?? null) : operation === 'select' || returning ? clone(matched) : null), error };
    };
    const q = {
      select() { if (operation !== 'select') returning = true; return q; },
      update(value) { operation = 'update'; patch = clone(value); return q; },
      insert(value) { operation = 'insert'; rows = clone(Array.isArray(value) ? value : [value]); return q; },
      upsert(value, options) { operation = 'upsert'; rows = clone(Array.isArray(value) ? value : [value]); conflict = options?.onConflict ?? ''; return q; },
      delete() { operation = 'delete'; return q; },
      eq(column, value) { filters.push({ kind: 'eq', column, value }); return q; },
      in(column, value) { filters.push({ kind: 'in', column, value }); return q; },
      order(key, options) { order = { key, ascending: options?.ascending !== false }; return q; },
      limit(value) { limit = value; return q; },
      single() { return execute(true); }, maybeSingle() { return execute(true); },
      then(resolve, reject) { return execute(false).then(resolve, reject); },
    };
    return q;
  },
};
const client = { from: db.from.bind(db) };

process.env.TS_NODE_SKIP_PROJECT = 'true';
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'CommonJS', moduleResolution: 'node', target: 'ES2022', esModuleInterop: true });
require(path.join(WEB, 'node_modules/ts-node/register/transpile-only'));
const actualPaths = [
  path.join(WEB, 'lib/projections/stages/persistence-stage.ts'),
  path.join(WEB, 'lib/projections/queries/run-lifecycle-queries.ts'),
];
const fingerprints = () => Object.fromEntries(actualPaths.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const beforeHashes = fingerprints();
let injectedImports = 0;
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'lib/supabase/server') { injectedImports++; return { __esModule: true, default: client }; }
  return originalLoad.call(this, request, parent, isMain);
};
let persistence, lifecycle;
try {
  persistence = require(actualPaths[0]);
  lifecycle = require(actualPaths[1]);
} finally { Module._load = originalLoad; }
assert.equal(injectedImports, 2);
assert(!Object.keys(require.cache).some(p => p === path.join(WEB, 'lib/supabase/server.ts')), 'real server client must never load');
assert.throws(() => fetch('https://example.invalid/not-sent'), /outbound network disabled/, 'run with the network-blocking preload');

const DATE = '2026-10-20', GAME = 2026020010;
function seedRun(runId, owner) {
  db.tables.forge_runs ??= [];
  db.tables.forge_runs.push({ run_id: runId, as_of_date: DATE, status: 'running',
    created_at: new Date(FIXED - 60_000).toISOString(), updated_at: new Date(FIXED - 10_000).toISOString(),
    metrics: { resume: { version: lifecycle.RUN_RESUME_VERSION, scope_key: 'h1:full', lease_owner: owner,
      lease_expires_at: new Date(FIXED - 1_000).toISOString(), completed_game_ids: [], invocations: 1 } } });
  return { runId, scopeKey: 'h1:full', leaseOwner: owner, resumed: false, invocations: 1, completedGameIds: [], priorMetrics: {} };
}
const player = (runId, value) => ({ run_id: runId, game_id: GAME, player_id: 1, horizon_games: 1, proj_goals_es: value });
const run = id => db.tables.forge_runs.find(row => row.run_id === id);
const projected = id => db.tables.forge_player_projections?.find(row => row.run_id === id)?.proj_goals_es;
const failedCAS = async claim => {
  await assert.rejects(lifecycle.writeClaimedRun(claim, { status: 'running', metrics: {}, completedGameIds: [GAME] }), error => error.code === 'RUN_LEASE_LOST');
};

async function lateProjection() {
  db.reset();
  const old = seedRun('same-run', 'owner-A');
  const gate = db.delayNext(event => event.table === 'forge_player_projections' && event.operation === 'upsert' && event.rows[0].proj_goals_es === 0.1);
  const pendingA = persistence.persistForgePlayerProjectionRows([player(old.runId, 0.1)]);
  await gate.started;
  const replacement = await lifecycle.claimResumableRun(DATE, { scopeKey: 'h1:full', leaseExpiresAt: new Date(FIXED + 60_000).toISOString() });
  assert.equal(replacement.runId, old.runId);
  assert.notEqual(replacement.leaseOwner, old.leaseOwner);
  await failedCAS(old); // Rejected while B is still running: OWNER predicate matters.
  await lifecycle.clearRunGameRows(replacement.runId, [GAME]);
  await persistence.persistForgePlayerProjectionRows([player(replacement.runId, 0.9)]);
  await lifecycle.writeClaimedRun(replacement, { status: 'succeeded', metrics: { synthetic_case: 'late_projection' }, completedGameIds: [GAME] });
  const beforeLate = { status: run(old.runId).status, value: projected(old.runId) };
  assert.deepEqual(beforeLate, { status: 'succeeded', value: 0.9 });
  gate.release();
  assert.equal(await pendingA, 1);
  await failedCAS(old);
  const afterLate = { status: run(old.runId).status, value: projected(old.runId) };
  assert.deepEqual(afterLate, { status: 'succeeded', value: 0.1 });
  const outputCalls = db.events.filter(e => e.phase === 'dispatch' && e.table === 'forge_player_projections');
  assert(outputCalls.filter(e => e.operation === 'upsert').every(e => e.conflict === 'run_id,game_id,player_id,horizon_games' && !e.filters.length));
  return { name: 'actual_exports_late_projection_after_replacement_success', passed: true,
    beforeLate, afterLate, oldMetadataCAS: 'RUN_LEASE_LOST both before and after final success',
    outputKey: 'run_id,game_id,player_id,horizon_games', events: clone(db.events) };
}

function analyticsArgs(runId, value) {
  return { asOfDate: DATE, gameId: GAME, modelName: 'forge-synthetic', modelVersion: 'test-v1',
    playerPredictionOutputRows: [{ snapshot_date: DATE, player_id: 1, model_name: 'forge-synthetic', model_version: 'test-v1',
      prediction_scope: 'pregame', metric_key: 'goals', game_id: GAME, projected_value: value, metadata: { run_id: runId } }],
    gamePredictionOutput: { snapshot_date: DATE, model_name: 'forge-synthetic', model_version: 'test-v1', prediction_scope: 'pregame', game_id: GAME, metadata: { run_id: runId } },
    modelMarketFlagRows: [] };
}

async function distinctRunSidecarDeletion() {
  db.reset();
  const old = seedRun('old-run-R1', 'owner-A');
  const lostAck = { code: 'SYNTHETIC_ACK_LOST', message: 'Synthetic deletion committed; acknowledgement unavailable.' };
  const gate = db.delayNext(event => event.table === 'player_prediction_outputs' && event.operation === 'delete', lostAck);
  // Attach a rejection handler immediately: this intentional late failure is
  // observed, not leaked as an unhandled rejection.
  const pendingA = persistence.persistPerGameAnalyticsOutputs(analyticsArgs(old.runId, 0.1)).then(() => ({ unexpectedlySucceeded: true }), error => error);
  await gate.started;
  await lifecycle.writeClaimedRun(old, { status: 'failed', metrics: { synthetic_case: 'retire_old_run' }, completedGameIds: [] });
  const replacementId = await lifecycle.createRun(DATE);
  assert.notEqual(replacementId, old.runId);
  await persistence.persistPerGameAnalyticsOutputs(analyticsArgs(replacementId, 0.9));
  await lifecycle.finalizeRun(replacementId, 'succeeded', { synthetic_case: 'replacement_complete' });
  const beforeLate = { replacementStatus: run(replacementId).status, playerRows: db.tables.player_prediction_outputs.length,
    rowRunId: db.tables.player_prediction_outputs[0].metadata.run_id };
  assert.equal(beforeLate.playerRows, 1);
  assert.equal(beforeLate.rowRunId, replacementId);
  gate.release();
  const oldError = await pendingA;
  assert.equal(oldError.code, 'SYNTHETIC_ACK_LOST');
  await failedCAS(old);
  const afterLate = { replacementStatus: run(replacementId).status, oldStatus: run(old.runId).status,
    playerRows: db.tables.player_prediction_outputs.length,
    gameRows: db.tables.game_prediction_outputs.length };
  assert.deepEqual(afterLate, { replacementStatus: 'succeeded', oldStatus: 'failed', playerRows: 0, gameRows: 1 });
  const deletes = db.events.filter(e => e.phase === 'dispatch' && e.table === 'player_prediction_outputs' && e.operation === 'delete');
  assert.equal(deletes.length, 2);
  const scope = deletes[0].filters.map(f => f.column);
  assert.deepEqual(scope, ['snapshot_date', 'game_id', 'model_name', 'model_version', 'prediction_scope']);
  assert(!scope.includes('run_id'));
  return { name: 'actual_exports_late_sidecar_delete_across_distinct_runs', passed: true,
    oldRunId: old.runId, replacementId, beforeLate, afterLate, oldMetadataCAS: 'RUN_LEASE_LOST',
    deleteScope: scope, failureBoundary: 'delete committed; returned synthetic lost-ack error prevents old upsert', events: clone(db.events) };
}

module.exports = { db, client, persistence, lifecycle, deferred, clone, WEB, FIXED, setClock: value => { clockNow = value; }, restoreClock: () => { global.Date = NativeDate; } };

if (require.main === module) {
(async () => {
  const cases = [await lateProjection(), await distinctRunSidecarDeletion()];
  assert.deepEqual(fingerprints(), beforeHashes, 'imported application files must remain byte-identical');
  // Remove nondeterministic lease UUIDs from the artifact, retaining operation
  // order/keys and owner equality distinction. No secrets are read or emitted.
  const normalized = JSON.parse(JSON.stringify(cases), (key, value) => {
    if ((key === 'lease_owner' || key === 'value') && typeof value === 'string' && /^[0-9a-f]{8}-/.test(value)) return 'replacement-owner-UUID';
    return value;
  });
  const report = { node: process.version, passed: cases.length, actualSourceHashes: beforeHashes,
    sourceFilesUnchanged: true, injectedClientImports: injectedImports, network: 'Socket/TLS/global fetch blocked by required preload',
    limits: ['Actual exported persistence/lifecycle functions, not the complete runProjectionV2ForDate runner or HTTP route.',
      'Only the database client is injected; in-memory matching/conflict/error semantics are a controlled stand-in, not PostgreSQL/PostgREST proof.',
      'The sidecar lost-ack commit is deliberately injected; it establishes missing run isolation, not observed database timeout behavior.',
      'No production incident, SQL lock/isolation guarantee, or proposed repair is validated.'], cases: normalized };
  fs.writeFileSync(path.join(OUT, 'recovery-actual-results.json'), JSON.stringify(report, null, 2) + '\n');
  for (const item of cases) console.log(`PASS ${item.name}\n  before: ${JSON.stringify(item.beforeLate)}\n  after:  ${JSON.stringify(item.afterLate)}\n  old metadata: ${item.oldMetadataCAS}`);
  console.log(`Node ${process.version}; ${cases.length} actual-export cases passed; application source hashes unchanged; no network/DB calls.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.Date = NativeDate; });

}
