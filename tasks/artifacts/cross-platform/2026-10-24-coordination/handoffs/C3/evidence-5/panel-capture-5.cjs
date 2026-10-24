// C3 ticket 5: one distinct screenshot per DraftProPanel message state on the real
// /account page. Each endpoint answers from a scripted per-path queue (fixtures or
// browser aborts); nothing reaches Next API routes, Supabase, Stripe or Patreon.
const { createRequire } = require("module");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const webRequire = createRequire("/private/tmp/fhfh-c3-isolated/web/package.json");
const { chromium } = webRequire("playwright");

const mode = process.argv[2] ?? "fixed";
const base = "http://127.0.0.1:3120";
const out = path.join(__dirname, `browser-ticket5-${mode}`);
fs.mkdirSync(out, { recursive: true });
const authKey = "sb-localhost-auth-token";
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
const owner = "00000000-0000-4000-8000-00000000000a";
const session = {
  access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: owner, exp, role: "authenticated", aud: "authenticated" })}.fixture`,
  refresh_token: "refresh-fixture", token_type: "bearer", expires_in: 21600, expires_at: exp,
  user: { id: owner, aud: "authenticated", role: "authenticated", email: "owner-a@fixture.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
};
const hours = (n) => new Date(Date.now() + n * 3_600_000).toISOString();
const purchase = (deadline, eligible) => ({ id: "purchase-1", season: "draft_pro_2026_27", status: "active", activatedAt: hours(-24), expiresAt: "2027-07-01T04:00:00.000Z", amountCents: 599, currency: "usd", receiptUrl: null, refundEligibility: { eligible, deadline, reason: eligible ? "eligible" : "window_closed" } });
const active = { access: { eligible: true, grantingSources: ["purchase"], expiresAt: "2027-07-01T04:00:00.000Z", verifiedAt: null, reason: "eligible", providerReadiness: { patreon: false } },
  passInfo: { priceCents: 599, expiresAt: "2027-07-01T04:00:00.000Z", renewal: "none" }, checkoutAvailability: { available: false, reason: "sales_closed" },
  purchases: [purchase(hours(144), true)], refundRequests: [], savedDrafts: [], privateImports: [] };
const inactive = { ...active, access: { ...active.access, eligible: false, grantingSources: [], expiresAt: null }, purchases: [] };
const json = (status, body) => ({ status, json: body });
const privateServer = json(500, { error: { code: "account_unavailable", message: "relation \"draft_pro_purchases\" does not exist; user tim@example.com" }, hint: "SUPABASE_SERVICE_ROLE_KEY missing" });
const P = { account: "/api/v1/account/draft-pro", refund: "/api/v1/account/draft-pro/refund-requests", redeem: "/api/v1/account/draft-pro/access-codes/redeem", verify: "/api/v1/account/draft-pro/checkout/verify", patreon: "/api/v1/account/patreon/connect" };

// [file, label, account fixture, query, scripted replies, action, private text]
const states = [
  ["01-refund-config-422", "refund: 422 configuration error with its own code (re-capture of ticket-4 state 05)", active, "", { [P.refund]: [json(422, { error: { code: "configuration_error", message: "RESEND_API_KEY is not configured." } })] }, "refund", /RESEND_API_KEY|window for this purchase has closed/],
  ["02-refund-relabelled-422", "refund: 422 the current route relabels refund_window_closed (known boundary limit)", active, "", { [P.refund]: [json(422, { error: { code: "refund_window_closed", message: "RESEND_API_KEY is not configured." } })] }, "refund", /RESEND_API_KEY/],
  ["03-refund-proxy-404", "refund: unrelated 404 HTML from a proxy", active, "", { [P.refund]: [{ status: 404, contentType: "text/html", body: "<html>404 Not Found</html>" }] }, "refund", /Not Found|isn't eligible/],
  ["04-refund-409-other-code", "refund: 409 with a different code", active, "", { [P.refund]: [json(409, { error: { code: "write_conflict", message: "could not serialize access due to concurrent update" } })] }, "refund", /serialize|open refund request/],
  ["05-window-ends", "refund window notice: open request, deadline in 36 h", { ...active, purchases: [purchase(hours(36), true)], refundRequests: [{ id: "refund-1", purchaseId: "purchase-1", reason: "other", status: "open", submittedAt: hours(-1), emailStatus: "sent" }] }, "", {}, null, /window ended/],
  ["06-window-ended", "refund window notice: deadline 36 h ago", { ...active, purchases: [purchase(hours(-36), false)] }, "", {}, null, /window ends/],
  ["07-account-private-500", "account load: 500 with database, email and key names", null, "", { [P.account]: [privateServer] }, null, /draft_pro_purchases|tim@example\.com|SUPABASE|does not exist/],
  ["08-account-401", "account load: 401 expired session", null, "", { [P.account]: [json(401, { error: { code: "authentication_required", message: "invalid JWT: token is expired" } })] }, null, /JWT/],
  ["09-redeem-network", "access code: network failure", inactive, "", { [P.redeem]: [{ abort: "failed" }] }, "redeem:COMP-RETRY-2026-VALID", /Failed to fetch/],
  ["10-recovery-403", "recovery code: 403 naming another account", inactive, "", { [P.verify]: [json(403, { error: "This Checkout session cs_live_a1b2 belongs to user 7d2a" })] }, "redeem:DPRO-11111111-1111-4111-8111-111111111111", /cs_live|7d2a/],
  ["11-redeem-refresh-fails", "access code accepted, every account refresh fails", inactive, "", { [P.redeem]: [json(200, { redeemed: true })], afterRedeem: privateServer }, "redeem:COMP-RETRY-2026-VALID", /draft_pro_purchases|tim@example\.com|SUPABASE/],
  ["12-checkout-config-503", "checkout verify: 503 configuration error", inactive, "?section=draft-pro&draft_pro_checkout=cs_test_private", { [P.verify]: [json(503, { error: "Stripe checkout is not configured. STRIPE_SECRET_KEY unset" })] }, null, /STRIPE_SECRET_KEY|not configured/],
  ["13-patreon-connect-500", "Patreon connect: 500 with private details", active, "", { [P.patreon]: [privateServer] }, "patreon", /draft_pro_purchases|tim@example\.com|SUPABASE|object Object/],
];

let queues = {};
let afterRedeem = null;
let redeemed = false;
let accountFixture = active;
const results = [];
const checks = [];
const check = (name, pass, detail = {}) => { checks.push({ name, pass, ...detail }); console.log(`${pass ? "PASS" : "FAIL"} ${name} ${JSON.stringify(detail)}`); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(240_000);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.host === "localhost:54999") return route.fulfill({ json: url.pathname === "/auth/v1/user" ? session.user : [] });
    if (url.host !== "127.0.0.1:3120") return route.abort();
    if (url.pathname === "/__c3-seed") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>seed</title>" });
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === P.redeem) redeemed = true;
      // The panel loads the account more than once on mount, so account replies repeat;
      // afterRedeem fails only the refreshes that follow a redemption.
      const queue = queues[url.pathname];
      const next = url.pathname === P.account && afterRedeem && redeemed ? afterRedeem : url.pathname === P.account ? queue?.[0] : queue?.shift();
      if (next) return next.abort ? route.abort(next.abort) : next.json !== undefined ? route.fulfill({ status: next.status, json: next.json }) : route.fulfill({ status: next.status, contentType: next.contentType, body: next.body });
      if (url.pathname === P.account) return route.fulfill({ json: { data: accountFixture } });
      return route.fulfill({ status: 404, json: { error: "fixture" } });
    }
    return route.continue();
  });

  await page.goto(`${base}/__c3-seed`);
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [authKey, JSON.stringify(session)]);
  for (const [file, label, fixture, query, replies, action, privateText] of states) {
    accountFixture = fixture ?? active;
    afterRedeem = replies.afterRedeem ?? null; redeemed = false;
    queues = Object.fromEntries(Object.entries(replies).filter(([key]) => key !== "afterRedeem").map(([key, list]) => [key, [...list]]));
    const described = JSON.stringify(Object.fromEntries(Object.entries({ ...replies, ...(afterRedeem ? { afterRedeem: [afterRedeem] } : {}) }).map(([key, list]) => [key.replace("/api/v1/account/", ""), list.filter(Boolean).map((r) => r.abort ? `abort(${r.abort})` : `${r.status} ${r.json ? JSON.stringify(r.json) : r.body}`)])));
    await page.goto(`${base}/account${query || "?section=draft-pro"}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Draft Pro" }).first().waitFor({ timeout: 240_000 });
    if (action === "refund") {
      await page.getByLabel(/Explanation/).fill("The draft board was unavailable during my live draft.");
      await page.getByRole("button", { name: "Submit request" }).click();
      await page.waitForFunction(() => [...document.querySelectorAll("form [role=status]")].some((n) => n.textContent.trim()), null, { timeout: 30_000 });
    } else if (action?.startsWith("redeem:")) {
      await page.getByLabel("Draft Pro access code").fill(action.slice(7));
      await page.getByRole("button", { name: "Redeem code" }).click();
      // Next's route announcer is also role=alert, so wait for the form's own alert.
      await page.locator("form [role=alert]").first().waitFor({ timeout: 30_000 });
    } else if (action === "patreon") {
      await page.getByRole("button", { name: "Connect Patreon" }).click();
      await page.waitForFunction(() => [...document.querySelectorAll("[role=status]")].some((n) => /Patreon|Failed|object|relation/.test(n.textContent)), null, { timeout: 30_000 });
    } else if (file.startsWith("12")) {
      await page.getByRole("button", { name: "Check purchase status again" }).waitFor({ timeout: 30_000 });
    } else if (file.startsWith("0") && Number(file.slice(0, 2)) >= 7) {
      await page.locator("section[role=alert]").first().waitFor({ timeout: 60_000 });
    } else {
      await page.getByText(/The request window (ends|ended)/).waitFor({ timeout: 60_000 });
    }
    await page.waitForTimeout(400);
    const text = await page.locator("main, body").first().innerText();
    const shown = (await page.locator("[role=status], [role=alert]").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    const windowNotice = await page.getByText(/The request window (ends|ended)/).allInnerTexts();
    check(`${label}: no raw, private or false text`, !privateText.test(text), { shown, windowNotice });
    await page.evaluate(([label, described, shown, windowNotice]) => {
      const el = document.createElement("pre"); el.id = "c3-state-overlay";
      Object.assign(el.style, { position: "fixed", top: "72px", right: "12px", zIndex: "2147483647", width: "560px", whiteSpace: "pre-wrap", wordBreak: "break-all",
        font: "12px/1.45 ui-monospace, monospace", background: "#fff8c5", color: "#111", border: "3px solid #b58900", padding: "10px", margin: "0", pointerEvents: "none" });
      el.textContent = [`C3 TICKET-5 STATE: ${label}`, `fixture replies: ${described}`, "page status/alert text:", ...shown.map((t) => `  • ${t.slice(0, 160)}`), ...windowNotice.map((t) => `window notice: ${t}`)].join("\n");
      document.body.appendChild(el);
    }, [label, described, shown, windowNotice]);
    const file_ = path.join(out, `${file}.png`);
    await page.screenshot({ path: file_, fullPage: true });
    results.push({ state: label, file: `${file}.png`, sha256: crypto.createHash("sha256").update(fs.readFileSync(file_)).digest("hex"), shown, windowNotice });
  }
  const hashes = results.map((r) => r.sha256);
  check("every state screenshot is distinct", new Set(hashes).size === hashes.length, { count: hashes.length });
  fs.writeFileSync(path.join(out, "RESULTS.json"), JSON.stringify({ mode, at: new Date().toISOString(), checks, states: results }, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); fs.writeFileSync(path.join(out, "ERROR.txt"), String(error?.stack ?? error)); process.exit(1); });
