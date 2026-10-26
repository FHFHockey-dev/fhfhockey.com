import { expect, test, type Page } from "@playwright/test";
import { routeCurrentPlanning, showScheduleView, setPlanningTime, installPlanningClock, RSO_FIXTURE_PRINCIPAL } from "./roster-schedule-optimizer-fixtures";
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
