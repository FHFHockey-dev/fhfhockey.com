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
 await page.getByLabel('Player',{exact:true}).selectOption('fixture');
 for(const visual of ['bars','radar']) {await page.getByLabel('Category display',{exact:true}).selectOption(visual);const [e]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download analysis PNG',exact:true}).click()]);await e.saveAs(path.join(here,`synthetic-${visual}.png`));assert.match(await svg.textContent(),/SCORING/);assert.match(await svg.textContent(),/PERIPHERALS/);}
 for(const width of [320,390,1440]) {await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await writeFile(path.join(here,'VISUAL-FINAL.json'),JSON.stringify({scoringAndPeripheralGroups:true,widths:[320,390,1440],requests,errors},null,2)+'\n');console.log('Final grouped categories verified');
} finally {await browser.close();}
