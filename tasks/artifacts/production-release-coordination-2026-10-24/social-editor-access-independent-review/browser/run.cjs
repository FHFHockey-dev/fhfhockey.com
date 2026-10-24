const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');const repo=path.resolve(root,'../../../..');
const {chromium,expect}=require(path.join(repo,'web/node_modules/@playwright/test'));
const origin='https://social-access.fixture.invalid';
const results={status:'running',scope:'Actual AuthProvider + gate + SocialShare + editionFetch, synthetic auth/storage-write stub, style-neutral renderer. No Next server, no live API or Supabase.',checks:[],apiRequests:[],fulfilled:[],aborted:[],pageErrors:[],launches:0};
let browser;
function check(name){results.checks.push({name,passed:true});}
(async()=>{
  results.launches++;
  browser=await chromium.launch({headless:true,args:['--disable-background-networking','--disable-component-update','--disable-default-apps','--no-first-run','--disable-sync','--metrics-recording-only','--disable-domain-reliability']});
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(5000);
  page.on('pageerror',error=>results.pageErrors.push(error.message));
  const holds=[];let holdNext=false;let editionNumber=0;
  await context.route('**/*',async route=>{
    const request=route.request();const url=new URL(request.url());
    if(url.origin!==origin){results.aborted.push(url.href);return route.abort('blockedbyclient');}
    if(url.pathname==='/studio'){results.fulfilled.push(url.pathname);return route.fulfill({contentType:'text/html',headers:{'Cache-Control':'private, no-store, max-age=0'},body:'<!doctype html><html><head><meta charset="utf-8"><title>Offline social access fixture</title></head><body><aside>OFFLINE AUTHORIZATION FIXTURE — synthetic sessions, neutral styles</aside><div id="root"></div><script src="/bundle.js"></script></body></html>'});}
    if(url.pathname==='/bundle.js'){results.fulfilled.push(url.pathname);return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(__dirname,'bundle.js'),'utf8')});}
    if(url.pathname.startsWith('/api/v1/social-share/')){
      const authorization=request.headers().authorization;
      const info={url:url.pathname+url.search,authorization,number:++editionNumber,held:holdNext};results.apiRequests.push(info);
      if(!authorization?.startsWith('Bearer synthetic-'))return route.fulfill({status:401,json:{error:'Fixture credentials denied'},headers:{'Cache-Control':'private, no-store, max-age=0'}});
      const body=await page.evaluate(input=>window.fixture.makeSnapshot(input),url.href);
      body.state='partial';body.reasons=['EDITION_'+authorization.slice('Bearer synthetic-'.length)+'_'+info.number];
      if(holdNext){holdNext=false;await new Promise(resolve=>holds.push({resolve,info}));}
      results.fulfilled.push(info.url);
      return route.fulfill({status:200,json:body,headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Authorization'}}).catch(error=>{info.fulfillError=error.message;});
    }
    if(url.pathname.startsWith('/pictures/')||url.pathname.startsWith('/teamLogos/')){results.fulfilled.push(url.pathname);return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#888"/></svg>'});}
    results.aborted.push(url.href);return route.abort('blockedbyclient');
  });
  await page.clock.install({time:new Date('2026-10-26T12:00:00.000Z')});
  await page.goto(origin+'/studio');
  await expect(page.getByRole('alert')).toHaveText('Sign in with your FHFH social editor account to continue.');
  await expect(page.getByRole('heading',{name:'Weekly schedule',exact:true})).toHaveCount(0);
  expect(results.apiRequests).toHaveLength(0);check('signed-out shell denies workspace and edition read');
  await page.evaluate(()=>window.fixture.setSession('basic',null));
  await expect(page.getByRole('alert')).toHaveText('Social editor access is required to use this studio.');expect(results.apiRequests).toHaveLength(0);check('signed-in non-editor denies workspace and edition read');
  await page.evaluate(()=>window.fixture.setSession('A','social_editor'));
  await expect(page.getByRole('heading',{name:'Weekly schedule',exact:true})).toBeVisible();
  await expect(page.getByText(/Schedule partial: EDITION_A_1/)).toBeVisible();
  expect(results.apiRequests[0].authorization).toBe('Bearer synthetic-A');check('editor mounts actual renderer and sends synthetic bearer');
  await page.screenshot({path:path.join(__dirname,'01-editor.png'),fullPage:true});
  holdNext=true;await page.getByRole('button',{name:'Refresh schedule',exact:true}).click();await expect.poll(()=>holds.length).toBe(1);
  await page.evaluate(()=>window.fixture.setSession('B','social_editor'));
  await expect(page.getByText(/Schedule partial: EDITION_B_3/)).toBeVisible();
  holds.shift().resolve();await expect(page.getByText(/Schedule partial: EDITION_A_2/)).toHaveCount(0);check('account switch resets actual workspace and rejects pending old edition');
  await page.screenshot({path:path.join(__dirname,'02-account-B.png'),fullPage:true});
  holdNext=true;await page.getByRole('button',{name:'Refresh schedule',exact:true}).click();await expect.poll(()=>holds.length).toBe(1);
  await page.evaluate(()=>window.fixture.setSession('B','social_editor','synthetic-B2'));
  await expect(page.getByText(/Schedule partial: EDITION_B2_5/)).toBeVisible();holds.shift().resolve();
  await expect(page.getByText(/Schedule partial: EDITION_B_4/)).toHaveCount(0);check('token refresh resets renderer and rejects pending old-token edition');
  await page.evaluate(()=>window.fixture.setSession('B',null,'synthetic-B2'));
  await expect(page.getByRole('heading',{name:'Weekly schedule',exact:true})).toHaveCount(0);await expect(page.getByRole('alert')).toHaveText('Social editor access is required to use this studio.');check('role revocation unmounts actual renderer');
  await page.evaluate(()=>{window.fixture.deferRole('old');return window.fixture.setSession('old','social_editor');});
  await expect(page.getByRole('status')).toHaveText('Checking share studio access…');
  await page.evaluate(()=>window.fixture.setSession('new',null));
  await page.evaluate(()=>window.fixture.resolveRole('old','social_editor'));
  await expect(page.locator('#fixture-auth')).toHaveText('new:none');expect(results.apiRequests).toHaveLength(5);check('late role grant for prior account cannot reopen workspace');
  await page.evaluate(()=>window.fixture.setSession('C','social_editor'));
  await expect(page.getByText(/Schedule partial: EDITION_C_6/)).toBeVisible();
  await page.locator('#fixture-signout').click();
  await expect(page.getByRole('heading',{name:'Weekly schedule',exact:true})).toHaveCount(0);await expect(page.locator('#fixture-auth')).toHaveText('none:none');check('sign-out immediately removes actual protected workspace');
  await page.screenshot({path:path.join(__dirname,'03-signed-out.png'),fullPage:true});
  expect(results.pageErrors).toEqual([]);check('no uncaught renderer errors');
  results.status='passed';
})().catch(error=>{results.status=browser?'failed':'blocked_browser_launch';results.error={name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();results.screenshots={};for(const name of ['01-editor.png','02-account-B.png','03-signed-out.png']){const file=path.join(__dirname,name);if(fs.existsSync(file))results.screenshots[name]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}fs.writeFileSync(path.join(__dirname,'RESULTS.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({status:results.status,checks:results.checks.length,requests:results.apiRequests.length,aborted:results.aborted.length,error:results.error?.message},null,2));});
