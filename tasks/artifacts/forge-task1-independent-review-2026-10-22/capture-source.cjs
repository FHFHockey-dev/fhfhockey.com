// Freeze only named candidate files and their runtime imports. Never copy environment files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = '/Users/tim/Code/fhfhockey.com';
const ts = require(path.join(root, 'web/node_modules/typescript'));
const output = __dirname;
const snapshot = path.join(output, 'snapshot');
const ownerPins = JSON.parse(fs.readFileSync(path.join(root, 'tasks/artifacts/forge-task1-scoreboard-2026-10-22/SOURCE-PINS.json')));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = {};
function capture(relative, descend = true) {
  if (manifest[relative]) return;
  const bytes = fs.readFileSync(path.join(root, relative));
  const expected = ownerPins.changedFiles[relative] ?? ownerPins.unchangedGuardFiles[relative];
  if (expected && sha(bytes) !== expected) throw new Error(`Source pin mismatch: ${relative}`);
  manifest[relative] = sha(bytes);
  const destination = path.join(snapshot, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
  if (!descend || !/\.[jt]sx?$/.test(relative)) return;
  const emitted = ts.transpileModule(bytes.toString(), {compilerOptions:{module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2022}}).outputText;
  for (const item of ts.preProcessFile(emitted).importedFiles) {
    const name = item.fileName;
    const base = name.startsWith('.') ? path.join(path.dirname(relative), name) : /^(lib|pages|utils)\//.test(name) ? path.join('web', name) : null;
    if (!base) continue;
    const dependency = [base, ...['.ts','.tsx','.js','.json','/index.ts','/index.tsx'].map(ext => base + ext)].find(p => fs.existsSync(path.join(root,p)) && fs.statSync(path.join(root,p)).isFile());
    if (!dependency) throw new Error(`Missing runtime import ${relative}: ${name}`);
    capture(dependency, dependency !== 'web/lib/supabase/server.ts'); // fully mocked by every route test
  }
}
for (const relative of Object.keys(ownerPins.changedFiles)) capture(relative);
for (const relative of Object.keys(ownerPins.unchangedGuardFiles)) capture(relative, false);
for (const relative of ['web/__tests__/vitest.setup.js', 'web/tsconfig.json', 'web/.nvmrc']) capture(relative, false);
fs.writeFileSync(path.join(output,'SNAPSHOT-PINS.json'), JSON.stringify({baseHead:ownerPins.baseHead, files:manifest, node:process.version, note:'Named candidate files plus runtime imports; Supabase fully mocked. Guard route bytes preserved for review; guard route tests not re-executed.'},null,2)+'\n');
fs.copyFileSync(path.join(root,'tasks/artifacts/forge-task1-scoreboard-2026-10-22/SOURCE-PINS.json'),path.join(output,'OWNER-SOURCE-PINS.json'));
fs.copyFileSync(path.join(root,'tasks/artifacts/forge-task1-scoreboard-2026-10-22/network-deny.cjs'),path.join(output,'network-deny.cjs'));
console.log(`Captured ${Object.keys(manifest).length} files; all eight owner pins matched.`);
