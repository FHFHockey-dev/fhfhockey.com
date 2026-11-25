import { expect, test, type Page } from "@playwright/test";

import { installDustMatrixFixtures } from "./draft-pro-fixtures";

async function draftMatrixRoster(page: Page) {
  const players = page.locator("#mobile-draft-panel-players");
  await expect(players.locator("tbody tr").first()).toBeVisible({ timeout: 60_000 });
  for (let pick = 1; pick <= 40; pick += 1) {
    await players.locator("tbody tr").first().getByRole("button", { name: "Draft", exact: true }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftedPlayers?.length)).toBe(pick);
  }
}

async function openDustMatrix(page: Page) {
  const launcher = page.getByRole("region", { name: "DUST schedule overview" });
  await launcher.getByRole("button", { name: /DUST schedule overview/ }).click();
  const matrix = page.getByRole("dialog", { name: "DUST schedule overview" });
  await expect(matrix).toBeVisible();
  return matrix;
}

test("full-season DUST lattice keeps all weeks and player counts available", async ({ page }, testInfo) => {
  await installDustMatrixFixtures(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/draft-dashboard");
  await draftMatrixRoster(page);
  const matrix = await openDustMatrix(page);
  await expect(matrix.getByText("Position overlap by week", { exact: true })).toBeVisible();
  const cells = matrix.locator("[data-dust-state] button");
  const positionControls = matrix.getByTitle(/Show .* players by week/);
  const diagnostic = await matrix.evaluate((dialog) => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}");
    return {
      draftSettings: snapshot.draftSettings,
      picksByTeam: (snapshot.draftedPlayers || []).reduce((counts: Record<string, string[]>, pick: { teamId: string; playerId: string }) => ({ ...counts, [pick.teamId]: [...(counts[pick.teamId] || []), pick.playerId] }), {}),
      matrixCellLabels: [...dialog.querySelectorAll("[data-dust-state] button")].map((element) => element.getAttribute("aria-label")),
      geometry: ([
        ["DUST modal", dialog],
        ["DUST viewport", dialog.querySelector("[class*='viewport']")],
        ["DUST plot", dialog.querySelector("[class*='plot']")],
        ["[data-dust-matrix]", document.querySelector("[data-dust-matrix]")],
        ["[class*='dashboardContainer']", document.querySelector("[class*='dashboardContainer']")],
        ["[class*='mainContent']", document.querySelector("[class*='mainContent']")],
      ] as const).map(([selector, target]) => {
        const element = target as HTMLElement | null;
        if (!element) return { selector, missing: true };
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { selector, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, height: style.height, minHeight: style.minHeight, flex: style.flex, overflow: style.overflow, zoom: style.zoom };
      }),
    };
  });
  console.log(diagnostic);
  await testInfo.attach("dust-matrix-diagnostic.json", { body: JSON.stringify(diagnostic, null, 2), contentType: "application/json" });
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-desktop-1280.png"), fullPage: true });
  await matrix.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-desktop-1280-matrix.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-390-overview.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-320-overview.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  const positionCount = await positionControls.count();
  expect(positionCount).toBeGreaterThan(1);
  await expect(cells).toHaveCount(positionCount * 27);
  await expect(cells.first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(matrix.locator("[data-dust-state='zero']")).toHaveCount(0);
  await expect(matrix.locator("[data-dust-state='bench']")).toHaveCount(positionCount * 27);
  await expect(matrix.locator("[data-dust-state='unresolved']")).toHaveCount(0);
  await expect(matrix.getByLabel("Benched games by matchup week").locator("span")).toHaveCount(27);
  await expect(matrix.locator("[data-selected-week]")).toHaveCount(positionCount * 27);

  await matrix.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator("#mobile-draft-panel-players")).toBeVisible();
  await page.getByRole("button", { name: "Open full draft settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Draft Settings" });
  await settings.getByRole("tab", { name: "League & Draft", exact: true }).click();
  await settings.getByRole("button", { name: "Schedule", exact: true }).click();
  const period = settings.getByLabel("Schedule period", { exact: true });
  await expect(period).toHaveValue("season");
  await period.selectOption("playoffs");
  await settings.getByRole("button", { name: /^Done\b/ }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftSettings?.scheduleScope)).toBe("playoffs");
  await openDustMatrix(page);
  await expect(matrix.locator("[data-selected-week]")).toHaveCount(positionCount * 3);
  await expect(cells).toHaveCount(positionCount * 27);
  const midweek = matrix.getByLabel(/C position · Week 14/).first();
  await midweek.focus();
  await expect(matrix.getByRole("status")).toHaveText(/C position · Week 14 .*: 10 scheduled, 1 startable, 9 benched across 10 players\./);
  await matrix.getByLabel(/RW position · Week 14/).first().click();
  await expect(matrix.getByRole("status")).toHaveText(/RW position · Week 14 .*: 10 scheduled, 0 startable, 10 benched across 10 players\./);

  await matrix.getByTitle("Show C players by week", { exact: true }).click();
  await expect(cells).toHaveCount(10 * 27);
  await expect(matrix.locator("[data-dust-state='zero']")).toHaveCount(27);
  await expect(matrix.locator("[data-dust-state='bench']")).toHaveCount(9 * 27);
  await expect(matrix.locator("[data-dust-state='unresolved']")).toHaveCount(0);
  await matrix.getByLabel(/Matrix Player 41 · Week 14/).first().click();
  await expect(matrix.getByRole("status")).toHaveText(/Matrix Player 41 · Week 14 .*: 1 scheduled, 1 startable, 0 benched\./);
  await matrix.getByRole("button", { name: "Back to positions", exact: true }).click();

  await matrix.getByTitle("Show RW players by week", { exact: true }).click();
  await expect(matrix.getByRole("button", { name: "Back to positions", exact: true })).toBeVisible();
  const playerCount = 10;
  await expect(matrix.locator("[data-selected-week]")).toHaveCount(playerCount * 3);
  await matrix.getByLabel(/Matrix Player 19 · Week 14/).first().focus();
  await expect(matrix.getByRole("status")).toHaveText(/Matrix Player 19 · Week 14 .*: 1 scheduled, 0 startable, 1 benched\./);
  await expect(cells).toHaveCount(playerCount * 27);
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-desktop-1280-drilldown.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cells).toHaveCount(playerCount * 27);
  await expect(matrix.getByRole("button", { name: "Back to positions", exact: true })).toBeVisible();
  await matrix.getByText("Inspect exact player-week counts", { exact: true }).click();
  await expect(matrix.locator("details button").first()).toBeVisible();
  await expect(matrix.locator("details li")).toHaveCount(playerCount * 27);
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-390-drilldown.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(matrix.getByRole("button", { name: "Back to positions", exact: true })).toBeVisible();
  await expect(cells).toHaveCount(playerCount * 27);
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-320-drilldown.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await matrix.getByText("Inspect exact player-week counts", { exact: true }).click();
  await matrix.getByRole("button", { name: "Back to positions", exact: true }).click();
  await expect(positionControls).toHaveCount(positionCount);
  await expect(cells).toHaveCount(positionCount * 27);
  await matrix.getByText("Inspect exact position-week counts", { exact: true }).click();
  await expect(matrix.locator("details button").first()).toBeVisible();
  await expect(matrix.locator("details li")).toHaveCount(positionCount * 27);
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-390.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(cells).toHaveCount(positionCount * 27);
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-320.png"), fullPage: true });
});

