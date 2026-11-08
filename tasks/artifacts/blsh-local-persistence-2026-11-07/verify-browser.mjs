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
const server = await createServer({ configFile: false, envDir: false, root: here, cacheDir: "/tmp/blsh-persistence-vite-cache-20261107",
  resolve: { alias: { "next/router": resolve(here, "browser-router.tsx"), react: resolve(web, "node_modules/react"),
    "react-dom": resolve(web, "node_modules/react-dom"), components: resolve(web, "components"), lib: resolve(web, "lib"), styles: resolve(web, "styles") } },
  css: { preprocessorOptions: { scss: { loadPaths: [web] } } },
  server: { host: "127.0.0.1", port: 3166, strictPort: true, fs: { allow: [repo] } },
  plugins: [{ name: "fixed-blsh-verification-input", configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const path = request.url?.split("?")[0];
      if (path === "/snapshot.json") { response.setHeader("Content-Type", "application/json"); response.end(candidate); }
      else if ((path === "/" || path === "/trade")) { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/browser-entry.tsx"></script></body></html>'); }
      else next();
    });
  } }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.context().route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && url.port === "3166") await route.continue();
    else { blocked.push(url.origin); await route.abort(); }
  });
  await page.goto("http://127.0.0.1:3166/", { waitUntil: "networkidle" });
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
  // Persistence uses real browser localStorage, reloads, and two same-origin tabs.
  const key = "fhfh.buyLowSellHigh.local.v2", legacyKey = "fhfh.buyLowSellHigh.local.v1", fixtureKey = "fhfh.buyLowSellHigh.fixture.local.v2";
  const otherSections = { draft: { give: ["missing-real"], receive: ["real-receiver"] }, marketReferences: {
    "missing-real": { source: "Browser test reference", kind: "manager_entered", capturedAt: "2026-11-07T12:00:00Z",
      horizonGames: 10, scoringBasis: "points:test", unit: "fantasy_points", value: 12 },
  } };
  await page.evaluate(({ key, sections }) => { localStorage.setItem(key, JSON.stringify({ version: 2, watchlist: [], ...sections }));
    localStorage.setItem("rso-isolation-test", "unchanged"); dispatchEvent(new StorageEvent("storage", { key })); }, { key, sections: otherSections });
  await page.getByRole("table", { name: "Buy-low forwards candidates" }).getByRole("button", { name: /^Watch .* locally$/ }).first().click();
  const watchlist = page.getByRole("region", { name: "Device-local watchlist" });
  await watchlist.getByRole("button", { name: /from saved watchlist/ }).waitFor();
  let saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  assert.equal(saved.watchlist.length, 1);
  assert.deepEqual(Object.keys(saved.watchlist[0]).sort(), ["addedAt", "kind", "playerId"]);
  assert.deepEqual(saved.draft, otherSections.draft);
  assert.deepEqual(saved.marketReferences, otherSections.marketReferences);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await watchlist.getByRole("button", { name: /from saved watchlist/ }).count(), 1);
  const second = await page.context().newPage();
  second.on("pageerror", error => errors.push(error.message));
  await second.goto("http://127.0.0.1:3166/", { waitUntil: "networkidle" });
  await second.getByRole("table", { name: "Buy-low forwards candidates" }).getByRole("button", { name: /^Watch .* locally$/ }).first().click();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).watchlist.length === 2, key);
  assert.equal(await watchlist.getByRole("button", { name: /from saved watchlist/ }).count(), 2);
  await watchlist.getByRole("button", { name: /from saved watchlist/ }).first().click();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).watchlist.length === 1, key);
  await page.getByRole("button", { name: "Clear watchlist" }).click();
  await page.reload({ waitUntil: "networkidle" });
  assert.match(await watchlist.textContent(), /No watched players yet/);
  saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  assert.deepEqual(saved.draft, otherSections.draft);
  assert.deepEqual(saved.marketReferences, otherSections.marketReferences);
  await second.close();

  const legacy = JSON.stringify({ version: 1, watchlist: [{ playerId: "unavailable-legacy", target: "POINTS", horizon: 10,
    addedAt: "2026-10-01T12:00:00Z", gapAtAdd: 9876 }], ...otherSections });
  await page.evaluate(({ key, legacyKey, legacy }) => { localStorage.removeItem(key); localStorage.setItem(legacyKey, legacy); }, { key, legacyKey, legacy });
  await page.reload({ waitUntil: "networkidle" });
  assert.match(await watchlist.textContent(), /Unavailable in this snapshot/);
  assert.ok(!(await watchlist.textContent()).includes("9876"));
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), null, "Hydration must not migrate/write automatically");
  await page.getByRole("button", { name: "Clear watchlist" }).click();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).watchlist.length === 0, key);
  await page.reload({ waitUntil: "networkidle" });
  assert.match(await watchlist.textContent(), /No watched players yet/);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyKey), legacy);
  const realRaw = await page.evaluate(key => localStorage.getItem(key), key);
  await page.goto("http://127.0.0.1:3166/trade", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Save draft selections" }).waitFor();
  assert.match(await page.getByRole("region", { name: "Device-local draft" }).textContent(), /separate storage/);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), fixtureKey), null);
  assert.match(await page.getByRole("region", { name: "Buy Low / Sell High evidence for Fixture Forward Five" }).textContent(), /recorded-window gap -12.10/);
  await page.getByRole("button", { name: "Save draft selections" }).click();
  await page.getByText("Draft selections saved on this device.", { exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("article", { name: "Fixture Forward Five" }).count(), 1);
  await page.getByLabel("Add a player you receive").selectOption("fx-f6");
  await page.getByRole("button", { name: "Save draft selections" }).click();
  await page.getByText("Draft selections saved on this device.", { exact: true }).waitFor();
  const tradeTab = await page.context().newPage();
  tradeTab.on("pageerror", error => errors.push(error.message));
  await tradeTab.goto("http://127.0.0.1:3166/trade", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Remove Fixture Forward Six", exact: true }).click();
  await page.getByRole("button", { name: "Save draft selections" }).click();
  await page.getByText("Draft selections saved on this device.", { exact: true }).waitFor();
  await tradeTab.getByRole("button", { name: "Save draft selections" }).click();
  await tradeTab.getByText(/The saved draft changed in another tab/).waitFor();
  assert.equal(await tradeTab.getByRole("article", { name: "Fixture Forward Six" }).count(), 1, "Conflict must retain unsaved selection");
  await tradeTab.getByRole("button", { name: "Load saved draft" }).click();
  assert.equal(await tradeTab.getByRole("article", { name: "Fixture Forward Six" }).count(), 0);
  await page.evaluate(key => localStorage.removeItem(key), fixtureKey);
  await tradeTab.getByText(/The saved draft changed elsewhere/).waitFor();
  await tradeTab.getByRole("button", { name: "Reset draft selections" }).click();
  await tradeTab.getByText(/The saved draft changed in another tab/).waitFor();
  assert.equal(await tradeTab.getByRole("article", { name: "Fixture Forward Five" }).count(), 1);
  assert.equal(await tradeTab.getByRole("button", { name: "Load saved draft" }).isDisabled(), false);
  await tradeTab.getByRole("button", { name: "Load saved draft" }).click();
  assert.equal(await tradeTab.getByRole("article").count(), 0);
  // Restore the primary tab's original selections deliberately for the remaining checks.
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Save draft selections" }).click();
  await page.getByText("Draft selections saved on this device.", { exact: true }).waitFor();
  await tradeTab.close();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: resolve(here, "trade-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Trade persistence must not widen mobile page");
  await page.screenshot({ path: resolve(here, "trade-mobile.png"), fullPage: true });
  await page.evaluate(key => { const state = JSON.parse(localStorage.getItem(key)); state.draft.give = ["unavailable-player"]; localStorage.setItem(key, JSON.stringify(state)); }, fixtureKey);
  await page.reload({ waitUntil: "networkidle" });
  const unavailable = page.getByRole("article", { name: "unavailable-player" });
  assert.match(await unavailable.textContent(), /Forecast unavailable/);
  await unavailable.getByRole("button", { name: "Remove unavailable-player" }).click();
  await page.getByRole("button", { name: "Save draft selections" }).click();
  await page.getByText("Draft selections saved on this device.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Reset draft selections" }).click();
  await page.waitForFunction(key => { const draft = JSON.parse(localStorage.getItem(key)).draft; return !draft.give.length && !draft.receive.length; }, fixtureKey);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("article").count(), 0);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), realRaw);
  assert.equal(await page.evaluate(() => localStorage.getItem("rso-isolation-test")), "unchanged");
  const corrupt = '{"version":999}';
  await page.evaluate(({ key, corrupt }) => localStorage.setItem(key, corrupt), { key: fixtureKey, corrupt });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("button", { name: "Save draft selections" }).isDisabled(), true);
  assert.match(await page.getByRole("region", { name: "Device-local draft" }).textContent(), /unreadable or from a newer version/);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), fixtureKey), corrupt);
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked, []);
  writeFileSync(resolve(here, "browser.json"), JSON.stringify({ status: "passed", candidateSha256: receipt.sha256,
    scope: "Actual preview components/styles, retained candidate and isolated presentation router; not full Next route or deployment",
    checks: ["F/D top25 and full lists", "reload preserves presentation query", "stale warning", "withheld filter and pagination",
      "all 115 no-history and 48 thin-history rows remain filterable", "conflict and stale-window explanations",
      "detail focus, Escape and close restore", "desktop 1440x1000", "mobile 390x844 without page overflow", "mobile player identity stays visible after detail close", "44px detail targets", "identity-only watchlist add/reload/remove/clear", "two-tab watchlist merging and updates", "v1 read-only migration and clear tombstone", "fixture trade draft save/reload/reset isolation", "unavailable IDs retained and removable", "cross-tab draft conflict without lost edits", "explicit recovery after another tab deletes the draft", "invalid data preserved", "unrelated draft/market reference/RSO key preservation", "trade desktop/mobile without overflow"],
    layout, errors, blocked, timestamp: new Date().toISOString() }, null, 2));
  console.log("BLSH persistence and retained v3 component browser checks passed");
} finally { await browser?.close(); await server.close(); }
