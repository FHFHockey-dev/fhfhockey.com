import { expect, test, type Page } from "@playwright/test";
import { routeCurrentPlanning, showScheduleView, setPlanningTime, installPlanningClock, RSO_FIXTURE_PRINCIPAL } from "./roster-schedule-optimizer-fixtures";
import { bearerPrincipal, compactWorkspace, connectedWorkspace, expectNoPageOverflow, expiredAccess, fixturePlayer, fixtureWorkspace, grantedAccess, isolateNetwork, openPlanningSetup, OTHER_PRINCIPAL, providerSnapshot, savedWorkspace, seedWorkspace, signIn } from "./fixtures/rso-continuity";
import type { PlanningPlayer } from "../lib/rosterScheduleOptimizer/planningTypes";

// RSO continuity acceptance: fictional principals, intercepted session/provider/account routes,
// loopback-only network. Nothing here reaches Yahoo, Supabase or production.
const roster = () => [fixturePlayer(1, "Alpha Center", "CAR"), { ...fixturePlayer(2, "Bravo Center", "NJD"), availability: "free_agent" as const }, fixturePlayer(3, "Charlie Wing", "BOS")];

test.beforeEach(async ({ page }) => {
  await isolateNetwork(page);
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: false, capabilities: [], grantingSources: [], expiresAt: null, reason: "manual" } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace?**", route => route.fulfill({ status: 401, json: { error: "unauthorized" } }));
});

async function connect(page: Page, players: PlanningPlayer[], onProvider?: (read: number, principal: string | null) => unknown, league = "fixture-league") {
  let reads = 0;
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: grantedAccess() }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace?**", route => route.fulfill({ json: { data: null } }));
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players, games: [], forecasts: [], evidence: {} } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/provider", async route => {
    const read = ++reads, principal = bearerPrincipal(route.request().headers().authorization);
    const custom = await onProvider?.(read, principal);
    if (custom) return route.fulfill(custom as Parameters<typeof route.fulfill>[0]);
    const request = route.request().postDataJSON();
    const workspace = connectedWorkspace(players, league, request.teamId);
    workspace.context = { ...workspace.context, startDate: request.startDate, endDate: request.endDate, timeZone: request.timeZone };
    return route.fulfill({ json: { success: true, snapshot: providerSnapshot(workspace, players, `fixture-refresh-${read}`, read === 1 ? "2026-10-11T12:00:00Z" : "2026-10-11T12:01:00Z"), capabilities: { roster: true, availability: true, limitations: [] } } });
  });
  return { reads: () => reads };
}

