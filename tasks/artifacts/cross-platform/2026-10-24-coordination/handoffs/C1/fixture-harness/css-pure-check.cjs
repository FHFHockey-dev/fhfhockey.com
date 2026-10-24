// Usage (from web/): node <this> file.module.scss ... ; Next's own pure-mode transform.
const path = require("path");
const web = process.cwd();
const sass = require(path.join(web, "node_modules/sass"));
const postcss = require(path.join(web, "node_modules/next/dist/compiled/postcss-modules-local-by-default"))
  ? require(path.join(web, "node_modules/postcss")) : null;
const localByDefault = require(path.join(web, "node_modules/next/dist/compiled/postcss-modules-local-by-default"));
let failed = 0;
(async () => {
  for (const file of process.argv.slice(2)) {
    try {
      const css = sass.compile(file, { loadPaths: [web, path.join(web, "styles")] }).css;
      await postcss([localByDefault({ mode: "pure" })]).process(css, { from: file });
      console.log(`PURE ok  ${file}`);
    } catch (error) {
      failed++;
      console.log(`PURE FAIL ${file}: ${String(error.message).split("\n")[0]}`);
    }
  }
  process.exit(failed ? 1 : 0);
})();
