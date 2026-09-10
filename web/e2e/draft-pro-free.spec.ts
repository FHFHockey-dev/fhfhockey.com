import { expect, test } from "@playwright/test";

import { installDraftProFreeFixtures, installDustMatrixFixtures } from "./draft-pro-fixtures";

test("free minimal league completes a manual draft with local persistence", async ({ page }) => {
  await installDraftProFreeFixtures(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/draft-dashboard");

  const players = page.locator("#mobile-draft-panel-players");
  await expect(players.locator("tbody tr").first()).toBeVisible({ timeout: 60_000 });
  const scoreboard = page.getByRole("region", { name: /^Draft scoreboard\./ });
  await expect(scoreboard).toHaveAccessibleName(/On the clock: Team 1.*Pick 1 of 2.*Awaiting the first pick/);
  await scoreboard.getByRole("button", { name: "Pause draft scoreboard" }).click();
  await expect(scoreboard).toHaveAttribute("data-paused", "true");
  await scoreboard.getByRole("button", { name: "Resume draft scoreboard" }).click();
  await expect(scoreboard).toHaveAttribute("data-paused", "false");
  await page.getByLabel("Position filter").selectOption("C");
  const row = players.locator("tbody tr").first();
  const playerId = await row.getAttribute("data-player-id");
  expect(playerId).not.toBeNull();
  await row.getByRole("button", { name: /^Favorite / }).click();
  await expect(row.getByRole("button", { name: /^Unfavorite / })).toBeVisible();
  await row.getByRole("button", { name: "Draft", exact: true }).click();
  await players.locator("tbody tr").first().getByRole("button", { name: "Draft", exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftedPlayers?.length,
  )).toBe(2);
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem("projections.favorites") || "[]"),
  )).toContain(String(playerId));
  await expect(page.getByText("Complete", { exact: true }).first()).toBeVisible();
  await expect(scoreboard).toHaveAccessibleName(/Draft complete.*Pick 2 of 2.*Last 2 picks: #2 .*#1 /);
});

