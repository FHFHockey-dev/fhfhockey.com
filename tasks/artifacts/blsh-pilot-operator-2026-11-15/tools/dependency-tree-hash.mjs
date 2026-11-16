// BLSH pilot operator: hash the runtime dependency closure of the capture bootstrap (packet gate G3).
// Offline and read-only. Never installs, writes into, or changes node_modules.
//
// Usage:
//   node dependency-tree-hash.mjs [--web <web dir>] [--sources <web dir holding the v4 sources>] [--out <file>] [--baseline <file>]
//   --web      directory whose node_modules is hashed and from which Node resolution starts (default: canonical web/)
//   --sources  directory with scripts/blsh/** and lib/** to read imports from (default: --web). For the pre-apply
//              baseline this is a scratch export with SUCCESSOR.patch applied; after apply it is web/ itself.
//   --out      write the manifest JSON here (otherwise stdout)
//   --baseline compare against a saved manifest: exit 0 + {"dependencyTree":"match"} or exit 1 + {"dependencyTree":"refuse",...}
//   --loaded   (with --baseline) list and classify every file the capture modules load; spawned only if the tree matched
//
// R0 (RECHECK-6): nothing from the checked tree runs before it is hashed. typescript is verified against TYPESCRIPT_PIN
// (in this file) and compiled from the hashed Buffer with a builtins-only require. Any DYLD_* key in env refuses.
//
// Closure = the bootstrap's DEPENDENCIES packages + every runtime (non-type-only) bare import reachable through local
// imports from the bootstrap and the nine SOURCE_PINS roles, then each package's dependencies/optionalDependencies,
// resolved like Node (nearest node_modules walking up from the requirer's real directory). Each resolved package
// directory is hashed: every regular file, sorted by relative path, excluding nested node_modules (those are
// separate packages, hashed only if they are in the closure). Symlinks pointing outside web/node_modules refuse.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { builtinModules, createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { compileFunction } from "node:vm";

process.on("uncaughtException", error => {
  process.stdout.write(JSON.stringify({ dependencyTree: "refuse", error: String(error?.code ?? error?.message ?? error) }) + "\n");
  process.exit(1);
});
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const WEB = realpathSync(arg("web", "/Users/tim/Code/fhfhockey.com/web"));
const SOURCES = realpathSync(arg("sources", WEB));
const NM = join(WEB, "node_modules");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { const e = new Error(code); e.code = code; throw e; };
const rel = p => relative(WEB, p).split(sep).join("/");
const inside = (p, root) => p === root || p.startsWith(root + sep);
const builtins = new Set(builtinModules.flatMap(m => [m, `node:${m}`]));

