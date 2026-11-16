const cp=require('child_process'),vm=require('vm'),crypto=require('crypto'),assert=require('assert'),ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const pin='89da739cb45d7d572ed59bfa0b209c79c5d99299',hashes={};
function source(p){const s=cp.execFileSync('git',['show',pin+':'+p]).toString();hashes[p]=crypto.createHash('sha256').update(s).digest('hex');const sf=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true);assert.equal(sf.parseDiagnostics.length,0);return sf;}
function run(code,globals={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,...globals},{timeout:1000});return m.exports;}
function load(p,globals={}){const sf=source(p);return run(sf.statements.filter(n=>!ts.isImportDeclaration(n)&&!ts.isExportDeclaration(n)).map(n=>n.getText(sf)).join('\n'),globals);}
function extract(sf,names){const found=[];function walk(n){if(n.name&&names.includes(n.name.getText(sf))&&(ts.isFunctionDeclaration(n)||ts.isVariableDeclaration(n)))found.push(ts.isVariableDeclaration(n)?'const '+n.getText(sf)+';':n.getText(sf));ts.forEachChild(n,walk);}walk(sf);assert.equal(found.length,names.length);return found.join('\n');}
const definition=source('web/lib/predictions/legacyQuarantine.ts');const legacy=run(extract(definition,['VOLATILITY_DISCOUNTED_PACE'])+'\nexport {VOLATILITY_DISCOUNTED_PACE};');
const control=load('web/lib/ml/predictionsSkoRunControl.ts',legacy);
const writer=source('web/pages/api/v1/ml/update-predictions-sko.ts');const parse=run(extract(writer,['parseNumber','parsePositiveInt'])+'\nexport {parsePositiveInt};');
const req=horizon=>({body:{horizon,asOfDate:'2026-11-14'},query:{}});
const fractional={input:1.5,key:control.predictionsSkoRunKey(req(1.5)),writeHorizon:parse.parsePositiveInt(1.5,5)};
const integer={input:1,key:control.predictionsSkoRunKey(req(1)),writeHorizon:parse.parsePositiveInt(1,5)};
assert.equal(fractional.writeHorizon,1);assert.equal(integer.writeHorizon,1);assert.notEqual(fractional.key,integer.key);
assert.equal(control.buildPredictionsSkoHealth({dryRun:false,write:{attemptedRows:10,upsertedRows:7}},200).status,'error');
assert.equal(control.buildPredictionsSkoHealth({dryRun:true,write:{attemptedRows:10,upsertedRows:0}},200).status,'ok');
assert.equal(control.buildPredictionsSkoHealth({skipReason:'source_lag_exceeds_72_hours'},200).status,'warning');
const grouping=load('web/lib/draftDashboard/forwardGrouping.ts'),feas=load('web/lib/mockDraft/feasibility.ts');
const engine=load('web/lib/mockDraft/engine.ts',{...grouping,...feas});
let session={status:'running',picks:[],players:Array.from({length:12},(_,i)=>({id:String(i+1),positions:['C'],value:12-i,adp:null,categories:{},workload:null})),queue:[],config:{teamCount:4,userSeat:0,roster:{C:1,bench:1},grouping:'split'},consent:false,withdrawn:false,contributor:null};
const start=session,counts=[];for(let i=0;i<8;i++){session=engine.commitPick(session,'1','bot');counts.push(session.picks.length);}assert.strictEqual(session,start);assert.deepEqual(counts,[0,0,0,0,0,0,0,0]);
const valid=engine.commitPick(session,'1','human');assert.equal(valid.picks.length,1);assert.equal(engine.seatAt(valid.picks.length+1,4),1);
assert.equal(engine.waitUntilNext(12,12),0);assert.equal(engine.waitUntilNext(13,12),22);
assert.equal(engine.allocate([{positions:['C','LW']},{positions:['C']}],['C','LW']).size,2);
const r1=engine.random('same'),r2=engine.random('same');for(let i=0;i<100;i++)assert.equal(r1(),r2());
const radar=load('web/lib/nst/radarSeasonStats.ts');assert.equal(radar.nstRadarStatValue('hdcf_per_60',{hdcf:72,toi_seconds_oi:18000}),14.4);assert.equal(radar.nstRadarStatValue('cf_pct',{cf:null,ca:40}),null);assert.equal(radar.nstRadarStatValue('goals_per_60',{goals_per_60:1,toi_seconds:3599}),null);
const cmp=radar.nstRadarComparison('cf_pct',{rowsByView:{nst_seasonlong_5v5_counts_oi:{rows:[{player_id:1,cf:60,ca:40},{player_id:2,cf:60,ca:40}],error:null}},allowedPlayerIds:null,positionError:null},1);assert.equal(cmp.playerValue,60);assert.deepEqual(Array.from(cmp.peerValues),[60]);
console.log(JSON.stringify({pin,hashes,checks:{leaseKeyNormalization:{fractional,integer},mockGroupingTest:{unchangedPickCounts:counts,validHumanControl:valid.picks.length},preserved:{partialWrite:'error',dryRun:'ok',sourceLag:'warning',snakeTurn:[0,22],dualEligibilityAssigned:2,seededDrawsIdentical:100,radarHdcfPer60:14.4,missingShare:null,belowMinRate:null,playerCountedOnce:cmp}},boundaries:['Exact pinned pure modules/declarations, imports removed; no app import','No production writes/lease RPC/handler execution or concurrency experiment; mismatch is source-proved','Test no-op reproduction and pure controls, not full mock draft test run','No database/provider/page/network/server/build/fix/release']},null,2));
