const cp=require('child_process'),vm=require('vm'),crypto=require('crypto'),assert=require('assert'),ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const pin='89da739cb45d7d572ed59bfa0b209c79c5d99299',hashes={};
function src(p){const s=cp.execFileSync('git',['show',pin+':'+p]).toString();hashes[p]=crypto.createHash('sha256').update(s).digest('hex');return ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true);}
function load(p,globals={},names=null,extra=''){const sf=src(p),nodes=sf.statements.filter(n=>!ts.isImportDeclaration(n)&&(!names||names.includes(n.name?.text)));const m={exports:{}};vm.runInNewContext(ts.transpileModule(nodes.map(n=>n.getText(sf)).join('\n')+'\n'+extra,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,...globals},{timeout:1000});return m.exports;}
const root='web/lib/projections/';
const num=load(root+'utils/number-utils.ts');
let sample=[{shots_against:30,goals_allowed:null,saves:null}],calls=[];
const db={from(table){const q={then(resolve){return Promise.resolve({data:table==='wgo_goalie_stats'?null:sample,error:null}).then(resolve)},maybeSingle(){return Promise.resolve({data:null,error:null})}};for(const k of ['select','eq','lt','gte','order','limit'])q[k]=(...a)=>{calls.push([table,k,a]);return q};return q;}};
const query=load(root+'queries/goalie-queries.ts',{supabase:db,...num},['assertSupabase','fetchGoalieEvidence']);
const posterior=load(root+'goalie/goalieOutcomes.ts');
const model=load(root+'goalieModel.ts',{posteriorSavePct:posterior.posteriorSavePct},['clamp','computeModeledSavePct']);
const market=load(root+'queries/market-queries.ts');
(async()=>{
 const unknown=await query.fetchGoalieEvidence(1,'2026-11-14',.9),unknownSave=model.computeModeledSavePct({evidence:unknown,leagueSavePct:.9});
 assert.equal(unknown.baselineShotsAgainst,30);assert.equal(unknown.baselineGoalsAllowed,0);assert.equal(unknown.baselineStarts,1);assert(unknownSave>.9);assert(Math.abs(unknownSave-(30+6000*.9)/6030)<1e-15);
 sample=[{shots_against:30,goals_allowed:3,saves:27}];const known=await query.fetchGoalieEvidence(1,'2026-11-14',.9);assert.equal(model.computeModeledSavePct({evidence:known,leagueSavePct:.9}),.9);
 const base={snapshot_date:'2026-11-14',game_id:1,sportsbook_key:'book',outcome_key:'over',line_value:6.5,price_american:-110,implied_probability:.5238,source_observed_at:'2026-11-14T12:00:00Z',freshness_expires_at:'2026-11-14T13:00:00Z',provenance:{},metadata:{}};
 const rows=[{...base,market_type:'totals',source_rank:1},{...base,market_type:'h2h',outcome_key:'team:AAA',line_value:null,source_rank:2},{...base,market_type:'h2h',outcome_key:'team:BBB',line_value:null,source_rank:2}];
 const combined=market.summarizeGameMarketRows(rows,'2026-11-14T12:30:00Z'),moneyline=market.summarizeGameMarketRows(rows.slice(1),'2026-11-14T12:30:00Z');
 assert.deepEqual(Object.keys(combined),['totals']);assert(moneyline.h2h);assert.equal(moneyline.h2h.quotes.length,2);
 console.log(JSON.stringify({pin,hashes,checks:{unknownGoalieRow:unknown,posteriorWithUnknownGoals:unknownSave,pairedRowsOnlyOracle:.9,knownControl:.9,combinedMarketTypes:Object.keys(combined),fallbackAlone:Object.keys(moneyline)},fakeQueryCalls:calls.length,boundaries:['Exact pinned reader/model/summarizer with fake client','Nullable source schema and active stage callers inspected; production incidence not checked','No application imports, actual query/provider/page, Vitest, server/build, write or release']},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
