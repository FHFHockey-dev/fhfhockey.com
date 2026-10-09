import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { installDraftProAuthenticatedFixtures } from "./draft-pro-fixtures";
import type { GameForecast, LeagueRules, PlanningPlayer, PlanningSnapshot, PlanningWorkspace } from "../lib/rosterScheduleOptimizer/planningTypes";
import { resolvePlanningContributions } from "../lib/player-forecasts/planningContributions";
import { saveWorkspaceSchema, snapshotSchema } from "../lib/in-season/workspaceSchema";
import { forecastCalendarPolicy } from "../lib/player-forecasts/contributions";

const player = { id: "fhfh:1", nhlId: 1, name: "Alpha Center", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater" as const, availability: "unknown" as const, ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
const date = (day: number) => `2026-10-0${day}`;
const fixturePlayer = (id: number, name: string, team: string): PlanningPlayer => ({ ...player, id: `fhfh:${id}`, nhlId: id, nhlTeamId: [...team].reduce((value, char) => value * 31 + char.charCodeAt(0), 1), rosterRevision: `roster-${id}-${team}`, name, teamAbbreviation: team, eligibilityVerified: true, availability: "manager_available", canDrop: true });
const fixtureGame = (id: string, day: number, team: string): PlanningSnapshot["games"][number] => ({ id, scheduleRevision: `schedule-${id}`, date: date(day), startsAt: `${date(day)}T23:00:00Z`, teamAbbreviation: team, opponent: "NYR", home: true, status: "scheduled" });
const fixtureForecast = (member: PlanningPlayer, game: PlanningSnapshot["games"][number], goals: number): GameForecast => ({
  playerId: member.id, gameId: game.id, stats: { GOALS: goals }, sourceKind: "detailed", sourceWatermark: "fixture-inputs",
  allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, conditioning: "unconditional",
  startProbability: null, confirmedStart: false, revisionId: "fixture", modelVersion: "fixture", limitations: [],
  cutoffAt: "2026-09-26T00:00:00Z", issuedAt: "2026-09-26T00:00:00Z", expiresAt: game.startsAt!,
  issuedContext: { version: "forge-issued-context-v1", playerId: member.id, gameId: game.id, nhlPlayerId: member.nhlId!,
    seasonId: 20262027, teamId: member.nhlTeamId!, scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision!,
    rosterRevision: member.rosterRevision!, observedAt: "2026-09-26T00:00:00Z", scheduleSourceUpdatedAt: null,
    scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] } });
const fixtureRules: LeagueRules = { lineupMode: "daily", rosterSlots: { C: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1, periods: [{ id: "Week", start: "2026-10-05T00:00:00Z", end: "2026-10-09T00:00:00Z", remaining: 2, source: "manager" }], lineupPeriods: [], scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "unknown" }, unsupported: [] };
function fixtureWorkspace(players: PlanningPlayer[], rules: LeagueRules = fixtureRules): PlanningWorkspace {
  return { version: 1, context: { provider: "manual", seasonId: 20262027, leagueId: "manual", teamId: "manual", startDate: date(5), endDate: date(7), timeZone: "UTC", asOf: "2026-09-26T00:00:00Z" }, rules, managerRuleOverrides: {}, roster: [{ playerId: players[0].id, position: "active" }], lockedAssignments: [], intent: { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 10 }, manualPlayers: players, unresolvedNames: [], realized: {}, opponent: null };
}
async function seedWorkspace(page: import("@playwright/test").Page, workspace: PlanningWorkspace) {
  await page.addInitScript((value) => { if (!localStorage.getItem("fhfh:rso:workspace:v1")) localStorage.setItem("fhfh:rso:workspace:v1", JSON.stringify(value)); }, workspace);
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
  await page.clock.setFixedTime(new Date("2026-09-26T00:00:00Z"));
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", (route) => route.fulfill({ json: { success: true, data: { players: [player], games: [], forecasts: [], evidence: {} } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/access", (route) => route.fulfill({ json: { data: { eligible: false, capabilities: [], grantingSources: [], expiresAt: null, reason: "manual" } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace?**", (route) => route.fulfill({ status: 401, json: { error: "unauthorized" } }));
});

test("manual workspace retains reviewed intent, protections and locks through recalculation and reload", async ({ page }) => {
  const members = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")];
  const saved = fixtureWorkspace(members);
  saved.lockedAssignments = [{ date: date(6), playerId: members[0].id, slotId: "C#1" }];
  saved.intent = { ...saved.intent, protectedPlayerIds: [members[0].id], steps: [{
    id: "selected-add", type: "add", playerId: members[1].id, at: `${date(6)}T00:00:00Z`,
    effectiveAt: `${date(6)}T00:00:00Z`, conditional: true, dependsOn: [],
  }] };
  await seedWorkspace(page, saved);
  for (const [width, height] of [[1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/roster-schedule-optimizer");
    await expect(page.getByRole("heading", { name: "Roster Schedule Optimizer" })).toBeVisible();
    if (!(await page.getByRole("button", { name: "Remove Alpha Center" }).isVisible())) {
      await page.getByRole("searchbox", { name: "Find a player" }).fill("Alpha");
      await page.getByRole("button", { name: "Add", exact: true }).click();
    }
    await expect(page.getByRole("button", { name: "Remove Alpha Center" })).toBeVisible();
    await page.getByText("League rules and scoring", { exact: true }).click();
    const confirm = page.getByRole("button", { name: "Confirm planning inputs", exact: true });
    await expect(confirm).toBeEnabled();
    await confirm.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Inputs reviewed for this session. Unknown values still need verification.", { exact: false })).toBeVisible();
    await page.getByRole("combobox", { name: "Lineup mode", exact: true }).selectOption("weekly");
    await expect(page.getByRole("combobox", { name: "Lineup mode", exact: true })).toHaveValue("weekly");
    if (width === 1440) await expect(confirm).toBeEnabled();
    await page.getByText("League rules and scoring", { exact: true }).click();
    const weight = width === 1440 ? 2 : 3;
    await page.getByText("Scoring, budgets, and lock windows", { exact: true }).click();
    await page.getByRole("spinbutton", { name: "Weight", exact: true }).fill(String(weight));
    await expect(page.getByRole("spinbutton", { name: "Weight", exact: true })).toHaveValue(String(weight));
    await page.getByText("Scoring, budgets, and lock windows", { exact: true }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!))).toMatchObject({
      intent: saved.intent, lockedAssignments: saved.lockedAssignments, roster: saved.roster,
      rules: { scoring: { weights: { GOALS: weight } } },
    });
    await expectDesktopFrameVisible(page);
    await page.reload();
    await expect(page.getByRole("button", { name: "Remove Alpha Center" })).toBeVisible();
    await page.getByText("League rules and scoring", { exact: true }).click();
    await expect(confirm).toBeEnabled();
    await page.getByText("League rules and scoring", { exact: true }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!))).toMatchObject({
      intent: saved.intent, lockedAssignments: saved.lockedAssignments, roster: saved.roster,
      rules: { lineupMode: "weekly", scoring: { weights: { GOALS: weight } } },
    });
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

test("readiness controls reach existing inputs across the required viewports", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: {
    success: true, data: { players: [player], games: [fixtureGame("empty-roster-game", 2, "CAR")], forecasts: [], evidence: {} },
  } }));
  for (const [width, height] of [[1180, 757], [1024, 768], [768, 1024], [720, 450], [390, 844], [320, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/roster-schedule-optimizer");
    const readiness = page.locator("details").filter({ has: page.getByText("Planning readiness", { exact: true }) });
    await readiness.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    await expect(readiness).toHaveAttribute("open", "");
    await expect(readiness).toContainText("Add your players to begin schedule analysis.");
    await expect(readiness).toContainText("Acquisition legality, budget or scoring is unresolved.");
    await expect(readiness).toContainText("Awaiting roster and schedule inputs.");
    await expect(readiness).toContainText("Add roster players to assess player-quality coverage.");
    await expect(readiness).not.toContainText("Player-quality assignment evidence available");
    await page.keyboard.press("Tab");
    const rosterAction = page.getByRole("button", { name: "Review roster", exact: true });
    await expect(rosterAction).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("searchbox", { name: "Find a player" })).toBeFocused();
    await page.getByRole("button", { name: "Review rules", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.locator("#rso-rule-settings > summary")).toBeFocused();
    await expect(page.getByText(/Daily mode and roster slots are proposed defaults/)).toBeVisible();
    await page.getByRole("button", { name: "Review coverage", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#rso-matchup-heading")).toBeFocused();
    await page.getByRole("button", { name: "View plan", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.locator("#rso-itinerary-heading")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`readiness-${width}x${height}.png`) });
    await rosterAction.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("searchbox", { name: "Find a player" }).fill("Alpha");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: "Review rules", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#rso-rule-settings > summary")).toBeFocused();
    const confirm = page.getByRole("button", { name: "Confirm planning inputs", exact: true });
    await expect(confirm).toBeVisible();
    await expect(confirm).toBeEnabled();
    await confirm.focus();
    await page.keyboard.press("Space");
    await expect(confirm).toBeDisabled();
    await expect(page.getByText(/Inputs reviewed for this session/)).toBeVisible();
    await expect(readiness).toContainText("Acquisition legality, budget or scoring is unresolved.");
    await expect(page.getByText(/Rule checks passed/)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`input-review-${width}x${height}.png`) });
    await page.evaluate(() => localStorage.removeItem("fhfh:rso:workspace:v1"));
  }
  expect(errors).toEqual([]);
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
  const forecasts = games.map((game, index) => fixtureForecast(players[index], game, index + 1));
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
  await expect(page.getByRole("region", { name: "Itinerary" }).getByText("ADD Bravo Center", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Itinerary" }).getByText("ADD Charlie Center", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Show (lineup analysis|schedule-capacity assignment)/ }).click();
  await page.getByText("League rules and scoring").click();
  await page.getByText("Scoring, budgets, and lock windows", { exact: true }).click();
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
  const forecasts = games.map((game) => fixtureForecast(game.teamAbbreviation === "CAR" ? players[0] : players[1], game, game.teamAbbreviation === "CAR" ? 1 : 10));
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", (route) => route.fulfill({ json: { success: true, data: { players, games, forecasts, evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  const row = page.getByRole("region", { name: "Itinerary" }).getByRole("table").first().getByRole("row", { name: /C#1/ });
  await expect(row.getByRole("cell").nth(0)).toContainText("Alpha Center");
  await expect(row.getByRole("cell").nth(1)).toContainText("Alpha Center");
  await expect(row).not.toContainText("Bravo Center");
});

test("fixture category gains use only startable post-acquisition games on desktop and mobile", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-05T00:00:00Z"));
  const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Drop Center", "BOS"), fixturePlayer(3, "Candidate Center", "NJD")];
  const rules: LeagueRules = { ...fixtureRules, rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "next_day",
    periods: [{ id: "Before reset", start: `${date(5)}T00:00:00Z`, end: `${date(6)}T00:00:00Z`, remaining: 1, source: "manager" },
      { id: "After reset", start: `${date(6)}T00:00:00Z`, end: `${date(8)}T00:00:00Z`, remaining: 0, source: "manager" }],
    scoring: { mode: "categories", weights: {}, categories: [{ key: "GOALS", direction: "higher" }, { key: "SHOTS", direction: "higher" }] } };
  const workspace = fixtureWorkspace(players, rules);
  workspace.context.asOf = `${date(5)}T00:00:00Z`;
  workspace.roster.push({ playerId: players[1].id, position: "bench" });
  workspace.realized = { GOALS: 0, SHOTS: 0 };
  workspace.opponent = { roster: [], realized: { GOALS: 2.5, SHOTS: 10 }, remaining: { GOALS: 0, SHOTS: 0 } };
  workspace.lockedAssignments = [{ date: date(6), playerId: players[0].id, slotId: "C#1" }];
  workspace.intent.protectedPlayerIds = [players[0].id];
  workspace.intent.steps = [{ id: "manager-selected", type: "add", playerId: players[2].id, dropPlayerId: players[1].id,
    at: `${date(5)}T22:00:00Z`, effectiveAt: `${date(6)}T00:00:00Z`, conditional: true, dependsOn: [] }];
  const games = [fixtureGame("a6", 6, "CAR"), fixtureGame("a7", 7, "CAR"), fixtureGame("c5", 5, "NJD"), fixtureGame("c6", 6, "NJD"), fixtureGame("c7", 7, "NJD")];
  const forecasts = games.map(game => {
    const member = players.find(row => row.teamAbbreviation === game.teamAbbreviation)!;
    return { ...fixtureForecast(member, game, 0), stats: game.teamAbbreviation === "CAR" ? { GOALS: 1, SHOTS: 6 }
      : game.date === date(5) ? { GOALS: 99, SHOTS: 99 } : { GOALS: 3, SHOTS: 2 } };
  });
  await seedWorkspace(page, workspace);
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: {
    success: true, data: { players, games, forecasts, evidence: {} },
  } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [width, height] of [[1440, 900], [390, 844], [320, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/roster-schedule-optimizer");
    const itinerary = page.getByRole("region", { name: "Itinerary", exact: true });
    const gains = itinerary.locator("details").filter({ has: page.getByText("Selected plan · category gains", { exact: true }) });
    await gains.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    await expect(gains.getByText("No move 2 → plan 4 · Δ +2")).toBeVisible();
    await expect(gains.getByText("No move 12 → plan 8 · Δ -4")).toBeVisible();
    await expect(gains.getByText("Opponent 2.5 · loss → win")).toBeVisible();
    await expect(gains.getByText("Opponent 10 · win → loss")).toBeVisible();
    await expect(gains).toContainText("not win probabilities");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!))).toMatchObject({
      intent: workspace.intent, lockedAssignments: workspace.lockedAssignments,
    });
    if (width >= 1101) await expectDesktopFrameVisible(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`fixture-category-gains-${width}.png`) });
  }
  expect(errors).toEqual([]);
});

