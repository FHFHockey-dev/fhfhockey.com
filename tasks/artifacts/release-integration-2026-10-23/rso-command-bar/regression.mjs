import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, statSync, unlinkSync, rmdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
const root = "/Users/tim/Code/fhfhockey.com";
const out = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, "web/package.json"));
const sass = require("sass"), { chromium } = require("@playwright/test");
const lock = "/private/tmp/fhfh-heavy.lock", token = randomUUID();
try { mkdirSync(lock); } catch (error) { throw new Error("LOCK OCCUPIED; no browser launched: " + readFileSync(join(lock, "owner.json"), "utf8")); }
writeFileSync(join(lock, "owner.json"), JSON.stringify({ pid: process.pid, token, thread: "01a1637a-4222-70c0-8439-cb3cc46b20c4", scope: "isolated RSO command-bar CSS regression" }));
const inode = statSync(lock).ino;
let browser;
const results = [];
try {
  if (process.version !== "v22.11.0") throw new Error("Node22.11.0 required");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let unexpectedRequests = 0;
  await page.route("**/*", route => { unexpectedRequests++; return route.abort(); });
  for (const version of ["before", "after"]) {
    const path = version === "before" ? join(out, "before.scss") : join(root, "web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss");
    const css = sass.compileString(readFileSync(path, "utf8"), { loadPaths: [join(root, "web")], quietDeps: true }).css;
    for (const width of [1180, 1440, 1920, 1024, 390, 320]) {
      await page.setViewportSize({ width, height: 757 });
      await page.setContent(`<style>* {box-sizing:border-box} body {margin:0} button,input {font:inherit} ${css}</style>
        <div class="workspace"><header class="navBar" role="group" aria-label="Planning command bar">
        <h1 class="navTitle">Roster Schedule Optimizer</h1>
        <button class="providerControl"><span class="providerMark">Y!</span><span><strong>Connected to Yahoo</strong><small>Synced · 2 adds left this week</small></span></button>
        <div class="navWeek"><button>Mon Oct 5 – Wed Oct 7</button><button>Current week</button></div>
        <label class="commandSearch"><input aria-label="Search players" placeholder="Search players"></label>
        <div class="navStatus"><div class="statusRail"><div class="notice">Provider inputs reviewed</div></div></div>
        <div class="commandActions" role="group" aria-label="Workspace actions"><button>Undo</button><button>Matchup</button><button>View account save</button><button>Save to account</button></div>
        <button>Refresh provider</button><details class="navMenu"><summary aria-label="Settings and tools">☰</summary></details>
        </header></div>`);
      await page.evaluate(() => { window.clicked = []; for (const node of document.querySelectorAll("button")) node.addEventListener("click", () => window.clicked.push(node.textContent)); });
      const geometry = await page.locator(".navBar").evaluate(node => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, height: node.getBoundingClientRect().height, outside: [...node.querySelectorAll("button, input, summary")].map(el => ({ text: el.textContent || el.getAttribute("aria-label"), left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })).filter(r => r.left < -0.5 || r.right > innerWidth + 0.5) }));
      results.push({ version, width, ...geometry });
      if (version === "after") {
        if (geometry.outside.length || geometry.documentWidth > width + 1) throw new Error(JSON.stringify(results.at(-1)));
        await page.getByRole("button", { name: "Refresh provider", exact: true }).click({ timeout: 2000 });
        await page.getByRole("button", { name: "Save to account", exact: true }).click({ timeout: 2000 });
        const clicked = await page.evaluate(() => window.clicked);
        if (JSON.stringify(clicked) !== JSON.stringify(["Refresh provider", "Save to account"])) throw new Error("normal clicks not delivered");
        await page.getByRole("button", { name: "View account save", exact: true }).focus();
        await page.keyboard.press("Enter");
        await page.screenshot({ path: join(out, `after-${width}.png`) });
      }
    }
  }
  if (!results.some(r => r.version === "before" && r.width === 1180 && r.outside.length)) throw new Error("original1180px overflow not reproduced");
  if (unexpectedRequests) throw new Error("unexpected request attempted");
  writeFileSync(join(out, "RESULT.json"), JSON.stringify({ status: "pass", scope: "Actual SCSS, synthetic markup matching connected command-bar content; full Next/application regression still required", results, unexpectedRequests }, null, 2));
  console.log("PASS: original1180px overflow reproduced; six corrected widths,12normal clicks and6keyboard activations; zero requests");
} catch (error) {
  writeFileSync(join(out, "RESULT.json"), JSON.stringify({ status: "fail", error: String(error), results }, null, 2));
  throw error;
} finally {
  await browser?.close();
  if (statSync(lock).ino === inode && JSON.parse(readFileSync(join(lock, "owner.json"), "utf8")).token === token) { unlinkSync(join(lock, "owner.json")); rmdirSync(lock); }
}