test("dashboard preserves player-table width while widening roster and stacking board above standings", async ({ page }) => {
  await installDraftProFreeFixtures(page, { skaterCount: 120 });
  await page.addInitScript(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}");
    snapshot.draftSettings.teamCount = 12;
    snapshot.draftSettings.draftOrder = Array.from({ length: 12 }, (_, index) => `Team ${index + 1}`);
    snapshot.draftSettings.rosterConfig = { C: 2, LW: 2, RW: 2, D: 4, G: 2, bench: 4 };
    sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot));
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/draft-dashboard");
  await expect(page.locator("#mobile-draft-panel-players tbody tr").first()).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Available players per page").selectOption("100");
  await expect(page.locator("#mobile-draft-panel-players tbody tr[data-player-id]")).toHaveCount(100);
  for (const selector of ['#mobile-draft-panel-players', '#mobile-draft-panel-roster', '#mobile-draft-panel-board', '[aria-label="League Standings"]', '[class*="suggestedContainer"]', '[class*="GodView_root"]']) {
    await expect(page.locator(selector).first()).toHaveCSS('border-top-left-radius', '10px');
  }
  const segments = page.locator('button[class*="progressSegment"][data-position]');
  for (const segment of await segments.all()) {
    const colors = await segment.evaluate(element => {
      const style = getComputedStyle(element);
      return { border: style.borderTopColor, text: getComputedStyle(element.querySelector('[class*="segmentPos"]')!).color, background: style.backgroundColor };
    });
    expect(colors.border).toBe(colors.text);
    expect(colors.background).toContain('0.18');
  }
  await segments.first().click();
  const selectedColors = await segments.first().evaluate(element => ({
    border: getComputedStyle(element).borderTopColor,
    text: getComputedStyle(element.querySelector('[class*="segmentPos"]')!).color,
    background: getComputedStyle(element).backgroundColor,
  }));
  expect(selectedColors.border).toBe(selectedColors.text);
  expect(selectedColors.background).toContain('0.3');
  await segments.first().click();
  const rosterRows = page.locator('#mobile-draft-panel-roster [class*="slotPlayers"] > button, #mobile-draft-panel-roster [class*="benchSlots"] > div');
  for (const row of await rosterRows.all()) {
    const colors = await row.evaluate(element => ({
      border: getComputedStyle(element).borderLeftColor,
      text: getComputedStyle(element.querySelector('[class*="rowPosition"]')!).color,
      background: getComputedStyle(element).backgroundColor,
      topWidth: getComputedStyle(element).borderTopWidth,
      first: !element.previousElementSibling,
    }));
    expect(colors.border).toContain('0.45');
    expect(colors.background).toContain('0.07');
    expect(colors.topWidth).toBe(colors.first ? '1px' : '0px');
  }
  const positionProgress = page.locator('#mobile-draft-panel-roster progress');
  await expect(positionProgress).toHaveCount(6);
  await expect(page.getByRole('progressbar', { name: 'C roster spots filled', exact: true })).toHaveAttribute('max', '2');
  await expect(page.getByRole('progressbar', { name: 'BN roster spots filled', exact: true })).toHaveAttribute('max', '4');
  for (const [width, height] of [[1920, 1080], [1920, 900], [1440, 900], [1280, 800], [1101, 900]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const players = document.getElementById("mobile-draft-panel-players")!;
      const roster = document.getElementById("mobile-draft-panel-roster")!;
      const board = document.getElementById("mobile-draft-panel-board")!;
      const suggested = document.getElementById("mobile-draft-panel-suggested")!;
      const standings = document.querySelector('[aria-label="League Standings"]')!;
      const scoreboard = suggested.querySelector('[aria-label^="Draft scoreboard."]')!;
      const grid = players.parentElement!;
      const actualPlayersWidth = players.getBoundingClientRect().width;
      const actualRosterWidth = roster.getBoundingClientRect().width;
      grid.style.gridTemplateColumns = "minmax(450px, 39fr) minmax(0, 61fr) minmax(285px, 315px)";
      const originalPlayersWidth = players.getBoundingClientRect().width;
      const originalRosterWidth = roster.getBoundingClientRect().width;
      grid.style.removeProperty("grid-template-columns");
      return {
        actualPlayersWidth, originalPlayersWidth, actualRosterWidth, originalRosterWidth,
        boardBottom: board.getBoundingClientRect().bottom,
        standingsTop: standings.getBoundingClientRect().top,
        boardHeight: board.getBoundingClientRect().height,
        gridBottom: grid.getBoundingClientRect().bottom,
        viewportHeight: window.innerHeight,
        pageScroll: document.documentElement.scrollHeight - window.innerHeight,
        dashboardScroll: grid.parentElement!.scrollHeight - grid.parentElement!.clientHeight,
        projectionsScroll: players.querySelector('[class*="tableContainer"]')!.scrollHeight - players.querySelector('[class*="tableContainer"]')!.clientHeight,
        rosterScroll: roster.querySelector('[class*="myRosterContainer"]')!.scrollHeight - roster.querySelector('[class*="myRosterContainer"]')!.clientHeight,
        toolsBottom: players.querySelector('[aria-label="Player table options"]')!.getBoundingClientRect().bottom,
        controlsBottom: players.querySelector('[class*="primaryControls"]')!.getBoundingClientRect().bottom,
        controlsTop: players.querySelector('[class*="primaryControls"]')!.getBoundingClientRect().top,
        titleTop: players.querySelector('[class*="panelTitle"]')!.getBoundingClientRect().top,
        titleBottom: players.querySelector('[class*="panelTitle"]')!.getBoundingClientRect().bottom,
        standingsWhitespace: standings.querySelector('[class*="tableViewport"]')!.clientHeight - standings.querySelector('table')!.getBoundingClientRect().height,
        graphHeight: board.querySelector('[class*="contributionGraphContainer"]')!.getBoundingClientRect().height,
        graphClipped: board.querySelector('[class*="contributionGraphContainer"]')!.scrollHeight > board.querySelector('[class*="contributionGraphContainer"]')!.clientHeight + 1,
        boardColumns: new Set(Array.from(board.querySelectorAll('[class*="teamRow"]')).map(row => Math.round(row.getBoundingClientRect().left))).size,
        standingsFont: parseFloat(getComputedStyle(standings.querySelector("tbody td")!).fontSize),
        teamRowHeight: board.querySelector('[class*="teamRow"]')!.getBoundingClientRect().height,
        standingsClipped: standings.scrollHeight > standings.clientHeight + 1,
        standingsTableClipped: Array.from(standings.querySelectorAll("tbody tr")).some((row) => row.getBoundingClientRect().bottom > standings.getBoundingClientRect().bottom),
        standingsTableScroll: standings.querySelector('[class*="tableViewport"]')!.scrollHeight - standings.querySelector('[class*="tableViewport"]')!.clientHeight,
        toolbarCount: board.querySelectorAll('[class*="graphToolbar"]').length,
        suggestedWidth: suggested.getBoundingClientRect().width,
        scoreboardWidth: scoreboard.getBoundingClientRect().width,
        scoreboardHeight: scoreboard.getBoundingClientRect().height,
        overflows: [grid, board, suggested, standings].map((element) => element.scrollWidth > element.clientWidth + 1),
      };
    });
    expect(Math.abs(layout.actualPlayersWidth - layout.originalPlayersWidth)).toBeLessThan(1);
    expect(Math.abs(layout.actualRosterWidth - layout.originalRosterWidth * 1.08 * 1.08)).toBeLessThan(1);
    expect(layout.boardBottom).toBeLessThan(layout.standingsTop);
    expect(layout.boardHeight).toBeGreaterThan(0);
    expect(layout.titleTop).toBeGreaterThanOrEqual(layout.controlsTop);
    expect(layout.titleBottom).toBeLessThanOrEqual(layout.controlsBottom);
    expect(layout.standingsWhitespace).toBeLessThanOrEqual(2);
    expect(layout.gridBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.pageScroll).toBeLessThanOrEqual(1);
    expect(layout.dashboardScroll).toBeLessThanOrEqual(1);
    expect(layout.projectionsScroll).toBeGreaterThan(0);
    expect(layout.rosterScroll).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.toolsBottom - layout.controlsBottom)).toBeLessThanOrEqual(1);
    expect(layout.graphHeight).toBeGreaterThan(0);
    expect(layout.graphClipped, JSON.stringify({ width, height, ...layout })).toBe(false);
    expect(layout.teamRowHeight, JSON.stringify({ width, height, ...layout })).toBeGreaterThanOrEqual(10);
    expect(layout.boardColumns).toBe(1);
    expect(layout.standingsFont).toBeGreaterThanOrEqual(11);
    expect(layout.standingsClipped).toBe(false);
    expect(layout.standingsTableScroll, JSON.stringify({ width, height, ...layout })).toBeLessThanOrEqual(1);
    expect(layout.standingsTableClipped).toBe(false);
    expect(layout.toolbarCount).toBe(0);
    expect(layout.scoreboardWidth).toBeCloseTo(layout.suggestedWidth, 0);
    expect(layout.scoreboardHeight).toBeLessThanOrEqual(28);
    expect(layout.overflows).toEqual([false, false, false, false]);
  }
  const standingsScroller = page.locator('[aria-label="League Standings"] [class*="tableViewport"]');
  await standingsScroller.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator('[aria-label="League Standings"] tbody tr').last()).toBeInViewport();
  const playerScroller = page.locator('#mobile-draft-panel-players [class*="tableContainer"]');
  await playerScroller.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => playerScroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.locator('#mobile-draft-panel-players tr[data-player-id]').last()).toBeInViewport();
  await playerScroller.evaluate((element) => { element.scrollTop = 0; });
  const sections = page.locator('[class*="scoreboardCycle"]').first().locator("span");
  await expect(sections).toHaveCount(3);
  const sectionStyles = await sections.evaluateAll((elements) => elements.map((element) => ({
    color: getComputedStyle(element).color,
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
  })));
  expect(new Set(sectionStyles.map((section) => section.color)).size).toBe(3);
  expect(sectionStyles[1].left - sectionStyles[0].right).toBeGreaterThanOrEqual(47);
  expect(sectionStyles[2].left - sectionStyles[1].right).toBeGreaterThanOrEqual(47);
  const controlStyles = await page.locator('[aria-label="Position filter"], [aria-label="Filter by position"], [aria-label="Toggle stat columns"], [aria-label="Sort suggested picks"]').evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { height: element.getBoundingClientRect().height, border: style.border, radius: style.borderRadius, background: style.backgroundColor };
  }));
  expect(controlStyles).toHaveLength(4);
  expect(controlStyles.every((style) => style.height === 32)).toBe(true);
  expect(new Set(controlStyles.map((style) => JSON.stringify(style))).size).toBe(1);
  await expect(page.getByLabel("Toggle stat columns")).toHaveCSS("font-family", /Train One/);
  await page.getByLabel("Toggle stat columns").click();
  await expect(page.getByLabel("Toggle stat columns")).toHaveCSS("border-top-width", "2px");
  await expect(page.getByLabel("Toggle stat columns")).toHaveCSS("border-top-color", "rgb(20, 162, 210)");
  const title = page.locator('#mobile-draft-panel-players [class*="panelTitle"]').first();
  await expect(title).toHaveCSS("white-space", "nowrap");
  await expect(page.locator('#mobile-draft-panel-players [class*="primaryControls"]')).toHaveCSS("justify-content", "flex-start");
  await page.screenshot({ path: "/tmp/inline-controls-board.png", fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator('[class*="scoreboardTrack"]')).toHaveCSS("animation-name", "none");
});

