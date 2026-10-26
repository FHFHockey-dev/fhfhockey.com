import { expect, test, type Page } from "@playwright/test";
import { routeCurrentPlanning, showScheduleView, setPlanningTime, installPlanningClock, RSO_FIXTURE_PRINCIPAL } from "./roster-schedule-optimizer-fixtures";
import { routeTeamSchedule } from "./fixtures/rso-acceptance";
import { compactWorkspace, connectedWorkspace, expectNoPageOverflow, fixturePlayer, grantedAccess, isolateNetwork, openPlanningSetup, providerSnapshot, savedWorkspace, seedWorkspace, signIn } from "./fixtures/rso-continuity";

// FR18 re-verification (Astra audit): one workspace, desktop roster/players/available, mobile
// itinerary/roster/candidates/matchup, at most 20 visible slot rows with internal labels, and
// continuity through refresh, Undo and reopen. Fictional fixtures; loopback-only network.
test.beforeEach(async ({ page }) => {
  await isolateNetwork(page);
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: { data: { eligible: false, capabilities: [], grantingSources: [], expiresAt: null, reason: "manual" } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace?**", route => route.fulfill({ status: 401, json: { error: "unauthorized" } }));
});

async function openCompact(page: Page, count: number) {
  const fixture = compactWorkspace(count);
  await setPlanningTime(page, new Date("2026-10-07T12:00:00Z"));
  await seedWorkspace(page, fixture.workspace);
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players: fixture.players, games: fixture.games, forecasts: [], evidence: {} } } }));
  await page.goto("/roster-schedule-optimizer");
  return fixture;
}

for (const count of [19, 20, 29]) {
  test(`FR18 desktop 1440×900 keeps ${count} roster slots in one workspace with at most 20 visible slot rows`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openCompact(page, count);
    await showScheduleView(page, "player");
    const table = page.getByRole("table", { name: "Individual player weekly schedule" });
    await expect(table.locator("tr[data-player-id]")).toHaveCount(count);
    // Roster, players and available panels share the one workspace.
    await expect(page.getByRole("heading", { name: "Current Roster" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Optimized Week" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Best Fit Available" })).toBeVisible();
    const layout = await table.evaluate(node => {
      const viewport = node.parentElement!.getBoundingClientRect();
      const bodyTop = Math.max(viewport.top, node.querySelector("thead")!.getBoundingClientRect().bottom);
      const rows = [...node.querySelectorAll("tr[data-compact-row]:not([hidden])")];
      const visible = rows.filter(row => { const box = row.getBoundingClientRect(); return box.top >= bodyTop && box.bottom <= viewport.bottom; }).length;
      const labels = [...node.querySelectorAll("tbody")].map(group => group.querySelector("[data-position-label] > span")?.textContent?.trim() ?? null);
      return { visible, labels, scrolls: node.parentElement!.scrollHeight > node.parentElement!.clientHeight + 1 };
    });
    expect(layout.visible).toBeGreaterThan(0);
    expect(layout.visible).toBeLessThanOrEqual(20);
    // Every position group carries its internal label.
    expect(layout.labels.length).toBeGreaterThanOrEqual(6);
    expect(layout.labels.every(label => typeof label === "string" && label.length > 0)).toBe(true);
    if (count > 20) expect(layout.scrolls).toBe(true);
    // Unknown-projection reasons for many players stay one click away instead of pushing the roster down.
    const why = page.locator("details").filter({ has: page.locator("summary", { hasText: /^No drop suggested: projected points are unknown for \d+ players$/ }) });
    await expect(why).toHaveCount(1);
    await expect(why).not.toHaveAttribute("open", "");
    await expectNoPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`fr18-desktop-${count}-slots.png`) });
  });
}

