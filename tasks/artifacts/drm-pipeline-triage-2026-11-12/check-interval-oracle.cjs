// Offline independent oracle: enumerated occupied seconds, not interval algebra.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const harness = fs.readFileSync(path.join(__dirname, 'replay-shift-calculations.cjs'), 'utf8');
const prefix = harness.slice(0, harness.indexOf('const { upsertShiftChartData }'));
const { load, root, capture } = new Function('require', '__dirname', prefix + '\nreturn {load,root,capture:()=>captured};')(require, __dirname);
const { buildCanonicalShiftIntervals } = load(root + '/lib/projections/ingest/shifts.ts');
const { upsertShiftChartData } = load(root + '/pages/api/v1/db/shift-charts.ts');
const { buildRelationshipRosterPositionMap } = load(root + '/lib/projections/relationshipPlayerPosition.ts');
const game = JSON.parse(fs.readFileSync(path.join(__dirname, 'live-replay.json'), 'utf8')).games[0];
const pbp = game.pbp;
const roster = buildRelationshipRosterPositionMap({
  gameId: game.game_id, expectedPbpRawPayloadHash: game.pbp_hash,
  rows: pbp.rosterSpots.map(s => ({ game_id: game.game_id, player_id: s.playerId, team_id: s.teamId, position_code: s.positionCode, source_play_by_play_hash: game.pbp_hash })),
});
const players = [...new Map(game.shift_payload.data.filter(s => s.typeCode === 517 && s.teamId === pbp.homeTeam.id).map(s => [s.playerId, s])).values()].slice(0, 2);
players.push(game.shift_payload.data.find(s => s.typeCode === 517 && s.teamId === pbp.awayTeam.id));
const clock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const seconds = clock => clock.split(':').map(Number).reduce((m, s) => m * 60 + s);
let seed = 4177;
const random = n => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) % n; };
const runs = 250;
(async () => {
  for (let run = 0; run < runs; run++) {
    const occupied = new Map(players.map(p => [p.playerId, new Set()]));
    const input = players.flatMap(p => Array.from({ length: 20 }, (_, i) => {
      const start = random(1100), end = start + 1 + random(Math.min(100, 1200 - start));
      for (let s = start; s < end; s++) occupied.get(p.playerId).add(s);
      return { ...p, period: 1, shiftNumber: i, startTime: clock(start), endTime: clock(end), duration: clock(end - start) };
    }));
    // Different source numbers do not turn a duplicated physical interval into extra time.
    input.push({ ...input[0], shiftNumber: 101 }, { ...input[20], shiftNumber: 102 });
    if (run % 2) input.reverse();
    const before = JSON.stringify(input);
    const union = buildCanonicalShiftIntervals(game.game_id, pbp, input);
    assert.equal(JSON.stringify(input), before);
    for (const p of players) {
      const actual = new Set();
      for (const row of union.filter(r => r.playerId === p.playerId)) {
        assert.equal(seconds(row.duration), seconds(row.endTime) - seconds(row.startTime));
        for (let s = seconds(row.startTime); s < seconds(row.endTime); s++) {
          assert.equal(actual.has(s), false, 'canonical intervals overlap'); actual.add(s);
        }
      }
      assert.deepEqual(actual, occupied.get(p.playerId));
    }
    await upsertShiftChartData({ data: input, sourceShiftHash: 'offline-oracle', shiftSource: 'json-api' }, {
      game_id: game.game_id, gameType: pbp.gameType, season_id: Number(pbp.season), gameDate: pbp.gameDate,
      homeTeam: pbp.homeTeam, awayTeam: pbp.awayTeam,
    }, [], roster, game.pbp_hash, pbp);
    const a = players[0].playerId, b = players[1].playerId;
    const shared = [...occupied.get(a)].filter(s => occupied.get(b).has(s)).length;
    for (const row of capture().rows) {
      assert.equal(seconds(row.game_toi), occupied.get(row.player_id).size);
      if (row.team_id !== pbp.homeTeam.id) continue;
      const other = row.player_id === a ? b : a;
      assert.equal(seconds({ ...row.time_spent_with, ...row.time_spent_with_mixed }[other]), shared);
      assert.equal({ ...row.percent_toi_with, ...row.percent_toi_with_mixed }[other], (100 * shared / seconds(row.game_length)).toFixed(2));
    }
  }
  const result = { passed: true, seed: 4177, cases: runs, generatedPlayerIntervals: runs * 62, checkedPlayerTotals: runs * 3, checkedDirectedPairs: runs * 2, oracle: 'Independent sets of occupied integer seconds; actual canonicalizer and route/payload arithmetic', excludes: 'Strength category correctness, source completeness, live persistence and qualification' };
  fs.writeFileSync(path.join(__dirname, 'INTERVAL-ORACLE.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; });
