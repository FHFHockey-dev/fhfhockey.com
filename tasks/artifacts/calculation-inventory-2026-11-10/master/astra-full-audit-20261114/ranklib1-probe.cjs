const fs=require('fs'),cp=require('child_process'),vm=require('vm'),assert=require('assert/strict'),ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const pin='89da739cb';
function load(path,deps){const source=cp.execFileSync('git',['show',pin+':'+path],{encoding:'utf8'}),module={exports:{}};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:k=>{if(!(k in deps))throw Error('Unexpected import '+k);return deps[k]},console:{warn(){}}},{filename:path});return module.exports;}
(async()=>{
const stats=load('web/lib/projectionsConfig/statsMasterList.ts',{'./formatToMMSS':{formatToMMSS(){throw Error('formatter not called')}}});
assert.equal(stats.getCategoryRegistryEntry('GOALS_AGAINST_AVERAGE').ratio.scale,3600);
assert.equal(stats.getCategoryRegistryEntry('SAVE_PERCENTAGE').ratio.scale,1);
assert.equal(stats.resolveStatDirection('GOALS_AGAINST_AVERAGE',{weight:-2}),'higher');
assert.equal(stats.resolveStatDirection('GOALS_AGAINST_AVERAGE',{weight:-2,overrides:{GOALS_AGAINST_AVERAGE:'lower'}}),'lower');
assert.equal(stats.getCategoryRegistryEntry('TOI_PER_GAME').key,'TIME_ON_ICE_PER_GAME');
const promotion=load('web/lib/rankings/adjustedImpactPromotionContract.ts',{});
assert.equal(promotion.evaluateAdjustedImpactPromotionReadiness(promotion.ADJUSTED_IMPACT_PROMOTION_CONTROLS).status,'blocked_missing_controls');
const emptyPromotion=promotion.evaluateAdjustedImpactPromotionReadiness([],{emptyNetTreatment:{validation:'validated'}});assert.equal(emptyPromotion.status,'rankings_promotable');
const writer=load('web/lib/rankings/entityMetricRankingWriter.ts',{'./metricDefinitions':{},'./matrixMetricRegistry':{},'./rankingQueries':{}});
const base={entity_type:'skater',season_id:20262027,snapshot_date:'2026-11-13',window_type:'season',window_size:0,strength_state:'5v5',metric_key:'points_per_60',peer_group_type:'all_skaters',peer_group_key:'all'};
const stored=new Map([[1,{...base,entity_id:1,raw_value:1}],[2,{...base,entity_id:2,raw_value:2}]]),calls=[];
const fake={from(table){assert.equal(table,'entity_metric_rankings');return {async upsert(rows,options){calls.push({ids:rows.map(r=>r.entity_id),onConflict:options.onConflict});if(rows.some(r=>r.entity_id===2))return {error:{message:'synthetic row-2 write failure'}};rows.forEach(r=>stored.set(r.entity_id,r));return {error:null}}}}};
let error=null;try{await writer.upsertEntityMetricRankingRows(fake,[{...base,entity_id:1,raw_value:10},{...base,entity_id:2,raw_value:20}],{chunkSize:1})}catch(e){error=e.message}
assert.match(error,/synthetic row-2 write failure/);assert.equal(stored.get(1).raw_value,10);assert.equal(stored.get(2).raw_value,2);
const result={pin,checks:'passed',categoryUnitsAndDirections:'passed',promotion:{activeStaticControls:promotion.evaluateAdjustedImpactPromotionReadiness(promotion.ADJUSTED_IMPACT_PROMOTION_CONTROLS),emptyVerifiedSet:emptyPromotion,status:'latent metadata-only gap; no new active-promotion finding'},partialPublication:{before:[1,2],intended:[10,20],afterFailedUpsert:Array.from(stored.values()).map(x=>x.raw_value),error,calls,readerEvidence:'source-only: latest date query and row fetch carry no publication completion predicate; ranking recomputes raw_value cohort'},limits:'Exact pure modules with fake transport and explicit unused-import stubs. No real database/provider/app imports, route, Vitest or production incidence.'};
fs.writeFileSync('tasks/artifacts/calculation-inventory-2026-11-10/master/astra-full-audit-20261114/ranklib1-probe-output.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1});
