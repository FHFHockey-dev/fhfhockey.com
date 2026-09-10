import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { installDraftProFreeFixtures } from "../../e2e/draft-pro-fixtures";
import { serializeSavedDraft, toNormalizedPrivateImports } from "../../lib/draft-pro/savedDrafts";

const base = process.env.NEXT_URL!;
const gateway = process.env.SUPABASE_GATEWAY!;
const owner = process.env.USER_A!;
const other = process.env.USER_B!;
const service = process.env.SERVICE_KEY!;
const ownerId = "00000000-0000-4000-8000-000000000041";
const artifacts = process.env.DRAFT_PRO_REPORTS_BROWSER_ARTIFACTS ?? "/tmp/draft-pro-reports-browser-artifacts";
mkdirSync(artifacts, { recursive: true });

const currentSnapshot = {
  v: 2 as const, configured: true, currentPick: 3, isSnakeDraft: true, myTeamId: "Team 1",
  draftSettings: { teamCount: 2, draftOrder: ["Team 1", "Team 2"], draftOrderMode: "standard", leagueType: "points" as const, rosterConfig: { C: 1, LW: 0, RW: 0, D: 0, G: 0, utility: 0, bench: 0 }, scoringCategories: { GOALS: 3, ASSISTS: 2, SHOTS_ON_GOAL: 0.2 } },
  draftedPlayers: [
    { playerId: "1001", teamId: "Team 1", round: 1, pickInRound: 1, pickNumber: 1 },
    { playerId: "1002", teamId: "Team 2", round: 1, pickInRound: 2, pickNumber: 2 },
  ],
  keepers: [], pickOwnerOverrides: {}, pickTrades: [], positionOverrides: {}, customTeamNames: {},
  baselineMode: "remaining" as const, needWeightEnabled: false, needAlpha: 0.5, forwardGrouping: "split" as const, personalizeReplacement: false,
  goaliePointValues: {}, sourceControls: { ag_skaters: { isSelected: true, weight: 1 } }, goalieSourceControls: { cullen_goalies: { isSelected: true, weight: 1 } }, customCsvList: [], favorites: [], notes: [], tiers: {},
};
const privateSnapshot = {
  ...currentSnapshot,
  sourceControls: { custom_csv_1: { isSelected: true, weight: 1 } }, goalieSourceControls: { cullen_goalies: { isSelected: true, weight: 1 } },
  customCsvList: [{
    id: "custom_csv_1", label: "Report private rows",
    headers: [{ original: "Player_Name", standardized: "name", selected: true }, { original: "Goals", standardized: "GOALS", selected: true }, { original: "Assists", standardized: "ASSISTS", selected: true }, { original: "Shots_on_Goal", standardized: "SHOTS_ON_GOAL", selected: true }],
    rows: [
      { player_id: 1001, Player_Name: "Fixture Center", Team_Abbreviation: "AAA", Position: "C", Games_Played: 82, Goals: 34, Assists: 45, Shots_on_Goal: 220 },
      { player_id: 1002, Player_Name: "Fixture Center Two", Team_Abbreviation: "CCC", Position: "C", Games_Played: 82, Goals: 29, Assists: 40, Shots_on_Goal: 200 },
      { player_id: 1003, Player_Name: "Fixture Center Three", Team_Abbreviation: "DDD", Position: "C", Games_Played: 82, Goals: 25, Assists: 35, Shots_on_Goal: 180 },
    ],
  }],
};
const auth = { access_token: owner, refresh_token: owner, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: ownerId, aud: "authenticated", role: "authenticated", email: "route-a@example.invalid" } };

