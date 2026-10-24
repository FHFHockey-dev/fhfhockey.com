// Independent bounded replay checks. No target configuration or database imports.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { test } = require('node:test');
const repo = path.resolve(__dirname, '../../../..');
const queue = path.join(repo, 'tasks/artifacts/in-season-billing-2026-10-21/queue-sql-verification');
const runner = path.join(queue, 'VERIFY-QUEUE.cjs');
const source = fs.readFileSync(runner, 'utf8');
const oldEvidence = JSON.parse(fs.readFileSync(path.join(__dirname, '../queue-preflight-reproduction.json'), 'utf8'));
const priorReceipt = JSON.parse(fs.readFileSync(path.join(repo, 'tasks/artifacts/billing-migration-authority-2026-10-22/CHANGED-FILES.json'), 'utf8'));
const historicalPath = path.join(queue, 'SOURCE-HASHES-BEFORE.json');
const historical = JSON.parse(fs.readFileSync(historicalPath, 'utf8'));
const expected = { ...historical };
expected['web/lib/in-season/monthlyIntegration.test.ts'] = priorReceipt.changedReferencesAndNote.find(x => x.path === 'web/lib/in-season/monthlyIntegration.test.ts').afterSha256;
delete expected[priorReceipt.relocation.from];
expected[priorReceipt.relocation.to] = priorReceipt.relocation.afterSha256;
const allowed = new Set([historicalPath, path.join(queue, 'SOURCE-RELOCATION.v1.json'),
  path.join(repo, 'tasks/artifacts/billing-migration-authority-2026-10-22/CHANGED-FILES.json'),
  ...Object.keys(expected).map(file => path.join(repo, file))]);
const sentinel = new Error('preflight completed');

function context(args, occupied) {
  const reads = []; const imports = []; const output = [];
  const sandbox = vm.createContext({
    __dirname: queue,
    process: { argv: ['node', runner, ...args], exit: code => { assert.equal(code, 0); throw sentinel; } },
    console: { log: value => output.push(value) },
    require(name) {
      imports.push(name);
      if (name === 'node:fs') return {
        readFileSync(file, encoding) {
          assert.ok(allowed.has(file), `forbidden read: ${file}`);
          reads.push(file);
          return fs.readFileSync(file, encoding);
        },
        existsSync(file) {
          assert.ok(['RESULTS.relocation-v1.json', 'FAILED-RESULT.relocation-v1.json'].some(x => path.join(queue, x) === file));
          return path.basename(file) === occupied;
        },
      };
      assert.ok(['node:path', 'node:assert/strict', 'node:crypto'].includes(name), `forbidden dependency: ${name}`);
      return require(name);
    },
  });
  return { sandbox, reads, imports, output, run: () => vm.runInContext(source, sandbox, { timeout: 1000 }) };
}

test('original exact preflight oracle still reproduces integration-test mismatch', () => {
  assert.throws(() => vm.runInNewContext(oldEvidence.executedOnly, {
    fs, path, assert, createHash, repo, __dirname: queue,
  }, { timeout: 1000 }), error => error.code === 'ERR_ASSERTION' &&
    error.expected === 'cb87e47d4d2b1050577a62cba6bebccb12101df57709dbcb6773d95abb3594b5' &&
    error.actual === expected['web/lib/in-season/monthlyIntegration.test.ts']);
});

test('original SQL-path oracle remains ENOENT while relocated bytes retain original digest', () => {
  assert.throws(() => fs.readFileSync(path.join(repo, priorReceipt.relocation.from)), error => error.code === 'ENOENT');
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(repo, priorReceipt.relocation.to))).digest('hex'), historical[priorReceipt.relocation.from]);
});

test('R1 full source preflight and final guard accept exactly the independently derived seven inputs', () => {
  const run = context(['--preflight']);
  assert.throws(run.run, error => error === sentinel);
  const result = JSON.parse(run.output[0]);
  assert.equal(result.sourceCount, 7);
  assert.deepEqual(result.sourceHashes, expected);
  const readsAtExit = run.reads.length;
  vm.runInContext('verifySourceHashes()', run.sandbox, { timeout: 1000 });
  assert.equal(run.reads.length - readsAtExit, 10); // Three provenance anchors plus seven inputs.
  assert.ok(!run.reads.includes(path.join(repo, priorReceipt.relocation.from)));
  assert.equal(run.imports.length, 4);
});

for (const name of ['RESULTS.relocation-v1.json', 'FAILED-RESULT.relocation-v1.json']) {
  test(`occupied ${name} rejects before any target or database client load`, () => {
    const run = context([], name);
    assert.throws(run.run, error => error.code === 'ERR_ASSERTION' && error.message.includes('preserve existing execution receipts'));
    assert.equal(run.imports.length, 4);
  });
}
