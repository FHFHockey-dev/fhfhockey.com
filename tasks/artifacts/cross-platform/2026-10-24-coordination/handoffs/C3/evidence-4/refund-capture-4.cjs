// C3 ticket 4: one distinct screenshot per refund failure state on the real
// /account?section=draft-pro page. Every request is a fixture or aborted; the refund
// POST answers from a scripted queue and never reaches Next, Supabase or Stripe.
const { createRequire } = require("module");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const webRequire = createRequire("/private/tmp/fhfh-c3-isolated/web/package.json");
const { chromium } = webRequire("playwright");

const mode = process.argv[2] ?? "fixed";
const base = "http://127.0.0.1:3120";
const out = path.join(__dirname, `browser-ticket4-${mode}`);
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
const account = {
  access: { eligible: true, grantingSources: ["purchase"], expiresAt: "2027-07-01T04:00:00.000Z", verifiedAt: null, reason: "eligible", providerReadiness: { patreon: false } },
  passInfo: { priceCents: 599, expiresAt: "2027-07-01T04:00:00.000Z", renewal: "none" },
  checkoutAvailability: { available: false, reason: "sales_closed" },
  purchases: [{ id: "purchase-1", season: "draft_pro_2026_27", status: "active", activatedAt: "2026-10-23T00:00:00.000Z", expiresAt: "2027-07-01T04:00:00.000Z", amountCents: 599, currency: "usd", receiptUrl: null, refundEligibility: { eligible: true, deadline: "2026-10-30T00:00:00.000Z", reason: "eligible" } }],
  refundRequests: [], savedDrafts: [], privateImports: [],
};
const json = (status, body) => ({ status, json: body });
// [file, label, fixture reply, text the page must not show]
const scenarios = [
  ["02-network-failure", "network failure (Failed to fetch)", { abort: "failed" }, /Failed to fetch/],
  ["03-timeout", "request timed out", { abort: "timedout" }, /Failed to fetch|timed out|timeout/i],
  ["04-outage-html", "503 outage with HTML body", { status: 503, contentType: "text/html", body: "<html><h1>502 Bad Gateway</h1></html>" }, /Unexpected token|Bad Gateway|JSON/],
  ["05-config-error", "422 forwarding a configuration error", json(422, { error: { code: "refund_window_closed", message: "RESEND_API_KEY is not configured." } }), /RESEND_API_KEY/],
  ["06-server-private", "500 with database and email details", json(500, { error: { code: "refund_request_failed", message: "duplicate key value violates unique constraint \"draft_pro_refund_requests_pkey\" for tim@example.com" } }), /duplicate key|tim@example\.com/],
  ["07-not-found", "404 with internal identifiers", json(404, { error: { code: "purchase_not_found", message: "Purchase 9f1c for user 7d2a not found in draft_pro_purchases" } }), /9f1c|draft_pro_purchases/],
  ["08-auth-expired", "401 expired authentication", json(401, { error: { code: "authentication_required", message: "invalid JWT: unable to parse or verify signature, token is expired" } }), /JWT|signature/],
  ["09-validation", "400 validation error", json(400, { error: { code: "validation_error", message: "Expected string, received number at path explanation" } }), /Expected string|path explanation/],
  ["10-open-request", "409 existing open request", json(409, { error: { code: "refund_request_exists", message: "Conflict on refund row r_8812" } }), /r_8812/],
];
const queue = [];
const posts = [];
const states = [];
const checks = [];
const check = (name, pass, detail = {}) => { checks.push({ name, pass, ...detail }); console.log(`${pass ? "PASS" : "FAIL"} ${name} ${JSON.stringify(detail)}`); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(240_000);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.host === "localhost:54999") {
      if (url.pathname === "/auth/v1/user") return route.fulfill({ json: session.user });
      return route.fulfill({ json: [] });
    }
    if (url.host !== "127.0.0.1:3120") return route.abort();
    if (url.pathname === "/__c3-seed") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>seed</title>" });
    if (url.pathname === "/api/v1/account/draft-pro") return route.fulfill({ json: { data: account } });
    if (url.pathname === "/api/v1/account/draft-pro/refund-requests") {
      posts.push(JSON.parse(route.request().postData()));
      const next = queue.shift();
      if (next.abort) return route.abort(next.abort);
      return next.json !== undefined ? route.fulfill({ status: next.status, json: next.json }) : route.fulfill({ status: next.status, contentType: next.contentType, body: next.body });
    }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, json: { error: "fixture" } });
    return route.continue();
  });

  const capture = async (file, label, reply) => {
    await page.evaluate(([label, reply, count]) => {
      let el = document.getElementById("c3-state-overlay");
      if (!el) {
        el = document.createElement("pre"); el.id = "c3-state-overlay";
        Object.assign(el.style, { position: "fixed", top: "72px", right: "12px", zIndex: "2147483647", width: "560px", whiteSpace: "pre-wrap", wordBreak: "break-all",
          font: "12px/1.45 ui-monospace, monospace", background: "#fff8c5", color: "#111", border: "3px solid #b58900", padding: "10px", margin: "0", pointerEvents: "none" });
        document.body.appendChild(el);
      }
      const statuses = [...document.querySelectorAll("[role=status],[role=alert]")].map((node) => node.textContent.trim()).filter(Boolean);
      const button = [...document.querySelectorAll("button")].find((b) => /Submit request|Submitting/.test(b.textContent));
      el.textContent = [`C3 REFUND STATE: ${label}`, `fixture reply: ${reply}`, `refund POSTs sent so far: ${count}`,
        `submit button: ${button ? `${button.textContent} (${button.disabled ? "disabled" : "enabled"})` : "absent"}`, "page status/alert text:", ...statuses.map((text) => `  • ${text}`)].join("\n");
    }, [label, reply, posts.length]);
    const file_ = path.join(out, `${file}.png`);
    await page.screenshot({ path: file_ });
    states.push({ state: label, file: `${file}.png`, sha256: crypto.createHash("sha256").update(fs.readFileSync(file_)).digest("hex") });
  };
  const describe = (reply) => reply.abort ? `browser abort (${reply.abort})` : `${reply.status} ${reply.json ? JSON.stringify(reply.json) : `${reply.contentType} ${reply.body}`}`;
  const submit = async () => {
    const before = posts.length;
    await page.getByRole("button", { name: "Submit request" }).click();
    for (let waited = 0; posts.length === before && waited < 30_000; waited += 100) await page.waitForTimeout(100);
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll("button")].find((b) => b.textContent === "Submit request");
      return Boolean(button && !button.disabled && document.querySelector("form [role=status]"));
    }, null, { timeout: 30_000 });
    await page.waitForTimeout(300);
    if (posts.length !== before + 1) throw new Error("expected exactly one refund POST per submit");
  };

  await page.goto(`${base}/__c3-seed`);
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [authKey, JSON.stringify(session)]);
  await page.goto(`${base}/account?section=draft-pro`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Submit request" }).waitFor({ timeout: 240_000 });
  await page.getByLabel(/Explanation/).fill("The draft board was unavailable during my live draft.");
  await page.getByRole("button", { name: "Submit request" }).scrollIntoViewIfNeeded();
  await capture("01-form-ready", "refund form before submit", "none yet");

  for (const [file, label, reply, privateText] of scenarios) {
    queue.push(reply);
    await submit();
    // Scan the page without the evidence overlay, which itself quotes the fixture reply.
    await page.evaluate(() => document.getElementById("c3-state-overlay")?.remove());
    const text = await page.locator("body").innerText();
    const status = await page.locator("[role=status]").allInnerTexts();
    await capture(file, label, describe(reply));
    check(`${label}: no raw/private text`, !privateText.test(text), { shown: status });
    check(`${label}: retry stays available`, await page.getByRole("button", { name: "Submit request" }).isEnabled() && (await page.getByLabel(/Explanation/).inputValue()).length > 0);
  }
  queue.push({ status: 201, json: { data: { id: "refund-1", status: "open", emailStatus: "pending" } } });
  await page.getByRole("button", { name: "Submit request" }).click();
  await page.getByText(/submitted for case-by-case review/).waitFor({ timeout: 30_000 });
  await capture("11-retry-confirmed", "manual retry confirmed (fixture 201)", "201 {data:{id:refund-1,status:open}}");
  check("support link stays valid", (await page.getByRole("link", { name: "Support", exact: true }).getAttribute("href")) === "mailto:tim@fhfhockey.com");
  check("one POST per user submit (no automatic retries)", posts.length === scenarios.length + 1, { posts: posts.length });
  const hashes = states.map((s) => s.sha256);
  check("every state screenshot is distinct", new Set(hashes).size === hashes.length, { count: hashes.length });
  fs.writeFileSync(path.join(out, "RESULTS.json"), JSON.stringify({ mode, at: new Date().toISOString(), checks, states }, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); fs.writeFileSync(path.join(out, "ERROR.txt"), String(error?.stack ?? error)); process.exit(1); });
