import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)), require=createRequire(path.resolve(here,'../../../web/package.json'));
const {chromium}=require('@playwright/test'), sharp=require('sharp'), sha=b=>createHash('sha256').update(b).digest('hex');
const checks=[],requests=[],errors=[],exports=[];
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true,timeout:10000});
try {
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1050}});
 await context.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(here,'preview.html')).href);
 const svg=page.locator('svg[data-analysis-key]');await svg.waitFor();
 async function download(label,file){const [e]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:label,exact:true}).click()]);await e.saveAs(path.join(here,file));return readFile(path.join(here,file));}
 await page.getByLabel('Player',{exact:true}).selectOption('shared-goalie');
 const details=page.getByLabel('Readable card details');
 assert.match(await details.innerText(),/goalie-inventory-v1/);
 assert.match(await details.innerText(),/6 in 10 team games; 1 relief appearances/);
 assert.match(await details.innerText(),/not start probability/);
 assert.equal(await svg.locator('[data-evidence-truncated="true"]').count(),0);
 const png=await download('Download analysis PNG','shared-goalie.png');
 const meta=await sharp(png).metadata();assert.equal(meta.width,1200);assert.equal(meta.height,1020);
 const manifest=JSON.parse(await download('Download analysis manifest','shared-goalie-manifest.json'));
 assert.equal(manifest.presentation.goalie.sharedProvenance.version,'goalie-inventory-v1');
 assert.equal(manifest.presentation.goalie.games[0].dimensions.length,12);
 await page.setViewportSize({width:320,height:960});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:path.join(here,'shared-goalie-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 await writeFile(path.join(here,'SHARED-GOALIE-BROWSER.json'),JSON.stringify({sharedContract:'goalie-inventory-v1',dimensions:12,completeDimensionText:true,provenanceInReadableDetailsAndManifest:true,png:{width:1200,height:1020,sha256:sha(png)},mobileWidth:320,horizontalOverflow:false,requests,errors},null,2)+'\n');
 console.log('Frozen shared goalie fixture PNG/manifest/mobile verified');
} finally {await browser.close();}
