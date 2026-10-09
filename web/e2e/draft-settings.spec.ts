import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { installDraftProFreeFixtures } from "./draft-pro-fixtures";

const settings = (page: Page) =>
  page.getByRole("region", { name: "Draft Settings", exact: true });
const session = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}"),
  );
const done = (page: Page) =>
  settings(page).getByRole("button", { name: "Done", exact: false }).click();
async function fitsViewport(page: Page) {
  expect(
    await page.evaluate(() => ({
      vertical: document.documentElement.scrollHeight <= innerHeight,
      horizontal: document.documentElement.scrollWidth <= innerWidth,
    })),
  ).toEqual({ vertical: true, horizontal: true });
}
async function fitsSettingsPanel(page: Page, domain: string) {
  expect(
    await page.locator(`#draft-domain-${domain}`).evaluate((panel) => {
      const bounds = panel.getBoundingClientRect();
      const visibleChildren = Array.from(panel.querySelectorAll("*"))
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      return {
        vertical: panel.scrollHeight <= panel.clientHeight,
        horizontal: panel.scrollWidth <= panel.clientWidth,
        childrenVisible: visibleChildren.every(
          (rect) =>
            rect.bottom <= bounds.bottom + 0.5 &&
            rect.right <= bounds.right + 0.5 &&
            rect.left >= bounds.left - 0.5,
        ),
      };
    }),
  ).toEqual({ vertical: true, horizontal: true, childrenVisible: true });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1728, height: 900 },
  { width: 1920, height: 1080 },
]) {
  test(`settings preserve the workspace at ${viewport.width} × ${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/draft-dashboard");
    await expect(settings(page)).toHaveAttribute("data-full", "true");
    for (const domain of ["league", "roster", "scoring", "projections"])
      await expect(page.locator(`#draft-domain-${domain}`)).toBeVisible();
    await fitsViewport(page);
    await page.screenshot({ path: testInfo.outputPath("full-setup.png") });
    await done(page);
    await expect(settings(page)).toHaveAttribute("data-open", "false");
    await expect(
      page.locator("#mobile-draft-panel-players tbody tr").first(),
    ).toBeVisible({ timeout: 60_000 });
    await fitsViewport(page);
    const gridBefore = await page
      .locator("#mobile-draft-panel-players")
      .evaluate((el) => el.getBoundingClientRect().toJSON());
    await page.screenshot({ path: testInfo.outputPath("collapsed.png") });
    await settings(page).getByRole("button", { name: "Edit Settings" }).click();
    await expect(settings(page)).toHaveAttribute("data-full", "false");
    for (const domain of [
      "Roster",
      "Scoring",
      "Projections",
      "League & Draft",
    ]) {
      await settings(page)
        .getByRole("tab", { name: domain, exact: true })
        .click();
      await fitsViewport(page);
      if (domain !== "League & Draft")
        await fitsSettingsPanel(page, domain.toLowerCase());
    }
    await page.waitForTimeout(250);
    await page.screenshot({ path: testInfo.outputPath("quick-settings.png") });
    for (const id of ["suggested", "players", "roster", "board"])
      await expect(page.locator(`#mobile-draft-panel-${id}`)).toBeVisible();
    await done(page);
    expect(
      await page
        .locator("#mobile-draft-panel-players")
        .evaluate((el) => el.getBoundingClientRect().toJSON()),
    ).toEqual(gridBefore);
    expect(errors).toEqual([]);
  });
}

