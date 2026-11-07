import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(path.resolve(here,'../../../../web/package.json'));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true});
const attempts=[];
try{
 const context=await browser.newContext({viewport:{width:1264,height:1500}});
 await context.route(/^https?:/,r=>r.request().url().startsWith('http://127.0.0.1:3125/')?r.continue():(attempts.push(r.request().url()),r.abort()));
 const page=await context.newPage();
 const response=await page.goto('http://127.0.0.1:3125/player-cards/studio?diagnostic=before05');
 const bytes=await response.body();
 await page.getByLabel('Reviewed artwork').selectOption('8478864');await page.getByLabel('Portrait style').selectOption('posterized-team-colors');
 await page.waitForFunction(()=>document.querySelector('svg[data-portrait-key]')?.dataset.portraitKey.startsWith('posterized-team-colors:'));
 const result=await page.evaluate(async()=>{
  const full=document.querySelector('svg[data-share-format]'),logo=full.querySelector('[data-team-logo]'),hero=full.querySelector('[data-hero-image]');
  const ns='http://www.w3.org/2000/svg';
  async function raster(node){
   const src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(node))));
   const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=338;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,1200,338);return{canvas,ctx,rgba:ctx.getImageData(0,0,1200,338).data};
  }
  function layer(node){const svg=document.createElementNS(ns,'svg');svg.setAttribute('xmlns',ns);svg.setAttribute('width','1200');svg.setAttribute('height','338');svg.setAttribute('viewBox','0 0 1200 338');full.querySelectorAll('defs').forEach(d=>svg.append(d.cloneNode(true)));const g=document.createElementNS(ns,'g');g.setAttribute('clip-path',logo.parentElement.getAttribute('clip-path'));g.append(node.cloneNode(true));svg.append(g);return svg;}
  const logoLayer=await raster(layer(logo)),heroLayer=await raster(layer(hero));let fadePixels=0,covered=0,visibleAlpha=0;
  for(let y=0;y<299;y++)for(let x=840;x<960;x++){const i=(y*1200+x)*4;if(logoLayer.rgba[i+3]>32){fadePixels++;if(heroLayer.rgba[i+3]>=128)covered++;else visibleAlpha++;}}
  const cropped=full.cloneNode(true);cropped.setAttribute('height','338');cropped.setAttribute('viewBox','0 0 1200 338');const fullLayer=await raster(cropped);
  const checker=document.createElement('canvas');checker.width=1200;checker.height=338;const c=checker.getContext('2d');for(let y=0;y<338;y+=20)for(let x=0;x<1200;x+=20){c.fillStyle=(x/20+y/20)%2?'#666':'#bbb';c.fillRect(x,y,20,20);}c.drawImage(logoLayer.canvas,0,0);
  const bounds=n=>Object.fromEntries(['x','y','width','height','preserveAspectRatio'].map(k=>[k,n.getAttribute(k)]));
  return{logoBounds:bounds(logo),heroBounds:bounds(hero),maskStops:[...full.querySelectorAll('linearGradient[id$="logo-fade"] stop')].map(n=>[n.getAttribute('offset'),n.getAttribute('stop-opacity')]),fadeRegionLogoPixels:fadePixels,coveredByPlayer:covered,visibleOutsidePlayer:visibleAlpha,occludedFraction:covered/fadePixels,logoOnly:logoLayer.canvas.toDataURL(),logoChecker:checker.toDataURL(),full:fullLayer.canvas.toDataURL()};
 });
 for(const key of ['logoOnly','logoChecker','full']){await writeFile(path.join(here,'before05-'+key+'.png'),Buffer.from(result[key].split(',')[1],'base64'));delete result[key];}
 await writeFile(path.join(here,'BEFORE-LOGO-DIAGNOSTIC.json'),JSON.stringify({url:response.url(),responseSha256:createHash('sha256').update(bytes).digest('hex'),...result,externalAttempts:attempts},null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
