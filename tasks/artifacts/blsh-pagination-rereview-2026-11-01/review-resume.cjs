const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');const {chromium}=require('/Users/tim/Code/fhfhockey.com/web/node_modules/@playwright/test');
const original='/Users/tim/Documents/Codex/2026-10-27/task-3/current-evidence-visual-candidate-20261101-01';
const fixed=path.join(original,'pagination-focus-fix-01');const subdir=process.argv[2];if(subdir)assert(/^runtime-\d{2}$/.test(subdir));const output=subdir?path.join(__dirname,subdir):__dirname;if(subdir)fs.mkdirSync(output);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pins={};function pin(p,h){const actual=digest(p);if(h)assert.equal(actual,h,p);if(pins[p])assert.equal(actual,pins[p],p);pins[p]=actual;}
function pinMap(obj){for(const[p,h]of Object.entries(obj))pin(p,h);}
const result={externalRequests:[],pageErrors:[],scenarios:[],axe:[]};let browser;
const lock='/private/tmp/fhfh-heavy.lock';const owner={owner:'codex-blsh-pagination-focused-rereview',pid:process.pid};
fs.mkdirSync(lock);fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify(owner));
const urls=[pathToFileURL(path.join(original,'candidate.html')).href,pathToFileURL(path.join(fixed,'candidate-v2.html')).href];
const oldHandler="$('load-more').addEventListener('click',()=>{limit+=25;render();if($('load-more').hidden)$('result-status').scrollIntoView();});";
const newHandler="$('load-more').addEventListener('click',()=>{const previousCount=$('players').children.length;limit+=25;render();const firstNew=$('players').children[previousCount];if(firstNew){const heading=firstNew.querySelector('h3');heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});firstNew.scrollIntoView({block:'start'});}});";
async function axe(page,label){await page.addScriptTag({path:'/Users/tim/Code/fhfhockey.com/web/node_modules/axe-core/axe.min.js'});const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})));result.axe.push({label,violations});assert.equal(violations.length,0);}
async function continueAt(page,index,expectedName){
 const state=await page.evaluate(i=>{const row=document.querySelectorAll('#players>li')[i],heading=row.querySelector('h3');return{focused:document.activeElement===heading,tag:document.activeElement.tagName,name:heading.textContent,tabindex:heading.getAttribute('tabindex'),rowTop:row.getBoundingClientRect().top,headingTop:heading.getBoundingClientRect().top,headingBottom:heading.getBoundingClientRect().bottom,viewport:innerHeight,outlineStyle:getComputedStyle(heading).outlineStyle,outlineWidth:getComputedStyle(heading).outlineWidth};},index);
 assert(state.focused);assert.equal(state.name,expectedName);assert.equal(state.tag,'H3');assert.equal(state.tabindex,'-1');assert(state.rowTop>=-1&&state.rowTop<state.viewport);assert(state.headingTop>=0&&state.headingBottom<=state.viewport);assert.notEqual(state.outlineStyle,'none');assert(parseFloat(state.outlineWidth)>=2);
 await page.keyboard.press('Tab');state.nextTab=await page.locator(':focus').innerText();assert.equal(state.nextTab,`Details for ${expectedName}`);return state;
}
(async()=>{try{
 pin(path.join(fixed,'FINAL-RECEIPT.json'),'541bd1accd9c8cf45b24d0daf9f0573271c37dcdae39cc510d197da27062f1d6');
 const final=read(path.join(fixed,'FINAL-RECEIPT.json'));pinMap(final.files);pinMap(final.sharedSourcePins);pinMap(read(path.join(fixed,'INPUT-PINS.json')));
 const oldFinal=read(path.join(original,'FINAL-RECEIPT.json'));pin(path.join(original,'FINAL-RECEIPT.json'));pinMap(oldFinal.files);pinMap(oldFinal.sharedSourcePins);
 const oldHtml=fs.readFileSync(path.join(original,'candidate.html'),'utf8'),newHtml=fs.readFileSync(path.join(fixed,'candidate-v2.html'),'utf8');
 const oldTemplate=fs.readFileSync(path.join(original,'template.html'),'utf8'),newTemplate=fs.readFileSync(path.join(fixed,'template.html'),'utf8');
 assert.equal(oldTemplate.split(oldHandler).length,2);assert.equal(newTemplate,oldTemplate.replace(oldHandler,newHandler));assert.equal(newHtml,oldHtml.replace(oldHandler,newHandler));
 const payload=html=>html.match(/<script id="payload" type="application\/json">([\s\S]*?)<\/script>/)[1];assert.equal(payload(oldHtml),payload(newHtml));
 const data=JSON.parse(payload(newHtml));assert.deepEqual(data,read(path.join(original,'DISPLAY-DATA.json')));assert.deepEqual(data.totals,{players:740,selectedRecords:3461,fpWindows:482,unresolvedPPP:212,zeroShotWindows:20});
 result.staticVerification={onlyExactPaginationHandlerChanged:true,embeddedDataByteIdentical:true,totals:data.totals,scoreAdmission:data.scoreAdmission};assert.equal(data.scoreAdmission,false);
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.route('**/*',route=>{if(urls.includes(route.request().url()))return route.continue();result.externalRequests.push(route.request().url());return route.abort();});
 const page=await context.newPage();page.on('pageerror',e=>result.pageErrors.push(String(e)));const more=page.locator('#load-more');
 if(!process.argv.includes('--resume')){await page.goto(urls[0]);while(await page.locator('#players>li').count()<725)await more.click();await more.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#players>li').count(),740);
 result.original=await page.evaluate(()=>({focusTag:document.activeElement.tagName,focusId:document.activeElement.id,statusTop:document.getElementById('result-status').getBoundingClientRect().top,firstNewTop:document.querySelectorAll('#players>li')[725].getBoundingClientRect().top}));assert.equal(result.original.focusTag,'BODY');await page.keyboard.press('Tab');result.original.nextTab=await page.locator(':focus').innerText();assert.equal(result.original.nextTab,'Details for A.J. Greer');}else{result.resumedAfterOriginalAndDesktopFullPass=true;}
 await page.goto(urls[1]);
 const search=data.profiles.filter(p=>p.name.toLowerCase().includes('x'));assert.equal(search.length,35);
 const cases=[{key:'all',filter:'all',profiles:data.profiles},{key:'checked',filter:'checked',profiles:data.profiles.filter(p=>p.fp.allSelectedCountsAndExposureMatched)},{key:'review',filter:'review',profiles:data.profiles.filter(p=>!p.fp.allSelectedCountsAndExposureMatched)},{key:'search-x',filter:'all',query:'x',profiles:search}];
 for(const width of [1440,320]){
  await page.setViewportSize({width,height:width===320?900:1000});
  for(const item of cases){
   if(process.argv.includes('--resume')&&width===1440&&item.key==='all')continue;
   await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.getByRole('combobox',{name:'Evidence view',exact:true}).selectOption(item.filter);if(item.query)await page.getByRole('searchbox',{name:'Find a player',exact:true}).fill(item.query);
   assert.equal(await page.locator('#players>li').count(),25);const lastIndex=25*Math.floor((item.profiles.length-1)/25);let intermediate;
   while(await page.locator('#players>li').count()<lastIndex){const before=await page.locator('#players>li').count();await more.focus();await page.keyboard.press('Enter');if(before===25)intermediate=await continueAt(page,25,item.profiles[25].name);}
   assert.equal(await page.locator('#players>li').count(),lastIndex);await more.focus();await page.keyboard.press('Enter');assert(await more.isHidden());assert.equal(await page.locator('#players>li').count(),item.profiles.length);
   const finalFocus=await continueAt(page,lastIndex,item.profiles[lastIndex].name);const dimensions=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth}));assert(dimensions.document<=dimensions.width);
   await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'detail-heading');await page.keyboard.press('Escape');assert.equal(await page.locator(':focus').innerText(),`Details for ${item.profiles[lastIndex].name}`);
   result.scenarios.push({width,filter:item.key,count:item.profiles.length,finalIndex:lastIndex,intermediate,finalFocus,detailReturnFocus:true,dimensions});
   if(item.key==='search-x'){await page.screenshot({path:path.join(output,`final-${width}.png`)});await axe(page,`final-search-${width}`);}
   console.log(JSON.stringify({width,filter:item.key,records:item.profiles.length,finalFocus:'passed',nextTab:'passed'}));
  }
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();assert.equal(await page.locator(':focus').getAttribute('id'),'search');await page.getByRole('combobox',{name:'Evidence view',exact:true}).selectOption('zero');assert.equal(await page.locator('#players>li').count(),20);assert(await more.isHidden());
 }
 result.zeroShotViews={desktop:20,narrow:20,paginationHidden:true};assert.equal(result.externalRequests.length,0);assert.equal(result.pageErrors.length,0);
 pinMap(pins);result.authenticatedFiles=Object.keys(pins).length;result.state='PASS_P2_CLOSED';
}catch(error){result.state='FAILED';result.failure=String(error.stack||error);process.exitCode=1;}
finally{if(browser)await browser.close();fs.writeFileSync(path.join(output,'RESULT.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(output,'PINS.json'),JSON.stringify(pins,null,2));assert.deepEqual(read(path.join(lock,'owner.json')),owner);fs.renameSync(lock,path.join(output,'RELEASED-BROWSER-LOCK'));console.log(JSON.stringify({state:result.state,failure:result.failure,scenarios:result.scenarios.length,pins:result.authenticatedFiles}));}})();
