// Offline preparation only. Read one captured game's final heads, raw sources,
// roster and manifest; run the current writers and reader before any DB write.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../..');
const web = path.join(repo, 'web');
const ts = require(path.join(web, 'node_modules/typescript'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const blocked = () => { throw new Error('Remote access is disabled during DRM repair preparation'); };

function modules(database = { from: blocked, rpc: blocked }, capture) {
  const overrides = {
    'lib/supabase': { default: database },
    'lib/supabase/server': { default: database },
    'lib/cron/manualCronAudit': { persistManualCronAudit: blocked, withManualCronAuditResponse: handler => handler },
    'utils/adminOnlyMiddleware': { default: handler => handler },
    'lib/NHL/server': { getCurrentSeason: blocked },
    'lib/supabase/Upserts/nhlRawGamecenter.mjs': { fetchHtmlShiftReportPayload: blocked },
    'hooks/useGoals': { NORMAL_PERIOD_IN_SECONDS: 1200 },
    'lib/cors-fetch': { default: blocked },
    react: { useEffect: blocked, useState: blocked },
  };
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const localRequire = id => {
      if (overrides[id]) return { ...overrides[id], __esModule: true };
      if (id === './nhleFetch') return { nhleFetchJson: blocked };
      if (/^node:(?:https?|net|tls|dns)$/.test(id)) return blocked();
      if (id.startsWith('node:')) return require(id);
      const base = id.startsWith('.') ? path.resolve(path.dirname(file), id) : path.resolve(web, id);
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return load(candidate);
      }
      throw new Error(`Unexpected dependency ${id}`);
    };
    let source = fs.readFileSync(file, 'utf8');
    if (file.endsWith('/pages/api/v1/db/shift-charts.ts')) source += '\nexport { upsertShiftChartData };';
    const output = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    new Function('require', 'module', 'exports', 'console', output)(localRequire, module, module.exports,
      { ...console, log() {} });
    return module.exports;
  }
  const get = file => load(path.join(web, file));
  const relationship = get('lib/projections/relationshipMaterialization.ts');
  if (capture) overrides['lib/projections/relationshipMaterialization'] = {
    ...relationship, persistShiftChartRelationships: async input => {
      capture(input);
      return { relationshipRows: input.rows.length, idempotent: false, prunedRows: 0 };
    },
  };
  return { get, relationship, codeHashes: () => Object.fromEntries([...cache.keys()].sort()
    .map(file => [path.relative(repo, file), sha(fs.readFileSync(file))])) };
}

function fixtureDatabase(tables) {
  return { from(table) {
    assert.ok(Object.hasOwn(tables, table), `Unexpected offline table ${table}`);
    const filters = [], orders = [];
    const query = {
      select() { return query; },
      eq(k, v) { filters.push(row => row[k] === v); return query; },
      in(k, v) { filters.push(row => v.includes(row[k])); return query; },
      gte(k, v) { filters.push(row => row[k] >= v); return query; },
      lte(k, v) { filters.push(row => row[k] <= v); return query; },
      or(text) {
        const clauses = text.split(',').map(c => c.split('.'));
        filters.push(row => clauses.some(([k, op, v, tail]) => op === 'eq' ? String(row[k]) === v :
          op === 'not' && v === 'is' && tail === 'null' ? row[k] != null : false)); return query;
      },
      order(k, opts) { orders.push([k, opts?.ascending !== false]); return query; },
      async range(start, end) {
        return { data: tables[table].filter(row => filters.every(f => f(row))).sort((a, b) => {
          for (const [k, asc] of orders) if (a[k] !== b[k]) return (a[k] < b[k] ? -1 : 1) * (asc ? 1 : -1);
          return 0;
        }).slice(start, end + 1).map(row => structuredClone(row)), error: null };
      },
      async maybeSingle() {
        const { data } = await query.range(0, 1);
        assert.ok(data.length <= 1, `Multiple ${table} rows for maybeSingle`);
        return { data: data[0] ?? null, error: null };
      },
    }; return query;
  } };
}

function readerSourceRows(snapshot) {
  return [...snapshot.raw, ...(snapshot.participation?.raw ?? [])]
    .filter(row => ['play-by-play', 'boxscore'].includes(row.endpoint)).map(row => {
      const p = row.payload;
      return { ...row, game_state: p.gameState, source_game_id: String(p.id),
        source_game_type: String(p.gameType), source_date: p.gameDate, source_season: String(p.season),
        home_id: String(p.homeTeam.id), away_id: String(p.awayTeam.id), final_period: String(p.periodDescriptor.number),
        final_period_type: p.gameOutcome?.lastPeriodType, time_remaining: p.clock?.timeRemaining,
        player_stats: p.playerByGameStats };
    });
}

