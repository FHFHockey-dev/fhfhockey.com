// One child process owns one database, app, and browser. Its first Trends HTTP
// request comes from navigating Chromium to the homepage.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {build,web,webRequire,base}=require('./build.cjs');
const {start,digest,aggregate}=require('./server.cjs');
const {fixedTime,mappings,players}=require('./fixture.cjs');
const {installObserver}=require('./browser.cjs');

function expectedPage(){
  const identities=new Map(mappings.map(m=>[m.yahoo_player_id,m.nhl_player_id]));
  const movers=[];
  // The fixture is chronological within each series. Every non-flat series has
  // its own Nov 15 observation and the same Nov 17 endpoint.
  for(const p of players){
    const history=p.normalized_ownership_timeline, end=history.at(-1), start=history.find(d=>d.date==='2026-11-15');
    if (!end || !start || end.value===start.value) continue;
    movers.push({name:p.full_name,playerId:identities.get(p.player_key)??null,latest:end.value,delta:end.value-start.value});
  }
  const risers=movers.filter(m=>m.delta>0).sort((a,b)=>b.delta-a.delta);
  const fallers=movers.filter(m=>m.delta<0).sort((a,b)=>a.delta-b.delta);
  assert.deepEqual([risers.length,fallers.length],[89,200]);
  return {windowDays:3,page:1,offset:0,metric:'ownership',totalRisers:89,totalFallers:200,
    risers:risers.slice(0,10),fallers:fallers.slice(0,10)};
}
async function one(mode){
  assert.equal(process.env.TREND_LOCAL_PG,'1');assert.equal(process.env.TREND_PG_FRESH,'1');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fhfh-first-hit-'));
  fs.symlinkSync(path.join(web,'node_modules'),path.join(tmp,'node_modules'),'dir');
  const expected=expectedPage();
  const reference=JSON.parse(fs.readFileSync(path.join(__dirname,mode+'.json'),'utf8'));
  let server,browser;
  try {
    const sources=await build(mode,tmp);
    server=await start(tmp);
    const {chromium}=webRequire('playwright');
    const executablePath=process.env.CHROME_PATH || (fs.existsSync(chromium.executablePath())
      ? chromium.executablePath() : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    browser=await chromium.launch({executablePath,headless:true,args:['--disable-background-networking']});
    const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'});
    const external=[],errors=[];
    await page.route('**/*',async route=>{
      if(new URL(route.request().url()).origin!==server.origin){external.push(route.request().url());await route.abort();}
      else await route.continue();
    });
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(fixed=>{
      const RealDate=Date,start=RealDate.now();
      globalThis.Date=class extends RealDate {
        constructor(...args){super(...(args.length?args:[Date.now()]));}
        static now(){return RealDate.parse(fixed)+RealDate.now()-start;}
      };
    },fixedTime);
    await page.addInitScript(installObserver,expected);
    assert.equal(server.records.length,0);
    await page.goto(server.origin);
    await page.waitForFunction(()=>window.sample!==null && window.sample!==undefined,{},{timeout:6000});
    const sample=await page.evaluate(()=>window.sample);
    assert.equal(server.records.length,1);
    const row=server.records[0];
    const full=digest(row.payload);
    assert.equal(full,reference.contracts.default.full);
    assert.deepEqual([external,errors],[[],[]]);
    const queryMs={};
    for(const q of row.queries)queryMs[q.stage]=(queryMs[q.stage]||0)+q.ms;
    return {mode,full,sources,engine:browser.version(),browserMs:sample.ms,handlerMs:row.ms,queries:row.queries.length,
      stages:aggregate([row]),queryMs,responseBytes:row.bytes,rows:sample.count,externalRequests:external.length};
  } finally {if(browser)await browser.close();if(server)await server.close();fs.rmSync(tmp,{recursive:true,force:true});}
}
function stats(v){
  const a=[...v].sort((x,y)=>x-y);
  const round=x=>Number(x.toFixed(2));
  return {n:a.length,median:round(a[Math.floor(a.length/2)]),min:round(a[0]),max:round(a.at(-1)),samples:v.map(round)};
}
async function main(){
  if(process.argv[2]==='child'){console.log(JSON.stringify(await one(process.argv[3])));return;}
  const n=5,samples={before:[],after:[]},sources={},runs=[];
  for(let i=0;i<n;i++){
    const pair=i%2===0 ? ['before','after'] : ['after','before'];
    for(const mode of pair){
      const result=JSON.parse(execFileSync(process.execPath,[__filename,'child',mode],{
        env:{...process.env,TREND_LOCAL_PG:'1',TREND_PG_FRESH:'1'},encoding:'utf8'}));
      if(sources[mode]) assert.deepEqual(result.sources,sources[mode],'source drift between samples');
      else sources[mode]=result.sources;
      delete result.sources;
      samples[mode].push(result);runs.push(mode);
    }
  }
  const summary={};
  for(const mode of ['before','after']){
    summary[mode]={browserMs:stats(samples[mode].map(x=>x.browserMs)),handlerMs:stats(samples[mode].map(x=>x.handlerMs))};
  }
  const out=path.join(__dirname,'fresh.json');
  fs.writeFileSync(out,JSON.stringify({base,fixedTime,runs,sources,summary,samples},null,2)+'\n');
  console.log(out,summary);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