test("1. a nonzero selected-move refresh, Undo and reopen keep moves, locks, review state and Undo", async ({ page }, testInfo) => {
  await installPlanningClock(page, { time: new Date("2026-10-11T12:00:00Z") });
  await signIn(page);
  const players = roster();
  const workspace = connectedWorkspace(players);
  await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
  const provider = await connect(page, players);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await expect.poll(provider.reads).toBe(1);
  await expect(page.getByText("Provider inputs refreshed. Selected moves were kept.")).toBeVisible();
  const kept = { steps: workspace.intent.steps, protectedPlayerIds: workspace.intent.protectedPlayerIds, excludedPlayerIds: workspace.intent.excludedPlayerIds };
  expect((await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent).toMatchObject(kept);

  await openPlanningSetup(page);
  await page.getByRole("combobox", { name: "Goalie choice" }).selectOption("cover");
  await expect.poll(async () => (await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent.goalieCoverage).toBe("cover");
  await page.getByRole("button", { name: "Refresh provider" }).click();
  await expect.poll(provider.reads).toBe(2);
  await expect(page.locator("#rso-provider-refresh-status")).toContainText("selected moves were kept");
  expect((await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent).toMatchObject({ ...kept, goalieCoverage: "cover" });
  expect((await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).lockedAssignments).toEqual(workspace.lockedAssignments);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent.goalieCoverage).toBe("accept_risk");
  expect((await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent).toMatchObject(kept);
  expect((await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).lockedAssignments).toEqual(workspace.lockedAssignments);

  // A second edit leaves Undo history to carry across the reopen.
  await page.getByRole("combobox", { name: "Window" }).selectOption({ index: 1 });
  const edited = (await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent.goalieWindow;
  expect(edited).not.toBe("any");
  await page.reload();
  await expect.poll(provider.reads).toBe(3);
  const reopened = await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL);
  expect(reopened.intent).toMatchObject({ ...kept, goalieWindow: edited });
  expect(reopened.lockedAssignments).toEqual(workspace.lockedAssignments);
  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect.poll(async () => (await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent.goalieWindow).toBe("any");
  expect((await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent).toMatchObject(kept);
  await page.screenshot({ path: testInfo.outputPath("case1-reopen-undo.png") });
});

test("2. account and league switches never leak another principal's or context's plan", async ({ page }, testInfo) => {
  await installPlanningClock(page, { time: new Date("2026-10-11T12:00:00Z") });
  const auth = await signIn(page);
  const players = [{ ...fixturePlayer(1, "Alpha Private", "CAR") }, { ...fixturePlayer(2, "Bravo Private", "NJD"), availability: "free_agent" as const }, fixturePlayer(3, "Charlie Private", "BOS")];
  const workspace = connectedWorkspace(players, "league-a", "team-a");
  await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
  const principals: Array<string | null> = [];
  const provider = await connect(page, players, (_read, principal) => { principals.push(principal);
    return principal === RSO_FIXTURE_PRINCIPAL ? null : { status: 403, json: { success: false, code: "yahoo_access_denied", error: { message: "Fixture: this principal has no Yahoo team." } } }; }, "league-a");
  // Registered after connect() so it takes precedence and records every account read's principal.
  await page.route("**/api/v1/roster-schedule-optimizer/workspace?**", route => { principals.push(bearerPrincipal(route.request().headers().authorization)); return route.fulfill({ json: { data: null } }); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await expect.poll(provider.reads).toBe(1);
  await expect(page.getByText("Provider inputs refreshed. Selected moves were kept.")).toBeVisible();

  // League switch: the new context starts without league-a's moves, roster or locks.
  await openPlanningSetup(page);
  await page.getByRole("textbox", { name: "League ID" }).fill("league-b");
  await expect.poll(async () => (await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).context.leagueId).toBe("league-b");
  const leagueB = await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL);
  expect(leagueB.roster).toEqual([]); expect(leagueB.lockedAssignments).toEqual([]);
  expect(leagueB.manualPlayers.map(row => row.name)).not.toContain("Alpha Private");
  expect(leagueB.intent.steps, "league-a selected moves leaked into league-b").toEqual([]);
  expect(leagueB.intent.protectedPlayerIds, "league-a protections leaked into league-b").toEqual([]);
  await page.getByRole("textbox", { name: "League ID" }).fill("league-a");
  await expect.poll(async () => (await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent.steps).toEqual(workspace.intent.steps);

  // Account switch on the same device: principal B never sees A's provider roster or plan.
  await auth.switchPrincipal(OTHER_PRINCIPAL);
  principals.length = 0;
  await page.reload();
  await expect.poll(() => principals.length).toBeGreaterThan(0);
  expect(principals.every(value => value === OTHER_PRINCIPAL), JSON.stringify(principals)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("case2-account-b.png"), fullPage: true });
  // D2: principal B starts from its own (empty) local slot; A's slot is untouched.
  // The public /data fixture lists the same catalog for everyone; only the roster panel holds A's retained roster.
  const main = page.locator("main"), rosterPanel = page.getByRole("region", { name: "Roster and setup" });
  await expect(rosterPanel.getByText("Alpha Private"), "principal A's retained provider roster is shown to principal B").toHaveCount(0);
  await expect(main.getByText("ADD Bravo Private", { exact: true }), "principal A's selected move is shown to principal B").toHaveCount(0);
  expect((await savedWorkspace(page, OTHER_PRINCIPAL)).intent.steps).toEqual([]);
  expect((await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent.steps).toEqual(workspace.intent.steps);

  // Sign-out shows the anonymous manual slot, never a principal's plan.
  await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (/^sb-.*-auth-token$/.test(key)) localStorage.removeItem(key); });
  await page.reload();
  await expect(rosterPanel.getByText("Alpha Private")).toHaveCount(0);
  await expect(main.getByText("ADD Bravo Private", { exact: true })).toHaveCount(0);
  await expect(page.getByText("0 players", { exact: true })).toBeVisible();
  const anonymous = await page.evaluate(() => JSON.parse(localStorage.getItem("fhfh:rso:workspace:v1") ?? "null") as { context: { provider: string } } | null);
  expect([null, "manual"]).toContain(anonymous?.context.provider ?? null);
});

test("3. a 409 lock_version save conflict is surfaced and the local plan is not lost", async ({ page }, testInfo) => {
  await installPlanningClock(page, { time: new Date("2026-10-11T12:00:00Z") });
  await signIn(page);
  const players = roster();
  const workspace = connectedWorkspace(players);
  await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
  await connect(page, players);
  let puts = 0;
  await page.route("**/api/v1/roster-schedule-optimizer/workspace**", route => {
    if (route.request().method() !== "PUT") return route.fulfill({ json: { data: null } });
    puts += 1;
    return route.fulfill({ status: 409, json: { success: false, error: { code: "version_conflict", message: "Expected lock_version 3, found 4." } } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await expect(page.getByText("Provider inputs refreshed. Selected moves were kept.")).toBeVisible();
  const before = await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL);
  await showScheduleView(page, "details");
  await page.getByText("League rules and scoring", { exact: true }).click();
  const confirm = page.locator("#rso-rule-settings").getByText("Confirm planning inputs", { exact: true });
  if (await confirm.isEnabled()) await confirm.click();
  const save = page.getByRole("button", { name: "Save to account" });
  await save.click();
  await expect.poll(() => puts).toBe(1);
  await expect(page.getByText("Another device saved this workspace. Your local plan is intact; review the other version before saving again.")).toBeVisible();
  await expect(page.getByText("Saved to account.")).toHaveCount(0);
  expect((await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent).toEqual(before.intent);
  expect((await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).lockedAssignments).toEqual(before.lockedAssignments);
  await expect(save).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("case3-save-conflict.png") });
  await save.click();
  await expect.poll(() => puts).toBe(2);
  await expect(page.getByText(/Another device saved this workspace/)).toBeVisible();
});

for (const count of [19, 20, 29]) {
  test(`4. desktop workspace does not overflow with ${count} roster slots`, async ({ page }, testInfo) => {
    const fixture = compactWorkspace(count);
    await setPlanningTime(page, new Date("2026-10-07T12:00:00Z"));
    await seedWorkspace(page, fixture.workspace);
    await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players: fixture.players, games: fixture.games, forecasts: [], evidence: {} } } }));
    for (const [width, height] of [[1440, 900], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      if (width === 1440) await page.goto("/roster-schedule-optimizer");
      await showScheduleView(page, "player");
      await expect(page.getByRole("table", { name: "Individual player weekly schedule" })).toContainText("Compact Surname1");
      await expectNoPageOverflow(page);
      const scroll = page.getByRole("region", { name: "Player weekly schedule scroll area" });
      const box = await scroll.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      await page.screenshot({ path: testInfo.outputPath(`case4-${count}-slots-${width}.png`), fullPage: true });
      await showScheduleView(page, "itinerary");
      await expectNoPageOverflow(page);
    }
  });
}

test("5. mobile 375 px keeps the workspace in frame and its controls keyboard-reachable", async ({ page }, testInfo) => {
  await setPlanningTime(page, new Date("2026-10-11T12:00:00Z"));
  const players = roster();
  const workspace = fixtureWorkspace(players);
  workspace.roster = players.map(row => ({ playerId: row.id, position: "active" }));
  workspace.intent.steps = [{ id: "mobile-edit", type: "add", playerId: players[1].id, at: "2026-10-12T12:00:00Z", effectiveAt: "2026-10-12T12:00:00Z", conditional: false, dependsOn: [] }];
  await seedWorkspace(page, workspace);
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players, games: [], forecasts: [], evidence: {} } } }));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/roster-schedule-optimizer");
  const views = page.getByRole("navigation", { name: "Workspace views" });
  await expect(views).toBeVisible();
  await expectNoPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("case5-mobile-375.png"), fullPage: true });

  const reached = new Set<string>();
  await page.locator("body").focus();
  for (let index = 0; index < 120; index++) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => { const node = document.activeElement as HTMLElement | null; return node ? `${node.tagName}:${(node.getAttribute("aria-label") || node.textContent || "").trim().slice(0, 40)}` : ""; });
    reached.add(label);
    const box = await page.evaluate(() => { const box = document.activeElement?.getBoundingClientRect(); return box ? { left: box.left, right: box.right } : null; });
    if (box && box.right > 0) expect(box.right, `${label} focus is off-screen at 375 px`).toBeLessThanOrEqual(375 + 1);
  }
  const labels = [...reached];
  for (const name of ["Itinerary", "Roster", "Candidates", "Matchup"]) expect(labels.some(label => label.endsWith(`:${name}`)), `${name} not keyboard-reachable; reached ${labels.length}`).toBe(true);
  // Undo has no history here: disabled (so not a tab stop) with its reason exposed to assistive tech.
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveAccessibleDescription("No edits to undo.");
  const roster_ = views.getByRole("button", { name: "Roster" });
  await roster_.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Roster and setup" })).toBeVisible();
  await expectNoPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("case5-mobile-roster.png"), fullPage: true });
});