test("populated roster keeps names, bench and schedule visible without scrolling", async ({ page }) => {
  await installDustMatrixFixtures(page);
  await page.addInitScript(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}");
    snapshot.draftSettings.rosterConfig = { C: 2, LW: 2, RW: 2, D: 4, G: 0, utility: 3, bench: 4 };
    snapshot.draftedPlayers = Array.from({ length: 17 }, (_, index) => ({
      playerId: String(1001 + index), teamId: "Team 1", pickNumber: index * 2 + 1,
      round: index + 1, pickInRound: 1,
    }));
    snapshot.currentPick = 34;
    sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot));
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/draft-dashboard");
  const roster = page.locator('#mobile-draft-panel-roster [class*="myRosterContainer"]');
  const names = roster.locator('[class*="playerName"]');
  await expect(names).toHaveCount(17, { timeout: 60_000 });
  await expect(roster.getByRole("button", { name: /^DUST \d/ })).toBeVisible({ timeout: 60_000 });
  // Stress actual name containers without changing fixture identities or draft behavior.
  await names.evaluateAll((elements) => elements.forEach((element) => { element.textContent = "Alexandre Long-Playername"; }));
  for (const [width, height] of [[1920, 1080], [1440, 900], [1280, 800], [1101, 900]]) {
    await page.setViewportSize({ width, height });
    const bounds = await roster.evaluate((element) => {
      const panel = element.getBoundingClientRect();
      const content = Array.from(element.querySelectorAll('[class*="playerName"], [class*="playerEligibility"], [class*="nhlTeam"], [class*="slotHeader"], [class*="scheduleMetrics"], [data-dust-matrix]'));
      return {
        verticalOverflow: element.scrollHeight - element.clientHeight,
        horizontalOverflow: element.scrollWidth - element.clientWidth,
        clipped: content.some((node) => {
          const rect = node.getBoundingClientRect();
          return rect.bottom > panel.bottom + 1 || rect.right > panel.right + 1 || rect.left < panel.left - 1 || node.scrollWidth > node.clientWidth + 1;
        }),
        tint: getComputedStyle(element).backgroundColor,
        singleColumn: new Set(Array.from(element.querySelectorAll('[class*="slotPlayers"]')).map((node) => node.getBoundingClientRect().left)).size === 1,
        footerBelow: element.querySelector('[class*="rosterAnalysis"]')!.getBoundingClientRect().top >= element.querySelector('[class*="rosterWorkspace"]')!.getBoundingClientRect().bottom,
        needsBelow: element.querySelector('[class*="rosterNeeds"]')!.getBoundingClientRect().top >= element.querySelector('[class*="rosterWorkspace"]')!.getBoundingClientRect().bottom,
        fullWidthRows: Array.from(element.querySelectorAll('[class*="slotPlayers"]')).every((node) => Math.abs(node.getBoundingClientRect().width - element.querySelector('[class*="rosterWorkspace"]')!.getBoundingClientRect().width) < 1),
        dustCentered: getComputedStyle(element.querySelector('[class*="dustMetric"]')!).textAlign === "center" && getComputedStyle(element.querySelector('[class*="dustMetric"]')!).alignItems === "center",
      };
    });
    expect(bounds.verticalOverflow, `${width}×${height}`).toBeLessThanOrEqual(1);
    expect(bounds.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(bounds.clipped).toBe(false);
    expect(bounds.tint).toBe("rgba(20, 162, 210, 0.055)");
    expect(bounds.singleColumn).toBe(true);
    expect(bounds.footerBelow).toBe(true);
    expect(bounds.needsBelow).toBe(true);
    expect(bounds.fullWidthRows).toBe(true);
    expect(bounds.dustCentered).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await roster.getByText("Add a player to the team on the clock", { exact: true }).click();
  await expect(roster.getByRole("button", { name: "Add Player to Team 2" })).toBeInViewport();
  await expect(roster.locator('[data-dust-matrix]')).toBeInViewport();
  expect(await roster.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
});

test("free current two-player comparison uses fictional local projections", async ({ page }) => {
  await installDraftProFreeFixtures(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/draft-dashboard");
  const players = page.locator("#mobile-draft-panel-players");
  await expect(players.locator("tbody tr").first()).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Position filter").selectOption("C");
  await page.getByLabel("Select Fixture Center for comparison").check();
  await page.getByLabel("Select Fixture Center Two for comparison").check();
  await page.getByLabel("Open compare players").click();
  const comparison = page.getByRole("dialog", { name: "Compare Players" });
  await expect(comparison).toBeVisible();
  await expect(comparison.getByText("Fixture Center", { exact: true }).first()).toBeVisible();
  await expect(comparison.getByText("Fixture Center Two", { exact: true }).first()).toBeVisible();
});

test("free source weights change a blend without changing drafted picks", async ({ page }) => {
  await installDraftProFreeFixtures(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/draft-dashboard");
  const players = page.locator("#mobile-draft-panel-players");
  await expect(players.locator("tbody tr").first()).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Position filter").selectOption("C");
  const remainingPlayer = players.locator('tr[data-player-id="1002"]');
  const beforeProjection = await remainingPlayer.innerText();
  expect(beforeProjection).toContain("207.0");
  await players.locator("tbody tr").first().getByRole("button", { name: "Draft", exact: true }).click();
  const draftedBefore = await page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftedPlayers);
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await page.getByRole("button", { name: "Projections", exact: true }).click();
  await page.getByRole("button", { name: "Edit Weights", exact: true }).click();
  const skaterSources = page.getByRole("region", { name: "Skaters projection sources" });
  const weights = skaterSources.getByRole("spinbutton");
  for (const input of await weights.all()) if (await input.isEnabled()) await input.fill("0");
  await skaterSources.getByLabel("Cullen weight percent", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Done", exact: false }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftedPlayers)).toEqual(draftedBefore);
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem("draft.sourceControls.v4") || "{}").skater?.cullen_skaters?.weight,
  )).toBe(1);
  await expect(remainingPlayer).toContainText("255.0");
  await expect(remainingPlayer).not.toHaveText(beforeProjection);
});

