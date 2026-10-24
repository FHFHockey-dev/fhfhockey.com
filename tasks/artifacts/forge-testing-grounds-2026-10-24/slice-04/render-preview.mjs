// Local, self-contained fixture artifact only. No Next build/server or browser.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { writeFile } from "node:fs/promises";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../../../web");
const require = createRequire(resolve(web, "package.json"));
const { build } = require("esbuild");
const sass = require("sass");
const result = await build({
  absWorkingDir: web,
  stdin: { contents: 'import React from "react"; import { createRoot } from "react-dom/client"; import Preview from "./lib/forge-testing-grounds/preview/TestingGroundsPreview"; createRoot(document.getElementById("preview")).render(<Preview />);', loader: "jsx", resolveDir: web },
  bundle: true, platform: "browser", format: "iife", target: "es2020", jsx: "automatic", minify: true,
  define: { "process.env.NODE_ENV": '"production"' }, write: false,
  outfile: resolve(here, "preview.js"), metafile: true,
  plugins: [{ name: "local-sass-module", setup(build) {
    build.onLoad({ filter: /\.module\.scss$/ }, async args => ({ contents: sass.compile(args.path).css, loader: "local-css", resolveDir: dirname(args.path) }));
  } }],
});
const css = result.outputFiles.find(file => file.path.endsWith(".css"))?.text;
const js = result.outputFiles.find(file => file.path.endsWith(".js"))?.text;
if (!css || !js) throw new Error("Expected local CSS and JavaScript outputs.");
const inputs = Object.keys(result.metafile.inputs);
if (inputs.some(path => /memoryRunStore|boundedWorker|supabase|routeRunner|pages\/api/.test(path))) throw new Error("Forbidden runtime dependency in preview.");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:; base-uri 'none'; form-action 'none'"><title>FORGE Testing Grounds — synthetic preview</title><style>html,body{margin:0;padding:0} ${css.replace(/<\/style/gi, "<\\/style")}</style></head><body><div id="preview"></div><noscript>This synthetic interactive preview needs JavaScript. No data is fetched.</noscript><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
await writeFile(resolve(here, "preview.html"), html);
console.log(JSON.stringify({ artifact: "preview.html", bytes: Buffer.byteLength(html), inputCount: inputs.length, applicationInputs: inputs.filter(path => path.startsWith("lib/")), externalRequests: 0, servers: 0 }));
