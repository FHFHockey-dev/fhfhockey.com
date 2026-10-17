// Static audit only. Reads permitted source/configuration files, writes only here.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = '/Users/tim/Code/fhfhockey.com';
const OUT = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(path.join(ROOT, 'web/package.json'));
const ts = require('typescript');
const own = path.relative(ROOT, OUT);
const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
const tracked = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, env }).toString().split('\0').filter(Boolean));
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: ROOT, env }).toString().split('\0').filter(Boolean);
const all = [...new Set([...tracked, ...untracked])].sort();
const excluded = [];
const corpus = new Map();
const hashes = [];
const textExt = /\.(?:[cm]?[jt]sx?|py|sh|scss|sass|css|md|mdc|ya?ml|html)$/;
function permitted(p) {
  if (p.startsWith(own + '/')) return false;
  const parts = p.split('/');
  if (parts.some(x => ['node_modules', '.git', '.vercel', '.aws', '.ssh', 'artifacts', 'evidence', 'output', 'outputs', 'datasets', 'data', 'correlations'].includes(x) || x.startsWith('.env') || x.startsWith('.next'))) return false;
  if (p.startsWith('docs/player-projections/')) return false;
  if (/(?:token|credential|secret|private[-_]?key|training|evaluation|outcomes|holdout|heldout|hold-out)/i.test(path.basename(p)) && !textExt.test(p)) return false;
  return textExt.test(p) || /(?:^|\/)(?:package|tsconfig|vercel|sanity|jsconfig|\.eslintrc)\.json$/.test(p) || /(?:^|\/)\.gitignore$/.test(p);
}
for (const p of all) {
  if (!permitted(p)) { excluded.push(p); continue; }
  const absolute = path.join(ROOT, p);
  if (!fs.existsSync(absolute) || !fs.lstatSync(absolute).isFile()) continue;
  const bytes = fs.readFileSync(absolute);
  const text = bytes.toString('utf8');
  corpus.set(p, text);
  hashes.push({ path: p, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), tracked: tracked.has(p) });
}
const config = ts.readConfigFile(path.join(ROOT, 'web/tsconfig.json'), ts.sys.readFile).config;
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, path.join(ROOT, 'web'));
const edges = [], unresolved = [], dynamic = [], importless = [];
const knownFiles = new Set(all);
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.css', '.scss', '.json', '.svg'];
function relativeResolution(spec, importer) {
  let base;
  if (spec.startsWith('.')) base = path.resolve(ROOT, path.dirname(importer), spec);
  else if (importer.startsWith('web/') && /^(components|contexts|hooks|lib|pages|public|styles|utils)\//.test(spec)) base = path.resolve(ROOT, 'web', spec);
  else return null;
  for (const candidate of [base, ...extensions.map(e => base + e), ...extensions.map(e => path.join(base, 'index' + e))]) {
    const rel = path.relative(ROOT, candidate);
    if (knownFiles.has(rel)) return rel;
  }
  return null;
}
function localLike(spec) { return /^(\.|components\/|contexts\/|hooks\/|lib\/|pages\/|public\/|styles\/|utils\/)/.test(spec); }
for (const [p, text] of corpus) {
  if (!/\.[cm]?[jt]sx?$/.test(p)) continue;
  const sf = ts.createSourceFile(p, text, ts.ScriptTarget.Latest, true);
  function add(spec, node, kind) {
    if (typeof spec !== 'string') { dynamic.push({ path: p, line: sf.getLineAndCharacterOfPosition(node.pos).line + 1, kind }); return; }
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const result = ts.resolveModuleName(spec, path.join(ROOT, p), p.startsWith('web/') ? parsed.options : {}, ts.sys).resolvedModule;
    let target = result?.resolvedFileName ? path.relative(ROOT, result.resolvedFileName) : relativeResolution(spec, p);
    if (target && !target.includes('node_modules/') && !target.startsWith('../')) edges.push({ importer: p, line, target, kind, specifier: spec });
    else if (!result && localLike(spec)) unresolved.push({ importer: p, line, specifier: spec, kind });
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) add(node.moduleSpecifier.text, node, ts.isImportDeclaration(node) ? 'import' : 'export');
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node.moduleReference.expression?.text, node, 'import-equals');
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require') || (ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(sf) === 'require' && node.expression.name.text === 'resolve'))) {
      const arg = node.arguments[0];
      add(arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) ? arg.text : undefined, node, 'call');
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL' && node.arguments?.length === 2 && node.arguments[1].getText(sf) === 'import.meta.url') {
      const arg = node.arguments[0];
      add(ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg) ? arg.text : undefined, node, 'import-meta-url');
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}
const incoming = new Map();
for (const e of edges) {
  const existing = incoming.get(e.target) ?? [];
  existing.push({ path: e.importer, line: e.line, kind: e.kind });
  incoming.set(e.target, existing);
}
for (const row of hashes) {
  if (!/\.[cm]?[jt]sx?$/.test(row.path) || incoming.has(row.path)) continue;
  const role = row.path.startsWith('web/pages/') ? 'implicit-next-route-keep' : /\.(test|spec)\.[cm]?[jt]sx?$|__tests__|\/e2e\//.test(row.path) ? 'test-entrypoint-keep' : /\/scripts\/|^(?:[^/]+\.(?:js|py|sh))$|(?:config|\.d)\.[cm]?[jt]sx?$/.test(row.path) ? 'script-config-or-type-entrypoint-review' : 'no-static-import-owner-review';
  importless.push({ ...row, role });
}
function mentions(needles, omit = new Set()) {
  const found = [];
  for (const [p, text] of corpus) {
    if (omit.has(p)) continue;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const hits = needles.filter(needle => needle && lines[i].includes(needle));
      if (hits.length) found.push({ path: p, line: i + 1, needles: hits });
    }
  }
  return found;
}
const assets = all.filter(p => p.startsWith('web/public/') && !/(^|\/)\.DS_Store$/.test(p)).map(p => {
  const url = p.slice('web/public'.length);
  const name = path.basename(p);
  const hits = mentions([url, p, name], new Set([p]));
  const runtime = hits.filter(x => /^(web|cms|functions)\//.test(x.path) && !/\/(__tests__|e2e|prep-chef|rules|tasks)\/|\.(test|spec)\.|\.md$/.test(x.path));
  return { path: p, bytes: fs.statSync(path.join(ROOT, p)).size, references: hits, runtime_literal_references: runtime, status: runtime.length ? 'literal-consumer-found' : 'review-dynamic-cms-external-use' };
});
const docGroups = new Map();
for (const row of hashes.filter(x => /\.mdc?$/.test(x.path))) {
  const key = row.sha256;
  docGroups.set(key, [...(docGroups.get(key) ?? []), row]);
}
const duplicateDocuments = [...docGroups.entries()].filter(([_, rows]) => rows.length > 1).map(([sha256, rows]) => ({ sha256, bytes_each: rows[0].bytes, paths: rows.map(x => x.path), references: rows.map(x => ({ path: x.path, references: mentions([x.path, path.basename(x.path)], new Set(rows.map(y => y.path))) })) }));
const sourceGroups = new Map();
for (const row of hashes.filter(x => /\.(?:[cm]?[jt]sx?|s?css)$/.test(x.path) && x.bytes > 0)) sourceGroups.set(row.sha256, [...(sourceGroups.get(row.sha256) ?? []), row]);
const duplicateSources = [...sourceGroups.entries()].filter(([_, rows]) => rows.length > 1).map(([sha256, rows]) => ({ sha256, bytes_each: rows[0].bytes, paths: rows.map(x => x.path), incoming: rows.map(x => ({ path: x.path, incoming: incoming.get(x.path) ?? [], implicit_route: x.path.startsWith('web/pages/') })) }));
const targets = ['patch_layout.js','find_templates.py','fix_templates.py','safe_properties.py','update_game_page.py','fix_terminal.sh','check_db.js','web/debug-goalies.ts','web/npm','web/components/TeamLandingPage/teamLandingPage.css','web/pages/stats/game/[gameId].module.scss','web/components/GamePreview/GamePreview.module.scss','cms/sanity.json','web/rules/super-goal.md','tasks/TASKS/cron-operations/cron-schedule.md'];
const candidateReferences = targets.map(p => ({ path:p, exists:fs.existsSync(path.join(ROOT,p)), bytes:fs.existsSync(path.join(ROOT,p))?fs.statSync(path.join(ROOT,p)).size:null, incoming: incoming.get(p) ?? [], references:mentions(path.extname(p) ? [p, path.basename(p)] : [p],new Set([p])) }));
const documents = hashes.filter(x=>/\.mdc?$/.test(x.path)).map(row=>({ ...row, checked_tasks:(corpus.get(row.path).match(/^\s*[-*]\s+\[[xX]\]/gm)??[]).length, unchecked_tasks:(corpus.get(row.path).match(/^\s*[-*]\s+\[ \]/gm)??[]).length }));
for (const [name, data] of Object.entries({ 'permitted-source-hashes.json':hashes, 'content-exclusions.json':excluded, 'import-edges.json':edges, 'unresolved-imports.json':unresolved, 'dynamic-import-observations.json':dynamic, 'no-static-inbound-review.json':importless, 'asset-references.json':assets, 'duplicate-documents.json':duplicateDocuments, 'duplicate-sources.json':duplicateSources, 'candidate-references.json':candidateReferences, 'document-inventory.json':documents })) fs.writeFileSync(path.join(OUT,name),JSON.stringify(data,null,2)+'\n');
const summary={timestamp_utc:new Date().toISOString(),corpus_files:corpus.size,content_excluded:excluded.length,import_edges:edges.length,unresolved:unresolved.length,dynamic:dynamic.length,no_static_inbound:importless.length,assets:assets.length,assets_without_runtime_literal:assets.filter(x=>!x.runtime_literal_references.length).length,duplicate_document_groups:duplicateDocuments.length,duplicate_source_groups:duplicateSources.length,documents:documents.length,documents_with_unchecked:documents.filter(x=>x.unchecked_tasks>0).length,limitations:['Static imports are not complete runtime reachability. Next routes, scripts, CSS links, JSON/file readers, scheduled jobs and external/manual users require independent ownership checks.','Literal asset references include basename matches; absence is not proof of non-use. Dynamic/CMS/external asset consumers are not observed.','No artifact/evidence/output bodies, environment files, Git object bodies or data files are included. Metadata inventory covers excluded paths.','No application import, execution, test, network or database call occurred.']};
fs.writeFileSync(path.join(OUT,'source-scan-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
