const fs=require('fs'),cp=require('child_process'),vm=require('vm'),assert=require('assert/strict'),ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const pin='89da739cb';
function source(path){return cp.execFileSync('git',['show',pin+':'+path],{encoding:'utf8'});}
function load(path,deps){const module={exports:{}};vm.runInNewContext(ts.transpileModule(source(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:k=>{if(!(k in deps))throw Error('Unexpected import '+k);return deps[k]},URLSearchParams},{filename:path});return module.exports;}
const defs=load('web/lib/rankings/metricDefinitions.ts',{}),registry=load('web/lib/rankings/matrixMetricRegistry.ts',{'./metricDefinitions':defs});
const url=load('web/lib/rankings/rankingUrlState.ts',{'./metricDefinitions':defs,'./matrixMetricRegistry':registry});
const types=load('web/lib/rankings/rankingTypes.ts',{'./metricDefinitions':defs,'./teamTokenResolver':{resolveTeamToken(){throw Error('No team resolution requested');}}});
const qSource=source('web/lib/rankings/rankingQueries.ts'),sf=ts.createSourceFile('queries.ts',qSource,ts.ScriptTarget.Latest,true);
const resolver=sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='resolveRollingSnapshotDates').getText(sf);
const dates=Array.from({length:31},(_,i)=>new Date(Date.UTC(2026,10,14-i)).toISOString().slice(0,10));
const calls=[];const fake={from(table){const q={select(){return q},eq(){return q},lte(){return q},order(){return q},limit(n){calls.push({table,limit:n});return Promise.resolve({data:table==='games'?dates.slice(0,n).map(date=>({date})):[{game_date:dates[0]}],error:null})}};return q}};
const ctx={supabase:fake,MAX_SNAPSHOT_DATES_TO_EVALUATE:30,Date};vm.runInNewContext(ts.transpileModule(resolver,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';globalThis.run=resolveRollingSnapshotDates;',ctx);
(async()=>{
 const selected=await ctx.run({season:20262027,strength:'5v5',asOfDate:'2026-11-14'});
 assert.equal(selected.length,30);assert(!selected.includes(dates[30]));
 const filters=url.normalizeRankingsFilters({season:'20262027',tab:'splits',window:'last20',window_scope:'cross_season',min_gp:'0',min_toi:'0'});
 const get=p=>new URL(p,'https://synthetic.invalid').searchParams;
 const splitsScope=get(url.buildSplitsRequestPath(filters)).get('window_scope');
 const deploymentScope=get(url.buildDeploymentTiersRequestPath({...filters,tab:'deployment_tiers'})).get('window_scope');
 assert.equal(splitsScope,null);assert.equal(deploymentScope,null);
 assert(url.buildRankingsContextSummary(filters).includes('games across seasons'));
 assert.equal(get(url.buildMatrixRequestPath(filters)).get('window_scope'),'cross_season');
 assert.equal(get(url.buildRankingsRequestPath(filters)).get('window_scope'),'cross_season');
 const parsed=types.parseContextualRankingsRequest({season:'20262027',min_gp:'0',min_toi:'0',as_of_date:'2026-02-30',entity_ids:'1,1,2'});
 assert.equal(parsed.minGp,0);assert.equal(parsed.minToiSeconds,0);assert.equal(parsed.entityIds.length,2);
 const output={pin,status:'passed',recentDateHorizon:{sourceDates:31,selectedDates:selected.length,oldestSourceDate:dates[30],oldestExcluded:!selected.includes(dates[30]),calls},crossSeason:{summary:url.buildRankingsContextSummary(filters),splitsScope,deploymentScope,matrixScope:get(url.buildMatrixRequestPath(filters)).get('window_scope')},controls:{apiZeroMinimumsPreserved:true,idsDeduplicated:true,impossibleCalendarDateAccepted:parsed.asOfDate},limits:'Exact frozen URL/types/definition/registry modules and extracted query date resolver. Synthetic date transport only; no full ranking query, aggregation, application imports, environment, database, provider, browser, server, build or Vitest. Invalid date acceptance recorded as input boundary, not a hosted failure.'};
 fs.writeFileSync('tasks/artifacts/calculation-inventory-2026-11-10/master/astra-full-audit-20261114/ranklib5-probe-output.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
})().catch(e=>{console.error(e);process.exitCode=1});
