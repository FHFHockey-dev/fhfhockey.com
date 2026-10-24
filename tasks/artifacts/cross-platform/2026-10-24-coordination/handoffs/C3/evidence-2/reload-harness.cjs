// C3 browser reload evidence. Every network request is answered by fixtures or
// aborted: the fake Supabase host (localhost:54999) never exists, billing routes
// are intercepted before reaching Next, and any other host is blocked.
const { createRequire } = require("module");
const fs = require("fs");
const path = require("path");
const webRequire = createRequire("/private/tmp/fhfh-c3-isolated/web/package.json");
const { chromium } = webRequire("playwright");

const mode = process.argv[2] ?? "fixed";
const base = "http://127.0.0.1:3120";
const out = path.join(__dirname, `browser-${mode}`);
fs.mkdirSync(out, { recursive: true });
const storageKey = "fhfh:in-season-cancellation:v1";
const authKey = "sb-localhost-auth-token";
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
const session = (id) => ({
  access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: id, exp, role: "authenticated", aud: "authenticated" })}.fixture`,
  refresh_token: `refresh-${id}`, token_type: "bearer", expires_in: 21600, expires_at: exp,
  user: { id, aud: "authenticated", role: "authenticated", email: `${id}@fixture.invalid`, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
});
const ownerA = "00000000-0000-4000-8000-00000000000a";
const ownerB = "00000000-0000-4000-8000-00000000000b";

const cancelBodies = [];
const blocked = [];
const results = [];
const record = (name, pass, detail) => { results.push({ name, pass, ...detail }); console.log(`${pass ? "PASS" : "FAIL"} ${name} ${JSON.stringify(detail)}`); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(240_000);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.host === "localhost:54999") {
      const bearer = route.request().headers().authorization ?? "";
      const sub = bearer.includes(b64({ sub: ownerB, exp, role: "authenticated", aud: "authenticated" })) ? ownerB : ownerA;
      if (url.pathname === "/auth/v1/user") return route.fulfill({ json: session(sub).user });
      if (url.pathname.startsWith("/auth/v1/logout")) return route.fulfill({ status: 204, body: "" });
      return route.fulfill({ json: [] });
    }
    if (url.host !== "127.0.0.1:3120") { blocked.push(url.host); return route.abort(); }
    if (url.pathname === "/__c3-seed") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>seed</title>" });
    if (url.pathname === "/api/v1/account/provider-sync") return route.fulfill({ json: { data: { access: { eligible: false, reason: "no_active_grant", expiresAt: null, nextVerificationAt: null } } } });
    if (url.pathname === "/api/v1/account/in-season/checkout") return route.fulfill({ json: { data: { seasonPassAvailable: false, monthlyAvailable: false, monthlyReason: "disabled", managementAvailable: true } } });
    if (url.pathname === "/api/v1/account/in-season/subscriptions") return route.fulfill({ json: { data: { subscriptions: [{ subscriptionId: "sub_fixture", cancelledAt: null, billingStoppedAt: null, stopComplete: false }] } } });
    if (url.pathname === "/api/v1/account/in-season/cancel") {
      cancelBodies.push({ ...JSON.parse(route.request().postData()), authorization: route.request().headers().authorization?.slice(0, 12) + "…" });
      return route.abort("connectionreset"); // the server may have saved it; the browser never learns
    }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, json: { error: "fixture" } });
    return route.continue();
  });

  const setAuth = (id) => page.evaluate(([key, value]) => value ? localStorage.setItem(key, value) : localStorage.removeItem(key), [authKey, id ? JSON.stringify(session(id)) : null]);
  const stored = () => page.evaluate((key) => sessionStorage.getItem(key), storageKey);
  const open = async () => {
    await page.goto(`${base}/account?section=in-season`, { waitUntil: "domcontentloaded" });
  };
  const attempt = async (label) => {
    await page.getByRole("button", { name: "Cancel monthly access" }).click({ timeout: 90_000 });
    await page.getByRole("button", { name: "Confirm cancellation" }).click();
    await page.getByRole("status").filter({ hasText: /fetch|network|Cancellation/i }).first().waitFor({ timeout: 15_000 });
    await page.screenshot({ path: path.join(out, `${label}.png`) });
    return cancelBodies.at(-1).requestId;
  };

  await page.goto(`${base}/__c3-seed`);
  await setAuth(ownerA);
  await open();
  const first = await attempt("1-owner-a-lost-response");
  const afterFirst = await stored();
  await page.reload({ waitUntil: "domcontentloaded" });
  const second = await attempt("2-owner-a-after-reload");
  record("same-owner reload reuses request ID", first === second, { first, second, storedAfterFirst: afterFirst });

  if (mode === "fixed" || mode === "ticket2") {
    const signOutFromMenu = async (tab) => {
      await tab.getByRole("button", { name: "Open account menu" }).first().click({ timeout: 60_000 });
      await tab.getByRole("button", { name: /^Sign Out$/i }).first().click();
    };
    await setAuth(ownerB); await page.reload({ waitUntil: "domcontentloaded" });
    const foreign = await attempt("3-owner-b-after-switch");
    const storedB = JSON.parse(await stored());
    record("account switch never reuses owner A ID", foreign !== first && storedB.ownerId === ownerB && !JSON.stringify(storedB).includes(first), { foreign, storedOwner: storedB.ownerId });

    // Same-tab app sign-out: the provider unmounts the panel before SIGNED_OUT reaches it.
    await signOutFromMenu(page);
    await page.getByText("You need to sign in before accessing account settings.").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1000);
    const afterMenuSignOut = await stored();
    await page.screenshot({ path: path.join(out, "4-owner-b-same-tab-menu-signout.png") });
    if (mode === "ticket2") {
      record("same-tab app menu sign-out clears the key although the panel unmounted first", afterMenuSignOut === null, { storedAfterSignOut: afterMenuSignOut });
      await setAuth(ownerB); await page.reload({ waitUntil: "domcontentloaded" });
      const bAgain = await attempt("4b-owner-b-after-menu-signout");
      record("same owner after app menu sign-out gets a new request ID", bAgain !== foreign, { foreign, bAgain });
    } else record("CHARACTERIZATION same-tab menu sign-out leaves owner B entry (panel already unmounted)", true, { storedAfterSignOut: afterMenuSignOut });

    await setAuth(ownerA); await page.reload({ waitUntil: "domcontentloaded" });
    const aAfterB = await attempt("5-owner-a-after-owner-b-signout");
    const storedA = JSON.parse(await stored());
    record("next owner cannot recover the signed-out owner's ID", aAfterB !== foreign && aAfterB !== first && storedA.ownerId === ownerA && !JSON.stringify(storedA).includes(foreign), { aAfterB, storedOwner: storedA.ownerId });

    // Cross-tab sign-out while this tab's panel stays mounted: SIGNED_OUT is broadcast here.
    const other = await context.newPage(); other.setDefaultNavigationTimeout(240_000);
    await other.goto(`${base}/account?section=in-season`, { waitUntil: "domcontentloaded" });
    await signOutFromMenu(other);
    await page.getByText("You need to sign in before accessing account settings.").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1000);
    const afterCrossTab = await stored();
    await page.screenshot({ path: path.join(out, "6-owner-a-cross-tab-signout.png") });
    record("cross-tab sign-out with mounted panel clears stored request", afterCrossTab === null, { afterCrossTab });
    await other.close();

    await setAuth(ownerA); await page.reload({ waitUntil: "domcontentloaded" });
    const aAfterSignOut = await attempt("7-owner-a-after-cross-tab-signout");
    record("same owner after observed sign-out gets a new request ID", aAfterSignOut !== aAfterB, { aAfterSignOut });

    await setAuth(null); await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("You need to sign in before accessing account settings.").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1000);
    const anonymousStored = await stored();
    await page.screenshot({ path: path.join(out, "8-anonymous-reload.png") });
    record("CHARACTERIZATION anonymous reload renders no panel and leaves entry untouched", true, { anonymousStored });

    await page.evaluate((key) => sessionStorage.setItem(key, "{corrupt"), storageKey);
    await setAuth(ownerA); await page.reload({ waitUntil: "domcontentloaded" });
    const afterCorrupt = await attempt("9-owner-a-after-corrupt-state");
    record("corrupt state fails safe with a valid new ID", /^[a-f0-9-]{36}$/.test(afterCorrupt) && afterCorrupt !== aAfterSignOut, { afterCorrupt, stored: await stored() });
  }

  fs.writeFileSync(path.join(out, "RESULTS.json"), JSON.stringify({ mode, at: new Date().toISOString(), results, cancelBodies, blockedHosts: [...new Set(blocked)] }, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); fs.writeFileSync(path.join(out, "ERROR.txt"), String(error?.stack ?? error)); process.exit(1); });
