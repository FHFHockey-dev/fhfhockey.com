// One explicitly scoped game, using the existing three CAS transactions.
// No provider requests, raw-source writes, rolling recomputes or retries.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { modules, fixtureDatabase, readerSourceRows } = require('./prepare-stored-repair.cjs');
const { capture } = require('./capture-stored-repair.cjs');
const repo = path.resolve(__dirname, '../../..');
const web = path.join(repo, 'web');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const RELEASE = '866b90bc46a169b42cbc3c54a7d64b0daf764121';
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

const { rpcFetch } = require('./psql-stored-rpc.cjs');

function assertGameSpacing(entries, minimumSeconds, now = Date.now()) {
  assert.ok(minimumSeconds === 0 || (Number.isFinite(minimumSeconds) && minimumSeconds >= 60));
  const starts = entries.filter(row => ['inputs_requested', 'resume_requested'].includes(row.event)).map(row => Date.parse(row.at));
  assert.ok(starts.every(Number.isFinite), 'Invalid prior write timestamp');
  assert.ok(starts.every(start => now - start >= minimumSeconds * 1000), 'Minimum spacing between games has not elapsed');
}

function assertStep5Approval(scope, now = Date.now()) {
  if (scope.sourceHandoff === 'CLAUDE-FIX-SPRINT-DB-HANDOFF-20261112') return;
  assert.equal(scope.sourceHandoff, 'CLAUDE-FIX-SPRINT-DB-HANDOFF-3-20261112');
  assert.equal(scope.approvalStatus, 'approved_by_TJ', 'Step 5 is awaiting explicit approval');
  const started = Date.parse(scope.executionStartedAt);
  assert.ok(Number.isFinite(started) && now >= started && now - started < 6 * 60 * 60 * 1000,
    'Step 5 execution window is missing, future or expired');
  if (scope.minimumGameSpacingSeconds === 0)
    assert.equal(scope.gameSpacingOverride?.status, 'approved_by_TJ', 'Back-to-back games require explicit approval');
  else assert.equal(scope.minimumGameSpacingSeconds, 60);
  assert.equal(scope.maximumWriteRpcsPerGame, 3);
  assert.equal(scope.maximumRequestsPerGame, 55);
  assert.equal(scope.concurrency, 1);
  assert.ok(['read_only', 'conditional_repair'].includes(scope.unchangedRawHeadGamePolicy),
    'TJ must decide whether 252/278 may receive new DRM manifests');
  const conditional = scope.unchangedRawHeadGamePolicy === 'conditional_repair';
  assert.ok(scope.gameIds.length <= (conditional ? 298 : 296) && new Set(scope.gameIds).size === scope.gameIds.length);
  if (!conditional) assert.ok(!scope.gameIds.includes(2026020252) && !scope.gameIds.includes(2026020278));
  assert.equal(scope.writeTimeoutMs, 5000);
  if (scope.maximumProbeDurationMs === null)
    assert.equal(scope.healthLatencyOverride?.status, 'approved_by_TJ', 'Unlimited health latency requires explicit approval');
  const cron = scope.recentGameWriterCompletion;
  assert.ok(cron?.writerStopped === true && cron.continuationPending === false && cron.evidencePath,
    'Recent-game writer completion has not been verified');
  assert.equal(cron.scheduledAt, '2026-11-12T20:51:00.000Z');
  const completed = Date.parse(cron.completedAt);
  assert.ok(Number.isFinite(completed) && completed >= Date.parse(cron.scheduledAt) && completed <= started,
    'Recent-game writer completion is missing or outside the execution boundary');
}