test("FR18 mobile tabs reach itinerary, roster, candidates and matchup without overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCompact(page, 20);
  const tabs = page.getByRole("navigation", { name: "Workspace views" });
  await expect(tabs).toBeVisible();
  const regions = [["Itinerary", "Itinerary"], ["Roster", "Roster and setup"], ["Candidates", "Candidates and detail"], ["Matchup", "Matchup"]] as const;
  for (const [tab, region] of regions) {
    await tabs.getByRole("button", { name: tab, exact: true }).click();
    for (const [, other] of regions) expect(await page.getByRole("region", { name: other, exact: true }).isVisible(), `${other} visible on ${tab}`).toBe(other === region);
    if (tab === "Roster") {
      // The first roster player is on the first screen, above the bottom navigation.
      const first = await page.getByRole("region", { name: "Roster and setup" }).getByRole("button", { name: /^Compact Surname1(?!\d)/ }).first().boundingBox();
      expect(first).not.toBeNull();
      expect(first!.y + first!.height).toBeLessThanOrEqual(844 - 70);
    }
    await expectNoPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`fr18-mobile-${tab.toLowerCase()}.png`) });
  }
});

test("FR18 continuity: refresh, Undo and reopen keep the selected move, locks and Undo visible", async ({ page }, testInfo) => {
  await installPlanningClock(page, { time: new Date("2026-10-11T12:00:00Z") });
  await signIn(page);
  const players = [fixturePlayer(1, "Alpha Center", "CAR"), { ...fixturePlayer(2, "Bravo Center", "NJD"), availability: "free_agent" as const }, fixturePlayer(3, "Charlie Wing", "BOS")];
  const workspace = connectedWorkspace(players);
  await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: grantedAccess() }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace?**", route => route.fulfill({ json: { data: null } }));
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players, games: [], forecasts: [], evidence: {} } } }));
  let reads = 0;
  await page.route("**/api/v1/roster-schedule-optimizer/provider", route => {
    reads += 1;
    return route.fulfill({ json: { success: true, snapshot: providerSnapshot(workspace, players, `fr18-${reads}`), capabilities: { roster: true, availability: true, limitations: [] } } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await expect.poll(() => reads).toBe(1);
  await expect(page.getByText("Provider inputs refreshed. Selected moves were kept.")).toBeVisible();
  // Selected steps are listed in the Plan details view.
  await showScheduleView(page, "details");
  await expect(page.getByText("ADD Bravo Center", { exact: true })).toBeVisible();
  await openPlanningSetup(page);
  await page.getByRole("combobox", { name: "Goalie choice" }).selectOption("cover");
  await expect.poll(async () => (await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent.goalieCoverage).toBe("cover");
  await page.getByRole("button", { name: "Refresh provider" }).click();
  await expect.poll(() => reads).toBe(2);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent.goalieCoverage).toBe("accept_risk");
  await page.getByRole("combobox", { name: "Window" }).selectOption({ index: 1 });
  await expect.poll(async () => (await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent.goalieWindow).not.toBe("any");
  await page.reload();
  await expect.poll(() => reads).toBe(3);
  await expect(page.getByRole("heading", { name: "Current Roster" }).locator("xpath=following-sibling::span[1]")).toHaveText("1 player");
  // After reopen the selected move, its lock and the Undo history are all still on screen.
  await showScheduleView(page, "details");
  await expect(page.getByText("ADD Bravo Center", { exact: true })).toBeVisible();
  expect((await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).lockedAssignments).toEqual(workspace.lockedAssignments);
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("fr18-continuity-reopen.png") });
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await savedWorkspace(page, RSO_FIXTURE_PRINCIPAL)).intent.goalieWindow).toBe("any");
  await expect(page.getByText("ADD Bravo Center", { exact: true })).toBeVisible();
});

