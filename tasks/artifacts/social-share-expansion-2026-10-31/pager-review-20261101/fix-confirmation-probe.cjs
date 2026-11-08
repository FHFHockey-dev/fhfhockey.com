// Offline review probe. Executes repository TypeScript in a VM; external IO is unavailable.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const web = path.join(root, 'web');
const ts = require(path.join(web, 'node_modules/typescript'));
const cache = new Map(), pins = {}, results = [];
let hooks = [], cursor = 0, effects = [], fetches = 0;
let calendarResponse;
const react = {
  useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial; return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; },
  useRef(initial) { const i = cursor++; return hooks[i] ??= { current: initial }; },
  useMemo(fn) { cursor++; return fn(); },
  useEffect(fn, deps) { const i = cursor++; if (!hooks[i] || deps.some((d,j) => d !== hooks[i][j])) { hooks[i] = deps; effects.push(fn); } },
};
const jsx = (type, props) => ({ type, props });
function load(name, parent = path.join(web, '_root.ts')) {
  if (name === 'react') return react;
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
  if (name === 'lib/socialShare/matchupWeeksFetch') return { fetchMatchupWeeks: async () => { fetches++; return calendarResponse; } };
  if (name.endsWith('.scss')) return {};
  const base = name.startsWith('.') ? path.resolve(path.dirname(parent), name) : path.join(web, name);
  const file = [base, base+'.ts', base+'.tsx', path.join(base,'index.ts')].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
  if (!file || !file.startsWith(web+'/')) throw Error('Import not allowed: '+name);
  if (cache.has(file)) return cache.get(file).exports;
  let source = fs.readFileSync(file, 'utf8');
  pins[path.relative(root,file)] = crypto.createHash('sha256').update(source).digest('hex');
  // Only the date-to-season function is needed from this large module; use its exact AST node.
  if (file === path.join(web,'lib/socialShare/schedule.ts')) {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    source = ast.statements.find(s => s.name?.text === 'currentSeason').getText(ast);
  }
  const module = { exports: {} }; cache.set(file,module);
  const output = ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext('(function(require,module,exports){'+output+'\n})',{Date,Intl,URL,URLSearchParams,console:{warn(){},error(){}},setTimeout,clearTimeout})(n=>load(n,file),module,module.exports);
  return module.exports;
}
const same = (actual,expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
function check(name,fn) { fn(); results.push({name,status:'passed'}); }
const period = load('lib/socialShare/modules/shared/periodWindow');
const defs = load('lib/socialShare/modules/shared/definitions');
const team = load('lib/socialShare/modules/teamGames');
const schedule = load('lib/socialShare/schedule');
const inventory = load('lib/socialShare/modules/shared/goalieInventory.sources');
const rows = [
  {week:4,start_date:'2026-10-19',end_date:'2026-10-25'},
  {week:5,start_date:'2026-10-26',end_date:'2026-11-01'},
  {week:6,start_date:'2026-11-02',end_date:'2026-11-08'},
];
const calendar = period.matchupCalendar(rows);
const settings = {period:'matchup',week:null,start:null,end:null,days:7};
const PeriodControl = load('components/SocialShare/PeriodControl').default;
const fields=period.periodWindowFields({mode:'past-only',options:[{value:'matchup',label:'Matchup week'}]});
const props={entry:{fields},control:{mode:'past-only'},settings,disabled:false,change(){},apply(){}};
function render() { cursor=0; const tree=PeriodControl(props); const pending=effects; effects=[]; pending.forEach(fn=>fn()); return tree; }
function find(node,id) {
 if (!node || typeof node !== 'object') return null;
 if (Array.isArray(node)) return node.map(n=>find(n,id)).find(Boolean);
 return node.props?.['data-testid']===id ? node : find(node.props?.children,id);
}
function hasAlert(node) {
 if (!node || typeof node !== 'object') return false;
 if (Array.isArray(node)) return node.some(hasAlert);
 return node.props?.role === 'alert' || hasAlert(node.props?.children);
}
(async()=>{
 props.entry.id='team-games';
 props.edition={post:'team-games',generatedAt:'2026-11-02T04:59:00Z'};
 calendarResponse={rows,cutoff:'2026-10-31'};render();await Promise.resolve();
 const before=find(render(),'period-pager-label').props.children;
 props.edition={post:'team-games',generatedAt:'2026-11-02T05:01:00Z'};
 calendarResponse=null;render();await Promise.resolve();
 const refreshed=render(),after=find(refreshed,'period-pager-label').props.children;
 check('F2 fixed: failed refresh advances using the edition cutoff and discloses retained rows',()=>{same(before,'Week 4 · Oct 19 to Oct 25');same(after,'Week 5 · Oct 26 to Nov 1');same(fetches,2);same(hasAlert(refreshed),true);assert.ok(find(refreshed,'period-refresh-failed'));});
 hooks=[];effects=[];cursor=0;fetches=0;
 props.edition={post:'team-games',generatedAt:'2026-11-02T04:59:59Z'};
 calendarResponse={rows,cutoff:'2026-11-01'};render();await Promise.resolve();
 const race=find(render(),'period-pager-label').props.children;
 check('F2 fixed: later calendar cutoff does not advance a pre-midnight edition',()=>same(race,'Week 4 · Oct 19 to Oct 25'));
 props.settings={...settings,week:4};props.edition={post:'team-games',generatedAt:'2026-11-09T05:01:00Z'};
 render();await Promise.resolve();
 check('Explicit week remains pinned when edition cutoff advances',()=>same(find(render(),'period-pager-label').props.children,'Week 4 · Oct 19 to Oct 25'));
 check('Edition cutoff handles spring/fall DST, leap day and year boundary',()=>same(['2026-03-08T06:59:59Z','2026-03-08T07:00:00Z','2026-11-01T05:59:59Z','2026-11-01T06:00:00Z','2028-03-01T05:00:00Z','2027-01-01T05:00:00Z'].map(period.editionCutoff),['2026-03-07','2026-03-07','2026-10-31','2026-10-31','2028-02-29','2026-12-31']));
 const standouts=load('lib/socialShare/modules/lastNightsStandouts');
 const scheduled=[{id:7,date:'2026-10-27'},{id:8,date:'2026-10-30'},{id:9,date:'2026-10-31'}];
 const completed=scheduled.flatMap(game=>['NJD','NYR'].map(team=>({gameId:game.id,date:game.date,team})));
 const dates=standouts.completedSlateDates(scheduled,completed);
 check('F3 fixed: calendar evidence retains played dates independently of skater rows',()=>same(dates,['2026-10-27','2026-10-30','2026-10-31']));
 const slates=standouts.slateNeighbours(dates,'2026-10-30',{first:'2026-07-01',last:'2026-10-31'});
 check('Missing-feed date remains between its played neighbors',()=>same(slates.previous,'2026-10-27'));
 const actualSettings={view:'all',slate:'2026-10-31',rosterMax:25,rankBy:'points',minShotsAgainst:15,minPriorGp:3,minCoverage:90,picks:''};
 const base={settings:actualSettings,slate:'2026-10-31',slates:{previous:'2026-10-30',next:null,first:'2026-07-01',last:'2026-10-31'},season:20262027,scheduledGameIds:[9],completedTeamGames:completed.filter(x=>x.gameId===9),ownership:{byPlayer:new Map(),updatedAt:null}};
 const missing=standouts.buildLastNightsStandouts({...base,appearances:[]});
 check('Missing skater feed is partial with explicit reason and zero coverage, not an off day',()=>{same(missing.state,'partial');assert.match(missing.reasons[0],/Skater data is missing.*games were played/);same(missing.evidence.coverage,{observed:0,expected:2,missing:2,unit:'team games'});same(missing.data.games,1);same(standouts.lastNightsStandoutsModule.hasRows(missing.data,actualSettings),false);});
 const report={generatedAt:new Date().toISOString(),observedCandidate:'e152ce5bca1aa77e29a43acd33eb7e9ae0d0ac62',method:'Offline real TypeScript component hook harness plus pure functions/builders. External IO unavailable; fixture completed-team evidence supplied. No actual browser, authenticated endpoint or real-data capture.',checks:results,F2:{before,failedRefresh:after,failedRefreshAlert:hasAlert(refreshed),crossMidnightPager:race},F3:{dates,slates,state:missing.state,reasons:missing.reasons,coverage:missing.evidence.coverage},pins};
 fs.writeFileSync(path.join(__dirname,'FIX-CONFIRMATION-RESULTS.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({checks:results.length,F2:report.F2,F3:report.F3},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