async function call(path: string, method = "GET", body?: unknown) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${owner}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, json: await response.json() as any };
}
async function serviceRequest(path: string, method: "POST" | "PATCH", body: unknown) {
  const response = await fetch(`${gateway}/rest/v1/${path}`, { method, headers: { Authorization: `Bearer ${service}`, apikey: service, "Content-Type": "application/json", Prefer: "return=minimal,resolution=merge-duplicates" }, body: JSON.stringify(body) });
  assert(response.ok, `${method} ${path}: ${response.status} ${await response.text()}`);
}
async function setActive(active: boolean) { await serviceRequest(`user_entitlements?user_id=eq.${ownerId}&entitlement_key=eq.draft_pro`, "PATCH", { entitlement_status: active ? "active" : "inactive" }); }
async function seedReadySchedule() {
  const fetchedAt = new Date().toISOString();
  await serviceRequest("teams", "POST", [{ id: 1, name: "Alpha", abbreviation: "AAA" }, { id: 2, name: "Beta", abbreviation: "CCC" }]);
  await serviceRequest("yahoo_matchup_weeks", "POST", { id: 1, game_key: "477", season: "2026", week: 1, start_date: "2026-10-05", end_date: "2026-10-11" });
  const common = { yahoo_matchup_week_id: 1, game_key: "477", season: "2026", week: 1, source_game_id: 9001, source_season_id: 20252026, game_date: "2026-10-05", start_time: "2026-10-05T23:00:00Z", game_type: 2, game_status: "FUT", schedule_status: "OK", mapping_status: "mapped", is_countable: true, source_url: "https://example.invalid/schedule", source_updated_at: fetchedAt, source_metadata: { fixture: true }, fetched_at: fetchedAt };
  await serviceRequest("roster_optimizer_team_games", "POST", [{ ...common, team_id: 1, team_abbreviation: "AAA", opponent_team_id: 2, opponent_abbreviation: "CCC", home_away: "home" }, { ...common, team_id: 2, team_abbreviation: "CCC", opponent_team_id: 1, opponent_abbreviation: "AAA", home_away: "away" }]);
}
async function seedPrivateDraft() {
  const normalized = toNormalizedPrivateImports(privateSnapshot.customCsvList); const snapshot = serializeSavedDraft(privateSnapshot); const attemptKey = randomUUID(); const rows = Buffer.from(JSON.stringify(normalized[0].rows));
  const begun = await call("/api/v1/account/draft-pro/private-imports", "POST", { draftId: null, expectedVersion: null, attemptKey, name: normalized[0].name, mapping: { sourceId: normalized[0].sourceId, headers: normalized[0].mapping }, declaredMaxBytes: rows.byteLength }); assert.equal(begun.status, 201, JSON.stringify(begun.json)); const upload = begun.json.data.upload;
  const chunkResponse = await fetch(`${base}/api/v1/account/draft-pro/private-imports/${upload.upload_id}/chunks/0`, { method: "PUT", headers: { Authorization: `Bearer ${owner}`, "X-Draft-Pro-Upload-Prefix": upload.storage_prefix, "Content-Type": "application/json" }, body: rows }); const chunk = await chunkResponse.json(); assert.equal(chunkResponse.status, 201, JSON.stringify(chunk));
  const staged = await call(`/api/v1/account/draft-pro/private-imports/${upload.upload_id}/stage`, "POST", { chunkPaths: [chunk.data.path] }); assert.equal(staged.status, 201, JSON.stringify(staged.json));
  const saved = await call("/api/v1/account/draft-pro/drafts", "POST", { name: "Report private draft", snapshot, attemptKey }); assert.equal(saved.status, 201, JSON.stringify(saved.json)); return saved.json.data.id as string;
}
async function closeOverlay(page: Page) { const dialog = page.getByRole("dialog"); for (let attempt = 0; attempt < 20; attempt += 1) { if (await dialog.isVisible().catch(() => false)) { const close = dialog.getByRole("button", { name: "Close Draft Summary" }); if (await close.isVisible().catch(() => false)) await close.click(); else await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" }); return; } await page.waitForTimeout(100); } }
async function prepare(page: Page, snapshot: unknown = currentSnapshot) { await installDraftProFreeFixtures(page, { seedSnapshot: false }); await page.unroute("**/api/v1/account/draft-pro"); await page.addInitScript(({ auth, snapshot }) => { localStorage.setItem("sb-127-auth-token", JSON.stringify(auth)); sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot)); }, { auth, snapshot }); page.on("dialog", (dialog) => dialog.accept()); await page.goto(`${base}/draft-dashboard`); await closeOverlay(page); }
const panel = (page: Page) => page.getByRole("region", { name: "Analytical reports", exact: true });
const snapshot = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}"));
const isReportPost = (response: import("playwright").Response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/account/draft-pro/reports";

async function main() {
  for (const table of ["draft_pro_reports", "draft_pro_scenarios"]) for (const token of [null, owner, other]) { const denied = await fetch(`${gateway}/rest/v1/${table}?select=*`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }); assert([401, 403].includes(denied.status), `Direct ${table} payload read returned ${denied.status}, expected 401 or 403.`); }
  await seedReadySchedule(); const privateDraftId = await seedPrivateDraft(); const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await desktop.newPage(); page.setDefaultTimeout(30_000); await prepare(page);
    assert.equal(await panel(page).count(), 0, "Reports mounted before the lazy-open control was used."); await page.getByRole("button", { name: "Analytical Reports", exact: true }).click(); const reports = panel(page); await reports.getByText("No saved reports yet.", { exact: true }).waitFor(); const picksBefore = (await snapshot(page)).draftedPlayers;
    let reportFailureInjected = false; await page.route("**/api/v1/account/draft-pro/reports", (route) => { if (!reportFailureInjected && route.request().method() === "POST") { reportFailureInjected = true; return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Injected report failure." } }) }); } return route.continue(); }); await reports.getByRole("button", { name: "Generate report", exact: true }).click(); await reports.getByRole("button", { name: "Retry failed action", exact: true }).waitFor(); const retried = page.waitForResponse(isReportPost); await reports.getByRole("button", { name: "Retry failed action", exact: true }).click(); const currentResponse = await retried; assert.equal(currentResponse.status(), 201, await currentResponse.text()); const currentBody = JSON.parse(currentResponse.request().postData() || "{}"); const currentRow = await currentResponse.json(); const currentReport = currentRow.data.payload;
    assert.equal(currentBody.input.source.projection.origin, "server"); assert.deepEqual(currentReport.provenance.scoring, currentBody.input.scoring); assert.deepEqual(currentReport.provenance.sourceWeights, currentBody.input.sourceWeights); assert.equal(currentBody.input.sourceWeights.skater.ag_skaters.isSelected, true); assert.equal(currentBody.input.sourceWeights.goalie.cullen_goalies.isSelected, true); assert.deepEqual(currentBody.input.scoring, currentSnapshot.draftSettings.scoringCategories); assert.equal(currentReport.totals.projectedPoints, currentBody.input.roster[0].projectedPoints); assert.equal(currentReport.totals.categories.GOALS, currentBody.input.roster[0].categoryValues.GOALS); assert.equal(currentReport.schedule.state, "ready"); assert.deepEqual((await snapshot(page)).draftedPlayers, picksBefore, "Generating a report changed live draft picks.");
    const contents = reports.getByRole("article", { name: "Report contents", exact: true }); await contents.getByText("Fixture Center · skater · C · AAA", { exact: true }).waitFor(); const contentsText = await contents.innerText(); assert(contentsText.includes(currentReport.totals.rawVorp.toFixed(1))); assert(contentsText.includes(currentReport.totals.projectedPoints.toFixed(1))); assert(contentsText.includes("dashboard-server-blend")); assert(contentsText.includes(JSON.stringify(currentReport.provenance.scoring)));
    const popupPromise = page.waitForEvent("popup"); await reports.getByRole("button", { name: "Print report", exact: true }).click(); const printPage = await popupPromise; await printPage.getByRole("heading", { name: "Draft Pro analytical report", exact: true }).waitFor(); const printText = await printPage.locator("body").innerText(); assert(printText.includes("Fixture Center")); assert(printText.includes("Raw VORP")); assert(printText.includes("Scoring and source weights")); assert.equal(printText.includes("Draft Workspace"), false); await printPage.screenshot({ path: `${artifacts}/print-report.png`, fullPage: true }); await printPage.close(); await page.screenshot({ path: `${artifacts}/desktop-current.png`, fullPage: true });
    await page.reload(); await closeOverlay(page); assert.equal(await panel(page).count(), 0); await page.getByRole("button", { name: "Analytical Reports", exact: true }).click(); const reopened = panel(page); await reopened.getByRole("button", { name: "draft summary", exact: true }).click(); await reopened.getByRole("article", { name: "Report contents", exact: true }).getByText("Fixture Center · skater · C · AAA", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Saved Drafts", exact: true }).click(); const drafts = page.getByRole("region", { name: "Saved Drafts", exact: true }); await drafts.getByRole("button", { name: "Report private draft", exact: true }).click(); await page.getByText("Custom Projections", { exact: false }).waitFor(); const privatePicksBefore = (await snapshot(page)).draftedPlayers; await page.route(`**/api/v1/account/draft-pro/drafts/${privateDraftId}`, (route) => route.abort("failed"), { times: 1 }); await page.getByRole("button", { name: "Sources", exact: true }).click(); await page.getByRole("button", { name: "Edit Weights", exact: true }).click(); await page.getByRole("region", { name: "Skaters projection sources", exact: true }).getByLabel("Report private rows weight percent", { exact: true }).fill("70"); await page.getByText("Save current source and goalie scoring changes first before preparing a report from this saved draft.", { exact: true }).waitFor(); await drafts.getByRole("alert").waitFor(); const savedWeights = page.waitForResponse((response) => response.request().method() === "PUT" && new URL(response.url()).pathname === `/api/v1/account/draft-pro/drafts/${privateDraftId}` && response.status() === 200); await drafts.getByRole("button", { name: "Retry", exact: true }).click(); await savedWeights; await page.getByText("Save current source and goalie scoring changes first before preparing a report from this saved draft.", { exact: true }).waitFor({ state: "hidden" });
    const privateCreated = page.waitForResponse(isReportPost); await reopened.getByRole("button", { name: "Generate report", exact: true }).click(); const privateResponse = await privateCreated; assert.equal(privateResponse.status(), 201, await privateResponse.text()); const privateBody = JSON.parse(privateResponse.request().postData() || "{}"); const privateRow = await privateResponse.json(); assert.equal(privateBody.draftId, privateDraftId); assert.equal(privateBody.input.source.projection.origin, "saved_private_import"); assert.equal(privateBody.input.source.projection.privateImports.length, 1); assert.deepEqual(privateRow.data.payload.provenance.sourceWeights, privateBody.input.sourceWeights); assert.deepEqual((await snapshot(page)).draftedPlayers, privatePicksBefore, "Saved-private report work changed live draft picks."); await reopened.getByRole("article", { name: "Report contents", exact: true }).getByText("Fixture Center · skater · C · AAA", { exact: true }).waitFor(); await page.screenshot({ path: `${artifacts}/desktop-private.png`, fullPage: true }); await desktop.close();

    const blocked = await browser.newContext(); const blockedPage = await blocked.newPage(); blockedPage.setDefaultTimeout(30_000); await blockedPage.addInitScript(() => { window.open = () => null; }); await prepare(blockedPage); await blockedPage.getByRole("button", { name: "Analytical Reports", exact: true }).click(); const blockedPanel = panel(blockedPage); await blockedPanel.getByRole("button", { name: "draft summary", exact: true }).first().click(); await blockedPanel.getByRole("article", { name: "Report contents", exact: true }).waitFor(); await blockedPanel.getByRole("button", { name: "Print report", exact: true }).click(); await blockedPanel.getByRole("alert").filter({ hasText: "Allow pop-ups to print this report." }).waitFor(); assert.equal(blocked.pages().length, 1); await blocked.close();

    await setActive(false); const inactive = await browser.newContext(); const inactivePage = await inactive.newPage(); inactivePage.setDefaultTimeout(30_000); await prepare(inactivePage); await inactivePage.getByRole("button", { name: "Analytical Reports", exact: true }).click(); const inactivePanel = panel(inactivePage); await inactivePanel.getByText("Draft Pro is inactive. Saved report names remain visible", { exact: false }).waitFor(); const locked = inactivePanel.getByRole("button", { name: "draft summary", exact: true }); await locked.first().waitFor(); assert.equal(await locked.count(), 2); for (let index = 0; index < 2; index += 1) assert.equal(await locked.nth(index).isDisabled(), true); assert.equal(await inactivePanel.getByRole("article", { name: "Report contents", exact: true }).count(), 0); assert.equal(await inactivePanel.getByRole("button", { name: "Print report", exact: true }).count(), 0); await inactive.close(); await setActive(true);

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } }); const mobilePage = await mobile.newPage(); mobilePage.setDefaultTimeout(30_000); await prepare(mobilePage); const openReports = mobilePage.getByRole("button", { name: "Analytical Reports", exact: true }); await openReports.focus(); await mobilePage.keyboard.press("Enter"); const mobilePanel = panel(mobilePage); const mobileSaved = mobilePanel.getByRole("button", { name: "draft summary", exact: true }).first(); await mobileSaved.focus(); await mobilePage.keyboard.press("Enter"); const mobileReport = mobilePanel.getByRole("article", { name: "Report contents", exact: true }); await mobileReport.getByText("Fixture Center · skater · C · AAA", { exact: true }).waitFor(); assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "Loaded mobile report overflows the viewport horizontally."); await mobilePage.screenshot({ path: `${artifacts}/mobile-loaded.png`, fullPage: true }); await mobile.close();
    console.log("reports_browser=passed; lazy=real; current=retry-and-history; saved-private=blocked-until-save; totals-source-scoring=exact; picks=unchanged; print=isolated; popup-block=explained; inactive=names-locked; mobile=loaded-no-overflow");
  } finally { await setActive(true).catch(() => undefined); await browser.close(); }
}
main().catch((error) => { console.error(error); process.exit(1); });