test("returning to the tab keeps the page mounted, its view and selection (hide, wait, show, focus)", async ({ page }, testInfo) => {
  await installPlanningClock(page, { time: new Date("2026-10-11T12:00:00Z") });
  await signIn(page);
  const players = [fixturePlayer(1, "Alpha Center", "CAR"), { ...fixturePlayer(2, "Bravo Center", "NJD"), availability: "free_agent" as const }, fixturePlayer(3, "Charlie Wing", "BOS")];
  const workspace = connectedWorkspace(players);
  await seedWorkspace(page, workspace, RSO_FIXTURE_PRINCIPAL);
  await page.route("**/api/v1/roster-schedule-optimizer/access", route => route.fulfill({ json: grantedAccess() }));
  await page.route("**/api/v1/roster-schedule-optimizer/workspace?**", route => route.fulfill({ json: { data: null } }));
  let dataReads = 0;
  await routeCurrentPlanning(page, route => { dataReads += 1; return route.fulfill({ json: { success: true, data: { players, games: [], forecasts: [], evidence: {} } } }); });
  let reads = 0;
  await page.route("**/api/v1/roster-schedule-optimizer/provider", route => {
    reads += 1;
    return route.fulfill({ json: { success: true, snapshot: providerSnapshot(workspace, players, `return-${reads}`, new Date(Date.now()).toISOString()), capabilities: { roster: true, availability: true, limitations: [] } } });
  });
  const events: string[] = [];
  page.on("console", message => { if (message.text().startsWith("PROBE")) events.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/roster-schedule-optimizer");
  await expect.poll(() => reads).toBe(1);
  await showScheduleView(page, "details");
  await expect(page.getByText("ADD Bravo Center", { exact: true })).toBeVisible();
  await page.evaluate(() => { (document.querySelector('[aria-label="Planning command bar"]') as HTMLElement).dataset.mountProbe = "kept"; });
  const visibility = (value: "visible" | "hidden") => page.evaluate(value => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value }); document.dispatchEvent(new Event("visibilitychange")); }, value);
  await visibility("hidden"); await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.clock.fastForward(2 * 60 * 60_000);
  await visibility("visible"); await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => reads).toBeGreaterThan(1);
  await page.waitForTimeout(1500);
  const kept = await page.evaluate(() => (document.querySelector('[aria-label="Planning command bar"]') as HTMLElement | null)?.dataset.mountProbe ?? null);
  await page.screenshot({ path: testInfo.outputPath("tab-return.png") });
  console.log("PROBE result", JSON.stringify({ kept, reads, dataReads, events }));
  expect(kept, "the RSO tree was remounted on tab return").toBe("kept");
  await expect(page.getByRole("group", { name: "Schedule view", exact: true }).getByRole("button", { name: "Plan details", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("ADD Bravo Center", { exact: true })).toBeVisible();
});


