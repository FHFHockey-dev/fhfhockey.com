// Patch 01 browser checks against an isolated local dev server (never ports 3000 or 3105).
// Usage: node browser-checks.cjs <outDir>   env: BASE_URL (default http://127.0.0.1:3107), CHECKS=home,blog,db,upsert
const fs = require("fs");
const path = require("path");

const WEB = "/Users/tim/Code/fhfhockey.com/web";
const { chromium } = require(require.resolve("@playwright/test", { paths: [WEB] }));
const BASE = process.env.BASE_URL || "http://127.0.0.1:3107";
const OUT = process.argv[2];
const CHECKS = (process.env.CHECKS || "home,blog,db,upsert").split(",");
fs.mkdirSync(OUT, { recursive: true });

// Public NEXT_PUBLIC_* values, resolved in Next's dev precedence order. Not printed.
function envValue(key) {
  for (const file of [".env.development.local", ".env.local", ".env.development", ".env"]) {
    const p = path.join(WEB, file);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}
const GRAPHQL = envValue("NEXT_PUBLIC_SANITY_GRAPHQL_URI");
const SUPABASE_HOST = new URL(envValue("NEXT_PUBLIC_SUPABASE_URL")).hostname;
const BASE_ORIGIN = new URL(BASE).origin;

function observe(page, log) {
  log.console = [];
  log.pageErrors = [];
  log.requests = {};
  log.nonGetRequests = [];
  log.failed = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") log.console.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => log.pageErrors.push(String(e.message).slice(0, 300)));
  page.on("request", (r) => {
    const u = new URL(r.url());
    const key = `${r.method()} ${u.origin === BASE_ORIGIN ? "local" : u.hostname}`;
    log.requests[key] = (log.requests[key] || 0) + 1;
    if (!["GET", "HEAD", "OPTIONS"].includes(r.method())) log.nonGetRequests.push(`${r.method()} ${u.origin === BASE_ORIGIN ? u.pathname : u.hostname + u.pathname}`);
  });
  log.httpErrors = [];
  page.on("response", (r) => {
    if (r.status() >= 400) log.httpErrors.push(`${r.status()} ${new URL(r.url()).pathname.slice(0, 120)}`);
  });
  page.on("requestfailed", (r) => log.failed.push(`${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
}

// Abort any write not explicitly mocked by a later (higher-precedence) route.
async function blockUnmockedWrites(ctx) {
  await ctx.route("**/*", (route) =>
    ["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort());
}

async function homeCheck(browser, results) {
  const log = (results.home = {});
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  observe(page, log);
  const resp = await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 240_000 });
  await page.waitForTimeout(6_000);
  log.status = resp?.status();
  log.title = await page.title();
  await page.screenshot({ path: path.join(OUT, "home-1440.png") });
  await ctx.close();
}

async function blogCheck(browser, results) {
  const log = (results.blog = {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await blockUnmockedWrites(ctx);
  let posted = null;
  log.graphqlCalls = 0;
  const comment = (id, userName, content) => ({ __typename: "Comment", id, userName, content, createdAt: "2026-10-17T12:00:00.000Z" });
  await ctx.route((u) => Boolean(GRAPHQL) && u.href.startsWith(GRAPHQL), async (route) => {
    log.graphqlCalls += 1;
    const comments = posted
      ? [comment("synthetic-2", "AuditBot", "Synthetic audit comment two"), comment("synthetic-1", "AuditBot", "Synthetic audit comment one")]
      : [comment("synthetic-1", "AuditBot", "Synthetic audit comment one")];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { comments } }) });
  });
  await ctx.route("**/api/createComment", async (route) => {
    posted = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  const page = await ctx.newPage();
  observe(page, log);
  // Dev reads the Sanity staging dataset, so pick a post the dev blog index links to.
  await page.goto(`${BASE}/blog`, { waitUntil: "load", timeout: 240_000 });
  const hrefs = await page.locator('a[href^="/blog/"]').evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  log.slugPath = hrefs.find((href) => /^\/blog\/(?!substack\/)[^/?#]+$/.test(href || "")) || null;
  if (!log.slugPath) throw new Error("No Sanity post linked from the dev /blog index");
  const resp = await page.goto(`${BASE}${log.slugPath}`, { waitUntil: "load", timeout: 240_000 });
  log.status = resp?.status();
  await page.getByText("Synthetic audit comment one").waitFor({ timeout: 120_000 });
  log.initialCommentShown = true;
  log.graphqlCallsBeforePost = log.graphqlCalls;
  await page.getByPlaceholder("Display Name...").fill("AuditBot");
  await page.getByPlaceholder("Enter your comment here").fill("Synthetic audit comment two");
  await page.locator('form button[type="submit"]').click();
  await page.getByText("Synthetic audit comment two").waitFor({ timeout: 30_000 });
  log.refetchedCommentShown = true;
  log.postBodyKeys = posted ? Object.keys(posted).sort() : null;
  log.postIdPresent = Boolean(posted?.postId);
  await page.locator("#comments-heading").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, "blog-comments-after-refetch.png") });
  await ctx.close();
}

// Synthetic local session: the token is unsigned and every Supabase request below is answered locally.
function sessionFor() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: "00000000-0000-4000-8000-00000000a0d1", aud: "authenticated", role: "authenticated",
    email: "audit-check@example.invalid", app_metadata: { provider: "email" }, user_metadata: {},
    created_at: "2026-10-17T00:00:00.000Z",
  };
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, role: "authenticated", aud: "authenticated", exp })}.c3ludGhldGlj`;
  return { user, session: { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "synthetic-refresh", user } };
}

async function mockedAccountContext(browser, log, role, extraStorage = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await blockUnmockedWrites(ctx);
  const { user, session } = sessionFor();
  const storage = { [`sb-${SUPABASE_HOST.split(".")[0]}-auth-token`]: JSON.stringify(session), ...extraStorage };
  await ctx.addInitScript((entries) => {
    for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v);
  }, storage);
  log.supabaseCalls = [];
  log.localApiCalls = [];
  await ctx.route((u) => u.hostname === SUPABASE_HOST, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    log.supabaseCalls.push(`${req.method()} ${url.pathname}`);
    const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    if (url.pathname.startsWith("/auth/v1/user")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
    if (url.pathname.startsWith("/auth/v1/")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    if (url.pathname === "/rest/v1/users") {
      const row = { role };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wantsObject ? row : [row]) });
    }
    return route.fulfill({ status: 200, headers: { "content-type": "application/json", "content-range": "0-0/0" }, body: wantsObject ? "{}" : "[]" });
  });
  // The app's own API would read production server-side; answer it locally instead.
  await ctx.route((u) => u.origin === BASE_ORIGIN && u.pathname.startsWith("/api/"), async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    log.localApiCalls.push(`${route.request().method()} ${pathname}`);
    if (pathname === "/api/v1/season") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        seasonId: 20262027, regularSeasonStartDate: "2026-10-07", regularSeasonEndDate: "2027-04-15",
        seasonEndDate: "2027-06-30", numberOfGames: 82, lastSeasonId: 20252026,
        lastRegularSeasonStartDate: "2025-10-07", lastRegularSeasonEndDate: "2026-04-16", lastSeasonEndDate: "2026-06-30",
      }) });
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "mocked by audit browser check" }) });
  });
  return ctx;
}

