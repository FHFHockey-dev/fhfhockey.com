import type { Page } from "@playwright/test";

/** Keeps browser smoke coverage local, free, and independent of real accounts. */
export async function installDraftProFreeFixtures(page: Page) {
  const skater = {
    player_id: 1001, Player_Name: "Fixture Center", Team_Abbreviation: "AAA", Position: "C",
    Games_Played: 82, Goals: 30, Assists: 45, Points: 75, Shots_on_Goal: 220,
  };
  const goalie = {
    player_id: 2001, Player_Name: "Fixture Goalie", Team_Abbreviation: "BBB", Position: "G",
    Games_Played: 55, Games_Started_Goalie: 50, Wins_Goalie: 30, Saves_Goalie: 1400,
    Goals_Against_Goalie: 120, Shots_Against: 1520, Save_Percentage: 0.921, Goals_Against_Average: 2.4,
  };
  await page.route("**/rest/v1/**", (route) => {
    const table = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() || "");
    const data = table.startsWith("PROJECTIONS_")
      ? [table.includes("GOALIES") ? goalie : skater]
      : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.route("**/api/v1/account/draft-pro", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Authentication is required." }),
    }),
  );
  await page.route("**://*.stripe.com/**", (route) => route.abort());
  await page.route("**://*.patreon.com/**", (route) => route.abort());
}
