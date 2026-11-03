// CSS-module pure check: compile each .module.scss with the project's sass, then run Next's compiled
// postcss-modules-local-by-default in pure mode (throws on an impure selector). Usage: node pure-check.cjs <files...>
const path = require("node:path");
const web = process.env.WIGO_WEB || "/private/tmp/fhfh-wigo-redesign/web";
const sass = require(path.join(web, "node_modules/sass"));
const postcss = require(path.join(web, "node_modules/postcss"));
const localByDefault = require(path.join(web, "node_modules/next/dist/compiled/postcss-modules-local-by-default"));

(async () => {
  let failed = 0;
  for (const file of process.argv.slice(2)) {
    try {
      const css = sass.compile(path.resolve(web, file), { loadPaths: [web], quietDeps: true, logger: sass.Logger.silent }).css;
      await postcss([localByDefault({ mode: "pure" })]).process(css, { from: file });
      console.log("PURE OK  ", file);
    } catch (error) {
      failed++;
      console.log("FAIL     ", file, "\n   ", String(error.message || error).split("\n").slice(0, 3).join("\n    "));
    }
  }
  process.exit(failed ? 1 : 0);
})();
