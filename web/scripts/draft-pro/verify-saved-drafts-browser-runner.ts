import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { installDraftProFreeFixtures } from "../../e2e/draft-pro-fixtures";

const base = process.env.NEXT_URL!;
const owner = process.env.USER_A!;
const ownerSecond = process.env.USER_A_SECOND!;
const gateway = process.env.SUPABASE_GATEWAY!;
const service = process.env.SERVICE_KEY!;
const ownerId = "00000000-0000-4000-8000-000000000041";
const artifacts = process.env.DRAFT_PRO_BROWSER_ARTIFACTS ?? "/tmp/draft-pro-saved-drafts-artifacts";
mkdirSync(artifacts, { recursive: true });

const savedBrowser = {
  v: 2, configured: true, currentPick: 3, isSnakeDraft: true, myTeamId: "A",
  draftSettings: { teamCount: 2, draftOrder: ["A", "B"], draftOrderMode: "standard", isKeeper: true, rosterConfig: { C: 2, LW: 0, RW: 0, D: 0, G: 0, utility: 0, bench: 1 }, scoringCategories: { G: 1 } },
  draftedPlayers: [{ playerId: "11", teamId: "A", round: 1, pickInRound: 1, pickNumber: 1 }],
  keepers: [{ version: 1, status: "valid", cost: "pick", playerId: "22", teamId: "B", round: 1, pickInRound: 2, pickNumber: 2 }],
  pickTrades: [{ round: 2, pickInRound: 1, currentTeamId: "A" }], pickOwnerOverrides: {}, positionOverrides: {}, customTeamNames: {},
  baselineMode: "remaining", needWeightEnabled: false, needAlpha: 0.5, forwardGrouping: "split", personalizeReplacement: false, goaliePointValues: {},
  sourceControls: { custom_csv_1: { isSelected: true, weight: 1 } }, goalieSourceControls: { custom_csv_1: { isSelected: true, weight: 1 } },
  customCsvList: [{ id: "custom_csv_1", label: "Browser CSV", headers: [{ original: "Player", standardized: "name", selected: true }], rows: [{ Player: "Fixture skater", Rank: 1 }] }],
  favorites: ["1001"], notes: [{ id: "1001", text: "Browser note" }], tiers: { "1001": "Elite" },
};

const session = (token: string) => ({ access_token: token, refresh_token: token, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "00000000-0000-4000-8000-000000000041", aud: "authenticated", role: "authenticated", email: "route-a@example.invalid" } });
async function prepare(page: import("playwright").Page, token: string, snapshot: unknown) {
  await page.addInitScript(({ token, snapshot }) => {
    localStorage.setItem("sb-127-auth-token", JSON.stringify(token));
    sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot));
  }, { token: session(token), snapshot });
}
async function closeDashboardOverlay(page: import("playwright").Page) {
  const overlay = page.getByRole("dialog");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await overlay.isVisible().catch(() => false)) {
      const close = overlay.getByRole("button", { name: "Close Draft Summary" });
      if (await close.isVisible().catch(() => false)) await close.click();
      else await page.keyboard.press("Escape");
      await overlay.waitFor({ state: "hidden" });
      return;
    }
    await page.waitForTimeout(100);
  }
}
async function installPublicDashboardFixtures(page: import("playwright").Page) {
  page.on("pageerror", (error) => console.error(`browser-pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") console.error(`browser-console: ${message.text()}`); });
  await installDraftProFreeFixtures(page, { seedSnapshot: false });
  await page.unroute("**/api/v1/account/draft-pro");
}

async function api(path: string, token: string, method = "GET", body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() as any };
}

async function setActive(active: boolean) {
  const response = await fetch(`${gateway}/rest/v1/user_entitlements?user_id=eq.${ownerId}&entitlement_key=eq.draft_pro`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${service}`, apikey: service, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ entitlement_status: active ? "active" : "inactive" }),
  });
  assert.equal(response.status, 204);
}

