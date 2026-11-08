const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require('/Users/tim/Code/fhfhockey.com/web/node_modules/@playwright/test');
const root=__dirname, source='/Users/tim/Documents/Codex/2026-10-27/task-3/game-score-missingness-visual-20261101-01';
const out=path.join(root,'browser'); const lock='/private/tmp/fhfh-heavy.lock';
const owner={owner:'codex-blsh-missingness-independent-review',pid:process.pid};
const url=pathToFileURL(path.join(source,'candidate.html')).href;
const pins=JSON.parse(fs.readFileSync(path.join(root,'PINS.json')));
const checkPins=()=>{for(const[p,h]of Object.entries(pins))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),h,p);};
const result={state:'RUNNING',atUTC:new Date().toISOString(),externalRequests:[],pageErrors:[],checks:[],axe:[]};
let browser;fs.mkdirSync(lock);fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify(owner));fs.mkdirSync(out);
async function open(page,name,record){
 await page.getByLabel('Find a player',{exact:true}).fill(name);
 const button=page.getByRole('button',{name:`Details for ${name}`,exact:true});await button.focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator(':focus').getAttribute('id'),'detail-heading');
 const game=page.locator('#detail .game').filter({hasText:`source record ${record}.`});assert.equal(await game.count(),1);
 await game.locator(':scope > summary').focus();await page.keyboard.press('Enter');assert.equal(await game.getAttribute('open'),'');
 await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').evaluate(e=>e.parentElement.className),'gs-inputs');
 await page.keyboard.press('Enter');const inputs=game.locator('.gs-inputs');assert.equal(await inputs.getAttribute('open'),'');
 assert.equal(await inputs.locator('[data-operand]').count(),17);
 const focus=await page.locator(':focus').evaluate(e=>({style:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth}));
 assert.notEqual(focus.style,'none');assert(parseFloat(focus.width)>=2);
 return inputs;
}
async function axeCheck(page,label){
 await page.addScriptTag({path:'/Users/tim/Code/fhfhockey.com/web/node_modules/axe-core/axe.min.js'});
 const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
 result.axe.push({label,violations});assert.equal(violations.length,0);
}
(async()=>{try{
 checkPins();browser=await chromium.launch({headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
 await context.route('**/*',route=>{if(route.request().url()===url)return route.continue();result.externalRequests.push(route.request().url());return route.abort();});
 const page=await context.newPage();page.on('pageerror',e=>result.pageErrors.push(String(e)));await page.goto(url);
 assert.equal(await page.locator('#load-error').isHidden(),true);
 assert.match(await page.locator('#gs-input-summary').innerText(),/280 of 3461/);
 const data=JSON.parse(fs.readFileSync(path.join(source,'DISPLAY-DATA.json')));assert.deepEqual(JSON.parse(await page.locator('#payload').textContent()),data);
 const ekblad=data.profiles.find(p=>p.name==='Aaron Ekblad');const eg=ekblad.games.find(g=>!g.savedGameScoreInputs.complete);assert(eg);
 const inputs=await open(page,ekblad.name,eg.sourceId);assert.equal(await inputs.locator('summary').innerText(),'Saved Game Score inputs: 11 of 17 present');
 assert.equal(await inputs.locator('[data-state="missing"]').count(),6);
 for(const node of await inputs.locator('[data-state="missing"] dd').all())assert.equal(await node.innerText(),'Unavailable — saved null');
 assert.match(await inputs.innerText(),/No missing value is treated as zero/);
 assert.match(await inputs.innerText(),/0 — observed zero/);assert.equal(ekblad.gameScore.total,null);
 result.checks.push({player:ekblad.name,sourceId:eg.sourceId,missing:6,observed:11,keyboardSequentialTabToInnerDisclosure:true});
 fs.writeFileSync(path.join(out,'ACCESSIBILITY-TREE.txt'),await inputs.ariaSnapshot());
 await inputs.screenshot({path:path.join(out,'desktop.png')});await axeCheck(page,'desktop');
 await page.setViewportSize({width:320,height:900});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await inputs.screenshot({path:path.join(out,'narrow.png')});await axeCheck(page,'320px');
 await page.setViewportSize({width:1280,height:1000});await page.addStyleTag({content:'html{font-size:200%}'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await inputs.screenshot({path:path.join(out,'text200.png')});
 await page.keyboard.press('Escape');assert.equal(await page.locator(':focus').innerText(),`Details for ${ekblad.name}`);assert(await page.locator('#detail').isHidden());
 await page.reload();const zero=data.profiles.find(p=>p.name==='Andreas Englund');const zg=zero.games.find(g=>g.savedGameScoreInputs.complete);assert.equal(zero.shots,0);
 const zi=await open(page,zero.name,zg.sourceId);assert.equal(await zi.locator('[data-operand="shots"] dd').innerText(),'0 — observed zero');
 assert.match(await zi.innerText(),/Presence alone does not verify their source or qualify a score/);assert.equal(zero.gameScore.total,null);
 result.checks.push({player:zero.name,sourceId:zg.sourceId,shots:0,observed:17,score:null});await page.keyboard.press('Escape');
 const fo=data.profiles.find(p=>p.name==='Christian Dvorak');const fg=fo.games.find(g=>g.sourceId===5599478);assert(fg);
 await open(page,fo.name,fg.sourceId);assert.match(await page.locator('#detail').innerText(),/faceoff wins 13 captured \/ 12 in retained events; losses 4 \/ 5/);
 result.checks.push({player:fo.name,sourceId:fg.sourceId,capturedFaceoffs:'13/4',eventFaceoffs:'12/5',differenceRetained:true});
 assert.equal(result.externalRequests.length,0);assert.equal(result.pageErrors.length,0);checkPins();
 result.state='PASS';result.notVerified=['Real screen-reader speech','Actual browser zoom (200% text resize tested)','Other browser engines','Unchanged pagination runtime (handler bytes authenticated)'];
 }catch(e){result.state='FAILED';result.failure=String(e.stack||e);process.exitCode=1;}
 finally{if(browser)await browser.close();result.browserClosed=true;fs.writeFileSync(path.join(out,'RESULT.json'),JSON.stringify(result,null,2)+'\n');assert.deepEqual(JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))),owner);fs.renameSync(lock,path.join(out,'RELEASED-LOCK'));console.log(JSON.stringify(result));}})();
