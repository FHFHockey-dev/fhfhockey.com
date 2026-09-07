import { expect, test } from "@playwright/test";

import { installDustMatrixFixtures } from "./draft-pro-fixtures";

async function draftMatrixRoster(page: import("@playwright/test").Page) {
  const players = page.locator("#mobile-draft-panel-players");
  await expect(players.locator("tbody tr").first()).toBeVisible({ timeout: 60_000 });
  for (let pick = 1; pick <= 20; pick += 1) {
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
  console.log(await page.evaluate(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}");
    return {
      draftSettings: snapshot.draftSettings,
      picksByTeam: (snapshot.draftedPlayers || []).reduce((counts: Record<string, string[]>, pick: { teamId: string; playerId: string }) => ({ ...counts, [pick.teamId]: [...(counts[pick.teamId] || []), pick.playerId] }), {}),
      matrixPlayers: [...document.querySelectorAll("[aria-label='DUST schedule overview'] [title]")].map((element) => element.getAttribute("title")).filter(Boolean),
    };
  }));
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-desktop-1280.png"), fullPage: true });
  await expect(cells).toHaveCount(10 * 27);
  await expect(matrix.locator("[data-dust-state='zero']")).toHaveCount(27);
  await expect(matrix.locator("[data-dust-state='bench']")).toHaveCount(9 * 27);
  await expect(matrix.locator("[data-dust-state='unresolved']")).toHaveCount(0);
  await expect(matrix.getByLabel("Benched games by Yahoo week").locator("span")).toHaveCount(27);
  await expect(page.locator("#mobile-draft-panel-players")).toBeVisible();

  await page.getByLabel("Schedule period").selectOption("playoffs");
  await expect(matrix.locator("[data-selected-week]")).toHaveCount(10 * 3);
  await expect(cells).toHaveCount(10 * 27);
  const midweek = matrix.getByLabel(/Matrix Player 19 · Week 14/).first();
  await midweek.focus();
  await expect(matrix.getByRole("status")).toHaveText(/Matrix Player 19 · Week 14 .*: 1 scheduled, 0 startable, 1 benched\./);
  await matrix.getByLabel(/Matrix Player 21 · Week 14/).first().click();
  await expect(matrix.getByRole("status")).toHaveText(/Matrix Player 21 · Week 14 .*: 1 scheduled, 1 startable, 0 benched\./);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cells).toHaveCount(10 * 27);
  await matrix.getByText("Inspect exact player-week counts", { exact: true }).click();
  await expect(matrix.getByRole("button", { name: "Matrix Player 19 · W14" })).toBeVisible();
  await expect(matrix.locator("details li")).toHaveCount(10 * 27);
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-390.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(cells).toHaveCount(10 * 27);
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-320.png"), fullPage: true });
});

test("DUST matrix distinguishes unavailable coverage from zero conflicts", async ({ page }) => {
  await installDustMatrixFixtures(page, { incomplete: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/draft-dashboard");
  await draftMatrixRoster(page);
  const matrix = page.getByRole("region", { name: "DUST schedule overview" });
  await matrix.getByRole("button", { name: /DUST schedule overview/ }).click();
  await expect(matrix.locator("[data-dust-state='unresolved']")).toHaveCount(10 * 27, { timeout: 60_000 });
  await expect(matrix.locator("[data-dust-state='zero']")).toHaveCount(0);
  await expect(matrix.getByLabel("Benched games by Yahoo week").getByText("Unavailable", { exact: false })).toHaveCount(27);
});
