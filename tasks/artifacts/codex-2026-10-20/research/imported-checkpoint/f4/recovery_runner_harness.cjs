#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const { db, client, persistence, lifecycle, WEB, FIXED, setClock, restoreClock } = require('./recovery_actual_harness.cjs');
const RUNNER = path.join(WEB, 'lib/projections/run-forge-projections.ts');
const sourcePaths = [RUNNER, path.join(WEB, 'lib/projections/stages/persistence-stage.ts'), path.join(WEB, 'lib/projections/queries/run-lifecycle-queries.ts')];
const hashes = () => Object.fromEntries(sourcePaths.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const beforeHashes = hashes();
const DATE = '2026-10-20', GAME = 2026020010;
const game = { id: GAME, date: DATE, homeTeamId: 10, awayTeamId: 20 };
let stageCalls = 0;
const stageTrace = [];
const fakePreflight = async () => ({
  currentSeasonId: 20262027, games: [game], teamIds: [10, 20], gameIds: [GAME],
  teamAbbreviationById: new Map([[10, 'AAA'], [20, 'BBB']]), playerAvailabilityMultiplier: new Map(),
  availabilityEventByPlayer: new Map(), roleEventByPlayer: new Map(), ppEventByPlayer: new Map(),
  dailyBoardEvidence: { assertions: [], conflicts: [] }, goalieOverrideByTeamId: new Map(),
  gameMarketContextByGameId: new Map(), playerPropContextByGamePlayerKey: new Map(),
});
const fakeSkater = async args => {
  const invocation = ++stageCalls;
  const value = invocation === 1 ? 0.1 : 0.9;
  let playerRowsUpserted = 0, teamRowsUpserted = 0;
  stageTrace.push({ invocation, event: 'skater_enter', now: Date.now(), runId: args.runId, value });
  // Same relevant team-loop/deadline/persistence ordering as the real stage,
  // but all statistical work is fake. The awaited persistence exports are REAL.
  for (const [index, teamId] of [10, 20].entries()) {
    if (Date.now() > args.deadlineMs) {
      stageTrace.push({ invocation, event: 'skater_timeout', now: Date.now(), playerRowsUpserted, teamRowsUpserted });
      return { timedOut: true, playerRowsUpserted, teamRowsUpserted };
    }
    playerRowsUpserted += await persistence.persistForgePlayerProjectionRows([{
      run_id: args.runId, game_id: GAME, player_id: index + 1, horizon_games: 1, proj_goals_es: value,
    }]);
    teamRowsUpserted += await persistence.persistForgeTeamProjection({
      run_id: args.runId, game_id: GAME, team_id: teamId, horizon_games: 1, proj_goals_es: value,
    });
    args.teamGoalsByTeamId.set(teamId, value);
    args.teamShotsByTeamId.set(teamId, { shotsEs: 10, shotsPp: 1 });
    args.playerPredictionOutputRows.push({
      snapshot_date: DATE, player_id: index + 1, model_name: 'forge', model_version: 'test-v1',
      prediction_scope: 'pregame', metric_key: 'goals', game_id: GAME, projected_value: value, metadata: { run_id: args.runId },
    });
  }
  return { timedOut: false, playerRowsUpserted, teamRowsUpserted };
};
const fakeGoalie = async args => {
  let goalieRowsUpserted = 0;
  for (const goalie_id of [101, 102]) goalieRowsUpserted += await persistence.persistForgeGoalieProjection({
    run_id: args.runId, game_id: GAME, goalie_id, horizon_games: 1, proj_saves: 0.9,
  });
  return { timedOut: false, goalieRowsUpserted };
};
const replaced = [];
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'lib/supabase/server') return { __esModule: true, default: client };
  const resolved = request.startsWith('lib/') ? path.join(WEB, request)
    : request.startsWith('.') && parent?.filename ? path.resolve(path.dirname(parent.filename), request) : null;
  const match = suffix => resolved === path.join(WEB, 'lib/projections', suffix);
  if (match('stages/preflight-stage')) { replaced.push('preflight'); return { runProjectionPreflightStage: fakePreflight }; }
  if (match('stages/skater-stage')) { replaced.push('skater'); return { runPerGameSkaterStage: fakeSkater }; }
  if (match('stages/goalie-stage')) { replaced.push('goalie'); return { runPerGameGoalieStage: fakeGoalie }; }
  if (match('pbpCompletenessServer')) return { hasCompleteStoredPbpGame: async () => true };
  if (match('shiftChartCompletenessServer')) return { classifyStoredShiftChartStrengthGame: async () => ({ status: 'complete' }) };
  if (match('dailyBoardEvidence')) return { applyDailyBoardEvidence: () => ({}) };
  if (request.startsWith('lib/')) return originalLoad.call(this, resolved, parent, isMain);
  return originalLoad.call(this, request, parent, isMain);
};
let runner;
try {
  runner = require(RUNNER);
} finally { Module._load = originalLoad; }
assert.equal(typeof runner.runProjectionV2ForDate, 'function');
process.env.STARTER_BOARD_CAPTURE_ENABLED = 'false';
process.env.STARTER_BOARD_COMPUTE_ENABLED = 'false';

