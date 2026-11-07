/* Build an untracked runtime projection; canonical application files are read only. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = '/Users/tim/Code/fhfhockey.com/web';
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'fhfh-autopsy-qa-'));
const copied = new Set(['package.json', 'next.config.js', 'tsconfig.json', 'next-env.d.ts']);
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.name.startsWith('.') || entry.name === 'package-lock.json') continue;
  const source = path.join(root, entry.name), target = path.join(output, entry.name);
  if (copied.has(entry.name)) fs.copyFileSync(source, target);
  else fs.symlinkSync(source, target, entry.isDirectory() ? 'dir' : 'file');
}
const manifest = { root, output, copied: [...copied], note: 'Runtime projection only; hidden env files omitted, source entries symlinked, isolated build directory.' };
fs.writeFileSync(path.join(output, 'RUNTIME-PROJECTION.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(manifest));