test("provider refresh proposes repairs while keeping a selected move", async ({ page }) => {
  let reads = 0;
  const authenticatedRequests: string[] = [];
  const lockedPlayer = { ...player, id: "fhfh:locked", nhlId: 3, name: "Locked Player" };
  const retained = fixtureWorkspace([player, lockedPlayer]);
  retained.context = { ...retained.context, provider: "yahoo", leagueId: "league", teamId: "team" };
  retained.lockedAssignments = [{ date: date(6), playerId: lockedPlayer.id, slotId: "C#1" }];
  retained.intent.protectedPlayerIds = [player.id];
  await seedWorkspace(page, retained);
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
      players: [{ ...player, availability: reads === 1 ? "free_agent" : "rostered" }, ...(reads === 1 ? [{ ...lockedPlayer, availability: "rostered" }] : [])],
      roster: [{ playerId: reads === 1 ? lockedPlayer.id : player.id, position: "active" }], games: [], forecasts: [],
      rules: { lineupMode: "daily", rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: null, periods: [], lineupPeriods: [], scoring: { mode: "points", weights: {}, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "unknown" }, unsupported: [] },
      lockedAssignments: [], realized: {}, opponent: null, evidence: {},
    };
    await route.fulfill({ json: { success: true, snapshot, capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: false, limitations: ["League time zone supplied by the manager; Yahoo did not verify it.", "Available-player discovery did not reach the end of the provider list."] } } });
  });
  await page.goto("/roster-schedule-optimizer");
  const health = page.locator("details").filter({ has: page.getByText("Data health", { exact: true }) });
  await expect(health.locator("summary")).toContainText("2 items to review");
  await expect(health.getByRole("list")).toBeHidden();
  await health.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(health.getByRole("list")).toContainText("Yahoo did not verify it");
  await page.keyboard.press("Enter");
  await page.getByText("League rules and scoring", { exact: true }).click();
  const confirm = page.locator("#rso-rule-settings").getByText("Confirm planning inputs", { exact: true });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await page.getByText("League rules and scoring", { exact: true }).click();
  await page.getByRole("searchbox", { name: "Find candidate" }).fill("Alpha");
  await page.getByRole("button", { name: "All players", exact: true }).click();
  await page.getByRole("button", { name: "Select add" }).click();
  await expect(page.getByText("ADD Alpha Center")).toBeVisible();
  const selected = await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!).intent);
  await page.getByRole("button", { name: "Refresh provider" }).click();
  await expect(page.getByText(/appears on the actual roster; review whether this selected add is complete/)).toBeVisible();
  await expect(page.getByText("ADD Alpha Center")).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!))).toMatchObject({
    intent: selected, lockedAssignments: retained.lockedAssignments,
    manualPlayers: expect.arrayContaining([expect.objectContaining({ id: lockedPlayer.id, name: "Locked Player", availability: "unknown" })]),
  });
  await page.getByText("League rules and scoring", { exact: true }).click();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await page.getByRole("button", { name: "Save to account" }).click();
  await expect(page.getByText("Saved to account.")).toBeVisible();
  await page.getByRole("button", { name: "View account save" }).click();
  await expect(confirm).toBeDisabled();
  await expect(page.getByText(/Review league rules, scoring, locked assignments and player availability/)).toBeVisible();
  await page.getByRole("button", { name: "Continue manually" }).click();
  await expect(confirm).toBeEnabled();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!))).toMatchObject({
    context: { provider: "manual" }, intent: selected, lockedAssignments: retained.lockedAssignments,
  });
  expect(reads).toBeGreaterThanOrEqual(2);
  expect(authenticatedRequests.length).toBeGreaterThanOrEqual(3);
  expect(authenticatedRequests.every((value) => value.startsWith("Bearer "))).toBe(true);
});

test("connected manager bench locks constrain the worker and preserve provider authority through undo and reload", async ({ page }) => {
  const members = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")];
  const workspace = fixtureWorkspace(members, { ...fixtureRules, rosterSlots: { C: 1, BN: 1 } });
  workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "league", teamId: "team", endDate: date(6) };
  workspace.roster = members.map(member => ({ playerId: member.id, position: "active" }));
  workspace.lockedAssignments = [{ date: date(6), playerId: members[0].id, slotId: null }];
  workspace.intent.protectedPlayerIds = [members[0].id];
  await seedWorkspace(page, workspace);
  await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: false } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: true, capabilities: ["rso_sync", "rso_account_save"], grantingSources: ["test"], expiresAt: null, reason: null } } }));
  let accountSnapshot: PlanningSnapshot | null = null;
  await page.route("**/api/v1/roster-schedule-optimizer/workspace**", route => {
    if (route.request().method() !== "PUT") return route.fulfill({ json: { data: null } });
    const request = saveWorkspaceSchema.parse(route.request().postDataJSON());
    accountSnapshot = request.snapshot!;
    return route.fulfill({ json: { data: { ...request, version: 1, updatedAt: workspace.context.asOf } } });
  });
  const games = [5, 6].flatMap(day => members.map(member => fixtureGame(`${member.id}:${day}`, day, member.teamAbbreviation!)));
  const forecasts = games.map(game => {
    const member = members.find(member => member.teamAbbreviation === game.teamAbbreviation)!;
    return fixtureForecast(member, game, member.id === members[0].id ? 4 : 1);
  });
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts, evidence: {} } } }));
  let providerConflict = false;
  const providerLock = { date: date(6), playerId: members[0].id, slotId: "C#1" };
  await page.route("**/api/v1/roster-schedule-optimizer/provider", route => route.fulfill({ json: { success: true,
    snapshot: { id: providerConflict ? "provider-conflict" : "provider-open", context: workspace.context,
      players: members, roster: workspace.roster, games, forecasts, rules: workspace.rules,
      lockedAssignments: providerConflict ? [providerLock] : [], realized: {}, opponent: null, evidence: {} },
    capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: true, limitations: [] } } }));
  await page.goto("/roster-schedule-optimizer");
  const outcome = page.getByRole("region", { name: "Plan summary" }).locator("article").filter({ has: page.getByText("Projected outcome", { exact: true }) }).locator("strong");
  await expect(outcome).toHaveText("5");
  await page.getByRole("button", { name: "Save to account" }).click();
  await expect(page.getByText("Saved to account.", { exact: true })).toBeVisible();
  expect(accountSnapshot!.lockedAssignments).toEqual([{ ...workspace.lockedAssignments[0], source: "manager" }]);
  await page.getByRole("combobox", { name: "Goalie choice", exact: true }).selectOption("cover");
  providerConflict = true;
  await page.getByRole("button", { name: "Refresh provider" }).click();
  await expect(page.getByText(/provider lock retained and manager choice kept for review/)).toBeVisible();
  await expect(outcome).toHaveText("8");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Goalie choice", exact: true })).toHaveValue("accept_risk");
  await expect(outcome).toHaveText("8");
  await page.getByRole("button", { name: "Save to account" }).click();
  await expect(page.getByText("Saved to account.", { exact: true })).toBeVisible();
  expect(accountSnapshot!.lockedAssignments).toEqual([providerLock]);
  await page.reload();
  await expect(outcome).toHaveText("8");
  await expect(page.getByText(/provider lock retained and manager choice kept for review/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!))).toMatchObject({
    lockedAssignments: workspace.lockedAssignments, intent: { protectedPlayerIds: workspace.intent.protectedPlayerIds, goalieCoverage: "accept_risk" },
  });
});

