// Next's CSS Modules pure-mode check: sass compile, then postcss-modules-local-by-default { mode: "pure" }.
const path = require("node:path");
const web = "/Users/tim/Code/fhfhockey.com/web";
const sass = require(path.join(web, "node_modules/sass"));
const postcss = require(path.join(web, "node_modules/postcss"));
const local = require(path.join(web, "node_modules/next/dist/compiled/postcss-modules-local-by-default"));
const file = process.argv[2];
const css = sass.compile(file, { loadPaths: [web, path.join(web, "styles")] }).css;
postcss([local({ mode: "pure" })]).process(css, { from: file }).then(() => console.log(`PURE OK ${path.relative(web, file)} (${css.length} bytes css)`), error => { console.error(`IMPURE ${error.message}`); process.exit(1); });
