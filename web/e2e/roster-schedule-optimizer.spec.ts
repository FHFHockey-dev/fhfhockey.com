import { expect, test } from "@playwright/test";
import { installDraftProAuthenticatedFixtures } from "./draft-pro-fixtures";
import type { LeagueRules, PlanningPlayer, PlanningWorkspace } from "../lib/rosterScheduleOptimizer/planningTypes";

const player = { id: "fhfh:1", nhlId: 1, name: "Alpha Center", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater" as const, availability: "unknown" as const, ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
const date = (day: number) => `2026-10-0${day}`;
const fixturePlayer = (id: number, name: string, team: string): PlanningPlayer => ({ ...player, id: `fhfh:${id}`, nhlId: id, name, teamAbbreviation: team, availability: "manager_available", canDrop: true });
const fixtureGame = (id: string, day: number, team: string) => ({ id, date: date(day), startsAt: `${date(day)}T23:00:00Z`, teamAbbreviation: team, opponent: "NYR", home: true, status: "scheduled" });
const fixtureForecast = (playerId: string, gameId: string, goals: number) => ({ playerId, gameId, stats: { GOALS: goals }, conditioning: "unconditional", startProbability: null, confirmedStart: false, revisionId: "fixture", issuedAt: "2026-09-26T00:00:00Z", modelVersion: "fixture", limitations: [] });
const fixtureRules: LeagueRules = { lineupMode: "daily", rosterSlots: { C: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1, periods: [{ id: "Week", start: "2026-10-05T00:00:00Z", end: "2026-10-09T00:00:00Z", remaining: 2, source: "manager" }], lineupPeriods: [], scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "unknown" }, unsupported: [] };
function fixtureWorkspace(players: PlanningPlayer[], rules: LeagueRules = fixtureRules): PlanningWorkspace {
  return { version: 1, context: { provider: "manual", seasonId: 20262027, leagueId: "manual", teamId: "manual", startDate: date(5), endDate: date(7), timeZone: "UTC", asOf: "2026-09-26T00:00:00Z" }, rules, managerRuleOverrides: {}, roster: [{ playerId: players[0].id, position: "active" }], lockedAssignments: [], intent: { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 10 }, manualPlayers: players, unresolvedNames: [], realized: {}, opponent: null };
}
async function seedWorkspace(page: import("@playwright/test").Page, workspace: PlanningWorkspace) {
  await page.addInitScript((value) => localStorage.setItem("fhfh:rso:workspace:v1", JSON.stringify(value)), workspace);
}
async function expectDesktopFrameVisible(page: import("@playwright/test").Page) {
  const frame = await page.evaluate(() => {
    const banner = document.querySelector("header")?.getBoundingClientRect();
    const title = document.querySelector("h1")?.getBoundingClientRect();
    const setup = document.querySelector('[aria-label="Planning setup"]')?.getBoundingClientRect();
    const summary = document.querySelector('[aria-label="Plan summary"]')?.getBoundingClientRect();
    return { scrollY: window.scrollY, htmlScroll: document.documentElement.scrollHeight, bodyScroll: document.body.scrollHeight, height: window.innerHeight, bannerBottom: banner?.bottom ?? 0, titleTop: title?.top ?? -1, setupTop: setup?.top ?? -1, summaryTop: summary?.top ?? -1 };
  });
  expect(frame.scrollY).toBe(0);
  expect(frame.htmlScroll).toBeLessThanOrEqual(frame.height + 1);
  expect(frame.bodyScroll).toBeLessThanOrEqual(frame.height + 1);
  expect(frame.titleTop).toBeGreaterThanOrEqual(frame.bannerBottom - 1);
  expect(frame.setupTop).toBeGreaterThanOrEqual(frame.bannerBottom - 1);
  expect(frame.summaryTop).toBeGreaterThanOrEqual(frame.bannerBottom - 1);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", (route) => route.fulfill({ json: { success: true, data: { players: [player], games: [], forecasts: [], evidence: {} } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/access", (route) => route.fulfill({ json: { data: { eligible: false, capabilities: [], grantingSources: [], expiresAt: null, reason: "manual" } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace?**", (route) => route.fulfill({ status: 401, json: { error: "unauthorized" } }));
});

test("manual workspace retains reviewed roster and has no document scroll on desktop", async ({ page }) => {
  for (const [width, height] of [[1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/roster-schedule-optimizer");
    await expect(page.getByRole("heading", { name: "Roster Schedule Optimizer" })).toBeVisible();
    if (!(await page.getByRole("button", { name: "Remove Alpha Center" }).isVisible())) {
      await page.getByRole("searchbox", { name: "Search canonical player" }).fill("Alpha");
      await page.getByRole("button", { name: "Add", exact: true }).click();
    }
    await expect(page.getByRole("button", { name: "Remove Alpha Center" })).toBeVisible();
    await expectDesktopFrameVisible(page);
    await page.reload();
    await expect(page.getByRole("button", { name: "Remove Alpha Center" })).toBeVisible();
    await expectDesktopFrameVisible(page);
  }
});

test("mobile tabs keep selection and expose the matchup", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/roster-schedule-optimizer");
  await expect(page.getByRole("region", { name: "Itinerary" })).toBeVisible();
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Roster" }).click();
  await page.getByRole("textbox", { name: "Paste roster names" }).fill("Alpha Center");
  await page.getByRole("button", { name: "Review pasted names" }).click();
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Matchup" }).click();
  await expect(page.getByText(/Opponent inputs are missing/)).toBeVisible();
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Roster" }).click();
  await expect(page.getByRole("button", { name: "Remove Alpha Center" })).toBeVisible();
});

test("streams A to B to C through successive conditional acquisitions and keeps expanded desktop layout", async ({ page }, testInfo) => {
  const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD"), fixturePlayer(3, "Charlie Center", "BOS")];
  const workspace = fixtureWorkspace(players);
  workspace.intent.steps = [
    { id: "b", type: "add", playerId: players[1].id, dropPlayerId: players[0].id, at: `${date(6)}T00:00:00Z`, effectiveAt: `${date(6)}T00:00:00Z`, conditional: true, dependsOn: [] },
    { id: "c", type: "add", playerId: players[2].id, dropPlayerId: players[1].id, at: `${date(7)}T00:00:00Z`, effectiveAt: `${date(7)}T00:00:00Z`, conditional: true, dependsOn: ["b"] },
  ];
  await seedWorkspace(page, workspace);
  const games = [fixtureGame("g-a", 5, "CAR"), fixtureGame("g-b", 6, "NJD"), fixtureGame("g-c", 7, "BOS")];
  const forecasts = games.map((game, index) => fixtureForecast(players[index].id, game.id, index + 1));
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", (route) => route.fulfill({ json: { success: true, data: { players, games, forecasts, evidence: {} } } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  const stream = page.getByRole("region", { name: "Itinerary" }).getByRole("table").first();
  await expect(stream).toContainText("Alpha Center");
  await expect(stream).toContainText("Bravo Center");
  await expect(stream).toContainText("Charlie Center");
  await expect(stream.getByRole("row", { name: /C#1/ }).getByRole("cell").nth(0)).toContainText("Hold");
  await expect(stream.getByRole("row", { name: /C#1/ }).getByRole("cell").nth(1)).toContainText("Conditional add");
  await expect(stream.getByRole("row", { name: /C#1/ }).getByRole("cell").nth(2)).toContainText("Conditional add");
  await expect(page.getByRole("region", { name: "Plan summary" }).getByText("3", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Itinerary" }).getByText("ADD Bravo Center")).toBeVisible();
  await expect(page.getByRole("region", { name: "Itinerary" }).getByText("ADD Charlie Center")).toBeVisible();
  await page.getByRole("button", { name: "Show full suggested lineup" }).click();
  await page.getByText("League rules and scoring").click();
  await page.getByText("Scoring, budgets, and lock windows").click();
  for (const [width, height] of [[1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await expectDesktopFrameVisible(page);
    await page.screenshot({ path: testInfo.outputPath(`roster-optimizer-stream-${width}.png`), fullPage: true });
  }
});

test("weekly lock keeps one fixed occupant across a window, including a confirmed midpoint assignment", async ({ page }) => {
  const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")];
  const workspace = fixtureWorkspace(players, { ...fixtureRules, lineupMode: "weekly", lineupPeriods: [{ id: "Week", start: `${date(5)}T00:00:00Z`, end: `${date(8)}T00:00:00Z`, lockAt: "2026-10-04T23:00:00Z" }] });
  workspace.roster.push({ playerId: players[1].id, position: "bench" });
  workspace.lockedAssignments = [{ date: date(6), playerId: players[0].id, slotId: "C#1" }];
  await seedWorkspace(page, workspace);
  const games = [fixtureGame("g-a1", 5, "CAR"), fixtureGame("g-b1", 5, "NJD"), fixtureGame("g-a2", 6, "CAR"), fixtureGame("g-b2", 6, "NJD")];
  const forecasts = games.map((game) => fixtureForecast(game.teamAbbreviation === "CAR" ? players[0].id : players[1].id, game.id, game.teamAbbreviation === "CAR" ? 1 : 10));
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", (route) => route.fulfill({ json: { success: true, data: { players, games, forecasts, evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  const row = page.getByRole("region", { name: "Itinerary" }).getByRole("table").first().getByRole("row", { name: /C#1/ });
  await expect(row.getByRole("cell").nth(0)).toContainText("Alpha Center");
  await expect(row.getByRole("cell").nth(1)).toContainText("Alpha Center");
  await expect(row).not.toContainText("Bravo Center");
});

test("provider refresh proposes repairs while keeping a selected move", async ({ page }) => {
  let reads = 0;
  const authenticatedRequests: string[] = [];
  await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: false } } }));
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`;
  await page.addInitScript((key) => { const session = localStorage.getItem("sb-127-auth-token"); if (session) localStorage.setItem(key, session); }, storageKey);
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace**", (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? "");
    return route.request().method() === "PUT"
      ? route.fulfill({ json: { data: { workspace: route.request().postDataJSON().workspace, snapshot: route.request().postDataJSON().snapshot, version: 1, updatedAt: new Date().toISOString() } } })
      : route.fulfill({ json: { data: null } });
  });
  await page.route("**/api/v1/roster-schedule-optimizer/access", (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? "");
    return route.fulfill({ json: { data: { eligible: true, capabilities: ["rso_sync", "rso_auto_upkeep", "rso_account_save"], grantingSources: ["test"], expiresAt: null, reason: null } } });
  });
  await page.route("**/api/v1/roster-schedule-optimizer/provider", async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? "");
    reads += 1;
    const request = route.request().postDataJSON() as { startDate: string; endDate: string; timeZone: string };
    const snapshot = {
      id: `provider-${reads}`,
      context: { provider: "yahoo", seasonId: 20262027, leagueId: "league", teamId: "team", startDate: request.startDate, endDate: request.endDate, timeZone: request.timeZone, asOf: new Date().toISOString() },
      players: [{ ...player, availability: reads === 1 ? "free_agent" : "rostered" }],
      roster: [], games: [], forecasts: [],
      rules: { lineupMode: "daily", rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: null, periods: [], lineupPeriods: [], scoring: { mode: "points", weights: {}, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "unknown" }, unsupported: [] },
      lockedAssignments: [], realized: {}, opponent: null, evidence: {},
    };
    await route.fulfill({ json: { success: true, snapshot, capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: false, limitations: ["League time zone supplied by the manager; Yahoo did not verify it.", "Available-player discovery did not reach the end of the provider list."] } } });
  });
  await page.goto("/roster-schedule-optimizer");
  await page.getByLabel("Source").selectOption("yahoo");
  await page.getByLabel("Team ID").fill("team");
  const health = page.locator("details").filter({ has: page.getByText("Data health", { exact: true }) });
  await expect(health.locator("summary")).toContainText("2 items to review");
  await expect(health.getByRole("list")).toBeHidden();
  await health.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(health.getByRole("list")).toContainText("Yahoo did not verify it");
  await page.keyboard.press("Enter");
  await page.getByRole("searchbox", { name: "Find candidate" }).fill("Alpha");
  await page.getByRole("button", { name: "Select add" }).click();
  await expect(page.getByText("ADD Alpha Center")).toBeVisible();
  await page.getByRole("button", { name: "Refresh provider" }).click();
  await expect(page.getByText(/no longer verified as available/)).toBeVisible();
  await expect(page.getByText("ADD Alpha Center")).toBeVisible();
  await page.getByRole("button", { name: "Save to account" }).click();
  await expect(page.getByText("Saved to account.")).toBeVisible();
  expect(reads).toBeGreaterThanOrEqual(2);
  expect(authenticatedRequests.length).toBeGreaterThanOrEqual(3);
  expect(authenticatedRequests.every((value) => value.startsWith("Bearer "))).toBe(true);
});

test("shows sequential stream occupants with real games and retains workspace layout when details expand", async ({ page }, testInfo) => {
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", (route) => {
    const start = new URL(route.request().url()).searchParams.get("startDate")!;
    const next = (days: number) => { const date = new Date(`${start}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
    const games = [
      { id: "g1", date: next(1), startsAt: `${next(1)}T23:00:00Z`, teamAbbreviation: "CAR", opponent: "NJD", home: true, status: "scheduled" },
      { id: "g2", date: next(2), startsAt: `${next(2)}T23:00:00Z`, teamAbbreviation: "NJD", opponent: "CAR", home: false, status: "scheduled" },
    ];
    const beta = { ...player, id: "fhfh:2", nhlId: 2, name: "Bravo Center", teamAbbreviation: "NJD" };
    const forecasts = [{ playerId: player.id, gameId: "g1" }, { playerId: beta.id, gameId: "g2" }].map((row) => ({ ...row, stats: { GOALS: 0.4 }, conditioning: "unconditional", startProbability: null, confirmedStart: false, revisionId: "revision", issuedAt: new Date().toISOString(), modelVersion: "test", limitations: [] }));
    return route.fulfill({ json: { success: true, data: { players: [player, beta], games, forecasts, evidence: {} } } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await page.getByRole("textbox", { name: "Paste roster names" }).fill("Alpha Center\nBravo Center");
  await page.getByRole("button", { name: "Review pasted names" }).click();
  await page.getByText("League rules and scoring").click();
  await page.getByLabel("C", { exact: true }).fill("1");
  await expect(page.getByRole("region", { name: "Itinerary" }).getByRole("table").first()).toContainText("Alpha Center");
  await expect(page.getByRole("region", { name: "Itinerary" }).getByRole("table").first()).toContainText("Bravo Center");
  await page.getByRole("button", { name: "Show full suggested lineup" }).click();
  await page.getByText("Scoring, budgets, and lock windows").click({ timeout: 10000 });
  await expectDesktopFrameVisible(page);
  await page.screenshot({ path: testInfo.outputPath("roster-optimizer-1440.png"), fullPage: true });
});


test("dense roster keeps schedule views and their scrollbars inside the desktop frame", async ({ page }, testInfo) => {
  const players = Array.from({ length: 18 }, (_, i) => fixturePlayer(i + 1, `Roster Player ${i + 1}`, "CAR"));
  const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 12, BN: 6 } });
  workspace.context.endDate = "2026-10-11";
  workspace.roster = players.map((player) => ({ playerId: player.id, position: "active" }));
  await seedWorkspace(page, workspace);
  const games = Array.from({ length: 7 }, (_, i) => ({ ...fixtureGame(`g-${i}`, 5, "CAR"), date: `2026-10-${String(i + 5).padStart(2, "0")}`, startsAt: `2026-10-${String(i + 5).padStart(2, "0")}T23:00:00Z` }));
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", (route) => route.fulfill({ json: { success: true, data: { players, games, forecasts: [], evidence: {} } } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  const itinerary = page.getByRole("region", { name: "Itinerary", exact: true });
  await expect(itinerary.getByRole("table")).toContainText("Roster Player 1");
  for (const [width, height] of [[1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await page.getByRole("button", { name: "Streaming itinerary", exact: true }).click();
    await expectDesktopFrameVisible(page);
    await page.screenshot({ path: testInfo.outputPath(`rso-itinerary-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Show full suggested lineup" }).click();
    await expect(itinerary.getByRole("table")).toHaveCount(1);
    await expect(itinerary.getByRole("columnheader", { name: "Player", exact: true })).toBeVisible();
    const nestedVerticalScrolls = await itinerary.evaluate((panel) => Array.from(panel.querySelectorAll("div")).filter((node) => node.scrollHeight > node.clientHeight + 1 && ["auto", "scroll"].includes(getComputedStyle(node).overflowY)).length);
    expect(nestedVerticalScrolls).toBe(1);
    await expectDesktopFrameVisible(page);
    await page.screenshot({ path: testInfo.outputPath(`rso-lineup-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Show full suggested lineup" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("rso-mobile.png"), fullPage: true });
});