test("6a. an expired provider view is read-only and continues manually without losing the plan", async ({ page }, testInfo) => {
  await installPlanningClock(page, { time: new Date("2026-10-11T12:00:00Z") });
  await signIn(page);
  const players = roster();
  const workspace = connectedWorkspace(players);
  await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: expiredAccess }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace?**", route => route.fulfill({ json: { data: null } }));
  let providerReads = 0;
  await page.route("**/api/v1/roster-schedule-optimizer/provider", route => { providerReads += 1; return route.fulfill({ status: 403, json: { success: false } }); });
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players, games: [], forecasts: [], evidence: {} } } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await expect(page.getByText("Saved inputs are read-only and may be stale.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await expect(page.locator("#rso-undo-reason")).toHaveText("Saved inputs are read-only.");
  expect(providerReads).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("case6a-read-only.png") });
  await page.locator('[class*="navStatus"]').hover();
  await page.getByRole("button", { name: "Continue manually" }).click();
  await expect.poll(async () => (await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).context.provider).toBe("manual");
  const manual = await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL);
  expect(manual.intent).toMatchObject({ steps: workspace.intent.steps, protectedPlayerIds: workspace.intent.protectedPlayerIds });
  expect(manual.lockedAssignments).toEqual(workspace.lockedAssignments);
  await expect(page.getByText("Saved inputs are read-only and may be stale.")).toHaveCount(0);
  await openPlanningSetup(page);
  await page.getByRole("combobox", { name: "Goalie choice" }).selectOption("cover");
  await expect.poll(async () => (await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent.goalieCoverage).toBe("cover");
  expect(providerReads).toBe(0);
});

