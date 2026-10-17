// Run the accepted focused native-wrapper checks against repository files.
// Frozen evidence stays unchanged; this adapter changes only the fixture's
// candidate-overlay selection to the real application paths in memory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const BASE = __dirname, ROOT = path.resolve(BASE, '../../..');
const bindings = JSON.parse(fs.readFileSync(path.join(BASE, 'source-bindings.json')));
for (const [file,hash] of Object.entries(bindings.candidateSha256)) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex'), hash, file);
}
const filename = path.join(BASE, 'native-wrapper-verification.cjs');
let native = fs.readFileSync(filename, 'utf8');
const marker = 'const moduleFixture = { exports: {} };';
assert.equal(native.split(marker).length, 2);
native = native.replace(marker, `replaceOnce('const filename = fs.existsSync(target) ? target : original;', 'const filename = original;');\n${marker}`);
console.log('Integrated verification: all five repository paths match the reviewed candidate; fixture loads repository files only.');
vm.runInThisContext(`(function(require,module,exports,__dirname,__filename){${native}\n})`,
  { filename })(createRequire(filename), module, module.exports, BASE, filename);