const isDraftMutation = (response: import("playwright").Response, id: string, status: number) =>
  response.request().method() === "PUT"
  && new URL(response.url()).pathname === `/api/v1/account/draft-pro/drafts/${id}`
  && response.status() === status;

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const first = await browser.newContext(); const firstPage = await first.newPage(); firstPage.setDefaultTimeout(10_000);
    await installPublicDashboardFixtures(firstPage);
    firstPage.on("dialog", (dialog) => dialog.accept());
    await prepare(firstPage, owner, savedBrowser); await firstPage.goto(`${base}/draft-dashboard`);
    await closeDashboardOverlay(firstPage);
    try { await firstPage.getByRole("button", { name: "Saved Drafts", exact: true }).click(); } catch (error) {
      await closeDashboardOverlay(firstPage);
      try { await firstPage.getByRole("button", { name: "Saved Drafts", exact: true }).click(); } catch {
      const body = await firstPage.locator("body").innerText(); const storage = await firstPage.evaluate(() => Object.keys(localStorage));
      await firstPage.screenshot({ path: "/tmp/draft-pro-saved-drafts-browser-diagnostic.png", fullPage: true });
      throw new Error(`Saved Drafts control unavailable; storage=${JSON.stringify(storage)}; body=${JSON.stringify(body.slice(0, 3000))}; ${error}`);
      }
    }
    const nameInput = firstPage.locator("#new-saved-draft-name");
    try { await nameInput.fill("Browser route draft"); } catch (error) {
      const body = await firstPage.locator("body").innerText(); const storage = await firstPage.evaluate(() => Object.keys(localStorage));
      await firstPage.screenshot({ path: "/tmp/draft-pro-saved-drafts-browser-diagnostic.png", fullPage: true });
      throw new Error(`Saved Drafts name input unavailable; storage=${JSON.stringify(storage)}; body=${JSON.stringify(body.slice(0, 3000))}; ${error}`);
    }
    const createdResponse = firstPage.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/account/draft-pro/drafts" && response.status() === 201);
    await firstPage.getByRole("button", { name: "Save to account", exact: true }).click();
    const created = await (await createdResponse).json();
    const draftId = created.data.id as string;
    await firstPage.getByRole("status").filter({ hasText: "Saved to account." }).waitFor({ timeout: 30_000 });
    const deviceASnapshot = await firstPage.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}"));

    const second = await browser.newContext(); const secondPage = await second.newPage(); secondPage.setDefaultTimeout(10_000);
    await installPublicDashboardFixtures(secondPage);
    secondPage.on("dialog", (dialog) => dialog.type() === "prompt" ? dialog.accept("Conflict copy") : dialog.accept());
    await prepare(secondPage, ownerSecond, { ...savedBrowser, currentPick: 1, favorites: [], notes: [], tiers: {}, customCsvList: [] });
    await secondPage.goto(`${base}/draft-dashboard`); await closeDashboardOverlay(secondPage);
    await secondPage.getByRole("button", { name: "Saved Drafts", exact: true }).click();
    await secondPage.getByRole("button", { name: "Browser route draft", exact: true }).click();
    await secondPage.getByText("Browser route draft", { exact: true }).waitFor({ timeout: 30_000 });
    const panel = secondPage.getByRole("region", { name: "Saved Drafts", exact: true });
    await panel.locator("#annotation-player").selectOption("1001");
    await panel.locator("#player-note").waitFor();
    await panel.getByText("Cloud autosave waits two seconds after changes.", { exact: false }).waitFor();
    await secondPage.getByText("Custom Projections", { exact: false }).waitFor();
    await secondPage.getByRole("button", { name: "Unfavorite Fixture Center", exact: true }).waitFor();
    await secondPage.waitForFunction(() => {
      const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}");
      return snapshot.favorites?.includes("1001") && snapshot.notes?.some((note: any) => note.id === "1001" && note.text === "Browser note");
    });
    const restored = await secondPage.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}"));
    for (const field of ["draftSettings", "draftedPlayers", "keepers", "pickTrades", "sourceControls", "goalieSourceControls", "favorites", "notes", "tiers"] as const) {
      assert.deepEqual(restored[field], deviceASnapshot[field], `device equivalence failed for ${field}`);
    }
    assert.deepEqual(restored.customCsvList.map(({ resolution: _resolution, ...entry }: any) => entry), deviceASnapshot.customCsvList.map(({ resolution: _resolution, ...entry }: any) => entry));
    assert.equal(restored.draftedPlayers.some((pick: any) => pick.playerId === "22" && pick.isKeeper === true), true);
    assert.equal(await secondPage.getByRole("region", { name: "Saved Drafts", exact: true }).locator("#player-note").inputValue(), "Browser note");
    const restoredApi = await api(`/api/v1/account/draft-pro/drafts/${draftId}`, ownerSecond);
    const restoredMetadata = restoredApi.json.data.privateImports[0];
    const restoredRowsResponse = await fetch(`${base}/api/v1/account/draft-pro/drafts/${draftId}/imports/${restoredMetadata.id}?ordinal=0`, { headers: { Authorization: `Bearer ${ownerSecond}` } });
    const restoredRows = JSON.parse(Buffer.from(await restoredRowsResponse.arrayBuffer()).toString());
    const currentImport = restored.customCsvList[0];
    const currentImportComparable = { name: currentImport.label, sourceId: currentImport.id, mapping: currentImport.headers, rows: currentImport.rows };
    const storedImportComparable = { name: restoredMetadata.name, sourceId: restoredMetadata.mapping.sourceId, mapping: restoredMetadata.mapping.headers, rows: restoredRows };
    assert.deepEqual(currentImportComparable, storedImportComparable);
    await secondPage.screenshot({ path: `${artifacts}/desktop-restored.png`, fullPage: true });

    await secondPage.getByRole("button", { name: "Hide Saved Drafts", exact: true }).click();
    const autosaved = secondPage.waitForResponse((response) => isDraftMutation(response, draftId, 200), { timeout: 30_000 });
    const autosaveError = secondPage.waitForFunction(() => document.querySelector('[aria-label="Saved Drafts"] [role="alert"]')?.textContent || false, undefined, { timeout: 30_000 }).then(async (handle) => {
      throw new Error(`hidden-panel autosave rejected before PUT: ${await handle.jsonValue()}`);
    });
    await secondPage.getByRole("button", { name: "Unfavorite Fixture Center", exact: true }).click();
    await secondPage.waitForFunction(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").favorites?.length === 0);
    await Promise.race([autosaved, autosaveError]);
    let detail = await api(`/api/v1/account/draft-pro/drafts/${draftId}`, ownerSecond);
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.json.data.snapshot.favorites, []);

    await secondPage.getByRole("button", { name: "Saved Drafts", exact: true }).click();
    await secondPage.route(`**/api/v1/account/draft-pro/drafts/${draftId}`, (route) => route.abort("failed"), { times: 1 });
    await panel.locator("#player-note").fill("Offline edit remains local");
    await panel.getByRole("alert").waitFor({ timeout: 30_000 });
    const afterFailedSave = await secondPage.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}"));
    assert.deepEqual(afterFailedSave.notes, [{ id: "1001", text: "Offline edit remains local" }]);
    detail = await api(`/api/v1/account/draft-pro/drafts/${draftId}`, ownerSecond);
    assert.deepEqual(detail.json.data.snapshot.notes, [{ id: "1001", text: "Browser note" }]);
    const retried = secondPage.waitForResponse((response) => isDraftMutation(response, draftId, 200), { timeout: 30_000 });
    await panel.getByRole("button", { name: "Retry", exact: true }).click();
    await retried;
    detail = await api(`/api/v1/account/draft-pro/drafts/${draftId}`, ownerSecond);
    assert.deepEqual(detail.json.data.snapshot.notes, [{ id: "1001", text: "Offline edit remains local" }]);

    const externalSnapshot = { ...detail.json.data.snapshot, notes: [{ id: "1001", text: "External version" }] };
    let external = await api(`/api/v1/account/draft-pro/drafts/${draftId}`, owner, "PUT", {
      name: detail.json.data.name,
      snapshot: externalSnapshot,
      expectedVersion: detail.json.data.lockVersion,
      attemptKey: randomUUID(),
      importIds: detail.json.data.privateImports.map((entry: any) => entry.id),
    });
    assert.equal(external.status, 200);
    const conflicted = secondPage.waitForResponse((response) => isDraftMutation(response, draftId, 409), { timeout: 30_000 });
    await panel.locator("#player-note").fill("Stale local version");
    await conflicted;
    await panel.getByRole("alert").filter({ hasText: "changed elsewhere" }).waitFor();
    const reloaded = secondPage.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === `/api/v1/account/draft-pro/drafts/${draftId}` && response.status() === 200);
    await panel.getByRole("button", { name: "Reload saved version", exact: true }).click();
    await reloaded;
    await secondPage.waitForFunction(() => (document.querySelector("#annotation-player") as HTMLSelectElement | null)?.value === "");
    await panel.locator("#annotation-player").selectOption("1001");
    await secondPage.waitForFunction(() => (document.querySelector("#player-note") as HTMLTextAreaElement | null)?.value === "External version");

    detail = await api(`/api/v1/account/draft-pro/drafts/${draftId}`, ownerSecond);
    external = await api(`/api/v1/account/draft-pro/drafts/${draftId}`, owner, "PUT", {
      name: detail.json.data.name,
      snapshot: { ...detail.json.data.snapshot, notes: [{ id: "1001", text: "Second external version" }] },
      expectedVersion: detail.json.data.lockVersion,
      attemptKey: randomUUID(),
      importIds: detail.json.data.privateImports.map((entry: any) => entry.id),
    });
    assert.equal(external.status, 200);
    const secondConflict = secondPage.waitForResponse((response) => isDraftMutation(response, draftId, 409), { timeout: 30_000 });
    await panel.locator("#player-note").fill("Conflict copy content");
    await secondConflict;
    const copied = secondPage.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/account/draft-pro/drafts" && response.status() === 201, { timeout: 30_000 });
    await panel.getByRole("button", { name: "Save as another draft", exact: true }).click();
    const copiedBody = await (await copied).json();
    await panel.getByRole("button", { name: "Conflict copy", exact: true }).waitFor();
    const copyDetail = await api(`/api/v1/account/draft-pro/drafts/${copiedBody.data.id}`, ownerSecond);
    const retainedOriginal = await api(`/api/v1/account/draft-pro/drafts/${draftId}`, ownerSecond);
    assert.deepEqual(copyDetail.json.data.snapshot.notes, [{ id: "1001", text: "Conflict copy content" }]);
    assert.deepEqual(retainedOriginal.json.data.snapshot.notes, [{ id: "1001", text: "Second external version" }]);
    assert.equal(copyDetail.json.data.privateImports.length, 1);
    assert.equal(retainedOriginal.json.data.privateImports.length, 1);

    await setActive(false);
    const inactive = await browser.newContext();
    const inactivePage = await inactive.newPage(); inactivePage.setDefaultTimeout(10_000);
    await installPublicDashboardFixtures(inactivePage);
    inactivePage.on("dialog", (dialog) => dialog.accept());
    await prepare(inactivePage, owner, savedBrowser);
    await inactivePage.goto(`${base}/draft-dashboard`); await closeDashboardOverlay(inactivePage);
    await inactivePage.getByRole("button", { name: "Saved Drafts", exact: true }).click();
    const inactivePanel = inactivePage.getByRole("region", { name: "Saved Drafts", exact: true });
    await inactivePanel.getByText("Draft Pro is inactive.", { exact: false }).waitFor();
    assert.equal(await inactivePanel.locator("#new-saved-draft-name").count(), 0);
    assert.equal(await inactivePanel.getByRole("button", { name: "Browser route draft", exact: true }).isDisabled(), true);
    assert.equal(await inactivePanel.getByText("Account actions locked while Draft Pro is inactive.", { exact: true }).count() > 0, true);
    await inactivePage.getByRole("button", { name: "Draft Fixture Center", exact: true }).first().click();
    await inactivePage.waitForFunction(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftedPlayers?.some((pick: any) => pick.playerId === "1001"));
    await inactive.close();

    await setActive(true);
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobile.newPage(); mobilePage.setDefaultTimeout(10_000);
    await installPublicDashboardFixtures(mobilePage);
    mobilePage.on("dialog", (dialog) => dialog.accept());
    await prepare(mobilePage, owner, savedBrowser);
    await mobilePage.goto(`${base}/draft-dashboard`); await closeDashboardOverlay(mobilePage);
    const savedDraftsButton = mobilePage.getByRole("button", { name: "Saved Drafts", exact: true });
    await savedDraftsButton.focus(); await mobilePage.keyboard.press("Enter");
    assert.equal(await mobilePage.getByRole("button", { name: "Hide Saved Drafts", exact: true }).getAttribute("aria-expanded"), "true");
    const mobilePanel = mobilePage.getByRole("region", { name: "Saved Drafts", exact: true });
    await mobilePanel.locator("#new-saved-draft-name").waitFor();
    await mobilePanel.getByRole("button", { name: "Browser route draft", exact: true }).waitFor();
    await mobilePage.screenshot({ path: `${artifacts}/mobile.png`, fullPage: true });
    const cdp = await mobile.newCDPSession(mobilePage);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    assert.equal(await mobilePage.evaluate(() => window.visualViewport?.scale), 2);
    await mobilePage.screenshot({ path: `${artifacts}/mobile-pinch-200pct.png`, fullPage: true });
    await mobile.close();

    const reflow = await browser.newContext({ viewport: { width: 640, height: 720 } });
    const reflowPage = await reflow.newPage(); reflowPage.setDefaultTimeout(10_000);
    await installPublicDashboardFixtures(reflowPage);
    reflowPage.on("dialog", (dialog) => dialog.accept());
    await prepare(reflowPage, owner, savedBrowser);
    await reflowPage.goto(`${base}/draft-dashboard`); await closeDashboardOverlay(reflowPage);
    await reflowPage.getByRole("button", { name: "Saved Drafts", exact: true }).click();
    const reflowPanel = reflowPage.getByRole("region", { name: "Saved Drafts", exact: true });
    await reflowPanel.locator("#new-saved-draft-name").waitFor();
    await reflowPanel.getByRole("button", { name: "Browser route draft", exact: true }).waitFor();
    assert.equal(await reflowPage.evaluate(() => window.innerWidth), 640);
    await reflowPage.screenshot({ path: `${artifacts}/desktop-200pct-reflow-equivalent.png`, fullPage: true });
    await reflow.close();

    await first.close(); await second.close();
    console.log("saved_drafts_browser=passed; contexts=two-real-user-sessions-plus-inactive-and-mobile; restore=populated-private-csv; autosave=hidden-panel; recovery=retry-local-intact; conflicts=reload-and-copy; inactive=names-locked-free-pick; accessibility=keyboard-mobile; magnification=pinch-200pct; reflow=640px-css-equivalent");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exit(1); });
