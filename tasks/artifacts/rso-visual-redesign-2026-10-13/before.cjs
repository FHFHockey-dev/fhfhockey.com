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
  for(const [width,height] of [[1440,900],[390,844]]){
    const context=await browser.newContext({viewport:{width,height}}),requests=[],errors=[];
    await context.route('**/*',r=>{requests.push(r.request().url());return r.request().url()==='http://127.0.0.1:47999/roster-schedule-optimizer'?r.fulfill({contentType:'text/html',body:html}):r.abort();});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'));
    await page.addInitScript(()=>{window.__fixtureScenario='complete';});
    await page.goto('http://127.0.0.1:47999/roster-schedule-optimizer');
    await expect(page.getByRole('heading',{name:'Roster Schedule Optimizer',exact:true})).toBeVisible();
    await expect(page.getByText('Loading schedule and forecasts…',{exact:true})).toHaveCount(0);
    const top=page.locator('summary').filter({hasText:'Top five team schedules'});
    await top.click();
    if(width<1100)await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Roster',exact:true}).click();
    await expect(page.getByLabel('Fixture Alpha range contribution').getByLabel('Active points: 10')).toBeVisible();
    if(width===1440)await page.getByRole('region',{name:'Candidate browser'}).getByRole('button',{name:'All players',exact:true}).click();
    await page.screenshot({path:path.join(out,'before-'+width+'.png')});
    const frame=await page.evaluate(()=>({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight}));
    observations.push({width,height,frame,errors,requests});await context.close();
  }
  await browser.close();fs.writeFileSync(path.join(out,'before-receipt.json'),JSON.stringify(observations,null,2));console.log('Before fixture screenshots captured.');
}
main().catch(e=>{console.error(e);process.exit(1);});
