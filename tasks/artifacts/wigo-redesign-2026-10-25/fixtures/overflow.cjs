// node overflow.cjs WxH — lists elements inside the dashboard whose content overflows their box, plus small text.
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const { installWigoFixtures, SUBJECT_ID } = require("./wigo-fixtures.cjs");
(async () => {
  const [width, height] = (process.argv[2] || "1280x800").split("x").map(Number);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await installWigoFixtures(page, () => {}, { longName: process.env.LONGNAME === "1" });
  await page.goto(process.argv[3] === "none" ? "http://127.0.0.1:3150/wigoCharts" : `http://127.0.0.1:3150/wigoCharts?playerId=${process.argv[3] || SUBJECT_ID}`, { waitUntil: "networkidle" });
  await page.locator('[data-coverage="C19"] meter').first().waitFor({ timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const result = await page.evaluate(() => {
    const root = document.querySelector('[class*="wigoDashboardContent"]');
    const visible = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const name = e => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0].replace(/^[A-Za-z]+_/, "").replace(/__\w+$/, "")}`;
    const panel = e => e.closest("[data-coverage]")?.dataset.coverage ?? "-";
    const overflow = Array.from(root.querySelectorAll("*")).filter(e => visible(e) && !String(e.className).includes("visuallyHidden") && !e.closest("details:not([open])") && getComputedStyle(e).display !== "inline" && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1))
      .map(e => `${panel(e)} ${name(e)} client ${e.clientWidth}x${e.clientHeight} scroll ${e.scrollWidth}x${e.scrollHeight} "${(e.innerText || "").replace(/\s+/g, " ").slice(0, 40)}"`);
    const clipped = Array.from(root.querySelectorAll("th, td")).filter(cell => {
      const b = cell.getBoundingClientRect();
      const w = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      let n; while ((n = w.nextNode())) { if (!n.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(n); const t = r.getBoundingClientRect(); if (t.left < b.left - 1 || t.right > b.right + 1 || t.top < b.top - 1 || t.bottom > b.bottom + 1) return true; }
      return false;
    }).map(c => `${panel(c)} cell "${c.textContent}"`);
    const small = Array.from(root.querySelectorAll("*")).filter(e => visible(e) && !e.closest("details:not([open])") && Array.from(e.childNodes).some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11).map(e => `${panel(e)} ${name(e)} ${getComputedStyle(e).fontSize} "${e.textContent.slice(0, 30)}"`);
    const panels = Array.from(root.querySelectorAll("[data-coverage]")).filter(visible).map(e => { const r = e.getBoundingClientRect(); return `${e.dataset.coverage} ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}${r.bottom > innerHeight + 1 ? " OUTSIDE" : ""}`; });
    return { doc: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], panels, overflow, clipped, small };
  });
  console.log(JSON.stringify(result, null, 1));
  await browser.close();
})();
