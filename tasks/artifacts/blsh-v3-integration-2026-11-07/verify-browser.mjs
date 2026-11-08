import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "../../../web/node_modules/vite/dist/node/index.js";
import { chromium } from "../../../web/node_modules/@playwright/test/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../.."), web = resolve(repo, "web");
const receipt = JSON.parse(readFileSync("/Users/tim/Documents/Codex/2026-11-07/blsh-v3-integration/PACKAGE-RECEIPT.json", "utf8"));
const candidate = readFileSync(receipt.candidatePath);
assert.equal(createHash("sha256").update(candidate).digest("hex"), receipt.sha256);
const errors = [], blocked = [];
const server = await createServer({ configFile: false, envDir: false, root: here, cacheDir: "/tmp/blsh-v3-vite-cache-20261107",
  resolve: { alias: { "next/router": resolve(here, "browser-router.tsx"), react: resolve(web, "node_modules/react"),
    "react-dom": resolve(web, "node_modules/react-dom"), components: resolve(web, "components"), lib: resolve(web, "lib"), styles: resolve(web, "styles") } },
  css: { preprocessorOptions: { scss: { loadPaths: [web] } } },
  server: { host: "127.0.0.1", port: 3165, strictPort: true, fs: { allow: [repo] } },
  plugins: [{ name: "fixed-blsh-verification-input", configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const path = request.url?.split("?")[0];
      if (path === "/snapshot.json") { response.setHeader("Content-Type", "application/json"); response.end(candidate); }
      else if (path === "/") { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/browser-entry.tsx"></script></body></html>'); }
      else next();
    });
  } }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && url.port === "3165") await route.continue();
    else { blocked.push(url.origin); await route.abort(); }
  });
  await page.goto("http://127.0.0.1:3165/", { waitUntil: "networkidle" });
  const buy = page.getByRole("table", { name: "Buy-low forwards candidates" });
  await buy.waitFor();
  assert.equal(await buy.getByRole("row").count(), 26);
  assert.equal(await page.getByRole("table", { name: "Sell-high forwards candidates" }).getByRole("row").count(), 26);
  assert.match(await page.getByRole("status", { name: "Snapshot capture freshness" }).textContent(), /Stale saved capture/);
  await page.screenshot({ path: resolve(here, "desktop.png"), fullPage: false });
  await page.getByRole("button", { name: "Show full buy-low list (103 forwards)" }).click();
  assert.equal(await buy.getByRole("row").count(), 104);
  assert.match(page.url(), /full=BL/);
  await page.getByRole("button", { name: "Show top 25 buy-low" }).click();
  const detail = buy.getByRole("button").first();
  const name = (await detail.getAttribute("aria-label")) ?? (await detail.textContent()).replace(/^Details for /, "");
  await detail.click();
  assert.equal(await page.locator("#blsh-v3-player-detail-heading").evaluate(node => node === document.activeElement), true);
  assert.match(await page.getByRole("region", { name: `Opportunity for ${name}` }).textContent(), /none is attached/);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#blsh-v3-player-detail").count(), 0);
  assert.equal(await detail.evaluate(node => node === document.activeElement), true);
  await page.getByLabel("Position group").selectOption("D");
  assert.equal(await page.getByRole("table", { name: "Buy-low defensemen candidates" }).getByRole("row").count(), 26);
  await page.getByRole("button", { name: "Show full sell-high list (30 defensemen)" }).click();
  assert.equal(await page.getByRole("table", { name: "Sell-high defensemen candidates" }).getByRole("row").count(), 31);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByLabel("Position group").inputValue(), "D");
  assert.equal(await page.getByRole("table", { name: "Sell-high defensemen candidates" }).getByRole("row").count(), 31);
  await page.getByLabel("Filter withheld reason").selectOption("insufficient_personal_history_list_withheld");
  assert.equal(await page.getByRole("table", { name: "Withheld candidate evidence" }).getByRole("row").count(), 26);
  await page.getByRole("button", { name: "Show next 25 withheld profiles" }).click();
  assert.equal(await page.getByRole("table", { name: "Withheld candidate evidence" }).getByRole("row").count(), 49);
  await page.getByLabel("Filter withheld reason").selectOption("no_personal_history_list_withheld");
  for (let pageIndex = 0; pageIndex < 4; pageIndex++) await page.getByRole("button", { name: "Show next 25 withheld profiles" }).click();
  assert.equal(await page.getByRole("table", { name: "Withheld candidate evidence" }).getByRole("row").count(), 116);
  await page.getByLabel("Filter withheld reason").selectOption("status:conflicting_baseline_and_support");
  assert.match(await page.getByRole("table", { name: "Withheld candidate evidence" }).textContent(), /Production and support disagree/);
  await page.getByLabel("Filter withheld reason").selectOption("saved_window_stale_list_withheld");
  assert.match(await page.getByRole("table", { name: "Withheld candidate evidence" }).textContent(), /outside the saved age limit/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Position group").selectOption("F");
  await page.evaluate(() => scrollTo(0, 0));
  const layout = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth,
    listButtons: [...document.querySelectorAll('button')].filter(button => button.textContent?.startsWith("Details"))
      .map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })) }));
  await page.screenshot({ path: resolve(here, "mobile.png"), fullPage: false });
  if (layout.width > layout.viewport) console.log(await page.evaluate(() => [...document.querySelectorAll("*")]
    .filter(node => node.getBoundingClientRect().width > innerWidth).slice(0, 20)
    .map(node => [node.tagName, node.className, node.getBoundingClientRect().width])));
  assert.ok(layout.width <= layout.viewport, `Page overflows horizontally: viewport ${layout.viewport}, width ${layout.width}`);
  assert.ok(layout.listButtons.every(button => button.width >= 44 && button.height >= 44));
  await page.getByRole("table", { name: "Buy-low forwards candidates" }).getByRole("button").first().click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Open mobile detail must not widen the page");
  await page.locator("#blsh-v3-player-detail").screenshot({ path: resolve(here, "mobile-detail.png") });
  await page.getByRole("button", { name: /^Close details for / }).click();
  assert.equal(await page.locator("#blsh-v3-player-detail").count(), 0);
  const visibleIdentity = await page.getByRole("table", { name: "Buy-low forwards candidates" }).locator("tbody th").first()
    .evaluate(node => { const bounds = node.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; });
  assert.equal(visibleIdentity, true, "Player identity must remain visible after mobile detail close and horizontal scrolling");
  await page.getByRole("table", { name: "Buy-low forwards candidates" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(here, "mobile-list.png"), fullPage: false });
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked, []);
  writeFileSync(resolve(here, "browser.json"), JSON.stringify({ status: "passed", candidateSha256: receipt.sha256,
    scope: "Actual preview components/styles, retained candidate and isolated presentation router; not full Next route or deployment",
    checks: ["F/D top25 and full lists", "reload preserves presentation query", "stale warning", "withheld filter and pagination",
      "all 115 no-history and 48 thin-history rows remain filterable", "conflict and stale-window explanations",
      "detail focus, Escape and close restore", "desktop 1440x1000", "mobile 390x844 without page overflow", "mobile player identity stays visible after detail close", "44px detail targets"],
    layout, errors, blocked, timestamp: new Date().toISOString() }, null, 2));
  console.log("BLSH component browser checks passed");
} finally { await browser?.close(); await server.close(); }
