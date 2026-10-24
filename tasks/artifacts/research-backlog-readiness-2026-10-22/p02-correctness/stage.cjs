// Copy only the leased tests/sources and their local import closure. No env/data crawl.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const repo = path.resolve(__dirname, '../../../..');
const ts = require(path.join(repo, 'web/node_modules/typescript'));
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'BASELINE.json'), 'utf8'));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fhfh-p02-check-'));
const web = path.join(root, 'isolation/snapshot/web');
fs.mkdirSync(web, { recursive: true });
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const names = [...baseline.files.map(f => f.path),
  'web/components/StatsPage/MobileTabInterface.test.tsx',
  'web/__tests__/pages/stats/index.test.tsx',
  'web/__tests__/vitest.setup.js', 'web/tsconfig.json', 'web/package.json', 'web/next-bootstrap.d.ts',
  'web/eslint.config.mjs'];
const aliases = ['components', 'contexts', 'hooks', 'lib', 'pages', 'styles', 'utils'];
const copied = new Map();
function localImport(name, parent) {
  const base = name.startsWith('.') ? path.resolve(path.dirname(parent), name)
    : aliases.some(a => name.startsWith(a + '/')) ? path.join(repo, 'web', name) : null;
  if (!base) return null;
  const candidates = [base, ...['.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.scss','.css'].map(ext => base + ext),
    ...['.ts','.tsx','.js','.jsx'].map(ext => path.join(base, 'index' + ext))];
  return candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile()) ?? null;
}
function copy(file) {
  const relative = path.relative(repo, file).split(path.sep).join('/');
  if (copied.has(relative)) return;
  if (!relative.startsWith('web/') || /(^|\/)(\.env[^/]*|credentials[^/]*|secrets[^/]*|session-store[^/]*)(\/|$)/i.test(relative)) {
    throw Error('Excluded input: ' + relative);
  }
  const data = fs.readFileSync(file);
  copied.set(relative, hash(data));
  const target = path.join(web, path.relative(path.join(repo, 'web'), file));
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, data);
  if (/\.[cm]?[jt]sx?$/.test(file)) {
    for (const item of ts.preProcessFile(data.toString('utf8'), true, true).importedFiles) {
      const dependency = localImport(item.fileName, file);
      if (dependency) copy(dependency);
    }
  }
}
for (const name of names) copy(path.join(repo, name));
for (const [name, sha] of copied) if (hash(fs.readFileSync(path.join(repo, name))) !== sha) throw Error('Source drift: ' + name);
fs.symlinkSync(path.join(repo, 'web/node_modules'), path.join(web, 'node_modules'), 'dir');
const recipe = path.join(repo, 'tasks/artifacts/claude-audit-fix-queue-2026-10-22/repros');
for (const [from, to] of [['offline.cjs','audit-network-deny.cjs'],['audit.offline.setup.ts','audit.offline.setup.ts']]) {
  fs.copyFileSync(path.join(recipe, from), path.join(web, to));
}
const config = fs.readFileSync(path.join(recipe, 'audit.vitest.config.mts'), 'utf8')
  .replace('/tmp/fhfh-claude-audit-20261022/vite-cache', path.join(root, 'vite-cache'));
fs.writeFileSync(path.join(web, 'audit.vitest.config.mts'), config);
fs.writeFileSync(path.join(web, 'tsconfig.p02.json'), JSON.stringify({ extends: './tsconfig.json', include: [
  'next-bootstrap.d.ts', ...baseline.files.map(f => f.path.slice(4)),
  'components/StatsPage/MobileTabInterface.tsx', 'pages/stats/index.tsx'
] }, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'SOURCE.json'), JSON.stringify({
  head: cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
  files: Object.fromEntries(copied), web
}, null, 2) + '\n');
process.stdout.write(web + '\n');