test("provider refresh adopts the authoritative league timezone and keeps the selected horizon and intent on reload", async ({ page }) => {
  const retained = fixtureWorkspace([player]);
  retained.context = { ...retained.context, provider: "yahoo", leagueId: "league", teamId: "team" };
  retained.roster = [{ playerId: player.id, position: "bench" }];
  retained.intent.protectedPlayerIds = [player.id];
  retained.intent.excludedPlayerIds = ["fhfh:excluded"];
  retained.intent.steps = [{ id: "selected-add", type: "add", playerId: player.id,
    at: `${date(6)}T00:00:00Z`, effectiveAt: `${date(6)}T00:00:00Z`, conditional: true, dependsOn: [] }];
  await seedWorkspace(page, retained);
  await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: false } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace**", route => route.fulfill({ json: { data: null } }));
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: true, capabilities: ["rso_sync"], grantingSources: ["test"], expiresAt: null, reason: null } } }));
  const context = { ...retained.context, timeZone: "America/New_York" };
  const snapshot: PlanningSnapshot = { id: "provider-league-zone", context,
    players: [{ ...player, availability: "rostered" }], roster: [{ playerId: player.id, position: "active" }],
    games: [], forecasts: [], rules: { ...fixtureRules, rosterSlots: { C: 1, BN: 1 } },
    lockedAssignments: [], realized: {}, opponent: null, evidence: {} };
  const requestedZones: string[] = [];
  const dataZones: string[] = [];
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => {
    dataZones.push(new URL(route.request().url()).searchParams.get("timeZone")!);
    return route.fulfill({ json: { success: true, data: { players: [player], games: [], forecasts: [], evidence: {} } } });
  });
  await page.route("**/api/v1/roster-schedule-optimizer/provider", route => {
    requestedZones.push(route.request().postDataJSON().timeZone);
    return route.fulfill({ json: { success: true, snapshot, capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: false, limitations: [] } } });
  });
  await page.goto("/roster-schedule-optimizer");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!))).toMatchObject({
    context, roster: snapshot.roster, rules: snapshot.rules, intent: retained.intent,
  });
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue("America/New_York");
  await expect(page.getByText(/Provider inputs do not match/)).toHaveCount(0);
  await expect.poll(() => requestedZones).toEqual(["UTC", "America/New_York"]);
  await expect.poll(() => dataZones).toContain("America/New_York");
  await page.reload();
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue("America/New_York");
  await expect(page.getByText("ADD Alpha Center", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!))).toMatchObject({
    context, intent: retained.intent,
  });
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
    const forecasts = [{ playerId: player.id, gameId: "g1" }, { playerId: beta.id, gameId: "g2" }].map((row) => ({ ...row, stats: { GOALS: 0.4 }, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, conditioning: "unconditional", startProbability: null, confirmedStart: false, revisionId: "revision", issuedAt: new Date().toISOString(), modelVersion: "test", limitations: [] }));
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
  await page.getByRole("button", { name: /Show (lineup analysis|schedule-capacity assignment)/ }).click();
  await page.getByText("Scoring, budgets, and lock windows", { exact: true }).click({ timeout: 10000 });
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
    await page.getByRole("button", { name: /Show (lineup analysis|schedule-capacity assignment)/ }).click();
    await expect(itinerary.getByRole("table")).toHaveCount(1);
    await expect(itinerary.getByRole("columnheader", { name: "Player", exact: true })).toBeVisible();
    const nestedVerticalScrolls = await itinerary.evaluate((panel) => Array.from(panel.querySelectorAll("div")).filter((node) => node.scrollHeight > node.clientHeight + 1 && ["auto", "scroll"].includes(getComputedStyle(node).overflowY)).length);
    expect(nestedVerticalScrolls).toBe(1);
    await expectDesktopFrameVisible(page);
    await page.screenshot({ path: testInfo.outputPath(`rso-lineup-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: /Show (lineup analysis|schedule-capacity assignment)/ })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("rso-mobile.png"), fullPage: true });
});

test("Yahoo timeout retains schedule analysis and matchup-week navigation without actionable acquisitions", async ({ page }, testInfo) => {
  await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: false } } }));
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`;
  await page.addInitScript((key) => { const session = localStorage.getItem("sb-127-auth-token"); if (session) localStorage.setItem(key, session); }, storageKey);
  await page.route("**/rest/v1/**", route => route.fulfill({ json: [] }));
  const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")];
  const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 2 }, acquisitionTiming: "unknown", acquisitionCost: null, periods: [] });
  workspace.context = { ...workspace.context, provider: "yahoo", teamId: "team", leagueId: "league", startDate: "2026-10-05", endDate: "2026-10-11" };
  await seedWorkspace(page, workspace);
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: true, capabilities: ["rso_sync"], grantingSources: ["test"] } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/provider", route => route.fulfill({ status: 502, json: { success: false, error: "Yahoo roster/settings reads timed out after retrying." } }));
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => {
    const start = new URL(route.request().url()).searchParams.get("startDate")!;
    const games = players.map(player => ({ ...fixtureGame(player.id, 5, player.teamAbbreviation!), date: start, startsAt: `${start}T23:00:00Z` }));
    return route.fulfill({ json: { success: true, data: { players, games, forecasts: [], evidence: {}, matchupWeeks: [{ gameKey: "477", week: 1, startDate: "2026-09-29", endDate: "2026-10-04" }, { gameKey: "477", week: 2, startDate: "2026-10-05", endDate: "2026-10-11" }] } } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await expect(page.getByText("Yahoo roster/settings reads timed out after retrying.")).toBeVisible();
  await expect(page.getByText(/Using retained roster inputs/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Itinerary", exact: true }).getByRole("table")).toContainText("Alpha Center");
  await page.getByRole("button", { name: "All players", exact: true }).click();
  await expect(page.getByRole("region", { name: "Candidate browser" })).toContainText("+AGP 1");
  await expect(page.getByText(/Add\/drop plans need acquisition-effective timing/).first()).toBeVisible();
  await page.getByRole("button", { name: "Previous matchup week" }).click();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-09-29");
  await expect(page.getByLabel("Through", { exact: true })).toHaveValue("2026-10-04");
  await expect(page.getByRole("region", { name: "Itinerary", exact: true }).getByRole("table")).toContainText("Alpha Center");
  await page.getByRole("button", { name: "Next matchup week" }).click();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-10-05");
  await expect(page.getByRole("region", { name: "Itinerary", exact: true }).getByRole("table")).toContainText("Alpha Center");
  await page.getByRole("button", { name: "All players", exact: true }).click();
  await expect(page.getByRole("region", { name: "Candidate browser" })).toContainText("+AGP 1");
  await expectDesktopFrameVisible(page);
  await page.screenshot({ path: testInfo.outputPath("rso-timeout-schedule.png"), fullPage: true });
});


test("mixed Kaprizov coverage stays unresolved until complete evidence supports the bench decision", async ({ page }) => {
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
    ? route.fallback() : route.abort());
  const players = [
    { ...fixturePlayer(1, "Kirill Kaprizov", "MIN"), eligiblePositions: ["LW"] },
    { ...fixturePlayer(2, "Matthew Knies", "TOR"), eligiblePositions: ["LW"] },
    { ...fixturePlayer(3, "Drake Batherson", "OTT"), eligiblePositions: ["RW"] },
  ];
  const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { LW: 1, RW: 1, BN: 1 } });
  workspace.roster = players.map(player => ({ playerId: player.id, position: "bench" }));
  const games = players.map((player, index) => fixtureGame(`game-${index}`, 5, player.teamAbbreviation!));
  let fullCoverage = false;
  await seedWorkspace(page, workspace);
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts: fullCoverage ? players.map((player, index) => fixtureForecast(player, games[index], [9, 4, 5][index]))
      : [fixtureForecast(players[1], games[1], 2), fixtureForecast(players[2], games[2], 3)], evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  await expect(page.getByRole("button", { name: "Show schedule-capacity assignment" })).toBeVisible();
  await page.getByRole("button", { name: "Show schedule-capacity assignment" }).click();
  await expect(page.getByRole("status").filter({ hasText: "This assignment shows legal schedule capacity" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show lineup analysis" })).toHaveCount(0);
  fullCoverage = true;
  for (const [width, height] of [[1180, 757], [1024, 768], [768, 1024], [390, 844], [320, 844]]) {
    await page.setViewportSize({ width, height });
    await page.reload();
    await page.getByRole("button", { name: "Show lineup analysis" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Lineup analysis uses proposed or saved inputs" })).toBeVisible();
    await expect(page.getByText(/Suggested assignment uses reviewed inputs/)).toHaveCount(0);
    const readiness = page.locator("details").filter({ has: page.getByText("Planning readiness", { exact: true }) });
    await readiness.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Review rules", exact: true }).click();
    await page.getByRole("button", { name: "Confirm planning inputs", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "View plan", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Suggested assignment uses reviewed inputs" })).toBeVisible();
    await page.getByText("Why players are outside this assignment", { exact: true }).click();
    const bench = page.getByRole("article", { name: "Matthew Knies bench decision" });
    await expect(bench).toContainText("Complete-plan start/sit score: selected 14; with Matthew Knies 9");
    await expect(bench).toContainText("LW#1: Kirill Kaprizov → Matthew Knies");
    await expect(bench).toContainText("detailed game estimate");
    await expect(bench).toContainText("not an approved projected total or acquisition comparison");
    await expect(page.getByRole("article", { name: "Kirill Kaprizov bench decision" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});


test("weekly LW/RW and UTIL bench explanations preserve midpoint locks through worker reload", async ({ page }) => {
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
    ? route.fallback() : route.abort());
  const players = [
    { ...fixturePlayer(1, "Kirill Kaprizov", "MIN"), eligiblePositions: ["LW"] },
    { ...fixturePlayer(2, "Matthew Knies", "TOR"), eligiblePositions: ["LW", "RW"] },
    { ...fixturePlayer(3, "Drake Batherson", "OTT"), eligiblePositions: ["RW"] },
    fixturePlayer(4, "Locked Center", "CAR"),
  ];
  const workspace = fixtureWorkspace(players, { ...fixtureRules, lineupMode: "weekly",
    rosterSlots: { LW: 1, RW: 1, UTIL: 1, BN: 1 }, lineupPeriods: [{ id: "week",
      start: "2026-10-05T00:00:00Z", end: "2026-10-07T00:00:00Z", lockAt: "2026-10-05T00:00:00Z" }] });
  workspace.context.endDate = "2026-10-06";
  workspace.roster = players.map(player => ({ playerId: player.id, position: "bench" }));
  workspace.lockedAssignments = [{ date: "2026-10-06", playerId: players[3].id, slotId: "UTIL#1" }];
  const games = [5, 6].flatMap(day => players.map((player, index) => fixtureGame(`game-${day}-${index}`, day, player.teamAbbreviation!)));
  const forecasts = games.map(game => {
    const index = players.findIndex(player => player.teamAbbreviation === game.teamAbbreviation);
    return fixtureForecast(players[index], game, [9, 10, 7, 8][index]);
  });
  await seedWorkspace(page, workspace);
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts, evidence: {} } } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/roster-schedule-optimizer");
  for (let pass = 0; pass < 2; pass++) {
    await page.getByRole("button", { name: "Show lineup analysis" }).click();
    await page.getByText("Why players are outside this assignment", { exact: true }).click();
    const bench = page.getByRole("article", { name: "Drake Batherson bench decision" });
    await expect(bench).toContainText("Weekly placement window: Oct 5–Oct 6");
    await expect(bench).toContainText("Complete-plan start/sit score: selected 54; with Drake Batherson 50");
    await expect(bench).toContainText("LW#1: Kirill Kaprizov → Matthew Knies");
    await expect(bench).toContainText("RW#1: Matthew Knies → Drake Batherson");
    await expect(bench.getByRole("list", { name: "Changed assignments" })).not.toContainText("UTIL#1");
    const center = page.getByRole("region", { name: "Itinerary" }).getByRole("row").filter({ hasText: "Locked Center" });
    await expect(center).toContainText("UTIL#1");
    if (pass === 0) await page.reload();
  }
  expect(errors).toEqual([]);
});

test("manual league eligibility must be confirmed and survives a reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")]
    .map(player => ({ ...player, eligibilityVerified: undefined }));
  const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 1, BN: 1 } });
  workspace.roster.push({ playerId: players[1].id, position: "bench" });
  const games = [fixtureGame("alpha", 5, "CAR"), fixtureGame("bravo", 5, "NJD")];
  await seedWorkspace(page, workspace);
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts: games.map((game, index) => fixtureForecast(players[index], game, index ? 1 : 9)), evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  await expect(page.getByRole("button", { name: "Show schedule-capacity assignment" })).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
  const reviews = page.getByText("Review evidence", { exact: true });
  for (let index = 0; index < 2; index++) {
    await reviews.nth(index).click();
    await page.getByRole("checkbox", { name: "Manager confirms league positions" }).nth(index).check();
    if (!index) await expect(page.getByRole("button", { name: "Show schedule-capacity assignment" })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Show lineup analysis" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Itinerary" }).getByRole("table").first()).toContainText("Alpha Center");
  await page.reload();
  await expect(page.getByRole("button", { name: "Show lineup analysis" })).toBeVisible();
  const retained = await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!).manualPlayers);
  expect(retained.every((player: PlanningPlayer) => player.eligibilityVerified === true)).toBe(true);
  expect(errors).toEqual([]);
});

