import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, unlink, rmdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, "../../../..");
const web = path.join(root, "web");
const requireWeb = createRequire(path.join(web, "package.json"));
const { build } = requireWeb("vite");
const { chromium } = requireWeb("playwright");
const lock = "/private/tmp/fhfh-heavy.lock";
const token = "L5-browser-2026-11-04";
const owner = path.join(lock, "l5-owner");
const dist = "/private/tmp/fhfh-l5-roster-browser-dist";
const report = { fixtureOnly: true, fullNextRoute: false, checks: [], blockedRequests: [], pageErrors: [] };
const check = (name, passed) => { report.checks.push({ name, passed }); if (!passed) throw new Error(name); };
let server, browser;
await mkdir(lock);
await writeFile(owner, token);
try {
  await build({ configFile: false, envFile: false, root: path.join(out, "browser-fixture"),
    resolve: { alias: { "contexts/AuthProviderContext": path.join(out, "browser-fixture/auth.ts"),
      components: path.join(web, "components"), lib: path.join(web, "lib"), react: path.join(web, "node_modules/react"),
      "react-dom": path.join(web, "node_modules/react-dom") } },
    esbuild: { jsx: "automatic" },
    build: { outDir: dist, emptyOutDir: true }, logLevel: "warn" });
  server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://127.0.0.1").pathname;
      const relative = pathname === "/" ? "index.html" : pathname.slice(1);
      const file = path.resolve(dist, relative);
      if (!file.startsWith(dist + path.sep)) { res.writeHead(403); res.end(); return; }
      const content = await readFile(file);
      res.setHeader("content-type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
      res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  const player = (id, eligibility, status = "bench") => ({ id, name: id, team: "", eligibility, status, recent: null });
  const workspace = { version: 1, slots: { C: "1", LW: "1", RW: "0", D: "0", G: "0", F: "0", W: "0", UTIL: "0" },
    slotsReviewed: true, rosterReviewed: true, players: [player("Synthetic Dual", "C/LW"), player("Synthetic Reserve", "LW", "IR")], unresolved: [], scoring: null };
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname.startsWith("/api/")) { report.blockedRequests.push(url.origin + url.pathname); return route.abort(); }
      return route.continue();
    });
    await context.addInitScript(data => { if (!localStorage.getItem("fhfh:roster-autopsy:v1:anonymous")) localStorage.setItem("fhfh:roster-autopsy:v1:anonymous", JSON.stringify(data)); }, workspace);
    const page = await context.newPage();
    page.on("pageerror", error => report.pageErrors.push(error.message));
    await page.goto(origin);
    await page.getByRole("heading", { name: "Your roster priorities" }).waitFor();
    const summary = page.getByRole("region", { name: "Your roster priorities" });
    check(`${width}: diagnosis precedes roster`, await page.evaluate(() => Boolean(document.getElementById("autopsy-diagnosis-heading").compareDocumentPosition(document.getElementById("autopsy-roster-heading")) & Node.DOCUMENT_POSITION_FOLLOWING)));
    check(`${width}: one dual player leaves one simultaneous slot`, await summary.getByText("1 of 2 starting slots remain unfilled when each player is used once.").isVisible());
    check(`${width}: reserves excluded`, await summary.getByText("1 reserve player is excluded from structural coverage (IR, IR+ and NA).").isVisible());
    check(`${width}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await summary.screenshot({ path: path.join(out, `diagnosis-${width}.png`) });
    const coverageAction = summary.getByRole("link", { name: "Review simultaneous coverage" });
    await coverageAction.focus();
    await page.keyboard.press("Enter");
    check(`${width}: keyboard action focuses coverage`, await page.evaluate(() => document.activeElement.id === "autopsy-coverage-heading"));
    await page.getByLabel("Synthetic Dual positions").fill("");
    check(`${width}: unknown positions withhold definite gaps`, !(await summary.getByText(/starting slots remain unfilled/).count()));
    const review = summary.getByRole("link", { name: "Review roster positions" });
    await review.click();
    check(`${width}: review focuses roster`, await page.evaluate(() => document.activeElement.id === "autopsy-roster-heading"));
    await page.getByLabel("Synthetic Dual positions").fill("C/LW");
    await page.getByLabel("Player name", { exact: true }).fill("Synthetic Center");
    await page.getByLabel("League positions", { exact: true }).fill("C");
    await page.getByRole("button", { name: "Add player", exact: true }).click();
    await page.getByLabel("I reviewed this roster and its league positions.", { exact: true }).check();
    check(`${width}: complete legal matching fills both slots`, await summary.getByText("All 2 starting slots can be filled simultaneously with reviewed eligibility.").isVisible());
    check(`${width}: edited roster retained after reload`, await page.reload().then(() => page.getByRole("button", { name: "Remove Synthetic Center" }).isVisible()));
    if (width === 390) {
      await page.evaluate(() => document.documentElement.dir = "rtl");
      check("390: RTL mirror has no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
      await summary.screenshot({ path: path.join(out, "diagnosis-rtl.png") });
    }
    if (width === 1440) {
      await page.evaluate(() => document.documentElement.style.zoom = "2");
      check("1440: 200% CSS zoom has no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    }
    await context.close();
  }
  check("no uncaught page errors", report.pageErrors.length === 0);
  report.result = "passed";
} catch (error) {
  report.result = "failed";
  report.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  if (await readFile(owner, "utf8") === token) { await unlink(owner); await rmdir(lock); }
  await writeFile(path.join(out, "browser-result.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