test("free CSV source blends and restores after autosave", async ({ page }) => {
  await installDraftProFreeFixtures(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/draft-dashboard");
  const players = page.locator("#mobile-draft-panel-players");
  await expect(players.locator("tbody tr").first()).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Position filter").selectOption("C");
  await players.locator("tbody tr").first().getByRole("button", { name: "Draft", exact: true }).click();
  const draftedBefore = await page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftedPlayers);

  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await page.getByRole("button", { name: "Projections", exact: true }).click();
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  const csv = page.getByRole("dialog", { name: "Import Projections (CSV)" });
  await csv.getByLabel("CSV File Input").setInputFiles({
    name: "fixture-projections.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Player Name,team,pos,gp,g,a,pts,ppp,sog,hits,blocks,player_id\nFixture Center Two,CCC,C,82,65,60,125,30,300,40,20,1002\n"),
  });
  await csv.getByLabel("Projection Source Name:").fill("Fixture CSV");
  await csv.getByRole("button", { name: "Confirm Import", exact: true }).click();
  const skaterSources = page.getByRole("region", { name: "Skaters projection sources" });
  await page.getByRole("button", { name: "Edit Weights", exact: true }).click();
  const weights = skaterSources.getByRole("spinbutton");
  for (const input of await weights.all()) if (await input.isEnabled()) await input.fill("0");
  await skaterSources.getByLabel("Fixture CSV weight percent", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Done", exact: false }).click();
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").customCsvList?.[0]?.rows?.[0],
  )).toMatchObject({ player_id: 1002, Goals: 65, Assists: 60, Shots_on_Goal: 300 });
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").sourceControls,
  )).toMatchObject({
    ag_skaters: { isSelected: true, weight: 0 },
    cullen_skaters: { isSelected: true, weight: 0 },
    dtz_skaters: { isSelected: true, weight: 0 },
    lineupexperts_skaters: { isSelected: true, weight: 0 },
    "5v5_skaters": { isSelected: true, weight: 0 },
    custom_csv_1: { isSelected: true, weight: 1 },
  });
  await expect(players.locator('tr[data-player-id="1002"]')).toContainText("418.0");

  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").customCsvList?.[0]?.rows?.[0],
  )).toMatchObject({ player_id: 1002, Goals: 65, Assists: 60, Shots_on_Goal: 300 });
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftedPlayers,
  )).toEqual(draftedBefore);
  await expect(players.locator('tr[data-player-id="1001"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await page.getByRole("button", { name: "Projections", exact: true }).click();
  await expect(skaterSources.getByText("Fixture CSV", { exact: true })).toBeVisible();
  await expect(skaterSources.getByLabel("Toggle source Fixture CSV")).toBeChecked();
  await page.getByRole("button", { name: "Edit Weights", exact: true }).click();
  await expect(skaterSources.getByLabel("Fixture CSV weight percent", { exact: true })).toHaveValue("100");
  await expect(players.locator('tr[data-player-id="1002"]')).toContainText("418.0");
});

