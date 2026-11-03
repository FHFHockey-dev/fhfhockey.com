import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(path.resolve(here,'../../../../web/package.json'));
const {chromium}=require('@playwright/test'),browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true});
const checks=[],exports=[],attempts=[],errors=[];
try{
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1264,height:1500}});await context.setOffline(true);await context.route(/^https?:/,r=>{attempts.push(r.request().url());return r.abort();});
 const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 const svg=page.locator('svg[data-share-format]');
 async function ready(style,ink){await page.waitForFunction(({style,ink})=>{const s=document.querySelector('svg[data-share-format]');return s?.dataset.portraitKey.startsWith(style+':')&&s.dataset.outlineKey.includes(':'+ink+':');},{style,ink});assert.equal(await page.getByRole('button',{name:'Download PNG',exact:true}).isEnabled(),true);}
 async function download(button,name){const control=page.getByRole('button',{name:button,exact:true});if(button==='Download manifest'&&!await control.isVisible())await page.getByText('Card values and provenance',{exact:true}).click();const[event]=await Promise.all([page.waitForEvent('download'),control.click()]);await event.saveAs(path.join(here,name));return readFile(path.join(here,name));}
 await page.goto(pathToFileURL(path.join(here,'preview.html')).href);await ready('team-colors','white');await page.getByLabel('Reviewed artwork').selectOption('8478864');await page.waitForFunction(()=>document.querySelector('svg[data-share-format]')?.dataset.snapshotId.startsWith('art-study-8478864'));await ready('team-colors','white');
 assert.deepEqual(await page.getByLabel('Outline color').locator('option').evaluateAll(ns=>ns.map(n=>n.value)),['white','primary','jersey','secondary','stacked']);
 const bands=await page.evaluate(()=>{const p=globalThis.__cardTeamsInfo.MIN;return[p.primaryColor,p.jersey,p.secondaryColor];});assert.deepEqual(bands,['#154734','#A6192E','#DDCBA4']);
 const nativeBands=await page.evaluate(async colors=>{
  const size=200,pixels=new Uint8ClampedArray(size*size*4);for(let y=40;y<160;y++)for(let x=80;x<160;x++)pixels[(y*size+x)*4+3]=255;
  const out=globalThis.__stackedOutlinePixels(pixels,size,size,colors),c=document.createElement('canvas');c.width=size;c.height=size;const ctx=c.getContext('2d');ctx.putImageData(new ImageData(out,size,size),0,0);
  const image=new Image();image.src='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><image href="'+c.toDataURL()+'" width="100" height="100"/></svg>');await image.decode();c.width=100;c.height=100;ctx.drawImage(image,0,0);const d=ctx.getImageData(0,0,100,100).data;return Array.from({length:17},(_,i)=>[...d.slice((50*100+24+i)*4,(50*100+24+i)*4+4)]);
 },bands);
 assert.deepEqual(nativeBands,[[0,0,0,0],...Array(5).fill([221,203,164,255]),...Array(5).fill([166,25,46,255]),...Array(5).fill([21,71,52,255]),[0,0,0,0]]);
 checks.push('Actual native SVG raster: exactly5tan+5red+5green design pixels outward;15px total with transparent exterior/interior');
 await page.getByLabel('Outline color').selectOption('stacked');await ready('team-colors','stacked');let referenceSnapshot;
 for(const style of ['posterized-team-colors','pixelated-team-colors']){
  await page.getByLabel('Portrait style').selectOption(style);await ready(style,'stacked');
  assert.equal(await svg.locator('[data-player-outline]').count(),1);assert.equal(await svg.locator('image').count(),3);assert.deepEqual(await svg.locator('image').evaluateAll(ns=>ns.map(n=>n.hasAttribute('data-team-logo')?'logo':n.hasAttribute('data-player-outline')?'bands':'player')),['logo','bands','player']);
  const ring=svg.locator('[data-player-outline]');assert.deepEqual(await ring.evaluate(n=>['x','y','width','height','data-outline-width','data-outline-band-width'].map(k=>n.getAttribute(k))),['584.5','-11.5','631','368.5','15','5']);assert.equal(await ring.getAttribute('data-outline-band-colors'),bands.join('>'));
  assert.deepEqual(await svg.locator('[data-hero-image]').evaluate(n=>['x','y','width','height'].map(k=>n.getAttribute(k))),['600','4','600','337.5']);assert.equal(await svg.locator('[data-team-logo]').getAttribute('x'),'840');
  const manifest=JSON.parse((await download('Download manifest',style+'-manifest.json')).toString());assert.equal(manifest.artwork.outline.thickness,15);assert.equal(manifest.artwork.outline.bandWidth,5);assert.deepEqual(manifest.artwork.outline.bands,bands);assert.equal(manifest.artwork.outline.padding,31);
  const old=JSON.parse(await readFile(path.join(here,'../outline-06/'+style+'-manifest.json')));assert.deepEqual(manifest.artwork.treatment,old.artwork.treatment);if(referenceSnapshot)assert.deepEqual(manifest.snapshot,referenceSnapshot);else referenceSnapshot=manifest.snapshot;
  const src=await ring.getAttribute('href'),bytes=Buffer.from(src.split(',')[1],'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.artwork.outline.sha256);await writeFile(path.join(here,style+'-bands.png'),bytes);
  const asset=await page.evaluate(async({src,colors})=>{const image=new Image();image.src=src;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;let edge=0,aa=0;const counts=[0,0,0],rgb=colors.map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,a=d[i+3];if(x===0||y===0||x===c.width-1||y===c.height-1)edge+=a;if(a>0&&a<255)aa++;if(a===255)rgb.forEach((color,j)=>{if(color.every((v,k)=>d[i+k]===v))counts[j]++;});}return{edge,aa,counts};},{src,colors:bands});assert.equal(asset.edge,0);assert.ok(asset.aa>0);assert.ok(asset.counts.every(count=>count>1000));
  const png=await download('Download PNG',style+'-card.png');assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1200,1020]);await page.getByRole('button',{name:'Social Share',exact:true}).click();await page.getByRole('button',{name:'Share prepared image',exact:true}).waitFor();await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));assert.deepEqual(await download('Share prepared image',style+'-share.png'),png);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(here,style+'-phone.png'),fullPage:true});await page.setViewportSize({width:1264,height:1500});exports.push({style,pngSha256:createHash('sha256').update(png).digest('hex'),bandAssetSha256:manifest.artwork.outline.sha256,bandColors:bands,bandWidths:[5,5,5],totalWidth:15,assetStats:asset});
 }
 assert.equal(exports[0].bandAssetSha256,exports[1].bandAssetSha256);checks.push('Both portrait treatments: one disjoint-band asset above unchanged logo/below unchanged player; three source colors present, paddedtransparentedges/AA, stagehashes/PNGmanifestshareparity and390px');
 await page.getByLabel('Portrait style').selectOption('posterized-team-colors');await ready('posterized-team-colors','stacked');await page.getByLabel('Outline color').selectOption('white');await ready('posterized-team-colors','white');assert.equal(await svg.locator('[data-player-outline]').getAttribute('data-outline-width'),'5');await download('Download PNG','preserved-white-card.png');
 await page.getByLabel('Outline color').selectOption('jersey');await ready('posterized-team-colors','jersey');assert.equal(await svg.locator('[data-player-outline]').getAttribute('data-outline-width'),'5');
 checks.push('White and separatecoloroptions retained as single5pxrings; prepared files invalidated; unchanged headerclip deliberately trims15pxbandextent near frame without movingplayer');assert.deepEqual(attempts,[]);assert.deepEqual(errors,[]);
 const result={checks,exports,nativeBands,externalAttempts:attempts,pageErrors:errors,liveActivation:false};await writeFile(path.join(here,'browser-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
