// Offline replay only: all remote-capable dependencies are blocked.
const fs = require('node:fs'), path = require('node:path');
const ts = require(path.resolve(__dirname, '../../../web/node_modules/typescript'));
const repoRoot = path.resolve(__dirname, '../../..');
const root = path.join(repoRoot, 'web');
let captured;
const blocked=()=>{throw Error('Remote call blocked in local arithmetic probe')};
const special={
 'lib/supabase/server': {default: {from:blocked}},
 'lib/cron/manualCronAudit': {persistManualCronAudit:blocked,withManualCronAuditResponse:x=>x},
 'utils/adminOnlyMiddleware': {default:x=>x},
 'lib/NHL/server': {getCurrentSeason:blocked},
 'lib/supabase/pagination': {fetchAllSupabasePages:blocked},
 'lib/supabase/Upserts/nhlRawGamecenter.mjs': {fetchHtmlShiftReportPayload:blocked},
 'lib/projections/relationshipMaterialization': {persistShiftChartRelationships:async x=>{captured=x;return {relationshipRows:x.rows.length,idempotent:false,prunedRows:0}},selectPendingRelationshipGameIds:blocked},
 'hooks/useGoals': {NORMAL_PERIOD_IN_SECONDS:1200},
 'lib/cors-fetch': {default:blocked},
 'react': {useEffect:blocked,useState:blocked},
};
const cache={};
function load(file){
 file=path.resolve(file);if(cache[file])return cache[file].exports;
 const m={exports:{}};cache[file]=m;
 const req=id=>{
  if(special[id])return {...special[id],__esModule:true};
  if(id==='./nhleFetch') return {nhleFetchJson:blocked};
  if(id.startsWith('node:'))return require(id);
  const p=id.startsWith('.')?path.resolve(path.dirname(file),id):path.resolve(root,id);
  for(const f of [p,p+'.ts',p+'.tsx'])if(fs.existsSync(f)&&fs.statSync(f).isFile())return load(f);
  throw Error('Unexpected dependency '+id+' from '+file);
 };
 let source=fs.readFileSync(file,'utf8');if(file.endsWith('/shift-charts.ts'))source+='\nexport {upsertShiftChartData};';
 const out=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',out)(req,m,m.exports);return m.exports;
}
const { upsertShiftChartData } = load(root + '/pages/api/v1/db/shift-charts.ts');
const { buildShiftSnapshotFromRawPayload, buildCanonicalShiftIntervals, buildShiftStrengthUpserts } = load(root + '/lib/projections/ingest/shifts.ts');
const { buildProjectionPbpSourceHash, buildProjectionShiftSourceHash } = load(root + '/lib/projections/ingest/projectionInputPersistence.ts');
const { hashProjectionRawJson } = load(root + '/lib/projections/ingest/rawSnapshotPersistence.ts');
const { buildRelationshipRosterPositionMap } = load(root + '/lib/projections/relationshipPlayerPosition.ts');
const { buildTeamPpClock } = load(root + '/utils/getPowerPlayBlocks.ts');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'live-replay.json'), 'utf8'));
const officialSources = process.argv.includes('--official-shift-reports');
const seconds = value => {
  if (typeof value !== 'string' || !/^\d+:[0-5]\d$/.test(value)) return null;
  const [m, s] = value.split(':').map(Number); return m * 60 + s;
};
const result = {
  mode: 'offline fixture replay; actual route/calculation/payload code; capture-only persistence',
  qualification: officialSources
    ? 'Actual production HTML parser selects complete official reports for the two source-disagreement games; fresh candidate snapshots are local only, not persisted. Compare all players against independently parsed ES/GS facts.'
    : 'Original immutable captured snapshots. Arithmetic and strength timing are checked; known upstream JSON/source-age differences must remain visible in the official comparison.',
  fixtureCapturedAt: fixture.capturedAt,
  provenance: 'Roster rows reconstructed from the same captured PBP rosterSpots and bound to its captured manifest hash; Yahoo positions intentionally empty, exercising the real NHL roster fallback. Live RPC/CAS, database persistence, and original raw JSON serialization hashes are not revalidated.',
  games: [],
};
const prepared = [];
(async () => {
  const { buildHtmlShiftReportPayload } = officialSources
    ? await import(path.join(root, 'lib/supabase/Upserts/nhlRawGamecenter.mjs')) : {};
  for (const capturedGame of fixture.games) {
    const game = structuredClone(capturedGame);
    if (officialSources && [2026020009, 2026020205].includes(game.game_id)) {
      game.shift_payload = buildHtmlShiftReportPayload({
        gameId: game.game_id, seasonId: Number(game.pbp.season), game: game.pbp,
        jsonPayload: capturedGame.shift_payload, strict: true,
        homeHtml: fs.readFileSync(`/tmp/drm-TH${String(game.game_id).slice(-6)}.HTM`, 'utf8'),
        visitorHtml: fs.readFileSync(`/tmp/drm-TV${String(game.game_id).slice(-6)}.HTM`, 'utf8'),
      });
    }
    const gameId = game.game_id, pbp = game.pbp;
    const snapshot = buildShiftSnapshotFromRawPayload(gameId, game.shift_payload);
    const rawBefore = { pbp: hashProjectionRawJson(pbp), shifts: hashProjectionRawJson(game.shift_payload) };
    const sourceBefore = { pbp: buildProjectionPbpSourceHash(pbp), shifts: buildProjectionShiftSourceHash(snapshot.rows) };
    const roster = buildRelationshipRosterPositionMap({
      gameId, expectedPbpRawPayloadHash: game.pbp_hash,
      rows: pbp.rosterSpots.map(spot => ({
        game_id: gameId, player_id: spot.playerId, team_id: spot.teamId,
        position_code: spot.positionCode, source_play_by_play_hash: game.pbp_hash,
      })),
    });
    const strengthRows = buildShiftStrengthUpserts(gameId, pbp, snapshot.rows);
    const strengthByPlayer = new Map(strengthRows.map(row => [row.player_id, row]));
    await upsertShiftChartData({
      data: snapshot.rows.filter(row => row.typeCode === 517),
      sourceShiftHash: sourceBefore.shifts, shiftSource: snapshot.source,
    }, {
      game_id: gameId, gameType: pbp.gameType, season_id: Number(pbp.season),
      gameDate: pbp.gameDate, homeTeam: pbp.homeTeam, awayTeam: pbp.awayTeam,
    }, [], roster, game.pbp_hash, pbp);
    const rows = captured.rows, byPlayer = new Map(rows.map(row => [row.player_id, row]));
    const teamClocks = [pbp.homeTeam.id, pbp.awayTeam.id].map(teamId => buildTeamPpClock({
      gameId, teamId, homeTeamId: pbp.homeTeam.id, awayTeamId: pbp.awayTeam.id,
      gameType: pbp.gameType, plays: pbp.plays,
    }));
    if (officialSources) prepared.push({
      gameId, capturedPbpHash: game.pbp_hash, sourceHashes: sourceBefore,
      selectedShiftSource: snapshot.source,
      replacementShiftPayload: snapshot.source === 'htmlreports' ? game.shift_payload : null,
      strengthRows, relationshipRows: rows,
    });
    const invalidRows = [], strengthMismatches = [], invalidPairs = [], mirrorMismatches = [];
    let directedPairsChecked = 0;
    for (const row of rows) {
      const total = seconds(row.game_toi), length = seconds(row.game_length);
      if (!(total > 0 && length >= total)) invalidRows.push(row.player_id);
      const strength = strengthByPlayer.get(row.player_id);
      const strengthTotal = strength && ['total_es_toi', 'total_pp_toi', 'total_pk_toi'].reduce((sum, key) => sum + seconds(strength[key]), 0);
      if (strengthTotal !== total) strengthMismatches.push({ playerId: row.player_id, total, strengthTotal });
      for (const [otherId, clock] of Object.entries({ ...row.time_spent_with, ...row.time_spent_with_mixed })) {
        directedPairsChecked += 1;
        const other = byPlayer.get(Number(otherId)), pair = seconds(clock);
        if (pair == null || !other || other.team_id !== row.team_id || pair > total || pair > seconds(other.game_toi)) {
          invalidPairs.push({ playerId: row.player_id, otherId, clock });
        }
        const reverse = other && { ...other.time_spent_with, ...other.time_spent_with_mixed }[row.player_id];
        if (reverse !== clock) mirrorMismatches.push({ playerId: row.player_id, otherId, clock, reverse });
      }
    }
    const sourceAfter = { pbp: buildProjectionPbpSourceHash(pbp), shifts: buildProjectionShiftSourceHash(snapshot.rows) };
    const rawAfter = { pbp: hashProjectionRawJson(pbp), shifts: hashProjectionRawJson(game.shift_payload) };
    const oldByPlayer = new Map(game.stored.map(row => [row.player_id, row]));
    const goalies = rows.filter(row => row.player_type === 'G').map(row => {
      const old = oldByPlayer.get(row.player_id), strength = strengthByPlayer.get(row.player_id);
      return { playerId: row.player_id, name: `${row.player_first_name} ${row.player_last_name}`, oldGameToi: old?.game_toi ?? null,
        correctedGameToi: row.game_toi, gameLength: row.game_length,
        oldStrength: old && { es: old.total_es_toi, pp: old.total_pp_toi, pk: old.total_pk_toi },
        correctedStrength: { es: strength.total_es_toi, pp: strength.total_pp_toi, pk: strength.total_pk_toi } };
    });
    result.games.push({
      gameId,
      selectedShiftSource: snapshot.source,
      counts: { rawRows: game.shift_payload.data.length, normalizedSourceRows: snapshot.rows.length,
        canonicalIntervals: buildCanonicalShiftIntervals(gameId, pbp, snapshot.rows).length,
        storedRows: game.stored.length, storedNullToiRows: game.stored.filter(row => row.game_toi == null).length,
        correctedRows: rows.length, strengthRows: strengthRows.length, directedPairsChecked },
      goalies,
      teamClocks,
      playerClocks: rows.map(row => ({
        gameId, playerId: row.player_id, teamId: row.team_id,
        totalSeconds: seconds(row.game_toi),
        esSeconds: seconds(strengthByPlayer.get(row.player_id).total_es_toi),
        ppSeconds: seconds(strengthByPlayer.get(row.player_id).total_pp_toi),
        pkSeconds: seconds(strengthByPlayer.get(row.player_id).total_pk_toi),
        relationshipPpSeconds: row.pp_shifts.reduce((sum, shift) => sum + seconds(shift.duration), 0),
        relationshipNonPpSeconds: row.es_shifts.reduce((sum, shift) => sum + seconds(shift.duration), 0),
      })),
      checks: { teamPpClocksQualified: teamClocks.every(clock => clock.qualified), allRowsHaveValidToi: invalidRows.length === 0,
        playerToiEqualsStrengthTotal: strengthMismatches.length === 0,
        everyPairWithinBothPlayerTotals: invalidPairs.length === 0,
        mirroredPairsEqual: mirrorMismatches.length === 0,
        sourceHashesPreserved: JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter),
        rawPayloadsUnchanged: JSON.stringify(rawBefore) === JSON.stringify(rawAfter),
        routeUsedOriginalSourceHashes: captured.sourcePbpHash === sourceBefore.pbp && captured.sourceShiftHash === sourceBefore.shifts,
        rosterBoundToCapturedPbpHash: captured.expectedPbpRawPayloadHash === game.pbp_hash },
      sourceHashes: sourceBefore,
      capturedRawHashes: { pbp: game.pbp_hash, shifts: game.shift_hash },
      failures: { invalidRows, strengthMismatches, invalidPairs, mirrorMismatches },
    });
  }
  result.allChecksPassed = result.games.every(game => Object.values(game.checks).every(Boolean));
  const official = JSON.parse(fs.readFileSync(path.join(__dirname, 'official-player-clocks.json'), 'utf8')).rows;
  const actual = result.games.flatMap(game => game.playerClocks);
  const differences = [];
  for (const expected of official) {
    const row = actual.find(a => a.gameId === expected.gameId && a.playerId === expected.playerId && a.teamId === expected.teamId);
    for (const key of ['total', 'es', 'pp', 'pk']) {
      if (row?.[key + 'Seconds'] !== expected.seconds[key]) differences.push({ gameId: expected.gameId, playerId: expected.playerId, field: key, expected: expected.seconds[key], actual: row?.[key + 'Seconds'] ?? null });
    }
    if (row && (row.relationshipPpSeconds !== row.ppSeconds || row.relationshipNonPpSeconds !== row.esSeconds + row.pkSeconds)) differences.push({ gameId: expected.gameId, playerId: expected.playerId, field: 'relationship segment agreement' });
  }
  result.officialComparison = { expectedPlayers: official.length, actualPlayers: actual.length, fieldsCompared: official.length * 4, allMatch: differences.length === 0 && official.length === actual.length, differences };
  result.calculationChecksPassed = result.allChecksPassed;
  result.allChecksPassed &&= result.officialComparison.allMatch;
  if (officialSources && result.allChecksPassed) fs.writeFileSync(path.join(__dirname, 'PREPARED-REPAIR-ROWS.json'), JSON.stringify({
    status: 'offline prepared only; no database writes; refresh/CAS/release approval still required',
    scope: 'five validation games only, not the complete historical repair population', games: prepared,
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, officialSources ? 'LIVE-REPLAY-OFFICIAL-SOURCES.json' : 'LIVE-REPLAY-RESULTS.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ allChecksPassed: result.allChecksPassed, games: result.games.map(game => ({ gameId: game.gameId, ...game.counts, goalies: game.goalies })) }, null, 2));
  // Original-snapshot mode is diagnostic: retain known provider discrepancies.
  if (!result.calculationChecksPassed || (officialSources && !result.allChecksPassed)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