// ---------- roots from the (v4) bootstrap ----------
const BOOTSTRAP = join(SOURCES, "scripts/blsh/nativeProcessCaptureBootstrap.ts");
const bootstrapText = readFileSync(BOOTSTRAP, "utf8");
const pinBlock = /const SOURCE_PINS = \{([\s\S]*?)\} as const;/.exec(bootstrapText)?.[1] ?? fail("bootstrap_source_pins_unparsed");
const roles = [...pinBlock.matchAll(/(\w+): \["([^"]+)", "([0-9a-f]{64})"\]/g)].map(m => ({ role: m[1], path: m[2], pin: m[3] }));
if (roles.length !== 9) fail("bootstrap_source_pins_not_nine");
const depBlock = /const DEPENDENCIES = \[([\s\S]*?)\] as const;/.exec(bootstrapText)?.[1] ?? fail("bootstrap_dependencies_unparsed");
const pinnedDeps = [...depBlock.matchAll(/\["([^"]+)", "([^"]+)", "([0-9a-f]{64})", "([0-9a-f]{64})"\]/g)]
  .map(m => ({ name: m[1], entry: m[2], entrySHA256: m[3], manifestSHA256: m[4] }));
if (pinnedDeps.length !== 4) fail("bootstrap_dependencies_not_four");

// ---------- R0 (RECHECK-6): run nothing from the checked tree before hashing it ----------
// The import scan needs the TypeScript parser, which lives in the tree being checked. So: hash the whole
// node_modules/typescript directory with builtins-only code, compare it with a pin held HERE (outside the tree, and
// equal to the 4534fd65 baseline record; typescript 5.7.3 is byte-identical to its lockfile tarball per RECHECK-6
// provenance.py), then compile the exact Buffer that was hashed (no second disk read), with a require that serves
// Node builtins only. A forged typescript.js is refused before a single byte of it runs.
const TYPESCRIPT_PIN = { path: "node_modules/typescript", name: "typescript", version: "5.7.3", files: 129,
  sha256: "3556c8c4764b5c0bd2276af5ccac31352355dd24caab158a7065f68adb1956fd",
  entry: "lib/typescript.js", entrySHA256: "0fba5508ecbe50cd00a45f132a76582fb22a4ec55769fd3d794fd0e026f9fb67" };
const startedAtUTC = new Date().toISOString();
const dyldKeys = Object.keys(process.env).filter(k => k.startsWith("DYLD_")).sort();
if (dyldKeys.length) fail("dyld_env_present");
function loadPinnedTypeScript() {
  const dir = join(NM, "typescript");
  if (!existsSync(dir) || lstatSync(dir).isSymbolicLink() || realpathSync(dir) !== dir) fail("typescript_not_plain_directory");
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  if (manifest.name !== TYPESCRIPT_PIN.name || manifest.version !== TYPESCRIPT_PIN.version) fail("typescript_version_not_pinned");
  const h = hashPackage(dir, TYPESCRIPT_PIN.entry);
  if (h.files !== TYPESCRIPT_PIN.files || h.sha256 !== TYPESCRIPT_PIN.sha256 || h.nestedNodeModules !== 0) fail("typescript_package_hash_mismatch");
  if (!h.kept || sha(h.kept) !== TYPESCRIPT_PIN.entrySHA256) fail("typescript_entry_hash_mismatch");
  const nodeRequire = createRequire(import.meta.url);
  const builtinOnly = spec => builtins.has(spec) ? nodeRequire(spec) : fail(`typescript_required_non_builtin:${spec}`);
  const filename = join(dir, TYPESCRIPT_PIN.entry), mod = { exports: {} };
  compileFunction(h.kept.toString("utf8"), ["exports", "require", "module", "__filename", "__dirname"], { filename })
    .call(mod.exports, mod.exports, builtinOnly, mod, filename, dirname(filename));
  return mod.exports;
}

// ---------- runtime imports via the TypeScript AST (type-only forms are erased at runtime) ----------
// (hashPackage is a function declaration further down: hoisted, builtins-only.)
const ts = loadPinnedTypeScript();
if (typeof ts.createSourceFile !== "function") fail("typescript_load_failed");
function runtimeSpecifiers(file) {
  const src = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const out = [], typeOnly = [];
  const visit = node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      (node.importClause?.isTypeOnly ? typeOnly : out).push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      (node.isTypeOnly ? typeOnly : out).push(node.moduleSpecifier.text);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
      && ts.isStringLiteral(node.moduleReference.expression)) {
      (node.isTypeOnly ? typeOnly : out).push(node.moduleReference.expression.text);
    } else if (ts.isCallExpression(node) && node.arguments.length >= 1 && ts.isStringLiteralLike(node.arguments[0])
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      out.push(node.arguments[0].text);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      typeOnly.push(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return { out: [...new Set(out)], typeOnly: [...new Set(typeOnly)] };
}
const EXT = [".ts", ".tsx", ".js", ".cjs", ".mjs", ".json", "/index.ts", "/index.js"];
const localFile = base => { for (const e of ["", ...EXT]) { const p = base + e; if (existsSync(p) && statSync(p).isFile()) return p; } return null; };
const packageName = spec => spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];

// Node: node_modules lookup walking up from the requirer's directory; NODE_PATH (".") only after that.
function findPackageDir(name, fromDir) {
  for (let d = fromDir; ; d = dirname(d)) {
    if (!d.endsWith(`${sep}node_modules`)) {
      const candidate = join(d, "node_modules", name);
      if (existsSync(join(candidate, "package.json"))) return candidate;
    }
    if (dirname(d) === d) return null;
  }
}

const seenFiles = new Set(), queue = [BOOTSTRAP, ...roles.map(r => join(SOURCES, r.path))];
const starts = new Map(pinnedDeps.map(d => [d.name, { from: WEB, reason: "bootstrap DEPENDENCIES" }]));
const typeOnlyIgnored = new Set(), localFiles = [];
while (queue.length) {
  const file = queue.shift();
  if (seenFiles.has(file)) continue;
  seenFiles.add(file);
  localFiles.push(relative(SOURCES, file).split(sep).join("/"));
  const { out, typeOnly } = runtimeSpecifiers(file);
  typeOnly.forEach(s => typeOnlyIgnored.add(s));
  for (const spec of out) {
    if (builtins.has(spec)) continue;
    // Resolution base: the same relative directory under the real web/ (sources may be a scratch export).
    const requirerDir = join(WEB, relative(SOURCES, dirname(file)));
    if (spec.startsWith(".") || spec.startsWith("/")) {
      const hit = localFile(resolve(dirname(file), spec)) ?? fail(`local_import_unresolved:${spec}`);
      queue.push(hit); continue;
    }
    const pkgDir = findPackageDir(packageName(spec), requirerDir);
    if (pkgDir) { if (!starts.has(packageName(spec))) starts.set(packageName(spec), { from: requirerDir, reason: `import from ${rel(join(WEB, relative(SOURCES, file)))}` }); continue; }
    const viaNodePath = localFile(join(SOURCES, spec)) ?? fail(`bare_import_unresolved:${spec}`);
    queue.push(viaNodePath);
  }
}

// ---------- package walk ----------
const packages = new Map(), optionalAbsent = [], peerNotWalked = new Map(), refusals = [];
function hashPackage(dir, keepRel) {
  const entries = [];
  let nestedNodeModules = 0, kept = null;
  const walk = d => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name), st = lstatSync(p);
      if (st.isSymbolicLink()) {
        let target;
        try { target = realpathSync(p); } catch { fail(`symlink_dangling:${rel(p)}`); }
        if (!inside(target, NM)) fail(`symlink_outside_tree:${rel(p)}`);
        entries.push([relative(dir, p).split(sep).join("/"), `link:${rel(target)}`]);
      } else if (st.isDirectory()) {
        if (name === "node_modules") { nestedNodeModules++; continue; }
        walk(p);
      } else if (st.isFile()) {
        const r = relative(dir, p).split(sep).join("/"), bytes = readFileSync(p);
        if (r === keepRel) kept = bytes;
        entries.push([r, sha(bytes)]);
      } else fail(`non_regular_file:${rel(p)}`);
    }
  };
  walk(dir);
  entries.sort((a, b) => Buffer.compare(Buffer.from(a[0]), Buffer.from(b[0])));
  return { files: entries.length, sha256: sha(entries.map(([p, h]) => `${p}\0${h}\n`).join("")), nestedNodeModules, kept };
}
function visitPackage(name, fromDir, requiredBy, optional) {
  const found = findPackageDir(name, fromDir);
  if (!found) { if (optional) { optionalAbsent.push({ name, requiredBy }); return; } fail(`dependency_unresolved:${name}<-${requiredBy}`); }
  const real = realpathSync(found);
  if (!inside(real, NM)) fail(`package_outside_tree:${name}`);
  const key = rel(real);
  if (packages.has(key)) { packages.get(key).requiredBy.add(requiredBy); return; }
  const manifest = JSON.parse(readFileSync(join(real, "package.json"), "utf8"));
  const record = { name: manifest.name ?? name, version: manifest.version ?? null, path: key, requiredBy: new Set([requiredBy]) };
  packages.set(key, record);
  Object.assign(record, hashPackage(real));
  if (manifest.peerDependencies) peerNotWalked.set(key, Object.keys(manifest.peerDependencies).sort());
  for (const dep of Object.keys(manifest.dependencies ?? {})) visitPackage(dep, real, key, false);
  for (const dep of Object.keys(manifest.optionalDependencies ?? {})) if (!(manifest.dependencies ?? {})[dep]) visitPackage(dep, real, key, true);
}
for (const [name, { from, reason }] of starts) visitPackage(name, from, reason, false);

