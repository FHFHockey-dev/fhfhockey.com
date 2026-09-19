import { expect, test } from "@playwright/test";

test("shows projections before observed TOI, with original and text-only reports", async ({ page }) => {
  const units = [1, 2].map((number) => ({ situation: "pp", number, explicitNumber: true, complete: true, group: null, evidence: [],
    players: Array.from({ length: 5 }, (_, index) => ({ playerId: number * 10 + index, name: `Skater ${number}-${index}` })) }));
  const report = { key: "fixture", teamId: 59, teamAbbreviation: "UTA", gameId: 2026010001, session: null, date: "2026-09-18",
    publishedAt: "2026-09-18T15:00:00Z", originalPublishedAt: "2026-09-18T15:00:00Z", receivedAt: "2026-09-18T15:01:00Z",
    originalUrl: "https://x.com/reporter/status/2100997456121229806", text: "Utah power-play report",
    interpretation: { version: "fixture", units, unresolved: [], context: "game", certainty: "reported" } };
  await page.route("**/api/v1/lines/projected?*", (route) => route.fulfill({ json: { enabled: true,
    sets: [{ key: "fixture:pp", situation: "pp", group: null, units, reports: [report], publishedAt: report.publishedAt }],
    reports: [report, { ...report, key: "camp", originalUrl: null, text: "Camp Group A: a partial unit report", interpretation: { ...report.interpretation, context: "camp", units: [units[0]] } }] } }));
  await page.route("https://platform.twitter.com/**", (route) => route.abort());
  await page.route("https://api-web.nhle.com/**", (route) => route.fulfill({ json: { gameScheduleState: "OK", gameState: "PRE" } }));
  await page.goto("/lines/line-combo/2026010001");
  const projections = page.getByRole("region", { name: "Projected line combinations" });
  const observed = page.getByRole("region", { name: "Observed shared ice time" });
  await expect(projections).toContainText("Skater 1-0");
  await expect(observed).toBeVisible();
  expect(await projections.evaluate((element) => Boolean(element.compareDocumentPosition(document.querySelector('[aria-label="Observed shared ice time"]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  const rail = page.getByRole("complementary", { name: "Latest team reports" });
  await expect(rail.getByRole("link", { name: "View original tweet" })).toHaveAttribute("href", report.originalUrl);
  await expect(rail).toContainText("Camp Group A");
  await expect(rail).toContainText("Original source link pending");
  await expect(projections).not.toContainText(/GameDayLines|CcCMiddleton/i);
});

test("review can find an out-of-team player by NHL ID and save the selected identity", async ({ page }) => {
  const saves: Record<string, unknown>[] = [];
  await page.route("**/api/v1/db/player-name-aliases*", async (route) => {
    if (route.request().method() === "POST") {
      saves.push(route.request().postDataJSON());
      return route.fulfill({ json: { success: true, message: "Alias saved." } });
    }
    return route.fulfill({ json: { success: true, unresolvedNames: saves.length ? [] : [{ id: "review-1", raw_name: "Trocheck", normalized_name: "trocheck", team_id: 59, team_abbreviation: "UTA", source: "gamedaylines", tweet_id: "2100997456121229806", context_text: "Lee - Trocheck - Yamamoto", status: "pending", metadata: { reason: "missing_membership" } }], players: [{ id: 8476389, fullName: "Vincent Trocheck", lastName: "Trocheck", position: "C", team_id: 3 }] } });
  });
  await page.goto("/db/player-aliases?reviewToken=fixture");
  await page.getByLabel("Search all players by name or NHL ID").fill("8476389");
  await page.getByLabel("Match player", { exact: true }).selectOption("8476389");
  await page.getByRole("button", { name: "Save alias", exact: true }).click();
  await expect.poll(() => saves[0]?.playerId).toBe(8476389);
  expect(saves[0]?.alias).toBe("Trocheck");
});

test("review retrieves and imports an NHL prospect missing from the local directory", async ({ page }) => {
  const saves: Record<string, unknown>[] = [];
  await page.route("**/api/v1/db/player-name-aliases*", async (route) => {
    if (route.request().method() === "POST") {
      saves.push(route.request().postDataJSON());
      return route.fulfill({ json: { success: true, message: "Saved alias for Jacob Cloutier." } });
    }
    if (new URL(route.request().url()).searchParams.has("nhlId")) return route.fulfill({ json: {
      success: true, lookup: { nhlId: 8485689, fullName: "Jacob Cloutier", firstName: "Jacob", lastName: "Cloutier", position: "R", currentTeamId: 52, sourceUrl: "https://api-web.nhle.com/v1/player/8485689/landing" },
    } });
    return route.fulfill({ json: { success: true, membershipReviewEnabled: true, players: [], unlinkedProspects: [{ id: 777, canonical_name: "Unlinked Prospect" }],
      unresolvedNames: saves.length ? [] : [{ id: "review-cloutier", raw_name: "Cloutier", team_id: 52, team_abbreviation: "WPG", status: "pending", metadata: {} }],
    } });
  });
  await page.goto("/db/player-aliases?reviewToken=fixture");
  await page.getByLabel("Search all players by name or NHL ID").fill("Unlinked Prospect");
  await expect(page.getByText("Unlinked Prospect — verified prospect")).toBeVisible();
  await page.getByLabel("Search all players by name or NHL ID").fill("8485689");
  await page.getByRole("button", { name: "Look up NHL ID" }).click();
  await expect(page.getByRole("link", { name: "Verified NHL profile" })).toHaveAttribute("href", "https://api-web.nhle.com/v1/player/8485689/landing");
  expect(saves).toHaveLength(0);
  await page.getByRole("button", { name: "Import NHL player and save alias" }).click();
  await expect.poll(() => saves[0]?.playerId).toBe(8485689);
  expect(saves[0]).toMatchObject({ unresolvedId: "review-cloutier", importNhlIdentity: true, alias: "Cloutier" });
  await expect(page.getByRole("status")).toContainText("Saved alias for Jacob Cloutier");
});
