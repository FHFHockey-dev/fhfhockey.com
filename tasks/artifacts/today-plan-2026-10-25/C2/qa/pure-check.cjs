const N = "/Users/tim/Code/fhfhockey.com/web/node_modules/";
const sass = require(N + "sass"), postcss = require(N + "postcss");
const local = require(N + "next/dist/compiled/postcss-modules-local-by-default");
const css = sass.compile(process.argv[2]).css;
postcss([local({ mode: "pure" })]).process(css, { from: undefined }).then(() => console.log("PURE OK", process.argv[2]), e => { console.error("IMPURE", e.message); process.exit(1); });