// ---------- exclusions and pin check ----------
const excluded = [];
const selfLink = join(NM, "node_modules");
if (existsSync(selfLink) || (() => { try { return lstatSync(selfLink).isSymbolicLink(); } catch { return false; } })()) {
  const st = lstatSync(selfLink);
  const target = st.isSymbolicLink() ? readlinkSync(selfLink) : null;
  const pointsHome = target !== null && realpathSync(selfLink) === realpathSync(NM);
  if (!pointsHome) fail("node_modules_self_link_unexpected");
  excluded.push({ path: "node_modules/node_modules", kind: "symlink", target: "node_modules (self)",
    reason: "pre-existing self-symlink to web/node_modules (Oct 20); not a package; never entered by the walk or by Node resolution of any closure package" });
}
const require = createRequire(join(WEB, "scripts/blsh/nativeProcessCaptureBootstrap.ts"));
const pinCheck = pinnedDeps.map(d => {
  const resolvedEntry = require.resolve(d.name);
  const entryOk = resolvedEntry === join(WEB, d.entry) && sha(readFileSync(join(WEB, d.entry))) === d.entrySHA256;
  const manifestOk = sha(readFileSync(join(NM, d.name, "package.json"))) === d.manifestSHA256;
  return { name: d.name, entry: d.entry, entryMatches: entryOk, manifestMatches: manifestOk };
});

