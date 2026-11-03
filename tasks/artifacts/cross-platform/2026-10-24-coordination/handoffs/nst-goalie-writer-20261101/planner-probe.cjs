// Read-only diagnosis probe. Loads only four pure planner modules; no route,
// environment file, database client, provider client or network capability.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = process.cwd(); // Run from web/.
const ts = require(path.join(root, 'node_modules/typescript'));
const allowed = new Set(['nstBurstPlans', 'nstRateLimitPolicy', 'nstCoordination', 'nstClassification']
  .map(name => path.join(root, 'lib/cron', `${name}.ts`)));
const cache = new Map();
function load(file) {
  assert(allowed.has(file), `Unexpected dependency: ${file}`);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: spec => load(`${spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : path.join(root, spec)}.ts`),
  }, { filename: file, timeout: 1000 });
  return module.exports;
}
const { resolveGoalieNstRequestPlan } = load(path.join(root, 'lib/cron/nstBurstPlans.ts'));
const cases = [
  { name: '40 queued, max20 remains strict even if many rows already exist', count: 40, cap: 20, interval: 21000 },
  { name: 'Capping the chunk at6 does not make a40URL job burst', count: 40, cap: 6, interval: 21000 },
  { name: 'A genuinely complete37URL pending job is burst-eligible', count: 37, cap: 20, interval: 0 },
  { name: 'A genuinely complete10URL pending job is burst-eligible', count: 10, cap: 20, interval: 0 },
  { name: 'A large70URL job remains paced', count: 70, cap: 20, interval: 21000 },
];
const results = cases.map(c => {
  const result = resolveGoalieNstRequestPlan({ queuedDates: Math.ceil(c.count / 10), totalQueuedUrls: c.count, maxPendingUrls: c.cap });
  assert.equal(result.requestIntervalMs, c.interval, c.name);
  return { name: c.name, requestCountBudget: result.requestCountBudget, requestIntervalMs: result.requestIntervalMs, burstAllowed: result.burstAllowed };
});
console.log(JSON.stringify({ passed: results.length, results, limitation: 'Planner only; no production timing, row coverage, scheduler continuation or route execution verified.' }, null, 2));