(async () => {
  db.reset();
  const gate = db.delayNext(event => event.table === 'forge_player_projections' && event.operation === 'upsert'
    && event.rows[0]?.player_id === 1 && event.rows[0]?.proj_goals_es === 0.1);
  // Observe errors from A immediately while its actual invocation remains live.
  const pendingA = runner.runProjectionV2ForDate(DATE, { deadlineMs: FIXED + 1_000 }).then(
    result => ({ result }), error => ({ error: { code: error.code, message: error.message } }));
  await gate.started;
  assert.equal(db.tables.forge_runs.length, 1);
  const runId = db.tables.forge_runs[0].run_id;
  assert.equal(db.tables.forge_runs[0].status, 'running');
  assert.equal(Date.parse(db.tables.forge_runs[0].metrics.resume.lease_expires_at), FIXED + 61_000);
  setClock(FIXED + 62_000); // past A's deadline AND 60-second lease grace
  const resultB = await runner.runProjectionV2ForDate(DATE, { deadlineMs: FIXED + 300_000 });
  assert.equal(resultB.runId, runId);
  assert.equal(resultB.resume.resumed, true);
  assert.equal(resultB.resume.invocations, 2);
  const rowState = () => ({
    status: db.tables.forge_runs[0].status,
    completed: [...db.tables.forge_runs[0].metrics.resume.completed_game_ids],
    players: db.tables.forge_player_projections.map(x => ({ id: x.player_id, goals: x.proj_goals_es })).sort((a, b) => a.id - b.id),
    teams: db.tables.forge_team_projections.map(x => ({ id: x.team_id, goals: x.proj_goals_es })).sort((a, b) => a.id - b.id),
    goalies: db.tables.forge_goalie_projections.map(x => ({ id: x.goalie_id, saves: x.proj_saves })).sort((a, b) => a.id - b.id),
    playerSidecarRows: db.tables.player_prediction_outputs.length,
    gameSidecarRows: db.tables.game_prediction_outputs.length,
  });
  const beforeLate = rowState();
  assert.equal(beforeLate.status, 'succeeded');
  assert.deepEqual(beforeLate.completed, [GAME]);
  assert.deepEqual(beforeLate.players.map(x => x.goals), [0.9, 0.9]);
  gate.release();
  const resultA = await pendingA;
  assert.equal(resultA.error?.code, 'RUN_LEASE_LOST');
  const afterLate = rowState();
  assert.equal(afterLate.status, 'succeeded');
  assert.deepEqual(afterLate.completed, [GAME]);
  assert.deepEqual(afterLate.players.map(x => x.goals), [0.1, 0.9]);
  assert.deepEqual(afterLate.teams.map(x => x.goals), [0.1, 0.9]);
  assert.deepEqual(afterLate.goalies, beforeLate.goalies);
  assert.equal(afterLate.playerSidecarRows, beforeLate.playerSidecarRows);
  assert.equal(afterLate.gameSidecarRows, beforeLate.gameSidecarRows);
  assert.deepEqual(hashes(), beforeHashes);
  const normalizedEvents = JSON.parse(JSON.stringify(db.events), (key, value) => {
    if ((key === 'lease_owner' || key === 'value') && typeof value === 'string' && /^[0-9a-f]{8}-/.test(value)) return 'owner-UUID';
    return value;
  });
  const report = {
    node: process.version, passed: true, actualRunnerInvocations: 2, resultB, resultA,
    beforeLate, afterLate, stageTrace, sourceFilesUnchanged: true, actualSourceHashes: beforeHashes,
    fakeComputationalStages: [...new Set(replaced)], events: normalizedEvents,
    limits: ['Actual runner, lifecycle, cleanup, projection and analytics persistence, and metrics finalization; fake preflight/statistical stages and in-memory DB client.',
      'Deferred commit/transport is injected; neither real SQL concurrency nor production timing is validated.',
      'No proposed fix, reader admission/scorability, or statistical output correctness is tested.'],
  };
  fs.writeFileSync(path.join(__dirname, 'recovery-runner-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('PASS actual runProjectionV2ForDate invoked twice with real persistence and metadata');
  console.log('B before late A:', JSON.stringify(beforeLate));
  console.log('After late A:', JSON.stringify(afterLate));
  console.log('A terminal:', JSON.stringify(resultA));
  console.log('Node', process.version, '; actual application source hashes unchanged; no network/DB calls.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(restoreClock);
