// CSS Modules pure-mode check (Next's own plugin) over every *.module.scss under web/, from the clean R' tree.
const path = require("path"), fs = require("fs");
const web = process.argv[2];
const sass = require(path.join(web, "node_modules/sass"));
const postcss = require(path.join(web, "node_modules/postcss"));
const local = require(path.join(web, "node_modules/next/dist/compiled/postcss-modules-local-by-default"));
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  if (["node_modules", ".next", ".next-playwright"].includes(e.name)) continue;
  const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith(".module.scss")) files.push(p); } })(web);
let ok = 0; const failures = [];
for (const f of files) {
  try {
    const css = sass.compile(f, { loadPaths: [web, path.join(web, "styles"), path.join(web, "node_modules")], quietDeps: true, silenceDeprecations: ["import", "global-builtin", "mixed-decls", "legacy-js-api", "color-functions"] }).css;
    postcss([local({ mode: "pure" })]).process(css, { from: f }).css; ok++;
  } catch (e) { failures.push({ file: path.relative(web, f), error: String(e.message).split("\n")[0].slice(0, 200) }); }
}
console.log(JSON.stringify({ files: files.length, ok, failures }, null, 1));
process.exit(failures.length ? 1 : 0);
