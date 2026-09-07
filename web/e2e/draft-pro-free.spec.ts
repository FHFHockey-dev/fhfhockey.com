import { expect, test } from "@playwright/test";

import { installDraftProFreeFixtures } from "./draft-pro-fixtures";

test("free minimal league completes a manual draft with local persistence", async ({ page }) => {
  await installDraftProFreeFixtures(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/draft-dashboard");

  const players = page.locator("#mobile-draft-panel-players");
  await expect(players.locator("tbody tr").first()).toBeVisible({ timeout: 60_000 });
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
});
