// Bounded read-only evidence/export for ONE game. Run only after the source
// owner's completion handoff and a fresh database health/activity guard.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../..');
const web = path.join(repo, 'web');
const { createClient } = require(path.join(web, 'node_modules/@supabase/supabase-js'));

function client() {
  require(path.join(web, 'node_modules/dotenv')).config({ path: path.join(web, '.env.local'), quiet: true });
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(url.hostname, 'fyhftlxokyjtpndbkfse.supabase.co', 'Unexpected Supabase project');
  assert.equal(url.protocol, 'https:');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(key, 'Server-only Supabase credentials are required');
  let requests = 0;
  const fetcher = async (input, init = {}) => {
    const target = new URL(typeof input === 'string' ? input : input.url ?? input.toString());
    assert.equal(target.origin, url.origin);
    assert.equal(init.method ?? 'GET', 'GET', 'Capture cannot mutate the database');
    assert.ok(++requests <= 20, 'Capture request budget exceeded');
    const started = performance.now();
    const response = await fetch(input, { ...init, signal: AbortSignal.timeout(5000) });
    assert.ok(performance.now() - started < 5000, 'Capture exceeded the read time limit');
    assert.ok(response.ok, `Read failed: HTTP ${response.status}`);
    return response;
  };
  return { database: createClient(url.href, key, { auth: { persistSession: false,
    autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetcher } }),
    requestCount: () => requests };
}

async function capture(database, gameId) {
  assert.ok(Number.isSafeInteger(gameId) && gameId >= 2026020001 && gameId <= 2026021312,
    'Initial repair is bounded to the 2026–27 regular season');
  const read = async (table, query, max, fields = '*') => {
    const rows = [];
    for (let offset = 0; offset <= max; offset += 1000) {
      const { data, error } = await query(database.from(table).select(fields)).range(offset, Math.min(offset + 999, max));
      if (error) throw new Error(`${table}: ${error.message}`);
      assert.ok(Array.isArray(data), `${table} returned no row array`);
      rows.push(...data);
      assert.ok(rows.length <= max, `${table} exceeded its bound`);
      if (data.length < Math.min(1000, max + 1 - offset)) return rows;
    }
    return rows;
  };
  const [game] = await read('games', q => q.eq('id', gameId), 1);
  assert.ok(game && game.seasonId === 20262027 && game.type === 2 && game.date <= '2026-11-11', 'Game outside repair scope');
  const heads = () => read('nhl_api_game_payload_snapshot_heads', q => q.eq('game_id', gameId)
    .in('endpoint', ['play-by-play', 'shiftcharts']).order('endpoint'), 2);
  const manifest = () => read('projection_game_materialization_status', q => q.eq('game_id', gameId), 1);
  const sourceHeads = await heads();
  assert.equal(sourceHeads.length, 2, 'Both retained source heads are required');
  const manifests = await manifest();
  const raw = await read('nhl_api_game_payloads_raw', q => q.in('id', sourceHeads.map(row => row.raw_payload_id)), 2);
  const roster = await read('nhl_api_game_roster_spots', q => q.eq('game_id', gameId).order('player_id'), 100);
  const represented = new Set(raw.find(row => row.endpoint === 'shiftcharts').payload.data
    .filter(row => row.typeCode === 517 && row.startTime !== row.endTime).map(row => row.playerId));
  const needsParticipation = roster.some(row => row.position_code !== 'G' && !represented.has(row.player_id));
  const participationHeads = () => read('nhl_api_game_payload_snapshot_heads', q => q.eq('game_id', gameId).eq('endpoint', 'boxscore'), 1);
  let participation;
  if (needsParticipation) {
    const heads = await participationHeads();
    participation = { heads, raw: heads.length ? await read('nhl_api_game_payloads_raw', q => q.eq('id', heads[0].raw_payload_id), 1) : [] };
  }
  const legacyShiftPlayers = await read('nhl_api_shift_rows', q => q.eq('game_id', gameId).order('shift_id'),
    2000, 'shift_id,game_id,player_id,team_id');
  const before = {};
  for (const [table, idColumn, bound] of [
    ['pbp_games', 'id', 1], ['pbp_plays', 'gameid', 1000], ['shift_charts', 'game_id', 100],
    ['forge_team_game_strength', 'game_id', 100], ['forge_player_game_strength', 'game_id', 500],
    ['forge_goalie_game', 'game_id', 10],
  ]) before[table] = await read(table, q => q.eq(idColumn, gameId), bound);
  assert.deepEqual(await heads(), sourceHeads, 'Source heads changed during capture');
  assert.deepEqual(await manifest(), manifests, 'Materialization changed during capture');
  if (participation) assert.deepEqual(await participationHeads(), participation.heads, 'Participation source changed during capture');
  return { evidenceKind: 'live_stored_capture', capturedAt: new Date().toISOString(),
    game, heads: sourceHeads, manifest: manifests[0] ?? null, raw, roster, legacyShiftPlayers, before, participation };
}

module.exports = { capture };
if (require.main === module) {
  const [, , gameText, output] = process.argv;
  if (!output) throw new Error('Usage: node capture-stored-repair.cjs GAME_ID NEW_CAPTURE.json');
  if (fs.existsSync(output)) throw new Error('Refusing to replace an existing source/export capture');
  const { database, requestCount } = client();
  capture(database, Number(gameText)).then(result => {
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ gameId: result.game.id, capturedAt: result.capturedAt,
      sourceHeads: result.heads.map(({ endpoint, raw_payload_id, snapshot_version, payload_hash }) =>
        ({ endpoint, raw_payload_id, snapshot_version, payload_hash })),
      rows: Object.fromEntries(Object.entries(result.before).map(([table, rows]) => [table, rows.length])),
      requests: requestCount(), writes: 0 }));
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
