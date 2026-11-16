const cp=require('child_process'),vm=require('vm'),crypto=require('crypto'),assert=require('assert'),ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const pin='89da739cb45d7d572ed59bfa0b209c79c5d99299',hashes={};
function source(p){const s=cp.execFileSync('git',['show',pin+':'+p]).toString();hashes[p]=crypto.createHash('sha256').update(s).digest('hex');const sf=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true);assert.equal(sf.parseDiagnostics.length,0);return sf;}
function run(code,globals={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,structuredClone,...globals},{timeout:1000});return m.exports;}
function moduleAt(p,globals={}){const sf=source(p);return run(sf.statements.filter(n=>!ts.isImportDeclaration(n)&&!ts.isExportDeclaration(n)).map(n=>n.getText(sf)).join('\n'),globals);}
function nodes(sf,names){let found=new Map();function visit(n){if(n.name&&names.includes(n.name.getText(sf))&&(ts.isFunctionDeclaration(n)||ts.isVariableDeclaration(n)))found.set(n.name.getText(sf),n);ts.forEachChild(n,visit);}visit(sf);for(const name of names)assert(found.has(name),'Missing '+name);return found;}
function declarations(sf,names){return [...nodes(sf,names).values()].map(n=>ts.isVariableDeclaration(n)?'const '+n.getText(sf)+';':n.getText(sf)).join('\n');}
const stats=moduleAt('web/lib/projectionsConfig/statsMasterList.ts',{formatToMMSS:()=>{throw Error('formatter outside probe')}});
const draft=moduleAt('web/lib/integrations/yahoo/liveDraft.ts',{resolveStatDirection:stats.resolveStatDirection,createHash:crypto.createHash});
const roster=source('web/lib/integrations/yahoo/rosterPlanning.ts');
const helpers=run(declarations(roster,['numeric','datedTeamAbbreviation','yahooCreditedGoalieAppearances','yahooPlanningCategories']),{activeTeamAbbreviations:new Set(['TOR','NJD'])});
const rulesNode=nodes(roster,['rules']).get('rules');assert(ts.isObjectLiteralExpression(rulesNode.initializer));
const scoringNode=rulesNode.initializer.properties.find(n=>n.name?.getText(roster)==='scoring');assert(scoringNode);
const planning=source('web/lib/rosterScheduleOptimizer/planning.ts');
const relation=run(declarations(planning,['finite','categoryRelation'])+'\nexport {categoryRelation};');
const categoriesPayload={scoring_type:'head',stat_categories:{stats:[{stat:{stat_id:'1',abbr:'G',sort_order:'0'}},{stat:{stat_id:'17',abbr:'FL',sort_order:'0'}}]}};
const parsed=draft.parseYahooBoardSettings(categoriesPayload);
const scoring=run('export const value = '+scoringNode.initializer.getText(roster)+';',{settings:parsed,yahooPlanningCategories:helpers.yahooPlanningCategories}).value;
assert.equal(parsed.categoryWeights.GOALS,-1);assert.equal(parsed.categoryWeights.FACEOFFS_LOST,1);
assert.deepEqual(JSON.parse(JSON.stringify(scoring.categories)),[{key:'GOALS',direction:'higher'},{key:'FACEOFFS_LOST',direction:'higher'}]);
assert.equal(relation.categoryRelation([5,5],[3,3],scoring.categories),'better');
assert.equal(relation.categoryRelation([5,5],[3,3],scoring.categories.map(x=>({...x,direction:'lower'}))),'worse');
const supplement=moduleAt('web/lib/rosterScheduleOptimizer/providerRules.ts');
const metNode=nodes(planning,['minimumAlreadyMet']).get('minimumAlreadyMet');
function met(minimum){return run('export const value='+metNode.initializer.getText(planning)+';',{minimum,finite:x=>x!==null&&x!==undefined&&Number.isFinite(x)}).value;}
const player={id:'g',nhlId:1,playerClass:'goalie',teamAbbreviation:'TOR'};
const args={periodStart:'2026-10-01',today:'2026-10-02',pastLineups:[{date:'2026-10-01',source:'yahoo',entries:[{playerId:'g',position:'G',slotId:'G#1',teamAbbreviation:'TOR'}]}],slots:[{id:'G#1',type:'G'}],players:[player],games:[]};
function db(rows){return {from:()=>({select:()=>({in:async()=>({data:rows,error:null})})})};}
(async()=>{
const missingSchedule=await helpers.yahooCreditedGoalieAppearances({from:()=>{throw Error('unexpected read')}},args);assert.equal(missingSchedule,0);
const game={id:'101',date:'2026-10-01',status:'final',teamAbbreviation:'TOR'};
const relief=await helpers.yahooCreditedGoalieAppearances(db([{goalie_id:1,game_id:101,games_played:1,games_started:0}]),{...args,games:[game]});assert.equal(relief,1);
const knownMissing=await helpers.yahooCreditedGoalieAppearances(db([]),{...args,games:[game]});assert.equal(knownMissing,null);
const minimum={required:1,credited:relief,counts:'unknown',penalty:'unknown',periodStart:'2026-10-01',periodEnd:'2026-10-08'};
assert.equal(met(minimum),true);
const snapshot={id:'synthetic',context:{startDate:'2026-10-01',endDate:'2026-10-07',timeZone:'UTC',asOf:'2026-10-02T12:00:00Z',seasonId:20262027},rules:{lineupMode:'daily',acquisitionTiming:'unknown',acquisitionCost:null,periods:[],scoring:{mode:'categories',weights:{},categories:scoring.categories},rosterSlots:{G:1},goalieMinimum:minimum,unsupported:[]},lockedAssignments:[],players:[player],evidence:{}};
const changed=supplement.supplementProviderRules(snapshot,{goalieMinimum:{counts:'starts',credited:0}});
assert.equal(changed.snapshot.rules.goalieMinimum.counts,'starts');assert.equal(changed.snapshot.rules.goalieMinimum.credited,1);assert(changed.conflicts.some(s=>s.includes('Goalie credited')));assert.equal(met(changed.snapshot.rules.goalieMinimum),true);
console.log(JSON.stringify({pin,hashes,checks:{direction:{parsedWeights:parsed.categoryWeights,scoring,actualRelation:'better',expectedRelation:'worse'},missingSchedule:{actualCredited:missingSchedule,knownGameMissingRow:knownMissing},relief:{appearanceCount:relief,officialStartsFixture:0,unknownBasisMarkedMet:met(minimum),managerStarts:changed.snapshot.rules.goalieMinimum,conflicts:changed.conflicts}},boundaries:['Exact pinned pure modules/declarations/initializer expressions, imports removed; no application import','Fake in-memory database rows; TOR/NJD valid-team set fixture; no real credentials/client/provider/HTTP','Comparison and minimumSatisfied predicate executed, not full solver or UI','No runtime Vitest, browser/server/build/write/release; hosted incidence and provider rule semantics unverified']},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
