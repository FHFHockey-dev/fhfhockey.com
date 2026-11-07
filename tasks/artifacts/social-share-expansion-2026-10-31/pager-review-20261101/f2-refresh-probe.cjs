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
 props.edition={generatedAt:'2026-11-02T04:59:00Z'};
 calendarResponse={rows,cutoff:'2026-10-31'}; render(); await Promise.resolve();
 const before=find(render(),'period-pager-label').props.children;
 props.edition={generatedAt:'2026-11-02T05:01:00Z'};
 calendarResponse=null; render(); await Promise.resolve();
 const afterTree=render(), after=find(afterTree,'period-pager-label').props.children;
 const serverWeek=period.resolvePeriodWindow(settings,calendar,{mode:'past-only',cutoff:'2026-11-01'}).window.week;
 check('F2 persists after failed calendar refresh: stale label with no alert',()=>{same(fetches,2);same(before,'Week 4 · Oct 19 to Oct 25');same(after,before);same(serverWeek,5);same(hasAlert(afterTree),false);});
 const failure={calendarFetches:fetches,pagerBefore:before,pagerAfterRefresh:after,serverResolvedWeek:serverWeek,visibleFailureAlert:hasAlert(afterTree)};
 // A successful calendar request can cross midnight after its edition was generated.
 hooks=[];effects=[];cursor=0;fetches=0;
 props.edition={generatedAt:'2026-11-02T04:59:59Z'};
 calendarResponse={rows,cutoff:'2026-11-01'}; render(); await Promise.resolve();
 const racePager=find(render(),'period-pager-label').props.children;
 const editionCutoff=team.teamGamesWindow(props.edition.generatedAt,7).through;
 const editionWeek=period.resolvePeriodWindow(settings,calendar,{mode:'past-only',cutoff:editionCutoff}).window.week;
 check('F2 success race: calendar next-day cutoff disagrees with prior-day edition',()=>{same(racePager,'Week 5 · Oct 26 to Nov 1');same(editionWeek,4);});
 const report={generatedAt:new Date().toISOString(),observedCommit:'cc263466a69e9c7c0fe7d7ff3a04f411c30a9c2e',method:'Offline exact-component VM hook harness; simulated calendar responses, no browser/network/service calls. Reads code only; edition timestamps supplied as fixture props.',checks:results,failedRefresh:failure,midnightRace:{editionCutoff,editionWeek,pager:racePager},pins};
 fs.writeFileSync(path.join(__dirname,'F2-REFRESH-RESULTS.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
