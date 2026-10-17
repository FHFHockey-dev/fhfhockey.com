const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { fileURLToPath } = require('node:url');
const root = '/Users/tim/Code/fhfhockey.com/web', out = __dirname;
const esbuild = require(path.join(root, 'node_modules/esbuild')), sass = require(path.join(root, 'node_modules/sass'));
const { chromium, expect } = require(path.join(root, 'node_modules/@playwright/test'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const projectInputs = new Map(), defects = [], observations = [];
const origin = 'http://127.0.0.1:47999', pageUrl = origin + '/roster-schedule-optimizer';
const fontPath = path.join(root, 'public/fonts/social-share/RobotoCondensed-Variable.ttf');
const font = fs.readFileSync(fontPath);
const fixedTime = '2026-10-13T22:15:00Z';
const record = file => { if (file.startsWith(root + '/') && !file.includes('/node_modules/')) projectInputs.set(file, hash(fs.readFileSync(file))); };
const syntheticClient = `const client={auth:{getSession:async()=>({data:{session:{access_token:'SYNTHETIC-FIXTURE-NO-CREDENTIAL'}}})},from(table){(window.__fixtureDbReads??=[]).push({table,operation:'read'});const q={select(){return q},eq(){return q},order(){return q},limit(){return q},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return q}};export default client;`;
const aliases = {
  'contexts/AuthProviderContext': `const user={id:'isolated-shell-fixture-user',displayName:'Fixture User',email:'fixture@example.invalid'};export const useAuth=()=>({user,isLoading:false,signOut:async()=>{throw Error('Fixture forbids account actions')}});`,
  'lib/supabase/client': syntheticClient,
  'lib/supabase/public-client': syntheticClient,
  'components/auth/AuthModal': 'export default function AuthModal(){return null;}',
  'next/router': `const router={pathname:'/roster-schedule-optimizer',route:'/roster-schedule-optimizer',asPath:'/roster-schedule-optimizer',query:{},isReady:true,events:{on(){},off(){}},push(){throw Error('Fixture forbids navigation')},replace(){throw Error('Fixture forbids navigation')}};export const useRouter=()=>router;export default router;`,
  'next/link': `import React,{forwardRef} from 'react';export default forwardRef(function Link({href,prefetch,replace,scroll,shallow,locale,legacyBehavior,passHref,onClick,children,...props},ref){return <a {...props} ref={ref} href={typeof href==='string'?href:href.pathname} onClick={event=>{event.preventDefault();onClick?.(event)}}>{children}</a>});`,
  'next/head': 'export default function Head(){return null;}',
  'next/image': `import React from 'react';const pixel='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';export default function Image({src,alt,width,height,priority,quality,fill,unoptimized,placeholder,blurDataURL,...props}){let value=typeof src==='string'?src:src?.src;if(/^https?:/.test(value??''))value=pixel;return <img {...props} alt={alt} width={width} height={height} src={value??pixel}/>;}`,
};
const react = { name: 'app-react-runtime', setup(build) { build.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, args => ({ path: require.resolve(args.path, { paths: [root] }) })); } };
const scss = { name: 'production-scss-read-only', setup(build) { build.onLoad({ filter: /\.scss$/ }, args => {
  const compiled = sass.compile(args.path, { loadPaths: [root], logger: { warn() {}, debug() {} } });
  for (const url of compiled.loadedUrls) if (url.protocol === 'file:') record(fileURLToPath(url));
  return { contents: compiled.css, loader: 'local-css', resolveDir: path.dirname(args.path) };
}); } };
const boundary = { name: 'synthetic-service-framework-boundaries', setup(build) {
  build.onResolve({ filter: /^(contexts\/AuthProviderContext|lib\/supabase\/(client|public-client)|components\/auth\/AuthModal|next\/(router|link|head|image))$/ }, args => ({ path: args.path, namespace: 'fixture' }));
  build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: aliases[args.path], loader: 'tsx', resolveDir: root }));
  build.onLoad({ filter: /\/use(RosterPlanning|CandidateMetrics)\.ts$/ }, args => {
    record(args.path);
    return { contents: fs.readFileSync(args.path, 'utf8').replace('new URL("./rosterPlanning.worker.ts", import.meta.url)', 'window.__rsoFixtureWorkers.planning')
      .replace('new URL("./candidateMetrics.worker.ts", import.meta.url)', 'window.__rsoFixtureWorkers.metrics'), loader: 'ts', resolveDir: path.dirname(args.path) };
  });
} };
async function bundle(entry, plugins = []) {
  const built = await esbuild.build({ entryPoints: [entry], bundle: true, write: false, metafile: true,
    outdir: path.join(out, 'in-memory-bundle'), jsx: 'automatic', tsconfig: path.join(root, 'tsconfig.json'),
    nodePaths: [path.join(root, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.jpeg': 'dataurl', '.svg': 'dataurl' }, plugins: [react, ...plugins, scss] });
  for (const key of Object.keys(built.metafile.inputs)) { const file = path.resolve(key); if (fs.existsSync(file)) record(file); }
  return built;
}
function frozenPins() {
  return fs.readFileSync(path.join(out, 'owner-freeze.sha256'), 'utf8').trim().split('\n').map(line => {
    const [sha256, relative] = line.split('  ');
    return { sha256, relative, file: path.join(path.dirname(root), relative) };
  });
}
function verifyOwnerFreeze() {
  for (const pin of frozenPins()) if (hash(fs.readFileSync(pin.file)) !== pin.sha256) throw Error('Owner freeze drift: ' + pin.relative);
}
function frameScript() {
  const rect = node => { if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
  const visible = node => getComputedStyle(node).display !== 'none';
  const header = [...document.querySelectorAll('[data-site-header]')].find(visible);
  const panels = [...document.querySelectorAll('section[aria-label]')].filter(node => ['Roster and setup', 'Itinerary', 'Candidates and detail'].includes(node.getAttribute('aria-label')) && visible(node));
  const heading = document.querySelector('h1'), styles = getComputedStyle(heading);
  const metrics = document.querySelector('section[aria-label="Plan summary"]'), qualifier = metrics?.querySelector(':scope > p');
  const metricStyles = metrics ? getComputedStyle(metrics) : null, qualifierStyles = qualifier ? getComputedStyle(qualifier) : null;
  return { viewport: { width: innerWidth, height: innerHeight, devicePixelRatio, screenWidth: screen.width, screenHeight: screen.height,
    userAgent: navigator.userAgent, touchPoints: navigator.maxTouchPoints, coarsePointer: matchMedia('(pointer:coarse)').matches },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, scrollY },
    header: rect(header), panels: panels.map(node => ({ label: node.getAttribute('aria-label'), ...rect(node) })),
    typography: { headingFamily: styles.fontFamily, headingSize: styles.fontSize, headingWeight: styles.fontWeight,
      bodyFamily: getComputedStyle(document.body).fontFamily, headerFamily: getComputedStyle(header).fontFamily,
      fontStatus: document.fonts.status, fontCheck400: document.fonts.check('400 16px "Roboto Condensed"'), fontCheck700: document.fonts.check('700 21px "Roboto Condensed"'),
      faces: [...document.fonts].map(face => ({ family: face.family, weight: face.weight, status: face.status })) },
    summaryMetrics: { bounds: rect(metrics), display: metricStyles?.display, columns: metricStyles?.gridTemplateColumns,
      rows: metricStyles?.gridTemplateRows, children: metrics ? [...metrics.children].map(node => ({ tag: node.tagName, bounds: rect(node) })) : [],
      qualifier: qualifier ? { text: qualifier.textContent, bounds: rect(qualifier), gridColumn: qualifierStyles.gridColumn,
        fontSize: qualifierStyles.fontSize, lineHeight: qualifierStyles.lineHeight, scrollWidth: qualifier.scrollWidth, clientWidth: qualifier.clientWidth } : null },
    caption: rect(document.querySelector('#fixture-caption')) };
}
async function capture(page, name, fullPage = false) {
  const file = path.join(out, name + '.png');
  await expect(page.locator('#fixture-caption')).toBeVisible();
  await page.screenshot({ path: file, fullPage });
  return { file: path.basename(file), sha256: hash(fs.readFileSync(file)), fullPage,
    label: 'FIXTURE DATA · actual page-shell styling · synthetic account/provider state' };
}
async function main() {
  verifyOwnerFreeze();
  const planning = await bundle(path.join(root, 'hooks/rosterPlanning.worker.ts'));
  const metrics = await bundle(path.join(root, 'hooks/candidateMetrics.worker.ts'));
  const built = await bundle(path.join(out, 'fixture-entry.tsx'), [boundary]);
  record(path.join(root, 'styles/globals.css')); record(fontPath);
  const globalCss = fs.readFileSync(path.join(root, 'styles/globals.css'), 'utf8').replace(/^@import[^;]+;/gm, '');
  const localFontCss = '@font-face{font-family:"Roboto Condensed";src:url("/__qa/fonts/RobotoCondensed-Variable.ttf") format("truetype");font-weight:100 900;font-style:normal;font-display:block;}';
  const js = built.outputFiles.find(file => file.path.endsWith('.js')).text, css = built.outputFiles.find(file => file.path.endsWith('.css')).text;
  const workerClock = `const OriginalDate=Date;self.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[${JSON.stringify(fixedTime)}]));}static now(){return OriginalDate.parse(${JSON.stringify(fixedTime)});}};`;
  const bootstrap = 'window.__rsoFixtureWorkers={planning:URL.createObjectURL(new Blob([' + JSON.stringify(workerClock + planning.outputFiles.find(file => file.path.endsWith('.js')).text)
    + '],{type:"text/javascript"})),metrics:URL.createObjectURL(new Blob([' + JSON.stringify(workerClock + metrics.outputFiles.find(file => file.path.endsWith('.js')).text) + '],{type:"text/javascript"}))};';
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + globalCss + localFontCss + css
    + '</style></head><body><div id="root"></div><script>' + bootstrap.replaceAll('</script>', '<\\/script>') + '</script><script>' + js.replaceAll('</script>', '<\\/script>') + '</script></body></html>';
  verifyOwnerFreeze();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const scenario of ['pending-provider', 'partial-warning']) for (const [width, height] of [[2048, 1101], [1440, 900], [390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: width < 1100, isMobile: width < 1100 });
      const resources = [], pageErrors = [], consoleErrors = [], screenshots = [];
      await context.route('**/*', async route => {
        const url = route.request().url();
        if (url === pageUrl) { resources.push({ url, disposition: 'local-html' }); return route.fulfill({ contentType: 'text/html', body: html }); }
        if (url === origin + '/__qa/fonts/RobotoCondensed-Variable.ttf') { resources.push({ url, disposition: 'local-font', bytes: font.length, sha256: hash(font) }); return route.fulfill({ contentType: 'font/ttf', body: font }); }
        if (url.startsWith(origin + '/pictures/') || url.startsWith(origin + '/teamLogos/')) {
          const file = path.resolve(root, 'public', '.' + new URL(url).pathname);
          if (file.startsWith(root + '/public/') && fs.existsSync(file)) { resources.push({ url, disposition: 'local-public-asset', sha256: hash(fs.readFileSync(file)) }); return route.fulfill({ contentType: 'image/png', body: fs.readFileSync(file) }); }
          if (url.startsWith(origin + '/teamLogos/')) { resources.push({ url, disposition: 'synthetic-team-logo-local-substitute' }); return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" rx="4" fill="#33414a"/><text x="12" y="17" text-anchor="middle" font-size="13" fill="#07aae2">F</text></svg>' }); }
        }
        if (url.startsWith('https://img.buymeacoffee.com/button-api/')) {
          resources.push({ url: 'https://img.buymeacoffee.com/button-api/ [parameters omitted]', disposition: 'intercepted-local-substitute-no-network' });
          return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="36"><rect width="120" height="36" rx="8" fill="#07aae2"/><text x="60" y="23" text-anchor="middle" font-size="12" fill="#000">Support · fixture</text></svg>' });
        }
        resources.push({ url, disposition: 'blocked-no-network' }); return route.abort();
      });
      const page = await context.newPage();
      page.on('pageerror', error => { pageErrors.push(error.message); console.error('Page error:', error.message); });
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      await page.clock.setFixedTime(new Date(fixedTime));
      await page.addInitScript(value => { window.__fixtureScenario = value; }, scenario);
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Roster Schedule Optimizer', exact: true })).toBeVisible();
      await page.evaluate(async () => { await document.fonts.load('400 16px "Roboto Condensed"'); await document.fonts.load('700 21px "Roboto Condensed"'); await document.fonts.ready; });
      await expect.poll(() => page.evaluate(() => typeof window.__releaseFixtureProvider)).toBe('function');
      await expect.poll(() => page.evaluate(() => typeof window.__releaseFixtureCache)).toBe('function');
      await page.evaluate(() => window.__releaseFixtureCache());
      await expect(page.getByText(/Stored Yahoo default positions: 19\/19/)).toBeVisible();
      if (scenario === 'partial-warning') { await page.evaluate(() => window.__releaseFixtureProvider()); await expect(page.getByText(/Fixture provider unavailable\./)).toBeVisible(); }
      else await expect(page.getByText('Refreshing provider inputs…', { exact: true })).toBeVisible();
      await expect(page.getByText(/Roster, locks and availability are unverified/)).toBeVisible();
      await expect(page.getByText('Loading schedule and forecasts…', { exact: true })).toHaveCount(0);
      await expect(page.locator('section[aria-label="Candidate browser"]')).toHaveAttribute('aria-busy', 'false');
      const primary = page.getByRole('navigation', { name: width < 1100 ? 'Primary mobile navigation' : 'Primary navigation', exact: true });
      await expect(primary).toBeVisible();
      const workspaceTabs = page.getByRole('navigation', { name: 'Workspace views', exact: true });
      if (width < 1100) await workspaceTabs.getByRole('button', { name: 'Roster', exact: true }).click();
      else { await page.getByRole('button', { name: 'Show schedule-capacity assignment', exact: true }).click(); await page.getByRole('button', { name: 'Select Thu, Oct 15', exact: true }).click(); }
      await page.evaluate(() => scrollTo(0, 0));
      const initialFrame = await page.evaluate(frameScript);
      fs.writeFileSync(path.join(out, `frame-${scenario}-${width}x${height}.json`), JSON.stringify(initialFrame, null, 2));
      if (initialFrame.document.width > width + 1) defects.push({ scenario, width, kind: 'document-horizontal-overflow', frame: initialFrame });
      if (width >= 1100 && (initialFrame.document.height > height + 1 || initialFrame.panels.some(panel => panel.bottom > height + 1))) defects.push({ scenario, width, kind: 'desktop-vertical-overflow', frame: initialFrame });
      if (width >= 1100) { expect(initialFrame.panels).toHaveLength(3); expect(initialFrame.panels[1].width).toBeGreaterThan(initialFrame.panels[0].width); expect(initialFrame.panels[1].width).toBeGreaterThan(initialFrame.panels[2].width); }
      expect(initialFrame.typography.fontCheck400).toBe(true); expect(initialFrame.typography.fontCheck700).toBe(true);
      expect(initialFrame.typography.faces.some(face => face.family === 'Roboto Condensed' && face.status === 'loaded')).toBe(true);
      screenshots.push(await capture(page, `fixture-${scenario}-${width}x${height}`));
      const checks = { mobileStickyTabs: null, netMetrics: null, scrolling: null };
      if (width < 1100) {
        screenshots.push(await capture(page, `fixture-${scenario}-${width}x${height}-roster-full`, true));
        await page.getByRole('heading', { name: 'Current Roster', exact: true }).scrollIntoViewIfNeeded();
        checks.mobileStickyTabs = await page.evaluate(() => {
          const tabs = document.querySelector('nav[aria-label="Workspace views"]'), header = [...document.querySelectorAll('[data-site-header]')].find(node => getComputedStyle(node).display !== 'none');
          const t = tabs.getBoundingClientRect(), h = header.getBoundingClientRect();
          return { tabs: { x: t.x, y: t.y, width: t.width, height: t.height }, header: { x: h.x, y: h.y, width: h.width, height: h.height },
            buttons: [...tabs.querySelectorAll('button')].map(button => { const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { label: button.textContent, centerY: r.y + r.height / 2,
              hitOwnControl: !!hit && button.contains(hit), obstruction: hit?.closest('[data-site-header]') ? 'site-header' : hit?.tagName ?? null }; }) };
        });
        if (checks.mobileStickyTabs.buttons.some(button => !button.hitOwnControl)) defects.push({ scenario, width, kind: 'mobile-workspace-tabs-obstructed', evidence: checks.mobileStickyTabs });
        screenshots.push(await capture(page, `fixture-${scenario}-${width}x${height}-roster-scrolled`));
        await page.evaluate(() => scrollTo(0, 0));
        await workspaceTabs.getByRole('button', { name: 'Itinerary', exact: true }).click();
        await page.getByRole('button', { name: 'Show schedule-capacity assignment', exact: true }).click();
        await page.getByRole('button', { name: 'Select Thu, Oct 15', exact: true }).click();
        await page.getByRole('region', { name: 'Player weekly schedule scroll area', exact: true }).scrollIntoViewIfNeeded();
        const schedule = page.getByRole('region', { name: 'Player weekly schedule scroll area', exact: true });
        await schedule.evaluate(node => { node.scrollLeft = node.scrollWidth; });
        checks.scrolling = { scheduleHorizontal: await schedule.evaluate(node => node.scrollLeft) };
        expect(checks.scrolling.scheduleHorizontal).toBeGreaterThan(0); await schedule.evaluate(node => { node.scrollLeft = 0; });
        screenshots.push(await capture(page, `fixture-${scenario}-${width}x${height}-itinerary`));
        await page.evaluate(() => scrollTo(0, 0));
        await workspaceTabs.getByRole('button', { name: 'Candidates', exact: true }).click();
        await page.getByRole('heading', { name: 'Best Fit Available', exact: true }).scrollIntoViewIfNeeded();
      }
      const firstCard = page.locator('[data-rso-candidate-id]').first(); await expect(firstCard).toBeVisible();
      checks.netMetrics = await firstCard.evaluate(node => {
        const group = node.querySelector('[aria-label="Net plan comparison"]'), rect = group?.getBoundingClientRect();
        return { text: group?.textContent, bounds: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
          fields: group ? [...group.children].map(field => { const r = field.getBoundingClientRect(); return { label: field.textContent, x: r.x, y: r.y, width: r.width, height: r.height }; }) : [] };
      });
      if (checks.netMetrics.fields.length === 2) {
        const [points, agp] = checks.netMetrics.fields;
        const overlap = points.x < agp.x + agp.width && agp.x < points.x + points.width && points.y < agp.y + agp.height && agp.y < points.y + points.height;
        if (overlap) defects.push({ scenario, width, kind: 'candidate-net-metric-overlap', evidence: checks.netMetrics });
      }
      screenshots.push(await capture(page, `fixture-${scenario}-${width}x${height}-candidates`));
      const reads = await page.evaluate(() => window.__fixtureReads), dbReads = await page.evaluate(() => window.__fixtureDbReads);
      expect(reads.filter(read => read.url.endsWith('/provider')).length).toBe(1);
      if (reads.some(read => read.method !== 'GET' && !read.url.endsWith('/provider'))) throw Error('Unexpected synthetic write');
      if (resources.some(resource => resource.disposition === 'blocked-no-network') || pageErrors.length) throw Error('Blocked resource or page error ' + JSON.stringify({ resources, pageErrors }));
      observations.push({ scenario, width, height, deviceScaleFactor: 1, initialFrame, checks, screenshots, resources, reads, dbReads, pageErrors, consoleErrors,
        outboundNetworkRequests: 0, realProviderRequests: 0, realAccountRequests: 0 });
      await context.close();
    }
  } finally { await browser.close(); }
  verifyOwnerFreeze();
  const drift = [...projectInputs].filter(([file, pin]) => hash(fs.readFileSync(file)) !== pin);
  if (drift.length) throw Error('Read-only application inputs drifted during fixture capture: ' + JSON.stringify(drift.map(([file]) => file)));
  fs.writeFileSync(path.join(out, 'source-inputs.sha256'), [...projectInputs].sort(([a], [b]) => a.localeCompare(b)).map(([file, pin]) => pin + '  ' + path.relative(path.dirname(root), file) + '\n').join(''));
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify({ label: 'Fixture data with actual page-shell styling; no actual-user-account parity',
    productionFilesEdited: 0, serverStarted: false, nodeVersion: process.version, reactVersion: require(path.join(root, 'node_modules/react/package.json')).version,
    font: { path: fontPath, bytes: font.length, sha256: hash(font) }, frozenOwnerManifestSha256: hash(fs.readFileSync(path.join(out, 'owner-freeze.sha256'))),
    applicationInputCount: projectInputs.size, applicationInputDrift: [], viewportAndDeviceScaleExplicit: true,
    actualComponents: ['Layout', 'Header', 'NavbarItems', 'MobileMenu', 'UserMenu', 'RSO page', 'Container', 'ClientOnly', 'RSO components and styles', 'planning/candidate workers'],
    substitutes: ['synthetic auth/router/API/Supabase reads', 'Next Head/Link/Image wrappers', 'closed AuthModal', 'locally substituted external support badge', 'remote NHL image pixels suppressed'],
    outboundNetworkRequests: 0, genuineAccountParity: false, observations, defects }, null, 2));
  console.log(JSON.stringify({ completedContexts: observations.length, defects: defects.map(defect => ({ scenario: defect.scenario, width: defect.width, kind: defect.kind })) }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
