import type { Page } from "@playwright/test";

/** Keeps browser smoke coverage local, free, and independent of real accounts. */
export async function installDraftProFreeFixtures(page: Page) {
  const skaters = [{
    player_id: 1001, Player_Name: "Fixture Center", Team_Abbreviation: "AAA", Position: "C",
    Games_Played: 82, Goals: 30, Assists: 45, Points: 75, Shots_on_Goal: 220,
  }, {
    player_id: 1002, Player_Name: "Fixture Center Two", Team_Abbreviation: "CCC", Position: "C",
    Games_Played: 82, Goals: 25, Assists: 40, Points: 65, Shots_on_Goal: 200,
  }];
  const goalie = {
    player_id: 2001, Player_Name: "Fixture Goalie", Team_Abbreviation: "BBB", Position: "G",
    Games_Played: 55, Games_Started_Goalie: 50, Wins_Goalie: 30, Saves_Goalie: 1400,
    Goals_Against_Goalie: 120, Shots_Against: 1520, Save_Percentage: 0.921, Goals_Against_Average: 2.4,
  };
  await page.route("**/rest/v1/**", (route) => {
    const table = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() || "");
    const data = table.startsWith("PROJECTIONS_")
      ? (table.includes("GOALIES") ? [goalie] : skaters)
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
  await page.addInitScript(() => {
    sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({
      v: 2, configured: true, currentPick: 1, draftedPlayers: [],
      draftSettings: {
        teamCount: 2, draftOrder: ["Team 1", "Team 2"], draftOrderMode: "standard",
        rosterConfig: { C: 1, LW: 0, RW: 0, D: 0, G: 0, utility: 0, bench: 0 },
      },
    }));
  });
}