function assertStep5Health(health, now = Date.now(), maximumProbeDurationMs = 1000) {
  assert.ok(maximumProbeDurationMs === null || (Number.isFinite(maximumProbeDurationMs) && maximumProbeDurationMs > 0));
  assert.ok(Number.isFinite(health.probeDurationMs) && health.probeDurationMs >= 0,
    'Database probe latency was not measured');
  if (maximumProbeDurationMs !== null)
    assert.ok(health.probeDurationMs <= maximumProbeDurationMs, 'Database probe exceeded its approved latency limit');
  for (const field of ['checkpointsRequested', 'previousCheckpointsRequested'])
    assert.ok(Number.isSafeInteger(health[field]) && health[field] >= 0, 'Checkpoint counters are missing');
  assert.equal(health.checkpointsRequested, health.previousCheckpointsRequested, 'Forced checkpoint detected; pause at least three minutes');
  assert.ok(Number.isFinite(Date.parse(health.statsReset)) && health.statsReset === health.previousStatsReset,
    'Database statistics reset or baseline is missing');
  if (health.checkpointPauseUntil != null)
    assert.ok(Number.isFinite(Date.parse(health.checkpointPauseUntil)) && now >= Date.parse(health.checkpointPauseUntil),
      'Forced-checkpoint cooldown has not elapsed');
}

function compareRows(actual, expected, key, label) {
  assert.equal(actual.length, expected.length, `${label} cardinality`);
  const byId = new Map(actual.map(row => [row[key], row]));
  assert.equal(byId.size, actual.length, `${label} duplicate identity`);
  for (const wanted of expected) {
    const row = byId.get(wanted[key]);
    assert.ok(row, `${label} missing ${wanted[key]}`);
    for (const [field, value] of Object.entries(wanted)) {
      if (value === undefined || ['updated_at', 'created_at'].includes(field)) continue;
      if (field === 'starttime') assert.equal(Date.parse(row[field]), Date.parse(value), `${label} ${field}`);
      // The existing RPC casts this numeric source field to varchar(255).
      else if (label === 'pbp_plays' && field === 'durationofpenalty' && value != null)
        assert.equal(row[field], String(value), `${label}/${wanted[key]}/${field}`);
      else assert.deepEqual(row[field], value, `${label}/${wanted[key]}/${field}`);
    }
  }
}

function assertResumeManifest(manifest, prepared, authorization) {
  assert.equal(manifest?.input_status, 'complete');
  assert.equal(manifest.input_fingerprint, prepared.inputPayload.inputFingerprint);
  assert.equal(manifest.input_version, authorization.inputVersion);
  assert.equal(manifest.input_materializer_version, prepared.inputPayload.materializerVersion);
  assert.equal(manifest.relationship_status, 'pending', 'Relationship stage is no longer pending');
  assert.equal(manifest.derived_status, 'pending', 'Derived stage is no longer pending');
  for (const head of prepared.sourceHeads) {
    const prefix = head.endpoint === 'play-by-play' ? 'pbp' : 'shift';
    assert.equal(manifest[`${prefix}_raw_payload_id`], head.raw_payload_id);
    assert.equal(manifest[`${prefix}_raw_payload_hash`], head.payload_hash);
    assert.equal(manifest[`${prefix}_raw_snapshot_version`], head.snapshot_version);
  }
}

async function verify(after, prepared) {
  const input = prepared.inputPayload;
  assert.deepEqual(after.heads, prepared.sourceHeads, 'Source heads changed after publication');
  assert.deepEqual(after.participation?.heads ?? [], prepared.participationHeads ?? [], 'Participation source changed after publication');
  assert.equal(after.manifest.input_fingerprint, input.inputFingerprint);
  assert.equal(after.manifest.relationship_fingerprint, prepared.relationshipFingerprint);
  assert.equal(after.manifest.derived_status, 'complete');
  assert.equal(after.manifest.derived_input_fingerprint, input.inputFingerprint);
  const strengths = new Map(input.strengthRows.map(row => [row.player_id, row]));
  compareRows(after.before.shift_charts, prepared.relationships.rows.map(row => ({ ...row, ...strengths.get(row.player_id) })), 'player_id', 'shift_charts');
  compareRows(after.before.pbp_games, [input.gameRow], 'id', 'pbp_games');
  compareRows(after.before.pbp_plays, input.playRows, 'id', 'pbp_plays');
  compareRows(after.before.forge_player_game_strength, prepared.derived.playerRows, 'player_id', 'player facts');
  compareRows(after.before.forge_team_game_strength, prepared.derived.teamRows, 'team_id', 'team facts');
  compareRows(after.before.forge_goalie_game, prepared.derived.goalie.rows, 'goalie_id', 'goalie facts');
  const raw = after.raw.find(row => row.endpoint === 'play-by-play'), pbp = raw.payload;
  const database = fixtureDatabase({ games: [after.game], projection_game_materialization_status: [after.manifest],
    nhl_api_game_payload_snapshot_heads: [...after.heads, ...(after.participation?.heads ?? [])], nhl_api_game_roster_spots: after.roster,
    nhl_api_game_payloads_raw: readerSourceRows(after),
    shift_charts: after.before.shift_charts, skatersGameStats: [], goaliesGameStats: [] });
  const { readDeploymentMatrix } = modules().get('lib/drm/readMatrix.ts');
  const checked = [];
  for (const teamId of [pbp.homeTeam.id, pbp.awayTeam.id]) {
    const result = await readDeploymentMatrix(database, { teamId, seasonId: Number(pbp.season),
      seasonType: 'regularSeason', startDate: pbp.gameDate, endDate: pbp.gameDate, gameIds: [pbp.id] });
    assert.equal(result.coverage.acceptedGames, 1, JSON.stringify(result.coverage.games));
    checked.push({ teamId, coverage: result.coverage, units: result.units.length });
  }
  return checked;
}

