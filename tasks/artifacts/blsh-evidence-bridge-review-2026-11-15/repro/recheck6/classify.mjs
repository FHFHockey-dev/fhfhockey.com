// RECHECK-6: classify dumped require.cache keys against the operator's G3 baseline closure (read-only).
// argv: <baseline.json> <dump.json>... ; prints per-dump counts, files outside the closure, and files not in the static listing.
import { readFileSync, realpathSync, existsSync } from "node:fs";
const WEB = "/Users/tim/Code/fhfhockey.com/web";
const [basePath, ...dumps] = process.argv.slice(2);
const base = JSON.parse(readFileSync(basePath, "utf8"));
const listing = JSON.parse(readFileSync("/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/evidence/LOADED-MODULES-COVERAGE-v5.json", "utf8"));
const staticSet = new Set(listing.classified.filter(f => f.path).map(f => f.path));
const pkgs = base.packages.map(p => WEB + "/" + p.path + "/").sort((a, b) => b.length - a.length);
const roles = new Set([...base.sources.roles.map(r => r.path), "scripts/blsh/nativeProcessCaptureBootstrap.ts"]);
for (const d of dumps) {
  const { cacheKeys, builtins } = JSON.parse(readFileSync(d, "utf8"));
  const res = { dump: d.split("/").pop(), files: cacheKeys.length, package: 0, role: 0, harness: [], outsideClosure: [], notInStaticListing: [], builtins: builtins.length };
  for (const k of cacheKeys) {
    const real = existsSync(k) ? realpathSync(k) : k;
    if (!real.startsWith(WEB + "/")) { res.harness.push(real.split("/").slice(-2).join("/")); continue; }
    const rel = real.slice(WEB.length + 1);
    const pkg = pkgs.find(p => real.startsWith(p));
    if (roles.has(rel)) res.role++;
    else if (pkg && !real.slice(pkg.length).split("/").includes("node_modules")) res.package++;
    else res.outsideClosure.push(rel);
    if (!staticSet.has(rel)) res.notInStaticListing.push(rel);
  }
  console.log(JSON.stringify(res, null, 1));
}
