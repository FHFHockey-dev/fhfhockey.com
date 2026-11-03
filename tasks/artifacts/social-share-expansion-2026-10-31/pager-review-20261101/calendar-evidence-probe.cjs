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
 const relative='web/lib/socialShare/matchupWeeksFetch.ts',file=path.join(root,relative),source=fs.readFileSync(file,'utf8');
 pins[relative]=crypto.createHash('sha256').update(source).digest('hex');
 let session=null, calls=[];
 const module={exports:{}};
 const transpiled=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext('(function(require,module,exports){'+transpiled+'\n})',{fetch(){throw Error('External IO unavailable');}})(name=>{
  if(name==='lib/supabase/client')return {auth:{getSession:async()=>({data:{session}})}};
  if(name==='./export')return {bounded:async(promise)=>promise};
  throw Error('Unexpected import '+name);
 },module,module.exports);
 const fetchCalendar=module.exports.fetchMatchupWeeks;
 const fake=body=>async(url,options)=>{calls.push({url,options});return body;};
 const json=(body,status=200)=>({ok:status===200,status,json:async()=>body});
 check('No session gives no request',()=>{});
 same(await fetchCalendar(fake(json({rows,cutoff:'2026-11-01'}))),null);same(calls.length,0);
 session={access_token:'fictional-editor-token'};
 const good=await fetchCalendar(fake(json({rows,cutoff:'2026-11-01'})));
 check('Valid response stays usable and sends bearer/no-store',()=>{same(good,{rows,cutoff:'2026-11-01'});same(calls[0].options,{cache:'no-store',credentials:'omit',headers:{Authorization:'Bearer fictional-editor-token'}});});
 for(const status of [401,403,503]){
  const result=await fetchCalendar(fake(json({error:'fixture'},status)));
  check('HTTP '+status+' becomes unavailable',()=>same(result,null));
 }
 const malformed=await fetchCalendar(fake(json({rows})));
 check('Missing cutoff becomes unavailable',()=>same(malformed,null));
 const rejected=await fetchCalendar(async()=>{throw Error('fixture request failure');});
 check('Rejected request becomes unavailable',()=>same(rejected,null));
 const empty=await fetchCalendar(fake(json({rows:[],cutoff:'2026-11-01'})));
 check('Successful empty rows are accepted by fetcher',()=>same(empty,{rows:[],cutoff:'2026-11-01'}));
 const displays=[];
 for(const response of [empty,null,good]){
  hooks=[];effects=[];cursor=0;fetches=0;props.edition={};calendarResponse=response;
  render();await Promise.resolve();const tree=render();
  displays.push({response:response===null?'null':response.rows.length?'populated':'empty',label:find(tree,'period-pager-label').props.children,alert:hasAlert(tree)});
 }
 check('Empty calendar is distinct from an unavailable fetch',()=>same(displays,[{response:'empty',label:'No matchup week',alert:false},{response:'null',label:'Weeks unavailable',alert:true},{response:'populated',label:'Week 5 · Oct 26 to Nov 1',alert:false}]));
 const report={generatedAt:new Date().toISOString(),method:'Offline exact fetch helper and actual PeriodControl hook harness. Synthetic auth/session/response fixtures only; bounded timeout wrapper replaced with immediate promise pass-through, so elapsed timeout itself is not tested. No browser or network.',checks:results,displays,pins,interpretation:'Weeks unavailable identifies a null/unavailable fetch result; successful empty rows instead display No matchup week. Missing auth, HTTP errors, malformed payload and rejected requests collapse to null. Does not attribute the retained real-period render report to any one failure cause.'};
 fs.writeFileSync(path.join(__dirname,'CALENDAR-EVIDENCE-PROBE.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({checks:results.length,displays},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
