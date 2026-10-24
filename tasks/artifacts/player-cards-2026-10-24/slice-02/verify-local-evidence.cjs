const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const web = path.resolve(__dirname, '../../../../web');
const fromWeb = createRequire(path.join(web, 'package.json'));
fromWeb('ts-node').register({ project: path.join(web, 'tsconfig.json'), transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } });
const { pooledMetric } = require(path.join(web, 'lib/player-cards/aggregation.ts'));
const { selectWindow } = require(path.join(web, 'lib/player-cards/windows.ts'));
const { METRICS } = require(path.join(web, 'lib/player-cards/registry.ts'));
const sourcePath = path.resolve(web, '../tasks/artifacts/wigo-player-card-investigation-2026-10-24/production-diagnostic/query-2-rows.json');
const bytes = fs.readFileSync(sourcePath);
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '52ea73b19894b2d379e77230f7a7d14089548774b6f5c1411299a4f55cc7d201');
const rows = JSON.parse(bytes);
const nhl = rows.filter(row => row.source === 'nhl_log' && row.payload.season_id === 20262027).map(row => row.payload).sort((a,b) => b.date.localeCompare(a.date));
const counts = nhl.slice(0,5).map(game => ({ toiUnit: 'seconds', individual: rows.find(row => row.source === 'nst_individual_log' && row.payload.date_scraped === game.date && row.payload.season === game.season_id).payload, onIce: rows.find(row => row.source === 'nst_on_ice_log' && row.payload.date_scraped === game.date && row.payload.season === game.season_id).payload }));
const values = Object.fromEntries(['atoi','sog60','ixg60','icf60'].map(id => [id,pooledMetric(METRICS.find(metric => metric.id === id),counts,5)]));
for (const [id,expected] of Object.entries({ atoi:1262.6/60,sog60:11.975289086012989,ixg60:1.0378583874544591,icf60:19.958815143354983 })) {
  assert.equal(values[id].state,'valid'); assert.ok(Math.abs(values[id].value-expected)<1e-9);
}
const settings = { season:20262027,gameType:'regular',strength:'all',cutoff:'2026-10-24T00:00:00Z',period:{mode:'appearances',count:5},seasonPolicy:'season-only-proposed',shortSamplePolicy:'allow-known-short-proposed',rankPolicy:'competition-midrank-proposed' };
const frame = { playerId:8476453,season:20262027,gameType:'regular',dateBasis:'UTC',completeHistory:false,historyThrough:settings.cutoff,historyReference:'bounded diagnostic; game type/date basis/history not verified',appearances:nhl.map(row => ({playerId:8476453,gameId:row.game_id,season:row.season_id,gameType:'regular',date:row.date,played:row.games_played===1,completion:{status:'unverified'}})) };
const historyGate = selectWindow(frame,settings);
assert.equal(historyGate.state,'missing');
// Negative test only: changing one claim still cannot manufacture final-game proof.
const completionGate = selectWindow({...frame,completeHistory:true},settings);
assert.equal(completionGate.state,'missing'); assert.match(completionGate.reason,/Completed-game evidence/);
const result = { source:sourcePath,sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),values,historyGate:historyGate.reason,completionGate:completionGate.reason,claim:'Prior approved one-player arithmetic only; no completion/history/source-definition/league coverage verified; no live readiness or rank',externalRequests:0 };
fs.writeFileSync(path.join(__dirname,'local-evidence-results.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:'4 pooled values and2 unavailable gates',externalRequests:0}));
