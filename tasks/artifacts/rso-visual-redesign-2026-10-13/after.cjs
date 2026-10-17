const fs=require('node:fs'),path=require('node:path');
const root='/Users/tim/Code/fhfhockey.com/web',out='/tmp/rso-redesign-ui-20261013';
const esbuild=require(path.join(root,'node_modules/esbuild')),sass=require(path.join(root,'node_modules/sass'));
const {chromium,expect}=require(path.join(root,'node_modules/@playwright/test'));
const aliases={
  'contexts/AuthProviderContext':'export const useAuth=()=>({user:null});',
  'lib/supabase/client':'export default {auth:{getSession:async()=>({data:{session:null}})},from(){throw Error("Fixture forbids database access")}};',
  'lib/NHL/client':`export async function getSchedule(start){const dates=Array.from({length:7},(_,i)=>new Date(Date.parse(start+'T12:00:00Z')+i*86400000).toISOString().slice(0,10)),data={},counts=Array(7).fill(0);for(const g of window.__fixtureCalendar??[]){if(!dates.includes(g.gameDate))continue;const index=(new Date(g.gameDate+'T12:00:00Z').getUTCDay()+6)%7;counts[index]++;for(const id of [g.homeTeam.id,g.awayTeam.id]){data[id]??={};data[id][['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][index]]=g;}}return {data,numGamesPerDay:counts,coveredDates:dates};}export async function getTeams(){return window.__fixtureTeams??[];}`,
  'next/head':'export default function Head(){return null;}',
  'next/image':'import React from "react";export default function Image({alt,width,height,...props}){return <img alt={alt} width={width} height={height} src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"/>;}'
};
const scss={name:'actual-scss',setup(b){b.onLoad({filter:/\.scss$/},a=>({contents:sass.compile(a.path,{loadPaths:[root],logger:{warn(){},debug(){}}}).css,loader:'local-css',resolveDir:path.dirname(a.path)}));}};
async function bundle(entry,plugins=[]){return esbuild.build({entryPoints:[entry],bundle:true,write:false,outdir:path.join(out,'bundle'),jsx:'automatic',tsconfig:path.join(root,'tsconfig.json'),nodePaths:[path.join(root,'node_modules')],define:{'process.env.NODE_ENV':'"production"'},plugins:[...plugins,scss]});}
async function main(){
  const planning=await bundle(path.join(root,'hooks/rosterPlanning.worker.ts'));
  const metrics=await bundle(path.join(root,'hooks/candidateMetrics.worker.ts'));
  const built=await bundle(path.join(out,'fixture-entry.tsx'),[{name:'fixture-boundaries',setup(b){
    b.onResolve({filter:/^(contexts\/AuthProviderContext|lib\/supabase\/client|lib\/NHL\/client|next\/head|next\/image)$/},a=>({path:a.path,namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:aliases[a.path],loader:'tsx',resolveDir:root}));
    b.onLoad({filter:/\/use(RosterPlanning|CandidateMetrics)\.ts$/},a=>({contents:fs.readFileSync(a.path,'utf8').replace('new URL("./rosterPlanning.worker.ts", import.meta.url)','window.__rsoFixtureWorkers.planning').replace('new URL("./candidateMetrics.worker.ts", import.meta.url)','window.__rsoFixtureWorkers.metrics'),loader:'ts',resolveDir:path.dirname(a.path)}));
  }}]);
  const js=built.outputFiles.find(f=>f.path.endsWith('.js')).text,css=built.outputFiles.find(f=>f.path.endsWith('.css')).text;
  const globalCss=fs.readFileSync(path.join(root,'styles/globals.css'),'utf8').replace(/^@import[^;]+;/gm,'');
  const workerClock='const OriginalDate=Date;self.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:["2026-10-13T12:00:00Z"]));}static now(){return OriginalDate.parse("2026-10-13T12:00:00Z");}};';
  const bootstrap='window.__rsoFixtureWorkers={planning:URL.createObjectURL(new Blob(['+JSON.stringify(workerClock+planning.outputFiles.find(f=>f.path.endsWith('.js')).text)+'],{type:"text/javascript"})),metrics:URL.createObjectURL(new Blob(['+JSON.stringify(workerClock+metrics.outputFiles.find(f=>f.path.endsWith('.js')).text)+'],{type:"text/javascript"}))};';
  const html='<html><head><style>'+globalCss+css+'</style></head><body><div id="root"></div><script>'+bootstrap.replaceAll('</script>','<\\/script>')+'</script><script>'+js.replaceAll('</script>','<\\/script>')+'</script></body></html>';
  const browser=await chromium.launch({headless:true}),observations=[];
  for(const scenario of ['complete','partial','conditional','empty'])for(const [width,height] of [[1440,900],[390,844]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<1100}),requests=[],errors=[];
    await context.route('**/*',r=>{requests.push(r.request().url());return r.request().url()==='http://127.0.0.1:47999/roster-schedule-optimizer'?r.fulfill({contentType:'text/html',body:html}):r.abort();});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'));
    await page.addInitScript(s=>{window.__fixtureScenario=s;},scenario);
    await page.goto('http://127.0.0.1:47999/roster-schedule-optimizer');
    await expect(page.getByRole('heading',{name:'Roster Schedule Optimizer',exact:true})).toBeVisible();
    await expect(page.getByText('Loading schedule and forecasts…',{exact:true})).toHaveCount(0);
    const top=page.locator('summary').filter({hasText:'Top five team schedules'});
    if(width===1440){await expect(top.locator('..')).toHaveAttribute('open','');await expect(page.getByLabel('Top team schedule cards')).toBeVisible();}
    else{await expect(top.locator('..')).not.toHaveAttribute('open');await top.tap();await expect(page.getByLabel('Top team schedule cards')).toBeVisible();await top.tap();}
    const initial=await page.evaluate(()=>localStorage.getItem('fhfh:rso:workspace:v1'));
    const metricHelp=page.getByRole('button',{name:'About active games',exact:true});
    for(let i=0;i<2;i++){
      await metricHelp.focus();await page.keyboard.press('Enter');await expect(page.getByRole('tooltip')).toBeVisible();
      const bounds=await page.getByRole('tooltip').boundingBox();if(!bounds||bounds.x<0||bounds.x+bounds.width>width+1||bounds.y<0||bounds.y+bounds.height>height+1)throw Error('Tooltip viewport overflow');
      await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);await expect(metricHelp).toBeFocused();
    }
    await page.getByRole('heading',{name:'Roster Schedule Optimizer',exact:true}).click();
    if(width<1100){for(let i=0;i<2;i++){await metricHelp.tap();await expect(page.getByRole('tooltip')).toBeVisible();await metricHelp.tap();await expect(page.getByRole('tooltip')).toHaveCount(0);}}
    expect(await page.evaluate(()=>localStorage.getItem('fhfh:rso:workspace:v1'))).toBe(initial);
    if(width<1100)await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Roster',exact:true}).click();
    if(scenario!=='empty'){
      const alpha=page.getByLabel('Fixture Alpha range contribution',{exact:true});
      await expect(alpha.getByLabel('Active points: '+(scenario==='complete'?'10':'unavailable'),{exact:true})).toBeVisible();
      await page.getByLabel('Manage Fixture Alpha',{exact:true}).click();await expect(page.getByRole('button',{name:'Remove Fixture Alpha',exact:true})).toBeVisible();
      await page.getByLabel('Manage Fixture Alpha',{exact:true}).click();
      await alpha.locator('summary').focus();await page.keyboard.press('Enter');await expect(alpha).toHaveAttribute('open','');await page.keyboard.press('Enter');
      if(width===1440)await expect(page.getByRole('cell',{name:'Range active points: '+(scenario==='complete'?'10':'unavailable'),exact:true}).first()).toBeVisible();
      if(scenario==='complete'){
        const rules=page.locator('#rso-rule-settings > summary');await rules.click();await page.getByRole('button',{name:'Confirm planning inputs',exact:true}).click();await rules.click();
        if(width<1100)await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Candidates',exact:true}).click();
        const agp=page.locator('[data-rso-candidate-id="30"]'),points=page.locator('[data-rso-candidate-id="31"]');
        await expect(agp).toContainText('Net points-7');await expect(agp).toContainText('Net AGP+1');await expect(points).toContainText('Net points+1');await expect(points).toContainText('Net AGP0');
        await expect(agp).toContainText('DROP');await expect(agp).toContainText('Fixture Alpha');await expect(points).toContainText('Conditional · recheck availability');
        await agp.locator('summary').click();await expect(agp).toContainText('Lost active contribution from Fixture Alpha: 1 AGP, 10 points');await agp.locator('summary').click();
        await page.getByRole('combobox',{name:'Sort',exact:true}).selectOption('schedule');await expect(agp.getByRole('button',{name:'Select compared plan',exact:true})).toBeEnabled();
        await page.screenshot({path:path.join(out,'after-candidates-'+width+'.png')});
        await agp.getByRole('button',{name:'Select compared plan',exact:true}).click();
        const selected=await page.evaluate(()=>JSON.parse(localStorage.getItem('fhfh:rso:workspace:v1')));
        expect(selected.intent.steps.some(s=>s.type==='add'&&s.playerId==='30'&&s.dropPlayerId==='1')).toBe(true);
        expect(selected.context.startDate).toBe('2026-10-13');expect(selected.context.endDate).toBe('2026-10-19');
        await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fhfh:rso:workspace:v1')).intent.steps.length)).toBe(0);await expect(page.locator('#rso-action-status')).toBeHidden();
      }
    }else{
      await expect(page.getByRole('searchbox',{name:'Find a player',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Review pasted names',exact:true})).toBeDisabled();
    }
    if(width<1100){
      await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Matchup',exact:true}).click();await expect(page.getByText(/Opponent inputs are missing/)).toBeVisible();
      await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Itinerary',exact:true}).click();
      await expect(page.getByRole('region',{name:'Roster and setup',exact:true})).toBeHidden();
      await expect(page.getByRole('region',{name:'Candidates and detail',exact:true})).toBeHidden();
      await page.getByRole('button',{name:/Show (lineup analysis|schedule-capacity assignment)/}).click();
      const schedule=page.getByRole('region',{name:'Player weekly schedule scroll area',exact:true});
      await schedule.evaluate(n=>{n.scrollLeft=n.scrollWidth;});expect(await schedule.evaluate(n=>n.scrollLeft)).toBeGreaterThan(0);await schedule.evaluate(n=>{n.scrollLeft=0;});
      await page.screenshot({path:path.join(out,'after-itinerary-'+scenario+'-'+width+'.png')});
      await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Roster',exact:true}).click();await page.evaluate(()=>scrollTo(0,0));
    }else{
      const roster=page.getByRole('region',{name:'Roster and setup',exact:true}).locator('#rso-roster-edit');
      if(scenario!=='empty'){await roster.evaluate(n=>{n.scrollTop=n.scrollHeight;});expect(await roster.evaluate(n=>n.scrollTop)).toBeGreaterThan(0);await roster.evaluate(n=>{n.scrollTop=0;});}
      const cards=page.getByRole('region',{name:'Candidates and detail',exact:true}).locator(':scope > div').last();await cards.evaluate(n=>{n.scrollTop=0;});
    }
    const frame=await page.evaluate(()=>({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,panelRects:[...document.querySelectorAll('[class*=panels] > section')].filter(n=>getComputedStyle(n).display!=='none').map(n=>{const r=n.getBoundingClientRect();return {width:r.width,top:r.top,bottom:r.bottom};})}));
    if(frame.documentWidth>width+1||width===1440&&frame.documentHeight>height+1)throw Error('Document overflow '+JSON.stringify(frame));
    if(width===1440){expect(frame.panelRects).toHaveLength(3);expect(frame.panelRects[1].width).toBeGreaterThan(frame.panelRects[0].width);expect(frame.panelRects[1].width).toBeGreaterThan(frame.panelRects[2].width);expect(frame.panelRects.every(r=>r.bottom<=height+1)).toBe(true);}
    await page.screenshot({path:path.join(out,'after-'+scenario+'-'+width+'.png')});
    if(width<1100){await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
    const reads=await page.evaluate(()=>window.__fixtureReads);if(errors.length||requests.length!==1||reads.some(r=>r.method!=='GET'||r.url.endsWith('/provider')))throw Error('Fixture boundary or page error '+JSON.stringify({errors,requests,reads}));
    observations.push({scenario,width,height,frame,errors,requests,reads});await context.close();
  }
  await browser.close();fs.writeFileSync(path.join(out,'browser-receipt.json'),JSON.stringify({scope:'actual RSO page/Container/ClientOnly/styles and real planning/candidate workers; synthetic auth/API/calendar; header/Next wrappers substituted; remote fonts stripped',freshContexts:true,productionRequests:0,externalRequests:0,accountRequests:0,observations},null,2));console.log('Integrated RSO desktop/mobile fixture acceptance passed.');
}
main().catch(e=>{console.error(e);process.exit(1);});