async function main() {
  const [, , snapshotFile, preparedFile, journalFile, scopeFile, healthFile, mode] = process.argv;
  assert.ok(['--write', '--resume-unfinished'].includes(mode), 'Expected --write or an explicitly authorized --resume-unfinished');
  const resuming = mode === '--resume-unfinished';
  const snapshot = readJson(snapshotFile), prepared = readJson(preparedFile), scope = readJson(scopeFile), health = readJson(healthFile);
  const gameId = prepared.gameId;
  assert.equal(snapshot.evidenceKind, 'live_stored_capture');
  assert.equal(prepared.evidenceKind, 'live_stored_capture');
  assert.equal(prepared.status, 'prepared_only');
  assert.equal(snapshot.game.id, gameId);
  assert.equal(prepared.snapshotHash, sha(JSON.stringify(snapshot)), 'Capture changed since preparation');
  assert.equal(scope.releaseSha, RELEASE);
  assert.equal(scope.deploymentState, 'READY');
  assert.ok(Array.isArray(scope.gameIds) && scope.gameIds.length <= 298 && scope.gameIds.includes(gameId));
  assertStep5Approval(scope);
  const resume = resuming ? scope.stageResumeAuthorization : null;
  if (resuming) {
    assert.equal(resume?.status, 'approved_by_TJ');
    assert.equal(resume.gameId, gameId);
    assert.equal(path.resolve(resume.journalFile), path.resolve(journalFile));
    assert.equal(resume.inputFingerprint, prepared.inputPayload.inputFingerprint);
    assert.deepEqual(resume.stages, ['relationships', 'derived']);
    const attempts = [{ path: resume.priorJournalFile, sha256: resume.priorJournalSha256 },
      ...(resume.additionalAttemptJournals ?? [])].map(previous => {
      const journal = fs.readFileSync(previous.path, 'utf8');
      assert.equal(sha(journal), previous.sha256);
      const entries = journal.split('\n').filter(Boolean).map(line => JSON.parse(line));
      assert.ok(entries.every(entry => entry.gameId === gameId));
      assert.equal(entries.at(-1).event, 'stopped');
      return entries;
    });
    const events = attempts.flat();
    const committed = events.filter(row => row.event === 'inputs_committed');
    assert.equal(committed.length, 1);
    assert.equal(committed[0].receipt.inputFingerprint, resume.inputFingerprint);
    assert.equal(committed[0].receipt.inputVersion, resume.inputVersion);
    assert.ok(!events.some(row => ['relationships_committed', 'derived_committed', 'verified'].includes(row.event)));
    assert.equal(events.at(-1).event, 'stopped');
    assert.equal(attempts.reduce((sum, entries) => sum + entries.at(-1).requests, 0), resume.previousRequestCount);
    assert.ok(Number.isInteger(resume.previousRequestCount) && resume.previousRequestCount < 35);
  }
  if (scope.sourceHandoff === 'CLAUDE-FIX-SPRINT-DB-HANDOFF-3-20261112') {
    assert.ok(Date.parse(snapshot.capturedAt) > Date.parse(scope.recentGameWriterCompletion.completedAt),
      'Capture predates recent-game writer completion');
    assertStep5Health(health, Date.now(), scope.maximumProbeDurationMs);
  }
  assert.equal(health.projectId, 'fyhftlxokyjtpndbkfse');
  assert.ok(health.healthy === true && health.ioLockWaits === 0 && health.longestActiveSeconds <= 5);
  assert.ok(Date.now() - Date.parse(health.checkedAt) >= 0 && Date.now() - Date.parse(health.checkedAt) < 60000, 'Health guard expired');
  for (const [file, hash] of Object.entries(prepared.codeHashes)) assert.equal(sha(fs.readFileSync(path.join(repo, file))), hash, `Prepared code changed: ${file}`);
  for (const [file, hash] of Object.entries(scope.verifiedCodeHashes ?? {}))
    assert.equal(sha(fs.readFileSync(path.join(repo, file))), hash, `Approved runtime code changed: ${file}`);
  assert.ok(!fs.existsSync(journalFile) && !fs.existsSync(`${journalFile}.after.json`), 'Journal exists; reconcile before another attempt');
  const priorEntries = fs.readdirSync(path.dirname(journalFile))
    .filter(file => /^202602\d{4}(?:-resume-\d+)?-journal\.jsonl$/.test(file))
    .flatMap(file => fs.readFileSync(path.join(path.dirname(journalFile), file), 'utf8')
      .split('\n').filter(Boolean).map(line => JSON.parse(line)));
  assertGameSpacing(priorEntries, scope.minimumGameSpacingSeconds);
  const journal = entry => fs.appendFileSync(journalFile, JSON.stringify({ at: new Date().toISOString(), gameId, ...entry }) + '\n');
  fs.writeFileSync(journalFile, '', { flag: 'wx', mode: 0o600 });
  let failed = false, requests = 0, writeIndex = 0;
  const writeOrder = resuming
    ? ['persist_shift_chart_relationships_v1', 'persist_projection_game_derived_v1']
    : ['persist_projection_game_inputs_v1', 'persist_shift_chart_relationships_v1', 'persist_projection_game_derived_v1'];
  const requestLimit = 35 - (resume?.previousRequestCount ?? 0);
  const readTables = new Set(['games', 'projection_game_materialization_status', 'nhl_api_game_payload_snapshot_heads',
    'nhl_api_game_payloads_raw', 'nhl_api_game_roster_spots', 'nhl_api_shift_rows', 'shift_charts',
    'pbp_games', 'pbp_plays', 'forge_team_game_strength', 'forge_player_game_strength', 'forge_goalie_game']);
  require(path.join(web, 'node_modules/dotenv')).config({ path: path.join(web, '.env.local'), quiet: true });
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(url.origin, 'https://fyhftlxokyjtpndbkfse.supabase.co');
  const { createClient } = require(path.join(web, 'node_modules/@supabase/supabase-js'));
  const database = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init = {}) => {
      assert.ok(!failed, 'Stopped after a previous request failed');
      const target = new URL(typeof input === 'string' ? input : input.url ?? input.toString());
      assert.equal(target.origin, url.origin); assert.ok(++requests <= requestLimit, 'Per-game request cap exceeded');
      const method = init.method ?? 'GET';
      if (method === 'POST') {
        assert.equal(target.pathname, `/rest/v1/rpc/${writeOrder[writeIndex]}`, 'Unexpected write or retry');
        assert.equal(JSON.parse(init.body).p_game_id, gameId, 'Write scope changed');
        assert.ok(Buffer.byteLength(init.body) <= 4_000_000); writeIndex++;
      } else {
        assert.equal(method, 'GET'); assert.ok(readTables.has(target.pathname.replace('/rest/v1/', '')));
      }
      const started = performance.now();
      try {
        const request = { ...init, signal: AbortSignal.timeout(5000) };
        const response = method === 'POST' ? await rpcFetch(input, request) : await fetch(input, request);
        if (!response.ok) throw new Error(`Database request failed: HTTP ${response.status}`);
        // Include the full RPC receipt body in latency, not just response headers.
        const body = method === 'POST' ? await response.text() : null;
        const durationMs = performance.now() - started;
        assert.ok(durationMs <= 5000, 'Database request exceeded the five-second stop');
        journal({ event: method === 'POST' ? 'rpc_response' : 'read_response',
          path: target.pathname, durationMs: Math.round(durationMs), transport: response.transport ?? 'fetch' });
        return body == null ? response : new Response(body, {
          status: response.status, statusText: response.statusText, headers: response.headers,
        });
      } catch (error) {
        failed = true;
        // Keep transport codes at the failure point; never log auth headers,
        // request bodies, URLs with query strings, or arbitrary cause messages.
        const cause = error?.cause;
        journal({ event: 'transport_failure', path: target.pathname, method,
          durationMs: Math.round(performance.now() - started), errorName: error?.name ?? null,
          causeName: cause?.name ?? null, causeCode: cause?.code ?? error?.code ?? null,
          tlsProtocol: error?.tlsProtocol ?? null,
          requestBytes: method === 'POST' ? Buffer.byteLength(init.body) : 0,
          socketBytesWritten: cause?.socket?.bytesWritten ?? null,
          socketBytesRead: cause?.socket?.bytesRead ?? null,
          causeCodes: Array.isArray(cause?.errors) ? cause.errors.slice(0, 5).map(item => item?.code ?? null) : [] });
        throw error;
      }
    } },
  });
  try {
    const get = async (table, build) => { const { data, error } = await build(database.from(table).select('*')); if (error) throw error; return data; };
    assert.deepEqual(await get('nhl_api_game_payload_snapshot_heads', q => q.eq('game_id', gameId)
      .in('endpoint', ['play-by-play', 'shiftcharts']).order('endpoint')), snapshot.heads, 'Heads changed before write');
    const currentManifest = await get('projection_game_materialization_status', q => q.eq('game_id', gameId).maybeSingle());
    if (resuming) assertResumeManifest(currentManifest, prepared, resume);
    else assert.deepEqual(currentManifest, snapshot.manifest, 'Manifest changed before write');
    assert.deepEqual(await get('nhl_api_game_roster_spots', q => q.eq('game_id', gameId).order('player_id')), snapshot.roster, 'Roster changed before write');
    if (snapshot.participation) assert.deepEqual(await get('nhl_api_game_payload_snapshot_heads', q => q.eq('game_id', gameId)
      .eq('endpoint', 'boxscore')), snapshot.participation.heads, 'Participation source changed before write');
    const loaded = modules(database);
    const { persistProjectionGameInputs } = loaded.get('lib/projections/ingest/projectionInputPersistence.ts');
    const derivedWriter = loaded.get('lib/projections/derived/projectionDerivedPersistence.ts');
    if (resuming) {
      journal({ event: 'resume_requested', fingerprint: prepared.inputPayload.inputFingerprint,
        stages: resume.stages, priorJournal: resume.priorJournalFile });
    } else {
      journal({ event: 'inputs_requested', fingerprint: prepared.inputPayload.inputFingerprint });
      const inputs = await persistProjectionGameInputs({ supabase: database, payload: prepared.inputPayload });
      journal({ event: 'inputs_committed', receipt: inputs });
    }
    const relationships = await loaded.relationship.persistShiftChartRelationships(prepared.relationships);
    journal({ event: 'relationships_committed', receipt: relationships });
    const manifest = await derivedWriter.readProjectionGameInputManifest({ gameId, client: database });
    const derived = await derivedWriter.persistProjectionGameDerivedV1({ gameId, manifest, ...prepared.derived, client: database });
    journal({ event: 'derived_committed', receipt: derived });
    const after = await capture(database, gameId);
    fs.writeFileSync(`${journalFile}.after.json`, JSON.stringify(after, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    assert.equal(after.manifest.derived_fingerprint, derived.derivedFingerprint);
    const readerChecks = await verify(after, prepared);
    assert.equal(writeIndex, writeOrder.length);
    journal({ event: 'verified', requests, readerChecks });
    console.log(JSON.stringify({ gameId, status: 'verified', requests, writes: writeIndex, readerChecks }));
  } catch (error) {
    journal({ event: 'stopped', requestedWrites: writeIndex, requests, error: error.message });
    throw error;
  }
}
module.exports = { verify, compareRows, assertGameSpacing, assertStep5Approval, assertStep5Health, assertResumeManifest, rpcFetch };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
