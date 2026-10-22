// Offline audit probes of extracted current source, not application acceptance tests.
// Run from any directory with Node 22.11.0; imports only the local TypeScript compiler.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'web/node_modules/typescript'));
const pins = new Map();
const checks = [];
function source(relative) {
  const text = fs.readFileSync(path.join(root, relative), 'utf8');
  pins.set(relative, crypto.createHash('sha256').update(text).digest('hex'));
  return ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function find(tree, predicate) {
  let found;
  function visit(node) {
    if (!found && predicate(node)) found = node;
    if (!found) ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(found, 'Required source node must exist');
  return found;
}
function initializer(tree, name) {
  return find(tree, n => ts.isVariableDeclaration(n) && n.name.getText(tree) === name).initializer.getText(tree);
}
function evaluate(expression, globals = {}) {
  const output = ts.transpileModule(`globalThis.result = (${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  const context = vm.createContext({ ...globals });
  vm.runInContext(output, context, { timeout: 1000 });
  return context.result;
}
function record(id, observed, required, finding) {
  checks.push({ id, observed, required, finding, reproduced: true });
}
async function main() {
  const ownership = source('web/pages/api/v1/transactions/ownership-snapshots.ts');
  const resolveOwnership = evaluate(initializer(ownership, 'resolveOwnership'));
  assert.equal(resolveOwnership({ percent_ownership: '' }), 0);
  assert.equal(resolveOwnership({ percent_ownership: '   ' }), 0);
  assert.equal(resolveOwnership({ percent_ownership: false }), 0);
  record('H01-empty-ownership', ['', '   ', false].map(value => resolveOwnership({percent_ownership:value})), [null, null, null], 'Unknown ownership coerces to measured zero');
  assert.equal(resolveOwnership({ percent_ownership: 0 }), 0);
  assert.equal(resolveOwnership({ percent_ownership: null }), null);
  record('H01-controls', { zero: 0, null: null }, { zero: 0, null: null }, 'Valid zero/null controls preserved');

  const calendar = source('web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx');
  const stats = find(calendar, n => ts.isVariableDeclaration(n) && n.name.getText(calendar) === 'stats' && n.type?.getText(calendar) === 'CalendarStats');
  const points = stats.initializer.properties.find(n => ts.isPropertyAssignment(n) && n.name.getText(calendar) === 'points');
  assert.ok(points);
  const actualPoints = evaluate(points.initializer.getText(calendar), {wins:2, losses:6, otLosses:3, totalPlayed:11});
  assert.equal(actualPoints, 3.5);
  record('H02-calendar-points', actualPoints, 7, 'Displayed points are divided by two');

  const search = source('web/components/StatsPage/PlayerSearchBar.tsx');
  const scheduled = [];
  const requests = [];
  let resultRows = [];
  let visible = false;
  let query = '';
  const handleChange = evaluate(initializer(search, 'handleChange'), {
    setQuery: value => { query = value; },
    setResults: value => { resultRows = value; },
    setShowDropdown: value => { visible = value; },
    timeoutRef: {current:null}, clearTimeout: () => {},
    setTimeout: callback => { scheduled.push(callback); return scheduled.length; },
    supabase: { from: () => {
      const request = {};
      const chain = { select: () => chain, ilike: (_field,value) => {request.query=value;return chain;}, limit: () => new Promise(resolve => { request.resolve = resolve;requests.push(request); }) };
      return chain;
    }}
  });
  handleChange({target:{value:'cros'}});
  const first = scheduled.shift()();
  handleChange({target:{value:'mcd'}});
  const second = scheduled.shift()();
  requests[1].resolve({data:[{id:2,fullName:'New query'}]});
  await second;
  requests[0].resolve({data:[{id:1,fullName:'Old query'}]});
  await first;
  assert.equal(query, 'mcd');
  assert.equal(resultRows[0].id, 1);
  record('H03-stale-search', {query, displayedId:resultRows[0].id}, {query:'mcd', displayedId:2}, 'Older response replaces current query results');
  handleChange({target:{value:'hugh'}});
  const third = scheduled.shift()();
  handleChange({target:{value:''}});
  requests[2].resolve({data:[{id:3,fullName:'Cleared query'}]});
  await third;
  assert.equal(query, '');
  assert.equal(visible, true);
  record('H03-cleared-search', {query, visible, count:resultRows.length}, {query:'', visible:false,count:0}, 'In-flight response reopens results after clearing');

  const timeline = source('web/components/MetricsTimeline/MetricsTimeline.tsx');
  const adapter = source('web/components/MetricsTimeline/metricsTimelineData.ts');
  const buildDeclaration = find(adapter,n => ts.isFunctionDeclaration(n) && n.name?.text === 'buildMetricsTimelineRows').getText(adapter).replace(/^export\s+/, '');
  const build = evaluate(`(() => {${buildDeclaration}; return buildMetricsTimelineRows;})()`);
  const normalize = evaluate(initializer(timeline, 'normalizeXgRows'));
  const queryCalls = [];
  let timelineRows;
  const fetchMetrics = evaluate(initializer(timeline, 'fetchMetrics'), {
    teamIdNumber:1,seasonIdNumber:20262027,isMounted:true,
    normalizeXgRows:normalize,buildMetricsTimelineRows:build,setRows:rows=>{timelineRows=rows;},
    supabase:{from:table=>{
      const filters=[];
      queryCalls.push({table,filters});
      const chain={select:()=>chain,eq:(field,value)=>{filters.push([field,value]);return chain;},order:()=>chain,then:(resolve,reject)=>Promise.resolve({error:null,data:table==='wgo_team_stats'?[{date:'2026-10-19',points:2,games_played:1}]:filters.some(([field])=>field==='source_model_approved')?[]:[{game_date:'2026-10-19',xg_for:9,xg_against:8}]}).then(resolve,reject)};
      return chain;
    }}
  });
  await fetchMetrics();
  assert.equal(queryCalls.length, 3);
  assert.equal(timelineRows[0].xgf, 9);
  record('H04-unapproved-xg', {queries:queryCalls.length,xgf:timelineRows[0].xgf}, {queries:2,xgf:null}, 'Unfiltered fallback admits unapproved xG without an approval marker');
  const receipt={as_of:new Date().toISOString(),node:process.version,method:'TypeScript AST extraction of current functions/expressions in a VM; synthetic mocks only; no app imports, environment files, network or database',checks,source_pins:Object.fromEntries(pins),limitations:'These assert observed defects and controls, not passing product acceptance. No React render, browser, full handler, query service or deployment executed.'};
  fs.writeFileSync(path.join(__dirname,'SOURCE-PROBES.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({node:receipt.node,checks:checks.length,defect_cases:checks.filter(c=>c.id!=='H01-controls').length,receipt:path.relative(root,path.join(__dirname,'SOURCE-PROBES.json'))},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
