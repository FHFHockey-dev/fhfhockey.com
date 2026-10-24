// C3 ticket 3: one visibly distinct screenshot per state. An in-page overlay shows
// the state label, auth owner, raw sessionStorage entry, DOM status text and the IDs
// sent so far. All traffic is fixtures or aborted (see reload-harness.cjs).
const { createRequire } = require("module");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const webRequire = createRequire("/private/tmp/fhfh-c3-isolated/web/package.json");
const { chromium } = webRequire("playwright");

const base = "http://127.0.0.1:3120";
const out = path.join(__dirname, "browser-ticket3");
fs.mkdirSync(out, { recursive: true });
const storageKey = "fhfh:in-season-cancellation:v1";
const authKey = "sb-localhost-auth-token";
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
const claims = (id) => ({ sub: id, exp, role: "authenticated", aud: "authenticated" });
const session = (id) => ({
  access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims(id))}.fixture`,
  refresh_token: `refresh-${id}`, token_type: "bearer", expires_in: 21600, expires_at: exp,
  user: { id, aud: "authenticated", role: "authenticated", email: `${id}@fixture.invalid`, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
});
const ownerA = "00000000-0000-4000-8000-00000000000a";
const ownerB = "00000000-0000-4000-8000-00000000000b";
const sent = [];
const states = [];
const checks = [];
const check = (name, pass, detail = {}) => { checks.push({ name, pass, ...detail }); console.log(`${pass ? "PASS" : "FAIL"} ${name} ${JSON.stringify(detail)}`); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(240_000);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.host === "localhost:54999") {
      const bearer = route.request().headers().authorization ?? "";
      const sub = bearer.includes(b64(claims(ownerB))) ? ownerB : ownerA;
      if (url.pathname === "/auth/v1/user") return route.fulfill({ json: session(sub).user });
      if (url.pathname.startsWith("/auth/v1/logout")) return route.fulfill({ status: 204, body: "" });
      return route.fulfill({ json: [] });
    }
    if (url.host !== "127.0.0.1:3120") return route.abort();
    if (url.pathname === "/__c3-seed") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>seed</title>" });
    if (url.pathname === "/api/v1/account/provider-sync") return route.fulfill({ json: { data: { access: { eligible: false, reason: "no_active_grant", expiresAt: null, nextVerificationAt: null } } } });
    if (url.pathname === "/api/v1/account/in-season/checkout") return route.fulfill({ json: { data: { seasonPassAvailable: false, monthlyAvailable: false, monthlyReason: "disabled", managementAvailable: true } } });
    if (url.pathname === "/api/v1/account/in-season/subscriptions") return route.fulfill({ json: { data: { subscriptions: [{ subscriptionId: "sub_fixture", cancelledAt: null, billingStoppedAt: null, stopComplete: false }] } } });
    if (url.pathname === "/api/v1/account/in-season/cancel") { sent.push(JSON.parse(route.request().postData()).requestId); return route.abort("connectionreset"); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, json: { error: "fixture" } });
    return route.continue();
  });

  const setAuth = (id) => page.evaluate(([key, value]) => value ? localStorage.setItem(key, value) : localStorage.removeItem(key), [authKey, id ? JSON.stringify(session(id)) : null]);
  const stored = () => page.evaluate((key) => sessionStorage.getItem(key), storageKey);
  const reload = async ({ signedIn = true } = {}) => {
    await page.reload({ waitUntil: "domcontentloaded" });
    if (signedIn) await page.getByRole("button", { name: "Cancel monthly access" }).waitFor({ timeout: 120_000 });
    else await page.getByText("You need to sign in before accessing account settings.").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(800);
  };
  const attempt = async () => {
    const before = sent.length;
    await page.getByRole("button", { name: "Cancel monthly access" }).click();
    await page.getByRole("button", { name: "Confirm cancellation" }).click();
    await page.waitForFunction(() => [...document.querySelectorAll("[role=status]")].some((node) => /fetch/i.test(node.textContent)));
    if (sent.length !== before + 1) throw new Error("expected exactly one cancel request");
    return sent.at(-1);
  };
  const capture = async (file, label, note) => {
    await page.evaluate(([label, note, key, authKey, sent]) => {
      let el = document.getElementById("c3-state-overlay");
      if (!el) {
        el = document.createElement("pre"); el.id = "c3-state-overlay";
        Object.assign(el.style, { position: "fixed", top: "72px", right: "12px", zIndex: "2147483647", width: "600px", whiteSpace: "pre-wrap", wordBreak: "break-all",
          font: "12px/1.45 ui-monospace, monospace", background: "#fff8c5", color: "#111", border: "3px solid #b58900", padding: "10px", margin: "0", pointerEvents: "none" });
        document.body.appendChild(el);
      }
      const auth = JSON.parse(localStorage.getItem(authKey) ?? "null");
      const statuses = [...document.querySelectorAll("[role=status],[role=alert],[role=alertdialog]")].map((node) => node.textContent.trim().slice(0, 90)).filter(Boolean);
      el.textContent = [`C3 STATE: ${label}`, note, "", `auth owner: ${auth?.user?.id ?? "(signed out)"}`, `sessionStorage[${key}]:`, `  ${sessionStorage.getItem(key) ?? "(absent)"}`,
        `DOM: cancel button ${document.querySelector("button") && [...document.querySelectorAll("button")].some((b) => b.textContent === "Cancel monthly access") ? "present" : "absent"}; status/alert ${JSON.stringify(statuses)}`,
        `cancel requestIds sent so far (${sent.length}):`, ...sent.map((id, index) => `  #${index + 1} ${id}`)].join("\n");
    }, [label, note, storageKey, authKey, sent]);
    const file_ = path.join(out, `${file}.png`);
    await page.screenshot({ path: file_ });
    states.push({ state: label, file: `${file}.png`, sha256: crypto.createHash("sha256").update(fs.readFileSync(file_)).digest("hex"), stored: await stored(), sent: [...sent] });
  };

  await page.goto(`${base}/__c3-seed`);
  await setAuth(ownerA);
  await page.goto(`${base}/account?section=in-season`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Cancel monthly access" }).waitFor({ timeout: 240_000 });
  const a1 = await attempt();
  await capture("01-lost-response", "lost response (owner A)", "Cancel POST aborted; ID saved for this owner.");

  await reload();
  await capture("02-after-reload", "after reload, before retry (owner A)", "Entry restored-eligible for the same owner.");
  const a2 = await attempt();
  await capture("03-after-reload-retry", "after reload, retry sent (owner A)", "Retry reused the saved ID.");
  check("same owner reuses ID after reload", a2 === a1, { a1, a2 });

  await setAuth(ownerB); await reload();
  await capture("04-after-account-switch", "after account switch to owner B, before retry", "Owner A entry discarded on restore.");
  const b1 = await attempt();
  check("account switch gets a new ID", b1 !== a1, { b1 });

  await page.getByRole("button", { name: "Open account menu" }).first().click();
  await page.getByRole("button", { name: /^Sign Out$/i }).first().click();
  await page.getByText("You need to sign in before accessing account settings.").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await capture("05-after-app-signout", "after app menu sign-out (owner B)", "resetSupabaseBrowserAuthState removed the key.");
  check("app sign-out removes the key", (await stored()) === null);

  await setAuth(ownerB); await reload();
  const b2 = await attempt();
  await capture("06-same-owner-after-signout", "owner B signed in again after sign-out, retry sent", "New ID; the signed-out entry was not reused.");
  check("same owner after sign-out gets a new ID", b2 !== b1, { b2 });

  await page.evaluate((key) => sessionStorage.setItem(key, "{corrupt"), storageKey);
  await reload();
  await capture("07-corrupt-state", "corrupt stored state, after reload (owner B)", "Seeded '{corrupt'; restore dropped it.");
  const b3 = await attempt();
  check("corrupt state gets a valid new ID", b3 !== b2 && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(b3), { b3 });

  const expiredId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  await page.evaluate(([key, value]) => sessionStorage.setItem(key, value), [storageKey, JSON.stringify({ ownerId: ownerB, requests: { sub_fixture: { requestId: expiredId, savedAt: Date.now() - 25 * 3600 * 1000 } } })]);
  await reload();
  await capture("08-expired-state", "expired entry (25 h old), after reload (owner B)", `Seeded ${expiredId}; not restore-eligible.`);
  const b4 = await attempt();
  check("expired entry is not sent", b4 !== expiredId, { b4 });

  await page.evaluate(([key, value]) => sessionStorage.setItem(key, value), [storageKey, JSON.stringify({ ownerId: ownerB, requests: { sub_fixture: { requestId: "-".repeat(36), savedAt: Date.now() } } })]);
  await reload();
  const b5 = await attempt();
  await capture("09-non-uuid-rejected", "36-dash non-UUID entry, retry sent (owner B)", "C3-O1: strict v4 check replaced it.");
  check("non-UUID entry is not sent", b5 !== "-".repeat(36) && b5 !== b4, { b5 });

  const hashes = states.map((s) => s.sha256);
  check("every state screenshot is distinct", new Set(hashes).size === hashes.length, { count: hashes.length });
  fs.writeFileSync(path.join(out, "RESULTS.json"), JSON.stringify({ at: new Date().toISOString(), checks, states }, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); fs.writeFileSync(path.join(out, "ERROR.txt"), String(error?.stack ?? error)); process.exit(1); });
