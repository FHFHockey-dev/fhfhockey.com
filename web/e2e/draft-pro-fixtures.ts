import type { Page } from "@playwright/test";
import type { DraftProAccess } from "lib/draft-pro/contracts";

type DraftProAccountResponse = { access: DraftProAccess };

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
    const sourceAdjustedSkaters = skaters.map((player) => ({
      ...player,
      Goals: table.includes("CULLEN") ? player.Goals + 20 : player.Goals,
      Points: table.includes("CULLEN") ? player.Points + 30 : player.Points,
    }));
    const data = table === "players"
      ? [
          { id: 1001, fullName: "Fixture Center", position: "C", lastName: "Center" },
          { id: 1002, fullName: "Fixture Center Two", position: "C", lastName: "Two" },
        ]
      : table.startsWith("PROJECTIONS_")
        ? (table.includes("GOALIES") ? [goalie] : sourceAdjustedSkaters)
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
  await page.route("**/api/v1/player**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**://*.stripe.com/**", (route) => route.abort());
  await page.route("**://*.patreon.com/**", (route) => route.abort());
  await page.addInitScript(() => {
    if (sessionStorage.getItem("draft.snapshot.v2")) return;
    sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({
      v: 2, configured: true, currentPick: 1, draftedPlayers: [],
      draftSettings: {
        teamCount: 2, draftOrder: ["Team 1", "Team 2"], draftOrderMode: "standard",
        rosterConfig: { C: 1, LW: 0, RW: 0, D: 0, G: 0, utility: 0, bench: 0 },
      },
    }));
  });
}

/**
 * Adds a fictional persisted Supabase session to the free fixture. Auth and
 * account responses remain local route intercepts; this never contacts
 * Supabase or a payment provider.
 */
export async function installDraftProAuthenticatedFixtures(
  page: Page,
  accountResponse: () => DraftProAccountResponse,
) {
  await installDraftProFreeFixtures(page);
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "draft-pro-fixture@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { fixture: true },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const jwt = (subject: string) => `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${Buffer.from(JSON.stringify({ sub: subject, aud: "authenticated", role: "authenticated", exp: expiresAt })).toString("base64url")}.fixture`;
  const session = {
    access_token: jwt(user.id),
    refresh_token: jwt(`${user.id}:refresh`),
    token_type: "bearer",
    expires_in: 60 * 60,
    expires_at: expiresAt,
    user,
  };
  await page.addInitScript((persistedSession) => {
    localStorage.setItem("sb-127-auth-token", JSON.stringify(persistedSession));
  }, session);
  await page.route("**/auth/v1/user", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }),
  );
  await page.route("**/auth/v1/token**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) }),
  );
  await page.route("**/api/v1/account/draft-pro", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: accountResponse() }) }),
  );
}
