// Offline only. No original replay or source-audit outputs are executed/overwritten.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../..');
const web = path.join(repo, 'web');
const ts = require(path.join(web, 'node_modules/typescript'));
const sourceDir = path.join(repo, 'tasks/artifacts/drm-pipeline-triage-2026-11-12');
const blocked = () => { throw new Error('Remote access blocked in offline deployment replay'); };
globalThis.fetch = blocked;
let captured;
const specials = {
  'lib/supabase': { default: { from: blocked } },
  'lib/supabase/server': { default: { from: blocked, rpc: blocked } },
  'lib/cron/manualCronAudit': { persistManualCronAudit: blocked, withManualCronAuditResponse: handler => handler },
  'utils/adminOnlyMiddleware': { default: handler => handler },
  'lib/NHL/server': { getCurrentSeason: blocked },
  'lib/supabase/Upserts/nhlRawGamecenter.mjs': { fetchHtmlShiftReportPayload: blocked },
  'lib/projections/relationshipMaterialization': {
    persistShiftChartRelationships: async input => { captured = input; return { relationshipRows: input.rows.length, idempotent: false, prunedRows: 0 }; },
    selectPendingRelationshipGameIds: blocked,
  },
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
    if (specials[id]) return { ...specials[id], __esModule: true };
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
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const inputs = ['live-replay.json', 'PREPARED-REPAIR-ROWS.json', 'official-player-clocks.json', 'replay-shift-calculations.cjs'];
const inputHashes = Object.fromEntries(inputs.map(name => [name, sha(fs.readFileSync(path.join(sourceDir, name)))]));
const fixture = JSON.parse(fs.readFileSync(path.join(sourceDir, inputs[0]), 'utf8'));
const prepared = JSON.parse(fs.readFileSync(path.join(sourceDir, inputs[1]), 'utf8'));
const official = JSON.parse(fs.readFileSync(path.join(sourceDir, inputs[2]), 'utf8')).rows;
const seconds = value => {
  if (typeof value !== 'string' || !/^\d+:[0-5]\d$/.test(value)) throw new Error('Invalid replay clock');
  const [minutes, rest] = value.split(':').map(Number);
  return minutes * 60 + rest;
};
const absolute = segment => ({ start: (segment.period - 1) * 1200 + seconds(segment.start_time), end: (segment.period - 1) * 1200 + seconds(segment.end_time) });
const overlap = (first, second) => first.reduce((total, left) => total + second.reduce((subtotal, right) => subtotal + Math.max(0, Math.min(left.end, right.end) - Math.max(left.start, right.start)), 0), 0);
const pairKey = (first, second) => [Math.min(first, second), Math.max(first, second)].join(':');
const unitKey = unit => [unit.teamId, unit.strength, unit.kind, [...unit.playerIds].sort((a, b) => a - b).join(',')].join(':');
function oracleUnits(rows) {
  const boundaries = [...new Set(rows.flatMap(row => [...row.pp_shifts, ...row.es_shifts].flatMap(segment => { const interval = absolute(segment); return [interval.start, interval.end]; })))].sort((a, b) => a - b);
  const teams = [...new Set(rows.map(row => row.team_id))];
  const result = new Map();
  const add = (teamId, strength, kind, players, duration) => {
    const unit = { teamId, strength, kind, playerIds: players.map(row => row.player_id).sort((a, b) => a - b) };
    const key = unitKey(unit); result.set(key, (result.get(key) ?? 0) + duration);
  };
  for (let index = 0; index < boundaries.length - 1; index++) {
    const start = boundaries[index], end = boundaries[index + 1], duration = end - start;
    const active = rows.flatMap(row => {
      const segment = [...row.pp_shifts, ...row.es_shifts].find(segment => { const interval = absolute(segment); return interval.start <= start && interval.end >= end; });
      return segment ? [{ ...row, state: segment.strength }] : [];
    });
    const sides = teams.map(team => active.filter(row => row.team_id === team));
    const skaters = sides.map(side => side.filter(row => row.player_type !== 'G'));
    const hasGoalies = sides.every(side => side.filter(row => row.player_type === 'G').length === 1);
    const five = hasGoalies && sides.every(side => side.length === 6 && side.every(row => row.state === 'es'));
    if (five) for (let side = 0; side < 2; side++) {
      const forwards = skaters[side].filter(row => row.player_type === 'F');
      const defenders = skaters[side].filter(row => row.player_type === 'D');
      if (forwards.length === 3 && defenders.length === 2) {
        add(teams[side], 'fiveOnFive', 'forward_line', forwards, duration);
        add(teams[side], 'fiveOnFive', 'defense_pair', defenders, duration);
      }
    }
    const ppSide = sides.findIndex(side => side.length && side.every(row => row.state === 'pp'));
    if (ppSide >= 0 && hasGoalies) {
      const pkSide = 1 - ppSide, ppCount = skaters[ppSide].length, pkCount = skaters[pkSide].length;
      if (((ppCount === 5 && [3, 4].includes(pkCount)) || (ppCount === 4 && pkCount === 3)) && sides[pkSide].every(row => row.state === 'pk')) {
        add(teams[ppSide], 'pp', 'power_play', skaters[ppSide], duration);
        add(teams[pkSide], 'pk', 'penalty_kill', skaters[pkSide], duration);
      }
    }
  }
  return result;
}
// Query mechanics only: receipts below are synthetic qualification fixtures, not DB state.
function fakeDatabase(tables) {
  return { from(table) {
    if (!Object.hasOwn(tables, table)) throw new Error(`Unexpected offline table ${table}`);
    const filters = [], orders = [];
    const q = {
      select() { return q; },
      eq(k,v) { filters.push(r => r[k] === v); return q; },
      in(k,v) { filters.push(r => v.includes(r[k])); return q; },
      gte(k,v) { filters.push(r => r[k] >= v); return q; },
      lte(k,v) { filters.push(r => r[k] <= v); return q; },
      or(text) { const clauses = text.split(',').map(c => c.split('.')); filters.push(r => clauses.some(([k,,v]) => String(r[k]) === v)); return q; },
      order(k,opts) { orders.push([k,opts?.ascending !== false]); return q; },
      async range(start,end) { return { data: tables[table].filter(r => filters.every(f => f(r))).sort((a,b) => {
        for (const [k,asc] of orders) if (a[k] !== b[k]) return (a[k] < b[k] ? -1 : 1) * (asc ? 1 : -1);
        return 0;
      }).slice(start,end+1).map(r => structuredClone(r)), error: null }; },
    }; return q;
  } };
}
const receipt = { mode: 'offline current-writer/current-engine replay; capture-only persistence',
  scope: 'five retained official-source validation games only; not live DB acceptance or full historical qualification',
  capturedAt: fixture.capturedAt, inputHashes, algorithmVersion: null, games: [], failures: [] };
const preparedV6 = { status: 'offline prepared rows only; not published; fresh source-head/CAS receipts required', games: [] };
const outputFixture = { status: 'offline fixture only; no database receipts or persisted materialization asserted', games: [] };
(async () => {
  const materializer = load(path.join(web, 'lib/projections/relationshipMaterialization.ts'));
  const algorithmVersion = materializer.SHIFT_RELATIONSHIP_ALGORITHM_VERSION;
  if (algorithmVersion !== 'shift_relationship_materializer_v6_strength_segments') throw new Error('Expected current v6 writer version');
  receipt.algorithmVersion = algorithmVersion;
  specials['lib/projections/relationshipMaterialization'].SHIFT_RELATIONSHIP_ALGORITHM_VERSION = algorithmVersion;
  const { upsertShiftChartData } = load(path.join(web, 'pages/api/v1/db/shift-charts.ts'));
  const { buildShiftSnapshotFromRawPayload, buildShiftStrengthUpserts } = load(path.join(web, 'lib/projections/ingest/shifts.ts'));
  const { buildProjectionPbpSourceHash, buildProjectionShiftSourceHash, PROJECTION_INPUT_MATERIALIZER_VERSION } = load(path.join(web, 'lib/projections/ingest/projectionInputPersistence.ts'));
  const { buildRelationshipRosterPositionMap } = load(path.join(web, 'lib/projections/relationshipPlayerPosition.ts'));
  const { analyzeDeploymentGame } = load(path.join(web, 'lib/drm/observedDeployment.ts'));
  const { readDeploymentMatrix } = load(path.join(web, 'lib/drm/readMatrix.ts'));
  const { sha256CanonicalJson } = load(path.join(web, 'lib/projections/materializationFingerprint.ts'));
  for (const original of fixture.games) {
    const reference = prepared.games.find(game => game.gameId === original.game_id);
    if (!reference) throw new Error('Missing retained prepared game');
    const gameId = original.game_id, pbp = structuredClone(original.pbp);
    const payload = structuredClone(reference.replacementShiftPayload ?? original.shift_payload);
    const rawBefore = sha(JSON.stringify({ pbp, payload }));
    const snapshot = buildShiftSnapshotFromRawPayload(gameId, payload);
    const hashes = { pbp: buildProjectionPbpSourceHash(pbp), shifts: buildProjectionShiftSourceHash(snapshot.rows) };
    if (JSON.stringify(hashes) !== JSON.stringify(reference.sourceHashes)) throw new Error(`Retained source-hash mismatch for ${gameId}`);
    const roster = buildRelationshipRosterPositionMap({ gameId, expectedPbpRawPayloadHash: original.pbp_hash,
      rows: pbp.rosterSpots.map(spot => ({ game_id: gameId, player_id: spot.playerId, team_id: spot.teamId, position_code: spot.positionCode, source_play_by_play_hash: original.pbp_hash })) });
    const strengthRows = buildShiftStrengthUpserts(gameId, pbp, snapshot.rows);
    const byStrength = new Map(strengthRows.map(row => [row.player_id, row]));
    captured = null;
    await upsertShiftChartData({ data: snapshot.rows.filter(row => row.typeCode === 517), sourceShiftHash: hashes.shifts, shiftSource: snapshot.source },
      { game_id: gameId, gameType: pbp.gameType, season_id: Number(pbp.season), gameDate: pbp.gameDate, homeTeam: pbp.homeTeam, awayTeam: pbp.awayTeam },
      [], roster, original.pbp_hash, pbp);
    if (!captured || captured.sourcePbpHash !== hashes.pbp || captured.sourceShiftHash !== hashes.shifts || captured.expectedPbpRawPayloadHash !== original.pbp_hash) throw new Error('Writer source lineage changed');
    const writerRows = captured.rows;
    const rows = writerRows.map(row => ({ game_id: row.game_id, player_id: row.player_id, team_id: row.team_id, player_type: row.player_type,
      game_toi: row.game_toi, game_length: row.game_length, total_es_toi: byStrength.get(row.player_id).total_es_toi,
      total_pp_toi: byStrength.get(row.player_id).total_pp_toi, total_pk_toi: byStrength.get(row.player_id).total_pk_toi,
      shifts: row.shifts, pp_shifts: row.pp_shifts, es_shifts: row.es_shifts }));
    const summary = { gameId, selectedShiftSource: snapshot.source, players: rows.length, strengthTaggedSegments: 0,
      officialFieldsCompared: 0, pairCombinationsChecked: 0, unitGroupsChecked: 0, errors: [], formationCoverage: null };
    for (const row of rows) {
      const expected = official.find(item => item.gameId === gameId && item.playerId === row.player_id && item.teamId === row.team_id);
      if (!expected) throw new Error('Missing official player identity');
      for (const [key, value] of Object.entries({ total: row.game_toi, es: row.total_es_toi, pp: row.total_pp_toi, pk: row.total_pk_toi })) {
        summary.officialFieldsCompared++;
        if (seconds(value) !== expected.seconds[key]) summary.errors.push(`Official ${key} clock mismatch: ${row.player_id}`);
      }
      for (const [collection, allowed] of [['pp_shifts', ['pp']], ['es_shifts', ['es', 'pk']]]) for (const segment of row[collection]) {
        summary.strengthTaggedSegments++;
        if (!allowed.includes(segment.strength)) summary.errors.push(`Missing/wrong strength tag: ${row.player_id}`);
      }
    }
    try {
      const analysis = analyzeDeploymentGame({ gameId, gameType: pbp.gameType, homeTeamId: pbp.homeTeam.id, awayTeamId: pbp.awayTeam.id, rows });
      summary.formationCoverage = analysis.formationCoverage;
      const maps = Object.fromEntries(Object.entries(analysis.pairsByStrength).map(([state, pairs]) => [state, new Map(pairs.map(pair => [pairKey(pair.firstPlayerId, pair.secondPlayerId), pair.seconds]))]));
      for (const row of rows) {
        const playerId = row.player_id;
        if (analysis.totalsByStrength.all[playerId] !== seconds(row.game_toi) || analysis.totalsByStrength.pp[playerId] !== seconds(row.total_pp_toi) ||
          analysis.totalsByStrength.pk[playerId] !== seconds(row.total_pk_toi) || analysis.totalsByStrength.fiveOnFive[playerId] + analysis.totalsByStrength.otherEs[playerId] !== seconds(row.total_es_toi)) summary.errors.push(`Deployment player total mismatch: ${playerId}`);
      }
      for (let first = 0; first < rows.length; first++) for (let second = first + 1; second < rows.length; second++) {
        const left = rows[first], right = rows[second];
        if (left.team_id !== right.team_id) continue;
        summary.pairCombinationsChecked++;
        const key = pairKey(left.player_id, right.player_id);
        const all = overlap(left.shifts.map(absolute), right.shifts.map(absolute));
        const pp = overlap(left.pp_shifts.map(absolute), right.pp_shifts.map(absolute));
        const pk = overlap(left.es_shifts.filter(row => row.strength === 'pk').map(absolute), right.es_shifts.filter(row => row.strength === 'pk').map(absolute));
        const es = overlap(left.es_shifts.filter(row => row.strength === 'es').map(absolute), right.es_shifts.filter(row => row.strength === 'es').map(absolute));
        const storedLeft = writerRows[first], storedRight = writerRows[second];
        const stored = { ...storedLeft.time_spent_with, ...storedLeft.time_spent_with_mixed }[right.player_id];
        const mirrored = { ...storedRight.time_spent_with, ...storedRight.time_spent_with_mixed }[left.player_id];
        if ((maps.all.get(key) ?? 0) !== all || (maps.pp.get(key) ?? 0) !== pp || (maps.pk.get(key) ?? 0) !== pk ||
          (maps.fiveOnFive.get(key) ?? 0) + (maps.otherEs.get(key) ?? 0) !== es || seconds(stored ?? '0:00') !== all || seconds(mirrored ?? '0:00') !== all) summary.errors.push(`Pair overlap mismatch: ${key}`);
      }
      const expectedUnits = oracleUnits(rows);
      const actualUnits = new Map(analysis.units.map(unit => [unitKey(unit), unit.seconds]));
      for (const key of new Set([...expectedUnits.keys(), ...actualUnits.keys()])) {
        summary.unitGroupsChecked++;
        if (expectedUnits.get(key) !== actualUnits.get(key)) summary.errors.push(`Unit interval recount mismatch: ${key}`);
      }
      summary.unitKinds = Object.fromEntries(['forward_line', 'defense_pair', 'power_play', 'penalty_kill'].map(kind => [kind, analysis.units.filter(unit => unit.kind === kind).length]));
    } catch (error) { summary.errors.push(error.message); }
    if (rawBefore !== sha(JSON.stringify({ pbp, payload }))) summary.errors.push('Raw payload mutation');
    const pbpId = gameId * 2, shiftId = pbpId + 1;
    const selectedRawShiftHash = sha256CanonicalJson(payload);
    const manifest = { game_id: gameId, input_status: 'complete', input_fingerprint: hashes.pbp,
      input_version: 1, input_materializer_version: PROJECTION_INPUT_MATERIALIZER_VERSION,
      relationship_status: 'complete', relationship_input_fingerprint: hashes.pbp, relationship_fingerprint: hashes.shifts,
      relationship_version: 1, relationship_algorithm_version: algorithmVersion,
      pbp_raw_payload_id: pbpId, pbp_raw_payload_hash: original.pbp_hash, pbp_raw_snapshot_version: 1,
      shift_raw_payload_id: shiftId, shift_raw_payload_hash: selectedRawShiftHash, shift_raw_snapshot_version: 1,
      expected_strength_rows: rows.length, observed_strength_rows: rows.length,
      expected_relationship_rows: rows.length, observed_relationship_rows: rows.length };
    const tables = {
      games: [{ id: gameId, date: pbp.gameDate, seasonId: Number(pbp.season), type: pbp.gameType, homeTeamId: pbp.homeTeam.id, awayTeamId: pbp.awayTeam.id }],
      projection_game_materialization_status: [manifest],
      nhl_api_game_payload_snapshot_heads: [
        { game_id: gameId, endpoint: 'play-by-play', raw_payload_id: pbpId, payload_hash: original.pbp_hash, snapshot_version: 1 },
        { game_id: gameId, endpoint: 'shiftcharts', raw_payload_id: shiftId, payload_hash: selectedRawShiftHash, snapshot_version: 1 },
      ],
      nhl_api_game_payloads_raw: [{ id: pbpId, game_id: gameId, endpoint: 'play-by-play', payload_hash: original.pbp_hash,
        game_state: pbp.gameState, source_game_id: String(gameId), source_game_type: String(pbp.gameType), source_date: pbp.gameDate,
        source_season: String(pbp.season), home_id: String(pbp.homeTeam.id), away_id: String(pbp.awayTeam.id),
        final_period: String(pbp.periodDescriptor.number), final_period_type: pbp.gameOutcome.lastPeriodType, time_remaining: pbp.clock.timeRemaining }],
      nhl_api_game_roster_spots: pbp.rosterSpots.map(spot => ({ game_id: gameId, player_id: spot.playerId, team_id: spot.teamId,
        position_code: spot.positionCode, first_name: spot.firstName?.default, last_name: spot.lastName?.default,
        sweater_number: spot.sweaterNumber, source_play_by_play_hash: original.pbp_hash })),
      shift_charts: writerRows.map((row,index) => ({ ...row, ...rows[index], id: index + 1 })),
      skatersGameStats: [], goaliesGameStats: [],
    };
    summary.reader = { receiptMode: 'synthetic complete receipts over retained real payloads; no DB admission asserted', teams: [], playerStrengthFieldsCompared: 0 };
    for (const teamId of [pbp.homeTeam.id, pbp.awayTeam.id]) {
      const result = await readDeploymentMatrix(fakeDatabase(tables), { teamId, seasonId: Number(pbp.season), seasonType: pbp.gameType === 2 ? 'regularSeason' : 'playoffs', startDate: pbp.gameDate, endDate: pbp.gameDate });
      summary.reader.teams.push({ teamId, coverage: result.coverage });
      if (result.coverage.acceptedGames !== 1) summary.errors.push(`Reader excluded ${gameId}/${teamId}: ${JSON.stringify(result.coverage.games)}`);
      for (const row of rows.filter(row => row.team_id === teamId)) {
        const player = strength => result.byStrength[strength][row.player_id]?.[pbp.gameType === 2 ? 'regularSeasonData' : 'playoffData'];
        for (const [actual, expected] of [
          [player('all')?.totalTOI, seconds(row.game_toi)],
          [(player('fiveOnFive')?.totalTOI ?? NaN) + (player('otherEs')?.totalTOI ?? NaN), seconds(row.total_es_toi)],
          [player('pp')?.totalTOI, seconds(row.total_pp_toi)], [player('pk')?.totalTOI, seconds(row.total_pk_toi)],
        ]) { summary.reader.playerStrengthFieldsCompared++; if (actual !== expected) summary.errors.push(`Reader total mismatch ${gameId}/${row.player_id}: ${actual} != ${expected}`); }
      }
    }
    preparedV6.games.push({ gameId, inputMaterializerVersion: PROJECTION_INPUT_MATERIALIZER_VERSION,
      relationshipAlgorithmVersion: algorithmVersion, capturedPbpHash: original.pbp_hash, selectedRawShiftHash,
      sourceHashes: hashes, selectedShiftSource: snapshot.source, replacementShiftPayload: reference.replacementShiftPayload,
      strengthRows, relationshipRows: writerRows });
    receipt.games.push(summary);
    outputFixture.games.push({ gameId, gameType: pbp.gameType, seasonId: Number(pbp.season), gameDate: pbp.gameDate,
      homeTeamId: pbp.homeTeam.id, awayTeamId: pbp.awayTeam.id, relationshipAlgorithmVersion: algorithmVersion,
      inputMaterializerVersion: PROJECTION_INPUT_MATERIALIZER_VERSION, sourceHashes: hashes, capturedPbpHash: original.pbp_hash, rows });
  }
  receipt.sourceAuditFilesUnchanged = inputs.every(name => inputHashes[name] === sha(fs.readFileSync(path.join(sourceDir, name))));
  receipt.loadedCodeHashes = Object.fromEntries([...cache.keys()].sort().map(file => [path.relative(repo, file), sha(fs.readFileSync(file))]));
  receipt.totals = { games: receipt.games.length, players: receipt.games.reduce((sum, game) => sum + game.players, 0),
    officialFieldsCompared: receipt.games.reduce((sum, game) => sum + game.officialFieldsCompared, 0),
    strengthTaggedSegments: receipt.games.reduce((sum, game) => sum + game.strengthTaggedSegments, 0),
    pairCombinationsChecked: receipt.games.reduce((sum, game) => sum + game.pairCombinationsChecked, 0),
    unitGroupsChecked: receipt.games.reduce((sum, game) => sum + game.unitGroupsChecked, 0),
    readerStrengthFieldsCompared: receipt.games.reduce((sum, game) => sum + game.reader.playerStrengthFieldsCompared, 0),
    failures: receipt.games.reduce((sum, game) => sum + game.errors.length, 0) };
  receipt.allChecksPassed = receipt.sourceAuditFilesUnchanged && receipt.totals.games === 5 && receipt.totals.players === official.length && receipt.totals.officialFieldsCompared === 760 && receipt.totals.failures === 0;
  fs.writeFileSync(path.join(__dirname, 'OBSERVED-DEPLOYMENT-REPLAY.json'), JSON.stringify(receipt, null, 2) + '\n');
  if (receipt.allChecksPassed) fs.writeFileSync(path.join(__dirname, 'PREPARED-REPAIR-ROWS-v6.json'), JSON.stringify(preparedV6) + '\n');
  fs.writeFileSync(path.join(__dirname, 'OBSERVED-DEPLOYMENT-FIXTURE.json'), JSON.stringify(outputFixture) + '\n');
  console.log(JSON.stringify({ allChecksPassed: receipt.allChecksPassed, ...receipt.totals, gameErrors: receipt.games.map(game => ({ gameId: game.gameId, errors: game.errors })) }));
  if (!receipt.allChecksPassed) process.exitCode = 1;
})().catch(error => { receipt.failures.push(error.message); fs.writeFileSync(path.join(__dirname, 'OBSERVED-DEPLOYMENT-REPLAY.json'), JSON.stringify(receipt, null, 2) + '\n'); console.error(error.message); process.exitCode = 1; });
