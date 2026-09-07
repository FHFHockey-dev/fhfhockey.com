import { expect, test } from "@playwright/test";

import { installDustMatrixFixtures } from "./draft-pro-fixtures";

test("full-season DUST lattice keeps all player-week intersections available", async ({ page }, testInfo) => {
  await installDustMatrixFixtures(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/draft-dashboard");
  await expect(page.locator("#mobile-draft-panel-players tbody tr").first()).toBeVisible({ timeout: 60_000 });
  const matrix = page.getByRole("region", { name: "DUST schedule overview" });
  await matrix.getByRole("button", { name: /DUST schedule overview/ }).click();
  await expect(matrix.getByText("Every Yahoo 477 week is shown.", { exact: false })).toBeVisible();
  const cells = matrix.locator("button[aria-label*='Week ']");
  await expect(cells).toHaveCount(20 * 27);
  await expect(matrix.getByLabel("Benched games by Yahoo week").locator("span")).toHaveCount(27);
  await expect(page.locator("#mobile-draft-panel-players")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-desktop-1280.png"), fullPage: true });

  await page.getByLabel("Schedule period").selectOption("playoffs");
  await expect(matrix.locator("[data-selected-week]")).toHaveCount(20 * 3);
  await expect(cells).toHaveCount(20 * 27);
  const midweek = matrix.getByLabel(/Matrix Player 01 · Week 14/).first();
  await midweek.focus();
  await expect(matrix.getByRole("status")).toContainText("Matrix Player 01 · Week 14");
  await expect(matrix.getByRole("status")).toContainText("scheduled, 1 startable, 0 benched");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cells).toHaveCount(20 * 27);
  await matrix.getByText("Inspect exact player-week counts", { exact: true }).click();
  await expect(matrix.getByRole("button", { name: "Matrix Player 01 · W14" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-390.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(cells).toHaveCount(20 * 27);
  await page.screenshot({ path: testInfo.outputPath("dust-matrix-mobile-320.png"), fullPage: true });
});
