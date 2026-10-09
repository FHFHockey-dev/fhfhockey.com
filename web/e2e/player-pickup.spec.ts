import { expect, test } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { installDraftProAuthenticatedFixtures } from "./draft-pro-fixtures";

loadEnvConfig(process.cwd(), true);

test("candidate drawer preserves readable provider positions and honest availability", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/v1/season", route => route.fulfill({ json: { seasonId: 20262027 } }));
  await page.route("**/api/v1/team/**", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/schedule/**", route => route.fulfill({ json: { data: {}, numGamesPerDay: [0, 0, 0, 0, 0, 0, 0] } }));
  await page.route("**/rest/v1/**", route => {
    const table = new URL(route.request().url()).pathname.split("/").pop();
    if (!["GET", "HEAD"].includes(route.request().method())) return route.abort();
    const json = table === "yahoo_players" ? [{ player_key: "477.p.1", player_id: "1", percent_ownership: 0 }, { player_key: "477.p.2", player_id: "2", percent_ownership: 95 }]
      : table === "yahoo_nhl_player_map_read" ? [
        { nhl_player_id: "1", nhl_player_name: "Fixture Candidate", yahoo_player_id: "477.p.1", yahoo_team: "BOS", percent_ownership: 0, eligible_positions: [{ position: "C" }, { position: "LW" }] },
        { nhl_player_id: "2", nhl_player_name: "Owned Fixture", yahoo_player_id: "477.p.2", yahoo_team: "TOR", percent_ownership: 95, eligible_positions: ["C"] },
      ]
      : [];
    return route.fulfill({ json });
  });
  for (const [width, height] of [[1180, 757], [1024, 768], [768, 1024], [390, 844], [320, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/game-grid/7-Day-Forecast?startDate=2026-10-01&endDate=2026-10-07");
    await expect(page.getByRole("heading", { name: "Game Grid", exact: true })).toBeVisible();
    const drawer = page.getByRole("region", { name: "Player candidates", exact: true });
    if (await drawer.isVisible()) {
      const handle = drawer.getByRole("button", { name: /Player Candidates/ });
      if (await handle.getAttribute("aria-expanded") === "false") await handle.click();
    }
    await expect(page.getByRole("heading", { name: "Best Players Available", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Best Players Available", exact: true }).first()).toHaveText("Best Players Available");
    await expect(page.getByText("F. Candidate").first()).toBeVisible();
    await expect(page.getByText("C, LW").first()).toBeVisible();
    await expect(page.getByText(/Availability in your league and waiver status are unknown/).first()).toBeVisible();
    await expect(page.getByText(/\[object Object\]/)).toHaveCount(0);
    await page.getByRole("checkbox", { name: "C", exact: true }).uncheck();
    await expect(page.getByText("F. Candidate").first()).toBeVisible();
    await page.getByRole("checkbox", { name: "LW", exact: true }).uncheck();
    await expect(page.getByText("No players match the current filters.").first()).toBeVisible();
    await page.getByRole("button", { name: "Reset Filters", exact: true }).click();
    await expect(page.getByText("F. Candidate").first()).toBeVisible();
    await page.getByLabel("Team:", { exact: true }).selectOption("TOR");
    await expect(page.getByText("No players match the current filters.").first()).toBeVisible();
    await page.getByLabel("Team:", { exact: true }).selectOption("BOS");
    await expect(page.getByText("F. Candidate").first()).toBeVisible();
    await page.getByRole("checkbox", { name: "GP%", exact: true }).uncheck();
    await expect(page.getByRole("checkbox", { name: "GP%", exact: true })).not.toBeChecked();
    await page.getByRole("button", { name: "Goalies", exact: true }).click();
    await expect(page.getByText("No players match the current filters.").first()).toBeVisible();
    await page.getByRole("button", { name: "Skaters", exact: true }).click();
    await expect(page.getByText("F. Candidate").first()).toBeVisible();
    await page.getByRole("button", { name: "Reset Filters", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "GP%", exact: true })).toBeChecked();
    if (width >= 768) {
      const filterBounds = (await drawer.locator('[class*="PlayerPickupTable_filters__"]').boundingBox())!;
      for (const control of [page.getByLabel("Team:", { exact: true }),
        page.getByRole("button", { name: "Goalies", exact: true }),
        page.getByRole("button", { name: "None", exact: true })]) {
        const bounds = (await control.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(filterBounds.x);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(filterBounds.x + filterBounds.width);
      }
      for (const section of await drawer.locator('[class*="PlayerPickupTable_filterContainer__"], [class*="PlayerPickupTable_metricFilterContainer__"]').all()) {
        expect(await section.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      }
    }
    if (width < 768) {
      const title = page.getByRole("button", { name: "Best Players Available", exact: true });
      await title.focus();
      await page.keyboard.press("Enter");
      await expect(title).toHaveAttribute("aria-expanded", "false");
      await page.keyboard.press("Space");
      await expect(title).toHaveAttribute("aria-expanded", "true");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`candidate-${width}x${height}.png`) });
  }
  expect(errors).toEqual([]);
});


for (const width of [1180, 390]) {
  test(`connected candidate pool preserves roster and unknown-addability boundaries at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await installDraftProAuthenticatedFixtures(page, () => ({ access: {
      eligible: true, grantingSources: ["purchase"], expiresAt: null, verifiedAt: null, nextVerificationAt: null,
      reason: "eligible", capabilities: ["recommendations"], providerReadiness: { stripe: false, patreon: false, yahoo: true },
    } }));
    const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`;
    await page.addInitScript(key => {
      const fictionalSession = localStorage.getItem("sb-127-auth-token");
      if (fictionalSession) localStorage.setItem(key, fictionalSession);
    }, storageKey);
    await page.route("**/api/v1/season", route => route.fulfill({ json: { seasonId: 20262027 } }));
    await page.route("**/api/v1/team/**", route => route.fulfill({ json: [] }));
    await page.route("**/api/v1/schedule/**", route => route.fulfill({ json: { data: {}, numGamesPerDay: [0, 0, 0, 0, 0, 0, 0] } }));
    await page.route("**/rest/v1/**", route => {
      if (!["GET", "HEAD"].includes(route.request().method())) return route.abort();
      const table = new URL(route.request().url()).pathname.split("/").pop();
      const json = table === "yahoo_players" ? [{ player_key: "477.p.1", player_id: "1", percent_ownership: 0 }, { player_key: "477.p.2", player_id: "2", percent_ownership: 95 }]
        : table === "yahoo_nhl_player_map_read" ? [
          { nhl_player_id: "1", nhl_player_name: "Rostered Fixture", yahoo_player_id: "477.p.1", yahoo_team: "BOS", percent_ownership: 0, eligible_positions: ["C"] },
          { nhl_player_id: "2", nhl_player_name: "Injured Candidate", yahoo_player_id: "477.p.2", yahoo_team: "TOR", percent_ownership: 95, eligible_positions: ["C"], status: "IR", injury_note: "Fixture lower body" },
        ] : [];
      return route.fulfill({ json });
    });
    let mode: "ready" | "error" = "ready";
    await page.route("**/api/v1/account/yahoo/pickup", route => mode === "error"
      ? route.fulfill({ status: 503, json: { error: "Fixture roster sync failed" } })
      : route.fulfill({ json: { data: { leagueName: "Fixture League", teamName: "Fixture Team", gameKey: "477", season: 2026,
        fetchedAt: "2026-10-01T12:00:00Z", rosteredPlayerKeys: ["477.p.1"], roster: [{ key: "477.p.1", name: "Rostered Fixture", position: "C" }] } } }));
    await page.goto("/game-grid/7-Day-Forecast?startDate=2026-10-01&endDate=2026-10-07");
    const drawer = page.getByRole("region", { name: "Player candidates", exact: true });
    const handle = await drawer.isVisible() ? drawer.getByRole("button", { name: /Player Candidates/ })
      : page.getByRole("button", { name: "Best Players Available", exact: true });
    if (await handle.getAttribute("aria-expanded") === "false") await handle.click();
    await expect(page.getByText(/Fixture League · Fixture Team · Synced/)).toBeVisible();
    await expect(page.getByText("I. Candidate").first()).toBeVisible();
    await expect(page.getByText("R. Fixture")).toHaveCount(0);
    await expect(page.getByAltText("Injured").first()).toBeVisible();
    await expect(page.getByText(/Waiver status and immediate addability are unknown/)).toBeVisible();
    await page.getByRole("button", { name: "My roster (1)", exact: true }).click();
    await expect(page.getByText("R. Fixture").first()).toBeVisible();
    await expect(page.getByText("I. Candidate")).toHaveCount(0);
    mode = "error";
    await page.getByRole("button", { name: "Refresh Yahoo", exact: true }).click();
    await expect(page.getByText("Fixture roster sync failed")).toBeVisible();
    await expect(page.getByText(/Showing the general player pool; Yahoo league availability is not applied/)).toBeVisible();
    await expect(page.getByText("R. Fixture").first()).toBeVisible();
    mode = "ready";
    await page.getByRole("button", { name: "Refresh Yahoo", exact: true }).click();
    await expect(page.getByText("I. Candidate").first()).toBeVisible();
    await expect(page.getByText("R. Fixture")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
