// Run from the repository root: node tasks/artifacts/rankings-usability-2026-11-12/browser.mjs
// Actual page/styles + existing synthetic Vitest fixtures; no Next server or production readers.
import { createRequire } from "node:module";
import { mkdtemp, readFile, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(output, "../../..");
const web = path.join(repo, "web");
const require = createRequire(path.join(web, "package.json"));
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const { default: react } = await import(pathToFileURL(require.resolve("@vitejs/plugin-react")).href);
const { chromium, expect } = require("@playwright/test");
const root = await realpath(await mkdtemp(path.join(tmpdir(), "rankings-browser-")));
const evidence = { cases: [], externalRequests: [], unexpectedApiRequests: [], pageErrors: [], status: "running" };
let server, browser;

try {
  const source = await readFile(path.join(web, "__tests__/pages/rankings.test.tsx"), "utf8");
  const start = source.indexOf("const rankingRequest:");
  const end = source.indexOf('describe("RankingsPage interactions"');
  assert(start > 0 && end > start, "Could not locate the existing synthetic fixture section");
  await writeFile(path.join(root, "data.ts"), [
    'import { TEAM_ADJUSTED_STYLE_SOURCE_CONTRACTS, TEAM_STYLE_SOURCE_CONTRACT } from "lib/rankings/teamStyleMethodology";',
    "const swrMock = { resolve: null, mockImplementation(fn) { this.resolve = fn; } };",
    source.slice(start, end),
    "setupSWR(); export const payloadFor = (url) => swrMock.resolve(url).data;",
  ].join("\n"));
  await writeFile(path.join(root, "runtime.tsx"), [
    'import React, { createContext, useContext, useState } from "react";',
    'import { createRoot } from "react-dom/client";',
    'import { SWRConfig } from "swr";',
    'import RankingsPage from ' + JSON.stringify(path.join(web, "pages/rankings.tsx")) + ";",
    'import { payloadFor } from "./data";',
    'import "./global.css";',
    "const Router = createContext(null); const Season = createContext(null);",
    "export const useRouter = () => useContext(Router);",
    "export const useCurrentSeasonQuery = () => useContext(Season);",
    "export const Head = () => null;",
    "export const Link = ({ children, ...props }) => <a {...props}>{children}</a>;",
    "const params = new URLSearchParams(location.search);",
    'const seasonMode = params.get("__season");',
    'const initialSeason = seasonMode ? { data: null, isError: seasonMode === "error", isSuccess: seasonMode === "empty" } : { data: { seasonId: 20252026 }, isError: false, isSuccess: true };',
    'const fixture = window.__rankingsFixture = { requests: [], pending: [], unexpected: [], mode: params.get("__case") || "ready", target: params.get("__target") || "/matrix?", seasonRetries: 0 };',
    "fixture.resolve = () => fixture.pending.splice(0).forEach(finish => finish());",
    "window.fetch = async (input) => {",
    '  const url = new URL(typeof input === "string" ? input : input.url, location.href);',
    '  if (url.origin !== location.origin || !url.pathname.startsWith("/api/v1/contextual-rankings")) { fixture.unexpected.push(url.href); throw new Error("Blocked non-fixture fetch"); }',
    "  const key = url.pathname + url.search; fixture.requests.push(key);",
    "  if (key.includes(fixture.target)) {",
    '    if (fixture.mode === "pending") await new Promise(resolve => fixture.pending.push(resolve));',
    '    if (fixture.mode === "html") return new Response("<html>Unavailable</html>", { status: 503 });',
    '    if (fixture.mode === "network") throw new TypeError("Failed to fetch");',
    '    if (fixture.mode === "error") return Response.json({ error: "SOURCE_BUSY", message: "Please try again shortly." }, { status: 503 });',
    "  }",
    "  const payload = payloadFor(key);",
    '  if (payload == null) { fixture.unexpected.push(key); throw new Error("No synthetic fixture for " + key); }',
    "  return Response.json(payload);",
    "};",
    "function App() {",
    "  const [query, setQuery] = useState(Object.fromEntries(params));",
    "  const [season, setSeason] = useState({ ...initialSeason, isFetching: false });",
    "  fixture.setSeason = setSeason;",
    '  const router = { pathname: "/rankings", query, isReady: true, replace: async ({ query: next }) => { history.replaceState(null, "", "/rankings?" + new URLSearchParams(next)); setQuery(next); } };',
    "  return <Router.Provider value={router}><Season.Provider value={{ ...season, refetch: () => { fixture.seasonRetries++; setSeason(old => ({ ...old, isFetching: true })); return Promise.resolve(); } }}>",
    "    <SWRConfig value={{ provider: () => new Map() }}><RankingsPage /></SWRConfig>",
    "  </Season.Provider></Router.Provider>;",
    "}",
    'createRoot(document.getElementById("root")).render(<App />);',
  ].join("\n"));
  const globalCss = await readFile(path.join(web, "styles/globals.css"), "utf8");
  // Retain app reset/focus rules while deliberately omitting remote font imports.
  await writeFile(path.join(root, "global.css"), globalCss.replace(/^@import .*$/gm, ""));
  await writeFile(path.join(root, "index.html"), '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rankings isolated fixture</title></head><body><div id="root"></div><script type="module" src="/runtime.tsx"></script></body></html>');
  const runtime = path.join(root, "runtime.tsx");
  const mocks = {
    "next/router": "export { useRouter }",
    "next/head": "export { Head as default }",
    "next/link": "export { Link as default }",
    "hooks/useCurrentSeason": "export { useCurrentSeasonQuery }",
  };
  server = await createServer({
    configFile: false, root, envDir: root, cacheDir: path.join(root, "cache"), publicDir: false,
    plugins: [{
      name: "rankings-fixture-isolation", enforce: "pre",
      resolveId(id) {
        const source = id.startsWith(web + "/") ? id.slice(web.length + 1).replace(/\.tsx?$/, "") : id;
        if (mocks[source]) return "\0rankings:" + source;
        if (/supabase|lib\/NHL\/client|\/pages\/api\//i.test(source)) throw new Error("Production reader prohibited: " + source);
      },
      load(id) {
        if (id.startsWith("\0rankings:")) return mocks[id.slice(10)] + " from " + JSON.stringify(runtime) + ";";
      },
    }, react()],
    resolve: { dedupe: ["react", "react-dom", "swr"], alias: Object.fromEntries(
      ["components", "hooks", "lib", "styles", "utils"].map(key => [key, path.join(web, key)]).concat(
        ["react", "react-dom", "swr"].map(key => [key, path.join(web, "node_modules", key)]),
      ),
    ) },
    css: { preprocessorOptions: { scss: { loadPaths: [web], quietDeps: true, silenceDeprecations: ["import", "global-builtin", "color-functions"] } } },
    server: { host: "127.0.0.1", port: 0, strictPort: false, fs: { allow: [root, web] } },
  });
  await server.listen();
  const address = server.httpServer.address();
  const origin = "http://127.0.0.1:" + address.port;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: "block", reducedMotion: "reduce" });
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { evidence.externalRequests.push(url.href); return route.abort(); }
    if (url.pathname.startsWith("/api/")) { evidence.unexpectedApiRequests.push(url.href); return route.abort(); }
    if (/^\/(pictures|teamLogos)\//.test(url.pathname)) return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#808080"/></svg>' });
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", error => evidence.pageErrors.push(error.stack || error.message));
  page.on("console", message => { if (message.type() === "error") console.error(message.text()); });
  page.on("response", async response => {
    if (response.request().resourceType() === "script" && response.headers()["content-type"]?.includes("text/html")) {
      console.error("Unexpected script response", response.url(), response.status(), (await response.text()).slice(0, 300));
    }
  });
  async function goto(query, width = 1440) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + "/rankings?" + query);
    await expect(page.getByRole("heading", { name: "Skater Rankings" })).toBeVisible();
  }
  async function mode(next) { await page.evaluate(value => { window.__rankingsFixture.mode = value; }, next); }
  async function count(target) { return page.evaluate(target => window.__rankingsFixture.requests.filter(url => url.includes(target)).length, target); }
  async function checkIsolation() {
    assert.deepEqual(await page.evaluate(() => window.__rankingsFixture.unexpected), []);
    assert.deepEqual(evidence.externalRequests, []);
    assert.deepEqual(evidence.unexpectedApiRequests, []);
    assert.deepEqual(evidence.pageErrors, []);
  }
  async function tabTo(button) {
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press("Tab");
      if (await button.evaluate(node => node === document.activeElement)) return i + 1;
    }
    throw new Error("Retry was unreachable in keyboard tab order");
  }

  for (const failure of ["html", "network"]) {
    await goto("season=20252026&window=last5&team=BUF&page=2&__case=" + failure);
    const retry = page.getByRole("button", { name: "Retry Rankings", exact: true });
    await expect(retry).toBeEnabled();
    await expect(page.getByRole("status")).toHaveText("Unable to load rankings right now. Please try again.");
    const before = await page.evaluate(() => [...window.__rankingsFixture.requests]);
    const url = page.url();
    const tabs = await tabTo(retry);
    const focus = await retry.evaluate(node => ({ outline: getComputedStyle(node).outlineStyle, outlineWidth: getComputedStyle(node).outlineWidth, visible: node.matches(":focus-visible") }));
    assert(focus.visible && focus.outline !== "none" && parseFloat(focus.outlineWidth) > 0, "Keyboard focus indicator missing");
    await mode("pending");
    await page.keyboard.press(failure === "html" ? "Enter" : "Space");
    await expect(retry).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText("Loading Rankings...");
    await page.keyboard.press("Enter");
    assert.equal(await count("/matrix?"), 2, "Duplicate pending retry");
    const pending = await page.evaluate(() => [...window.__rankingsFixture.requests]);
    assert.equal(pending.length, before.length + 1, "Retry fetched more than the primary view");
    const focusAfterRecovery = failure === "network"
      ? page.getByRole("button", { name: "Show controls" })
      : page.getByRole("heading", { name: "Skater Rankings" });
    if (failure === "network") await focusAfterRecovery.focus();
    await page.evaluate(() => { window.__rankingsFixture.mode = "ready"; window.__rankingsFixture.resolve(); });
    await expect(retry).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Rankings ready.");
    await expect(focusAfterRecovery).toBeFocused();
    assert.equal(page.url(), url, "Retry changed URL filters");
    await checkIsolation();
    evidence.cases.push({ name: failure + " keyboard recovery", tabs, focus, primaryRequests: 2, pendingRetryRequestDelta: 1, restoredOrPreservedFocus: true });
  }

  // Fast-forward the browser clock instead of waiting for SWR's retry interval.
  await goto("season=20252026&__case=error");
  await expect(page.getByRole("button", { name: "Retry Rankings" })).toBeEnabled();
  await page.clock.install();
  await page.clock.fastForward(60000);
  assert.equal(await count("/matrix?"), 1, "Primary request retried without user input");
  evidence.cases.push({ name: "No automatic primary retry", simulatedMilliseconds: 60000, primaryRequests: 1 });
  await page.clock.resume();

  const repeatedRetry = page.getByRole("button", { name: "Retry Rankings" });
  await repeatedRetry.focus();
  await page.keyboard.press("Enter");
  await expect(repeatedRetry).toBeEnabled();
  await expect(repeatedRetry).toBeFocused();
  assert.equal(await count("/matrix?"), 2);
  evidence.cases.push({ name: "Repeated failure retains keyboard recovery", primaryRequests: 2 });

  await goto("__season=empty", 390);
  await expect(page.getByRole("button", { name: "Retry season lookup" })).toBeEnabled();
  await expect(page.getByRole("status")).toContainText("Unable to load season info");
  assert.deepEqual(await page.evaluate(() => window.__rankingsFixture.requests), ["/api/v1/contextual-rankings/metadata"]);
  await checkIsolation();
  evidence.cases.push({ name: "Empty season response offers recovery" });

  for (const tab of ["metric_explorer", "deployment_tiers", "trending", "splits", "war"]) {
    await goto("tab=" + tab + "&__season=pending", 390);
    await expect(page.getByRole("status")).toHaveText("Loading season info...");
    assert.deepEqual(await page.evaluate(() => window.__rankingsFixture.requests), ["/api/v1/contextual-rankings/metadata"]);
    await page.evaluate(() => window.__rankingsFixture.setSeason({ data: null, isError: true, isSuccess: false, isFetching: false }));
    await expect(page.getByRole("status")).toContainText("Unable to load season info");
    await page.getByRole("button", { name: "Hide controls" }).click();
    const retry = page.getByRole("button", { name: "Retry season lookup" });
    await retry.focus();
    await page.keyboard.press("Enter");
    await expect(retry).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText("Loading season info...");
    await page.evaluate(() => window.__rankingsFixture.setSeason({ data: { seasonId: 20252026 }, isError: false, isSuccess: true, isFetching: false }));
    await expect(retry).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("ready.");
    await expect(page.getByRole("heading", { name: "Skater Rankings" })).toBeFocused();
    assert.equal(await page.evaluate(() => window.__rankingsFixture.seasonRetries), 1);
    await checkIsolation();
    evidence.cases.push({ name: tab + " season loading/error/recovery", width: 390 });
  }

  const axeSource = await readFile(require.resolve("axe-core"), "utf8");
  for (const width of [1440, 390, 320]) {
    await goto("season=20252026&__case=html", width);
    const retry = page.getByRole("button", { name: "Retry Rankings" });
    await expect(retry).toBeVisible();
    await expect(retry).toHaveAttribute("aria-describedby", "rankings-request-error");
    if (await page.getByRole("button", { name: "Hide controls" }).isVisible()) await page.getByRole("button", { name: "Hide controls" }).click();
    const geometry = await retry.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, height: rect.height, viewport: innerWidth, pageWidth: document.documentElement.scrollWidth };
    });
    assert(geometry.left >= 0 && geometry.right <= width && geometry.width >= 24 && geometry.height >= 24, "Retry clipped or target smaller than 24px");
    assert(geometry.pageWidth <= width, "Horizontal document overflow");
    const errorText = await page.locator("#rankings-request-error").evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      return Array.from(range.getClientRects()).map(rect => ({ left: rect.left, right: rect.right }));
    });
    assert(errorText.length > 0 && errorText.every(rect => rect.left >= 0 && rect.right <= width), "Error text outside visible viewport");
    const toggles = await page.getByRole("button", { name: /^(Compact|Detailed|Overall|Deployment)$/ }).evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, scroll: node.scrollWidth, client: node.clientWidth };
    }));
    assert(toggles.length === 4 && toggles.every(rect => rect.left >= 0 && rect.right <= width && rect.scroll <= rect.client + 1), "Layout/rank controls clipped");
    await retry.evaluate(node => node.setAttribute("data-retry-acceptance", "true"));
    await page.addScriptTag({ content: axeSource });
    const a11y = await page.evaluate(async () => {
      const result = await window.axe.run({ include: ["[data-retry-acceptance]", "[role=status]", "#rankings-request-error"] });
      return { violations: result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })), passes: result.passes.length, incomplete: result.incomplete.map(v => v.id) };
    });
    assert.deepEqual(a11y.violations, [], "Accessibility violation in changed controls/status");
    await page.screenshot({ path: path.join(output, "retry-" + width + ".png"), fullPage: true });
    await checkIsolation();
    evidence.cases.push({ name: "Retry reflow and scoped accessibility", width, geometry, a11y });
  }
  evidence.status = "passed";
} catch (error) {
  evidence.status = "failed";
  evidence.error = error.stack || String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
  await writeFile(path.join(output, "BROWSER-RESULT.json"), JSON.stringify(evidence, null, 2) + "\n");
  if (evidence.status === "passed") await rm(root, { recursive: true, force: true });
  else console.error("Retained synthetic harness at", root);
  console.log(JSON.stringify(evidence, null, 2));
}