async function prepare(snapshot) {
  const original = JSON.stringify(snapshot);
  const gameId = snapshot.game.id;
  let relationships;
  const loaded = modules(undefined, input => { relationships = input; });
  const inputWriter = loaded.get('lib/projections/ingest/projectionInputPersistence.ts');
  const shiftWriter = loaded.get('lib/projections/ingest/shifts.ts');
  const { isCompleteFinalPbpPayload } = loaded.get('lib/projections/ingest/pbp.ts');
  const { buildRelationshipRosterPositionMap } = loaded.get('lib/projections/relationshipPlayerPosition.ts');
  const { upsertShiftChartData } = loaded.get('pages/api/v1/db/shift-charts.ts');
  const { readDeploymentMatrix } = loaded.get('lib/drm/readMatrix.ts');
  const rawSnapshots = { gameId };
  const raw = {};
  assert.equal(snapshot.heads.length, 2, 'Exactly two source heads required');
  for (const [endpoint, key] of [['play-by-play', 'pbp'], ['shiftcharts', 'shifts']]) {
    const heads = snapshot.heads.filter(row => row.endpoint === endpoint);
    assert.equal(heads.length, 1, `Missing/duplicate ${endpoint} head`);
    const head = heads[0];
    assert.equal(head.game_id, gameId);
    const rows = snapshot.raw.filter(row => row.id === head.raw_payload_id);
    assert.equal(rows.length, 1, `Missing/duplicate ${endpoint} raw source`);
    const row = rows[0];
    assert.equal(row.game_id, gameId); assert.equal(row.endpoint, endpoint);
    assert.equal(row.payload_hash, head.payload_hash);
    raw[key] = row;
    rawSnapshots[key] = { rawPayloadId: row.id, snapshotVersion: head.snapshot_version, payloadHash: row.payload_hash };
  }
  const pbp = raw.pbp.payload;
  assert.ok(isCompleteFinalPbpPayload(pbp), 'PBP must be final and complete');
  assert.equal(pbp.id, gameId); assert.equal(pbp.gameDate, snapshot.game.date);
  assert.equal(Number(pbp.season), snapshot.game.seasonId); assert.equal(pbp.gameType, snapshot.game.type);
  assert.equal(pbp.homeTeam.id, snapshot.game.homeTeamId); assert.equal(pbp.awayTeam.id, snapshot.game.awayTeamId);
  const shifts = shiftWriter.buildShiftSnapshotFromRawPayload(gameId, raw.shifts.payload);
  const strengthRows = shiftWriter.buildShiftStrengthUpserts(gameId, pbp, shifts.rows);
  const inputPayload = inputWriter.buildProjectionInputRpcPayload({ gameId, pbp,
    shiftSourceRows: shifts.rows, strengthRows, rawSnapshots,
    expectedCurrentInputFingerprint: snapshot.manifest?.input_fingerprint ?? null });
  const roster = buildRelationshipRosterPositionMap({ gameId, expectedPbpRawPayloadHash: raw.pbp.payload_hash, rows: snapshot.roster });
  await upsertShiftChartData({ data: shifts.rows.filter(row => row.typeCode === 517),
    sourceShiftHash: inputPayload.shiftSourceHash, shiftSource: shifts.source },
  { game_id: gameId, gameType: pbp.gameType, season_id: Number(pbp.season), gameDate: pbp.gameDate,
    homeTeam: pbp.homeTeam, awayTeam: pbp.awayTeam }, [], roster, raw.pbp.payload_hash, pbp);
  assert.ok(relationships);
  assert.equal(relationships.sourcePbpHash, inputPayload.pbpSourceHash);
  assert.equal(relationships.sourceShiftHash, inputPayload.shiftSourceHash);
  const algorithmVersion = loaded.relationship.SHIFT_RELATIONSHIP_ALGORITHM_VERSION;
  const relationshipFingerprint = loaded.relationship.buildShiftRelationshipFingerprint({
    inputFingerprint: inputPayload.inputFingerprint, algorithmVersion, rows: relationships.rows });
  const count = strengthRows.length;
  assert.equal(relationships.rows.length, count);
  const byId = new Map(strengthRows.map(row => [row.player_id, row]));
  // These receipts are deliberately synthetic: this proves preparation would
  // satisfy the real reader, not that anything has already been persisted.
  const manifest = { game_id: gameId, input_status: 'complete', input_fingerprint: inputPayload.inputFingerprint,
    input_version: 1, input_materializer_version: inputPayload.materializerVersion,
    relationship_status: 'complete', relationship_input_fingerprint: inputPayload.inputFingerprint,
    relationship_fingerprint: relationshipFingerprint, relationship_version: 1, relationship_algorithm_version: algorithmVersion,
    expected_strength_rows: count, observed_strength_rows: count, expected_relationship_rows: count, observed_relationship_rows: count };
  for (const [key, prefix] of [['pbp', 'pbp'], ['shifts', 'shift']]) {
    manifest[`${prefix}_raw_payload_id`] = rawSnapshots[key].rawPayloadId;
    manifest[`${prefix}_raw_payload_hash`] = rawSnapshots[key].payloadHash;
    manifest[`${prefix}_raw_snapshot_version`] = rawSnapshots[key].snapshotVersion;
  }
  const tables = { games: [snapshot.game], projection_game_materialization_status: [manifest],
    nhl_api_game_payload_snapshot_heads: [...snapshot.heads, ...(snapshot.participation?.heads ?? [])], nhl_api_game_roster_spots: snapshot.roster,
    nhl_api_game_payloads_raw: readerSourceRows(snapshot),
    shift_charts: relationships.rows.map((row, index) => ({ ...row, ...byId.get(row.player_id), id: index + 1 })),
    skatersGameStats: [], goaliesGameStats: [] };
  const checks = [];
  for (const teamId of [pbp.homeTeam.id, pbp.awayTeam.id]) {
    const result = await readDeploymentMatrix(fixtureDatabase(tables), { teamId, seasonId: Number(pbp.season),
      seasonType: pbp.gameType === 2 ? 'regularSeason' : 'playoffs', startDate: pbp.gameDate, endDate: pbp.gameDate, gameIds: [gameId] });
    assert.equal(result.coverage.acceptedGames, 1, JSON.stringify(result.coverage.games));
    checks.push({ teamId, coverage: result.coverage, units: result.units.length });
  }
  assert.ok(Array.isArray(snapshot.legacyShiftPlayers), 'Stored shift-player manifest is required before changing projection inputs');
  const dependent = modules(fixtureDatabase({ ...tables, pbp_games: [inputPayload.gameRow],
    pbp_plays: inputPayload.playRows, nhl_api_shift_rows: snapshot.legacyShiftPlayers }));
  const { preparePlayerGameStrengthV2, prepareTeamGameStrengthV2 } = dependent.get('lib/projections/derived/buildStrengthTablesV2.ts');
  const { prepareGoalieGameV2 } = dependent.get('lib/projections/derived/buildGoalieGameV2.ts');
  const playerPrepared = await preparePlayerGameStrengthV2({ game: snapshot.game });
  const derived = { playerRows: playerPrepared.rows,
    teamRows: prepareTeamGameStrengthV2({ game: snapshot.game, playerRows: playerPrepared.rows }),
    goalie: prepareGoalieGameV2({ game: snapshot.game, plays: playerPrepared.plays }) };
  assert.ok(derived.playerRows.length > 0 && derived.playerRows.length <= 100);
  assert.equal(derived.teamRows.length, 2); assert.ok(derived.goalie.rows.length <= 4);
  assert.equal(JSON.stringify(snapshot), original, 'Captured evidence was mutated');
  return { status: 'prepared_only', evidenceKind: snapshot.evidenceKind,
    gameId, capturedAt: snapshot.capturedAt, snapshotHash: sha(original), sourceHeads: snapshot.heads,
    inputPayload, relationships, relationshipFingerprint, algorithmVersion, derived,
    participationHeads: snapshot.participation?.heads ?? [],
    readerChecks: checks, codeHashes: { ...loaded.codeHashes(), ...dependent.codeHashes() } };
}

module.exports = { prepare, modules, fixtureDatabase, readerSourceRows };
if (require.main === module) {
  globalThis.fetch = blocked;
  const [, , input, output] = process.argv;
  if (!input || !output) throw new Error('Usage: node prepare-stored-repair.cjs CAPTURE.json OUTPUT.json');
  prepare(JSON.parse(fs.readFileSync(input, 'utf8'))).then(result => {
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ gameId: result.gameId, status: result.status,
      players: result.relationships.rows.length, checks: result.readerChecks }));
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