test("settings edits, validation, imports and reset preserve a live draft", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1728, height: 900 });
  await page.goto("/draft-dashboard");
  await expect(settings(page)).toHaveAttribute("data-full", "true");
  await done(page);
  const players = page.locator("#mobile-draft-panel-players");
  await expect(players.locator("tbody tr").first()).toBeVisible({
    timeout: 60_000,
  });
  await page.getByLabel("Position filter").selectOption("G");
  for (let i = 0; i < 3; i++) {
    await players
      .getByRole("button", { name: "Draft", exact: true })
      .first()
      .click();
    await expect
      .poll(async () => (await session(page)).draftedPlayers?.length)
      .toBe(i + 1);
  }
  const before = await session(page);
  const rosterPoints = page
    .locator("#mobile-draft-panel-roster")
    .getByText("Projected Points", { exact: true })
    .locator("..")
    .locator("div")
    .nth(1);
  const pointsBefore = await rosterPoints.innerText();
  const row = players.locator("tbody tr").first();
  const selectedPlayerId = await row.getAttribute("data-player-id");
  await row.getByRole("checkbox").last().check();
  await row.getByRole("button", { name: /^Favorite / }).click();
  await row.getByRole("button", { name: /^Expand details/ }).click();
  await page.getByRole("textbox", { name: "Search players" }).fill("a");
  await page.getByLabel("Position filter").selectOption("G");
  await page.getByLabel("Available players per page").selectOption("15");
  await page.evaluate(() => {
    (window as any).settingsPreservationProbe = document.querySelector(
      '#mobile-draft-panel-players input[aria-label="Search players"]',
    );
  });
  const url = page.url();
  await settings(page).getByRole("button", { name: "Edit Settings" }).click();
  await settings(page)
    .getByRole("tab", { name: "League & Draft", exact: true })
    .click();
  await page.getByLabel("Number of teams").fill("10");
  await expect(page.getByLabel("Number of teams")).toHaveValue("12");
  await expect(settings(page).getByRole("alert")).toContainText(
    "Team count is locked",
  );
  await settings(page).getByLabel("Dismiss settings message").click();
  await expect(
    page.getByRole("button", { name: "Standard", exact: true }),
  ).toBeDisabled();
  await settings(page)
    .getByRole("tab", { name: "Roster", exact: true })
    .click();
  await page.getByLabel("Increase bench spots").click();
  await settings(page)
    .getByRole("tab", { name: "Scoring", exact: true })
    .click();
  await page.getByLabel("GOALS skater weight", { exact: true }).fill("4");
  await page.getByLabel("WINS_GOALIE goalie weight", { exact: true }).fill("5");
  await done(page);
  await expect(
    page.getByRole("textbox", { name: "Search players", exact: true }),
  ).toHaveValue("a");
  await expect(page.getByLabel("Position filter")).toHaveValue("G");
  await expect(page.getByLabel("Available players per page")).toHaveValue("15");
  expect(
    await page.evaluate(
      () =>
        (window as any).settingsPreservationProbe ===
        document.querySelector(
          '#mobile-draft-panel-players input[aria-label="Search players"]',
        ),
    ),
  ).toBe(true);
  await expect(rosterPoints).not.toHaveText(pointsBefore);
  await page
    .getByRole("textbox", { name: "Search players", exact: true })
    .fill("");
  const selectedRow = players.locator(
    `tr[data-player-id="${selectedPlayerId}"]`,
  );
  await expect(selectedRow).toHaveAttribute("data-selected", "true");
  await expect(selectedRow).toHaveAttribute("data-expanded", "true");
  await expect(
    selectedRow.getByRole("button", { name: /^Unfavorite / }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search players", exact: true })
    .fill("a");
  expect(page.url()).toBe(url);
  expect((await session(page)).draftedPlayers).toEqual(before.draftedPlayers);
  expect((await session(page)).currentPick).toBe(before.currentPick);
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await expect(settings(page)).toHaveAttribute("data-full", "true");
  await expect(
    page.getByLabel("GOALS skater weight", { exact: true }),
  ).toHaveValue("4");
  await expect(page.getByTestId("roster-input-bench")).toHaveValue("5");
  await page.getByTestId("roster-input-bench").fill("0");
  await page.getByTestId("roster-input-G").fill("0");
  await expect(page.getByTestId("roster-input-G")).toHaveValue("2");
  await expect(settings(page).getByRole("alert")).toContainText(
    "drafted positions exceed",
  );
  await page.getByTestId("roster-input-bench").fill("5");
  await page.getByTitle("Manage / Add scoring stats").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove HITS", exact: true }).click();
  expect(
    (await session(page)).draftSettings.scoringCategories.HITS,
  ).toBeUndefined();
  await settings(page)
    .getByRole("button", { name: "Projections", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Multipliers", exact: true }).click();
  await page.getByRole("button", { name: "Edit Weights", exact: true }).click();
  const skaterSources = page.getByRole("region", {
    name: "Skaters projection sources",
  });
  const sourceWeights = skaterSources.getByRole("spinbutton");
  for (const input of await sourceWeights.all())
    if (await input.isEnabled()) await input.fill("0");
  await done(page);
  await expect(settings(page)).toHaveAttribute("data-open", "true");
  await expect(settings(page).getByRole("alert")).toContainText(
    "Skater projections need an enabled source",
  );
  await sourceWeights.first().fill("1");
  await done(page);
  expect((await session(page)).draftedPlayers).toEqual(before.draftedPlayers);
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await settings(page)
    .getByRole("button", { name: "Import", exact: true })
    .click();
  await page
    .getByLabel("Import draft bookmark", { exact: true })
    .fill('{"v":3,"settings":{}}');
  await page
    .getByRole("button", { name: "Import Bookmark", exact: true })
    .click();
  await expect(settings(page).getByRole("alert").last()).toContainText(
    "Invalid bookmark settings",
  );
  expect((await session(page)).draftedPlayers).toEqual(before.draftedPlayers);
  await page
    .getByRole("button", { name: "Cancel Import", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await settings(page)
    .getByRole("button", { name: "Export", exact: true })
    .click();
  const download = await downloadPromise;
  expect(await download.failure()).toBeNull();
  const exportedBookmark = await readFile((await download.path())!, "utf8");
  expect(JSON.parse(exportedBookmark).draftedPlayers).toEqual(
    before.draftedPlayers,
  );
  await settings(page)
    .getByRole("button", { name: "Import", exact: true })
    .click();
  await page
    .getByLabel("Import draft bookmark", { exact: true })
    .fill(exportedBookmark);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Import Bookmark", exact: true })
    .click();
  await expect(
    page.getByLabel("Import draft bookmark", { exact: true }),
  ).toBeVisible();
  expect((await session(page)).draftedPlayers).toEqual(before.draftedPlayers);
  await page
    .getByRole("button", { name: "Cancel Import", exact: true })
    .click();
  await page.getByTestId("reset-draft-btn").click();
  await page.getByRole("button", { name: "Cancel Reset", exact: true }).click();
  expect((await session(page)).draftedPlayers).toEqual(before.draftedPlayers);
  await page.getByTestId("reset-draft-btn").click();
  await page.getByTestId("reset-draft-btn").click();
  await expect
    .poll(async () => (await session(page)).draftedPlayers.length)
    .toBe(0);
  expect((await session(page)).currentPick).toBe(1);
  await settings(page)
    .getByRole("button", { name: "Import", exact: true })
    .click();
  await page
    .getByLabel("Import draft bookmark", { exact: true })
    .fill(exportedBookmark);
  await page
    .getByRole("button", { name: "Import Bookmark", exact: true })
    .click();
  await expect
    .poll(async () => (await session(page)).draftedPlayers)
    .toEqual(before.draftedPlayers);
  await done(page);
  await expect(
    page.getByRole("textbox", { name: "Search players", exact: true }),
  ).toHaveValue("a");
  expect(
    await page.evaluate(
      () =>
        (window as any).settingsPreservationProbe ===
        document.querySelector(
          '#mobile-draft-panel-players input[aria-label="Search players"]',
        ),
    ),
  ).toBe(true);
});

// Recovery cases use fictional projections and intercept every data request.
const recoveryDialog = (page: Page) => page.getByRole("dialog", { name: "Draft Settings", exact: true });
const recoverySnapshot = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}"));
const recoveryCsv = { id: "custom_csv_fixture", label: "Recovery fixture", playerType: "skater", rows: [
  { player_id: 1001, Player_Name: "Fixture Center", Position: "C", Team_Abbreviation: "AAA", Goals: 30, Games_Played: 84 },
  { player_id: 1002, Player_Name: "Fixture Center Two", Position: "C", Team_Abbreviation: "CCC", Goals: 25, Games_Played: 84 },
] };
const recoveryBookmark = () => ({ v: 3, settings: { teamCount: 2, draftOrder: ["Team 1", "Team 2"], draftOrderMode: "custom", reversedRounds: [2], rosterConfig: { C: 1, LW: 0, RW: 0, D: 0, G: 1, bench: 2, utility: 0 }, scoringCategories: { GOALS: 3 }, leagueType: "points", isKeeper: false }, draftedPlayers: [] as Array<{ playerId: string; teamId: string; pickNumber: number; round: number; pickInRound: number }>, currentPick: 1, myTeamId: "Team 1", sourceControls: { dtz_skaters: { isSelected: true, weight: 0.3 }, custom_csv_fixture: { isSelected: true, weight: 0.7 } }, goalieSourceControls: { dtz_goalies: { isSelected: true, weight: 1 } }, goalieScoringCategories: { WINS_GOALIE: 4 }, customCsvList: [recoveryCsv] as typeof recoveryCsv[] | undefined, customSourceMetadata: [{ id: recoveryCsv.id, label: recoveryCsv.label }], keepers: [], pickTrades: [] as Array<{ round: number; pickInRound: number; currentTeamId: string }> });
async function recoveryFixtures(page: Page) {
  await page.route("**/api/**", route => route.fulfill({ json: route.request().url().endsWith("/season") ? { seasonId: 20262027 } : [] }));
  await installDraftProFreeFixtures(page, { seedSnapshot: false, skaterCount: 5 });
  await page.route("**/api/v1/roster-schedule-optimizer/schedule**", route => route.fulfill({ json: { success: true, data: { gameKey: "477", startWeek: 1, endWeek: 27, games: [], version: "recovery-fixture", freshness: { latestFetchedAt: "2026-10-02T00:00:00Z", oldestFetchedAt: "2026-10-02T00:00:00Z", rowCount: 0 } } } }));
  await page.route("**/rest/v1/yahoo_matchup_weeks**", route => route.fulfill({ json: [] }));
  page.on("dialog", dialog => dialog.accept());
}
async function recoveryOpen(page: Page) {
  if (!await recoveryDialog(page).isVisible()) {
    if ((page.viewportSize()?.width ?? 1280) < 800) await page.getByRole("tab", { name: "Setup", exact: true }).click();
    else await page.getByRole("button", { name: "Open full draft settings", exact: true }).click();
  }
}
async function recoveryImport(page: Page, data: unknown, fromFile = false) {
  await recoveryOpen(page);
  await recoveryDialog(page).getByRole("button", { name: "Import bookmark", exact: true }).click();
  if (fromFile) {
    await page.getByLabel("Read draft bookmark file", { exact: true }).setInputFiles({ name: "recovery.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
    await expect(page.getByLabel("Import draft bookmark", { exact: true })).toHaveValue(JSON.stringify(data));
  } else await page.getByLabel("Import draft bookmark", { exact: true }).fill(JSON.stringify(data));
  await page.getByRole("button", { name: "Import Bookmark", exact: true }).click();
}
async function recoveryDone(page: Page) {
  await recoveryDialog(page).getByRole("button", { name: "Done", exact: true }).click();
  await expect(recoveryDialog(page)).toBeHidden();
  await expect(page.locator("#mobile-draft-panel-players tbody tr").first()).toBeVisible();
  await expect(page.getByText("Loading player projections…", { exact: true })).toHaveCount(0);
}

test.describe("recovery port", () => {
  test.use({ actionTimeout: 15_000 });
  test.setTimeout(120_000);
  for (const key of ["draft.snapshot.v2", "draftDashboard.session.v1"]) {
    test(`failed ${key} resume preserves original records and retries after storage is freed`, async ({ page }) => {
      await recoveryFixtures(page);
      const bookmark = recoveryBookmark();
      const saved = { ...bookmark, v: 2, configured: true, draftSettings: bookmark.settings, currentPick: 2,
        draftedPlayers: [{ playerId: "1002", teamId: "Team 1", pickNumber: 1, round: 1, pickInRound: 1 }] };
      const original = JSON.stringify(saved);
      await page.addInitScript(({ key, original }) => {
        if (!sessionStorage.getItem("recoveryResumeSeeded")) {
          (key.startsWith("draft.snapshot") ? sessionStorage : localStorage).setItem(key, original);
          if (key.startsWith("draft.snapshot")) localStorage.setItem("draftDashboard.session.v1", original);
          sessionStorage.setItem("recoveryResumeSeeded", "true");
          sessionStorage.setItem("recoveryResumeBlocked", "true");
        }
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (this === sessionStorage && name === "draft.customCsvList.v3" && sessionStorage.getItem("recoveryResumeBlocked") === "true") throw new DOMException("Fixture quota", "QuotaExceededError");
          return set.call(this, name, value);
        };
      }, { key, original });
      await page.goto("/draft-dashboard");
      await expect(recoveryDialog(page)).toBeVisible();
      await expect(recoveryDialog(page)).toContainText("saved draft is retained and automatic saving is paused");
      await recoveryDialog(page).getByRole("button", { name: "Done", exact: true }).click();
      await page.getByRole("button", { name: "Retry saved draft recovery", exact: true }).click();
      const retained = await page.evaluate(() => ({ tab: sessionStorage.getItem("draft.snapshot.v2"), device: localStorage.getItem("draftDashboard.session.v1"), csv: sessionStorage.getItem("draft.customCsvList.v3") }));
      expect(retained.tab).toBe(key.startsWith("draft.snapshot") ? original : null);
      expect(retained.device).toBe(original);
      expect(retained.csv).toBeNull();
      await expect(recoveryDialog(page)).not.toContainText("current draft has not changed");
      await page.reload();
      await expect(recoveryDialog(page)).toContainText("saved draft is retained");
      await page.evaluate(() => sessionStorage.setItem("recoveryResumeBlocked", "false"));
      await page.getByRole("button", { name: "Retry saved draft recovery", exact: true }).click();
      await expect(page.getByRole("button", { name: "Retry saved draft recovery", exact: true })).toHaveCount(0);
      await expect.poll(async () => (await recoverySnapshot(page)).draftedPlayers).toEqual(saved.draftedPlayers);
      const restored = await recoverySnapshot(page);
      expect(restored.draftSettings.teamCount).toBe(2);
      expect(restored.sourceControls.custom_csv_fixture.weight).toBe(0.7);
      expect(restored.customCsvList).toEqual([recoveryCsv]);
      await recoveryDone(page);
      await page.reload();
      await expect.poll(async () => (await recoverySnapshot(page)).draftedPlayers).toEqual(saved.draftedPlayers);
      expect((await recoverySnapshot(page)).customCsvList).toEqual([recoveryCsv]);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("draftDashboard.session.v1")!).draftSettings.teamCount)).toBe(2);
    });
  }
  for (const width of [1440, 390, 320]) {
    test(`missing CSV repair and reload settle at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 760 });
      await recoveryFixtures(page);
      await page.goto("/draft-dashboard"); await expect(recoveryDialog(page)).toBeVisible();
      const missing = recoveryBookmark(); missing.customCsvList = undefined;
      await recoveryImport(page, missing);
      await expect(recoveryDialog(page).getByRole("alert").last()).toContainText("must be reimported or removed");
      await recoveryDialog(page).getByRole("tab", { name: /^Projections/ }).click();
      const sources = recoveryDialog(page).getByRole("region", { name: "Skaters projection sources" });
      await expect(sources.getByRole("button", { name: "Reimport Recovery fixture" })).toBeVisible();
      await expect(sources.getByRole("button", { name: "Remove Recovery fixture" })).toBeVisible();
      expect((await recoverySnapshot(page)).sourceControls.custom_csv_fixture.weight).toBe(0.7);
      const bounds = await sources.evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }));
      expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
      await page.screenshot({ path: testInfo.outputPath(`missing-${width}.png`) });
      await page.reload();
      await expect(recoveryDialog(page)).toBeVisible();
      await expect(page.getByText("Loading draft sources", { exact: true })).toHaveCount(0);
      await recoveryDialog(page).getByRole("tab", { name: /^Projections/ }).click();
      await recoveryDialog(page).getByRole("button", { name: "Remove Recovery fixture" }).click();
      await expect.poll(async () => (await recoverySnapshot(page)).customCsvList.length).toBe(0);
      await recoveryDone(page);
    });
  }

  test("CSV write failure preserves the draft and duplicate retry persists once", async ({ page }) => {
    await recoveryFixtures(page); await page.goto("/draft-dashboard"); await expect(recoveryDialog(page)).toBeVisible();
    await expect(recoveryDialog(page)).toBeVisible();
    const before = await recoverySnapshot(page);
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      (window as any).recoveryWriteBlocked = true; (window as any).recoveryCsvWrites = 0;
      Storage.prototype.setItem = function (key, value) {
        if (this === sessionStorage && key === "draft.customCsvList.v3") {
          if ((window as any).recoveryWriteBlocked) throw new DOMException("Fixture quota", "QuotaExceededError");
          (window as any).recoveryCsvWrites++;
        }
        return original.call(this, key, value);
      };
    });
    await recoveryImport(page, recoveryBookmark());
    await expect(page.getByLabel("Import draft bookmark", { exact: true })).toBeVisible();
    await expect(recoveryDialog(page).getByRole("alert").last()).toContainText("current draft has not changed");
    expect((await recoverySnapshot(page)).draftSettings).toEqual(before.draftSettings);
    await page.evaluate(() => { (window as any).recoveryWriteBlocked = false; });
    await page.getByRole("button", { name: "Import Bookmark", exact: true }).click({ clickCount: 2 });
    await expect(page.getByLabel("Import draft bookmark", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).recoveryCsvWrites)).toBe(1);
    await recoveryDone(page); await page.reload();
    await expect(page.locator("#mobile-draft-panel-players tbody tr").first()).toBeVisible();
    expect((await recoverySnapshot(page)).draftSettings.teamCount).toBe(2);
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.customCsvList.v3")!)[0].rows.length)).toBe(2);
  });

  test("decline, replacement, reload and confirmed new draft preserve unrelated storage", async ({ page }) => {
    await recoveryFixtures(page); await page.goto("/draft-dashboard"); await expect(recoveryDialog(page)).toBeVisible();
    await recoveryImport(page, recoveryBookmark()); await recoveryDone(page);
    await page.evaluate(() => { localStorage.setItem("unrelated-auth-fixture", "preserved"); sessionStorage.setItem("unrelated-fixture", "preserved"); });
    page.removeAllListeners("dialog"); page.once("dialog", dialog => dialog.dismiss());
    await page.reload();
    await expect(recoveryDialog(page)).toBeVisible();
    await expect.poll(async () => (await recoverySnapshot(page)).draftSettings.teamCount).toBe(12);
    expect(await page.evaluate(() => sessionStorage.getItem("draft.customCsvList.v3"))).toBeNull();
    page.on("dialog", dialog => dialog.accept());
    await recoveryImport(page, recoveryBookmark()); await recoveryDone(page); await page.reload();
    await expect(page.locator("#mobile-draft-panel-players tbody tr").first()).toBeVisible();
    expect((await recoverySnapshot(page)).draftSettings.teamCount).toBe(2);
    await recoveryOpen(page); await recoveryDialog(page).getByRole("button", { name: "Management", exact: true }).click();
    await recoveryDialog(page).getByRole("button", { name: "Start New Draft", exact: true }).click();
    await recoveryDialog(page).getByRole("button", { name: "Cancel New Draft", exact: true }).click();
    expect((await recoverySnapshot(page)).customCsvList.length).toBe(1);
    await recoveryDialog(page).getByRole("button", { name: "Start New Draft", exact: true }).click();
    await recoveryDialog(page).getByRole("button", { name: "Confirm Start New Draft", exact: true }).click();
    await expect.poll(async () => (await recoverySnapshot(page)).customCsvList.length).toBe(0);
    expect((await recoverySnapshot(page)).draftSettings.teamCount).toBe(12);
    expect(await page.evaluate(() => localStorage.getItem("unrelated-auth-fixture"))).toBe("preserved");
    expect(await page.evaluate(() => sessionStorage.getItem("unrelated-fixture"))).toBe("preserved");
  });

  test("abandoned file read cannot replace a subsequent bookmark and invalid input stays open", async ({ page }) => {
    await recoveryFixtures(page); await page.goto("/draft-dashboard"); await expect(recoveryDialog(page)).toBeVisible(); await expect(recoveryDialog(page)).toBeVisible();
    await page.evaluate(() => { File.prototype.text = function () { return new Promise(resolve => { (window as any).finishRecoveryFile = resolve; }); }; });
    await recoveryDialog(page).getByRole("button", { name: "Import bookmark", exact: true }).click();
    await page.getByLabel("Read draft bookmark file", { exact: true }).setInputFiles({ name: "slow.json", mimeType: "application/json", buffer: Buffer.from("pending") });
    await expect(page.getByRole("button", { name: "Reading bookmark…", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Cancel Import", exact: true }).click();
    await recoveryDialog(page).getByRole("button", { name: "Import bookmark", exact: true }).click();
    await page.getByLabel("Import draft bookmark", { exact: true }).fill("{invalid}");
    await page.evaluate(() => { (window as any).finishRecoveryFile("{stale}"); });
    await expect(page.getByLabel("Import draft bookmark", { exact: true })).toHaveValue("{invalid}");
    await page.getByRole("button", { name: "Import Bookmark", exact: true }).click();
    await expect(recoveryDialog(page).getByRole("alert").last()).toContainText("Unsupported bookmark");
    await expect(page.getByLabel("Import draft bookmark", { exact: true })).toBeVisible();
    expect((await recoverySnapshot(page)).draftSettings.teamCount).toBe(12);
  });

  for (const width of [1440, 390]) {
    test(`reversal keyboard feedback, export opt-in and traded pick ownership at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 760 });
      await recoveryFixtures(page); await page.goto("/draft-dashboard"); await expect(recoveryDialog(page)).toBeVisible(); await recoveryImport(page, recoveryBookmark());
      const round = recoveryDialog(page).getByRole("button", { name: "Round 2, reversed", exact: true });
      await expect(round).toHaveAttribute("aria-pressed", "true");
      const selected = await round.evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor, radius: getComputedStyle(node).borderRadius }));
      await round.focus(); await round.press("Enter");
      const forward = recoveryDialog(page).getByRole("button", { name: "Round 2, forward", exact: true });
      await expect(forward).toBeFocused(); await expect(forward).toHaveAttribute("aria-pressed", "false");
      const unselected = await forward.evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor, radius: getComputedStyle(node).borderRadius }));
      expect(selected.color).not.toBe(unselected.color); expect(selected.background).not.toBe(unselected.background); expect(selected.radius).toBe(unselected.radius);
      await forward.press("Enter"); await recoveryDone(page); await recoveryOpen(page);
      await expect(recoveryDialog(page).getByRole("button", { name: "Round 2, reversed", exact: true })).toHaveAttribute("aria-pressed", "true");
      const downloadPromise = page.waitForEvent("download"); await recoveryDialog(page).getByRole("button", { name: "Export bookmark", exact: true }).click();
      const exported = JSON.parse(await readFile((await (await downloadPromise).path())!, "utf8"));
      expect(exported.customCsvList).toBeUndefined(); expect(exported.customSourceMetadata[0].label).toBe(recoveryCsv.label);
      await page.getByLabel("Include imported projections in export", { exact: true }).check();
      const includedDownload = page.waitForEvent("download"); await recoveryDialog(page).getByRole("button", { name: "Export bookmark", exact: true }).click();
      expect(JSON.parse(await readFile((await (await includedDownload).path())!, "utf8")).customCsvList[0].rows.length).toBe(2);
      const traded = recoveryBookmark(); traded.draftedPlayers = [{ playerId: "1001", teamId: "Team 2", pickNumber: 1, round: 1, pickInRound: 1 }]; traded.currentPick = 2; traded.pickTrades = [{ round: 1, pickInRound: 1, currentTeamId: "Team 2" }];
      await recoveryImport(page, traded, true); await recoveryDone(page); await page.reload();
      expect((await recoverySnapshot(page)).pickTrades[0].currentTeamId).toBe("Team 2");
      expect((await recoverySnapshot(page)).draftedPlayers[0].teamId).toBe("Team 2");
      await recoveryOpen(page); await recoveryDialog(page).getByRole("button", { name: "Management", exact: true }).click();
      await page.screenshot({ path: testInfo.outputPath(`management-${width}.png`) });
      expect(await recoveryDialog(page).evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    });
  }
});