test("draft graph expands on desktop and closes with Escape at mobile zoom", async ({ page }) => {
  await installDraftProFreeFixtures(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/draft-dashboard");
  await expect(page.getByText("Draft Graph", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Expand draft graph", exact: true }).click();
  const graph = page.getByRole("dialog", { name: "Draft Graph" });
  await expect(graph).toBeVisible();
  await expect(graph.getByRole("button", { name: "Close expanded graph", exact: true })).toBeFocused();
  await page.setViewportSize({ width: 320, height: 640 });
  await page.evaluate(() => document.body.style.zoom = "2");
  await page.keyboard.press("Escape");
  await expect(graph).toHaveCount(0);
});

test("free export denial stays local and does not request the premium export API", async ({ page }) => {
  let exportRequests = 0;
  await installDraftProFreeFixtures(page);
  await page.route("**/api/v1/draft-pro/export", (route) => {
    exportRequests += 1;
    return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/draft-dashboard");
  await expect(page.locator("#mobile-draft-panel-players tbody tr").first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await page.getByRole("button", { name: "Projections", exact: true }).click();
  await page.getByTestId("export-settings-btn").click();
  await expect(page.getByRole("alert").filter({ hasText: "Sign in to export blended projections." })).toBeVisible();
  expect(exportRequests).toBe(0);
});