test("goalie competition stays unresolved across the worker and evidence view", async ({ page }) => {
  const players: PlanningPlayer[] = [7, 8].map(id => ({ ...fixturePlayer(id, `Goalie ${id}`, "CAR"),
    playerClass: "goalie", eligiblePositions: ["G"], availability: id === 7 ? "manager_available" : "unknown" }));
  const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { G: 1 },
    scoring: { mode: "points", weights: { SAVES_GOALIE: 1 }, categories: [] },
    goalieMinimum: { required: 1, credited: 0, counts: "starts", penalty: "none" } });
  const games = [fixtureGame("goalie-first", 5, "CAR"), fixtureGame("goalie-second", 6, "CAR")];
  let probability = 0.8;
  await seedWorkspace(page, workspace);
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts: players.map(member => ({ ...fixtureForecast(member, games[0], 0),
      stats: { SAVES_GOALIE: 20 }, startProbability: probability })), evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  await expect(page.getByRole("button", { name: "Show schedule-capacity assignment" })).toBeVisible();
  const outcome = page.getByRole("region", { name: "Plan summary" }).locator("article").filter({ hasText: "Projected outcome" }).locator("strong");
  await expect(outcome).toHaveText("—");
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  await expect(page.getByText(/Starter evidence is incompatible/)).toContainText("projected starts unknown");
  await expect(page.getByText(/Starter evidence is incompatible/)).toContainText("0 confirmed starts");
  await page.reload();
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  await expect(page.getByText(/Starter evidence is incompatible/)).toBeVisible();
  probability = 0.4;
  await page.reload();
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  await expect(page.getByText(/0.4 projected across 1\/2 evidenced games/)).toBeVisible();
  await expect(page.getByText(/Starter evidence is incompatible/)).toHaveCount(0);
});

for (const mode of ["assignment-only", "totals-only", "legacy", "unproven-lineage"] as const) {
  test(`${mode} forecasts ${mode === "unproven-lineage" ? "cannot certify readiness" : "preserve their allowed uses"} in the browser`, async ({ page }) => {
    const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")];
    const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 1, BN: 1 } });
    workspace.roster.push({ playerId: players[1].id, position: "bench" });
    const games = [fixtureGame("alpha", 5, "CAR"), fixtureGame("bravo", 5, "NJD")];
    const forecasts = games.map((game, index) => ({ ...fixtureForecast(players[index], game, index ? 9 : 1),
      allowedUses: mode === "legacy" ? undefined : mode === "unproven-lineage"
        ? { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }
        : { assignment: mode === "assignment-only", totals: mode === "totals-only", comparison: false, conditionalTieBreak: false },
      ...(mode === "unproven-lineage" ? { sourceKind: undefined, issuedContext: undefined,
        sourceWatermark: undefined, cutoffAt: undefined, expiresAt: undefined } : {}) }));
    await seedWorkspace(page, workspace);
    await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true,
      data: { players, games, forecasts, evidence: {} } } }));
    await page.goto("/roster-schedule-optimizer");
    await expect(page.getByRole("button", { name: mode === "assignment-only" ? "Show lineup analysis" : "Show schedule-capacity assignment" })).toBeVisible();
    const outcome = page.getByRole("region", { name: "Plan summary" }).locator("article").filter({ hasText: "Projected outcome" }).locator("strong");
    await expect(outcome).toHaveText("—");
    if (mode === "assignment-only") await expect(page.getByRole("region", { name: "Itinerary" }).getByRole("table").first()).toContainText("Bravo Center");
    await page.getByRole("button", { name: "Matchup", exact: true }).click();
    await expect(page.getByText(/Full comparison unavailable/)).toBeVisible();
    await page.getByText(/Forecast coverage ·/).click();
    await expect(page.getByText(/0\/2 comparison targets/)).toBeVisible();
    if (mode === "totals-only") await expect(page.getByText(/2\/2 totals targets/)).toBeVisible();
    const reason = mode === "unproven-lineage" ? "identity conflict" : "use not approved";
    await expect(page.getByText(new RegExp(`Alpha Center · game alpha · GOALS: ${reason}`))).toBeVisible();
    if (mode === "unproven-lineage") {
      await page.reload();
      await expect(page.getByRole("button", { name: "Show schedule-capacity assignment" })).toBeVisible();
      await expect(outcome).toHaveText("—");
    }
  });
}

