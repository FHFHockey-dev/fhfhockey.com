const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{createRequire}=require('node:module');
const req=createRequire('/Users/tim/Code/fhfhockey.com/web/package.json'),{chromium}=req('@playwright/test');
const lock='/private/tmp/fhfh-heavy.lock',owner='player-cards-independent-browser-probe';
fs.mkdirSync(lock);fs.writeFileSync(lock+'/owner.json',JSON.stringify({owner,pid:process.pid,task:'Two-file offline warning bounds probe'}));
(async()=>{let browser;const results=[],requests=[];try{
 browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true,timeout:10000,args:['--disable-background-networking']});
 const context=await browser.newContext({offline:true,viewport:{width:1200,height:1020}});await context.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort()});
 const page=await context.newPage();page.setDefaultTimeout(10000);
 for(const name of ['normal','long-token']){
  await page.goto(pathToFileURL(path.join(__dirname,name+'.html')).href);
  const bounds=await page.locator('[data-confirmation-warnings="true"]').evaluate(e=>{const b=e.getBBox(),s=e.closest('svg');return{x:b.x,y:b.y,width:b.width,height:b.height,right:b.x+b.width,cardWidth:s.viewBox.baseVal.width,lineWidths:[...e.querySelectorAll('tspan')].map(t=>t.getComputedTextLength())}});
  await page.screenshot({path:path.join(__dirname,name+'.png')});results.push({name,...bounds});
 }
 assert(results[0].right<1200);assert(results[1].right>1200);assert.deepEqual(requests,[]);
 fs.writeFileSync(path.join(__dirname,'browser-probe.json'),JSON.stringify({results,requests,offline:true},null,2)+'\n');console.log(JSON.stringify(results));
}finally{if(browser)await browser.close();if(JSON.parse(fs.readFileSync(lock+'/owner.json')).owner===owner)fs.renameSync(lock,path.join(__dirname,'browser-lock-released'))}})().catch(e=>{console.error(e);process.exitCode=1});
