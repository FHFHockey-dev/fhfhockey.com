// Side-by-side before/after image. Usage: node compare.cjs out.png before.png after.png [cropHeightPx] [--stack]
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const path = require("node:path");
const [out, before, after, crop] = process.argv.slice(2);
const stack = process.argv.includes("--stack");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 1 });
  const url = f => "file://" + path.resolve(f);
  const fig = (t, f) => `<figure style="margin:0"><figcaption style="font:600 14px system-ui;color:#fff;padding:6px 2px">${t}</figcaption><div style="overflow:hidden;${crop && +crop ? `max-height:${crop}px` : ""}"><img src="${url(f)}" style="display:block;${stack ? "" : "max-width:none"}"></div></figure>`;
  const html = require("node:os").tmpdir() + "/wigo-compare-" + process.pid + ".html";
  require("node:fs").writeFileSync(html, `<!doctype html><body style="margin:0;background:#333;display:inline-flex;flex-direction:${stack ? "column" : "row"};gap:12px;padding:12px">${fig("Before", before)}${fig("After", after)}</body>`);
  await p.goto("file://" + html);
  await p.waitForTimeout(400);
  const box = await p.evaluate(() => { const r = document.body.getBoundingClientRect(); return [Math.ceil(r.width), Math.ceil(r.height)]; });
  await p.setViewportSize({ width: box[0], height: box[1] });
  await p.screenshot({ path: out });
  require("node:fs").unlinkSync(html);
  await b.close();
})();
