const assert = require('node:assert/strict');
const fs = require('node:fs');
const {webRequire} = require('./build.cjs');
const {fixedTime} = require('./fixture.cjs');
const {aggregate} = require('./server.cjs');
const {chromium} = webRequire('playwright');

// Installed inside Chromium. Stop on the first animation frame containing the
// correct rows in both visible tables and the correct page after loading ends.
function installObserver(initial){
  window.measure = function(expected, navigation=false){
    let started = navigation ? 0 : null;
    if(!navigation) document.addEventListener('click',()=>{started=performance.now();},{capture:true,once:true});
    window.sample = null;
    function check(){
      if (started === null) return;
      const section = document.querySelector('[aria-labelledby="trends-heading"]');
      if (!section || section.getAttribute('aria-busy') !== 'false') return;
      const copy = section.innerText;
      if(!copy.includes('Page '+expected.page) || !copy.includes('Risers: '+expected.totalRisers+' | Fallers: '+expected.totalFallers)) return;
      for (const name of ['risers','fallers']) {
        const panel = document.getElementById(name+'-panel');
        const table = panel?.querySelector('table');
        if (!table || !table.getBoundingClientRect().width || !panel.querySelector('h3').textContent.includes(expected.windowDays+'D')) return;
        const trs = [...table.querySelectorAll('tbody tr')];
        if(trs.length !== expected[name].length) return;
        for(let i=0;i<trs.length;i++){
          const cells=trs[i].cells, player=expected[name][i], link=cells[1].querySelector('a');
          if(cells[0].textContent !== String(i+1+expected.offset) ||
            !cells[1].innerText.includes(player.name) ||
            (link?.getAttribute('href') || null) !== (player.playerId ? '/trends/player/'+player.playerId : null) ||
            cells[3].textContent !== player.latest.toFixed(1)+(expected.metric==='adp' ? '' : '%')) return;
          const delta=expected.metric==='adp' ? player.deltaPct : player.delta;
          if(!cells[5].textContent.includes((delta>0?'+':'')+delta.toFixed(1))) return;
        }
      }
      window.sample={ms:performance.now()-started, count:expected.risers.length+expected.fallers.length, copy};
      return true;
    }
    function frame(){
      if(!check()) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };
  if(initial && !location.search) window.measure(initial,true);
}
async function browserSamples({server,payloads,mode,n,stats}){
  const installed='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath=process.env.CHROME_PATH || (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : installed);
  const browser=await chromium.launch({executablePath,headless:true,args:['--disable-background-networking']});
  const samples={},details={},external=[],errors=[];
  let delayedResponseCheck=null, mobileCheck=null;
  try {
    for(let i=0;i<n;i++){
      server.reset();
      const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
      await context.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.origin!==server.origin){external.push(url.origin);await route.abort();}
        else await route.continue();
      });
      const page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(fixed=>{
        const RealDate = Date, start = RealDate.now();
        globalThis.Date = class extends RealDate {
          constructor(...args){super(...(args.length ? args : [Date.now()]));}
          static now(){return RealDate.parse(fixed)+RealDate.now()-start;}
        };
      },fixedTime);
      const range=label=>{
        const data=server.records.splice(0);
        const value={requests:data.map(x=>x.url),stages:aggregate(data),responseBytes:data.reduce((a,b)=>a+b.bytes,0)};
        if(i===0)details[label]=value;else assert.deepEqual(value,details[label],label+' request counts');
      };
      async function record(label){
        try {await page.waitForFunction(()=>window.sample!==null && window.sample!==undefined,{},{timeout:5000});}
        catch(e){throw new Error(label+' failed: '+(await page.locator('body').innerText()).slice(0,2100)+' errors='+errors);}
        const sample=await page.evaluate(()=>window.sample);
        if(mode==='after') {
          assert.match(sample.copy,/Nov(?:ember)?\.? 17, 2026/,label+' visible source date');
          const shown=page.locator('[aria-labelledby="trends-heading"]');
          assert.equal(await shown.locator('time').getAttribute('datetime'),'2026-11-17',label+' machine-readable date');
          assert.doesNotMatch(sample.copy,/movement may be stale/i,label+' daily source is fresh at noon');
          if(label!=='adp') assert.match(sample.copy,/[-+]\d+\.\d+\s*pp\b/,label+' ownership unit');
          else assert.match(sample.copy,/[-+]\d+\.\d+%/,label+' ADP unit');
        }
        (samples[label]??=[]).push(sample.ms);
        range(label);
      }
      async function act(label,expected,locator){
        await page.evaluate(value=>window.measure(value),expected);
        await locator.click();
        await record(label);
      }
      await page.addInitScript(installObserver,payloads.default);
      await page.goto(server.origin);
      await record('default');
      const group=(label,button)=>page.getByRole('group',{name:label,exact:true}).getByRole('button',{name:button,exact:true});
      await act('position',payloads.position,group('Position filter','D'));
      await act('window',payloads.window,group('Time windows','5D'));
      const pager=page.getByRole('navigation',{name:'Pagination'});
      await act('page2',payloads.page2,pager.getByRole('button',{name:/Next/}));
      await act('clientReturn',payloads.window,pager.getByRole('button',{name:/Previous/}));
      assert.equal(details.clientReturn.requests.length,0);
      if(mode==='after' && i===n-1){
        let signalHeld,release;
        const held=new Promise(r=>{signalHeld=r;});
        const gate=new Promise(r=>{release=r;});
        await page.route('**/api/v1/transactions/ownership-trends?**',async route=>{
          if(new URL(route.request().url()).searchParams.get('pos')==='G'){
            signalHeld();
            await gate;
          }
          await route.continue();
        });
        await group('Position filter','G').click();
        await Promise.race([held,new Promise((_,reject)=>{
          const t=setTimeout(()=>reject(new Error('G request never started')),3000);t.unref();
        })]);
        const section=page.locator('[aria-labelledby="trends-heading"]');
        assert.equal(await section.getAttribute('aria-busy'),'true');
        assert.equal(await section.locator('tbody tr, time').count(),0);
        assert.doesNotMatch(await section.innerText(),/may be stale|Page \d|Risers: \d/);
        await page.evaluate(v=>window.measure(v),payloads.window);
        await group('Position filter','D').click();
        await page.waitForFunction(()=>window.sample!==null);
        const signature=()=>section.locator('tbody tr').allTextContents();
        const restored=await signature();
        const late=page.waitForResponse(r=>new URL(r.url()).searchParams.get('pos')==='G');
        release();
        assert.equal((await (await late).json()).pos,'G');
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        assert.deepEqual(await signature(),restored);
        assert.equal(await group('Position filter','D').getAttribute('aria-pressed'),'true');
        delayedResponseCheck={loadingRows:0,loadingSourceDates:0,loadingStaleNotices:0,restoredRows:restored.length,
          latePosition:'G',selectedPositionAfterLateResponse:'D',requests:server.records.splice(0).map(r=>r.url)};
        await page.unroute('**/api/v1/transactions/ownership-trends?**');
      }
      // The real switcher starts on Draft Ranker and mounts Trends on activation.
      await page.goto(server.origin+'/?offseason=1');
      const tab=page.getByRole('tab',{name:'Transaction Trends'});
      await tab.waitFor();
      assert.equal(await page.locator('[aria-labelledby="trends-heading"]').count(),0);
      assert.equal(server.records.length,0);
      await act('adp',payloads.adp,tab);
      if(mode==='after' && i===n-1){
        await page.setViewportSize({width:390,height:844});
        const section=page.locator('[aria-labelledby="trends-heading"]');
        assert.equal(await section.locator('#risers-panel').isVisible(),true);
        assert.equal(await section.locator('#fallers-panel').isVisible(),false);
        const lateEvening=Date.parse('2026-11-18T22:00:00Z');
        await page.evaluate(t=>{Date.now=()=>t;},lateEvening);
        await group('Trend direction','Fallers').click();
        assert.equal(await section.locator('#fallers-panel').isVisible(),true);
        assert.equal(await section.locator('#risers-panel').isVisible(),false);
        assert.match(await section.innerText(),/ADP movement may be stale/i);
        const bounds=await section.evaluate(el=>{
          const r=el.getBoundingClientRect();
          const right=Math.max(...Array.from(el.querySelectorAll('#fallers-panel tr > :last-child')).map(td=>td.getBoundingClientRect().right));
          return {viewport:innerWidth,sectionLeft:r.left,sectionRight:r.right,lastColumnRight:right};
        });
        assert(bounds.sectionLeft>=0 && bounds.sectionRight<=390 && bounds.lastColumnRight<=bounds.sectionRight+1,JSON.stringify(bounds));
        const rows=section.locator('#fallers-panel tbody tr');
        assert.equal(await rows.count(),payloads.adp.fallers.length);
        const unlinked=payloads.adp.fallers.filter(p=>p.playerId===null).length;
        assert.equal(await rows.locator('[title="NHL identity unconfirmed"]').count(),unlinked);
        mobileCheck={...bounds,rows:await rows.count(),unlinked,selected:'fallers',staleBannerAt22UTC:true,additionalRequests:server.records.length};
        assert.equal(mobileCheck.additionalRequests,0);
      }
      await context.close();
    }
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    return {engine:browser.version(),viewport:'1440x1000',samples:Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,stats(v)])),requests:details,
      externalRequests:external,pageErrors:errors,delayedResponseCheck,mobileCheck};
  } finally {await browser.close();}
}
module.exports={browserSamples,installObserver};