test("connected refresh and account save preserve forecast permissions and exclusions", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1180, height: 757 });
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: false } } }));
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`;
  await page.addInitScript((key) => { const session = localStorage.getItem("sb-127-auth-token"); if (session) localStorage.setItem(key, session); }, storageKey);
  await page.route("**/rest/v1/**", route => route.fulfill({ json: [] }));
  const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")];
  const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 1, BN: 1 } });
  workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "league", teamId: "team" };
  workspace.roster.push({ playerId: players[1].id, position: "bench" });
  const games = [fixtureGame("alpha", 5, "CAR"), fixtureGame("bravo", 5, "NJD")];
  let refreshed = false;
  let switching = false;
  let releaseProvider!: () => void;
  let releaseSave!: () => void;
  let releaseAccess!: () => void;
  const heldProvider = new Promise<void>(resolve => { releaseProvider = resolve; });
  const heldSave = new Promise<void>(resolve => { releaseSave = resolve; });
  const heldAccess = new Promise<void>(resolve => { releaseAccess = resolve; });
  const secondUser = "00000000-0000-4000-8000-000000000002";
  const accountReads: string[] = [];
  const requestUser = (authorization: string | undefined) => authorization
    ? JSON.parse(Buffer.from(authorization.split(".")[1], "base64url").toString()).sub as string : null;
  let saved: import("../lib/rosterScheduleOptimizer/planningTypes").PlanningSnapshot | null = null;
  await seedWorkspace(page, workspace);
  await page.route("**/api/v1/roster-schedule-optimizer/access", async route => {
    const nextAccount = requestUser(route.request().headers().authorization) === secondUser;
    if (nextAccount) await heldAccess;
    return route.fulfill({ json: { data: { eligible: !nextAccount, capabilities: nextAccount ? [] : ["rso_sync", "rso_account_save"], grantingSources: ["test"], expiresAt: null, reason: null } } });
  });
  await page.route("**/api/v1/roster-schedule-optimizer/workspace**", async route => {
    if (route.request().method() !== "PUT") {
      accountReads.push(requestUser(route.request().headers().authorization) ?? "signed-out");
      return route.fulfill({ json: { data: null } });
    }
    const request = route.request().postDataJSON();
    saved = request.snapshot;
    if (switching) await heldSave;
    return route.fulfill({ json: { data: { ...request, version: 1, updatedAt: new Date().toISOString() } } });
  });
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true,
    data: { players: players.map(player => ({ ...player, eligibilityVerified: false })), games, forecasts: [], evidence: {} } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/provider", async route => {
    const late = switching;
    if (late) await heldProvider;
    const allowedUses = { assignment: !refreshed, totals: refreshed, comparison: false, conditionalTieBreak: false };
    return route.fulfill({ json: { success: true, snapshot: { id: refreshed ? "provider-new" : "provider-old",
      context: workspace.context, players: late ? players.map(player => ({ ...player, name: `Late First Account ${player.name}` })) : players, roster: workspace.roster, games,
      forecasts: games.map((game, index) => ({ ...fixtureForecast(players[index], game, index ? 9 : 1), allowedUses })),
      rules: workspace.rules, lockedAssignments: [], realized: {}, opponent: null, evidence: {},
      forecastManifest: { version: "planning-forecasts-v1", id: refreshed ? "new" : "old", seasonId: 20262027,
        asOf: workspace.context.asOf, scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: ["fixture"],
        baselineChecksum: null, requiredOpportunities: 2, forecastedOpportunities: 2, exclusionCounts: { use_not_approved: 2 },
        exclusions: games.map((game, index) => ({ gameId: game.id, playerId: players[index].id, targetKey: "GOALS", reasons: ["use_not_approved"] })) } },
      capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: true, limitations: [] } } });
  });
  await page.goto("/roster-schedule-optimizer");
  await expect(page.getByRole("button", { name: "Show lineup analysis" })).toBeVisible();
  refreshed = true;
  await page.getByRole("button", { name: "Refresh provider" }).click();
  await expect(page.getByRole("button", { name: "Show schedule-capacity assignment" })).toBeVisible();
  await page.getByRole("button", { name: "Save to account" }).click();
  await expect(page.getByText("Saved to account.")).toBeVisible();
  expect(saved).toMatchObject({ forecastManifest: { id: "new", exclusions: [
    { gameId: "alpha", reasons: ["use_not_approved"] }, { gameId: "bravo", reasons: ["use_not_approved"] }] },
    forecasts: [{ allowedUses: { assignment: false, totals: true, comparison: false } },
      { allowedUses: { assignment: false, totals: true, comparison: false } }] });
  const beforeSwitch = await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!));
  switching = true;
  const providerRequest = page.waitForRequest("**/api/v1/roster-schedule-optimizer/provider");
  await page.getByRole("button", { name: "Refresh provider" }).click();
  const pendingProviderRequest = await providerRequest;
  const saveRequest = page.waitForRequest(request => request.url().endsWith("/workspace") && request.method() === "PUT");
  await page.getByRole("button", { name: "Save to account" }).click();
  const pendingSaveRequest = await saveRequest;
  const canceledProvider = page.waitForEvent("requestfailed", { predicate: request => request === pendingProviderRequest });
  await page.evaluate(({ key, userId }) => {
    const session = JSON.parse(localStorage.getItem(key)!);
    const payload = JSON.parse(atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    payload.sub = userId;
    session.access_token = `${session.access_token.split(".")[0]}.${btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}.fixture`;
    session.user = { ...session.user, id: userId, email: "second-rso-fixture@example.test" };
    localStorage.setItem(key, JSON.stringify(session));
    const channel = new BroadcastChannel(key);
    channel.postMessage({ event: "SIGNED_IN", session });
    channel.close();
  }, { key: storageKey, userId: secondUser });
  await expect.poll(() => accountReads.includes(secondUser)).toBe(true);
  await expect(page.getByRole("button", { name: "Refresh provider" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save to account" })).toHaveCount(0);
  expect((await canceledProvider).failure()?.errorText).toContain("ERR_ABORTED");
  const completedSave = page.waitForResponse(response => response.request() === pendingSaveRequest);
  releaseProvider(); releaseSave();
  await (await completedSave).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByText("Saved to account.")).toHaveCount(0);
  await expect(page.getByText(/Late First Account/)).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!);
    return { intent: value.intent, roster: value.roster, lockedAssignments: value.lockedAssignments };
  })).toEqual({ intent: beforeSwitch.intent, roster: beforeSwitch.roster, lockedAssignments: beforeSwitch.lockedAssignments });
  const setup = page.locator('fieldset[aria-label="Planning setup"]');
  const rosterPanel = page.locator('section[aria-label="Roster and setup"]');
  await expect(setup).toHaveAttribute("disabled", "");
  await expect(setup.getByRole("combobox", { name: "Source", exact: true })).toBeDisabled();
  await expect.poll(() => rosterPanel.evaluate(panel => (panel as HTMLElement).inert)).toBe(true);
  releaseAccess();
  await page.screenshot({ path: testInfo.outputPath("rso-switched-account.png") });
  await page.getByRole("button", { name: "Continue manually" }).click();
  await expect(setup).not.toHaveAttribute("disabled", "");
  await expect(setup.getByRole("combobox", { name: "Source", exact: true })).toBeEnabled();
  await expect(rosterPanel).not.toHaveAttribute("inert", "true");
  await expect.poll(async () => page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!);
    return { provider: value.context.provider, intent: value.intent, roster: value.roster, lockedAssignments: value.lockedAssignments };
  })).toEqual({ provider: "manual", intent: beforeSwitch.intent, roster: beforeSwitch.roster, lockedAssignments: beforeSwitch.lockedAssignments });
  await rosterPanel.getByRole("checkbox", { name: "Protect", exact: true }).first().check();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!).intent.protectedPlayerIds)).toEqual([players[0].id]);
  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("rso-manual-fork-editing.png") });
  await writeFile(testInfo.outputPath("rso-account-switch-browser.json"), JSON.stringify({ viewport: { width: 1180, height: 757 },
    accountReads, providerCanceled: true, staleSaveHidden: true, staleProviderHidden: true, localIntentPreserved: true,
    retainedInputsReadOnly: true, manualForkPreserved: true, manualEditingAvailable: true,
    pageErrors, inputs: "Fictional sessions and intercepted provider/workspace/access responses; SDK BroadcastChannel session switch", liveAccountParity: "not verified" }, null, 2));
});

test("conflicting forecasts keep capacity planning and show the affected target", async ({ page }, testInfo) => {
  const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")];
  const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 1, BN: 1 } });
  workspace.roster.push({ playerId: players[1].id, position: "bench" });
  const games = [fixtureGame("alpha", 5, "CAR"), fixtureGame("bravo", 5, "NJD")];
  const forecasts = games.map((game, index) => fixtureForecast(players[index], game, index ? 1 : 9));
  forecasts.push({ ...forecasts[0], revisionId: "conflict", stats: { GOALS: 3 } });
  await seedWorkspace(page, workspace);
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts, evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  await expect(page.getByRole("button", { name: "Show schedule-capacity assignment" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Itinerary" }).getByRole("table").first()).toContainText(/Alpha Center|Bravo Center/);
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  await page.getByText(/Forecast coverage ·/).click();
  await expect(page.getByText(/Alpha Center · game alpha · GOALS: conflicting forecast/)).toBeVisible();
  await expect(page.getByText(/Full comparison unavailable/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("forecast-conflict.png"), fullPage: true });
});

test("points goalie coverage survives worker reload and benches harmful starts once credited", async ({ page }) => {
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
    ? route.fallback() : route.abort());
  await page.clock.setFixedTime("2026-10-05T00:00:00Z");
  const players = [fixturePlayer(1, "Coverage Goalie", "CAR"), fixturePlayer(2, "Lower Penalty Goalie", "NJD")]
    .map(row => ({ ...row, playerClass: "goalie" as const, eligiblePositions: ["G"] }));
  const games = players.map((row, index) => fixtureGame(String(30 + index), 5, row.teamAbbreviation!));
  const forecasts: GameForecast[] = players.map((row, index) => ({ ...fixtureForecast(row, games[index], 0),
    stats: { GOALS_AGAINST_GOALIE: index ? 0.5 : 1 }, startProbability: index ? 0.25 : 1, confirmedStart: index === 0 }));
  const rules: LeagueRules = { ...fixtureRules, rosterSlots: { G: 1, BN: 1 },
    scoring: { mode: "points", weights: { GOALS_AGAINST_GOALIE: -1 }, categories: [] },
    goalieMinimum: { required: 1, credited: 0, counts: "starts", penalty: "none", periodStart: "2026-10-05", periodEnd: "2026-10-06" } };
  const workspace = fixtureWorkspace(players, rules);
  workspace.context = { ...workspace.context, endDate: "2026-10-05", asOf: "2026-10-05T00:00:00Z" };
  workspace.roster.push({ playerId: players[1].id, position: "bench" });
  workspace.intent.goalieCoverage = "cover";
  workspace.realized = { GOALS_AGAINST_GOALIE: 0 };
  await seedWorkspace(page, workspace);
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts, evidence: {} } } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/roster-schedule-optimizer");
  const itinerary = page.getByRole("region", { name: "Itinerary" });
  const minimum = page.getByRole("region", { name: "Plan summary" }).getByRole("article").filter({
    has: page.getByText("Goalie minimum", { exact: true }) });
  const expectCoverage = async () => {
    await page.getByRole("button", { name: "Show lineup analysis" }).click();
    await expect(itinerary).toContainText("G#1 · Coverage Goalie");
    const explanation = itinerary.locator("details").filter({ has: page.getByText("Why players are outside this assignment", { exact: true }) });
    if (!await explanation.evaluate(node => (node as HTMLDetailsElement).open)) await explanation.locator("summary").click();
    const bench = explanation.getByRole("article", { name: "Lower Penalty Goalie bench decision" });
    await expect(bench).toContainText("favors projected goalie coverage");
    await expect(bench).toContainText("selected -1; with Lower Penalty Goalie -0.5");
    await expect(bench).toContainText("selected 1; with Lower Penalty Goalie 0.25");
    await expect(bench).toContainText("Expected starts or appearances do not establish a satisfied minimum");
    await expect(minimum).toContainText("0 / 1");
    await expect(minimum).toContainText("Not yet satisfied by credited results");
  };
  await expectCoverage();
  await page.reload();
  await expectCoverage();
  await page.getByText("League rules and scoring", { exact: true }).click();
  await page.getByLabel("Goalie credited", { exact: true }).fill("1");
  await expect(minimum).toContainText("Satisfied by credited results");
  await expect(itinerary).not.toContainText("G#1 · Coverage Goalie");
  await expect(itinerary).toContainText("Benching this appearance avoids a negative scoring contribution");
  expect(errors).toEqual([]);
});

for (const mode of ["manual", "connected"] as const) {
test(`retained blended inputs survive worker reload and expire borrowed participation (${mode})`, async ({ page }) => {
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
    ? route.fallback() : route.abort());
  const now = "2026-09-29T00:00:00Z";
  await page.clock.setFixedTime(now);
  const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "CAR")]
    .map((row, index) => ({ ...row, id: String(index + 1), nhlTeamId: 12, rosterRevision: "roster" }));
  const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 1, BN: 1 } });
  workspace.context = { ...workspace.context, provider: mode === "connected" ? "yahoo" : "manual",
    leagueId: mode === "connected" ? "league" : "manual", teamId: mode === "connected" ? "team" : "manual",
    startDate: "2026-10-08", endDate: "2026-10-08", asOf: now };
  workspace.roster.push({ playerId: players[1].id, position: "bench" });
  const games: PlanningSnapshot["games"] = [{ ...fixtureGame("30", 8, "CAR"), status: "scheduled", scheduleRevision: "schedule" }];
  const allowedUses = { assignment: true, totals: true, comparison: true, conditionalTieBreak: true };
  const forecasts: GameForecast[] = players.map((row, index) => ({ ...fixtureForecast(row, games[0], index ? 1 : 4),
    conditioning: "unconditional", sourceKind: "detailed", sourceWatermark: "captured-reads", allowedUses, conditionalStats: { GOALS: index ? 2 : 8 },
    appearanceProbability: 0.5, revisionId: `detail-${row.id}`, cutoffAt: "2026-09-28T00:00:00Z",
    issuedAt: "2026-09-28T01:00:00Z", expiresAt: index ? "2026-10-09T00:00:00Z" : "2026-09-30T00:00:00Z",
    issuedContext: { version: "forge-issued-context-v1", playerId: row.id, gameId: "30", nhlPlayerId: row.nhlId!,
      seasonId: 20262027, teamId: 12, scheduledAt: games[0].startsAt!, scheduleRevision: "schedule",
      rosterRevision: "roster", observedAt: "2026-09-28T00:00:00Z", scheduleSourceUpdatedAt: null,
      scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] } }));
  const retained = JSON.parse(JSON.stringify(resolvePlanningContributions({ id: "retained", context: workspace.context,
    players, games, forecasts, roster: workspace.roster, rules: workspace.rules, lockedAssignments: [],
    realized: {}, opponent: null, evidence: {}, baselineSources: [{ kind: "baseline", sourceId: "alpha-rate",
      policyVersion: "rates-v1", released: true, allowedUses, playerId: 1, nhlPlayerId: 1, seasonId: 20262027,
      teamId: 12, targetKey: "GOALS", unit: "count", basis: "per_appearance", mean: 2, participationIntegrated: false,
      cutoffAt: "2026-09-26T00:00:00Z", issuedAt: "2026-09-27T01:00:00Z", expiresAt: "2026-10-09T00:00:00Z",
      sourceWatermark: "input", scheduleRevision: "schedule", rosterRevision: "roster" }] }))) as PlanningSnapshot;
  expect(retained.forecasts[0].contributions?.GOALS.sourceKind).toBe("blended");
  let responseAsOf = now;
  let refreshedRates: PlanningSnapshot["baselineSources"];
  let forecastManifest: NonNullable<PlanningSnapshot["forecastManifest"]> = {
    version: "planning-forecasts-v1", id: "policy-14", calendarPolicy: forecastCalendarPolicy(14),
    seasonId: 20262027, asOf: now, scheduleRevision: "schedule", rosterRevision: "roster",
    issuedRevisionIds: forecasts.map(row => row.revisionId), baselineChecksum: "rates",
    requiredOpportunities: 2, forecastedOpportunities: 2, exclusionCounts: {} };
  let saved: { snapshot: PlanningSnapshot; workspace: PlanningWorkspace; version: number; updatedAt: string } | null = null;
  if (mode === "connected") {
    await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: false } } }));
    const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`;
    await page.addInitScript(key => { const session = localStorage.getItem("sb-127-auth-token"); if (session) localStorage.setItem(key, session); }, storageKey);
    await page.route("**/rest/v1/**", route => route.fulfill({ json: [] }));
    await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: {
      eligible: true, capabilities: ["rso_sync", "rso_account_save"], grantingSources: ["test"], expiresAt: null, reason: null } } }));
    await page.route("**/api/v1/roster-schedule-optimizer/provider", route => route.fulfill({ json: { success: true,
      snapshot: { ...retained, baselineSources: refreshedRates, forecastManifest,
        id: `retained-${responseAsOf}`, context: { ...retained.context, asOf: responseAsOf } },
      capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: true, limitations: [] } } }));
    await page.route("**/api/v1/roster-schedule-optimizer/workspace**", route => {
      if (route.request().method() === "PUT") {
        const request = route.request().postDataJSON();
        expect(snapshotSchema.safeParse(request.snapshot).success).toBe(true);
        saved = { workspace: request.workspace, snapshot: request.snapshot, version: 1, updatedAt: responseAsOf };
      }
      return route.fulfill({ json: { data: saved } });
    });
  }

  await seedWorkspace(page, workspace);
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts: retained.forecasts, baselineSources: refreshedRates, forecastManifest, evidence: {} } } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/roster-schedule-optimizer");
  const projected = page.getByRole("region", { name: "Plan summary" }).getByRole("article").filter({
    has: page.getByText("Projected outcome", { exact: true }) });
  await expect(page.getByRole("button", { name: "Show lineup analysis" })).toBeVisible();
  await expect(projected).toContainText("3.1");
  await expect(projected).toContainText("Includes baseline estimates");
  const expectBenchExplanation = async () => {
    await page.getByRole("button", { name: "Show lineup analysis" }).click();
    const explanation = page.getByRole("region", { name: "Itinerary" }).locator("details").filter({
      has: page.getByText("Why players are outside this assignment", { exact: true }) });
    if (!await explanation.evaluate(node => (node as HTMLDetailsElement).open)) await explanation.locator("summary").click();
    const bench = explanation.getByRole("article", { name: "Bravo Center bench decision" });
    await expect(bench).toContainText("Complete-plan start/sit score: selected 3.143; with Bravo Center 1");
    await expect(bench).toContainText("C#1: Alpha Center → Bravo Center");
    await expect(bench).toContainText("blended detailed/baseline estimate");
    await expect(bench).toContainText("Appearance assumption: 50%");
    await expect(bench).toContainText("not an approved projected total or acquisition comparison");
  };
  await expectBenchExplanation();
  if (mode === "connected") {
    await page.getByRole("button", { name: "Save to account" }).click();
    await expect(page.getByText("Saved to account.")).toBeVisible();
    expect(saved).toMatchObject({ snapshot: { forecasts: [{ sourceWatermark: "captured-reads",
      contributions: { GOALS: { sourceKind: "blended", inputs: { detailed: { sourceWatermark: "captured-reads" } } } } }, {}] } });
    await page.getByRole("button", { name: "View account save" }).click();
    await expect(projected).toContainText("3.1");
    await expectBenchExplanation();
  }

  await expect(page.getByRole("region", { name: "Itinerary" }).getByRole("table").first()).toContainText("Alpha Center");
  await page.reload();
  await expect(page.getByRole("button", { name: "Show lineup analysis" })).toBeVisible();
  await expect(projected).toContainText("3.1");
  await expectBenchExplanation();
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  const sources = page.getByRole("region", { name: "Matchup" }).locator("details").filter({
    has: page.getByText("Selected lineup · estimate sources", { exact: true }) });
  const expectSourceTimes = async (withAssists = false, goalsBlended = true) => {
    if (!await sources.evaluate(node => (node as HTMLDetailsElement).open)) await sources.locator("summary").click();
    const goals = sources.getByRole("article", { name: "Alpha Center game 30 GOALS evidence" });
    await expect(goals.getByText(/^Detailed production input/)).toContainText("issued Sep 28, 1:00 AM UTC");
    await expect(goals.getByText(/^Participation input/)).toContainText("issued Sep 28, 1:00 AM UTC");
    await expect(goals).not.toContainText("Sep 29");
    if (goalsBlended) {
      await expect(goals.getByText(/^Baseline rate input/)).toContainText("issued Sep 27, 1:00 AM UTC");
      await expect(goals.getByText(/^Baseline rate input/)).toContainText("expires Oct 9");
    } else await expect(goals.getByText(/^Baseline rate input/)).toHaveCount(0);
    if (withAssists) {
      const assists = sources.getByRole("article", { name: "Alpha Center game 30 ASSISTS evidence" });
      await expect(assists.getByText(/^Baseline rate input/)).toContainText("issued Sep 29, 12:00 AM UTC");
      await expect(assists.getByText(/^Baseline rate input/)).toContainText("expires Oct 10");
      await expect(assists.getByText(/^Participation input/)).toContainText("issued Sep 28, 1:00 AM UTC");
      await expect(assists.getByText(/^Detailed production input/)).toHaveCount(0);
    }
  };
  await sources.locator("summary").click();
  await expect(sources).toContainText("Blended detailed/baseline estimate");
  await expect(sources).toContainText("Alpha Center · game 30 · GOALS");
  await expectSourceTimes();
  const originalRate = retained.forecasts[0].contributions!.GOALS.inputs!.baseline!;
  refreshedRates = [originalRate, ...players.map(row => ({ ...originalRate,
    playerId: Number(row.id), nhlPlayerId: row.nhlId!, sourceId: `assists-${row.id}`, targetKey: "ASSISTS",
    cutoffAt: "2026-09-28T23:00:00Z", issuedAt: "2026-09-29T00:00:00Z", expiresAt: "2026-10-10T00:00:00Z" }))];
  await page.getByText("Scoring, budgets, and lock windows", { exact: true }).click();
  await page.getByRole("button", { name: "Add point weight", exact: true }).click();
  await page.getByLabel("Statistic", { exact: true }).nth(1).fill("ASSISTS");
  await page.getByLabel("Statistic", { exact: true }).nth(1).press("Tab");
  await page.reload();
  await expect(page.getByRole("button", { name: "Show lineup analysis" })).toBeVisible();
  await expect(projected).toContainText("4.1");
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  await sources.locator("summary").click();
  await expect(sources).toContainText("Alpha Center · game 30 · ASSISTS");
  await expect(sources).toContainText("Baseline rate estimate");
  await expectSourceTimes(true);
  if (mode === "connected") {
    await page.getByRole("button", { name: "Save to account" }).click();
    await expect(page.getByText("Saved to account.")).toBeVisible();
    await page.getByRole("button", { name: "View account save" }).click();
    await expect(projected).toContainText("4.1");
    if (await sources.evaluate(node => (node as HTMLDetailsElement).open)) await sources.locator("summary").click();
    await sources.locator("summary").focus();
    await expect(sources.locator("summary")).toBeFocused();
    await page.keyboard.press("Enter");
    await expectSourceTimes(true);
    await expect(page.getByRole("region", { name: "Matchup" }).getByRole("button", { name: "Add opponent totals" })).toHaveCount(0);
  }
  forecastManifest = { ...forecastManifest, id: "policy-21", calendarPolicy: forecastCalendarPolicy(21) };
  await page.reload();
  await expect(projected.locator("strong")).toHaveText("5");
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  await sources.locator("summary").click();
  await expect(sources).toContainText("Detailed game estimate");
  await expect(sources).toContainText("Baseline rate estimate");
  await expectSourceTimes(true, false);
  forecastManifest = { ...forecastManifest, id: "news-refresh", acceptedNewsRevision: "opaque-news-receipts",
    issuedRevisionIds: ["detail-2"] };
  await page.reload();
  await expect(page.getByRole("button", { name: "Show schedule-capacity assignment" })).toBeVisible();
  await expect(projected).toContainText("—");
  if (mode === "connected") {
    await page.getByRole("button", { name: "Save to account" }).click();
    await expect(page.getByText("Saved to account.")).toBeVisible();
    expect(saved).toMatchObject({ snapshot: { forecastManifest: { acceptedNewsRevision: "opaque-news-receipts",
      issuedRevisionIds: ["detail-2"] } } });
  }
  forecastManifest = { ...forecastManifest, id: "post-news", issuedRevisionIds: forecasts.map(row => row.revisionId) };
  responseAsOf = "2026-10-01T00:00:00Z";
  await page.clock.setFixedTime(responseAsOf);
  await page.reload();
  await expect(page.getByRole("button", { name: "Show schedule-capacity assignment" })).toBeVisible();
  await expect(projected).toContainText("—");
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  await expect(page.getByText(/Full comparison unavailable/)).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(errors).toEqual([]);
});
}