test("6b. missing and failed planning reads show their state instead of a plan", async ({ page }, testInfo) => {
  await setPlanningTime(page, new Date("2026-10-11T12:00:00Z"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await expect(page.getByText("Add your players to begin schedule analysis.")).toBeAttached();
  await expect(page.getByText("0 players", { exact: true })).toBeVisible();
  await expect(page.getByText("Add or import roster", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("case6b-missing.png") });

  const players = roster();
  const workspace = fixtureWorkspace(players);
  await page.evaluate(value => localStorage.setItem("fhfh:rso:workspace:v1", JSON.stringify(value)), workspace);
  await routeCurrentPlanning(page, route => route.fulfill({ status: 503, json: { success: false, error: "Fixture: current read unavailable." } }));
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Fixture: current read unavailable." }).first()).toBeVisible();
  expect((await savedWorkspace(page)).intent).toEqual(workspace.intent);
  await page.screenshot({ path: testInfo.outputPath("case6b-error.png") });
});

test("6c. an edit during a running plan supersedes it: one shared read, latest intent wins, no stale error", async ({ page }) => {
  await setPlanningTime(page, new Date("2026-10-11T12:00:00Z"));
  const players = roster();
  const workspace = fixtureWorkspace(players);
  await seedWorkspace(page, workspace);
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  let reads = 0, started!: () => void; const firstRead = new Promise<void>(resolve => { started = resolve; });
  await routeCurrentPlanning(page, async route => {
    reads += 1;
    if (reads === 1) { started(); await held; }
    return route.fulfill({ json: { success: true, data: { players, games: [], forecasts: [], evidence: {} } } });
  });
  const failed: string[] = [];
  page.on("requestfailed", request => { if (request.url().includes("/roster-schedule-optimizer/data")) failed.push(request.failure()?.errorText ?? ""); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await firstRead;
  await expect(page.getByText("Loading schedule and forecasts…")).toBeVisible();
  await openPlanningSetup(page);
  await page.getByRole("combobox", { name: "Goalie choice" }).selectOption("cover");
  await page.getByRole("combobox", { name: "Window" }).selectOption({ index: 1 });
  await expect.poll(async () => (await savedWorkspace(page)).intent.goalieCoverage).toBe("cover");
  release();
  await expect(page.getByText("Loading schedule and forecasts…")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Goalie choice" })).toHaveValue("cover");
  expect((await savedWorkspace(page)).intent.goalieWindow).not.toBe("any");
  await expect(page.getByRole("status").filter({ hasText: /obsolete|Planning failed|Current read unavailable/ })).toHaveCount(0);
  // Bounded: the superseded generation may re-read once, never once per edit.
  expect(reads).toBeLessThanOrEqual(2); expect(failed).toEqual([]);
});
