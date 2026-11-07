import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(path.resolve(here,'../../../../web/package.json'));
const {chromium}=require('@playwright/test'),browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true});
const checks=[],attempts=[],errors=[],exports=[];
try {
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1264,height:1500}});await context.setOffline(true);await context.route(/^https?:/,r=>{attempts.push(r.request().url());return r.abort();});
 const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
 const svg=page.locator('svg[data-share-format]'), png=page.getByRole('button',{name:'Download PNG',exact:true});
 async function ready(){await png.waitFor();await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(n=>n.textContent==='Download PNG');return b&&!b.disabled;});}
 async function download(button,name){const control=page.getByRole('button',{name:button,exact:true});if(button==='Download manifest'&&!await control.isVisible())await page.getByText('Card values and provenance',{exact:true}).click();const[event]=await Promise.all([page.waitForEvent('download'),control.click()]);await event.saveAs(path.join(here,name));return readFile(path.join(here,name));}
 const recipe=()=>svg.locator('[data-player-outline]').getAttribute('data-outline-band-widths');
 await page.goto(pathToFileURL(path.join(here,'preview.html')).href);await ready();
 assert.equal(await page.getByLabel('Reviewed artwork').inputValue(),'8478864');assert.equal(await page.getByLabel('Outline color').inputValue(),'custom');
 await page.getByLabel('Portrait style').selectOption('posterized-team-colors');await ready();
 assert.equal(await recipe(),'5>5>5');assert.equal(await svg.locator('[data-player-outline]').getAttribute('data-outline-band-colors'),'#154734>#A6192E>#DDCBA4');
 const baseline=await svg.locator('[data-hero-image]').getAttribute('href'), baselineLogo=await svg.locator('[data-team-logo]').getAttribute('href');
 const oldCount=await page.evaluate(()=>{globalThis.__cardMutations=[];const observer=new MutationObserver(()=>globalThis.__cardMutations.push(document.querySelector('svg[data-share-format]')?.dataset.outlineKey));observer.observe(document.querySelector('[aria-label="Player card preview"]'),{childList:true,subtree:true,attributes:true});return 0;});assert.equal(oldCount,0);
 // Keyboard activation: stable ring identity survives order changes and receives focus.
 await page.getByRole('button',{name:'Move ring 1 outward',exact:true}).focus();await page.keyboard.press('Enter');await ready();
 assert.equal(await svg.locator('[data-player-outline]').getAttribute('data-outline-band-colors'),'#A6192E>#154734>#DDCBA4');
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Ring 2 color');
 await page.getByLabel('Ring 2 width').fill('7.5');await page.getByLabel('Ring 2 width').fill('9');await page.getByLabel('Ring 2 width').fill('7.5');assert.equal(await png.isDisabled(),true);await ready();assert.equal(await recipe(),'5>7.5>5');
 await page.getByRole('button',{name:'Add outline',exact:true}).click();await page.getByLabel('Ring 4 width').fill('2');await page.getByLabel('Ring 4 color',{exact:true}).selectOption('custom');await page.getByLabel('Ring 4 custom color').fill('#123456');await ready();assert.equal(await recipe(),'5>7.5>5>2');
 await page.getByRole('button',{name:'Remove ring 3',exact:true}).click();await ready();assert.equal(await recipe(),'5>7.5>2');
 const colors='#A6192E>#154734>#123456';assert.equal(await svg.locator('[data-player-outline]').getAttribute('data-outline-band-colors'),colors);
 checks.push('Keyboard reorder keeps whole ring/focus; repeated widths debounce, add/remove and native custom color produce exact ordered variable recipe');
 // Native raster control: 2px inner green, 7px middle red, 3px outer tan, using actual same function.
 const native=await page.evaluate(async()=>{const size=200,d=new Uint8ClampedArray(size*size*4);for(let y=40;y<160;y++)for(let x=80;x<160;x++)d[(y*size+x)*4+3]=255;const r=[{color:'#154734',width:2},{color:'#A6192E',width:7},{color:'#DDCBA4',width:3}],out=globalThis.__outlineBandPixels(d,size,size,r),c=document.createElement('canvas');c.width=size;c.height=size;const ctx=c.getContext('2d');ctx.putImageData(new ImageData(out,size,size),0,0);const im=new Image();im.src='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><image href="'+c.toDataURL()+'" width="100" height="100"/></svg>');await im.decode();c.width=100;c.height=100;ctx.drawImage(im,0,0);const p=ctx.getImageData(0,0,100,100).data;return Array.from({length:14},(_,i)=>[...p.slice((50*100+27+i)*4,(50*100+27+i)*4+4)]);});
 assert.deepEqual(native,[[0,0,0,0],...Array(3).fill([221,203,164,255]),...Array(7).fill([166,25,46,255]),...Array(2).fill([21,71,52,255]),[0,0,0,0]]);
 for(const style of ['posterized-team-colors','pixelated-team-colors']){
  await page.getByLabel('Portrait style').selectOption(style);await ready();
  assert.deepEqual(await svg.locator('image').evaluateAll(ns=>ns.map(n=>n.hasAttribute('data-team-logo')?'logo':n.hasAttribute('data-player-outline')?'bands':'player')),['logo','bands','player']);
  assert.deepEqual(await svg.locator('[data-hero-image]').evaluate(n=>['x','y','width','height'].map(k=>n.getAttribute(k))),['600','4','600','337.5']);assert.equal(await svg.locator('[data-team-logo]').getAttribute('x'),'840');
  const manifest=JSON.parse((await download('Download manifest',style+'-manifest.json')).toString());assert.deepEqual(manifest.artwork.outlineSettings,[{color:'#A6192E',width:5},{color:'#154734',width:7.5},{color:'#123456',width:2}]);assert.deepEqual(manifest.artwork.outline.rings,manifest.artwork.outlineSettings);assert.equal(manifest.artwork.outline.thickness,14.5);assert.equal(manifest.artwork.outline.padding,30);
  const src=await svg.locator('[data-player-outline]').getAttribute('href'),bytes=Buffer.from(src.split(',')[1],'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.artwork.outline.sha256);
  const file=await download('Download PNG',style+'-card.png');assert.deepEqual([file.readUInt32BE(16),file.readUInt32BE(20)],[1200,1020]);await page.getByRole('button',{name:'Social Share',exact:true}).click();await page.getByRole('button',{name:'Share prepared image',exact:true}).waitFor();await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));assert.deepEqual(await download('Share prepared image',style+'-share.png'),file);
  await svg.screenshot({path:path.join(here,style+'-preview.png')});exports.push({style,pngSha256:createHash('sha256').update(file).digest('hex'),recipe:manifest.artwork.outlineSettings});
 }
 checks.push('Native SVG 2/7/3px control; both combined styles keep geometry/logo and one true-contour asset; PNG/manifest/share bytes match');
 // A prepared share must disappear immediately, including invalid width edits.
 await page.getByLabel('Ring 1 width').fill('');assert.equal(await png.isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Share prepared image',exact:true}).count(),0);await page.getByRole('alert').waitFor();
 await page.getByRole('button',{name:'Reset team stack',exact:true}).click();await ready();assert.equal(await recipe(),'5>5>5');
 await page.getByRole('button',{name:'Add outline',exact:true}).click();await page.getByRole('button',{name:'Add outline',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Add outline',exact:true}).isDisabled(),true);
 for(const i of [1,2,3,4])await page.getByLabel(`Ring ${i} width`).fill('12');await page.getByRole('alert').waitFor();assert.equal(await png.isDisabled(),true);
 for(let n=5;n>0;n--)await page.getByRole('button',{name:`Remove ring ${n}`,exact:true}).click();await ready();assert.equal(await svg.locator('[data-player-outline]').count(),0);assert.equal(await svg.getAttribute('data-outline-settings'),'[]');await download('Download PNG','no-outline-card.png');
 await page.getByRole('button',{name:'Reset team stack',exact:true}).click();await ready();await page.getByLabel('Portrait style').selectOption('posterized-team-colors');await ready();
 assert.equal(await svg.locator('[data-hero-image]').getAttribute('href'),baseline);assert.equal(await svg.locator('[data-team-logo]').getAttribute('href'),baselineLogo);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(here,'editor-phone.png'),fullPage:true});await page.setViewportSize({width:1264,height:1500});await page.screenshot({path:path.join(here,'editor-desktop.png'),fullPage:true});
 checks.push('Invalid/pending edits invalidate prepared sharing; 5-ring/40px bounds; zero-ring export and reset; original portrait/logo preserved; phone has no horizontal overflow');
 assert.deepEqual(attempts,[]);assert.deepEqual(errors,[]);const result={checks,exports,native,externalAttempts:attempts,pageErrors:errors,liveActivation:false};await writeFile(path.join(here,'browser-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
