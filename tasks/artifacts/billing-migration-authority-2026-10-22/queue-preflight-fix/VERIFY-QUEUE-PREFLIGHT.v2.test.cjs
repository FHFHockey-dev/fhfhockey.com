// Execute the real runner's preflight in a VM that forbids targets, DB clients and writes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const repo = path.resolve(__dirname, '../../../..');
const runnerDir = path.join(repo, 'tasks/artifacts/in-season-billing-2026-10-21/queue-sql-verification');
const runner = path.join(runnerDir, 'VERIFY-QUEUE.v2.cjs');
const source = fs.readFileSync(runner, 'utf8');
const relocationPath = path.join(runnerDir, 'SOURCE-RELOCATION.v2.json');
const relocation = JSON.parse(fs.readFileSync(relocationPath, 'utf8'));
const historical = JSON.parse(fs.readFileSync(path.join(repo, relocation.historicalManifest), 'utf8'));
const current = { ...historical };
for (const entry of relocation.entries) { delete current[entry.from]; current[entry.to] = entry.afterSha256; }
const priorPaths = relocation.priorAnchors.map(anchor => path.join(repo, anchor.path));
const allowed = new Set([...priorPaths, relocationPath, path.join(repo, relocation.historicalManifest),
  path.join(repo, relocation.relocationReceipt), ...Object.keys(current).map(file => path.join(repo, file))]);
class PreflightExit extends Error { constructor(code) { super('preflight exit'); this.code = code; } }

function harness(mutations = new Map()) {
  const reads = []; const output = [];
  const context = vm.createContext({
    __dirname: runnerDir,
    process: { argv: ['node', runner, '--preflight'], exit: code => { throw new PreflightExit(code); } },
    console: { log: text => output.push(text) },
    require: name => {
      if (name === 'node:fs') return {
        readFileSync(file, encoding) {
          assert.ok(allowed.has(file), `unexpected preflight read: ${file}`);
          reads.push(file);
          const mutation = mutations.get(file);
          if (mutation instanceof Error) throw mutation;
          const bytes = mutation ?? fs.readFileSync(file);
          return encoding ? bytes.toString(encoding) : bytes;
        },
      };
      assert.ok(['node:path', 'node:assert/strict', 'node:crypto'].includes(name), `forbidden dependency: ${name}`);
      return require(name);
    },
  });
  return {
    mutations, reads,
    run() {
      assert.throws(() => vm.runInContext(source, context, { filename: runner, timeout: 1000 }),
        error => error instanceof PreflightExit && error.code === 0);
      return JSON.parse(output[0]);
    },
    runRaw() { return vm.runInContext(source, context, { filename: runner, timeout: 1000 }); },
    verifyAgain() { return vm.runInContext('verifySourceHashes()', context, { timeout: 1000 }); },
  };
}

test('actual preflight resolves seven inputs before any target/client/write access', () => {
  const run = harness(); const result = run.run();
  assert.equal(result.success, true);
  assert.equal(result.databaseAccess, false);
  assert.equal(result.sourceCount, 7);
  assert.deepEqual(result.sourceHashes, current);
  for (const file of Object.keys(current)) assert.ok(run.reads.includes(path.join(repo, file)));
  assert.ok(!run.reads.some(file => file.endsWith('TARGET.json')));
});

for (const file of Object.keys(current)) {
  test(`preflight rejects changed source: ${file}`, () => {
    const full = path.join(repo, file);
    const run = harness(new Map([[full, Buffer.concat([fs.readFileSync(full), Buffer.from('\nchanged')])]]));
    assert.throws(() => run.runRaw(), error => error.code === 'ERR_ASSERTION' && error.message.includes(file));
  });
}

for (const file of [...priorPaths, relocationPath, path.join(repo, relocation.historicalManifest), path.join(repo, relocation.relocationReceipt)]) {
  test(`preflight rejects changed provenance: ${path.relative(repo, file)}`, () => {
    const run = harness(new Map([[file, Buffer.concat([fs.readFileSync(file), Buffer.from('\n')])]]));
    assert.throws(() => run.runRaw(), error => error.code === 'ERR_ASSERTION');
  });
}

for (const file of [relocation.entries[1].to, 'web/lib/in-season/monthlyExecutor.ts']) {
  test(`post-run guard still rejects changed source: ${file}`, () => {
    const run = harness(); run.run();
    run.mutations.set(path.join(repo, file), Buffer.from('changed after preflight'));
    assert.throws(() => run.verifyAgain(), error => error.code === 'ERR_ASSERTION' && error.message.includes(file));
  });
}

test('missing retained SQL fails instead of falling back to the historical path', () => {
  const missing = Object.assign(new Error('missing retained SQL'), { code: 'ENOENT' });
  const run = harness(new Map([[path.join(repo, relocation.entries[1].to), missing]]));
  assert.throws(() => run.runRaw(), error => error.code === 'ENOENT');
});
