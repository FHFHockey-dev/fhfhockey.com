const fs=require('fs'),cp=require('child_process'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),ts=require('/Users/tim/Code/fhfhockey.com/web/node_modules/typescript');
const sources=[];
function mod(path,bindings={},exports=[],names=null){
  const source=cp.execFileSync('git',['show','89da739cb:'+path],{encoding:'utf8'});
  sources.push({path,sha256:crypto.createHash('sha256').update(source).digest('hex')});
  const sf=ts.createSourceFile(path,source,99,true);
  const body=sf.statements.filter(n=>!ts.isImportDeclaration(n)&&!ts.isExportAssignment(n)&&(!names||names.includes(n.name?.getText(sf))||ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.includes(d.name.getText(sf))))).map(n=>n.getText(sf)).join('\n')+'\nexport {'+exports.join(',')+'};';
  const m={exports:{}};
  vm.runInNewContext(ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,console:{log(){},warn(){},error(){}},process:{env:{}},require(k){throw Error('Denied import '+k)},...bindings},{filename:path,timeout:1000});
  return m.exports;
}
const response=()=>({statusCode:200,body:null,status(c){this.statusCode=c;return this},json(b){this.body=b;return this},setHeader(){}});
function finiteDb(tables){return {from(table){const q={select(){return q},eq(){return q},lte(){return q},order(){return q},in(){return q},range(){return q},then(ok,bad){return Promise.resolve({data:tables[table]??[],error:null}).then(ok,bad)}};return q}};}
(async()=>{
  const contracts=mod('web/lib/trends/ctpiVersions.ts',{
    RECENT_TEAM_FORM_APPROVED_PUBLICATION_STATUS:'approved',RECENT_TEAM_FORM_FORMULA_VERSION:'fixture-v1',RECENT_TEAM_FORM_INPUT_VERSION:'fixture-input-v1',
    RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION:'fixture-v2',RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION:'fixture-input-v2',RECENT_TEAM_FORM_V2_CANDIDATE_PUBLICATION_STATUS:'candidate',
  });
  const rows=['AAA','BBB'].map((team,i)=>({team,date:i?'2026-11-01':'2026-11-14',ctpi_raw:1,ctpi_0_to_100:65,offense:1,defense:1,goaltending:1,special_teams:1,luck:null,computed_at:'2026-11-14T12:00:00Z',publication_status:'approved',formula_version:'fixture-v1',input_version:'fixture-input-v1',source_game_count:5}));
  const ctpi=mod('web/pages/api/v1/trends/team-ctpi.ts',{
    ...contracts,dotenv:{config(){}},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'inert',SUPABASE_SERVICE_ROLE_KEY:'inert'}},createClient:()=>finiteDb({team_ctpi_daily:rows}),getLatestStartedSeasonForDate:async()=>({id:20262027}),ACTIVE_TEAM_ABBREVIATIONS:['AAA','BBB'],buildRequestedDateServingState:x=>x,
  });
  const r=response();await ctpi.default({method:'GET',query:{date:'2026-11-14',version:'1'}},r);
  assert.equal(r.statusCode,200);assert.equal(r.body.coverage.partial,false);assert.equal(r.body.fallbackApplied,false);assert.equal(r.body.dateUsed,'2026-11-14');assert.equal(r.body.teams.find(x=>x.team==='BBB').sparkSeries.at(-1).date,'2026-11-01');assert.equal(r.body.warnings.length,0);
  const mixed={dateUsed:r.body.dateUsed,partial:r.body.coverage.partial,fallbackApplied:r.body.fallbackApplied,warnings:r.body.warnings,teamCutoffs:r.body.teams.map(x=>({team:x.team,date:x.sparkSeries.at(-1).date}))};
  rows[1].date='2026-11-14';const control=response();await ctpi.default({method:'GET',query:{date:'2026-11-14',version:'1'}},control);assert.equal(control.body.coverage.partial,false);assert.ok(control.body.teams.every(x=>x.sparkSeries.at(-1).date==='2026-11-14'));
  let calls=0;const webhook=mod('web/pages/api/v1/webhooks/on-new-line-combo.ts',{
    fetch:async()=>{calls++;return {ok:false,status:500,json:async()=>({success:false,error:'fixture failure'})}},webhookErrorDiagnostic:e=>String(e),
  },['sendLineComboToDiscord','retryAsyncOperation'],['NonRetryableWebhookError','isNonRetryableWebhookError','sendLineComboToDiscord','retryAsyncOperation']);
  const receipt=await webhook.retryAsyncOperation(()=>webhook.sendLineComboToDiscord(1,1));assert.equal(calls,1);assert.equal(receipt.success,false);
  const adapter=mod('web/pages/api/v1/underlying-stats/xg.ts',{},['asNullableNumber'],['asNullableNumber']);assert.equal(adapter.asNullableNumber(null),0);assert.equal(adapter.asNullableNumber(undefined),null);
  const out={pin:'89da739cb',passed:true,ctpi:{mixed,alignedControl:'both current; complete',boundary:'Exact frozen handler and trust predicate. Synthetic matching version constants, two-team expected population and finite query double; serving-message helper doubled. No approved current v2 or live stale row asserted.'},webhook:{httpStatus:500,calls,resolvedReceipt:receipt,boundary:'Exact send/retry functions with inert fetch; constant parked wrapper remains active and was not bypassed operationally.'},xg:{nullAdapter:0,undefinedAdapter:null,disposition:'No missing-metric finding: checked-in created-xG schema declares numeric fields NOT NULL. Nullable team ID conversion is a low-impact identity limitation, not evidence of invented stored metrics.'},sources,boundary:'No real DB, provider, page, message, environment values, application client, suite or write.'};
  fs.writeFileSync('tasks/artifacts/calculation-inventory-2026-11-10/master/astra-full-audit-20261114/pages15-probe-output.json',JSON.stringify(out,null,2)+'\n');console.log({passed:true,findings:2,controls:2});
})().catch(e=>{console.error(e);process.exitCode=1});