test("candidate feedback views preserve eligibility, availability and planned-add semantics", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
    ? route.fallback() : route.abort());
  await page.clock.install({ time: new Date("2026-10-04T00:00:00Z") });
  const owned = fixturePlayer(1, "Owned Center", "NJD");
  const low = { ...fixturePlayer(2, "Alpha Unknown", "CAR"), availability: "unknown" as const };
  const high = { ...fixturePlayer(3, "Zeta Free Agent", "CAR"), eligiblePositions: ["C", "Util"], availability: "free_agent" as const };
  const missing = { ...fixturePlayer(4, "Delta Defender", "SEA"), eligiblePositions: ["D"], availability: "unknown" as const };
  const members = [owned, low, high, missing];
  const games = [fixtureGame("NJD5", 5, "NJD"), fixtureGame("CAR5", 5, "CAR"), fixtureGame("CAR6", 6, "CAR"), fixtureGame("SEA6", 6, "SEA")];
  const forecasts = games.flatMap(game => members.filter(member => member.id !== missing.id && member.teamAbbreviation === game.teamAbbreviation)
    .map(member => fixtureForecast(member, game, member.id === high.id ? 10 : 2)));
  const rules = { ...fixtureRules, rosterSlots: { C: 1, UTIL: 1, D: 1 }, periods: [] };
  await seedWorkspace(page, fixtureWorkspace(members, rules));
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts, evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  const browser = page.getByRole("region", { name: "Candidate browser" });
  await expect(browser.getByText("CAR · 2 players", { exact: true })).toBeVisible();
  await expect(page.getByText("Selected moves are a plan. Confirm roster changes with your provider.")).toHaveCount(0);
  const adds = page.getByRole("region", { name: "Plan summary" }).locator("article").filter({ hasText: "Planned adds" });
  await expect(adds.locator("strong")).toHaveText("0");
  await expect(adds).toContainText("Allowance unknown");
  await browser.getByText("CAR · 2 players", { exact: true }).click();
  await expect(browser.getByText("CAR · C/Util", { exact: true })).toBeVisible();
  await expect(browser.locator("button").filter({ hasText: /^(Zeta Free Agent|Alpha Unknown)/ }).first()).toContainText("Zeta Free Agent");
  await expect(browser).toContainText("Horizon points 20");
  await browser.getByRole("button", { name: /Zeta Free Agent/ }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("rso-feedback-by-team.png"), fullPage: true });
  await browser.getByRole("button", { name: "All players", exact: true }).click();
  await expect(browser.getByRole("button", { name: /Zeta Free Agent/ })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("rso-feedback-all-players.png"), fullPage: true });
  await browser.getByRole("combobox", { name: "Position", exact: true }).selectOption("UTIL");
  await expect(browser.getByRole("button", { name: /Alpha Unknown/ })).toHaveCount(0);
  await browser.getByRole("combobox", { name: "Position", exact: true }).selectOption("");
  await browser.getByRole("combobox", { name: "Team", exact: true }).selectOption("SEA");
  await expect(browser).toContainText("Horizon points unavailable");
  await expect(browser.getByRole("button", { name: "Select add", exact: true })).toHaveCount(0);
  await browser.getByRole("combobox", { name: "Team", exact: true }).selectOption("CAR");
  await browser.getByRole("searchbox", { name: "Find candidate" }).fill("Alpha");
  await expect(browser.getByRole("button", { name: "Select add", exact: true })).toHaveCount(0);
  await browser.getByRole("button", { name: /Alpha Unknown/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Candidates and detail" }).getByText("Alpha Unknown", { exact: true }).first()).toBeVisible();
  await browser.getByRole("button", { name: "Mark available", exact: true }).click();
  await browser.getByRole("button", { name: "Select add", exact: true }).click();
  await expect(adds.locator("strong")).toHaveText("1");
  await expect(adds).toContainText("Allowance unknown");
  await expect(page.getByRole("region", { name: "Plan summary" }).locator("article").filter({ hasText: "Active games" }).locator("strong")).toHaveText("3");
  await page.screenshot({ path: testInfo.outputPath("rso-feedback-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Candidates", exact: true }).click();
  await expect(browser.getByRole("searchbox", { name: "Find candidate" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("rso-feedback-mobile.png"), fullPage: true });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!));
  expect(saved.manualPlayers.find((member: PlanningPlayer) => member.id === high.id).eligiblePositions).toEqual(["C", "Util"]);
  expect(saved.manualPlayers.find((member: PlanningPlayer) => member.id === missing.id).availability).toBe("unknown");
});

