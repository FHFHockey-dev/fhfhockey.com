const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {performance} = require('node:perf_hooks');
const assert = require('node:assert/strict');
const {build,web,webRequire,base} = require('./build.cjs');
const {start,aggregate,digest} = require('./server.cjs');
const {fixedTime,players,adp} = require('./fixture.cjs');
const defaultQuery = {metric:'ownership',window:3,limit:10,offset:0};
const scenarios = {
  default:defaultQuery,
  position:{...defaultQuery,pos:'D'},
  window:{...defaultQuery,pos:'D',window:5},
  page2:{...defaultQuery,pos:'D',window:5,offset:10},
  adp:{...defaultQuery,metric:'adp'},
  missingSeason:{...defaultQuery,season:1900},
  selected:{...defaultQuery,playerIds:'8420001,8420350',includeFlat:1},
};
function stats(samples){
  const sorted = [...samples].sort((a,b)=>a-b);
  const mid = Math.floor(sorted.length/2), round=x=>Number(x.toFixed(2));
  return {n:sorted.length,median:round(sorted.length%2 ? sorted[mid] : (sorted[mid]+sorted[mid-1])/2),
    min:round(sorted[0]),max:round(sorted.at(-1)),samples:samples.map(round)};
}
const summary = row=>({url:row.url,handlerMs:row.ms,bytes:row.bytes,stages:aggregate([row])});
function withoutMovementDates(value){
  return JSON.parse(JSON.stringify(value,(key,entry)=>['movementStartDate','movementEndDate'].includes(key) ? undefined : entry));
}
function validateDates(payload){
  const ownership = new Map(players.map(p=>[p.player_key,p.normalized_ownership_timeline]));
  for(const row of [...payload.risers,...payload.fallers,...(payload.selectedPlayers||[])]){
    const history = payload.metric==='ownership' ? ownership.get(row.playerKey) : adp.filter(p=>p.player_key===row.playerKey)
      .map(p=>({date:p.captured_at.slice(0,10),value:p.average_draft_pick})).sort((a,b)=>a.date.localeCompare(b.date));
    const end=history.at(-1);
    const anchor=payload.metric==='ownership' ? fixedTime : end.date+'T12:00:00Z';
    const cutoff = new Date(Date.parse(anchor)-payload.windowDays*86400000).toISOString().slice(0,10);
    const start=history.find(p=>p.date===cutoff) || history.slice(0,-1).filter(p=>p.date<=cutoff).at(-1);
    assert.deepEqual([row.movementStartDate,row.movementEndDate,row.previous,row.latest],[start.date,end.date,start.value,end.value]);
  }
}
const mode = process.argv[2], n = Number(process.argv[3] || 5);
assert(['before','after'].includes(mode));
assert(Number.isInteger(n) && n>0);
async function main(){
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'fhfh-trends-bench-'));
  fs.symlinkSync(path.join(web,'node_modules'),path.join(tmp,'node_modules'),'dir');
  let server;
  try {
    const sources=await build(mode,tmp);
    server = await start(tmp);
    let payloads = {};
    const output={mode,sources,adapter:process.env.TREND_LOCAL_PG === '1' ? 'local-postgres' : 'memory',base,fixedTime,samples:n,api:{},contracts:{},browser:{}};
    const timings = {},handlerTimes={},queryTimes={};
    for(let i=0;i<n;i++){
      server.reset();
      for(const [label,query] of Object.entries(scenarios)){
        const start=performance.now();
        const response = await fetch(server.origin+'/api/v1/transactions/ownership-trends?'+new URLSearchParams(query));
        const bytes = await response.text();
        const elapsed=performance.now()-start;
        assert.equal(response.status,200,bytes.slice(0,300));
        assert.match(response.headers.get('cache-control'),/s-maxage=300/);
        const value=JSON.parse(bytes),row=server.records.at(-1);
        const qtiming = {};
        for (const q of row.queries) qtiming[q.stage]=(qtiming[q.stage]||0)+q.ms;
        for (const [stage,ms] of Object.entries(qtiming)) ((queryTimes[label]??={})[stage]??=[]).push(ms);
        assert.equal(value.success,true);
        if(i===0){
          payloads[label]=value;
          output.api[label] = summary(row);
          output.contracts[label] = {full:digest(value),sourceDate:value.sourceDate,
            mapped:value.mappedPlayerCount,unmapped:value.unmappedPlayerCount,risers:value.totalRisers,fallers:value.totalFallers,
            originalFieldsDigest:digest(withoutMovementDates(value)),fields:Object.keys(value).sort(),rowFields:Object.keys(value.risers[0]||{}).sort()};
        } else assert.equal(digest(value),digest(payloads[label]),label+' changed during samples');
        (timings[label]??=[]).push(elapsed);(handlerTimes[label]??=[]).push(row.ms);
      }
      server.records.length=0;
    }
    for(const label of Object.keys(output.api)){
      output.api[label].summedQueryMs=Object.fromEntries(Object.entries(queryTimes[label]||{}).map(([k,v])=>[k,stats(v)]));
      output.api[label].httpMs=stats(timings[label]);
      output.api[label].handlerMs=stats(handlerTimes[label]);
    }
    const d=payloads.default;
    assert.deepEqual([d.totalRisers,d.totalFallers,d.mappedPlayerCount,d.unmappedPlayerCount,d.sourceDate],
      [89,200,2373,2065,'2026-11-17']);
    assert.equal(payloads.missingSeason.seasonFallbackApplied,true);
    assert(payloads.selected.selectedPlayers.length);
    if(mode === 'after'){
      const before=JSON.parse(fs.readFileSync(path.join(__dirname,'before.json'),'utf8'));
      for(const [label,payload] of Object.entries(payloads)){
        assert.equal(output.contracts[label].originalFieldsDigest,before.contracts[label].full,label+' legacy payload changed');
        validateDates(payload);
      }
    }
    if(!process.env.API_ONLY) {
      const {browserSamples}=require('./browser.cjs');
      output.browser=await browserSamples({server,payloads,mode,n,stats});
    }
    const file = process.env.RECEIPT || path.join(__dirname,mode+'.json');
    fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');
    console.log(file, Object.fromEntries(Object.entries(output.api).map(([k,v])=>[k,v.handlerMs.median])));
  } finally {if(server) await server.close();fs.rmSync(tmp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
