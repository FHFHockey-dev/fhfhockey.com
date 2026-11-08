import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(path.resolve(here,'../../../../web/package.json'));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const blocked=[];
await context.route(/^https?:/,route=>route.request().url().startsWith('http://127.0.0.1:3125/')?route.continue():(blocked.push(route.request().url()),route.abort()));
try {
 const page=await context.newPage();
 const url='http://127.0.0.1:3125/player-cards/compositions?checkpoint=inspect-prior02';
 const response=await page.goto(url);await page.locator('img').last().waitFor();await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
 const body=await response.body();
 await page.screenshot({path:path.join(here,'served-prior02-desktop.png'),fullPage:true});
 const images=await page.locator('img').evaluateAll(ns=>ns.map(n=>({alt:n.alt,width:n.naturalWidth,height:n.naturalHeight,src:n.src})));
 const receipt={url,httpStatus:response.status(),bytes:body.length,sha256:createHash('sha256').update(body).digest('hex'),title:await page.title(),headings:await page.locator('h2').allTextContents(),images:images.map(i=>({...i,src:undefined,pngSha256:createHash('sha256').update(Buffer.from(i.src.split(',')[1],'base64')).digest('hex')})),blocked};
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(here,'served-prior02-phone.png'),fullPage:true});
 await writeFile(path.join(here,'SERVED-PRIOR02-INSPECTION.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{await browser.close();}
