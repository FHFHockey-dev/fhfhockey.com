const { chromium } = require('/Users/tim/Code/fhfhockey.com/web/node_modules/@playwright/test');
const fs = require('node:fs');
const out = '/Users/tim/Code/fhfhockey.com/tasks/artifacts/p07-task10-independent-review-2026-10-22';
(async () => {
  let browser;
  try {
    browser = await chromium.launch({headless:true, args:['--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND']});
    const context = await browser.newContext({offline:true});
    const requests=[];
    await context.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    const page = await context.newPage();
    const html=fs.readFileSync('/Users/tim/Code/fhfhockey.com/tasks/artifacts/task10-display-2026-10-22/grid-fixture.html','utf8');
    const receipts=[];
    for (const width of [700,1100]) {
      await page.setViewportSize({width,height:900});
      await page.setContent(html,{waitUntil:'domcontentloaded'});
      receipts.push({width, expected:await page.locator('[aria-label^="Expected fantasy points:"]').count(), conditional:await page.locator('[aria-label^="Fantasy points if starts:"]').count(), cells:await page.locator('[class="forecastPoints"]').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,text:n.textContent}))) });
      await page.screenshot({path:out+'/browser-'+width+'.png'});
    }
    fs.writeFileSync(out+'/BROWSER.json',JSON.stringify({status:'passed',source:'owner actual-grid static artifact; not application E2E',receipts,abortedRequests:requests},null,2)+'\n');
    console.log(JSON.stringify({status:'passed',widths:[700,1100],abortedRequests:requests.length}));
  } catch(error) {
    fs.writeFileSync(out+'/BROWSER.json',JSON.stringify({status:'blocked',action:'sandbox Chromium launch / offline static grid inspection',reason:String(error)},null,2)+'\n');
    console.error(String(error)); process.exitCode=1;
  } finally {if(browser) await browser.close();}
})();
