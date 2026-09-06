import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const settings = (page: Page) =>
  page.getByRole("region", { name: "Draft Settings", exact: true });
const session = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("draft.snapshot.v4") || "{}"),
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
      const visibleChildren = Array.from(
        panel.querySelectorAll("button, input, select, textarea, [role='button']"),
      )
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

async function installDraftFixture(page: Page) {
  await page.route("**://*.supabase.co/rest/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  const rows = [
    [101, "Fixture Center", "C", 30, 45],
    [102, "Fixture Wing", "LW", 28, 42],
    [103, "Fixture Right Wing", "RW", 26, 40],
    [104, "Fixture Defense", "D", 18, 37],
    [201, "Fixture Goalie One", "G", 0, 0],
    [202, "Fixture Goalie Two", "G", 0, 0],
    [203, "Fixture Goalie Three", "G", 0, 0],
    [204, "Fixture Goalie Four", "G", 0, 0],
  ].map(([player_id, Player_Name, Position, Goals, Assists]) => ({
    player_id,
    Player_Name,
    Position,
    Team_Abbreviation: "TST",
    Games_Played: 82,
    Goals,
    Assists,
    Hits: 75,
    Wins_Goalie: Position === "G" ? 30 : 0,
    Saves_Goalie: Position === "G" ? 1400 : 0,
  }));
  await page.addInitScript(({ fixtureRows }) => {
    const source = {
      id: "custom_csv_browser_fixture",
      label: "Browser fixture",
      rows: fixtureRows,
      resolution: {
        totalRows: fixtureRows.length,
        idMatched: fixtureRows.length,
        nameMatched: 0,
        unresolved: 0,
        coverage: 100,
        lastUpdated: 1,
        unresolvedNames: [],
      },
    };
    const disabled = (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, { isSelected: false, weight: 0 }]));
    const settings = {
      teamCount: 12,
      draftOrder: Array.from({ length: 12 }, (_, index) => `Team ${index + 1}`),
      draftOrderMode: "snake",
      reversedRounds: [],
      rosterConfig: { C: 2, LW: 2, RW: 2, D: 4, G: 2, bench: 4, utility: 1 },
      scoringCategories: { GOALS: 3, ASSISTS: 2, HITS: 0.2 },
      leagueType: "points",
      isKeeper: false,
      allowCustomNameFallback: true,
      customSourceMinimumCoverage: 25,
    };
    (window as any).__draftFixtureBookmark = {
      v: 4,
      settings,
      configured: true,
      draftedPlayers: [],
      draftHistory: [],
      currentPick: 1,
      myTeamId: "Team 1",
      sourceControls: {
        ...disabled(["ag_skaters", "blake_ag_skaters", "nate_ag_skaters", "cullen_skaters", "dtz_skaters", "lineupexperts_skaters", "5v5_skaters"]),
        custom_csv_browser_fixture: { isSelected: true, weight: 1 },
      },
      goalieSourceControls: {
        ...disabled(["cullen_goalies", "dtz_goalies", "lineupexperts_goalies", "5v5_goalies"]),
        custom_csv_browser_fixture: { isSelected: true, weight: 1 },
      },
      goalieScoringCategories: { WINS_GOALIE: 4, SAVES_GOALIE: 0.2 },
      positionOverrides: {},
      prorate84: true,
      riskSd: 12,
      csvMetadata: [{ id: source.id, label: source.label }],
      customCsvEntries: [source],
    };
  }, { fixtureRows: rows });
}

async function activateDraftFixture(page: Page) {
  const bookmark = await page.evaluate(() =>
    JSON.stringify((window as any).__draftFixtureBookmark),
  );
  await settings(page).getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Import draft bookmark", { exact: true }).fill(bookmark);
  await page.getByRole("button", { name: "Import Bookmark", exact: true }).click();
  await expect(settings(page)).toHaveAttribute("data-full", "true");
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
    await installDraftFixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/draft-dashboard");
    await activateDraftFixture(page);
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
  await installDraftFixture(page);
  await page.goto("/draft-dashboard");
  await activateDraftFixture(page);
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
  await players.getByRole("button", { name: /^Player/ }).click();
  const playerSortHeader = players.getByRole("columnheader", { name: /^Player/ });
  const sortBefore = await playerSortHeader.getAttribute("aria-sort");
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
  await expect(playerSortHeader).toHaveAttribute("aria-sort", sortBefore!);
  await expect(players.getByText("Compare (1)", { exact: true })).toBeVisible();
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
    (await session(page)).settings.scoringCategories.HITS,
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

for (const width of [320, 390]) {
  test(`mobile working tabs retain compact draft status at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 760 });
    await installDraftFixture(page);
    await page.goto("/draft-dashboard");
    await activateDraftFixture(page);
    await done(page);
    const summary = page.getByRole("region", { name: "Draft Status summary" });
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("Pick");
    await expect(summary).toContainText("On clock");
    await expect(summary).toContainText("Next pick");
    await expect(page.getByRole("region", { name: "Draft Status", exact: true })).toBeHidden();

    for (const tab of ["Suggested", "Roster", "Players"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(summary).toBeVisible();
      await expect(summary).toHaveCount(1);
    }
    await expect(page.getByRole("textbox", { name: "Search players" })).toBeVisible();
    expect(
      await page.evaluate(() => ({
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        statusAnnouncements: document.querySelectorAll('[aria-label="Draft Status summary"] [aria-live]').length,
      })),
    ).toEqual({ viewport: width, documentWidth: width, statusAnnouncements: 0 });
    if (width === 390) {
      const reloadErrors: string[] = [];
      page.on("pageerror", (error) => reloadErrors.push(error.message));
      page.once("dialog", (dialog) => dialog.accept());
      await page.reload();
      await expect(summary).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Search players" })).toBeVisible();
      expect(reloadErrors).toEqual([]);
      await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
    }
  });
}