async function dbCheck(browser, results) {
  const log = (results.db = {});
  const pending = JSON.stringify({ mode: "forward", startDate: "2026-10-01", cursor: "2026-10-05", requestsRun: 1 });
  const ctx = await mockedAccountContext(browser, log, "admin", { "nst-team-stats-backfill": pending });
  const page = await ctx.newPage();
  observe(page, log);
  const resp = await page.goto(`${BASE}/db`, { waitUntil: "load", timeout: 240_000 });
  log.status = resp?.status();
  await page.getByText("Supabase Database").first().waitFor({ timeout: 120_000 });
  log.adminViewShown = true;
  const cancel = page.getByRole("button", { name: "Cancel Pending" });
  log.cancelEnabled = await cancel.isEnabled();
  try {
    await cancel.click({ timeout: 15_000 });
  } catch (error) {
    await page.screenshot({ path: path.join(OUT, "db-click-failure.png") });
    log.clickBlocker = await cancel.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return top ? `${top.tagName.toLowerCase()}#${top.id}.${String(top.className).slice(0, 80)}` : null;
    });
    throw error;
  }
  const toast = page.getByText("Cleared pending NST backfill.");
  await toast.waitFor({ timeout: 10_000 });
  log.snackbarShown = true;
  await page.waitForTimeout(1_000); // let the slide-in transition finish before measuring
  const box = await toast.boundingBox();
  log.snackbarBox = box && { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
  log.viewport = page.viewportSize();
  log.anchorBottomLeft = Boolean(box && box.x < log.viewport.width / 2 && box.y > log.viewport.height / 2);
  await page.screenshot({ path: path.join(OUT, "db-snackbar.png") });
  await ctx.close();
}

// Non-admin visitor on the importer: it enqueues "Access Denied" and immediately routes to /auth.
async function upsertCheck(browser, results) {
  const log = (results.upsert = {});
  const ctx = await mockedAccountContext(browser, log, null);
  const page = await ctx.newPage();
  observe(page, log);
  // Warm the route first so compilation time does not hide the toast window, then probe from commit.
  await page.goto(`${BASE}/db/upsert-projections`, { waitUntil: "load", timeout: 240_000 });
  await page.goto(`${BASE}/auth`, { waitUntil: "commit", timeout: 240_000 }).catch(() => {});
  const servedApp = await page.evaluate(async () => (await fetch("/_next/static/chunks/pages/_app.js")).text()).catch(() => "");
  log.servedAppHasNotistack = servedApp.includes("SnackbarProvider");
  await page.goto(`${BASE}/db/upsert-projections`, { waitUntil: "commit", timeout: 240_000 });
  const message = "Access Denied: Admin privileges required.";
  log.timeline = [];
  const started = Date.now();
  while (Date.now() - started < 9_000) {
    const visible = await page.getByText(message).first().isVisible().catch(() => false);
    const pathname = new URL(page.url()).pathname;
    const last = log.timeline[log.timeline.length - 1];
    if (!last || last.path !== pathname || last.toastVisible !== visible) log.timeline.push({ ms: Date.now() - started, path: pathname, toastVisible: visible });
    await page.waitForTimeout(100);
  }
  log.finalPath = new URL(page.url()).pathname;
  log.toastVisibleAfterRedirect = log.timeline.some((t) => t.path !== "/db/upsert-projections" && t.toastVisible);
  await page.screenshot({ path: path.join(OUT, `upsert-nonadmin-${process.env.LABEL || "patched"}.png`) });
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  const results = { base: BASE, startedAt: new Date().toISOString(), checks: CHECKS, graphqlConfigured: Boolean(GRAPHQL) };
  const runners = { home: homeCheck, blog: blogCheck, db: dbCheck, upsert: upsertCheck };
  for (const name of CHECKS) {
    try {
      await runners[name](browser, results);
      results[name].ok = true;
    } catch (e) {
      results[name] = { ...(results[name] || {}), ok: false, error: String(e.message).slice(0, 500) };
    }
  }
  await browser.close();
  results.finishedAt = new Date().toISOString();
  const file = path.join(OUT, `results-${process.env.LABEL || "patched"}.json`);
  fs.writeFileSync(file, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})();