const list = [...packages.values()].map(p => ({ name: p.name, version: p.version, path: p.path, files: p.files, sha256: p.sha256,
  nestedNodeModulesSkipped: p.nestedNodeModules, requiredBy: [...p.requiredBy].sort() }))
  .sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
const treeSHA256 = sha(list.map(p => `${p.path}\t${p.name}@${p.version}\t${p.files}\t${p.sha256}\n`).join(""));
const result = {
  version: "fhfh.blsh.dependency-tree.v1",
  webRoot: "web (relative paths below)",
  sources: { bootstrapSHA256: sha(readFileSync(BOOTSTRAP)), roles: roles.map(r => ({ role: r.role, path: r.path, pin: r.pin, matches: sha(readFileSync(join(SOURCES, r.path))) === r.pin })),
    localFilesWalked: localFiles.sort(), typeOnlySpecifiersIgnored: [...typeOnlyIgnored].sort() },
  startPackages: [...starts.keys()].sort(),
  packageCount: list.length,
  fileCount: list.reduce((n, p) => n + p.files, 0),
  treeSHA256,
  packages: list,
  optionalAbsent,
  peerDependenciesNotWalked: Object.fromEntries([...peerNotWalked].sort()),
  excluded,
  bootstrapDependencyPins: { allMatch: pinCheck.every(p => p.entryMatches && p.manifestMatches), entries: pinCheck },
  refusals,
};

if (!result.bootstrapDependencyPins.allMatch || !result.sources.roles.every(r => r.matches)) process.exitCode = 1;