// UI batch 1: Bench days tab, goalie cell height, Top five team schedules (TJ live test, 2026-10-26).
async function openUiBatch(page: Page) {
  const fixture = compactWorkspace(20);
  await setPlanningTime(page, new Date("2026-10-07T12:00:00Z"));
  await seedWorkspace(page, fixture.workspace);
  await routeTeamSchedule(page, "2026-10-05", "2026-10-12", "2026-10-07T06:00:00Z", ["2026-10-08"]);
  await routeCurrentPlanning(page, route => route.fulfill({ json: { success: true, data: { players: fixture.players, games: fixture.games, forecasts: [], evidence: {},
    matchupWeeks: [{ gameKey: "fixture-2026", week: 1, startDate: "2026-10-05", endDate: "2026-10-11" }] } } }));
  await page.goto("/roster-schedule-optimizer");
}
// next/image decodes asynchronously; a page screenshot can catch a loaded logo before it is painted.
const logosLoaded = (page: Page) => expect.poll(() => page.getByRole("group", { name: "Top team schedule cards" }).locator("img")
  .evaluateAll(async images => images.length > 0 && (await Promise.all(images.map(image => (image as HTMLImageElement).decode().then(() => true, () => false)))).every(Boolean)
    && images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
async function expectTeamCards(page: Page) {
  const cards = page.getByRole("group", { name: "Top team schedule cards" });
  await expect(cards.locator("article")).toHaveCount(5);
  await logosLoaded(page);
  const first = await cards.locator("article").first().evaluate(card => {
    const band = card.querySelector("[data-team-band]") as HTMLElement;
    const score = [...card.querySelectorAll("small")].find(node => node.textContent === "Score")!.getBoundingClientRect();
    const gp = [...card.querySelectorAll("small")].find(node => node.textContent === "GP")!.getBoundingClientRect();
    const days = card.querySelectorAll("b[data-game] img").length;
    const offNight = card.querySelector('b[data-off-night="true"]') as HTMLElement | null;
    return { team: band.textContent, background: getComputedStyle(band).backgroundColor, color: getComputedStyle(band).color,
      writing: getComputedStyle(band.querySelector("strong")!).writingMode, scoreAboveGp: score.bottom <= gp.top + 1, logos: days,
      offNightBackground: offNight ? getComputedStyle(offNight).backgroundColor : null, letters: [...card.querySelectorAll("b[data-game]")].some(node => /^[HA]$/.test(node.textContent ?? "")) };
  });
  expect(first.team).toMatch(/^[A-Z]{3}$/);
  expect(first.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(first.writing).toBe("vertical-rl");
  expect(first.scoreAboveGp).toBe(true);
  expect(first.logos).toBeGreaterThan(0);
  expect(first.letters).toBe(false);
  if (first.offNightBackground !== null) expect(first.offNightBackground).not.toBe("rgba(0, 0, 0, 0)");
  // The busy day (9 games) is not an off-night for anyone.
  await expect(cards.locator('[aria-label^="Oct 8:"] b[data-off-night="true"]')).toHaveCount(0);
  await expect(cards.locator('b[data-off-night="true"]').first()).toBeVisible();
}

test("UI batch 1 desktop: team schedule cards, Bench days tab and goalie cell height", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openUiBatch(page);
  await expectTeamCards(page);
  await page.getByRole("group", { name: "Top team schedule cards" }).screenshot({ path: testInfo.outputPath("ui1-team-schedules-1440.png") });
  // Bench days is its own tab, closed by default.
  const benchTab = page.getByRole("group", { name: "Current Roster views" }).getByRole("button", { name: "Bench days" });
  await expect(benchTab).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("region", { name: "Bench days" })).toHaveCount(0);
  await logosLoaded(page);
  await page.screenshot({ path: testInfo.outputPath("ui1-desktop-1440.png") });
  await benchTab.click();
  await expect(page.getByRole("region", { name: "Bench days" })).toBeVisible();
  await logosLoaded(page);
  await page.screenshot({ path: testInfo.outputPath("ui1-desktop-bench-days-1440.png") });
  await expect(page.locator("#rso-bench-days")).toBeVisible();
  await expect(page.locator('[aria-label="Roster and setup"] [class*="rosterRow"]')).toHaveCount(0);
  await page.getByRole("group", { name: "Current Roster views" }).getByRole("button", { name: "Players" }).click();
  await expect(page.locator('[aria-label="Roster and setup"] [class*="rosterRow"]')).toHaveCount(20);
  // Goalie cells are the same height as every other cell in the slot/week grid.
  await showScheduleView(page, "position");
  const heights = await page.evaluate(() => {
    const height = (position: string) => [...document.querySelectorAll(`[data-position="${position}"] [class*="cellButton"], [data-position="${position}"] [class*="cellBody"]`)]
      .map(node => Math.round(node.getBoundingClientRect().height)).filter(Boolean);
    return { goalie: height("G"), center: height("C") };
  });
  expect(heights.goalie.length).toBeGreaterThan(0);
  expect(heights.center.length).toBeGreaterThan(0);
  expect(new Set([...heights.goalie, ...heights.center]).size).toBe(1);
  // The goalie name keeps room beside the stacked expected / if-starts points.
  const goalieName = await page.locator('[data-position="G"] [class*="cellButton"] [class*="_name__"]').first().evaluate(node => node.getBoundingClientRect().width);
  expect(goalieName).toBeGreaterThan(20);
  await page.locator('[data-position="G"]').first().screenshot({ path: testInfo.outputPath("ui1-goalie-cells-1440.png") });
  await expectNoPageOverflow(page);
});

test("UI batch 1 mobile: team schedule cards and Bench days tab at 390 px", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openUiBatch(page);
  const context = page.locator("details").filter({ has: page.locator("summary", { hasText: "Top five team schedules" }) });
  await context.locator("summary").click();
  await expectTeamCards(page);
  await context.screenshot({ path: testInfo.outputPath("ui1-team-schedules-390.png") });
  await page.getByRole("navigation", { name: "Workspace views" }).getByRole("button", { name: "Roster", exact: true }).click();
  const benchTab = page.getByRole("group", { name: "Current Roster views" }).getByRole("button", { name: "Bench days" });
  await expect(benchTab).toHaveAttribute("aria-pressed", "false");
  await benchTab.click();
  await expect(page.getByRole("region", { name: "Bench days" })).toBeVisible();
  await expectNoPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("ui1-mobile-bench-days-390.png"), fullPage: false });
});
