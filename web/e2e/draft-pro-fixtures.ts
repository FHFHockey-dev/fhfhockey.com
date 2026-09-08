import type { Page } from "@playwright/test";
import type { DraftProAccess } from "lib/draft-pro/contracts";

type DraftProAccountResponse = { access: DraftProAccess };

/** Keeps browser smoke coverage local, free, and independent of real accounts. */
export async function installDraftProFreeFixtures(page: Page, { seedSnapshot = true }: { seedSnapshot?: boolean } = {}) {
  const skaters = [{
    player_id: 1001, Player_Name: "Fixture Center", Team_Abbreviation: "AAA", Position: "C",
    Games_Played: 82, Goals: 30, Assists: 45, Points: 75, Shots_on_Goal: 220,
  }, {
    player_id: 1002, Player_Name: "Fixture Center Two", Team_Abbreviation: "CCC", Position: "C",
    Games_Played: 82, Goals: 25, Assists: 40, Points: 65, Shots_on_Goal: 200,
  }, {
    player_id: 1003, Player_Name: "Fixture Center Three", Team_Abbreviation: "DDD", Position: "C",
    Games_Played: 82, Goals: 20, Assists: 35, Points: 55, Shots_on_Goal: 180,
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
          { id: 1003, fullName: "Fixture Center Three", position: "C", lastName: "Three" },
        ]
      : table === "yahoo_matchup_weeks"
        ? [{ week: 1, start_date: "2026-10-05", end_date: "2026-10-11" }]
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
  await page.route("**/api/v1/account/yahoo/draft-sessions**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/api/v1/player**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**://*.stripe.com/**", (route) => route.abort());
  await page.route("**://*.patreon.com/**", (route) => route.abort());
  if (seedSnapshot) await page.addInitScript(() => {
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

export async function installDustMatrixFixtures(page: Page, { incomplete = false }: { incomplete?: boolean } = {}) {
  await installDraftProFreeFixtures(page, { seedSnapshot: false });
  const skaters = Array.from({ length: 41 }, (_, index) => ({
    player_id: 1001 + index,
    Player_Name: `Matrix Player ${String(index + 1).padStart(2, "0")}`,
    Team_Abbreviation: incomplete && index === 40 ? "ZZZ" : "AAA",
    Position: index === 0 ? "C,RW" : ["C", "LW", "RW", "D"][index % 4],
    Games_Played: 82,
    Goals: 20 + index,
    Assists: 35,
    Points: 55 + index,
    Shots_on_Goal: 180,
  }));
  const weeks = Array.from({ length: 27 }, (_, index) => {
    const start = new Date(Date.UTC(2026, 9, 5 + index * 7));
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { week: index + 1, start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) };
  });
  await page.route("**/rest/v1/**", (route) => {
    const table = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() || "");
    const data = table === "yahoo_matchup_weeks"
      ? weeks
      : table === "players"
        ? skaters.map((player) => ({ id: player.player_id, fullName: player.Player_Name, position: player.Position, lastName: player.Player_Name.split(" ").at(-1) }))
        : table.startsWith("PROJECTIONS_")
          ? (table.includes("GOALIES") ? [] : skaters)
          : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.route("**/api/v1/roster-schedule-optimizer/schedule**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: {
        gameKey: "477", startWeek: 1, endWeek: 27, version: "fixture-v1",
        freshness: { latestFetchedAt: new Date().toISOString(), oldestFetchedAt: new Date().toISOString(), rowCount: 27 },
        games: weeks.map((week) => ({ source_game_id: `fixture-${week.week}`, game_date: week.start_date, game_status: "FUT", team_abbreviation: "AAA", week: week.week })),
      } }),
    }),
  );
  await page.route("**/api/v1/team/current", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: 1, name: "Fixture Team", abbreviation: "AAA", logo: "" }]) }));
  await page.route("**/api/v1/schedule/**", (route) => {
    const date = route.request().url().match(/schedule\/(\d{4}-\d{2}-\d{2})/)?.[1] || weeks[0].start_date;
    const start = new Date(`${date}T00:00:00Z`);
    const coveredDates = Array.from({ length: 7 }, (_, index) => {
      const current = new Date(start);
      current.setUTCDate(start.getUTCDate() + index);
      return current.toISOString().slice(0, 10);
    });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ coveredDates, numGamesPerDay: [1, 0, 0, 0, 0, 0, 0], data: { 1: { MON: { id: Number(date.replaceAll("-", "")), season: 20262027, gameDate: date, gameType: 2, homeTeam: { id: 1 }, awayTeam: { id: 2 } } } } }) });
  });
  await page.addInitScript(({ incomplete }) => {
    sessionStorage.setItem("draftDashboard.yahooLiveDraft.v3", JSON.stringify({ v: 3, mode: "manual", sessionId: null, externalLeagueId: null }));
    sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({
      v: 2, configured: true, currentPick: 1, draftedPlayers: [], myTeamId: "Team 1",
      draftSettings: {
        teamCount: 2, draftOrder: ["Team 1", "Team 2"], draftOrderMode: "standard",
        rosterConfig: { C: 1, LW: 0, RW: 0, D: 0, G: 0, utility: 0, bench: 20 },
        playoffWeeks: [25, 26, 27], scheduleScope: "season",
      },
    }));
  }, { incomplete });
}
