// Immutable-source pure AST probe. No application imports, clients or requests.
const cp=require('child_process'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const receipts=[];
function source(path){const s=cp.execFileSync('git',['show','89da739cb:'+path],{encoding:'utf8'});receipts.push({path,sha256:crypto.createHash('sha256').update(s).digest('hex')});return ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true)}
function named(sf,name){const n=sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert(n,name);return n.getText(sf).replace(/^export /,'')}
function moduleBody(sf){return sf.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(sf).replace(/^export /,'')).join('\n')}
function run(s){const ctx=vm.createContext({});vm.runInContext(ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText,ctx,{timeout:1000});return ctx}
const contract=source('web/lib/fantasy-projections/contracts.ts');const nullable=named(contract,'nullableProjectionNumber');
const proper=source('web/lib/fantasy-projections/properScore.ts'),settlement=source('web/lib/fantasy-projections/settlement.ts');
const s=run(nullable+'\n'+moduleBody(proper)+'\n'+moduleBody(settlement)+'\nglobalThis.evaluate=evaluateSeasonOutput;');
const args={output:{fhfh_player_id:1,unconditional_means:{GOALS:1},baseline_unconditional_means:{GOALS:1},quantiles:{p10:{GOALS:0},p90:{GOALS:2}}},outcomePrimitiveValues:{GOALS:11},releasePlayer:{adjustment_delta:{GOALS:10}},manifest:{games:1,totals:{GOALS:1}},targets:['GOALS']};
const edited=s.evaluate(args);assert.equal(edited.publishedLosses.GOALS.metrics.forecast,11);assert.equal(edited.publishedLosses.GOALS.metrics.squaredError,0);assert.equal(edited.publishedLosses.GOALS.metrics.interval80Available,true);assert.equal(edited.publishedLosses.GOALS.metrics.interval80Covered,false);assert.equal(edited.publishedLosses.GOALS.metrics.intervalWidth,2);
const unknown=s.evaluate({...args,outcomePrimitiveValues:{GOALS:null}});assert.equal(Object.keys(unknown.publishedLosses).length,0);assert.equal(unknown.unscoredTargets.GOALS,'outcome_unknown');
const unchanged=s.evaluate({...args,releasePlayer:{adjustment_delta:{GOALS:0}},outcomePrimitiveValues:{GOALS:1}});assert.equal(unchanged.publishedLosses.GOALS.metrics.interval80Covered,true);
const q=source('web/lib/fantasy-projections/queries.ts');const qcode=['record','summaryNumber','nullableSummaryNumber','mapPlayerSummary'].map(n=>named(q,n)).join('\n');
const ctx=run(nullable+'\n'+qcode+'\nglobalThis.summary=mapPlayerSummary;');
const row={fhfh_player_id:1,team_id:null,population:'forward',player_name:'Unknown metadata',position:'C',ratings:{},deployment:{},roster_confidence:.8,pool_status:'verified_active',roster_status:'active_nhl',published_values:{GOALS:null}};
const missing=ctx.summary(row,new Map(),['GOALS']);assert.equal(missing[11],0);assert.equal(missing[12],0);assert.equal(missing[16][0],null);
const knownZero=ctx.summary({...row,ratings:{offense:0},deployment:{confidence:0}},new Map(),['GOALS']);assert.equal(knownZero[11],0);assert.equal(knownZero[12],0);
console.log(JSON.stringify({target:'89da739cb45d7d572ed59bfa0b209c79c5d99299',receipts,edited,unknown,unchanged,missingRating:missing[11],missingDeploymentConfidence:missing[12],knownZeroRating:knownZero[11],knownZeroDeploymentConfidence:knownZero[12],unknownGoalPreserved:missing[16][0],checks:'all assertions passed; no app imports/network/runtime clients'},null,2));
