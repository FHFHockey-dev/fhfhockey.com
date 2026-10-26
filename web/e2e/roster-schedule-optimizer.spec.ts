import { expect, test } from "@playwright/test";
import { routeCurrentPlanning, showScheduleView, openDisclosure, expectQualityReadiness, setPlanningTime, installPlanningClock, RSO_FIXTURE_BRIDGE, RSO_FIXTURE_PRINCIPAL } from "./roster-schedule-optimizer-fixtures";
import { writeFile } from "node:fs/promises";
import { installDraftProAuthenticatedFixtures } from "./draft-pro-fixtures";
import type { GameForecast, LeagueRules, PlanningPlayer, PlanningSnapshot, PlanningWorkspace } from "../lib/rosterScheduleOptimizer/planningTypes";
import { resolvePlanningContributions } from "../lib/player-forecasts/planningContributions";
import { saveWorkspaceSchema, snapshotSchema } from "../lib/in-season/workspaceSchema";
import { forecastCalendarPolicy } from "../lib/player-forecasts/contributions";
import { currentRsoUsePolicy } from "../lib/player-forecasts/rsoUsePolicy";
import { applyProviderGoalieStarts } from "../lib/rosterScheduleOptimizer/providerGoalieStarts";
import { compactBridgeForecasts } from "../lib/rosterScheduleData/bridgeForecastWire";
import { workspaceStorageKey } from "../lib/rosterScheduleOptimizer/workspace";

const player = { id: "fhfh:1", nhlId: 1, name: "Alpha Center", teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater" as const, availability: "unknown" as const, ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
const date = (day: number) => `2026-10-0${day}`;
const fixturePlayer = (id: number, name: string, team: string): PlanningPlayer => ({ ...player, id: `fhfh:${id}`, nhlId: id, nhlTeamId: [...team].reduce((value, char) => value * 31 + char.charCodeAt(0), 1), rosterRevision: `roster-${id}-${team}`, name, teamAbbreviation: team, eligibilityVerified: true, availability: "manager_available", canDrop: true });
const fixtureGame = (id: string, day: number, team: string): PlanningSnapshot["games"][number] => ({ id, scheduleRevision: `schedule-${id}`, date: date(day), startsAt: `${date(day)}T23:00:00Z`, teamAbbreviation: team, opponent: "NYR", home: true, status: "scheduled" });
const fixtureForecast = (member: PlanningPlayer, game: PlanningSnapshot["games"][number], goals: number): GameForecast => ({
  playerId: member.id, gameId: game.id, stats: { GOALS: goals }, sourceKind: "detailed", sourceWatermark: "fixture-inputs",
  allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, conditioning: "unconditional",
  startProbability: null, confirmedStart: false, revisionId: RSO_FIXTURE_BRIDGE, modelVersion: "fixture", limitations: [],
  cutoffAt: "2026-09-26T00:00:00Z", issuedAt: "2026-09-26T00:00:00Z", expiresAt: game.startsAt!,
  issuedContext: { version: "forge-issued-context-v1", playerId: member.id, gameId: game.id, nhlPlayerId: member.nhlId!,
    seasonId: 20262027, teamId: member.nhlTeamId!, scheduledAt: game.startsAt!, scheduleRevision: game.scheduleRevision!,
    rosterRevision: member.rosterRevision!, observedAt: "2026-09-26T00:00:00Z", scheduleSourceUpdatedAt: null,
    scheduleFetchedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] } });
const fixtureRules: LeagueRules = { lineupMode: "daily", rosterSlots: { C: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1, periods: [{ id: "Week", start: "2026-10-05T00:00:00Z", end: "2026-10-09T00:00:00Z", remaining: 2, source: "manager" }], lineupPeriods: [], scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "unknown" }, unsupported: [] };
function fixtureWorkspace(players: PlanningPlayer[], rules: LeagueRules = fixtureRules): PlanningWorkspace {
  return { version: 1, context: { provider: "manual", seasonId: 20262027, leagueId: "manual", teamId: "manual", startDate: date(5), endDate: date(7), timeZone: "UTC", asOf: "2026-09-26T00:00:00Z" }, rules, managerRuleOverrides: {}, roster: [{ playerId: players[0].id, position: "active" }], lockedAssignments: [], intent: { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 10 }, manualPlayers: players, unresolvedNames: [], realized: {}, opponent: null };
}
/** Seeds the local slot of `principal` (default: the anonymous manual slot). */
async function seedWorkspace(page: import("@playwright/test").Page, workspace: PlanningWorkspace, principal: string | null = null) {
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); }, { key: workspaceStorageKey(principal), value: workspace });
}
async function openPlanDetails(page: import("@playwright/test").Page) {
  await showScheduleView(page, "details");
}
async function openPlanningSetup(page: import("@playwright/test").Page) {
  const toggle = page.getByRole("button", { name: /Planning setup ·/ });
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
}
async function expectDesktopFrameVisible(page: import("@playwright/test").Page) {
  const frame = await page.evaluate(() => {
    const banner = document.querySelector("header")?.getBoundingClientRect();
    const title = document.querySelector("h1")?.getBoundingClientRect();
    const setupElement = document.querySelector('[aria-label="Planning setup"]');
    const setup = (setupElement?.getBoundingClientRect().height ? setupElement : document.querySelector('[aria-controls="rso-planning-setup"]'))?.getBoundingClientRect();
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

test("connected refresh fixtures preserve nonzero intent through offline, cooldown, Undo and reopen", async ({ page }, testInfo) => {
  await installPlanningClock(page, { time: new Date("2026-10-11T12:00:00Z") });
  await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: false } } }));
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`;
  await page.addInitScript(key => { const session = localStorage.getItem("sb-127-auth-token"); if (session) localStorage.setItem(key, session); }, storageKey);
  const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")]; players[1].availability = "free_agent";
  const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 1, BN: 2 }, periods: [{ id: "fixture-week", start: "2026-10-11T00:00:00Z", end: "2026-10-19T00:00:00Z", remaining: 2, source: "manager" }] });
  workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "fixture-league", teamId: "fixture-team", startDate: "2026-10-12", endDate: "2026-10-18", asOf: "2026-10-11T12:00:00Z" };
  workspace.intent.steps = [{ id: "fixture-add", type: "add", playerId: players[1].id, at: "2026-10-12T12:00:00Z", effectiveAt: "2026-10-12T12:00:00Z", conditional: false, dependsOn: [] }]; workspace.intent.protectedPlayerIds = [players[0].id];
  await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: true, capabilities: ["rso_sync", "rso_auto_upkeep"] } } }));
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players, games: [], forecasts: [], evidence: {} } } }));
  let reads = 0;
  await page.route("**/api/v1/roster-schedule-optimizer/provider", route => {
    const read = ++reads;
    const snapshot: PlanningSnapshot = { id: `fixture-refresh-${read}`, context: { ...workspace.context, asOf: read === 1 ? "2026-10-11T12:00:00Z" : "2026-10-11T12:01:00Z" }, players, roster: workspace.roster, rules: workspace.rules, lockedAssignments: [], games: [], forecasts: [], realized: {}, opponent: null, evidence: {} };
    return route.fulfill({ json: { success: true, snapshot, capabilities: { roster: true, availability: read !== 2, limitations: [] }, ...(read === 2 ? { code: "yahoo_rate_limited", retryAfterSeconds: 1200 } : {}) } });
  });
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!) as PlanningWorkspace);
  const visibility = (value: "visible" | "hidden") => page.evaluate(value => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value }); document.dispatchEvent(new Event("visibilitychange")); }, value);
  const network = (value: boolean) => page.evaluate(value => { Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value }); window.dispatchEvent(new Event(value ? "online" : "offline")); }, value);
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/roster-schedule-optimizer");
  await expect.poll(() => reads).toBe(1); await expect(page.getByText("Provider inputs refreshed. Selected moves were kept.")).toBeVisible();
  await openPlanningSetup(page); await page.getByRole("combobox", { name: "Goalie choice" }).selectOption("cover"); const p2 = (await saved()).intent;
  await visibility("hidden"); await visibility("visible"); expect(reads).toBe(1);
  await page.getByRole("button", { name: "Refresh provider" }).click(); await expect(page.getByText(/Provider inputs partly refreshed/)).toBeVisible(); expect(reads).toBe(2); expect((await saved()).intent).toEqual(p2);
  await network(false); await page.clock.fastForward(5 * 60_000); await expect(page.getByRole("button", { name: "Refresh provider" })).toBeDisabled(); expect(reads).toBe(2);
  await network(true); await visibility("hidden"); await visibility("visible"); await page.getByRole("button", { name: "Refresh provider" }).click(); await expect(page.getByText(/Provider refresh is paused until/)).toBeVisible(); expect(reads).toBe(2);
  await page.clock.fastForward(15 * 60_000 + 1000); await expect.poll(() => reads).toBe(3);
  await page.getByRole("button", { name: "Undo" }).click(); await expect.poll(async () => (await saved()).intent.goalieCoverage).toBe(workspace.intent.goalieCoverage); expect((await saved()).intent).toMatchObject({ steps: workspace.intent.steps, protectedPlayerIds: workspace.intent.protectedPlayerIds, goalieCoverage: workspace.intent.goalieCoverage });
  await page.reload(); await expect.poll(() => reads).toBe(4); expect((await saved()).intent.steps).toEqual(workspace.intent.steps); expect((await saved()).context.asOf).toBe("2026-10-11T12:01:00Z");
  await page.screenshot({ path: testInfo.outputPath("rso-refresh-fixture.png") });
  await writeFile(testInfo.outputPath("refresh-fixture-receipt.json"), JSON.stringify({ reads, scope: "Fictional intercepted session/provider and local storage; controlled online/visibility/time. Authentic isolation and account saves not accepted.", nonzeroP2: p2 }, null, 2));
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "fixture: unmocked API" } }));
  await page.route("**/*", route => {
    const host = new URL(route.request().url()).hostname;
    return ["127.0.0.1", "localhost"].includes(host) ? route.fallback() : route.abort();
  });
  await setPlanningTime(page, new Date("2026-09-26T00:00:00Z"));
  await routeCurrentPlanning(page, (route) => route.fulfill({ json: { success: true, data: { players: [player], games: [], forecasts: [], evidence: {} } } }));
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
    await expect(page.getByRole("region", { name: "Roster and setup" }).getByRole("button", { name: "Alpha Center CAR · C", exact: true })).toBeVisible();
    const manage = page.getByLabel("Manage Alpha Center", { exact: true });
    await manage.click();
    await expect(page.getByRole("button", { name: "Remove Alpha Center" })).toBeVisible();
    await manage.click();
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
    await page.getByLabel("Manage Alpha Center", { exact: true }).click();
    await expect(page.getByRole("button", { name: "Remove Alpha Center" })).toBeVisible();
    await page.getByLabel("Manage Alpha Center", { exact: true }).click();
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

test("mobile tabs keep selection and expose the matchup and player details", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/roster-schedule-optimizer");
  await expect(page.getByRole("region", { name: "Itinerary" })).toBeVisible();
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Roster" }).click();
  await openDisclosure(page, "Add or import roster");
  await page.getByRole("textbox", { name: "Paste roster names" }).fill("Alpha Center");
  await page.getByRole("button", { name: "Review pasted names" }).click();
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Matchup" }).click();
  await expect(page.getByText(/Opponent inputs are missing/)).toBeVisible();
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Roster" }).click();
  await page.getByLabel("Manage Alpha Center", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove Alpha Center" })).toBeVisible();
  await page.getByLabel("Manage Alpha Center", { exact: true }).click();
  await openDisclosure(page, "Add or import roster");
  await page.getByRole("textbox", { name: "Paste roster names" }).fill("Alpha Center");
  await page.getByRole("button", { name: "Review pasted names" }).click();
  await expect(page.locator("#rso-action-status")).toHaveText("Roster review complete: 0 added, 1 already rostered, 0 unresolved. No new roster players were added.");
  const retained = await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"));
  const detail = page.getByRole("region", { name: "Player details for Alpha Center", exact: true });
  await page.getByRole("region", { name: "Roster and setup" }).getByRole("button", { name: /^Alpha Center/ }).click();
  await expect(page.getByRole("region", { name: "Candidates and detail" })).toBeVisible();
  await expect(detail).toBeVisible();
  await expect(detail).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"))).toBe(retained);
  await page.screenshot({ path: testInfo.outputPath("player-detail-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  await expect(page.getByRole("region", { name: "Candidates and detail" })).toBeHidden();
  await showScheduleView(page, "player");
  await expect(page.getByRole("table", { name: "Individual player weekly schedule" })).toBeVisible();
  const schedulePlayer = page.getByRole("button", { name: /^Schedule details for Alpha Center,/ });
  if (!(await schedulePlayer.isVisible())) await page.getByRole("button", { name: /^Bench \d+, expand/ }).click();
  await schedulePlayer.click();
  await expect(page.getByRole("region", { name: "Candidates and detail" })).toBeVisible();
  await expect(detail).toBeVisible();
  await expect(detail).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"))).toBe(retained);
  await expectDesktopFrameVisible(page);
  await page.screenshot({ path: testInfo.outputPath("player-detail-desktop.png") });
});

test("readiness controls reach existing inputs across the required viewports", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await routeCurrentPlanning(page, route => {
    const day = route.request().method() === "POST" ? route.request().postDataJSON().endDate : new URL(route.request().url()).searchParams.get("endDate")!;
    return route.fulfill({ json: { success: true, data: { players: [player],
      games: [{ ...fixtureGame("empty-roster-game", 2, "CAR"), date: day, startsAt: `${day}T23:00:00Z` }], forecasts: [], evidence: {} } } });
  });
  for (const [width, height] of [[1180, 757], [1024, 768], [768, 1024], [720, 450], [390, 844], [320, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/roster-schedule-optimizer");
    await openDisclosure(page, /^More tools$/);
    const readiness = page.locator("details").filter({ has: page.locator(":scope > summary").getByText("Planning readiness", { exact: true }) });
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
    await expect(page.getByText("Review league rules, scoring, locked assignments and player availability. Confirm again when these inputs change.", { exact: false })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Lineup mode", exact: true })).toHaveValue("daily");
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
  await routeCurrentPlanning(page, (route) => route.fulfill({ json: { success: true, data: { players, games, forecasts, evidence: {} } } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await showScheduleView(page, "itinerary");
  const stream = page.getByRole("region", { name: "Itinerary" }).getByRole("table").first();
  await expect(stream).toContainText("Alpha Center");
  await expect(stream).toContainText("Bravo Center");
  await expect(stream).toContainText("Charlie Center");
  await expect(stream.getByRole("row", { name: /C#1/ }).getByRole("cell").nth(0)).toContainText("Hold");
  await expect(stream.getByRole("row", { name: /C#1/ }).getByRole("cell").nth(1)).toContainText("Conditional add");
  await expect(stream.getByRole("row", { name: /C#1/ }).getByRole("cell").nth(2)).toContainText("Conditional add");
  await expect(page.getByRole("region", { name: "Plan summary" }).getByRole("article").filter({ has: page.getByText("Active games", { exact: true }) }).locator("strong")).toHaveText("3 / 3");
  await openPlanDetails(page);
  await expect(page.getByRole("region", { name: "Itinerary" }).getByText("ADD Bravo Center", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Itinerary" }).getByText("ADD Charlie Center", { exact: true })).toBeVisible();
  const nextAction = page.getByText("Next selected action: ADD Bravo Center", { exact: true });
  await expect(nextAction).toBeVisible();
  await expect(page.getByText("Review inputs and rule checks before acting.", { exact: false })).toBeVisible();
  await showScheduleView(page, "player");
  await openPlanningSetup(page);
  await page.getByText("League rules and scoring").click();
  await page.getByRole("button", { name: "Confirm planning inputs", exact: true }).click();
  await openPlanDetails(page);
  await expect(page.getByText("Recheck availability and clearance before this conditional move.", { exact: false })).toBeVisible();
  await page.evaluate(() => {
    const retained = JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!);
    retained.rules.unsupported = ["Some league scoring or roster rules are unsupported."];
    localStorage.setItem("fhfh:rso:workspace:v1", JSON.stringify(retained));
  });
  await page.reload();
  await openPlanDetails(page);
  await openPlanningSetup(page);
  await page.getByText("League rules and scoring").click();
  await page.getByRole("button", { name: "Confirm planning inputs", exact: true }).click();
  await expect(page.getByText("Review inputs and rule checks before acting.", { exact: false })).toBeVisible();
  await expect(page.getByText("Recheck availability and clearance before this conditional move.", { exact: false })).toHaveCount(0);
  await page.getByText("Scoring, budgets, and lock windows", { exact: true }).click();
  for (const [width, height] of [[1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await expectDesktopFrameVisible(page);
    await page.screenshot({ path: testInfo.outputPath(`roster-optimizer-stream-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Itinerary", exact: true }).click();
  await openPlanDetails(page);
  await nextAction.scrollIntoViewIfNeeded();
  await expect(nextAction).toBeInViewport();
  await expect(page.getByText("Review inputs and rule checks before acting.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!).intent)).toEqual(workspace.intent);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("roster-optimizer-next-action-mobile.png"), fullPage: true });
});

