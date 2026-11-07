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
check('New York cutoff does not advance at UTC midnight',()=>same(team.teamGamesWindow('2026-11-02T00:30:00Z',7).through,'2026-10-31'));
check('New York cutoff advances at local midnight after fall DST',()=>same(team.teamGamesWindow('2026-11-02T05:00:00Z',7).through,'2026-11-01'));
check('Spring DST skips an hour without changing calendar date',()=>same(['2026-03-08T06:59:59Z','2026-03-08T07:00:00Z'].map(defs.editionDate),['2026-03-08','2026-03-08']));
check('Fall DST repeats an hour without changing calendar date',()=>same(['2026-11-01T05:59:59Z','2026-11-01T06:00:00Z'].map(defs.editionDate),['2026-11-01','2026-11-01']));
check('Leap-day calendar arithmetic is inclusive',()=>same([team.shiftDays('2028-02-28',1),team.shiftDays('2028-02-28',2)],['2028-02-29','2028-03-01']));
check('Year boundary labels include both years',()=>same(period.periodDates('2026-12-28','2027-01-03'),'Dec 28, 2026 to Jan 3, 2027'));
check('Season identity persists at January and rolls at August',()=>same(['2026-12-31','2027-01-01','2027-07-31','2027-08-01'].map(schedule.currentSeason),[20262027,20262027,20262027,20272028]));
check('Inclusive custom leap range has three dates',()=>{
 const c=period.matchupCalendar([{week:1,start_date:'2028-02-01',end_date:'2028-03-31'}]);
 same(period.resolvePeriodWindow({...settings,period:'custom',start:'2028-02-28',end:'2028-03-01'},c,{mode:'past-only',cutoff:'2028-03-02'}).window.days,3);
});
check('Past-only refuses future and unknown weeks',()=>{
 assert.match(period.resolvePeriodWindow({...settings,week:6},calendar,{mode:'past-only',cutoff:'2026-11-01'}).reason,/not started/);
 assert.match(period.resolvePeriodWindow({...settings,week:99},calendar,{mode:'past-only',cutoff:'2026-11-01'}).reason,/not on/);
});
check('Matched prior and recent appearances never overlap',()=>{
 const all=Array.from({length:12},(_,i)=>i+1), recent=defs.lastN(all,5).rows, prior=defs.previousN(all,5,5).rows;
 same(recent,[8,9,10,11,12]); same(prior,[3,4,5,6,7]); assert.equal(prior.some(x=>recent.includes(x)),false);
});
check('Calendar overlap fails closed and missing dates are disclosed',()=>{
 same(period.matchupCalendar([{week:1,start_date:null,end_date:null}]).reasons.length,1);
 same(period.matchupCalendar([{week:1,start_date:'2026-10-01',end_date:'2026-10-07'},{week:2,start_date:'2026-10-07',end_date:'2026-10-14'}]).weeks,[]);
});
const monday = inventory.resolveInventoryPeriod(settings,calendar,'2026-11-01','2026-11-02T15:00:00Z');
check('F1 owner fix: Monday any-week default now resolves current week',()=>{
 same(monday.period.through,'2026-11-08'); same(monday.period.elapsed,false);
 same(period.matchupPager(null,calendar,{mode:'any-week',cutoff:'2026-11-01'}).current.week,6);
});
const PeriodControl = load('components/SocialShare/PeriodControl').default;
const fields=period.periodWindowFields({mode:'past-only',options:[{value:'matchup',label:'Matchup week'}]});
const props={entry:{fields},control:{mode:'past-only'},settings,disabled:false,change(){},apply(){}};
function render() { cursor=0; const tree=PeriodControl(props); const pending=effects; effects=[]; pending.forEach(fn=>fn()); return tree; }
function find(node,id) {
 if (!node || typeof node !== 'object') return null;
 if (Array.isArray(node)) return node.map(n=>find(n,id)).find(Boolean);
 return node.props?.['data-testid']===id ? node : find(node.props?.children,id);
}
async function missingSlateProbe() {
  const selected = (relative,names) => {
    const file=path.join(root,relative),source=fs.readFileSync(file,'utf8');
    pins[relative]=crypto.createHash('sha256').update(source).digest('hex');
    const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
    return ast.statements.filter(s=>names.includes(s.name?.text)).map(s=>s.getText(ast)).join('\n');
  };
  const source=selected('web/lib/socialShare/modules/lastNightsStandouts.sources.ts',['readSlateDate','readSlateNeighbours','loadLastNightsStandouts'])+'\n'+selected('web/lib/socialShare/modules/lastNightsStandouts.ts',['standoutsNoSlate']);
  const calls=[],tables={wgo_skater_stats:[],games:[{id:9,date:'2026-10-31',seasonId:20262027,type:2}],wgo_team_stats:[{game_id:9,date:'2026-10-31',team_id:1},{game_id:9,date:'2026-10-31',team_id:3}],wgo_goalie_stats:[{goalie_id:7,game_id:9,date:'2026-10-31'}]};
  const client={from(table){calls.push(table);const query={select(){return query;},eq(){return query;},gte(){return query;},lte(){return query;},lt(){return query;},gt(){return query;},order(){return query;},limit(){return Promise.resolve({data:tables[table]??[],error:null});}};return query;}};
  const module={exports:{}};
  const context={module,exports:module.exports,shareThrough:()=>({through:'2026-10-31',from:'2026-07-01',season:20262027}),UNKNOWN_EVIDENCE:{},shareSettingsKey:()=>'(irrelevant setting token)',SERVER_FIELDS:[],slateLabel:()=> 'Oct 31'};
  vm.runInNewContext(ts.transpileModule(source,{fileName:'selected.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  const result=await module.exports.loadLastNightsStandouts({client,generatedAt:'2026-11-01T14:00:00Z'},{slate:'2026-10-31',view:'goalies'});
  check('F3 reproduction: absent skater rows conceal completed team/goalie data',()=>{same(result.reasons,['No completed games on Oct 31. Choose another slate.']);same(result.data.games,0);same(calls,['wgo_skater_stats','wgo_skater_stats','wgo_skater_stats']);});
  return {method:'Exact AST loader functions and no-slate result; fixed scope/label/token dependencies; fake table data contains a completed game and goalie but zero skater rows.',result,calls,fixtureCompletedTeamRows:tables.wgo_team_stats.length};
}
(async()=>{
 calendarResponse={rows,cutoff:'2026-10-31'}; render(); await Promise.resolve();
 const before=find(render(),'period-pager-label').props.children;
 // Simulate a post refresh after local midnight: parent rerenders, same mounted control, server now has a new cutoff.
 calendarResponse={rows,cutoff:'2026-11-01'};
 const after=find(render(),'period-pager-label').props.children;
 const serverWeek=period.resolvePeriodWindow(settings,calendar,{mode:'past-only',cutoff:'2026-11-01'}).window.week;
 check('F2 reproduction: mounted calendar retains old cutoff on parent/post refresh',()=>{same(fetches,1);same(before,'Week 4 · Oct 19 to Oct 25');same(after,before);same(serverWeek,5);});
 const missingSlate=await missingSlateProbe();
 const report={generatedAt:new Date().toISOString(),method:'Offline VM executes exact TypeScript; React hook harness models effect dependencies, not a real browser. External IO unavailable. schedule.ts uses exact currentSeason AST node only.',checks:results,findings:{F1:{monday},F2:{calendarFetches:fetches,pagerBefore:before,pagerAfterRefresh:after,serverResolvedWeek:serverWeek},F3:missingSlate},pins};
 fs.writeFileSync(path.join(__dirname,'PROBE-RESULTS.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({checks:results.length,passed:results.length,findings:report.findings},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
