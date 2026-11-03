// Crop a screenshot. Usage: node crop.cjs in.png out.png x y w h
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const path = require("node:path");
const [i, o, x, y, w, h] = process.argv.slice(2);
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const html = require("node:os").tmpdir() + "/wigo-crop-" + process.pid + ".html";
  require("node:fs").writeFileSync(html, `<!doctype html><body style="margin:0;overflow:hidden"><img src="file://${path.resolve(i)}" style="position:absolute;left:${-x}px;top:${-y}px;max-width:none">`);
  await p.goto("file://" + html); await p.waitForTimeout(200); await p.screenshot({ path: o }); require("node:fs").unlinkSync(html); await b.close(); })();