test("weekly lock keeps one fixed occupant across a window, including a confirmed midpoint assignment", async ({ page }) => {
  const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")];
  const workspace = fixtureWorkspace(players, { ...fixtureRules, lineupMode: "weekly", lineupPeriods: [{ id: "Week", start: `${date(5)}T00:00:00Z`, end: `${date(8)}T00:00:00Z`, lockAt: "2026-10-04T23:00:00Z" }] });
  workspace.roster.push({ playerId: players[1].id, position: "bench" });
  workspace.lockedAssignments = [{ date: date(6), playerId: players[0].id, slotId: "C#1" }];
  await seedWorkspace(page, workspace);
  const games = [fixtureGame("g-a1", 5, "CAR"), fixtureGame("g-b1", 5, "NJD"), fixtureGame("g-a2", 6, "CAR"), fixtureGame("g-b2", 6, "NJD")];
  const forecasts = games.map((game) => fixtureForecast(game.teamAbbreviation === "CAR" ? players[0] : players[1], game, game.teamAbbreviation === "CAR" ? 1 : 10));
  await routeCurrentPlanning(page, (route) => route.fulfill({ json: { success: true, data: { players, games, forecasts, evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  await showScheduleView(page, "itinerary");
  const row = page.getByRole("region", { name: "Itinerary" }).getByRole("table").first().getByRole("row", { name: /C#1/ });
  await expect(row.getByRole("cell").nth(0)).toContainText("Alpha Center");
  await expect(row.getByRole("cell").nth(1)).toContainText("Alpha Center");
  await expect(row).not.toContainText("Bravo Center");
});

for (const { candidateShots, candidateLock, label } of [
  { candidateShots: 2, candidateLock: false, label: "tradeoffs" },
  { candidateShots: 7, candidateLock: false, label: "gains" },
  { candidateShots: 2, candidateLock: true, label: "unavailable baseline" },
]) test(`fixture category ${label} use only startable post-acquisition games on desktop and mobile`, async ({ page }, testInfo) => {
  await setPlanningTime(page, new Date("2026-10-05T00:00:00Z"));
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
  if (candidateLock) workspace.lockedAssignments.push({ date: date(7), playerId: players[2].id, slotId: "C#1" });
  workspace.intent.protectedPlayerIds = [players[0].id];
  workspace.intent.steps = [{ id: "manager-selected", type: "add", playerId: players[2].id, dropPlayerId: players[1].id,
    at: `${date(5)}T22:00:00Z`, effectiveAt: `${date(6)}T00:00:00Z`, conditional: true, dependsOn: [] }];
  const games = [fixtureGame("a6", 6, "CAR"), fixtureGame("a7", 7, "CAR"), fixtureGame("c5", 5, "NJD"), fixtureGame("c6", 6, "NJD"), fixtureGame("c7", 7, "NJD")];
  const forecasts = games.map(game => {
    const member = players.find(row => row.teamAbbreviation === game.teamAbbreviation)!;
    return { ...fixtureForecast(member, game, 0), stats: game.teamAbbreviation === "CAR" ? { GOALS: 1, SHOTS: 6 }
      : game.date === date(5) ? { GOALS: 99, SHOTS: 99 } : { GOALS: 3, SHOTS: candidateShots } };
  });
  await seedWorkspace(page, workspace);
  await routeCurrentPlanning(page, route => route.fulfill({ json: {
    success: true, data: { players, games, forecasts, evidence: {} },
  } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [width, height] of [[1440, 900], [390, 844], [320, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/roster-schedule-optimizer");
    await openPlanDetails(page);
    const itinerary = page.getByRole("region", { name: "Itinerary", exact: true });
    const gains = page.getByText("Selected plan · category gains", { exact: true }).locator("..");
    await gains.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    if (candidateLock) {
      // The selected acquisition owns Candidate; the no-acquisition baseline cannot satisfy that lock.
      await expect(gains.getByText(/no-move lineup cannot satisfy the current lineup locks/)).toBeVisible();
      await expect(gains.getByText("Change unavailable", { exact: true })).toHaveCount(2);
      await expect(gains.getByText(/No move \d+ → plan/)).toHaveCount(0);
    } else {
      // Opposed gains retain the neutral assignment; componentwise gains can improve it.
      await expect(gains.getByText(candidateShots === 2 ? "No move 2 → plan 2 · Δ 0" : "No move 2 → plan 4 · Δ +2")).toBeVisible();
      await expect(gains.getByText(candidateShots === 2 ? "No move 12 → plan 12 · Δ 0" : "No move 12 → plan 13 · Δ +1")).toBeVisible();
      await expect(gains.getByText(candidateShots === 2 ? "Opponent 2.5 · loss → loss" : "Opponent 2.5 · loss → win")).toBeVisible();
      await expect(gains.getByText("Opponent 10 · win → win")).toBeVisible();
    }
    await expect(gains).toContainText("not win probabilities");
    if (width < 1101) await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Candidates", exact: true }).click();
    await expect(page.getByRole("region", { name: "Candidate browser" }).getByText("Ranked by more starts. Each card shows the category gains and losses for the whole swap.", { exact: true })).toBeVisible();
    await expect(itinerary.getByText(/Best found ·/)).toHaveCount(0);
    await showScheduleView(page, "player");
    await expect(itinerary.getByRole("button", { name: "Show category lineup comparison" })).toHaveAttribute("aria-pressed", "true");
    await openPlanDetails(page);
    await expect(gains.getByText("Category gains unavailable. Review forecast coverage, opponent inputs, acquisition rules and goalie minimums.", { exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!))).toMatchObject({
      intent: workspace.intent, lockedAssignments: workspace.lockedAssignments,
    });
    if (width >= 1101) await expectDesktopFrameVisible(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`fixture-category-gains-${width}.png`) });
  }
  expect(errors).toEqual([]);
});

test("provider refresh proposes repairs while keeping a selected move", async ({ page }, testInfo) => {
  let reads = 0;
  let holdRefresh = false, failRefresh = false;
  let releaseRefresh!: () => void, releaseSave!: () => void;
  const pendingRefresh = new Promise<void>(resolve => { releaseRefresh = resolve; });
  const pendingSave = new Promise<void>(resolve => { releaseSave = resolve; });
  let saves = 0;
  const authenticatedRequests: string[] = [];
  const lockedPlayer = { ...player, id: "fhfh:locked", nhlId: 3, name: "Locked Player" };
  const retained = fixtureWorkspace([player, lockedPlayer]);
  retained.context = { ...retained.context, provider: "yahoo", leagueId: "league", teamId: "team" };
  retained.lockedAssignments = [{ date: date(6), playerId: lockedPlayer.id, slotId: "C#1" }];
  retained.intent.protectedPlayerIds = [player.id];
  await seedWorkspace(page, retained, RSO_FIXTURE_PRINCIPAL);
  await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: false } } }));
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`;
  await page.addInitScript((key) => { const session = localStorage.getItem("sb-127-auth-token"); if (session) localStorage.setItem(key, session); }, storageKey);
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace**", async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? "");
    if (route.request().method() === "PUT") { saves += 1; await pendingSave; }
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
    if (holdRefresh) await pendingRefresh;
    if (failRefresh) {
      failRefresh = false;
      return route.fulfill({ status: 503, json: { success: false, error: { message: "Provider temporarily unavailable." } } });
    }
    const request = route.request().postDataJSON() as { startDate: string; endDate: string; timeZone: string };
    const snapshot = {
      id: `provider-${reads}`,
      context: { provider: "yahoo", seasonId: 20262027, leagueId: "league", teamId: "team", startDate: request.startDate, endDate: request.endDate, timeZone: request.timeZone, asOf: new Date().toISOString() },
      players: [{ ...player, availability: reads === 1 ? "free_agent" : "rostered" }, ...(reads === 1 ? [{ ...lockedPlayer, availability: "rostered" }] : [])],
      roster: [{ playerId: reads === 1 ? lockedPlayer.id : player.id, position: "active" }], games: [], forecasts: [],
      rules: { lineupMode: "daily", rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: null, periods: [], lineupPeriods: [], scoring: { mode: "points", weights: {}, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "unknown" }, unsupported: [] },
      lockedAssignments: [], realized: {}, opponent: null, evidence: {},
    };
    await route.fulfill({ json: { success: true, snapshot, capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: false, limitations: ["Available-player discovery did not reach the end of the provider list."] } } });
  });
  await page.goto("/roster-schedule-optimizer");
  await openPlanDetails(page);
  const health = page.locator("details").filter({ has: page.getByText("Data health", { exact: true }) });
  await expect(health.locator("summary")).toContainText("2 items to review");
  await expect(health.getByRole("list")).toBeHidden();
  await health.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(health.getByRole("list")).toContainText("Yahoo does not report a league time zone");
  await page.keyboard.press("Enter");
  await page.getByText("League rules and scoring", { exact: true }).click();
  const confirm = page.locator("#rso-rule-settings").getByText("Confirm planning inputs", { exact: true });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await page.getByText("League rules and scoring", { exact: true }).click();
  await openDisclosure(page, "Find & filter");
  await page.getByRole("searchbox", { name: "Find candidate" }).fill("Alpha");
  await page.getByRole("button", { name: "All players", exact: true }).click();
  await page.getByRole("button", { name: "Select add" }).click();
  await expect(page.getByText("ADD Alpha Center", { exact: true })).toBeVisible();
  // Local persistence is asynchronous; capture the intent once the selected add is stored.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!).intent.steps.length)).toBe(1);
  const selected = await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!).intent);
  await openPlanningSetup(page);
  holdRefresh = true;
  await page.getByRole("button", { name: "Refresh provider" }).click();
  await expect(page.getByRole("button", { name: "Refresh provider" })).toBeDisabled();
  await expect(page.locator("#rso-provider-refresh-status")).toHaveText("Refreshing provider inputs…");
  await expect.poll(() => reads).toBe(2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!).intent)).toEqual(selected);
  await expectDesktopFrameVisible(page);
  await page.screenshot({ path: testInfo.outputPath("provider-refresh-pending-desktop.png"), fullPage: true });
  holdRefresh = false; releaseRefresh();
  await expect(page.getByText(/appears on the actual roster; review whether this selected add is complete/)).toBeVisible();
  await expect(page.locator("#rso-provider-refresh-status")).toHaveText("Provider inputs refreshed. Selected moves were kept.");
  await expect(page.getByText("ADD Alpha Center", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!))).toMatchObject({
    intent: selected, lockedAssignments: retained.lockedAssignments,
    manualPlayers: expect.arrayContaining([expect.objectContaining({ id: lockedPlayer.id, name: "Locked Player", availability: "unknown" })]),
  });
  await page.getByRole("button", { name: "Refresh provider" }).click();
  await expect(page.locator("#rso-provider-refresh-status")).toHaveText("Provider refresh completed. Inputs are unchanged; selected moves were kept.");
  const beforeFailure = await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!));
  failRefresh = true;
  await page.getByRole("button", { name: "Refresh provider" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Provider temporarily unavailable." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh provider" })).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!))).toEqual(beforeFailure);
  await page.getByRole("button", { name: "Refresh provider" }).click();
  await expect(page.locator("#rso-provider-refresh-status")).toHaveText("Provider refresh completed. Inputs are unchanged; selected moves were kept.");
  expect(reads).toBe(5);
  await page.getByText("League rules and scoring", { exact: true }).click();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await page.getByRole("button", { name: "Save to account" }).click();
  await expect(page.getByRole("button", { name: /Save to account|Saving/ })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: /Saving/ })).toBeVisible();
  await expect.poll(() => saves).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!).intent)).toEqual(selected);
  releaseSave();
  await expect(page.getByText("Saved to account.")).toBeVisible();
  await page.getByRole("button", { name: "View account save" }).click();
  await expect(confirm).toBeDisabled();
  await expect(page.getByText(/Review league rules, scoring, locked assignments and player availability/)).toBeVisible();
  await page.locator('[class*="navStatus"]').hover();
  await page.getByRole("button", { name: "Continue manually" }).click();
  await expect(confirm).toBeEnabled();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!))).toMatchObject({
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
  await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
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
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts, evidence: {} } } }));
  let providerConflict = false;
  const providerLock = { date: date(6), playerId: members[0].id, slotId: "C#1" };
  await page.route("**/api/v1/roster-schedule-optimizer/provider", route => route.fulfill({ json: { success: true,
    snapshot: { id: providerConflict ? "provider-conflict" : "provider-open", context: workspace.context,
      players: members, roster: workspace.roster, games, forecasts, rules: workspace.rules,
      lockedAssignments: providerConflict ? [providerLock] : [], realized: {}, opponent: null, evidence: { schedule: { source: "Complete synthetic provider schedule", asOf: workspace.context.asOf, seasonId: 20262027, completeness: "complete", limitations: [] } } },
    capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: true, limitations: [] } } }));
  await page.goto("/roster-schedule-optimizer");
  const outcome = page.getByRole("region", { name: "Plan summary" }).locator("article").filter({ has: page.getByText("Projected points", { exact: true }) }).locator("strong");
  await expect(outcome).toHaveText("5");
  await page.getByRole("button", { name: "Save to account" }).click();
  await expect(page.getByText("Saved to account.", { exact: true })).toBeVisible();
  expect(accountSnapshot!.lockedAssignments).toEqual([{ ...workspace.lockedAssignments[0], source: "manager" }]);
  await openPlanningSetup(page);
  await page.getByRole("combobox", { name: "Goalie choice", exact: true }).selectOption("cover");
  providerConflict = true;
  await openPlanningSetup(page);
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
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!))).toMatchObject({
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
  await seedWorkspace(page, retained, RSO_FIXTURE_PRINCIPAL);
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
  await routeCurrentPlanning(page, route => {
    dataZones.push(route.request().method() === "POST" ? route.request().postDataJSON().timeZone : new URL(route.request().url()).searchParams.get("timeZone")!);
    return route.fulfill({ json: { success: true, data: { players: [player], games: [], forecasts: [], evidence: {} } } });
  });
  await page.route("**/api/v1/roster-schedule-optimizer/provider", route => {
    requestedZones.push(route.request().postDataJSON().timeZone);
    return route.fulfill({ json: { success: true, snapshot, capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: false, limitations: [] } } });
  });
  await page.goto("/roster-schedule-optimizer");
  await openPlanDetails(page);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!))).toMatchObject({
    context, roster: snapshot.roster, rules: snapshot.rules, intent: retained.intent,
  });
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue("America/New_York");
  await expect(page.getByText(/Provider inputs do not match/)).toHaveCount(0);
  await expect.poll(() => requestedZones).toEqual(["UTC", "America/New_York"]);
  await expect.poll(() => dataZones).toContain("America/New_York");
  await page.reload();
  await openPlanDetails(page);
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue("America/New_York");
  await expect(page.getByText("ADD Alpha Center", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!))).toMatchObject({
    context, intent: retained.intent,
  });
});

test("shows sequential stream occupants with real games and retains workspace layout when details expand", async ({ page }, testInfo) => {
  await routeCurrentPlanning(page, (route) => {
    const start = route.request().method() === "POST" ? route.request().postDataJSON().startDate : new URL(route.request().url()).searchParams.get("startDate")!;
    const next = (days: number) => { const date = new Date(`${start}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
    const games = [
      { id: "g1", date: next(1), startsAt: `${next(1)}T23:00:00Z`, teamAbbreviation: "CAR", opponent: "NJD", home: true, status: "scheduled" },
      { id: "g2", date: next(2), startsAt: `${next(2)}T23:00:00Z`, teamAbbreviation: "NJD", opponent: "CAR", home: false, status: "scheduled" },
    ];
    const beta = { ...player, id: "fhfh:2", nhlId: 2, name: "Bravo Center", teamAbbreviation: "NJD" };
    const forecasts = [{ playerId: player.id, gameId: "g1" }, { playerId: beta.id, gameId: "g2" }].map((row) => ({ ...row, stats: { GOALS: 0.4 }, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, conditioning: "unconditional", startProbability: null, confirmedStart: false, revisionId: "revision", issuedAt: new Date().toISOString(), modelVersion: "test", limitations: [] }));
    return route.fulfill({ json: { success: true, data: { players: [player, beta], games, forecasts, evidence: {} } } });
  });
  await setPlanningTime(page, "2026-09-21T00:00:00Z");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await openDisclosure(page, "Add or import roster");
  await page.getByRole("textbox", { name: "Paste roster names" }).fill("Alpha Center\nBravo Center");
  await page.getByRole("button", { name: "Review pasted names" }).click();
  await page.getByText("League rules and scoring").click();
  await page.getByLabel("C", { exact: true }).fill("1");
  await showScheduleView(page, "itinerary");
  await expect(page.getByRole("region", { name: "Itinerary" }).getByRole("table").first()).toContainText("Alpha Center");
  await expect(page.getByRole("region", { name: "Itinerary" }).getByRole("table").first()).toContainText("Bravo Center");
  await showScheduleView(page, "player");
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
  await routeCurrentPlanning(page, (route) => route.fulfill({ json: { success: true, data: { players, games, forecasts: [], evidence: {} } } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  const itinerary = page.getByRole("region", { name: "Itinerary", exact: true });
  await showScheduleView(page, "itinerary");
  await expect(itinerary.getByRole("table")).toContainText("Roster Player 1");
  for (const [width, height] of [[1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await showScheduleView(page, "itinerary");
    await expectDesktopFrameVisible(page);
    await page.screenshot({ path: testInfo.outputPath(`rso-itinerary-${width}.png`), fullPage: true });
    await showScheduleView(page, "player");
    await expect(itinerary.getByRole("table")).toHaveCount(1);
    await expect(itinerary.getByRole("columnheader", { name: "Slot / player", exact: true })).toBeVisible();
    const nestedVerticalScrolls = await itinerary.evaluate((panel) => Array.from(panel.querySelectorAll("div")).filter((node) => node.scrollHeight > node.clientHeight + 1 && ["auto", "scroll"].includes(getComputedStyle(node).overflowY)).length);
    expect(nestedVerticalScrolls).toBeLessThanOrEqual(1);
    await expect(page.getByRole("region", { name: "Player weekly schedule scroll area" })).toHaveCSS("overflow-y", "auto");
    await expectDesktopFrameVisible(page);
    await page.screenshot({ path: testInfo.outputPath(`rso-lineup-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("group", { name: "Schedule view", exact: true }).getByRole("button", { name: /^Show (lineup by player|category lineup comparison)$/ })).toHaveAttribute("aria-pressed", "true");
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
  await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: true, capabilities: ["rso_sync"], grantingSources: ["test"] } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/provider", route => route.fulfill({ status: 502, json: { success: false, error: "Yahoo roster/settings reads timed out after retrying." } }));
  await routeCurrentPlanning(page, route => {
    const start = route.request().method() === "POST" ? route.request().postDataJSON().startDate : new URL(route.request().url()).searchParams.get("startDate")!;
    const games = players.map(player => ({ ...fixtureGame(player.id, 5, player.teamAbbreviation!), date: start, startsAt: `${start}T23:00:00Z` }));
    return route.fulfill({ json: { success: true, data: { players: players.map(player => ({ ...player, availability: "unknown" })), games, forecasts: [], evidence: {}, matchupWeeks: [{ gameKey: "477", week: 1, startDate: "2026-09-29", endDate: "2026-10-04" }, { gameKey: "477", week: 2, startDate: "2026-10-05", endDate: "2026-10-11" }] } } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await openPlanDetails(page);
  await expect(page.getByText("Yahoo roster/settings reads timed out after retrying.")).toBeVisible();
  await expect(page.getByText("Retained roster · roster, locks & availability unverified.", { exact: true })).toBeVisible();
  await showScheduleView(page, "itinerary");
  await expect(page.getByRole("region", { name: "Itinerary", exact: true }).getByRole("table")).toContainText("Alpha Center");
  await openDisclosure(page, "Find & filter");
  await page.getByRole("button", { name: "All players", exact: true }).click();
  const candidateBrowser = page.getByRole("region", { name: "Candidate browser" });
  await expect(candidateBrowser.getByRole("button", { name: /^Preview swap/ })).toHaveCount(0);
  await expect(candidateBrowser.getByText("Net AGP", { exact: true })).toHaveCount(0);
  await openDisclosure(page, /^More tools$/);
  await openDisclosure(page, /^Why add\/drop plans may be unavailable$/);
  await expect(page.locator("details").filter({ has: page.locator(":scope > summary").getByText("Why add/drop plans may be unavailable", { exact: true }) })).toContainText("Add/drop plans need acquisition-effective timing");
  await openPlanningSetup(page);
  await page.getByRole("button", { name: "Previous matchup week" }).click();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-09-29");
  await expect(page.getByLabel("Through", { exact: true })).toHaveValue("2026-10-04");
  await expect(page.getByRole("region", { name: "Itinerary", exact: true }).getByRole("table")).toContainText("Alpha Center");
  await page.getByRole("button", { name: "Next matchup week" }).click();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-10-05");
  await expect(page.getByRole("region", { name: "Itinerary", exact: true }).getByRole("table")).toContainText("Alpha Center");
  await openDisclosure(page, "Find & filter");
  await page.getByRole("button", { name: "All players", exact: true }).click();
  await expect(candidateBrowser.getByRole("button", { name: /^Preview swap/ })).toHaveCount(0);
  await expect(candidateBrowser.getByText("Net AGP", { exact: true })).toHaveCount(0);
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
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts: fullCoverage ? players.map((player, index) => fixtureForecast(player, games[index], [9, 4, 5][index]))
      : [fixtureForecast(players[1], games[1], 2), fixtureForecast(players[2], games[2], 3)], evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  await openPlanDetails(page);
  await expectQualityReadiness(page, false);
  await showScheduleView(page, "player");
  await openPlanDetails(page);
  await expectQualityReadiness(page, false);
  await expectQualityReadiness(page, false);
  fullCoverage = true;
  for (const [width, height] of [[1180, 757], [1024, 768], [768, 1024], [390, 844], [320, 844]]) {
    await page.setViewportSize({ width, height });
    await page.reload();
    await openPlanDetails(page);
    await showScheduleView(page, "player");
    await openPlanDetails(page);
    await expectQualityReadiness(page, true);
    await expect(page.getByText("Inputs reviewed for this session. Unknown values still need verification.", { exact: false })).toHaveCount(0);
    await expect(page.getByText(/Suggested assignment uses reviewed inputs/)).toHaveCount(0);
    await openDisclosure(page, /^More tools$/);
    const readiness = page.locator("details").filter({ has: page.locator(":scope > summary").getByText("Planning readiness", { exact: true }) });
    if (await readiness.evaluate(node => (node as HTMLDetailsElement).open)) await readiness.locator(":scope > summary").click();
    await readiness.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Review rules", exact: true }).click();
    await page.getByRole("button", { name: "Confirm planning inputs", exact: true }).focus();
    await page.keyboard.press("Space");
    await openDisclosure(page, /^League rules and scoring$/);
    await expect(page.getByText("Inputs reviewed for this session. Unknown values still need verification.", { exact: false })).toBeVisible();
    await page.locator("#rso-rule-settings > summary").click();
    await page.getByRole("button", { name: "View plan", exact: true }).click();
    await openPlanDetails(page);
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
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts, evidence: {} } } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/roster-schedule-optimizer");
  await openPlanDetails(page);
  for (let pass = 0; pass < 2; pass++) {
    await showScheduleView(page, "player");
    await openPlanDetails(page);
    await page.getByText("Why players are outside this assignment", { exact: true }).click();
    const bench = page.getByRole("article", { name: "Drake Batherson bench decision" });
    await expect(bench).toContainText("Weekly placement window: Oct 5–Oct 6");
    await expect(bench).toContainText("Complete-plan start/sit score: selected 54; with Drake Batherson 50");
    await expect(bench).toContainText("LW#1: Kirill Kaprizov → Matthew Knies");
    await expect(bench).toContainText("RW#1: Matthew Knies → Drake Batherson");
    await expect(bench.getByRole("list", { name: "Changed assignments" })).not.toContainText("UTIL#1");
    await showScheduleView(page, "player");
    const center = page.getByRole("region", { name: "Itinerary" }).getByRole("row").filter({ hasText: "Locked Center" });
    await expect(center.getByRole("button", { name: "Schedule details for Locked Center, UTIL#1, league positions C, Fantasy assigned", exact: true })).toBeVisible();
    if (pass === 0) await page.reload();
    await openPlanDetails(page);
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
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts: games.map((game, index) => fixtureForecast(players[index], game, index ? 1 : 9)), evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  await expectQualityReadiness(page, false);
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
  const reviews = page.getByText("Review evidence", { exact: true });
  for (let index = 0; index < 2; index++) {
    await page.getByLabel(`Manage ${players[index].name}`, { exact: true }).click();
    await reviews.nth(index).click();
    await page.getByRole("checkbox", { name: "Manager confirms league positions" }).nth(index).check();
    if (!index) await expectQualityReadiness(page, false);
  }
  await expectQualityReadiness(page, true);
  await showScheduleView(page, "itinerary");
  await expect(page.getByRole("region", { name: "Itinerary" }).getByRole("table").first()).toContainText("Alpha Center");
  await page.reload();
  await expectQualityReadiness(page, true);
  const retained = await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!).manualPlayers);
  expect(retained.every((player: PlanningPlayer) => player.eligibilityVerified === true)).toBe(true);
  expect(errors).toEqual([]);
});

test("goalie competition stays unresolved across the worker and evidence view", async ({ page }, testInfo) => {
  const players: PlanningPlayer[] = [7, 8].map(id => ({ ...fixturePlayer(id, `Goalie ${id}`, "CAR"),
    playerClass: "goalie", eligiblePositions: ["G"], availability: id === 7 ? "manager_available" : "unknown" }));
  const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { G: 1 },
    scoring: { mode: "points", weights: { SAVES_GOALIE: 1 }, categories: [] },
    goalieMinimum: { required: 1, credited: 0, counts: "starts", penalty: "none" } });
  workspace.context.endDate = date(9);
  const games = [fixtureGame("goalie-first", 8, "CAR"), fixtureGame("goalie-second", 9, "CAR")];
  let probability = 0.8;
  await seedWorkspace(page, workspace);
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts: players.map(member => ({ ...fixtureForecast(member, games[0], 0),
      stats: { SAVES_GOALIE: 20 }, startProbability: probability })), evidence: {} } } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await expectQualityReadiness(page, false);
  const outcome = page.getByRole("region", { name: "Plan summary" }).locator("article").filter({ hasText: "Projected points" }).locator("strong");
  await expect(outcome).toHaveText("—");
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  const pairs = page.getByRole("group", { name: "Back-to-back goalie evidence" });
  const early = page.getByRole("group", { name: "Early goalie window" });
  const late = page.getByRole("group", { name: "Late goalie window" });
  await expect(pairs.getByText(/Starter evidence is incompatible/)).toContainText("projected starts unknown");
  await expect(pairs.getByText(/Starter evidence is incompatible/)).toContainText("0 confirmed starts");
  await page.reload();
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  await expect(pairs.getByText(/Starter evidence is incompatible/)).toBeVisible();
  probability = 0.4;
  await page.reload();
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  await expect(pairs.getByText(/0.4 projected across 1\/2 evidenced games/)).toBeVisible();
  await expect(page.getByText(/Starter evidence is incompatible/)).toHaveCount(0);
  await expect(early).toContainText("Early · Mon–Thu");
  await expect(early).toContainText("0.4 projected across 1/1 evidenced games");
  await expect(late).toContainText("projected starts unknown");
  await openPlanningSetup(page);
  await page.getByRole("combobox", { name: "Split", exact: true }).selectOption("mon_wed");
  await expect(early).toContainText("No remaining scheduled games in this window.");
  await expect(late).toContainText("Late · Thu–Sun");
  await expect(late).toContainText("0.4 projected across 1/2 evidenced games");
  await expect(late).toContainText("1 goalie with unknown availability");
  await page.getByRole("button", { name: /Planning setup ·/ }).click();
  await expectDesktopFrameVisible(page);
  await page.screenshot({ path: testInfo.outputPath("goalie-windows-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Matchup", exact: true }).click();
  await late.scrollIntoViewIfNeeded();
  await expect(late).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("goalie-windows-mobile.png"), fullPage: true });
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
    await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
      data: { players, games, forecasts, evidence: {} } } }));
    await page.goto("/roster-schedule-optimizer");
    await expectQualityReadiness(page, mode === "assignment-only");
    const outcome = page.getByRole("region", { name: "Plan summary" }).locator("article").filter({ hasText: "Projected points" }).locator("strong");
    await expect(outcome).toHaveText("—");
    if (mode === "assignment-only") await expect(page.getByRole("table", { name: "Lineup by position" }).getByRole("button", { name: "Bravo Center, C, 2026-10-05", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Matchup", exact: true }).click();
    await expect(page.getByText(/Full comparison unavailable/)).toBeVisible();
    await page.getByText(/Forecast coverage ·/).click();
    await expect(page.getByText(/0\/2 comparison targets/)).toBeVisible();
    if (mode === "totals-only") await expect(page.getByText(/2\/2 totals targets/)).toBeVisible();
    const reason = mode === "unproven-lineage" ? "identity conflict" : "use not approved";
    await expect(page.getByText(new RegExp(`Alpha Center · game alpha · GOALS: ${reason}`))).toBeVisible();
    if (mode === "unproven-lineage") {
      await page.reload();
      await expectQualityReadiness(page, false);
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
  await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
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
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts: games.map((game, index) => ({ ...fixtureForecast(players[index], game, index ? 9 : 1),
      allowedUses: { assignment: !refreshed, totals: refreshed, comparison: false, conditionalTieBreak: false } })), evidence: {},
      forecastManifest: { version: "planning-forecasts-v1", id: refreshed ? "new" : "old", seasonId: 20262027,
        asOf: workspace.context.asOf, scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: [RSO_FIXTURE_BRIDGE],
        baselineChecksum: null, requiredOpportunities: 2, forecastedOpportunities: 2, exclusionCounts: { use_not_approved: 2 },
        exclusions: games.map((game, index) => ({ gameId: game.id, playerId: players[index].id, targetKey: "GOALS", reasons: ["use_not_approved"] })) } } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/provider", async route => {
    const late = switching;
    if (late) await heldProvider;
    const allowedUses = { assignment: !refreshed, totals: refreshed, comparison: false, conditionalTieBreak: false };
    return route.fulfill({ json: { success: true, snapshot: { id: refreshed ? "provider-new" : "provider-old",
      context: workspace.context, players: late ? players.map(player => ({ ...player, name: `Late First Account ${player.name}` })) : players, roster: workspace.roster, games,
      forecasts: games.map((game, index) => ({ ...fixtureForecast(players[index], game, index ? 9 : 1), allowedUses })),
      rules: workspace.rules, lockedAssignments: [], realized: {}, opponent: null, evidence: { schedule: { source: "Complete synthetic provider schedule", asOf: workspace.context.asOf, seasonId: 20262027, completeness: "complete", limitations: [] } },
      forecastManifest: { version: "planning-forecasts-v1", id: refreshed ? "new" : "old", seasonId: 20262027,
        asOf: workspace.context.asOf, scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: ["fixture"],
        baselineChecksum: null, requiredOpportunities: 2, forecastedOpportunities: 2, exclusionCounts: { use_not_approved: 2 },
        exclusions: games.map((game, index) => ({ gameId: game.id, playerId: players[index].id, targetKey: "GOALS", reasons: ["use_not_approved"] })) } },
      capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: true, limitations: [] } } });
  });
  await page.goto("/roster-schedule-optimizer");
  await openPlanDetails(page);
  await expectQualityReadiness(page, true);
  refreshed = true;
  await openPlanningSetup(page);
  await page.getByRole("button", { name: "Refresh provider" }).click();
  await expectQualityReadiness(page, false);
  await page.getByRole("button", { name: "Save to account" }).click();
  await expect(page.getByText("Saved to account.")).toBeVisible();
  expect(saved).toMatchObject({ forecastManifest: { id: "new", exclusions: [
    { gameId: "alpha", reasons: ["use_not_approved"] }, { gameId: "bravo", reasons: ["use_not_approved"] }] },
    forecasts: [{ allowedUses: { assignment: false, totals: true, comparison: false } },
      { allowedUses: { assignment: false, totals: true, comparison: false } }] });
  const beforeSwitch = await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!));
  switching = true;
  const providerRequest = page.waitForRequest("**/api/v1/roster-schedule-optimizer/provider");
  await openPlanningSetup(page);
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
  // The second account opens its own local slot (empty here), never the first account's retained inputs.
  await expect(page.getByRole("button", { name: "Refresh provider" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save to account" })).toHaveCount(0);
  expect((await canceledProvider).failure()?.errorText).toContain("ERR_ABORTED");
  const completedSave = page.waitForResponse(response => response.request() === pendingSaveRequest);
  releaseProvider(); releaseSave();
  await (await completedSave).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByText("Saved to account.")).toHaveCount(0);
  await expect(page.getByText(/Late First Account/)).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1:principal:00000000-0000-4000-8000-000000000001")!);
    return { intent: value.intent, roster: value.roster, lockedAssignments: value.lockedAssignments };
  })).toEqual({ intent: beforeSwitch.intent, roster: beforeSwitch.roster, lockedAssignments: beforeSwitch.lockedAssignments });
  releaseAccess();
  await expect(page.getByText("0 players", { exact: true })).toBeVisible();
  await expect(page.locator("#rso-roster-edit").getByRole("checkbox", { name: `Protect ${players[0].name}`, exact: true })).toHaveCount(0);
  const second = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "null") as PlanningWorkspace | null, workspaceStorageKey(secondUser));
  expect(second?.context.provider ?? "manual").toBe("manual");
  expect({ steps: second?.intent.steps ?? [], roster: second?.roster ?? [], manualPlayers: second?.manualPlayers ?? [] }).toEqual({ steps: [], roster: [], manualPlayers: [] });
  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("rso-switched-account.png") });
  await writeFile(testInfo.outputPath("rso-account-switch-browser.json"), JSON.stringify({ viewport: { width: 1180, height: 757 },
    accountReads, providerCanceled: true, staleSaveHidden: true, staleProviderHidden: true, firstAccountSlotPreserved: true,
    secondAccountStartsEmpty: true, pageErrors, inputs: "Fictional sessions and intercepted provider/workspace/access responses; SDK BroadcastChannel session switch", liveAccountParity: "not verified" }, null, 2));
});
test("conflicting forecasts keep capacity planning and show the affected target", async ({ page }, testInfo) => {
  const players = [fixturePlayer(1, "Alpha Center", "CAR"), fixturePlayer(2, "Bravo Center", "NJD")];
  const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 1, BN: 1 } });
  workspace.roster.push({ playerId: players[1].id, position: "bench" });
  const games = [fixtureGame("alpha", 5, "CAR"), fixtureGame("bravo", 5, "NJD")];
  const forecasts = games.map((game, index) => fixtureForecast(players[index], game, index ? 1 : 9));
  forecasts.push({ ...forecasts[0], revisionId: "conflict", stats: { GOALS: 3 } });
  await seedWorkspace(page, workspace);
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts, evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  await expectQualityReadiness(page, false);
  await showScheduleView(page, "itinerary");
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
  await setPlanningTime(page, "2026-10-05T00:00:00Z");
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
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts, evidence: {} } } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/roster-schedule-optimizer");
  await openPlanDetails(page);
  const itinerary = page.getByRole("region", { name: "Itinerary" });
  const minimum = page.getByRole("button", { name: /^Goalie starts / });
  const expectCoverage = async () => {
    await showScheduleView(page, "position");
    await expect(page.getByRole("table", { name: "Lineup by position" }).getByRole("button", { name: /^Coverage Goalie, G,/ })).toBeVisible();
    await openPlanDetails(page);
    const explanation = page.getByText("Why players are outside this assignment", { exact: true }).locator("..");
    if (!await explanation.evaluate(node => (node as HTMLDetailsElement).open)) await explanation.locator("summary").click();
    const bench = explanation.getByRole("article", { name: "Lower Penalty Goalie bench decision" });
    await expect(bench).toContainText("favors projected goalie coverage");
    await expect(bench).toContainText("selected -1; with Lower Penalty Goalie -0.5");
    await expect(bench).toContainText("selected 1; with Lower Penalty Goalie 0.25");
    await expect(bench).toContainText("Expected starts or appearances do not establish a satisfied minimum");
    await expect(minimum).toHaveText("Goalie starts 0/1");
  };
  await expectCoverage();
  await page.reload();
  await openPlanDetails(page);
  await expectCoverage();
  await page.getByText("League rules and scoring", { exact: true }).click();
  await page.getByLabel("Goalie credited", { exact: true }).fill("1");
  await expect(minimum).toHaveText("Goalie starts 1/1");
  await expect(itinerary).toContainText("Benching this appearance avoids a negative scoring contribution");
  await showScheduleView(page, "position");
  await expect(page.getByRole("table", { name: "Lineup by position" }).getByRole("button", { name: /^Coverage Goalie, G,/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const mode of ["manual", "connected"] as const) {
test(`unapproved retained inputs stay denied across worker reload, account save and borrowed-participation expiry (${mode})`, async ({ page }, testInfo) => {
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
    ? route.fallback() : route.abort());
  const now = "2026-09-29T00:00:00Z";
  await setPlanningTime(page, now);
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
  // Current rates arrive from the server read; embedded saved inputs alone are not a rate catalogue.
  let refreshedRates: PlanningSnapshot["baselineSources"] = [retained.forecasts[0].contributions!.GOALS.inputs!.baseline!];
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
    await page.route("**/api/v1/roster-schedule-optimizer/workspace**", async route => {
      if (route.request().method() === "PUT") {
        const request = route.request().postDataJSON();
        expect(snapshotSchema.safeParse(request.snapshot).success).toBe(true);
        saved = { workspace: request.workspace, snapshot: request.snapshot, version: 1, updatedAt: responseAsOf };
        await writeFile(testInfo.outputPath("saved-native-inputs.json"), JSON.stringify(saved, null, 2));
      }
      return route.fulfill({ json: { data: saved } });
    });
  }

  await seedWorkspace(page, workspace, mode === "connected" ? RSO_FIXTURE_PRINCIPAL : null);
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
    data: { players, games, forecasts: retained.forecasts, baselineSources: refreshedRates, forecastManifest, evidence: {} } } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/roster-schedule-optimizer");
  await openPlanDetails(page);
  const projected = page.getByRole("region", { name: "Plan summary" }).getByRole("article").filter({
    has: page.getByText("Projected points", { exact: true }) });
  await expectQualityReadiness(page, false);
  await expect(projected).toContainText("—");
  // These native revisions have no target approval. Serialized permissions and
  // retained participation cannot authorize numerical use on reload or refresh.
  await expect(page.getByRole("button", { name: "Best projected points", exact: true })).toBeDisabled();
  const expectUnapprovedCapacity = async () => {
    await showScheduleView(page, "position");
    await expect(page.getByRole("table", { name: "Lineup by position" }).getByRole("button", { name: /^Alpha Center, C,/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Best projected points", exact: true })).toBeDisabled();
    await expect(projected).toContainText("—");
  };
  await expectUnapprovedCapacity();
  if (mode === "connected") {
    await page.getByRole("button", { name: "Save to account" }).click();
    await expect(page.getByText("Saved to account.")).toBeVisible();
    expect(saved).toMatchObject({ snapshot: { forecasts: [{ sourceWatermark: "captured-reads",
      contributions: { GOALS: { allowedUses: { assignment: false, totals: false, comparison: false }, inputs: {
        detailed: { sourceWatermark: "captured-reads", issuedAt: "2026-09-28T01:00:00Z" },
        baseline: { sourceId: "alpha-rate", issuedAt: "2026-09-27T01:00:00Z", expiresAt: "2026-10-09T00:00:00Z" },
        participation: { issuedAt: "2026-09-28T01:00:00Z", expiresAt: "2026-09-30T00:00:00Z" } } } } }, {}] } });
    await page.getByRole("button", { name: "View account save" }).click();
    await expect(projected).toContainText("—");
    await expectUnapprovedCapacity();
  }

  await showScheduleView(page, "itinerary");
  await expect(page.getByRole("region", { name: "Itinerary" }).getByRole("table").first()).toContainText("Alpha Center");
  await page.reload();
  await openPlanDetails(page);
  await expectQualityReadiness(page, false);
  await expect(projected).toContainText("—");
  await expectUnapprovedCapacity();
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  const sources = page.getByRole("region", { name: "Matchup" }).locator("details").filter({
    has: page.getByText("Selected lineup · estimate sources", { exact: true }) });
  const expectSourceTimes = async (withAssists = false) => {
    if (!await sources.evaluate(node => (node as HTMLDetailsElement).open)) await sources.locator("summary").click();
    const goals = sources.getByRole("article", { name: "Alpha Center game 30 GOALS evidence" });
    await expect(goals.getByText(/^Detailed production input/)).toContainText("issued Sep 28, 1:00 AM UTC");
    await expect(goals.getByText(/^Participation input/)).toContainText("issued Sep 28, 1:00 AM UTC");
    await expect(goals).not.toContainText("Sep 29");
    // The selected evidence kind can change when an input is denied. Any displayed
    // baseline still has its original clock; account transport checks every input.
    if (await goals.getByText(/^Baseline rate input/).count()) {
      await expect(goals.getByText(/^Baseline rate input/)).toContainText("issued Sep 27, 1:00 AM UTC");
      await expect(goals.getByText(/^Baseline rate input/)).toContainText("expires Oct 9");
    }
    if (withAssists) {
      const assists = sources.getByRole("article", { name: "Alpha Center game 30 ASSISTS evidence" });
      await expect(assists.getByText(/^Baseline rate input/)).toContainText("issued Sep 29, 12:00 AM UTC");
      await expect(assists.getByText(/^Baseline rate input/)).toContainText("expires Oct 10");
      await expect(assists.getByText(/^Participation input/)).toContainText("issued Sep 28, 1:00 AM UTC");
      await expect(assists.getByText(/^Detailed production input/)).toHaveCount(0);
    }
  };
  await sources.locator("summary").click();
  await expect(sources).toContainText("Unavailable");
  await expect(sources).toContainText("Alpha Center · game 30 · GOALS");
  await expectSourceTimes();
  const originalRate = retained.forecasts[0].contributions!.GOALS.inputs!.baseline!;
  refreshedRates = [originalRate, ...players.map(row => ({ ...originalRate,
    playerId: Number(row.id), nhlPlayerId: row.nhlId!, sourceId: `assists-${row.id}`, targetKey: "ASSISTS",
    cutoffAt: "2026-09-28T23:00:00Z", issuedAt: "2026-09-29T00:00:00Z", expiresAt: "2026-10-10T00:00:00Z" }))];
  await openDisclosure(page, "Scoring, budgets, and lock windows");
  await page.getByRole("button", { name: "Add point weight", exact: true }).click();
  await page.getByLabel("Statistic", { exact: true }).nth(1).fill("ASSISTS");
  await page.getByLabel("Statistic", { exact: true }).nth(1).press("Tab");
  await page.reload();
  await openPlanDetails(page);
  await expectQualityReadiness(page, false);
  await expect(projected).toContainText("—");
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  await sources.locator("summary").click();
  await expect(sources).toContainText("Alpha Center · game 30 · ASSISTS");
  await expect(sources).toContainText("Unavailable");
  await expectSourceTimes(true);
  if (mode === "connected") {
    await page.getByRole("button", { name: "Save to account" }).click();
    await expect(page.getByText("Saved to account.")).toBeVisible();
    await page.getByRole("button", { name: "View account save" }).click();
    await expect(projected).toContainText("—");
    if (await sources.evaluate(node => (node as HTMLDetailsElement).open)) await sources.locator("summary").click();
    await sources.locator("summary").focus();
    await expect(sources.locator("summary")).toBeFocused();
    await page.keyboard.press("Enter");
    await expectSourceTimes(true);
    await expect(page.getByRole("region", { name: "Matchup" }).getByRole("button", { name: "Add opponent totals" })).toHaveCount(0);
  }
  forecastManifest = { ...forecastManifest, id: "policy-21", calendarPolicy: forecastCalendarPolicy(21) };
  await page.reload();
  await openPlanDetails(page);
  await expect(projected.locator("strong")).toHaveText("—");
  await page.getByRole("button", { name: "Matchup", exact: true }).click();
  await sources.locator("summary").click();
  await expect(sources).toContainText("Unavailable");
  await expectSourceTimes(true);
  forecastManifest = { ...forecastManifest, id: "news-refresh", acceptedNewsRevision: "opaque-news-receipts",
    issuedRevisionIds: ["detail-2"] };
  await page.reload();
  await openPlanDetails(page);
  await expectQualityReadiness(page, false);
  await expect(projected).toContainText("—");
  if (mode === "connected") {
    await page.getByRole("button", { name: "Save to account" }).click();
    await expect(page.getByText("Saved to account.")).toBeVisible();
    expect(saved).toMatchObject({ snapshot: { forecastManifest: { acceptedNewsRevision: "opaque-news-receipts",
      issuedRevisionIds: ["detail-2"] } } });
  }
  forecastManifest = { ...forecastManifest, id: "post-news", issuedRevisionIds: forecasts.map(row => row.revisionId) };
  responseAsOf = "2026-10-01T00:00:00Z";
  await setPlanningTime(page, responseAsOf);
  await page.reload();
  await openPlanDetails(page);
  await expectQualityReadiness(page, false);
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
  await installPlanningClock(page, { time: new Date("2026-10-04T00:00:00Z") });
  const owned = fixturePlayer(1, "Owned Center", "NJD");
  const low = { ...fixturePlayer(2, "Alpha Unknown", "CAR"), availability: "unknown" as const, eligibilityVerified: false };
  const high = { ...fixturePlayer(3, "Zeta Free Agent", "CAR"), eligiblePositions: ["C", "Util"], availability: "free_agent" as const };
  const missing = { ...fixturePlayer(4, "Delta Defender", "SEA"), eligiblePositions: ["D"], availability: "unknown" as const };
  const members = [owned, low, high, missing];
  const games = [fixtureGame("NJD5", 5, "NJD"), fixtureGame("CAR5", 5, "CAR"), fixtureGame("CAR6", 6, "CAR"), fixtureGame("SEA6", 6, "SEA")];
  const forecasts = games.flatMap(game => members.filter(member => member.id !== missing.id && member.teamAbbreviation === game.teamAbbreviation)
    .map(member => fixtureForecast(member, game, member.id === high.id ? 10 : 2)));
  const rules = { ...fixtureRules, rosterSlots: { C: 1, UTIL: 1, D: 1 }, periods: [] };
  await seedWorkspace(page, fixtureWorkspace(members, rules));
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts, evidence: {} } } }));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    (window as any).__feedbackPlanEvidence = [];
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener("message", event => {
          if (event.data.result) (window as any).__feedbackPlanEvidence.push({ activeGames: event.data.result.selected.activeGames,
            limitations: event.data.result.selected.limitations, intentRevision: event.data.result.intentRevision });
        });
      }
    };
  });
  await page.goto("/roster-schedule-optimizer");
  const browser = page.getByRole("region", { name: "Candidate browser" });
  await openDisclosure(page, "Find & filter");
  await browser.getByRole("button", { name: "By Team", exact: true }).click();
  await expect(browser.getByText("CAR · 2 players", { exact: true })).toBeVisible();
  await expect(page.getByText("Selected moves are a plan. Confirm roster changes with your provider.")).toHaveCount(0);
  await openPlanDetails(page);
  const adds = page.getByLabel("Planned adds", { exact: true });
  await expect(adds).toContainText("Planned adds: 0");
  await expect(adds).toContainText("Allowance unknown");
  await browser.getByText("CAR · 2 players", { exact: true }).click();
  await expect(browser.getByText("CAR · C/Util", { exact: true })).toBeVisible();
  await expect(browser.locator("button").filter({ hasText: /^(Zeta Free Agent|Alpha Unknown)/ }).first()).toContainText("Zeta Free Agent");
  // Gross fixture ability is not an authorized net plan when the allowance is unknown.
  expect(forecasts.filter(row => row.playerId === high.id).reduce((sum, row) => sum + row.stats.GOALS!, 0)).toBe(20);
  await expect(browser.getByRole("region", { name: "Net plan comparison" })).toHaveCount(0);
  await expect(browser.getByText("Net Pts", { exact: true })).toHaveCount(0);
  await openDisclosure(page, /^Why some players aren't ranked$/);
  await expect(browser.getByRole("list", { name: "Why some players aren't ranked" })).toContainText("Your league's add rules (timing or moves left) aren't set yet.");
  await browser.getByRole("button", { name: /Zeta Free Agent/ }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("rso-feedback-by-team.png"), fullPage: true });
  await openDisclosure(page, "Find & filter");
  await browser.getByRole("button", { name: "All players", exact: true }).click();
  await expect(browser.getByRole("button", { name: /Zeta Free Agent/ })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("rso-feedback-all-players.png"), fullPage: true });
  await browser.getByRole("combobox", { name: "Position", exact: true }).selectOption("UTIL");
  await expect(browser.getByRole("button", { name: /Alpha Unknown/ })).toHaveCount(0);
  await browser.getByRole("combobox", { name: "Position", exact: true }).selectOption("");
  await browser.getByRole("combobox", { name: "Team", exact: true }).selectOption("SEA");
  await expect(browser.getByText("Net Pts", { exact: true })).toHaveCount(0);
  await expect(browser.getByRole("list", { name: "Why some players aren't ranked" })).toContainText("Your league's add rules (timing or moves left) aren't set yet.");
  await expect(browser.getByRole("button", { name: "Select add", exact: true })).toHaveCount(0);
  await browser.getByRole("combobox", { name: "Team", exact: true }).selectOption("CAR");
  await browser.getByRole("searchbox", { name: "Find candidate" }).fill("Alpha");
  await expect(browser.getByRole("button", { name: "Select add", exact: true })).toHaveCount(0);
  await browser.getByRole("button", { name: /Alpha Unknown/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Candidates and detail" }).getByText("Alpha Unknown", { exact: true }).first()).toBeVisible();
  await browser.getByRole("button", { name: "Mark available", exact: true }).click();
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!) as PlanningWorkspace);
  expect((await stored()).manualPlayers.find(member => member.id === low.id)).toMatchObject({ availability: "manager_available", eligibilityVerified: false });
  await browser.getByRole("button", { name: "Select add", exact: true }).click();
  const selectedIntent = (await stored()).intent;
  const detail = page.getByRole("region", { name: "Candidates and detail" });
  await detail.getByText("Review evidence", { exact: true }).click();
  await expect(detail.getByRole("checkbox", { name: "Manager confirms league positions" })).not.toBeChecked();
  await detail.getByLabel("Eligible positions", { exact: true }).fill("C, LW");
  await detail.getByLabel("Eligible positions", { exact: true }).blur();
  await expect.poll(async () => (await stored()).manualPlayers.find(member => member.id === low.id)).toMatchObject({ eligiblePositions: ["C", "LW"], eligibilityVerified: true });
  expect((await stored()).intent).toEqual(selectedIntent);
  await expect(adds).toContainText("Planned adds: 1");
  await expect(adds).toContainText("Allowance unknown");
  const activeGames = page.getByRole("region", { name: "Plan summary" }).locator("article").filter({ has: page.getByText("Active games", { exact: true }) }).locator("strong");
  // A saved proposed add does not join the evaluated roster without a covering acquisition period.
  await expect.poll(async () => (await activeGames.innerText()).split(" / ")[0]).toBe("1");
  await expect.poll(() => page.evaluate(() => (window as any).__feedbackPlanEvidence.some((row: any) =>
    row.activeGames === 1 && row.limitations.some((text: string) => text.includes("No acquisition period covers"))))).toBe(true);
  await writeFile(testInfo.outputPath("candidate-feedback-evidence.json"), JSON.stringify({
    sourceGrossPoints: 20, selectedIntent, worker: await page.evaluate(() => (window as any).__feedbackPlanEvidence),
  }, null, 2));
  await page.screenshot({ path: testInfo.outputPath("rso-feedback-desktop.png"), fullPage: true });
  await page.reload();
  await openDisclosure(page, "Find & filter");
  await page.getByRole("button", { name: "All players", exact: true }).click();
  await browser.getByRole("searchbox", { name: "Find candidate" }).fill("Alpha");
  await browser.getByRole("button", { name: /Alpha Unknown/ }).click();
  await detail.getByText("Review evidence", { exact: true }).click();
  await expect(detail.getByLabel("Eligible positions", { exact: true })).toHaveValue("C, LW");
  await expect(detail.getByRole("checkbox", { name: "Manager confirms league positions" })).toBeChecked();
  expect((await stored()).intent).toEqual(selectedIntent);
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
  await installPlanningClock(page, { time: new Date("2026-10-04T00:00:00Z") });
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
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts, evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  const browser = page.getByRole("region", { name: "Candidate browser" });
  await openDisclosure(page, "Find & filter");
  await browser.getByRole("button", { name: "All players", exact: true }).click();
  const order = browser.locator("button").filter({ hasText: /^(Four Low Value Games|Three High Value Games)/ });
  await expect(order.first()).toContainText("Three High Value Games");
  await expect(browser.locator('[data-rso-candidate-id="fhfh:3"]').getByText("Net Pts", { exact: true }).locator("..").locator("strong")).toHaveText("+26");
  await expect(browser.locator('[data-rso-candidate-id="fhfh:2"]').getByText("Net AGP", { exact: true }).locator("..").locator("strong")).toHaveText("+2");
  await order.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("rso-projected-fit.png"), fullPage: true });
  await browser.getByRole("button", { name: "By more starts", exact: true }).click();
  await expect(order.first()).toContainText("Four Low Value Games");
  await expect(browser.getByRole("button", { name: "By more starts", exact: true })).toHaveAttribute("aria-pressed", "true");
  await order.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("rso-schedule-first.png"), fullPage: true });
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts: forecasts.filter(row => row.playerId !== owned.id), evidence: {} } } }));
  await page.reload();
  await openDisclosure(page, "Find & filter");
  await browser.getByRole("button", { name: "All players", exact: true }).click();
  await expect(browser.locator('[data-rso-candidate-id="fhfh:2"]').getByText("Net Pts", { exact: true }).locator("..").locator("strong")).toHaveText("—");
  await expect(browser.locator('[data-rso-candidate-id="fhfh:3"]').getByText("Net Pts", { exact: true }).locator("..").locator("strong")).toHaveText("—");
  expect(errors).toEqual([]);
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
});

test("planning worker measures the full typical workload and cancels superseded edits", async ({ page }, testInfo) => {
  await setPlanningTime(page, new Date("2026-10-04T00:00:00Z"));
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
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts, evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  await openPlanningSetup(page);
  const goalieChoice = page.getByRole("combobox", { name: "Goalie choice", exact: true });
  await goalieChoice.evaluate(element => element.addEventListener("change", () => (window as any).__planningPerformance.edits.push({ at: performance.now(), value: (element as HTMLSelectElement).value })));
  const planner = (revision: number) => page.evaluate(revision => (window as any).__planningPerformance.workers.find((row: any) => row.role === "planner" && row.roster === 25 && row.context.endDate === "2026-10-11" && row.revision === revision), revision);
  await expect.poll(() => planner(1)).toMatchObject({ role: "planner", roster: 25 });
  await goalieChoice.selectOption("cover");
  await expect.poll(() => planner(2)).toMatchObject({ activeGames: 70, dates });
  const outcome = page.getByRole("region", { name: "Plan summary" }).locator("article").filter({ has: page.getByText("Projected points", { exact: true }) }).locator("strong");
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
          if (event.data.metrics) (window as any).__candidatePerformance.push({ elapsedMs: performance.now() - started, ticks, maxGapMs, search: event.data.metrics.search,
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
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts, evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  const browser = page.getByRole("region", { name: "Candidate browser" });
  await openDisclosure(page, "Find & filter");
  await browser.getByRole("button", { name: "All players", exact: true }).click();
  const best = browser.getByRole("button", { name: /^Last Candidate Best Quality,/ });
  await expect(best).toBeVisible();
  await expect(browser.locator('[data-rso-candidate-id="fhfh:1000"]').getByText("Net AGP", { exact: true }).locator("..").locator("strong")).toHaveText("0");
  await expect(browser.locator('[data-rso-candidate-id="fhfh:1000"]').getByText("Net Pts", { exact: true }).locator("..").locator("strong")).toHaveText("+16");
  await expect(browser.locator("[data-rso-candidate-id]").first()).toHaveAttribute("data-rso-candidate-id", "fhfh:1000");
  await browser.getByRole("searchbox", { name: "Find candidate" }).fill("Candidate 42");
  await expect(best).toHaveCount(0);
  await expect(browser.getByRole("button", { name: /Candidate 42/ }).first()).toBeVisible();
  const metrics = await page.evaluate(() => (window as any).__candidatePerformance);
  await writeFile(testInfo.outputPath("candidate-performance.json"), JSON.stringify(metrics, null, 2));
  // Released bounded search admits the full population, then scores a capped shortlist.
  const completePopulation = metrics.find((row: any) => row.search?.eligibleCandidates === 999);
  expect(completePopulation).toBeDefined();
  expect(completePopulation.search.candidates).toBeLessThanOrEqual(40);
  expect(completePopulation.search.evaluated).toBeLessThanOrEqual(160);
  expect(completePopulation.search.complete).toBe(false);
  expect(completePopulation.ticks).toBeGreaterThan(0);
  expect(completePopulation.maxGapMs).toBeLessThan(500);
  await browser.getByRole("searchbox", { name: "Find candidate" }).fill("");
  await page.screenshot({ path: testInfo.outputPath("rso-worker-zero-agp.png"), fullPage: true });
});

test("Audit1 native candidate Worker finds complete swaps before any plan is selected", async ({ page }, testInfo) => {
  await page.route("**/api/**", route => route.request().url().includes("/roster-schedule-optimizer/")
    ? route.fallback() : route.fulfill({ json: {} }));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    (window as any).__auditCandidateResults = [];
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener("message", event => {
          if (event.data.metrics) (window as any).__auditCandidateResults.push(event.data.metrics);
        });
      }
    };
  });
  const owned = [fixturePlayer(1, "Owned Strong", "NJD"), fixturePlayer(2, "Owned Second", "NJD"), fixturePlayer(3, "Owned Weak", "NJD")];
  const candidates = Array.from({ length: 41 }, (_, index) => fixturePlayer(100 + index,
    index === 40 ? "Strongest Last Candidate" : `Audit Candidate ${index}`, "NJD"));
  const players = [...owned, ...candidates], game = fixtureGame("audit-native-game", 5, "NJD");
  const forecasts = players.map((member, index) => fixtureForecast(member, game,
    [100, 90, 1][index] ?? (index === 43 ? 1000 : 10)));
  const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 3, BN: 0 } });
  workspace.roster = owned.map(member => ({ playerId: member.id, position: "active" }));
  workspace.context.endDate = date(5);
  workspace.intent.steps = [];
  await seedWorkspace(page, workspace);
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
    data: { players, games: [game], forecasts, evidence: { schedule: { source: "complete synthetic Audit1 universe",
      asOf: workspace.context.asOf, seasonId: 20262027, completeness: "complete", limitations: [] } } } } }));
  await page.goto("/roster-schedule-optimizer");
  await expect.poll(() => page.evaluate(() => (window as any).__auditCandidateResults.length)).toBeGreaterThan(0);
  const metrics = await page.evaluate(() => (window as any).__auditCandidateResults.at(-1));
  expect(metrics.baseline.projectedPoints).toBe(191);
  expect(metrics.search).toMatchObject({ candidates: 40, eligibleCandidates: 41, complete: false });
  expect(metrics.search.evaluated).toBeLessThanOrEqual(160);
  const strongest = metrics.candidates.find((candidate: any) => candidate.playerId === "fhfh:140");
  expect(strongest.plans.some((plan: any) => plan.netPoints === 999 && plan.steps[0].dropPlayerId === "fhfh:3")).toBe(true);
  const card = page.locator('[data-rso-candidate-id="fhfh:140"]');
  await expect(card.getByText("Net Pts", { exact: true }).locator("..").locator("strong")).toHaveText("+999");
  await expect(card).toContainText("Owned Weak");
  await expect(card.getByRole("button", { name: /^Preview swap: add Strongest Last Candidate, drop Owned Weak$/ })).toBeDisabled();
  await page.getByText("League rules and scoring", { exact: true }).click();
  await page.getByRole("button", { name: "Confirm planning inputs" }).click();
  await page.getByText("League rules and scoring", { exact: true }).click();
  await expect(card.getByRole("button", { name: /^Preview swap: add Strongest Last Candidate, drop Owned Weak$/ })).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!).intent.steps)).toEqual([]);
  await writeFile(testInfo.outputPath("audit1-native-worker.json"), JSON.stringify({
    scope: "Native browser Worker and served local UI; intercepted synthetic inputs, not genuine feed acceptance", metrics,
  }, null, 2));
});

function compactWorkspace(count: number) {
  const positions = ["C", "C", "LW", "LW", "RW", "RW", "D", "D", "D", "D", "C", "LW", "G", "G"];
  const players = Array.from({ length: count === 19 ? 20 : count }, (_, index) => ({ ...fixturePlayer(index + 1, `Compact Surname${index + 1}`, "CAR"),
    eligiblePositions: index === 0 ? ["C", "LW"] : [positions[index] ?? "C"], playerClass: positions[index] === "G" ? "goalie" as const : "skater" as const,
    reserveEligibility: ["IR", "IR+"] as Array<"IR" | "IR+"> }));
  const workspace = fixtureWorkspace(players, { ...fixtureRules, rosterSlots: { C: 2, LW: 2, RW: 2, D: count === 19 ? 3 : 4, UTIL: 2, G: 2, BN: count >= 25 ? count - 16 : 6, IR: 1, "IR+": 1 } });
  workspace.context.endDate = "2026-10-11";
  workspace.roster = players.filter((_, index) => count !== 19 || index !== 9).map(player => { const index = players.indexOf(player); return { playerId: player.id,
    position: count >= 25 && index >= count - 2 ? index === count - 2 ? "IR" : "IR+" : index < 14 ? "active" : "bench" }; });
  workspace.intent.protectedPlayerIds = [players[0].id];
  workspace.lockedAssignments = [{ date: "2026-10-07", playerId: players[0].id, slotId: "C#1" }, ...workspace.roster.filter(row => row.position === "bench").map(row => ({ date: "2026-10-07", playerId: row.playerId, slotId: null }))];
  const games = Array.from({ length: 7 }, (_, index) => ({ ...fixtureGame(`compact-${index}`, 5, "CAR"), date: `2026-10-${String(index + 5).padStart(2, "0")}`, startsAt: `2026-10-${String(index + 5).padStart(2, "0")}T23:00:00Z` }));
  return { workspace, players, games };
}
async function openCompactControls(page: import("@playwright/test").Page) {
  await showScheduleView(page, "player");
  await openDisclosure(page, /^Date controls$/);
  await openDisclosure(page, /^Day capacity/);
}
async function installCompactFixture(page: import("@playwright/test").Page, count: number, customize?: (fixture: ReturnType<typeof compactWorkspace>) => void) {
  const fixture = compactWorkspace(count);
  customize?.(fixture);
  await setPlanningTime(page, new Date("2026-10-07T12:00:00Z"));
  await seedWorkspace(page, fixture.workspace);
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players: fixture.players, games: fixture.games, forecasts: [], evidence: {
    schedule: { source: "fictional compact fixture", asOf: "2026-10-07T12:00:00Z", seasonId: 20262027, completeness: "complete", limitations: [] },
  } } } }));
  await page.goto("/roster-schedule-optimizer");
  await openCompactControls(page);

  await expect(page.getByRole("slider", { name: "Selected planning day" })).toHaveAttribute("aria-valuetext", "Wed, Oct 7");
  await expect(page.getByText("Range totals", { exact: true })).toBeVisible();
  return fixture;
}
const alignmentObservations = new WeakMap<import("@playwright/test").Page, unknown[]>();
async function expectDaySliderAligned(page: import("@playwright/test").Page) {
  const slider = page.getByRole("slider", { name: "Selected planning day" });
  const thumbCenter = await slider.evaluate(node => {
    const input = node as HTMLInputElement, box = input.getBoundingClientRect();
    const min = Number(input.min), max = Number(input.max);
    return box.left + 8 + (box.width - 16) * (max === min ? 0 : (Number(input.value) - min) / (max - min));
  });
  const date = await slider.getAttribute("aria-valuetext");
  const headerCenter = await page.getByRole("button", { name: `Select ${date}`, exact: true }).evaluate(node => {
    const box = node.closest("th")!.getBoundingClientRect(); return box.left + box.width / 2;
  });
  {
    const geometry = await page.evaluate(() => Object.fromEntries(["scheduleLegend", "dayControls", "compactScroll", "compactTable"].map(name => {
      const node = document.querySelector(`[class*="${name}"]`) as HTMLElement | null;
      return [name, node ? { rect: node.getBoundingClientRect().toJSON(), padding: getComputedStyle(node).padding, width: getComputedStyle(node).width } : null];
    })));
    const selectedHeader = await page.getByRole("button", { name: `Select ${date}`, exact: true }).evaluate(node => node.closest("th")!.getBoundingClientRect().toJSON());
    const observation = { date, viewport: page.viewportSize(), thumbCenter, headerCenter, delta: Math.abs(thumbCenter - headerCenter), geometry, selectedHeader };
    const observations = [...(alignmentObservations.get(page) ?? []), observation];
    alignmentObservations.set(page, observations);
    await writeFile(test.info().outputPath("slider-alignment-observations.json"), JSON.stringify(observations, null, 2));
    if (observation.delta > 1) await writeFile(test.info().outputPath("slider-alignment-failure.json"), JSON.stringify(observation, null, 2));
  }
  expect(Math.abs(thumbCenter - headerCenter)).toBeLessThanOrEqual(1);
}

for (const count of [19, 20, 29]) test(`compact layout accounts for ${count} slots with a maximum of 20 slot rows and internal labels`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCompactFixture(page, count);
  await expectDaySliderAligned(page);
  const table = page.getByRole("table", { name: "Individual player weekly schedule" });
  await expect(table.locator('tr[data-player-id]')).toHaveCount(count);
  await expect(table.locator('tr[data-compact-row]')).toHaveCount(count);
  await expect(page.getByRole("heading", { name: "Current Roster" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Best Fit Available" })).toBeVisible();
  const metrics = await table.evaluate(node => {
    const viewport = node.parentElement!.getBoundingClientRect();
    const bodyTop = Math.max(viewport.top, node.querySelector("thead")!.getBoundingClientRect().bottom);
    const rows = [...node.querySelectorAll('tr[data-compact-row]:not([hidden])')];
    return { visibleRows: rows.filter(row => { const box = row.getBoundingClientRect(); return box.top >= bodyTop && box.bottom <= viewport.bottom; }).length,
      visiblePlayers: rows.filter(row => { const box = row.getBoundingClientRect(); return row.hasAttribute("data-player-id") && box.top >= bodyTop && box.bottom <= viewport.bottom && box.left >= viewport.left && box.right <= viewport.right; }).length,
      rowHeights: rows.map(row => row.getBoundingClientRect().height),
      scrollHeight: node.parentElement!.scrollHeight, clientHeight: node.parentElement!.clientHeight,
      firstRowTop: rows[0]?.getBoundingClientRect().top, lastRowBottom: rows.at(-1)?.getBoundingClientRect().bottom, viewportTop: viewport.top, viewportBottom: viewport.bottom,
      playerIds: rows.map(row => row.getAttribute("data-player-id")).filter(Boolean),
      groups: [...node.querySelectorAll("tbody")].map(group => ({ position: group.getAttribute("data-position"), band: getComputedStyle(group).borderLeftColor,
        width: getComputedStyle(group).borderLeftWidth, style: getComputedStyle(group).borderLeftStyle,
        topLeftRadius: getComputedStyle(group).borderTopLeftRadius, bottomLeftRadius: getComputedStyle(group).borderBottomLeftRadius, rightRadius: getComputedStyle(group).borderTopRightRadius,
        outlineColors: [getComputedStyle(group).borderTopColor, getComputedStyle(group).borderRightColor, getComputedStyle(group).borderBottomColor],
        outlineWidths: [getComputedStyle(group).borderTopWidth, getComputedStyle(group).borderRightWidth, getComputedStyle(group).borderBottomWidth],
        label: group.getAttribute("data-label"), renderedLabel: (() => {
          const label = group.querySelector('[data-position-label] > span');
          const cell = group.querySelector('tr[data-compact-row] th[scope="row"]');
          if (!label || !cell) return null;
          const box = label.getBoundingClientRect(), container = cell.getBoundingClientRect();
          const band = group.getBoundingClientRect();
          const control = group.querySelector('tr[data-bench-heading] button')?.getBoundingClientRect();
          const player = cell.querySelector('button')?.getBoundingClientRect();
          return { text: label.textContent?.trim(), width: box.width, height: box.height, fontSize: getComputedStyle(label).fontSize,
            left: box.left, right: box.right, top: box.top, bottom: box.bottom,
            bandLeft: band.left, bandRight: band.left + parseFloat(getComputedStyle(group).borderLeftWidth), bandTop: band.top, bandBottom: band.bottom,
            color: getComputedStyle(label).color, panelColor: getComputedStyle(node.closest("section")!).backgroundColor,
            cellLeft: container.left, cellRight: container.right, transform: getComputedStyle(label).transform,
            controlRight: control?.right, playerLeft: player?.left };
        })(),
        before: getComputedStyle(group, "::before").content, after: getComputedStyle(group, "::after").content,
        contentInset: Math.min(...[...group.querySelectorAll('th[scope="row"]')].map(cell => cell.getBoundingClientRect().left - group.getBoundingClientRect().left)) })) };
  });
  expect(new Set(metrics.playerIds).size).toBe(count);
  expect(metrics.groups.map(group => group.position)).toEqual(count >= 25 ? ["C", "LW", "RW", "D", "UTIL", "G", "BENCH", "IR", "IR+"] : ["C", "LW", "RW", "D", "UTIL", "G", "BENCH"]);
  expect(metrics.groups.find(group => group.position === "RW")?.band).toBe("rgb(167, 139, 250)");
  for (const group of metrics.groups) {
    expect(group.width).toBe("28px"); expect(group.style).toBe("solid");
    expect(group.topLeftRadius).toBe("10px"); expect(group.bottomLeftRadius).toBe("10px"); expect(group.rightRadius).toBe("10px");
    expect(group.outlineColors).toEqual([group.band, group.band, group.band]); expect(group.outlineWidths).toEqual(["1px", "1px", "1px"]);
    expect(group.label).toBe(group.position);
    expect(group.before).toBe("none"); expect(group.after).toBe("none");
    expect(group.renderedLabel?.text).toContain(group.label);
    expect(group.renderedLabel?.width).toBeGreaterThan(0); expect(group.renderedLabel?.height).toBeGreaterThanOrEqual(11);
    expect(group.renderedLabel?.fontSize).toBe("12px");
    expect(group.renderedLabel?.transform).toBe(["UTIL", "BENCH"].includes(group.position!) ? "matrix(0, -1, 1, 0, 0, 0)" : "none");
    expect(group.renderedLabel!.color).toBe(group.renderedLabel!.panelColor);
    expect(group.renderedLabel!.left).toBeGreaterThanOrEqual(group.renderedLabel!.bandLeft);
    expect(group.renderedLabel!.right).toBeLessThanOrEqual(group.renderedLabel!.bandRight);
    expect(group.renderedLabel!.top).toBeGreaterThanOrEqual(group.renderedLabel!.bandTop);
    expect(group.renderedLabel!.bottom).toBeLessThanOrEqual(group.renderedLabel!.bandBottom);
    if (group.position === "BENCH") expect(group.renderedLabel!.controlRight).toBeLessThanOrEqual(group.renderedLabel!.playerLeft!);
    expect(group.contentInset).toBeGreaterThanOrEqual(28);
  }
  // Released Release C contract, independently pinned in RSO-SUMMARY-ORACLE-RECONCILIATION.json.
  for (const label of ["Active games", "Bench games", "Projected points"]) {
    await expect(page.getByRole("region", { name: "Plan summary" }).getByText(label, { exact: true })).toBeVisible();
  }
  const articleBorders = await page.getByRole("region", { name: "Plan summary" }).locator("article").evaluateAll(nodes => nodes.map(node => ({
    width: getComputedStyle(node).borderLeftWidth, style: getComputedStyle(node).borderLeftStyle,
    topLeftRadius: getComputedStyle(node).borderTopLeftRadius, bottomLeftRadius: getComputedStyle(node).borderBottomLeftRadius,
    band: getComputedStyle(node).borderLeftColor, outlineColors: [getComputedStyle(node).borderTopColor, getComputedStyle(node).borderRightColor, getComputedStyle(node).borderBottomColor],
    outlineWidths: [getComputedStyle(node).borderTopWidth, getComputedStyle(node).borderRightWidth, getComputedStyle(node).borderBottomWidth],
    accentWidth: getComputedStyle(node, "::before").width, accentColor: getComputedStyle(node, "::before").backgroundColor,
    before: getComputedStyle(node, "::before").content, after: getComputedStyle(node, "::after").content,
  })));
  expect(articleBorders).toHaveLength(3);
  for (const border of articleBorders) {
    expect(border.width).toBe("1px"); expect(border.style).toBe("solid"); expect(border.topLeftRadius).toBe("10px"); expect(border.bottomLeftRadius).toBe("10px");
    expect(border.outlineColors).toEqual([border.band, border.band, border.band]); expect(border.outlineWidths).toEqual(["1px", "1px", "1px"]);
    expect(border.before).toBe('""'); expect(border.accentWidth).toBe("4px");
    expect(border.accentColor).not.toBe("rgba(0, 0, 0, 0)"); expect(border.after).toBe("none");
  }
  await writeFile(testInfo.outputPath(`compact-${count}-metrics.json`), JSON.stringify(metrics, null, 2));
  for (const height of metrics.rowHeights) { expect(height).toBeGreaterThanOrEqual(28); expect(height).toBeLessThanOrEqual(48); }
  expect(metrics.visibleRows).toBeLessThanOrEqual(20);
  expect(metrics.visibleRows).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1442);
  await expectDesktopFrameVisible(page);
  await page.screenshot({ path: testInfo.outputPath(`compact-${count}-1440x900.png`) });
  await table.locator('tbody[data-position="RW"]').screenshot({ path: testInfo.outputPath("compact-rw-border.png") });
  await page.getByRole("region", { name: "Plan summary" }).locator("article").first().screenshot({ path: testInfo.outputPath("compact-article-border.png") });
  if (count >= 25) {
    const scroll = page.getByRole("region", { name: "Player weekly schedule scroll area" });
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    await scroll.focus(); await page.keyboard.press("End");
    await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    const lastPlayer = table.getByRole("button", { name: new RegExp(`Schedule details for Compact Surname${count},`) });
    await lastPlayer.focus(); await expect(lastPlayer).toBeFocused();
    const end = await table.evaluate(node => {
      const viewport = node.parentElement!.getBoundingClientRect();
      const header = node.querySelector("thead")!.getBoundingClientRect();
      const last = [...node.querySelectorAll('tr[data-player-id]')].at(-1)!.getBoundingClientRect();
      const visibleRows = [...node.querySelectorAll('tr[data-compact-row]:not([hidden])')].filter(row => {
        const box = row.getBoundingClientRect(); return box.top >= header.bottom && box.bottom <= viewport.bottom;
      }).length;
      return { top: viewport.top, bottom: viewport.bottom, headerTop: header.top, headerBottom: header.bottom, lastTop: last.top, lastBottom: last.bottom, visibleRows };
    });
    expect(end.headerTop).toBeGreaterThanOrEqual(end.top - 1);
    expect(end.headerBottom).toBeLessThan(end.bottom);
    expect(end.lastTop).toBeGreaterThanOrEqual(end.headerBottom);
    expect(end.lastBottom).toBeLessThanOrEqual(end.bottom);
    expect(end.visibleRows).toBeLessThanOrEqual(20);
    await expectDesktopFrameVisible(page);
    await page.screenshot({ path: testInfo.outputPath(`compact-${count}-scrolled-1440x900.png`) });
    for (const [width, height] of [[1920, 1080], [1440, 720], [390, 844], [1000, 1600]]) {
      await page.setViewportSize({ width, height });
      await scroll.evaluate(node => { node.scrollTop = 0; });
      const density = await table.evaluate(node => {
        const viewport = node.parentElement!.getBoundingClientRect();
        const header = node.querySelector("thead")!.getBoundingClientRect();
        const rows = [...node.querySelectorAll('tr[data-compact-row]:not([hidden])')];
        return { total: rows.length, visible: rows.filter(row => {
          const box = row.getBoundingClientRect(); return box.top >= header.bottom && box.bottom <= viewport.bottom;
        }).length, heights: rows.map(row => row.getBoundingClientRect().height) };
      });
      expect(density.total).toBe(count); expect(density.visible).toBeLessThanOrEqual(20);
      expect(density.visible).toBeGreaterThan(0);
      expect(density.heights.every(height => height >= 28 && height <= 48)).toBe(true);
      if (width > 1100) await expectDesktopFrameVisible(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await writeFile(testInfo.outputPath(`compact-${count}-${width}x${height}-density.json`), JSON.stringify(density, null, 2));
      await page.screenshot({ path: testInfo.outputPath(`compact-${count}-${width}x${height}.png`) });
      await scroll.focus();
      await lastPlayer.focus(); await expect(lastPlayer).toBeFocused();
      await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    }
  }
  if (count === 20) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expectDesktopFrameVisible(page);
    expect(await table.locator('[data-player-id]').evaluateAll(rows => rows.every(row => {
      const box = row.getBoundingClientRect(), parent = row.closest("table")!.parentElement!.getBoundingClientRect();
      return box.top >= parent.top && box.bottom <= parent.bottom;
    }))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("compact-20-1920x1080.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(table).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("compact-20-390x844.png") });
  }
  const scroll = page.getByRole("region", { name: "Player weekly schedule scroll area" });
  await scroll.focus();
  const focusedStates = [];
  for (const button of await table.getByRole("button", { name: /Schedule details for Compact/ }).all()) {
    await button.focus(); await expect(button).toBeFocused();
    const state = await button.evaluate(node => {
      const box = node.getBoundingClientRect(), table = node.closest("table")!;
      const area = table.parentElement!.getBoundingClientRect(), header = table.querySelector("thead")!.getBoundingClientRect();
      const visible = [...table.querySelectorAll('tr[data-compact-row]:not([hidden])')].filter(row => {
        const bounds = row.getBoundingClientRect(); return bounds.top >= header.bottom && bounds.bottom <= area.bottom;
      }).length;
      return { playerId: node.closest("tr")!.getAttribute("data-player-id"), scrollTop: table.parentElement!.scrollTop,
        visible, top: box.top, bottom: box.bottom, headerBottom: header.bottom, areaBottom: area.bottom };
    });
    expect(state.top).toBeGreaterThanOrEqual(state.headerBottom); expect(state.bottom).toBeLessThanOrEqual(state.areaBottom);
    expect(state.visible).toBeLessThanOrEqual(20);
    focusedStates.push(state);
  }
  await writeFile(testInfo.outputPath(`compact-${count}-focused-states.json`), JSON.stringify(focusedStates, null, 2));
});

test("compact day and bench controls preserve saved intent and keyboard selection", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCompactFixture(page, 20, ({ workspace }) => {
    workspace.rules.rosterSlots.BN = 0;
    workspace.roster = workspace.roster.map(member => ({ ...member, position: "active" }));
    workspace.lockedAssignments = (workspace.lockedAssignments ?? []).filter(lock => lock.slotId !== null);
  });
  const table = page.getByRole("table", { name: "Individual player weekly schedule" });
  const stored = await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"));
  const calls: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) calls.push(request.method() + " " + request.url()); });
  const slider = page.getByRole("slider", { name: "Selected planning day" });
  const dates = ["Mon, Oct 5", "Tue, Oct 6", "Wed, Oct 7", "Thu, Oct 8", "Fri, Oct 9", "Sat, Oct 10", "Sun, Oct 11"];
  const viewportMetrics: Array<{ date: string; totalRows: number; visibleRows: number; clientHeight: number; scrollHeight: number }> = [];
  for (const label of dates) {
    const header = page.getByRole("button", { name: `Select ${label}` });
    await header.focus(); await page.keyboard.press("Enter");
    await expect(slider).toHaveAttribute("aria-valuetext", label);
    await expect(header).toHaveAttribute("aria-pressed", "true");
    await expect(header).toBeFocused();
    await expectDaySliderAligned(page);
    const summary = page.getByRole("region", { name: "Selected-day lineup summary" });
    await expect(summary.getByText("Roster games").locator("..")).toHaveText("Roster games20");
    await expect(summary.getByText("NHL games").locator("..")).toHaveText("NHL games1");
    const ids = await page.getByRole("table", { name: "Individual player weekly schedule" }).locator('[data-player-id]').evaluateAll(rows => rows.map(row => row.getAttribute("data-player-id")));
    expect(ids).toHaveLength(20); expect(new Set(ids).size).toBe(20);
    await expect(table.locator('tbody[data-position="Review"]')).toHaveCount(0);
    const metrics = await table.evaluate(node => {
      const scroll = node.parentElement!;
      const viewport = scroll.getBoundingClientRect();
      const header = node.querySelector("thead")!.getBoundingClientRect();
      const rows = [...node.querySelectorAll('tr[data-compact-row]:not([hidden])')];
      return { totalRows: rows.length, visibleRows: rows.filter(row => {
        const box = row.getBoundingClientRect();
        return box.top >= Math.max(viewport.top, header.bottom) - 0.5 && box.bottom <= viewport.bottom + 0.5;
      }).length, clientHeight: scroll.clientHeight, scrollHeight: scroll.scrollHeight };
    });
    expect(metrics.visibleRows).toBeGreaterThan(0);
    expect(metrics.visibleRows).toBeLessThanOrEqual(20);
    viewportMetrics.push({ date: label, ...metrics });
  }
  await slider.focus(); await page.keyboard.press("Home");
  await expect(slider).toHaveAttribute("aria-valuetext", dates[0]);
  await page.keyboard.press("ArrowLeft"); await expect(slider).toHaveAttribute("aria-valuetext", dates[0]);
  await page.keyboard.press("ArrowRight"); await expect(slider).toHaveAttribute("aria-valuetext", dates[1]);
  await page.keyboard.press("ArrowLeft"); await expect(slider).toHaveAttribute("aria-valuetext", dates[0]);
  await slider.focus(); await page.keyboard.press("End");
  await expect(slider).toHaveAttribute("aria-valuetext", "Sun, Oct 11");
  await page.keyboard.press("ArrowRight"); await expect(slider).toHaveAttribute("aria-valuetext", dates[6]);
  const monday = page.getByRole("button", { name: "Select Mon, Oct 5" });
  await monday.focus(); await page.keyboard.press("Enter");
  await expect(slider).toHaveAttribute("aria-valuetext", "Mon, Oct 5");
  await expect(page.getByText("Past lineup unverified", { exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: "Individual player weekly schedule" }).getByRole("rowheader", { name: /Pending C/ }).first()).toBeVisible();
  await page.keyboard.press("ArrowRight"); await expect(slider).toHaveAttribute("aria-valuetext", dates[0]);
  await page.screenshot({ path: testInfo.outputPath("compact-date-focus.png") });
  await page.getByRole("button", { name: `Select ${dates[2]}` }).click();
  await expect(table.locator('tbody[data-position="BENCH"] tr[data-player-id]')).toHaveCount(6);
  await expect(table.locator('tbody[data-position="Review"]')).toHaveCount(0);
  const bench = page.getByRole("button", { name: /Bench \d+/ });
  const capacityDisclosure = page.locator('[id$="-bench-capacity"]');
  await expect(capacityDisclosure).toContainText("6 / 0 local Bench places · over capacity; all retained");
  await expect(capacityDisclosure).toContainText("Local simulated Bench, not Yahoo placement. 6 players / 0 configured places · 6 over capacity; all retained.");
  const expectCapacityAboveSchedule = async () => {
    const note = (await capacityDisclosure.boundingBox())!;
    const scroll = (await page.getByRole("region", { name: "Player weekly schedule scroll area" }).boundingBox())!;
    expect(note.y + note.height).toBeLessThanOrEqual(scroll.y + 0.5);
    expect(note.x + note.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  };
  await expect(capacityDisclosure).toBeVisible();
  await expect(bench).toHaveAccessibleDescription(await capacityDisclosure.innerText());
  await expectCapacityAboveSchedule();
  await bench.focus(); await page.keyboard.press("Space");
  await expect(bench).toHaveAttribute("aria-expanded", "false");
  await expect(bench).toBeFocused();
  await expect(table.locator('tbody[data-position="BENCH"] tr[data-player-id]:visible')).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Selected-day lineup summary" }).getByText("Active slots").locator("..")).toHaveText("Active slots14/14");
  await expect(page.getByRole("region", { name: "Selected-day lineup summary" }).getByText("Open slots").locator("..")).toHaveText("Open slots0");
  await page.screenshot({ path: testInfo.outputPath("compact-bench-collapsed-1440x900.png") });
  await showScheduleView(page, "itinerary");
  await openCompactControls(page);
  await expect(bench).toHaveAttribute("aria-expanded", "false");
  await expect(slider).toHaveAttribute("aria-valuetext", dates[2]);
  await bench.focus();
  await page.keyboard.press("Enter"); await expect(bench).toHaveAttribute("aria-expanded", "true");
  await expect(table.locator('tbody[data-position="BENCH"] tr[data-player-id]:visible')).toHaveCount(6);
  expect(await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"))).toBe(stored);
  expect(calls).toEqual([]);
  await writeFile(testInfo.outputPath("compact-bench-viewport-metrics.json"), JSON.stringify(viewportMetrics, null, 2));
  await page.screenshot({ path: testInfo.outputPath("compact-keyboard-focus.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Itinerary", exact: true }).click();
  await page.getByRole("region", { name: "Player weekly schedule scroll area" }).evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(table.locator('tbody[data-position="BENCH"] tr[data-player-id]').last()).toBeVisible();
  await expect(capacityDisclosure).toBeVisible();
  await expectCapacityAboveSchedule();
  await bench.focus(); await page.keyboard.press("Enter");
  await expect(bench).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"))).toBe(stored);
  await page.screenshot({ path: testInfo.outputPath("compact-bench-zero-capacity-mobile.png") });
});

test.extend({ hasTouch: true })("compact short desktop and mobile retain rows, day state, reserves and unknown goalie status", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 720 });
  await installCompactFixture(page, 25);
  const table = page.getByRole("table", { name: "Individual player weekly schedule" });
  await expect(table.getByRole("cell", { name: /Starter unknown/ }).first()).toBeVisible();
  const scroll = page.getByRole("region", { name: "Player weekly schedule scroll area" });
  await scroll.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(table.locator('[data-player-id="fhfh:25"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("compact-short-desktop.png") });
  for (const [width, height] of [[375, 812], [390, 844], [1024, 768], [320, 844], [720, 450]]) {
    await page.setViewportSize({ width, height });
    const tabs = page.getByRole("navigation", { name: "Workspace views" });
    for (const [name, region] of [["Roster", "Roster and setup"], ["Candidates", "Candidates and detail"], ["Matchup", "Matchup"], ["Itinerary", "Itinerary"]]) {
      await tabs.getByRole("button", { name, exact: true }).click();
      for (const label of ["Roster and setup", "Candidates and detail", "Matchup", "Itinerary"]) {
        expect(await page.getByRole("region", { name: label, exact: true }).isVisible()).toBe(label === region);
      }
    }
    await expect(page.getByRole("slider", { name: "Selected planning day" })).toHaveAttribute("aria-valuetext", "Wed, Oct 7");
    await expectDaySliderAligned(page);
    await scroll.evaluate(node => { node.scrollLeft = 120; });
    await expectDaySliderAligned(page);
    if (width === 375) {
      const disclosure = page.locator("summary").filter({ hasText: /^Date controls$/ }).locator("..");
      await disclosure.evaluate(node => { node.scrollLeft = 60; });
      await expect.poll(() => scroll.evaluate(node => node.scrollLeft)).toBe(60);
      await expectDaySliderAligned(page);
      await disclosure.locator("summary").click();
      await expect(disclosure).not.toHaveAttribute("open", "");
      await scroll.evaluate(node => { node.scrollLeft = 120; });
      await disclosure.locator("summary").click();
      await expect(disclosure).toHaveAttribute("open", "");
      await expect.poll(() => disclosure.evaluate(node => node.scrollLeft)).toBe(120);
      await expectDaySliderAligned(page);
    }
    const bench = page.getByRole("button", { name: /^Bench \d+,/ });
    await bench.tap();
    await expect(bench).toHaveAttribute("aria-expanded", "false");
    await expect(table.locator('tbody[data-position="BENCH"] tr[data-player-id]:visible')).toHaveCount(0);
    if ([390, 320].includes(width)) await page.screenshot({ path: testInfo.outputPath(`compact-bench-collapsed-${width}.png`) });
    await bench.tap();
    await expect(bench).toHaveAttribute("aria-expanded", "true");
    await bench.focus();
    await page.keyboard.press("Enter");
    await expect(bench).toHaveAttribute("aria-expanded", "false");
    await expect(bench).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(bench).toHaveAttribute("aria-expanded", "true");
    if ([390, 320].includes(width)) await page.screenshot({ path: testInfo.outputPath(`compact-bench-expanded-${width}.png`) });
    await scroll.evaluate(node => { node.scrollLeft = 0; });
    const borders = await table.locator("tbody").evaluateAll(nodes => nodes.map(node => ({
      position: node.getAttribute("data-position"), label: node.getAttribute("data-label"),
      width: getComputedStyle(node).borderLeftWidth, style: getComputedStyle(node).borderLeftStyle,
      topLeftRadius: getComputedStyle(node).borderTopLeftRadius, bottomLeftRadius: getComputedStyle(node).borderBottomLeftRadius,
      band: getComputedStyle(node).borderLeftColor, outlineColors: [getComputedStyle(node).borderTopColor, getComputedStyle(node).borderRightColor, getComputedStyle(node).borderBottomColor],
      before: getComputedStyle(node, "::before").content, after: getComputedStyle(node, "::after").content,
    })));
    for (const border of borders) {
      expect(border.width).toBe("28px"); expect(border.style).toBe("solid"); expect(border.topLeftRadius).toBe("10px"); expect(border.bottomLeftRadius).toBe("10px");
      expect(border.outlineColors).toEqual([border.band, border.band, border.band]);
      expect(border.before).toBe("none"); expect(border.after).toBe("none");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const rw = table.locator('tbody[data-position="RW"]');
    await rw.scrollIntoViewIfNeeded();
    await rw.getByRole("button").first().focus();
    await page.screenshot({ path: testInfo.outputPath(`compact-mobile-${width}.png`) });
  }
});

test.extend({ timezoneId: "Pacific/Kiritimati" })("compact future and partial weeks use league dates and retain the full horizon without saving", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    (window as any).__currentReadContexts = [];
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener("message", event => {
          if (event.data.displaySnapshot) (window as any).__currentReadContexts.push({
            asOf: event.data.displaySnapshot.context.asOf, manifestAsOf: event.data.data?.forecastManifest?.asOf,
          });
        });
      }
    };
  });
  const fixture = compactWorkspace(20);
  fixture.workspace.context.endDate = "2026-10-18";
  fixture.workspace.context.timeZone = "America/Los_Angeles";
  await setPlanningTime(page, new Date("2026-10-05T12:00:00Z"));
  await seedWorkspace(page, fixture.workspace);
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: {
    players: fixture.players, games: fixture.games, forecasts: [], evidence: {},
  } } }));
  await page.goto("/roster-schedule-optimizer");
  await openCompactControls(page);
  const slider = page.getByRole("slider", { name: "Selected planning day" });
  await expect(slider).toHaveAttribute("aria-valuetext", "Mon, Oct 5");
  const savedBeforeRead = await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"));
  await setPlanningTime(page, new Date("2026-10-07T01:00:00Z"));
  await page.reload();
  await openCompactControls(page);
  await expect(slider).toHaveAttribute("aria-valuetext", "Tue, Oct 6");
  await expect(page.getByRole("button", { name: "Select Mon, Oct 5" }).locator("..")).toHaveClass(/elapsedDay/);
  await expect(page.getByRole("button", { name: "Select Tue, Oct 6" }).locator("..")).not.toHaveClass(/elapsedDay/);
  await expect(page.getByRole("button", { name: "Select Wed, Oct 7" }).locator("..")).not.toHaveClass(/elapsedDay/);
  await expect.poll(() => page.evaluate(() => (window as any).__currentReadContexts)).toContainEqual({
    asOf: "2026-10-07T01:00:00.000Z", manifestAsOf: "2026-10-07T01:00:00.000Z",
  });
  expect(await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"))).toBe(savedBeforeRead);
  expect(JSON.parse(savedBeforeRead!).context.asOf).toBe(fixture.workspace.context.asOf);
  await writeFile(test.info().outputPath("current-read-preservation.json"), JSON.stringify({
    contexts: await page.evaluate(() => (window as any).__currentReadContexts), savedAsOf: JSON.parse(savedBeforeRead!).context.asOf,
  }, null, 2));
  await page.getByRole("button", { name: "Select Thu, Oct 8" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "Thu, Oct 8");
  const stored = await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"));
  await page.getByRole("button", { name: "Next schedule week" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "Thu, Oct 15");
  await expectDaySliderAligned(page);
  await page.getByRole("button", { name: "Previous schedule week" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "Thu, Oct 8");
  expect(await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"))).toBe(stored);
  await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!);
    workspace.context.startDate = "2026-10-07"; workspace.context.endDate = "2026-10-11";
    localStorage.setItem("fhfh:rso:workspace:v1", JSON.stringify(workspace));
  });
  await page.reload();
  await openCompactControls(page);
  await expect(slider).toHaveAttribute("aria-valuetext", "Wed, Oct 7");
  await expectDaySliderAligned(page);
  await expect(page.getByRole("button", { name: "Select Mon, Oct 5" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Select Tue, Oct 6" })).toBeDisabled();
});

test("compact initial future week defaults to Monday and preserves clipped horizons", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = compactWorkspace(20);
  fixture.workspace.context.startDate = "2026-10-12";
  fixture.workspace.context.endDate = "2026-10-18";
  await setPlanningTime(page, new Date("2026-10-07T12:00:00Z"));
  await seedWorkspace(page, fixture.workspace);
  await page.goto("/roster-schedule-optimizer");
  await openCompactControls(page);
  const slider = page.getByRole("slider", { name: "Selected planning day" });
  await expect(slider).toHaveAttribute("aria-valuetext", "Mon, Oct 12");
  await expect(slider).toHaveAttribute("min", "0");
  await expect(slider).toHaveAttribute("max", "6");
  await expect(page.getByRole("button", { name: /^Select (Mon|Tue|Wed|Thu|Fri|Sat|Sun), Oct/ })).toHaveCount(7);
  await expect(page.getByRole("button", { name: "Previous schedule week" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Previous schedule week" })).toHaveAccessibleDescription(/No earlier week in selected range/);
  await expect(page.getByRole("button", { name: "Next schedule week" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next schedule week" })).toHaveAccessibleDescription(/No later week in selected range/);
  await expect(page.getByText(/No earlier week in selected range\./)).toBeVisible();
  await expect(page.getByText(/No later week in selected range\./)).toBeVisible();
  await expectDesktopFrameVisible(page);
  await expectDaySliderAligned(page);
  await page.screenshot({ path: testInfo.outputPath("future-initial-monday.png") });
  await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!);
    workspace.context.startDate = "2026-10-14";
    workspace.context.endDate = "2026-10-20";
    localStorage.setItem("fhfh:rso:workspace:v1", JSON.stringify(workspace));
  });
  await page.reload();
  await openCompactControls(page);
  await expect(slider).toHaveAttribute("aria-valuetext", "Wed, Oct 14");
  await expect(page.getByRole("button", { name: "Select Mon, Oct 12" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Select Tue, Oct 13" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Select Mon, Oct 12" })).toHaveAccessibleDescription(/Disabled dates are outside selected range/);
  await expect(page.getByRole("button", { name: "Select Tue, Oct 13" })).toHaveAccessibleDescription(/Disabled dates are outside selected range/);
  await expect(page.getByText(/Disabled dates are outside selected range\./)).toBeVisible();
  await expectDesktopFrameVisible(page);
  const stored = await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"));
  await page.getByRole("button", { name: "Next schedule week" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "Mon, Oct 19");
  await expect(page.getByRole("button", { name: "Next schedule week" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next schedule week" })).toHaveAccessibleDescription(/No later week in selected range/);
  await expect(page.getByText(/Disabled dates are outside selected range\./)).toBeVisible();
  await page.getByRole("button", { name: "Previous schedule week" }).click();
  await expect(slider).toHaveAttribute("aria-valuetext", "Wed, Oct 14");
  expect(await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"))).toBe(stored);
  await page.getByRole("button", { name: "Select Sun, Oct 18" }).click();
  await page.reload();
  await openCompactControls(page);
  await expect(slider).toHaveAttribute("aria-valuetext", "Sun, Oct 18");
  expect(await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"))).toBe(stored);
  await page.screenshot({ path: testInfo.outputPath("partial-future-resumed-sunday.png") });
  const preferenceKey = await page.evaluate(() => Object.keys(localStorage).find(key => key.startsWith("fhfh:rso:view-date:v1:") && localStorage.getItem(key) === "2026-10-18")!);
  const switchFixtureWorkspace = async (value: string, marker: string) => {
    await page.addInitScript(({ value, marker }) => {
      if (sessionStorage.getItem(marker)) return;
      localStorage.setItem("fhfh:rso:workspace:v1", value);
      sessionStorage.setItem(marker, "applied");
    }, { value, marker });
    await page.reload();
  await openCompactControls(page);
  };
  const other = JSON.parse(stored!);
  other.context.teamId = "other-manual-team";
  await switchFixtureWorkspace(JSON.stringify(other), "fixture-date-context-b");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!).context.teamId)).toBe("other-manual-team");
  await expect(slider).toHaveAttribute("aria-valuetext", "Wed, Oct 14");
  await switchFixtureWorkspace(stored!, "fixture-date-context-a");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1")!).context)).toEqual(JSON.parse(stored!).context);
  await expect(slider).toHaveAttribute("aria-valuetext", "Sun, Oct 18");
  for (const value of ["not-a-date", "2026-10-21"]) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: preferenceKey, value });
    await page.reload();
  await openCompactControls(page);
    await expect(slider).toHaveAttribute("aria-valuetext", "Wed, Oct 14");
    expect(await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"))).toBe(stored);
  }
});

test("compact vacancies and non-playing holds survive day changes and Bench collapse", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCompactFixture(page, 20, fixture => {
    const absent = new Set([fixture.players[8].id, fixture.players[9].id]);
    fixture.workspace.roster = fixture.workspace.roster.filter(row => !absent.has(row.playerId));
    fixture.players[13].teamAbbreviation = "BOS";
    fixture.workspace.lockedAssignments!.push(...["2026-10-07", "2026-10-08"].map(date => ({ date, playerId: fixture.players[13].id, slotId: "G#2" })),
      { date: "2026-10-08", playerId: fixture.players[0].id, slotId: "C#1" },
      ...fixture.workspace.roster.filter(row => row.position === "bench").map(row => ({ date: "2026-10-08", playerId: row.playerId, slotId: null })));
  });
  const table = page.getByRole("table", { name: "Individual player weekly schedule" });
  const stored = await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"));
  for (const date of ["Wed, Oct 7", "Thu, Oct 8", "Wed, Oct 7"]) {
    await page.getByRole("button", { name: `Select ${date}` }).click();
    await expect(table.locator('[data-player-id]')).toHaveCount(18);
    expect(await table.locator('[data-player-id]').evaluateAll(rows => new Set(rows.map(row => row.getAttribute("data-player-id"))).size)).toBe(18);
    await expect(table.getByRole("rowheader", { name: /Open D/ })).toHaveCount(2);
    await expect(table.locator('tr[data-compact-row]:not([hidden])')).toHaveCount(20);
    await expect(table.locator('[data-player-id="fhfh:1"]')).not.toContainText("C#1");
    await expect(table.locator('[data-player-id="fhfh:1"]').getByRole("button")).toHaveAttribute("aria-label", /C#1/);
    await expect(table.locator('[data-player-id="fhfh:14"]')).not.toContainText("G#2");
    await expect(table.locator('[data-player-id="fhfh:14"]').getByRole("button")).toHaveAttribute("aria-label", /G#2/);
    await expect(table.locator('[data-player-id="fhfh:14"]').getByRole("button", { name: /Held · no active game/ })).toBeVisible();
    const summary = page.getByRole("region", { name: "Selected-day lineup summary" });
    await expect(summary.getByText("Active slots").locator("..")).toHaveText("Active slots12/14");
    await expect(summary.getByText("Open slots").locator("..")).toHaveText("Open slots2");
    await page.getByRole("button", { name: /Bench 6/ }).click();
    await expect(table.getByRole("rowheader", { name: /Open D/ })).toHaveCount(2);
    await page.getByRole("button", { name: /Bench 6/ }).click();
  }
  expect(await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"))).toBe(stored);
  await page.screenshot({ path: testInfo.outputPath("compact-two-vacancies-held-player.png") });
});

test.extend({ hasTouch: true })("compact partial and unavailable evidence retain players and explicit unresolved states on desktop and mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = compactWorkspace(20);
  fixture.players[0].teamAbbreviation = null;
  fixture.players[0].eligibilityVerified = false;
  await setPlanningTime(page, new Date("2026-10-07T12:00:00Z"));
  await seedWorkspace(page, fixture.workspace);
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: {
    players: fixture.players, games: fixture.games, forecasts: [], evidence: {
      schedule: { source: "fictional partial fixture", asOf: "2026-10-07T12:00:00Z", seasonId: 20262027, completeness: "partial", limitations: ["Schedule coverage is incomplete; retry the missing team dates."] },
      forecasts: { source: "fictional unavailable fixture", asOf: null, seasonId: 20262027, completeness: "unknown", limitations: ["Forecasts unavailable. Schedule planning remains usable; player-quality decisions need verification."] },
    },
  } } }));
  await page.goto("/roster-schedule-optimizer");
  await openCompactControls(page);
  const table = page.getByRole("table", { name: "Individual player weekly schedule" });
  const summary = page.getByRole("region", { name: "Selected-day lineup summary" });
  const verifyMobileWorkspaces = async (state: "partial" | "unavailable") => {
    const stored = await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"));
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const tabs = page.getByRole("navigation", { name: "Workspace views" });
      await expect(page.getByRole("region", { name: "Itinerary", exact: true })).toBeVisible();
      for (const [name, region] of [["Roster", "Roster and setup"], ["Candidates", "Candidates and detail"], ["Matchup", "Matchup"], ["Itinerary", "Itinerary"]]) {
        await tabs.getByRole("button", { name, exact: true }).tap();
        for (const label of ["Roster and setup", "Candidates and detail", "Matchup", "Itinerary"]) {
          expect(await page.getByRole("region", { name: label, exact: true }).isVisible()).toBe(label === region);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
      await expect(table).toBeVisible();
      await expect(table.locator('[data-player-id]')).toHaveCount(20);
      await expect(summary.getByText("Open slots").locator("..")).toContainText("unresolved");
      if (state === "partial") {
        await expect(page.getByText("Shared schedule: partial", { exact: true })).toBeVisible();
        await expect(summary.getByText("Roster games").locator("..")).toHaveText("Roster games19 known");
      } else {
        await expect(page.getByRole("group", { name: "Planning command bar" }).getByRole("status").filter({ hasText: /Planning data is temporarily unavailable. Your saved manual workspace is preserved/ })).toBeVisible();
        await expect(summary.getByText("Roster games").locator("..")).toHaveText("Roster gamesUnknown");
      }
      await page.screenshot({ path: testInfo.outputPath(`compact-${state}-${width}.png`) });
    }
    expect(await page.evaluate(() => localStorage.getItem("fhfh:rso:workspace:v1"))).toBe(stored);
    await page.setViewportSize({ width: 1440, height: 900 });
  };
  await expect(table.locator('[data-player-id]')).toHaveCount(20);
  await openDisclosure(page, /^More tools$/);
  await openDisclosure(page, /^Shared schedule: partial/);
  await expect(page.getByText("Shared schedule: partial", { exact: true })).toBeVisible();
  const scheduleEvidence = page.locator("details").filter({ has: page.locator(":scope > summary").getByText("Shared schedule: partial", { exact: true }) }).getByRole("list");
  await expect(scheduleEvidence).toBeVisible();
  await expect(scheduleEvidence).toContainText("Forecasts unavailable. Schedule planning remains usable");
  await expect(summary.getByText("Roster games").locator("..")).toHaveText("Roster games19 known");
  await expect(summary.getByText("NHL games").locator("..")).toHaveText("NHL games1 known");
  await expect(summary.getByText("Open slots").locator("..")).toContainText("unresolved");
  await expect(table.getByRole("rowheader", { name: /Open (C|LW|RW|D|UTIL|G)/ })).toHaveCount(0);
  await expectDesktopFrameVisible(page);
  await page.screenshot({ path: testInfo.outputPath("compact-partial-1440x900.png") });
  await verifyMobileWorkspaces("partial");
  await routeCurrentPlanning(page, route => route.fulfill({ status: 503, json: { error: {
    code: "planning_unavailable", message: "Planning data is temporarily unavailable. Your saved manual workspace is preserved. Retry the schedule read.",
  } } }));
  await page.reload();
  await openCompactControls(page);
  await expect(page.getByRole("group", { name: "Planning command bar" }).getByRole("status").filter({ hasText: /Planning data is temporarily unavailable. Your saved manual workspace is preserved/ })).toBeVisible();
  await expect(table.locator('[data-player-id]')).toHaveCount(20);
  await expect(summary.getByText("Roster games").locator("..")).toHaveText("Roster gamesUnknown");
  await expect(summary.getByText("NHL games").locator("..")).toHaveText("NHL gamesUnknown");
  await expect(summary.getByText("Open slots").locator("..")).toContainText("unresolved");
  await expectDesktopFrameVisible(page);
  await page.screenshot({ path: testInfo.outputPath("compact-unavailable-1440x900.png") });
  await verifyMobileWorkspaces("unavailable");
});

// TJ 2026-10-22: a player got healthy but stayed in his IR spot, and the RSO never flagged it.
test("alerts on a healthy player left in IR and shows what activating him gains", async ({ page }, testInfo) => {
  // Offline fixture: abort non-local requests and answer any unmocked API with 503 (routes registered later win).
  await page.route(url => !["127.0.0.1", "localhost"].includes(url.hostname), route => route.abort());
  await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "fixture: not mocked" } }));
  await installPlanningClock(page, { time: new Date("2026-09-26T12:00:00Z") });
  const members = [fixturePlayer(1, "Alpha Center", "CAR"), { ...fixturePlayer(3, "Healthy Defender", "BOS"), eligiblePositions: ["D"], injury: null }];
  const workspace = fixtureWorkspace(members, { ...fixtureRules, rosterSlots: { C: 1, D: 1, BN: 1, IR: 1 } });
  workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "league", teamId: "team", endDate: date(6) };
  workspace.roster = [{ playerId: members[0].id, position: "active" }, { playerId: members[1].id, position: "IR" }];
  await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
  await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: false } } }));
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`;
  await page.addInitScript(key => { const session = localStorage.getItem("sb-127-auth-token"); if (session) localStorage.setItem(key, session); }, storageKey);
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: true, capabilities: ["rso_sync"], grantingSources: ["test"], expiresAt: null, reason: null } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace**", route => route.fulfill({ json: { data: null } }));
  const games = [5, 6].flatMap(day => members.map(member => fixtureGame(`${member.id}:${day}`, day, member.teamAbbreviation!)));
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players: members, games, forecasts: [], evidence: {} } } }));
  // A live Yahoo read: no injury designation for the defender, and so no IR eligibility.
  await page.route("**/api/v1/roster-schedule-optimizer/provider", route => route.fulfill({ json: { success: true,
    snapshot: { id: "provider-healthy-ir", context: workspace.context, players: members, roster: workspace.roster, games, forecasts: [], rules: workspace.rules,
      lockedAssignments: [], realized: {}, opponent: null,
      evidence: { roster: { source: "Yahoo authorized current roster", asOf: workspace.context.asOf, seasonId: 20262027, completeness: "complete", limitations: [] } } },
    capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: true, limitations: [] } } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  const alert = page.getByRole("alert", { name: "Healthy players in IR" });
  await expect(alert).toContainText("Healthy Defender is in your IR spot, but Yahoo lists no injury.");
  await expect(alert).toContainText("Yahoo no longer lists him for IR, so the lineup is illegal until he moves.");
  await expect(alert).toContainText("Move him to an open bench or active spot.");
  // This fixture has no current forecast read, so the planner prices games, not points (the unit test covers points).
  await expect(alert.getByText("+2 active games this week")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("healthy-ir-alert-1440x900.png") });
});

// TJ 2026-10-22: Yahoo marks each rostered goalie Starting or Not Starting for the day; the RSO should plan with it.
test("plans tonight's goalie from Yahoo's Starting and Not Starting marks and shows them in the grid", async ({ page }, testInfo) => {
  await page.route(url => !["127.0.0.1", "localhost"].includes(url.hostname), route => route.abort());
  await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "fixture: not mocked" } }));
  const evaluatedAt = "2026-10-05T18:00:00.000Z";
  await installPlanningClock(page, { time: new Date(evaluatedAt) });
  const goalie = (id: number, name: string, team: string): PlanningPlayer => ({ ...fixturePlayer(id, name, team), eligiblePositions: ["G"], playerClass: "goalie" });
  const members = [goalie(11, "Starting Goalie", "DAL"), goalie(12, "Sitting Goalie", "VGK")];
  const mark = (isStarting: boolean) => ({ source: "yahoo" as const, date: date(5), isStarting, observedAt: "2026-10-05T17:30:00.000Z" });
  const marked = [{ ...members[0], startingStatus: mark(true) }, { ...members[1], startingStatus: mark(false) }];
  const workspace = fixtureWorkspace(marked, { ...fixtureRules, rosterSlots: { G: 1, BN: 1 }, periods: [],
    scoring: { mode: "points", weights: { SAVES_GOALIE: 0.2 }, categories: [] } });
  workspace.context = { ...workspace.context, provider: "yahoo", leagueId: "league", teamId: "team", endDate: date(6), asOf: evaluatedAt };
  // FORGE's prior makes the sitting goalie (0.7) look likelier than the starter (0.6); Yahoo's marks reverse that tonight.
  workspace.roster = [{ playerId: members[1].id, position: "active" }, { playerId: members[0].id, position: "bench" }];
  await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
  await installDraftProAuthenticatedFixtures(page, () => ({ access: { eligible: false, grantingSources: [], expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "no_active_grant", capabilities: [], providerReadiness: { stripe: false, patreon: false, yahoo: false } } }));
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fyhftlxokyjtpndbkfse.supabase.co").hostname.split(".")[0]}-auth-token`;
  await page.addInitScript(key => { const session = localStorage.getItem("sb-127-auth-token"); if (session) localStorage.setItem(key, session); }, storageKey);
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: true, capabilities: ["rso_sync"], grantingSources: ["test"], expiresAt: null, reason: null } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace**", route => route.fulfill({ json: { data: null } }));
  const games = members.map(member => fixtureGame(`${member.id}:5`, 5, member.teamAbbreviation!));
  const revision = "forge-daily-bridge-v1:fixture-run";
  const bridgeRow = (member: PlanningPlayer, probability: number): GameForecast => ({ ...fixtureForecast(member, games.find(game => game.teamAbbreviation === member.teamAbbreviation)!, 0),
    revisionId: revision, sourceWatermark: revision, modelVersion: "forge-daily-bridge-v1:fixture", limitations: ["Interim FORGE projection."],
    stats: { SAVES_GOALIE: 25 * probability }, conditionalStats: { SAVES_GOALIE: 25 }, startProbability: probability });
  const { wire } = compactBridgeForecasts([bridgeRow(members[0], 0.6), bridgeRow(members[1], 0.7)], { players: members, games }, 20262027);
  expect(wire?.rows).toHaveLength(2);
  // The current read: FORGE's bridge rows under a manifest naming their revision (the data route has no Yahoo marks).
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true,
    data: { players: members, games, forecasts: [], baselineSources: [], participationSources: [],
      evidence: { schedule: { source: "fixture", asOf: evaluatedAt, seasonId: 20262027, completeness: "complete", limitations: [] } },
      forecastManifest: { version: "planning-forecasts-v1", id: "current-read", seasonId: 20262027, asOf: evaluatedAt,
        scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: [revision], baselineChecksum: null,
        requiredOpportunities: 2, forecastedOpportunities: 2, exclusionCounts: {},
        rsoUsePolicy: { version: "rso-target-use-v1", revision: currentRsoUsePolicy().revision, bridgeRevisionIds: [revision] } } },
    bridgeForecasts: wire, read: { nonce: route.request().headers()["x-rso-read-nonce"], evaluatedAt } } }));
  // Authenticated current server read, separate from the saved/provider labels.
  const confirmed = applyProviderGoalieStarts([bridgeRow(members[0], 0.6), bridgeRow(members[1], 0.7)], {
    marked, catalog: members, games, bridgeRevisionIds: new Set([revision]), now: Date.parse(evaluatedAt),
  });
  let privateReads = 0;
  await page.route("**/api/v1/roster-schedule-optimizer/yahoo-current-data", route => {
    const request = route.request(), body = request.postDataJSON(); privateReads++;
    expect(request.method()).toBe("POST");
    expect(JSON.parse(Buffer.from(request.headers().authorization.split(".")[1], "base64url").toString()).sub).toBe(RSO_FIXTURE_PRINCIPAL);
    expect(body).toMatchObject({ teamId: "team", leagueId: "league", seasonId: 20262027, startDate: date(5), endDate: date(6), timeZone: "UTC" });
    return route.fulfill({ json: { success: true, data: { players: members, games, forecasts: confirmed, evidence: {},
      forecastManifest: { version: "planning-forecasts-v1", id: "server-confirmed", seasonId: 20262027, asOf: evaluatedAt,
        scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: [revision], baselineChecksum: null,
        requiredOpportunities: 2, forecastedOpportunities: 2, exclusionCounts: {},
        rsoUsePolicy: { version: "rso-target-use-v1", revision: currentRsoUsePolicy().revision, bridgeRevisionIds: [revision] } } },
      read: { ...body, principalId: RSO_FIXTURE_PRINCIPAL, evaluatedAt, expiresAt: "2026-10-05T18:02:00.000Z" } } });
  });
  // A live Yahoo roster read carrying tonight's marks.
  await page.route("**/api/v1/roster-schedule-optimizer/provider", route => route.fulfill({ json: { success: true,
    snapshot: { id: "provider-goalie-marks", context: workspace.context, players: marked, roster: workspace.roster, games, forecasts: [], rules: workspace.rules,
      lockedAssignments: [], realized: {}, opponent: null,
      evidence: { roster: { source: "Yahoo authorized current roster", asOf: evaluatedAt, seasonId: 20262027, completeness: "complete", limitations: [] } } },
    capabilities: { roster: true, availability: true, rules: true, matchup: false, acquisitions: false, limitations: [] } } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await showScheduleView(page, "position");
  const grid = page.getByRole("table", { name: "Lineup by position" });
  const starter = grid.getByRole("button", { name: `Starting Goalie, G, ${date(5)}` });
  await expect(starter.getByLabel(/^Starting \(Yahoo, read .+\); start chance 100% for this game$/)).toHaveText("✓");
  // The grid holds forecast rows for the chosen lineup only, so a benched goalie's mark names no effect.
  await expect(grid.getByRole("button", { name: `Sitting Goalie, bench, has a game, ${date(5)}` })
    .getByLabel(/^Not starting \(Yahoo, read .+\)$/)).toHaveText("✗");
  await expect(starter.getByLabel(/Expected fantasy points:/)).toContainText("5.0");
  expect(privateReads).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("yahoo-goalie-marks-1440x900.png") });
});