test("projected candidate fit values usable points above schedule quantity", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
    ? route.fallback() : route.abort());
  await page.clock.install({ time: new Date("2026-10-04T00:00:00Z") });
  const owned = fixturePlayer(1, "Owned Center", "NJD");
  const low = fixturePlayer(2, "Four Low Value Games", "CAR");
  const high = fixturePlayer(3, "Three High Value Games", "SEA");
  const members = [owned, low, high];
  const games = [fixtureGame("NJD5", 5, "NJD"), fixtureGame("NJD6", 6, "NJD"),
    ...[5, 6, 7, 8].map(day => fixtureGame(`CAR${day}`, day, "CAR")), ...[5, 6, 7].map(day => fixtureGame(`SEA${day}`, day, "SEA"))];
  const forecasts = games.flatMap(game => members.filter(member => member.teamAbbreviation === game.teamAbbreviation)
    .map(member => fixtureForecast(member, game, member.id === high.id ? 10 : member.id === low.id ? 1 : 2)));
  const workspace = fixtureWorkspace(members);
  workspace.context.endDate = date(8);
  await seedWorkspace(page, workspace);
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts, evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  const browser = page.getByRole("region", { name: "Candidate browser" });
  await browser.getByRole("button", { name: "All players", exact: true }).click();
  const order = browser.locator("button").filter({ hasText: /^(Four Low Value Games|Three High Value Games)/ });
  await expect(order.first()).toContainText("Three High Value Games");
  await expect(browser.getByRole("button", { name: /Three High Value Games/ }).locator("..")).toContainText("Potential active points gain 26");
  await expect(browser.getByRole("button", { name: /Four Low Value Games/ }).locator("..")).toContainText("+AGP 2");
  await order.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("rso-projected-fit.png"), fullPage: true });
  await browser.getByRole("combobox", { name: "Sort", exact: true }).selectOption("schedule");
  await expect(order.first()).toContainText("Four Low Value Games");
  await expect(browser.getByRole("heading", { name: "Schedule first", exact: true })).toBeVisible();
  await order.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("rso-schedule-first.png"), fullPage: true });
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts: forecasts.filter(row => row.playerId !== owned.id), evidence: {} } } }));
  await page.reload();
  await browser.getByRole("button", { name: "All players", exact: true }).click();
  await expect(browser.getByText("Schedule first · active points unavailable", { exact: true })).toBeVisible();
  await expect(browser.getByRole("button", { name: /Three High Value Games/ }).locator("..")).toContainText("Potential active points gain unavailable");
  expect(errors).toEqual([]);
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
});

