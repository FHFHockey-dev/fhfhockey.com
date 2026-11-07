// axe-core (the library, run locally; the Axe MCP server is down) on the fixture page, scoped to the WiGO root.
// Usage: node axe-run.cjs   Writes screens/../axe-<view>.json and prints violations by rule.
const { chromium } = require("/Users/tim/Code/fhfhockey.com/web/node_modules/playwright");
const fs = require("node:fs");
const path = require("node:path");
const { installWigoFixtures, SUBJECT_ID } = require("../../wigo-redesign-2026-10-25/fixtures/wigo-fixtures.cjs");
const axeSource = fs.readFileSync("/Users/tim/Code/fhfhockey.com/web/node_modules/axe-core/axe.min.js", "utf8");
const views = [["desktop-1280", 1280, 800, ""], ...["overview", "trends", "percentiles", "comparison"].map(tab => [`phone-${tab}`, 390, 844, tab])];
(async () => {
  const browser = await chromium.launch();
  const summary = {};
  for (const [name, width, height, tab] of views) {
    const page = await (await browser.newContext({ viewport: { width, height }, hasTouch: width < 500 })).newPage();
    await installWigoFixtures(page);
    await page.goto(`http://127.0.0.1:${process.env.WIGO_PORT || 3150}/wigoCharts?playerId=${SUBJECT_ID}${tab ? `&tab=${tab}` : ""}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async () => {
      const root = document.querySelector('[class*="wigoDashHeader"]');
      return (window).axe.run(root, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    });
    summary[name] = result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, targets: v.nodes.slice(0, 4).map(n => n.target.join(" ")) }));
    console.log(name, "violations", result.violations.length, "passes", result.passes.length, "incomplete", result.incomplete.map(v => `${v.id}(${v.nodes.length})`).join(","));
    for (const v of summary[name]) console.log("  ", v.impact, v.id, v.nodes, "-", v.help, "|", v.targets.join(" ; ").slice(0, 220));
    await page.context().close();
  }
  fs.writeFileSync(path.join(__dirname, "..", "axe-results.json"), JSON.stringify(summary, null, 1));
  await browser.close();
})();
