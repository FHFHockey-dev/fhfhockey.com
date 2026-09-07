import { expect, test } from "@playwright/test";

import { installDraftProFreeFixtures } from "./draft-pro-fixtures";

const settings = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Draft Settings", exact: true });

test("free manual draft preserves a favorite and local snapshot", async ({ page }) => {
  await installDraftProFreeFixtures(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/draft-dashboard");
  await expect(settings(page)).toHaveAttribute("data-full", "true");
  await settings(page).getByRole("button", { name: "Done", exact: false }).click();

  const players = page.locator("#mobile-draft-panel-players");
  await expect(players.locator("tbody tr").first()).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Position filter").selectOption("G");
  const row = players.locator("tbody tr").first();
  await row.getByRole("button", { name: /^Favorite / }).click();
  await row.getByRole("button", { name: "Draft", exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftedPlayers?.length,
  )).toBe(1);
  await expect(row.getByRole("button", { name: /^Unfavorite / })).toBeVisible();
});
