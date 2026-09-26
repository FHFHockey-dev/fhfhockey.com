import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

import type { DraftProAccess } from "lib/draft-pro/contracts";

import { installDraftProAuthenticatedFixtures } from "./draft-pro-fixtures";

function accountResponse(eligible = false): { access: DraftProAccess; [key: string]: unknown } {
  return {
    access: {
      eligible,
      grantingSources: eligible ? ["purchase"] : [],
      expiresAt: eligible ? "2027-07-01T04:00:00.000Z" : null,
      verifiedAt: eligible ? "2026-09-07T00:00:00.000Z" : null,
      nextVerificationAt: eligible ? "2026-09-08T00:00:00.000Z" : null,
      reason: eligible ? "eligible" : "no_active_grant",
      capabilities: eligible ? ["blended_csv"] : [],
      providerReadiness: { stripe: true, patreon: false, yahoo: false },
    },
    passInfo: { priceCents: 599, expiresAt: "2027-07-01T04:00:00.000Z", renewal: "none" },
    checkoutAvailability: { available: !eligible, reason: eligible ? "already_eligible" : "available" },
    configurationReadiness: { stripe: true, patreon: false, yahoo: false },
    purchases: eligible ? [{
      id: "purchase_fixture", season: "2026", status: "active", activatedAt: "2026-09-07T00:00:00.000Z",
      expiresAt: "2027-07-01T04:00:00.000Z", amountCents: 599, currency: "usd", receiptUrl: null,
      refundEligibility: { eligible: false, deadline: null, reason: "fixture" },
    }] : [],
    refundRequests: [],
    savedDrafts: [{ id: "draft_fixture", name: "Retained fixture draft", status: "manual", updatedAt: "2026-09-07T00:00:00.000Z" }],
    privateImports: [],
  };
}

test("paid export posts fictional projection numbers and downloads provider provenance", async ({ page }) => {
  let requestPayload: Record<string, unknown> | undefined;
  let authorization = "";
  await installDraftProAuthenticatedFixtures(page, () => accountResponse(true));
  await page.route("**/api/v1/draft-pro/export", (route) => {
    requestPayload = route.request().postDataJSON() as Record<string, unknown>;
    authorization = route.request().headers().authorization || "";
    const player = (requestPayload.rows as Array<Record<string, unknown>>)[0];
    return route.fulfill({
      status: 200,
      contentType: "text/csv",
      body: `playerId,fullName,fantasyPointsProjected,sourceProvenance\n${player.playerId},${player.fullName},${Number(player.fantasyPointsProjected).toFixed(1)},fixture-local-provenance\n`,
    });
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/draft-dashboard");
  await expect(page.locator("#mobile-draft-panel-players tbody tr").first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await page.getByRole("button", { name: "Projections", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-settings-btn").click();
  const download = await downloadPromise;
  const rows = requestPayload?.rows as Array<Record<string, unknown>>;
  const exported = await readFile(await download.path(), "utf8");
  expect(exported).toContain(`${rows[0].playerId},${rows[0].fullName},${Number(rows[0].fantasyPointsProjected).toFixed(1)},fixture-local-provenance`);
  expect(authorization).toMatch(/^Bearer eyJ/);
  expect(requestPayload).toMatchObject({
    season: expect.any(String),
    leagueType: "points",
    scoring: expect.objectContaining({ GOALS: 3, ASSISTS: 2, SHOTS_ON_GOAL: 0.2 }),
    sourceWeights: expect.any(Object),
    rows: expect.arrayContaining([expect.objectContaining({ playerId: 1001, fullName: "Fixture Center", fantasyPointsProjected: expect.any(Number) })]),
  });
  await expect(page.getByRole("alert").filter({ hasText: "Blended projections CSV downloaded." })).toBeVisible();
});

test("position weights update valuation, survive reload, and become neutral without Pro", async ({ page }, testInfo) => {
  let eligible = true;
  await installDraftProAuthenticatedFixtures(page, () => accountResponse(eligible));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/draft-dashboard");
  const row = page.locator('#mobile-draft-panel-players tr[data-player-id="1001"]');
  const vorp = row.locator('td[data-label="VORP"]');
  const projection = row.locator('td[data-label="Projected FPTs"]');
  await expect(vorp).toBeVisible({ timeout: 60_000 });
  const original = Number(await vorp.innerText());
  const originalProjection = await projection.innerText();
  expect(original).toBeGreaterThan(0);
  const legacyBookmark = await page.evaluate(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}");
    const { positionWeights: _weights, ...settings } = snapshot.draftSettings;
    return { v: 3, settings, draftedPlayers: snapshot.draftedPlayers, currentPick: snapshot.currentPick, myTeamId: snapshot.myTeamId };
  });
  const scoring = async () => {
    await page.getByRole("button", { name: "Open full draft settings", exact: true }).click();
    await page.getByRole("tab", { name: "Scoring", exact: true }).click();
  };
  const done = () => page.getByRole("button", { name: "Done", exact: false }).click();
  await scoring();
  await page.getByLabel("C position weight percent").fill("50");
  await page.getByLabel("D position weight percent").fill("70");
  await page.screenshot({ path: testInfo.outputPath("position-weights.png") });
  await done();
  await expect(vorp).toHaveText((original * 0.5).toFixed(1));
  await expect(projection).toHaveText(originalProjection);
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftSettings.positionWeights)).toEqual({ C: 0.5, D: 0.7 });
  await page.reload();
  await expect(vorp).toHaveText((original * 0.5).toFixed(1), { timeout: 60_000 });
  eligible = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(vorp).toHaveText(original.toFixed(1));
  await scoring();
  await expect(page.getByLabel("C position weight percent")).toBeDisabled();
  await expect(page.getByLabel("C position weight percent")).toHaveValue("100");
  await done();
  eligible = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(vorp).toHaveText((original * 0.5).toFixed(1));
  await scoring();
  await page.getByRole("button", { name: "Reset Position Weights", exact: true }).click();
  await done();
  await expect(vorp).toHaveText(original.toFixed(1));
  await expect(projection).toHaveText(originalProjection);
  await scoring();
  await page.getByLabel("C position weight percent").fill("25");
  await page.getByRole("button", { name: "Import bookmark", exact: true }).click();
  await page.getByLabel("Import draft bookmark", { exact: true }).fill(JSON.stringify(legacyBookmark));
  await page.getByRole("button", { name: "Import Bookmark", exact: true }).click();
  await done();
  await expect(vorp).toHaveText(original.toFixed(1));
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftSettings.positionWeights)).toEqual({});
});