test("planning worker measures the full typical workload and cancels superseded edits", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-04T00:00:00Z"));
  await page.addInitScript(() => {
    const receipt = (window as any).__planningPerformance = { workers: [] as any[], edits: [] as any[], clearAt: null as number | null, ticks: 0, maxGapMs: 0 };
    let previous = performance.now();
    setInterval(() => { const now = performance.now(); receipt.ticks++; receipt.maxGapMs = Math.max(receipt.maxGapMs, now - previous); previous = now; }, 10);
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      record: any;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.record = { index: receipt.workers.length, url: String(url) };
        receipt.workers.push(this.record);
        this.addEventListener("message", event => {
          if (!event.data.result) return;
          this.record.finishedAt = performance.now();
          this.record.activeGames = event.data.result.selected.activeGames;
          this.record.dates = [...new Set(event.data.result.selected.assignments.map((row: any) => row.date))];
          this.record.search = event.data.result.search;
        });
      }
      postMessage(message: any, options?: Transferable[] | StructuredSerializeOptions) {
        this.record.role = message.players ? "candidates" : "planner";
        this.record.postedAt = performance.now();
        this.record.roster = message.snapshot?.roster?.length;
        this.record.context = message.snapshot?.context;
        this.record.revision = message.intent?.revision;
        if (Array.isArray(options)) super.postMessage(message, options); else super.postMessage(message, options);
      }
      terminate() { this.record.terminatedAt = performance.now(); super.terminate(); }
    };
  });
  const teams = Array.from({ length: 10 }, (_, index) => `T${index}`);
  const members = Array.from({ length: 325 }, (_, index) => ({ ...fixturePlayer(index + 1, `Workload Player ${index}`, teams[index % 10]),
    availability: index < 25 ? "rostered" as const : "manager_available" as const }));
  const workspace = fixtureWorkspace(members, { ...fixtureRules, rosterSlots: { C: 10, BN: 15 } });
  workspace.context = { ...workspace.context, endDate: "2026-10-11", asOf: "2026-10-04T00:00:00Z" };
  workspace.roster = members.slice(0, 25).map(member => ({ playerId: member.id, position: "bench" }));
  const dates = Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2026, 9, 5 + index)).toISOString().slice(0, 10));
  const games = dates.flatMap(date => teams.map(team => ({ ...fixtureGame(`${team}:${date}`, 5, team), date, startsAt: `${date}T20:00:00Z` })));
  const forecasts = members.flatMap(member => games.filter(game => game.teamAbbreviation === member.teamAbbreviation).map(game => {
    const forecast = fixtureForecast(member, game, member.availability === "rostered" ? 1 : 5);
    return { ...forecast, cutoffAt: workspace.context.asOf, issuedAt: workspace.context.asOf, issuedContext: { ...forecast.issuedContext!, observedAt: workspace.context.asOf } };
  }));
  await seedWorkspace(page, workspace);
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts, evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  const goalieChoice = page.getByRole("combobox", { name: "Goalie choice", exact: true });
  await goalieChoice.evaluate(element => element.addEventListener("change", () => (window as any).__planningPerformance.edits.push({ at: performance.now(), value: (element as HTMLSelectElement).value })));
  const planner = (revision: number) => page.evaluate(revision => (window as any).__planningPerformance.workers.find((row: any) => row.role === "planner" && row.roster === 25 && row.context.endDate === "2026-10-11" && row.revision === revision), revision);
  await expect.poll(() => planner(1)).toMatchObject({ role: "planner", roster: 25 });
  await goalieChoice.selectOption("cover");
  await expect.poll(() => planner(2)).toMatchObject({ activeGames: 70, dates });
  const outcome = page.getByRole("region", { name: "Plan summary" }).locator("article").filter({ has: page.getByText("Projected outcome", { exact: true }) }).locator("strong");
  await outcome.evaluate(element => {
    const observer = new MutationObserver(() => { if (element.textContent === "—") { (window as any).__planningPerformance.clearAt = performance.now(); observer.disconnect(); } });
    observer.observe(element, { childList: true, characterData: true, subtree: true });
  });
  await goalieChoice.selectOption("accept_risk");
  await expect(outcome).toHaveText("—");
  await expect.poll(() => planner(3)).toMatchObject({ role: "planner", roster: 25 });
  await goalieChoice.selectOption("cover");
  const receipt = await page.evaluate(() => (window as any).__planningPerformance);
  const first = receipt.workers.find((row: any) => row.role === "planner" && row.roster === 25 && row.revision === 1);
  const finished = receipt.workers.find((row: any) => row.role === "planner" && row.roster === 25 && row.revision === 2);
  const canceled = receipt.workers.find((row: any) => row.role === "planner" && row.roster === 25 && row.revision === 3);
  expect(first.finishedAt).toBeUndefined();
  expect(canceled.finishedAt).toBeUndefined();
  expect(first.terminatedAt).toBeGreaterThanOrEqual(receipt.edits[0].at);
  expect(canceled.terminatedAt).toBeGreaterThanOrEqual(receipt.edits[2].at);
  await writeFile(testInfo.outputPath("planning-performance.json"), JSON.stringify({ profile: { roster: 25, candidates: 300, days: 7, games: 70, forecasts: forecasts.length, positions: "C only", input: "fictional complete forecasts, default worker search quotas" },
    fullPlanMs: finished.finishedAt - finished.postedAt, cancellationMs: [first.terminatedAt - receipt.edits[0].at, canceled.terminatedAt - receipt.edits[2].at],
    editToStaleResultClearMs: receipt.clearAt - receipt.edits[1].at, dates: finished.dates, activeGames: finished.activeGames, search: finished.search,
    mainThread: { ticks: receipt.ticks, maxGapMs: receipt.maxGapMs }, scope: "Native headless planner workers; event-to-termination and DOM invalidation; development observation, no latency guarantee" }, null, 2));
});

test("candidate worker ranks the complete population without blocking filters and retains zero AGP", async ({ page }, testInfo) => {
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
    ? route.fallback() : route.abort());
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    (window as any).__candidatePerformance = [];
    window.Worker = class extends NativeWorker {
      postMessage(message: any, options?: any) {
        const started = performance.now();
        let ticks = 0, previous = started, maxGapMs = 0;
        const timer = window.setInterval(() => { const now = performance.now(); maxGapMs = Math.max(maxGapMs, now - previous); previous = now; ticks++; }, 20);
        this.addEventListener("message", event => {
          window.clearInterval(timer);
          if (event.data.metrics) (window as any).__candidatePerformance.push({ elapsedMs: performance.now() - started, ticks, maxGapMs,
            evaluated: event.data.metrics.activePoints.filter((row: any[]) => row[1] !== null).length });
        }, { once: true });
        super.postMessage(message, options);
      }
    };
  });
  const owned = fixturePlayer(1, "Owned Center", "NJD");
  const candidates = Array.from({ length: 999 }, (_, index) => fixturePlayer(index + 2, index === 998 ? "Last Candidate Best Quality" : `Candidate ${index}`, "CAR"));
  const members = [owned, ...candidates];
  const games = [5, 6].flatMap(day => [fixtureGame(`NJD${day}`, day, "NJD"), fixtureGame(`CAR${day}`, day, "CAR")]);
  const forecasts = games.flatMap(game => members.filter(member => member.teamAbbreviation === game.teamAbbreviation)
    .map(member => fixtureForecast(member, game, member.id === candidates[998].id ? 10 : 2)));
  const workspace = fixtureWorkspace(members);
  workspace.context.endDate = date(6);
  await seedWorkspace(page, workspace);
  await page.route("**/api/v1/roster-schedule-optimizer/data?**", route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts, evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  const browser = page.getByRole("region", { name: "Candidate browser" });
  await browser.getByRole("button", { name: "All players", exact: true }).click();
  const best = browser.getByRole("button", { name: /Last Candidate Best Quality/ });
  await expect(best).toBeVisible();
  await expect(best.locator("..")).toContainText("+AGP 0");
  await expect(best.locator("..")).toContainText("Potential active points gain 16");
  await expect(browser.getByRole("heading", { name: "Projected fit · active points gain", exact: true }).locator("+ div")).toContainText("Last Candidate Best Quality");
  await browser.getByRole("searchbox", { name: "Find candidate" }).fill("Candidate 42");
  await expect(best).toHaveCount(0);
  await expect(browser.getByRole("button", { name: /Candidate 42/ }).first()).toBeVisible();
  const metrics = await page.evaluate(() => (window as any).__candidatePerformance);
  expect(metrics.some((row: any) => row.evaluated === 999 && row.ticks > 0 && row.maxGapMs < 500)).toBe(true);
  await writeFile(testInfo.outputPath("candidate-performance.json"), JSON.stringify(metrics, null, 2));
  await browser.getByRole("searchbox", { name: "Find candidate" }).fill("");
  await page.screenshot({ path: testInfo.outputPath("rso-worker-zero-agp.png"), fullPage: true });
});
