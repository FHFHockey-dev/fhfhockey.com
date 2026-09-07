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