// ---------- loaded-file coverage (RECHECK-4 item 3, option 1) ----------
// Launch tools/list-loaded-modules.cjs exactly like the bootstrap (cwd = sources, env -i + loader env, pinned
// ts-node register), then classify every require.cache file: v5 SOURCE_PIN role (hash checked), the candidate
// bootstrap (hash checked), a file inside a G3 package directory (hash-covered by the tree check), the listing
// harness itself (excluded: in the real run the bootstrap is the entry), or UNCOVERED. Builtins are reported.
function classifyLoaded(expectedBootstrapSHA256) {
  const harness = join(dirname(new URL(import.meta.url).pathname), "list-loaded-modules.cjs");
  const tmp = process.env.TMPDIR ?? fail("loaded_listing_needs_scratch_tmpdir");
  const child = spawnSync("/usr/local/bin/node", ["--require", "./node_modules/ts-node/register/transpile-only", harness], {
    cwd: SOURCES, encoding: "utf8", timeout: 60_000,
    env: { PATH: "/usr/bin:/bin", TMPDIR: tmp, NODE_PATH: ".", DISABLE_V8_COMPILE_CACHE: "1",
      TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node"}' } });
  let listing;
  try { listing = JSON.parse(child.stdout); } catch { return { error: `exit_${child.status}`, files: 0, counts: {}, packagesTouched: 0, builtinsLoadedByCaptureModules: [], uncovered: [] }; }
  const pkgDirs = list.map(p => ({ path: p.path, abs: join(WEB, p.path) + sep })).sort((a, b) => b.abs.length - a.abs.length);
  const rolesByRel = new Map(roles.map(r => [r.path, r]));
  const bootstrapRel = "scripts/blsh/nativeProcessCaptureBootstrap.ts";
  const files = [], uncovered = [], counts = { role: 0, bootstrap: 0, package: 0, harness: 0, uncovered: 0 }, touched = new Set();
  for (const key of listing.cacheKeys) {
    const real = existsSync(key) ? realpathSync(key) : key;
    let cls;
    if (real === realpathSync(harness)) cls = { class: "harness", note: "listing entry script; the real run's entry is the bootstrap" };
    else if (inside(real, SOURCES) && !inside(real, NM) && !inside(real, join(SOURCES, "node_modules"))) {
      const r = relative(SOURCES, real).split(sep).join("/");
      const digest = sha(readFileSync(real));
      if (r === bootstrapRel && digest === expectedBootstrapSHA256) cls = { class: "bootstrap", path: r };
      else if (rolesByRel.has(r) && rolesByRel.get(r).pin === digest) cls = { class: "role", role: rolesByRel.get(r).role, path: r };
      else cls = { class: "uncovered", path: r, reason: "web file outside the pinned roles/bootstrap, or hash differs" };
    } else if (inside(real, NM)) {
      const pkg = pkgDirs.find(p => real.startsWith(p.abs));
      const rest = pkg ? real.slice(pkg.abs.length) : null;
      if (pkg && !rest.split("/").includes("node_modules")) { cls = { class: "package", package: pkg.path, path: rel(real) }; touched.add(pkg.path); }
      else cls = { class: "uncovered", path: rel(real), reason: "node_modules file outside every G3 closure package" };
    } else cls = { class: "uncovered", path: real, reason: "outside web/ and outside the sources" };
    counts[cls.class]++;
    if (cls.class === "uncovered") uncovered.push(cls.path);
    files.push(cls);
  }
  return { version: "fhfh.blsh.loaded-file-coverage.v1", launcherExecArgv: listing.execArgv, files: listing.cacheKeys.length, counts,
    packagesTouched: touched.size, packagesTouchedList: [...touched].sort(), builtins: listing.builtins,
    builtinsLoadedByCaptureModules: listing.builtinsLoadedByCaptureModules, uncovered,
    notRequireCached: "fs-read inputs are not in require.cache: web/tsconfig.json (pinned by the bootstrap, bf729d54…) and package.json files read during resolution (inside G3 package directories)",
    classified: files.map(f => ({ ...f })) };
}
const baselinePath = arg("baseline");
if (baselinePath) {
  const base = JSON.parse(readFileSync(baselinePath, "utf8"));
  const byPath = new Map(base.packages.map(p => [p.path, p]));
  const diffs = [];
  for (const p of list) {
    const b = byPath.get(p.path);
    if (!b) diffs.push(`added:${p.path}`);
    else if (b.sha256 !== p.sha256 || b.files !== p.files || b.version !== p.version) diffs.push(`changed:${p.path}`);
    byPath.delete(p.path);
  }
  for (const k of byPath.keys()) diffs.push(`removed:${k}`);
  if (base.treeSHA256 !== treeSHA256 && diffs.length === 0) diffs.push("tree_hash_mismatch");
  if (!result.bootstrapDependencyPins.allMatch) diffs.push("bootstrap_dependency_pin_mismatch");
  if (!result.sources.roles.every(r => r.matches)) diffs.push("source_role_pin_mismatch");
  if (result.sources.bootstrapSHA256 !== base.sources.bootstrapSHA256) diffs.push("bootstrap_differs_from_baseline");
  const basePin = base.packages.find(p => p.path === TYPESCRIPT_PIN.path);
  if (!basePin || basePin.sha256 !== TYPESCRIPT_PIN.sha256 || basePin.files !== TYPESCRIPT_PIN.files || basePin.version !== TYPESCRIPT_PIN.version)
    diffs.push("baseline_typescript_differs_from_tool_pin");
  let loaded;
  // The listing child runs ts-node/typescript/the capture modules from the tree, so it is spawned only after the
  // whole tree, pins and bootstrap have matched (R0): tampered tree code is never executed, even in the child.
  if (process.argv.includes("--loaded") && diffs.length) diffs.push("loaded_listing_skipped_tree_refused");
  else if (process.argv.includes("--loaded")) {
    loaded = classifyLoaded(base.sources.bootstrapSHA256);
    for (const f of loaded.uncovered) diffs.push(`loaded_file_uncovered:${f}`);
    if (loaded.error) diffs.push(`loaded_listing_failed:${loaded.error}`);
    const out = arg("loaded-out");
    if (out) writeFileSync(out, JSON.stringify(loaded, null, 1) + "\n");
  }
  const ok = diffs.length === 0;
  process.stdout.write(JSON.stringify({ dependencyTree: ok ? "match" : "refuse", startedAtUTC, finishedAtUTC: new Date().toISOString(),
    checkerTypeScript: "verified_before_load", dyldKeysPresent: false, treeSHA256, baselineTreeSHA256: base.treeSHA256,
    ...(loaded ? { loaded: { files: loaded.files, roles: loaded.counts.role, bootstrap: loaded.counts.bootstrap, packageFiles: loaded.counts.package,
      packages: loaded.packagesTouched, builtins: loaded.builtinsLoadedByCaptureModules.length, uncovered: loaded.uncovered } } : {}),
    differences: diffs }) + "\n");
  process.exitCode = ok ? 0 : 1;
} else {
  const text = JSON.stringify(result, null, 1) + "\n";
  const out = arg("out");
  if (out) writeFileSync(out, text); else process.stdout.write(text);
}
