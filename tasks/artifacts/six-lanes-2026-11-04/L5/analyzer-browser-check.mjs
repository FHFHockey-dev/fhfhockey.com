import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, unlink, rmdir } from "node:fs/promises";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(path.resolve(out, "../../../.."), "web");
const requireWeb = createRequire(path.join(web, "package.json"));
const { build } = requireWeb("vite");
const { chromium } = requireWeb("playwright");
const lock = "/private/tmp/fhfh-heavy.lock", owner = path.join(lock, "l5-owner"), token = randomUUID();
const dist = "/private/tmp/fhfh-l5-analyzer-browser-dist";
const compileOnly = process.argv.includes("--compile-only");
const report = { fixtureOnly: true, fullNextRoute: false, compileOnly, checks: [], blockedRequests: [], pageErrors: [] };
const check = (name, passed) => { report.checks.push({ name, passed }); if (!passed) throw new Error(name); };
let server, browser;
await mkdir(lock);
await writeFile(owner, token);
try {
  await build({ configFile: false, envFile: false, root: path.join(out, "analyzer-browser-fixture"),
    resolve: { alias: { components: path.join(web, "components"), lib: path.join(web, "lib"),
      react: path.join(web, "node_modules/react"), "react-dom": path.join(web, "node_modules/react-dom") } },
    esbuild: { jsx: "automatic" }, build: { outDir: dist, emptyOutDir: true }, logLevel: "warn" });
  check("actual component and CSS-module/Sass compile", true);
  if (!compileOnly) {
    server = createServer(async (req, res) => {
      try {
        const pathname = new URL(req.url, "http://127.0.0.1").pathname;
        const file = path.resolve(dist, pathname === "/" ? "index.html" : pathname.slice(1));
        if (!file.startsWith(dist + path.sep)) { res.writeHead(403); res.end(); return; }
        const data = await readFile(file);
        res.setHeader("content-type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
        res.end(data);
      } catch { res.writeHead(404); res.end(); }
    });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      await context.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin || url.pathname.startsWith("/api/")) { report.blockedRequests.push(url.origin + url.pathname); return route.abort(); }
        return route.continue();
      });
      const page = await context.newPage();
      page.on("pageerror", error => report.pageErrors.push(error.message));
      await page.goto(origin);
      await page.getByRole("heading", { name: "Trade Analyzer", exact: true }).waitFor();
      await page.getByLabel("Proposed effective date", { exact: true }).fill("2026-11-10");
      await page.getByLabel("Team A name", { exact: true }).fill("Synthetic Alpha");
      await page.getByLabel("Team B name", { exact: true }).fill("Synthetic Beta");
      await page.getByLabel("Team A full before-roster", { exact: true }).fill("Synthetic A1 | C | active\nSynthetic A2 | LW | bench");
      await page.getByLabel("Team B full before-roster", { exact: true }).fill("Synthetic B1 | RW | active\nSynthetic B2 | D | bench\nSynthetic B3 | G | IR");
      for (const side of ["A", "B"]) await page.getByLabel(`I reviewed Team ${side}'s complete roster and ownership.`, { exact: true }).check();
      await page.getByLabel("Team A maximum total players", { exact: true }).fill("2");
      await page.getByLabel("I reviewed Team A's total-player limit.", { exact: true }).check();
      for (const label of ["Offer Synthetic A1 (C)", "Offer Synthetic B1 (RW)", "Offer Synthetic B2 (D)"]) await page.getByLabel(label, { exact: true }).check();
      await page.getByLabel("Team A picks or other assets", { exact: true }).fill("pick: conditional 2027 second\nUnresolved future considerations");
      await page.getByRole("button", { name: "Preview offer", exact: true }).click();
      const a = page.getByRole("region", { name: "Synthetic Alpha before and after", exact: true });
      const b = page.getByRole("region", { name: "Synthetic Beta before and after", exact: true });
      check(`${width}: unknown capacity stays unresolved`, await b.getByText(/Capacity unresolved:.*No free capacity is assumed/).isVisible());
      check(`${width}: whole two-for-one requires an explicit drop`, await a.getByText(/after exchange: 3; after selected drops: 3/).isVisible());
      check(`${width}: no automatic drop`, !await a.getByLabel("Drop Team A: Synthetic A2", { exact: true }).isChecked());
      check(`${width}: outgoing and incoming players cannot be selected as drops`, await a.getByLabel("Drop Team A: Synthetic A1", { exact: true }).count() === 0 && await a.getByLabel("Drop Team A: Synthetic B1", { exact: true }).count() === 0);
      await page.getByLabel("Team B maximum total players", { exact: true }).fill("3");
      await page.getByLabel("I reviewed Team B's total-player limit.", { exact: true }).check();
      const drop = a.getByLabel("Drop Team A: Synthetic A2", { exact: true });
      await drop.focus(); await page.keyboard.press("Space");
      check(`${width}: keyboard-selected drop resolves capacity`, await page.getByRole("status").textContent().then(text => text.includes("Entry and reviewed total-player counts are complete")));
      check(`${width}: both final counts reconcile`, await a.getByText(/after selected drops: 2/).isVisible() && await b.getByText(/after selected drops: 2/).isVisible());
      check(`${width}: complete pick and unknown text retained for both sides`, await page.getByText("Pick: conditional 2027 second · value unavailable", { exact: true }).count() === 2 && await page.getByText("Unknown asset: Unresolved future considerations · value unavailable", { exact: true }).count() === 2);
      check(`${width}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
      await page.screenshot({ path: path.join(out, `analyzer-${width}.png`), fullPage: true });
      if (width === 390) {
        await page.evaluate(() => document.documentElement.dir = "rtl");
        check("390: RTL mirror has no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
      }
      if (width === 1440) {
        await page.evaluate(() => document.documentElement.style.zoom = "2");
        check("1440: 200% CSS zoom has no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
      }
      await page.getByLabel("Team A full before-roster", { exact: true }).fill("Synthetic Replacement | D | active");
      check(`${width}: roster edits clear stale exchange and require review`, !await page.getByLabel("Offer Synthetic Replacement (D)", { exact: true }).isChecked() && !await page.getByLabel("I reviewed Team A's complete roster and ownership.", { exact: true }).isChecked());
      await page.reload();
      check(`${width}: offer state is not persisted`, await page.getByLabel("Team A full before-roster", { exact: true }).inputValue() === "" && await page.getByRole("heading", { name: "Offer preview", exact: true }).count() === 0);
      await context.close();
    }
    check("no uncaught page errors", report.pageErrors.length === 0);
  }
  report.result = "passed";
} catch (error) {
  report.result = "failed"; report.error = String(error.stack ?? error); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  if (await readFile(owner, "utf8") === token) { await unlink(owner); await rmdir(lock); }
  await writeFile(path.join(out, compileOnly ? "analyzer-compile-result.json" : "analyzer-browser-result.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
