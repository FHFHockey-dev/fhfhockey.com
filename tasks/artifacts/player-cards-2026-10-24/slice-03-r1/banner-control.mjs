import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(path.resolve(here,'../../../../web/package.json'));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({executablePath:'/Applications/Chromium.app/Contents/MacOS/Chromium',headless:true});
const context=await browser.newContext(),network=[],errors=[];
await context.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});await context.setOffline(true);
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(pathToFileURL(path.join(here,'preview.html')).href+'?mode=calendar&start=2026-10-01&end=2026-10-01&strength=pp');
 await page.locator('svg').waitFor();
 const banner=await page.getByRole('status').textContent(),svg=await page.locator('svg').textContent();
 assert.match(banner,/undefined/i);assert.doesNotMatch(banner,/Partial source/);assert.ok(svg.includes('Undefined · zero denominator'));assert.ok(svg.includes('1 GP · 0.0 min TOI'));
 assert.equal(network.length,0);assert.equal(errors.length,0);
 await writeFile(path.join(here,'banner-before-export.json'),JSON.stringify({passed:true,banner,svg,measuredBeforeAnyExport:true,network,errors},null,2)+'\n');
 console.log('PASS: complete zero-exposure banner measured before any export');
}finally{await browser.close();}