test("DUST matrix distinguishes unavailable coverage from zero conflicts", async ({ page }, testInfo) => {
  await installDustMatrixFixtures(page, { incomplete: true });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.once("dialog", (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/draft-dashboard");
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-unavailable-setup.png"), fullPage: true });
  console.log({ pageErrors, dialogs: await page.getByRole("dialog").count(), playerPanel: await page.locator("#mobile-draft-panel-players").isVisible() });
  await draftMatrixRoster(page);
  const matrix = await openDustMatrix(page);
  const positions = matrix.getByTitle(/Show .* players by week/);
  await expect(positions.first()).toBeVisible();
  const positionCount = await positions.count();
  await expect(matrix.locator("[data-dust-state='unresolved']")).toHaveCount(positionCount * 27, { timeout: 60_000 });
  await expect(matrix.locator("[data-dust-state='zero']")).toHaveCount(0);
  await expect(matrix.getByLabel("Benched games by matchup week").getByText("Unavailable", { exact: false })).toHaveCount(27);
  await matrix.getByTitle("Show C players by week", { exact: true }).click();
  await expect(matrix.locator("[data-dust-state='unresolved']")).toHaveCount(10 * 27);
  await expect(matrix.locator("[data-dust-state='zero']")).toHaveCount(0);
  await expect(matrix.getByRole("button", { name: /Matrix Player 41 · Week 27 .*schedule coverage unavailable/ }).first()).toBeVisible();
});
