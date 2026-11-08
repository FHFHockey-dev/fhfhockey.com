// For each RC-included web file (at the RC tree), resolve its imports and report any target that differs between the RC
// and the reviewed branch tip (i.e. a module whose content the included file might rely on but the RC does not carry).
const fs = require("fs"), path = require("path");
const [root, rcFilesPath, webDiffPath] = process.argv.slice(2);
const included = fs.readFileSync(rcFilesPath, "utf8").split("\n").filter(f => f.startsWith("web/") && /\.(tsx?|jsx?|mjs)$/.test(f));
const drift = new Set(fs.readFileSync(webDiffPath, "utf8").split("\n").filter(Boolean));
const exts = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js"];
const resolve = (from, spec) => {
  let base;
  if (spec.startsWith(".")) base = path.join(path.dirname(from), spec);
  else if (/^(lib|components|hooks|pages|utils|contexts|styles|public)\//.test(spec)) base = path.join("web", spec);
  else return null;
  for (const ext of exts) { const p = base + ext; if (fs.existsSync(path.join(root, p)) && fs.statSync(path.join(root, p)).isFile()) return p; }
  return `${base} (unresolved)`;
};
const hits = [];
for (const file of included) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  const specs = [...text.matchAll(/(?:import|export)[^"']*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)|vi\.mock\(\s*["']([^"']+)["']/g)].map(m => m[1] || m[2] || m[3] || m[4]);
  for (const spec of new Set(specs)) {
    const target = resolve(file, spec);
    if (target && (drift.has(target) || target.endsWith("(unresolved)"))) hits.push(`${file} -> ${spec} => ${target}`);
  }
}
console.log(JSON.stringify({ includedCodeFiles: included.length, driftFiles: drift.size, hits }, null, 2));
