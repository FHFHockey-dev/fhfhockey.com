const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');
const {chromium}=require('/Users/tim/Code/fhfhockey.com/web/node_modules/@playwright/test');
const source='/Users/tim/Documents/Codex/2026-10-27/task-3/current-evidence-visual-candidate-20261101-01/candidate.html';
const attempt=process.argv[2]||'browser-01';assert(/^browser-\d{2}$/.test(attempt));
const out=path.join(__dirname,attempt);fs.mkdirSync(out);const lock='/private/tmp/fhfh-heavy.lock';
const owner={owner:'codex-blsh-evidence-visual-independent-browser-review',pid:process.pid};
fs.mkdirSync(lock);fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify(owner));
const url=pathToFileURL(source).href;const result={externalRequests:[],errors:[],checks:[],accessibility:[],observations:[]};let browser;
async function reflow(page,name){const size=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));assert(size.width<=size.viewport,name);result.checks.push({name,...size});}
async function detail(page,name){await page.getByLabel('Evidence view').selectOption('all');await page.getByLabel('Find a player').fill(name);await page.getByRole('button',{name:`Details for ${name}`,exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'detail-heading');}
async function axe(page,name){await page.addScriptTag({path:'/Users/tim/Code/fhfhockey.com/web/node_modules/axe-core/axe.min.js'});const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));result.accessibility.push({name,violations});assert.equal(violations.length,0);}
(async()=>{try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.route('**/*',route=>{if(route.request().url()===url)return route.continue();result.externalRequests.push(route.request().url());return route.abort();});
 const page=await context.newPage();page.on('pageerror',e=>result.errors.push(String(e)));
 await page.clock.install({time:new Date('2026-11-01T22:30:00Z')});await page.goto(url);
 if(!process.argv.includes('--tail')){
 assert.equal(await page.locator('#fp-count').innerText(),'482 / 740');assert.equal(await page.locator('#ppp-count').innerText(),'212');assert.match(await page.locator('#result-status').innerText(),/25 of 740/);
 await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').innerText(),'Skip to input evidence');await page.keyboard.press('Enter');await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('id'),'search');
 result.focusStyle=await page.locator(':focus').evaluate(e=>({width:getComputedStyle(e).outlineWidth,style:getComputedStyle(e).outlineStyle,color:getComputedStyle(e).outlineColor}));assert.equal(result.focusStyle.width,'2px');
 await reflow(page,'desktop');await axe(page,'desktop');await page.screenshot({path:path.join(out,'desktop.png')});
 await page.getByLabel('Evidence view').selectOption('checked');assert.match(await page.locator('#result-status').innerText(),/of 482 matching/);
 await page.getByLabel('Evidence view').selectOption('review');assert.match(await page.locator('#result-status').innerText(),/of 258 matching/);
 await page.getByLabel('Evidence view').selectOption('zero');assert.equal(await page.locator('#players>li').count(),20);
 await detail(page,'Brent Burns');const fp=page.locator('.track-grid>section').first();assert.match(await fp.innerText(),/8\.85/);assert.match(await fp.innerText(),/1\.77/);assert.match(await fp.innerText(),/6\.47/);
 await page.locator('.game').filter({hasText:'2026-10-28'}).locator('summary').focus();await page.keyboard.press('Enter');assert.match(await page.locator('.game[open]').innerText(),/credited PP goals and assists/);
 result.accessibilityTree=await page.locator('#detail').ariaSnapshot();await page.keyboard.press('Escape');assert(await page.locator('#detail').isHidden());assert.equal(await page.locator(':focus').innerText(),'Details for Brent Burns');
 await detail(page,'David Perron');assert.match(await page.locator('.track-grid>section').first().innerText(),/selected appearances\n0/);
 await detail(page,'Ian Cole');assert.match(await page.locator('.track-grid>section').nth(2).innerText(),/Unavailable/);assert.match(await page.locator('#freshness').innerText(),/within its 24-hour/);
 await detail(page,'Nicolas Deslauriers');await page.locator('.game').filter({hasText:'2026-10-29'}).locator('summary').click();assert.match(await page.locator('.game[open]').innerText(),/445 seconds; retained official evidence: 444 seconds/);
 await detail(page,'Christian Dvorak');await page.locator('.game').filter({hasText:'2026-10-28'}).locator('summary').click();assert.match(await page.locator('.game[open]').innerText(),/faceoff wins 13 captured \/ 12/);
 await page.setViewportSize({width:320,height:900});await page.locator('#detail-heading').evaluate(e=>e.scrollIntoView({block:'start'}));await reflow(page,'320px detail');await axe(page,'320px expanded detail');await page.screenshot({path:path.join(out,'narrow-detail.png')});await page.locator('.game[open]').screenshot({path:path.join(out,'narrow-game.png')});
 await page.setViewportSize({width:1280,height:1000});await page.addStyleTag({content:'html{font-size:200%}'});await page.locator('#detail-heading').evaluate(e=>e.scrollIntoView({block:'start'}));await reflow(page,'200% text resize');await page.screenshot({path:path.join(out,'text-resize.png')});
 }else{result.resumedAfterSuccessfulLayoutAndAxeChecks=true;await detail(page,'Christian Dvorak');}
 await page.emulateMedia({forcedColors:'active'});await page.locator('#detail-heading').focus();await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('id'),'close-detail');result.forcedColors=await page.locator('#close-detail').evaluate(e=>({outline:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth,color:getComputedStyle(e).outlineColor}));assert(parseFloat(result.forcedColors.width)>=2 && result.forcedColors.outline!=='none');await page.screenshot({path:path.join(out,'forced-colors.png')});await page.emulateMedia({forcedColors:'none'});
 await page.clock.setFixedTime(new Date('2026-11-03T00:00:00Z'));await page.evaluate(()=>dispatchEvent(new Event('focus')));assert.match(await page.locator('#freshness').innerText(),/Stale capture/);
 await page.clock.setFixedTime(new Date('2026-11-01T19:00:00Z'));await page.evaluate(()=>dispatchEvent(new Event('focus')));assert.equal(await page.locator('#freshness').innerText(),'Capture age unknown.');
 await page.getByLabel('Find a player').fill('NonexistentAuditPlayer');assert(await page.locator('#empty').isVisible());assert.match(await page.locator('#result-status').innerText(),/0 of 0/);await page.getByRole('button',{name:'Clear filters',exact:true}).click();assert.equal(await page.locator(':focus').getAttribute('id'),'search');
 // Exercise the final pagination transition, including keyboard focus after the trigger disappears.
 await page.addStyleTag({content:'html{font-size:100%}'});await page.setViewportSize({width:1440,height:1000});
 while(await page.locator('#players>li').count()<725)await page.getByRole('button',{name:'Show next 25',exact:true}).click();
 const more=page.getByRole('button',{name:'Show next 25',exact:true});await more.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#players>li').count(),740);assert(await more.isHidden());
 result.paginationFinal=await page.evaluate(()=>({focusTag:document.activeElement.tagName,focusId:document.activeElement.id,scrollY,firstNewPlayerTop:document.querySelectorAll('#players>li')[725].getBoundingClientRect().top,statusTop:document.getElementById('result-status').getBoundingClientRect().top}));
 await page.keyboard.press('Tab');result.paginationFinal.nextTab=await page.locator(':focus').evaluate(e=>({tag:e.tagName,id:e.id,text:e.innerText}));
 const broken=await context.newPage();await broken.setContent(fs.readFileSync(source,'utf8').replace(/(<script id="payload" type="application\/json">)[\s\S]*?(<\/script>)/,'$1{broken$2'));assert(await broken.getByRole('alert').isVisible());assert(await broken.getByRole('button',{name:'Reload this file',exact:true}).isVisible());
 assert.equal(result.externalRequests.length,0);assert.equal(result.errors.length,0);result.state='PASS';
}catch(error){result.state='FAILED';result.failure=String(error.stack||error);process.exitCode=1;}
finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,'RESULT.json'),JSON.stringify(result,null,2));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(lock,'owner.json'),'utf8')),owner);fs.renameSync(lock,path.join(out,'RELEASED-BROWSER-LOCK'));console.log(JSON.stringify({state:result.state,failure:result.failure,checks:result.checks,accessibility:result.accessibility,paginationFinal:result.paginationFinal}));}})();
