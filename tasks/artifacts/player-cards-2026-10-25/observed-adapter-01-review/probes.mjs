import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
const own = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(own, '../../../..');
const require = createRequire(path.join(repo, 'web/package.json'));
const { buildSync } = require('esbuild');
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw Error('Offline only'); };
const code = buildSync({ stdin: { contents: 'export {mapNstCapture} from "./web/lib/player-cards/nstCapture"; export {adaptLocalSnapshot} from "./web/lib/player-cards/adapter"; export {METRICS} from "./web/lib/player-cards/registry";', resolveDir: repo }, bundle:true, platform:'node', format:'esm', write:false }).outputFiles[0].text;
const { mapNstCapture, adaptLocalSnapshot, METRICS } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
// Entirely synthetic contract probes: these declarations prove no actual NHL coverage.
function fixture() {
 const settings = {season:20262027, gameType:'regular', strength:'pp', cutoff:'2026-10-24T00:00:00Z', period:{mode:'appearances',count:5}, seasonPolicy:'season-only-proposed', shortSamplePolicy:'allow-known-short-proposed', rankPolicy:'competition-midrank-proposed'};
 const frames = [11,22,33].map((playerId,i)=>({playerId,season:20262027,gameType:'regular',dateBasis:'UTC',completeHistory:true,historyThrough:settings.cutoff,historyReference:'TEST history',appearances:(i===0?[20,21]:[21]).map(day=>({playerId,gameId:day,season:20262027,gameType:'regular',date:`2026-10-${day}`,played:true,completion:{status:'verified-final',completedAt:`2026-10-${day}T23:00:00Z`,reference:'TEST final'}}))}));
 const base={toiUnit:'seconds',capturedAt:'2026-10-24T00:00:00Z',reference:'TEST receipt',readStatus:'ok',identity:{mode:'row-player-id'}};
 const rows=frames.flatMap(f=>f.appearances.map(g=>({player_id:f.playerId,season:g.season,date_scraped:g.date,gp:f.playerId===22?0:1,toi:f.playerId===22?0:f.playerId===33?60:120})));
 return {id:'independent-synthetic-probes',capturedAt:'2026-10-24T01:00:00Z',settings,source:{definition:'TEST same definition',version:'test',definitionReference:'TEST definition',verifiedMetrics:METRICS.map(m=>m.id)},population:{scope:'all-nhl',complete:true,reference:'TEST only; no actual NHL proof',expectedPlayerIds:[11,22,33]},frames,individual:{...base,table:'nst_gamelog_pp_counts',rows:rows.map(r=>({...r,shots:r.gp,goals:0,total_points:0,icf:2*r.gp,iscfs:r.gp,ixg:.1*r.gp}))},onIce:{...base,table:'nst_gamelog_pp_counts_oi',rows:rows.map(r=>({...r,cf:4*r.gp,scf:2*r.gp,xgf:.3*r.gp,xga:.1*r.gp,gf:0,sf:2*r.gp}))}};
}
function card(c,id=11){const m=mapNstCapture(c);assert.equal(m.state,'mapped');const a=adaptLocalSnapshot(m.input,id);assert.notEqual(a.state,'rejected');assert.equal(a.liveActivation,false);assert.equal(a.premiumActivation,false);return a;}
const reading=(a,id)=>a.readings.find(r=>r.id===id);
const results=[];
function probe(name,fn){try{fn();results.push({name,status:'passed'});}catch(e){results.push({name,status:'failed',message:e.message});}}
probe('Distinct player windows, known-short and zero PP exposure stay in applicable metric pools',()=>{
 const c=fixture(),a=card(c),z=card(c,22);assert.equal(a.selection.actualGp,2);assert.equal(a.selection.knownShort,true);
 assert.equal(reading(a,'sog60').value,30);assert.deepEqual(reading(a,'sog60').rank,{ordinal:2,population:2,percentile:25,tied:false});
 assert.equal(reading(z,'atoi').value,0);assert.equal(reading(z,'atoi').rank.population,3);assert.equal(reading(z,'sog60').state,'undefined');
 assert.equal(a.coverage.sog60.knownUndefined,1);assert.equal(a.coverage.sog60.knownShort,3);
});
probe('Missing peer component blocks only dependent ranks; never becomes zero or shrinks pool silently',()=>{
 const c=fixture();c.individual.rows.find(r=>r.player_id===33).shots=null;const a=card(c);
 assert.equal(reading(a,'sog60').value,30);assert.equal(reading(a,'sog60').rank,null);assert.equal(a.coverage.sog60.missingIncomplete,1);assert.equal(reading(a,'xgf60').rank.population,2);
});
probe('Wrong player/season/date cannot backfill missing exact identity; duplicates are not pooled',()=>{
 for(const patch of [{player_id:99},{season:20252026},{date_scraped:'2026-10-19'}]){const c=fixture();Object.assign(c.individual.rows[0],patch);assert.equal(reading(card(c),'sog60').state,'missing');}
 const c=fixture();c.individual.rows.push({...c.individual.rows[0]});assert.equal(reading(card(c),'sog60').state,'missing');assert.equal(reading(card(c),'xgf60').state,'valid');
});
probe('Mixed batch capture times cannot hide pre-final on-ice data behind fresh individual data',()=>{
 const c=fixture();c.onIce.capturedAt='2026-10-21T22:59:59Z';const a=card(c);assert.equal(reading(a,'sog60').state,'valid');assert.equal(reading(a,'xgf60').state,'missing');assert.equal(reading(a,'ipp').state,'missing');
});
probe('UTC/history/participation/finality/model evidence gates cannot produce qualified selected values',()=>{
 const changes=[c=>c.frames[0].dateBasis='local',c=>c.frames[0].historyThrough='2026-10-23T00:00:00Z',c=>c.frames[0].appearances[0].played=null,c=>c.frames[0].appearances[0].completion.reference='',c=>c.source.definitionReference=''];
 for(const change of changes){const c=fixture();change(c);assert.ok(card(c).readings.every(r=>r.state==='missing'&&r.rank===null));}
});
probe('Same-date distinct official games fail closed and incomplete declared population cannot rank',()=>{
 const c=fixture();c.frames[0].appearances.push({...c.frames[0].appearances[0],gameId:999});assert.equal(reading(card(c),'sog60').state,'missing');
 const d=fixture();d.population.expectedPlayerIds.push(44);assert.ok(card(d).readings.every(r=>r.rank===null));
});
assert.equal(networkAttempts,0);
writeFileSync(path.join(own,'probe-results.json'),JSON.stringify({node:process.version,networkAttempts,syntheticOnly:true,results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.status==='failed'))process.exitCode=1;
