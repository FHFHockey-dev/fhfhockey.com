import { expect, test } from "@playwright/test";

import { installDustMatrixFixtures } from "./draft-pro-fixtures";

async function draftMatrixRoster(page: import("@playwright/test").Page) {
  const players = page.locator("#mobile-draft-panel-players");
  await expect(players.locator("tbody tr").first()).toBeVisible({ timeout: 60_000 });
  for (let pick = 1; pick <= 40; pick += 1) {
    await players.locator("tbody tr").first().getByRole("button", { name: "Draft", exact: true }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftedPlayers?.length)).toBe(pick);
  }
}

test("full-season DUST lattice keeps all player-week intersections available", async ({ page }, testInfo) => {
  await installDustMatrixFixtures(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/draft-dashboard");
  await draftMatrixRoster(page);
  const matrix = page.getByRole("region", { name: "DUST schedule overview" });
  await matrix.getByRole("button", { name: /DUST schedule overview/ }).click();
  await expect(matrix.getByText("Every Yahoo 477 week is shown.", { exact: false })).toBeVisible();
  const cells = matrix.locator("[data-dust-state] button");
  const diagnostic = await page.evaluate(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}");
    return {
      draftSettings: snapshot.draftSettings,
      picksByTeam: (snapshot.draftedPlayers || []).reduce((counts: Record<string, string[]>, pick: { teamId: string; playerId: string }) => ({ ...counts, [pick.teamId]: [...(counts[pick.teamId] || []), pick.playerId] }), {}),
      matrixCellLabels: [...document.querySelectorAll("[aria-label='DUST schedule overview'] [data-dust-state] button")].map((element) => element.getAttribute("aria-label")),
      geometry: ["[data-dust-matrix]", "[data-dust-matrix] .viewport", "[data-dust-matrix] .plot", "[class*='dashboardContainer']", "[class*='mainContent']"].map((selector) => {
        const element = document.querySelector(selector) as HTMLElement | null;
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
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-390.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-320.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(cells).toHaveCount(20 * 27);
  await expect(cells.first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(matrix.locator("[data-dust-state='zero']")).toHaveCount(27);
  await expect(matrix.locator("[data-dust-state='bench']")).toHaveCount(19 * 27);
  await expect(matrix.locator("[data-dust-state='unresolved']")).toHaveCount(0);
  await expect(matrix.getByLabel("Benched games by Yahoo week").locator("span")).toHaveCount(27);
  await expect(page.locator("#mobile-draft-panel-players")).toBeVisible();

  await page.getByLabel("Schedule period").selectOption("playoffs");
  await expect(matrix.locator("[data-selected-week]")).toHaveCount(20 * 3);
  await expect(cells).toHaveCount(20 * 27);
  const midweek = matrix.getByLabel(/Matrix Player 19 · Week 14/).first();
  await midweek.focus();
  await expect(matrix.getByRole("status")).toHaveText(/Matrix Player 19 · Week 14 .*: 1 scheduled, 0 startable, 1 benched\./);
  await matrix.getByLabel(/Matrix Player 41 · Week 14/).first().click();
  await expect(matrix.getByRole("status")).toHaveText(/Matrix Player 41 · Week 14 .*: 1 scheduled, 1 startable, 0 benched\./);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cells).toHaveCount(20 * 27);
  await matrix.getByText("Inspect exact player-week counts", { exact: true }).click();
  await expect(matrix.locator("details button").first()).toBeVisible();
  await expect(matrix.locator("details li")).toHaveCount(20 * 27);
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-390.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(cells).toHaveCount(20 * 27);
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-320.png"), fullPage: true });
});

test("DUST matrix distinguishes unavailable coverage from zero conflicts", async ({ page }) => {
  await installDustMatrixFixtures(page, { incomplete: true });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.once("dialog", (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/draft-dashboard");
  await page.screenshot({ path: "test-results/dust-matrix-unavailable-setup.png", fullPage: true });
  console.log({ pageErrors, dialogs: await page.getByRole("dialog").count(), playerPanel: await page.locator("#mobile-draft-panel-players").isVisible() });
  await draftMatrixRoster(page);
  const matrix = page.getByRole("region", { name: "DUST schedule overview" });
  await matrix.getByRole("button", { name: /DUST schedule overview/ }).click();
  await expect(matrix.locator("[data-dust-state='unresolved']")).toHaveCount(20 * 27, { timeout: 60_000 });
  await expect(matrix.locator("[data-dust-state='zero']")).toHaveCount(0);
  await expect(matrix.getByLabel("Benched games by Yahoo week").getByText("Unavailable", { exact: false })).toHaveCount(27);
});
