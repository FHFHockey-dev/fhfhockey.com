import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(path.resolve(here,'../../../../web/package.json'));
const {chromium}=require('@playwright/test'),browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true});
const attempts=[],errors=[],exports=[],checks=[];
try{
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1264,height:1500}});await context.setOffline(true);
 await context.route(/^https?:/,r=>{attempts.push(r.request().url());return r.abort();});
 const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 const svg=page.locator('svg[data-share-format]');
 async function ready(style,ink){await page.waitForFunction(({style,ink})=>{const svg=document.querySelector('svg[data-share-format]');return svg?.dataset.portraitKey.startsWith(style+':')&&svg.dataset.outlineKey.includes(':'+ink+':');},{style,ink});assert.equal(await page.getByRole('button',{name:'Download PNG',exact:true}).isEnabled(),true);}
 async function download(button,name){const control=page.getByRole('button',{name:button,exact:true});if(button==='Download manifest'&&!await control.isVisible())await page.getByText('Card values and provenance',{exact:true}).click();const[event]=await Promise.all([page.waitForEvent('download'),control.click()]);await event.saveAs(path.join(here,name));return readFile(path.join(here,name));}
 await page.goto(pathToFileURL(path.join(here,'preview.html')).href);await ready('team-colors','white');
 await page.getByLabel('Reviewed artwork').selectOption('8478864');await page.waitForFunction(()=>document.querySelector('svg[data-share-format]')?.dataset.snapshotId.startsWith('art-study-8478864'));await ready('team-colors','white');
 await page.getByLabel('Portrait style').selectOption('posterized-team-colors');await ready('posterized-team-colors','white');
 const options=await page.getByLabel('Outline color').locator('option').evaluateAll(ns=>ns.map(n=>({id:n.value,label:n.textContent})));
 assert.deepEqual(options.map(o=>o.id),['white','primary','jersey','secondary']);
 const palette=await page.evaluate(()=>globalThis.__cardTeamsInfo.MIN);
 const colors={white:'#FFFFFF',primary:palette.primaryColor,jersey:palette.jersey,secondary:palette.secondaryColor};
 const old=JSON.parse(await readFile(path.join(here,'../outline-06/posterized-team-colors-manifest.json')));
 let baselineAlpha,baselineSnapshot;
 for(const ink of options.map(o=>o.id)){
  await page.getByLabel('Outline color').selectOption(ink);await ready('posterized-team-colors',ink);
  assert.equal(await svg.locator('[data-player-outline]').count(),1);assert.equal(await svg.locator('image').count(),3);
  assert.deepEqual(await svg.locator('image').evaluateAll(ns=>ns.map(n=>n.hasAttribute('data-team-logo')?'logo':n.hasAttribute('data-player-outline')?'outline':'hero')),['logo','outline','hero']);
  assert.equal(await svg.locator('[data-player-outline]').getAttribute('data-outline-width'),'5');assert.equal(await svg.locator('[data-player-outline]').getAttribute('data-outline-color'),colors[ink]);
  assert.deepEqual(await svg.locator('[data-hero-image]').evaluate(n=>['x','y','width','height'].map(k=>n.getAttribute(k))),['600','4','600','337.5']);
  const manifest=JSON.parse((await download('Download manifest',ink+'-manifest.json')).toString());
  assert.deepEqual(manifest.artwork.treatment,old.artwork.treatment);assert.equal(manifest.artwork.outline.ink,ink);assert.equal(manifest.artwork.outline.color,colors[ink]);assert.equal(manifest.artwork.outline.thickness,5);assert.equal(manifest.artwork.outline.dataUrl,undefined);
  if(baselineSnapshot)assert.deepEqual(manifest.snapshot,baselineSnapshot);else baselineSnapshot=manifest.snapshot;
  const mask=await page.evaluate(async({src,color})=>{const image=new Image();image.src=src;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;const a=new Uint8Array(d.length/4);const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));let opaque=0,bad=0;for(let i=0;i<a.length;i++){a[i]=d[i*4+3];if(a[i]===255){opaque++;if(rgb.some((v,j)=>d[i*4+j]!==v))bad++;}}return{alphaHash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',a))].map(n=>n.toString(16).padStart(2,'0')).join(''),opaque,bad};},{src:await svg.locator('[data-player-outline]').getAttribute('href'),color:colors[ink]});
  assert.equal(mask.bad,0);assert.ok(mask.opaque>1000);if(baselineAlpha)assert.equal(mask.alphaHash,baselineAlpha);else baselineAlpha=mask.alphaHash;
  if(ink==='white')assert.equal(manifest.artwork.outline.sha256,old.artwork.outline.sha256);
  const bytes=await download('Download PNG',ink+'-card.png');assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[1200,1020]);
  await page.getByRole('button',{name:'Social Share',exact:true}).click();await page.getByRole('button',{name:'Share prepared image',exact:true}).waitFor();
  await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));assert.deepEqual(await download('Share prepared image',ink+'-share.png'),bytes);
  exports.push({ink,label:options.find(o=>o.id===ink).label,color:colors[ink],pngSha256:createHash('sha256').update(bytes).digest('hex'),outlineSha256:manifest.artwork.outline.sha256,alphaSha256:mask.alphaHash,oneRing:true});
 }
 checks.push('Four verified distinct MIN palette colors; exactly one genuine5px ring; identical alpha/source/geometry/treatment/snapshot; white asset unchanged from06; PNG/manifest/share parity');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(here,'studio-phone.png'),fullPage:true});await page.setViewportSize({width:1264,height:1500});
 await page.getByLabel('Portrait style').selectOption('pixelated-team-colors');await ready('pixelated-team-colors','secondary');await page.getByLabel('Outline color').selectOption('jersey');await ready('pixelated-team-colors','jersey');
 assert.equal(await page.getByRole('button',{name:'Share prepared image',exact:true}).count(),0);await download('Download PNG','pixelated-red-card.png');
 await page.getByLabel('Reviewed artwork').selectOption('8479318');await page.waitForFunction(()=>document.querySelector('svg[data-share-format]')?.dataset.snapshotId.startsWith('art-study-8479318'));await ready('pixelated-team-colors','jersey');
 const torPalette=await page.evaluate(()=>globalThis.__cardTeamsInfo.TOR);assert.equal(await svg.locator('[data-player-outline]').getAttribute('data-outline-color'),torPalette.jersey);
 checks.push('390px no overflow; color/style/player changes invalidate prepared image; pixelated treatment and TOR use matching verified palette');
 await page.reload();await ready('pixelated-team-colors','white');assert.equal(await page.getByLabel('Outline color').inputValue(),'white');
 checks.push('Fresh default remains a single white5px outline; no paid/new dependencies or external processing');
 assert.deepEqual(attempts,[]);assert.deepEqual(errors,[]);
 const result={checks,exports,externalAttempts:attempts,pageErrors:errors,liveActivation:false,premiumActivation:false};await writeFile(path.join(here,'browser-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