test("inactive access blocks export and shows retained summaries while checkout return confirms after retry", async ({ page }) => {
  let eligible = true;
  let verificationCalls = 0;
  let exportRequests = 0;
  let accessRequests = 0;
  await installDraftProAuthenticatedFixtures(page, () => accountResponse(eligible));
  await page.route("**/api/v1/account/draft-pro", (route) => {
    accessRequests += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: accountResponse(eligible) }) });
  });
  await page.route("**/api/v1/draft-pro/export", (route) => {
    exportRequests += 1;
    return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/v1/account/draft-pro/checkout/verify", (route) => {
    verificationCalls += 1;
    if (verificationCalls < 4) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state: "waiting" }) });
    eligible = true;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ state: "confirmed" }) });
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/draft-dashboard");
  const players = page.locator("#mobile-draft-panel-players");
  await expect(players.locator("tbody tr").first()).toBeVisible({ timeout: 60_000 });
  eligible = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => accessRequests, { timeout: 15_000 }).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Setup", exact: true }).click({ timeout: 60_000 });
  await page.getByRole("button", { name: "Projections", exact: true }).click();
  await page.getByTestId("export-settings-btn").click();
  await expect(page.getByRole("alert").filter({ hasText: "Blended projections export is available with Draft Pro." })).toBeVisible();
  expect(exportRequests).toBe(0);
  await page.goto("/account?section=draft-pro&draft_pro_checkout=cs_test_fixture123");
  const panel = page.getByRole("region", { name: "Draft Pro" });
  await expect(panel.getByText("Inactive", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByText("Your retained Draft Pro work is locked while access is inactive.", { exact: false })).toBeVisible();
  await expect(panel.getByText("Retained fixture draft", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Check purchase status again" })).toBeVisible({ timeout: 10_000 });
  await panel.getByRole("button", { name: "Check purchase status again" }).click();
  await expect(panel.getByText("Draft Pro access is confirmed.", { exact: true })).toBeVisible();
  await expect(panel.getByText("Active", { exact: true })).toBeVisible();
  expect(verificationCalls).toBe(4);
});
