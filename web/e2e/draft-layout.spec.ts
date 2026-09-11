import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { installDraftProAuthenticatedFixtures, installDraftProFreeFixtures } from "./draft-pro-fixtures";

loadEnvConfig(process.cwd(), true);
const access = { eligible: true, grantingSources: ["purchase"] as const, expiresAt: null, verifiedAt: null, nextVerificationAt: null, reason: "eligible" as const, capabilities: ["god_view"] as const, providerReadiness: { stripe: false, patreon: false, yahoo: false } };
const longName = "The Exceptionally Long Team Name for Layout Testing";

async function audit(page: Page) {
  await expect(page.locator('[class*="ProjectionsTable_tableContainer"]')).toBeVisible();
  const result = await page.evaluate(() => {
    const dashboard = document.querySelector<HTMLElement>("[data-god-view-open]")!;
    const visible = Array.from(dashboard.querySelectorAll<HTMLElement>("*")).filter(el => el.getClientRects().length && el.clientWidth && el.clientHeight);
    const dataViewport = dashboard.querySelector<HTMLElement>('[class*="ProjectionsTable_tableContainer"]')!;
    const suggestionsViewport = dashboard.querySelector<HTMLElement>('[class*="SuggestedPicks_cardsRow"]')!;
    const timeline = dashboard.querySelector('[aria-label="All draft picks"]');
    const scrollers = visible.filter(el => /auto|scroll/.test(`${getComputedStyle(el).overflowX} ${getComputedStyle(el).overflowY}`) && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1));
    const overflow = visible.filter(el => {
      if (el === dataViewport || dataViewport.contains(el) || /INPUT|SELECT|TEXTAREA/.test(el.tagName)) return false;
      if (el.closest('[class*="scoreboard"], [aria-hidden="true"], [class*="srOnly"]')) return false;
      const style = getComputedStyle(el);
      if (style.textOverflow === "ellipsis") return false; // Names retain full accessible text/title.
      return el.scrollHeight > el.clientHeight + 1 || (el !== suggestionsViewport && el !== timeline && el.scrollWidth > el.clientWidth + 1);
    }).map(el => ({ className: el.className, text: el.textContent?.slice(0, 30), parentLayout: `${getComputedStyle(el.parentElement!).display} ${getComputedStyle(el.parentElement!).gridTemplateColumns}`, height: [el.clientHeight, el.scrollHeight], width: [el.clientWidth, el.scrollWidth] }));
    const rect = (selector: string) => dashboard.querySelector(selector)!.getBoundingClientRect();
    const workspace = rect('[class*="DraftDashboard_mainContent"]');
    const strip = rect('[aria-label="Draft Order"]');
    const rows = rect('[class*="GodView_header"]');
    const rail = rect('#mobile-draft-panel-roster');
    const graph = rect('#mobile-draft-panel-board');
    const standings = rect('[aria-label="League Standings"]');
    const failures: string[] = [];
    const inside = (child: Element, parent: DOMRect, label: string) => {
      if (!child.getClientRects().length) return;
      const b = child.getBoundingClientRect();
      if (b.width <= 0 || b.height <= 0 || b.left < parent.left - 1 || b.right > parent.right + 1 || b.top < parent.top - 1 || b.bottom > parent.bottom + 1) failures.push(label);
    };
    if (workspace.top < strip.bottom || workspace.bottom > innerHeight) failures.push("workspace must follow strip and fit viewport");
    dashboard.querySelectorAll('[class*="MyRoster_slotPlayer"], [class*="MyRoster_benchSlot"], [class*="MyRoster_rosterAnalysis"]').forEach(el => inside(el, rail, "roster slot / Schedule Fit"));
    dashboard.querySelectorAll('[data-overall-pick]').forEach(el => inside(el, graph, "graph cell"));
    dashboard.querySelectorAll('[aria-label="League Standings"] tr').forEach(el => inside(el, standings, "standings row"));
    dashboard.querySelectorAll('[data-on-clock="true"]').forEach(el => inside(el, strip, "current pick card"));
    const badge = dashboard.querySelector('[class*="GodView_onClock"]');
    if (badge?.getClientRects().length) {
      const b = badge.getBoundingClientRect(), c = badge.parentElement!.getBoundingClientRect();
      inside(badge, strip, "on-the-clock badge");
      if (Math.abs(b.left + b.width / 2 - c.left - c.width / 2) > 1 || !(b.top < c.top && b.bottom > c.top)) failures.push("badge alignment");
    }
    for (const selector of ['[class*="DraftWorkspace_workspaceHeader"]', '[class*="GodView_header"]']) {
      const toolbar = dashboard.querySelector(selector)!;
      const controls = Array.from(toolbar.querySelectorAll('button, a, output')).map(el => el.getBoundingClientRect());
      controls.forEach((b, i) => {
        if (b.top < toolbar.getBoundingClientRect().top - 1 || b.bottom > toolbar.getBoundingClientRect().bottom + 1) failures.push("toolbar wraps");
        if (controls.slice(i + 1).some(c => Math.min(b.right, c.right) - Math.max(b.left, c.left) > 1 && Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top) > 1)) failures.push("toolbar control overlap");
      });
    }
    return {
      root: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], viewport: [innerWidth, innerHeight],
      overflow, failures: [...new Set(failures)], scrollers: scrollers.map(el => el === dataViewport ? "projections-data" : el === suggestionsViewport ? "suggested-players" : el === timeline ? "draft-timeline" : el.className),
      heights: { row1: rect('[class*="DraftWorkspace_workspaceHeader"]').height, row2: rows.height, strip: strip.height, workspace: workspace.height, graphCell: rect('[data-overall-pick]').height, rosterSlot: rect('[class*="MyRoster_slotPlayer__"]').height, standingsRow: rect('[aria-label="League Standings"] tbody tr').height },
    };
  });
  expect(result.root).toEqual(result.viewport);
  expect(result.failures).toEqual([]);
  const widths = await page.getByRole("region", { name: "Suggested Picks", exact: true }).evaluate(el => {
    const card = el.querySelector('[class*="SuggestedPicks_card__"]')!.getBoundingClientRect();
    const segment = el.querySelector('[class*="SuggestedPicks_progressSegment__"]')!.getBoundingClientRect();
    return [card.width, segment.width];
  });
  expect(Math.abs(widths[0] - widths[1])).toBeLessThan(1);
  expect(result.overflow).toEqual([]);
  expect(result.scrollers.filter(name => name !== "draft-timeline")).toEqual(["suggested-players", "projections-data"]);
  return result;
}

async function openFixture(page: Page, options: { setup?: "fresh" | "decline-tab" | "decline-legacy" | "accept-legacy"; accountDefaults?: boolean; keepSetup?: boolean } = {}) {
  page.on("dialog", dialog => options.setup?.startsWith("decline") ? dialog.dismiss() : dialog.accept());
  await page.route("**/api/**", route => route.fulfill({ json: route.request().url().endsWith("/season") ? { seasonId: 20262027 } : [] }));
  await installDraftProAuthenticatedFixtures(page, () => ({ access: { ...access, grantingSources: [...access.grantingSources], capabilities: [...access.capabilities] } }));
  await installDraftProFreeFixtures(page, { seedSnapshot: false, skaterCount: 120, skaterPositions: ["C,LW", "LW", "RW", "D", "C", "D"] });
  if (options.accountDefaults) await page.route("**/rest/v1/user_settings**", route => route.fulfill({ json: { team_count: 8, league_type: "points", roster_config: { C: 2, LW: 2, RW: 2, D: 4, G: 2, utility: 1, bench: 4 }, scoring_categories: { GOALS: 3, ASSISTS: 2 }, draft_order_type: "snake" } }));
  await page.route("**/api/v1/account/espn/**", route => route.fulfill({ json: { enabled: false, leagues: [], sessions: [] } }));
  await page.route("**/api/v1/account/draft-pro", route => route.fulfill({ json: { data: { access } } }));
  await page.route("**/api/v1/roster-schedule-optimizer/schedule**", route => route.fulfill({ json: { success: true, data: {
    gameKey: "477", startWeek: 1, endWeek: 27, version: "fixture-v1",
    freshness: { latestFetchedAt: new Date().toISOString(), oldestFetchedAt: new Date().toISOString(), rowCount: 4 },
    games: ["AAA", "BBB", "CCC", "DDD"].map(team => ({ source_game_id: `fixture-${team}`, game_date: "2026-10-05", game_status: "FUT", team_abbreviation: team, week: 1 })),
  } } }));
  const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1").hostname.split(".")[0]}-auth-token`;
  await page.addInitScript(({ key, name, setup }) => {
    const session = localStorage.getItem("sb-127-auth-token");
    if (session) localStorage.setItem(key, session);
    if (sessionStorage.getItem("layout-fixture-installed")) return;
    sessionStorage.setItem("layout-fixture-installed", "true");
    localStorage.setItem("draft.god-view.open", "false");
    sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({
      v: 2, configured: true, currentPick: 12, isSnakeDraft: true,
      draftedPlayers: Array.from({ length: 11 }, (_, i) => ({ playerId: String(1001 + i), teamId: `Team ${i + 1}`, pickNumber: i + 1, round: 1, pickInRound: i + 1 })),
      draftSettings: { teamCount: 12, draftOrder: Array.from({ length: 12 }, (_, i) => `Team ${i + 1}`), draftOrderMode: "snake", rosterConfig: { C: 2, LW: 2, RW: 2, D: 4, G: 2, utility: 1, bench: 4 } },
      customTeamNames: { "Team 1": name },
    }));
    if (setup && setup !== "fresh") localStorage.setItem("draftDashboard.session.v1", sessionStorage.getItem("draft.snapshot.v2")!);
    if (setup === "fresh" || setup?.includes("legacy")) sessionStorage.removeItem("draft.snapshot.v2");
  }, { key: storageKey, name: longName, setup: options.setup });
  await page.goto("/draft-dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#mobile-draft-panel-players tbody tr").first()).toBeVisible({ timeout: 60_000 });
  const done = page.getByRole("button", { name: "Done", exact: true });
  if (!options.keepSetup && await done.isVisible()) await done.click();
}

test("Draft Order fits every required viewport and resizes its contents", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFixture(page);
  // Recreate the previous toolbar height rules in detached-layout clones.
  const previousToolbarHeights = await page.evaluate(() => {
    const dashboard = document.querySelector("[data-god-view-open]")!;
    const measure = (selector: string, row: number) => {
      const clone = dashboard.querySelector(selector)!.cloneNode(true) as HTMLElement;
      clone.style.cssText = `position:absolute;left:-10000px;top:0;width:1200px;height:auto;min-height:${row === 1 ? 42 : 0}px;padding:${row === 1 ? "5px 12px" : "8px"}`;
      if (row === 2) clone.innerHTML = '<button>God View · Pro</button><span>Round 1 · snake</span><button>Expand draft graph</button>';
      clone.querySelectorAll<HTMLElement>("button, a").forEach(el => {
        el.style.cssText = `height:auto;min-height:${row === 1 ? 32 : 0}px;padding:${row === 1 ? "5px 9px" : "7px 10px"};border:1px solid;line-height:1.4`;
      });
      dashboard.appendChild(clone);
      const height = clone.getBoundingClientRect().height + (row === 2 ? 2 : 0);
      clone.remove();
      return height;
    };
    return { row1: measure('[class*="DraftWorkspace_workspaceHeader"]', 1), row2: measure('[class*="GodView_header"]', 2), gap: 10 };
  });
  const measurements = [];
  for (const [width, height] of [[1920,1080], [1728,900], [1440,900], [1366,768]]) {
    await page.setViewportSize({ width, height });
    const states = [];
    for (const expanded of [false, true]) {
      if (expanded) await page.getByRole("button", { name: "Expand God View - Pro" }).click();
      await page.waitForTimeout(150);
      const result = await audit(page);
      states.push(result.heights);
      measurements.push({ width, height, expanded, ...result.heights });
      await page.screenshot({ path: testInfo.outputPath(`${width}-${height}-${expanded ? "expanded" : "collapsed"}.png`), fullPage: true });
      if (expanded) await page.getByRole("button", { name: "Collapse God View - Pro" }).click();
    }
    expect(states[1].workspace).toBeLessThan(states[0].workspace);
    if (width === 1920) {
      expect(states[1].graphCell).toBeLessThan(states[0].graphCell);
      expect(states[1].rosterSlot).toBeLessThan(states[0].rosterSlot);
      expect(states[1].standingsRow).toBeLessThan(states[0].standingsRow);
    }
  }
  await writeFile(testInfo.outputPath("measurements.json"), JSON.stringify({ previousToolbarHeights, measurements }, null, 2));
  // Probe continuous resize and former breakpoint boundaries with the strip open.
  await page.getByRole("button", { name: "Expand God View - Pro" }).click();
  for (let step = 0; step <= 12; step++) {
    await page.setViewportSize({ width: Math.round(1366 + step * 554 / 12), height: Math.round(768 + step * 312 / 12) });
    await audit(page);
  }
  for (const height of [799,800,801,819,820,821,839,840,841,849,850,851]) {
    await page.setViewportSize({ width: 1366, height });
    await audit(page);
  }
  expect(errors).toEqual([]);
});

test("selection, snake turns, undo, graph dismissal and alternate rosters stay functional", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await openFixture(page);
  await page.getByRole("button", { name: "Expand God View - Pro" }).click();
  const strip = page.getByRole("region", { name: "Draft Order" });
  const cards = strip.locator('button[data-on-clock]');
  await expect(cards.nth(11)).toHaveAccessibleName(/Team 12 roster, pick 12, on the clock/);
  await expect(cards.nth(12)).toHaveAccessibleName(/Team 12 roster, pick 13$/);
  await cards.nth(13).click();
  const roster = page.locator("#mobile-draft-panel-roster");
  await expect(roster.locator("select").first()).toHaveValue("Team 11");
  await roster.getByRole("button", { name: "My Team", exact: true }).click();
  await expect(cards.nth(13)).toHaveAttribute("aria-pressed", "false");
  await expect(cards).toHaveCount(204);
  await expect(strip.locator('[class*="roundBreak"]')).toHaveCount(17);
  const timeline = strip.getByRole("region", { name: "All draft picks" });
  await timeline.evaluate(el => { el.scrollLeft = 0; });
  await expect(cards.first()).toBeInViewport();
  await expect(cards.first()).toContainText("Fixture Center");
  await expect(cards.first().locator('[aria-label="Live team category ranks"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("completed-picks-and-ranks.png"), fullPage: true });
  await roster.locator("select").first().selectOption("Team 2");
  expect(await timeline.evaluate(el => el.scrollLeft)).toBe(0);
  await strip.getByRole("button", { name: "Current pick", exact: true }).click();
  expect(await cards.nth(11).evaluate(el => Math.abs(el.getBoundingClientRect().left - el.parentElement!.getBoundingClientRect().left - 8))).toBeLessThan(1);
  await roster.getByRole("button", { name: "My Team", exact: true }).click();
  const players = page.locator("#mobile-draft-panel-players");
  const viewport = players.locator('[class*="tableContainer"]');
  await viewport.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await players.getByRole("button", { name: "Draft", exact: true }).first().click();
  await expect(cards.nth(12)).toHaveAccessibleName(/pick 13, on the clock/);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("u");
  await expect(cards.nth(11)).toHaveAccessibleName(/pick 12, on the clock/);
  await page.getByRole("button", { name: "Collapse God View - Pro" }).click();
  await expect(roster.locator("select").first()).toHaveValue("Team 1");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("link", { name: "Manage Draft Pro", exact: true }).first()).toHaveAttribute("href", "/account?section=draft-pro");
  for (const close of ["button", "escape"]) {
    await page.getByRole("button", { name: "Expand Draft Graph", exact: true }).click();
    const graph = page.getByRole("dialog", { name: "Draft Graph" });
    await expect(graph.getByRole("region", { name: "League Standings" })).toBeVisible();
    await expect(graph.getByRole("region", { name: "Team roster progress" })).toBeVisible();
    expect(await graph.evaluate(el => ({ h: el.scrollHeight <= el.clientHeight + 1, w: el.scrollWidth <= el.clientWidth + 1, top: el.getBoundingClientRect().top >= 58 }))).toEqual({ h: true, w: true, top: true });
    await page.screenshot({ path: testInfo.outputPath(`expanded-graph-${close}.png`) });
    if (close === "button") await graph.getByRole("button", { name: "Close expanded graph" }).click();
    else await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Expand Draft Graph", exact: true })).toBeFocused();
  }
  // Use the saved local fixture to inspect a nearly complete roster and a larger category configuration.
  await page.evaluate(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v2")!);
    snapshot.currentPick = 193;
    snapshot.draftedPlayers = Array.from({ length: 16 }, (_, i) => ({ playerId: String(i === 11 ? 2001 : 1001 + i), teamId: "Team 1", round: i + 1, pickInRound: i % 2 ? 12 : 1, pickNumber: i * 12 + (i % 2 ? 12 : 1) }));
    sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot));
    localStorage.setItem("draft.god-view.open", "true");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(roster.getByText("16 / 17", { exact: true })).toBeVisible();
  await audit(page);
  await page.screenshot({ path: testInfo.outputPath("nearly-complete-roster.png") });
  for (const config of [{ C: 3, LW: 3, RW: 3, D: 5, G: 2, utility: 2, bench: 6 }, { C: 2, LW: 2, RW: 2, D: 4, G: 2, utility: 1, bench: 0 }]) {
    await page.evaluate(rosterConfig => {
      const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v2")!);
      snapshot.draftSettings.rosterConfig = rosterConfig;
      snapshot.draftSettings.leagueType = "categories";
      snapshot.draftSettings.categoryWeights = { GOALS: 1, ASSISTS: 1, POINTS: 1, PP_POINTS: 1, SHOTS_ON_GOAL: 1, HITS: 1, BLOCKED_SHOTS: 1, WINS_GOALIE: 1, SHUTOUTS_GOALIE: 1, SAVES_GOALIE: 1, GOALS_AGAINST_AVERAGE: 1, SAVE_PERCENTAGE: 1 };
      snapshot.draftedPlayers = [];
      snapshot.currentPick = 1;
      sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot));
    }, config);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(cards.first()).toHaveAccessibleName(/pick 1, on the clock/);
    await audit(page);
    await page.screenshot({ path: testInfo.outputPath(`roster-${Object.values(config).reduce((a,b)=>a+b,0)}.png`) });
  }
});

test("table controls, roster search and free graph metrics remain available", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openFixture(page);
  const players = page.locator("#mobile-draft-panel-players");
  const search = players.getByRole("textbox", { name: "Search players", exact: true });
  await search.fill("Fixture Skater 1");
  await page.getByRole("button", { name: "Expand God View - Pro" }).click();
  await expect(search).toHaveValue("Fixture Skater 1");
  await players.getByLabel("Position filter").selectOption("D");
  await players.getByRole("columnheader", { name: "Player", exact: true }).click();
  await expect(players.getByRole("columnheader", { name: "Player", exact: true })).toHaveAttribute("aria-sort", /ascending|descending/);
  const selected = players.locator('tbody input[type="checkbox"]');
  await selected.nth(0).check();
  await selected.nth(1).check();
  await players.getByLabel("Open compare players").click();
  await expect(page.getByRole("dialog", { name: "Compare Players" })).toBeVisible();
  await page.keyboard.press("Escape");
  await players.getByRole("button", { name: "Refresh Data", exact: true }).click();
  await expect(search).toHaveValue("Fixture Skater 1");
  const roster = page.locator("#mobile-draft-panel-roster");
  await roster.getByText("Add a player to the team on the clock", { exact: true }).click();
  await roster.getByPlaceholder("Search Player...").fill("Fixture");
  await expect(roster.getByRole("listbox").getByRole("option")).toHaveCount(5);
  const results = roster.getByRole("listbox");
  expect(await results.evaluate(el => el.scrollHeight <= el.clientHeight && el.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  await roster.getByRole("listbox").getByRole("option").first().click();
  await expect(roster.getByRole("button", { name: "Add Player to Team 12" })).toBeInViewport();
  await roster.getByText("Add a player to the team on the clock", { exact: true }).click();
  await page.route("**/api/v1/account/draft-pro", route => route.fulfill({ json: { data: { access: { ...access, eligible: false, capabilities: [], grantingSources: [], reason: "no_entitlement" } } } }));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Explore upcoming picks and each team’s open roster slots with Draft Pro.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Expand Draft Graph", exact: true }).click();
  const graph = page.getByRole("dialog", { name: "Draft Graph" });
  await expect(graph.getByRole("region", { name: "League Standings" })).toBeVisible();
  await expect(graph.getByRole("region", { name: "Team roster progress" })).toHaveCount(0);
  await graph.getByRole("button", { name: "Close expanded graph" }).click();
});


test("suggested players swipe in both directions without moving the page", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openFixture(page);
  const row = page.getByRole("region", { name: "Suggested Picks", exact: true }).getByRole("list");
  await expect(row.getByRole("listitem")).toHaveCount(10);
  await row.hover();
  await page.mouse.wheel(700, 0);
  await expect.poll(() => row.evaluate(el => el.scrollLeft)).toBeGreaterThan(100);
  await page.mouse.wheel(-700, 0);
  await expect.poll(() => row.evaluate(el => el.scrollLeft)).toBeLessThan(2);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
});

for (const setup of ["fresh", "decline-tab", "decline-legacy", "accept-legacy"] as const) {
  for (const accountDefaults of setup === "fresh" ? [false, true] : [false]) {
    test(`setup review: ${setup}, account defaults ${accountDefaults}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1366, height: 768 });
      await openFixture(page, { setup, accountDefaults, keepSetup: true });
      const shell = page.getByRole("dialog", { name: "Draft Settings", exact: true });
      if (setup === "accept-legacy") {
        await expect(shell).not.toBeVisible();
        await expect(page.locator('[class*="GodView_pickProgress"]')).toHaveText("Pick 12 of 204");
      } else {
        await expect(shell).toBeVisible();
        await expect(shell.getByRole("tab", { name: "League & Draft", exact: true })).toHaveAttribute("aria-selected", "true");
        await expect(shell.getByLabel("Team name at draft position 1", { exact: true })).toHaveValue("Team 1");
        if (accountDefaults) await expect(shell.getByLabel("Team name at draft position 8")).toBeVisible();
        const snapshot = await page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}"));
        expect(snapshot.currentPick).toBe(1);
        expect(snapshot.draftedPlayers).toEqual([]);
        expect(snapshot.configured).toBe(false);
        if (accountDefaults) expect(snapshot.draftSettings.teamCount).toBe(8);
        await page.screenshot({ path: testInfo.outputPath("initial-settings.png"), fullPage: true });
      }
    });
  }
}

test("Settings names and order persist downstream, and reset reopens League & Draft", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page, { setup: "fresh", keepSetup: true });
  const shell = page.getByRole("dialog", { name: "Draft Settings", exact: true });
  await shell.getByLabel("Team name at draft position 1", { exact: true }).fill("Ice Owls");
  await shell.getByRole("button", { name: "Move Ice Owls down" }).click();
  await expect(shell.getByLabel("Team name at draft position 2")).toHaveValue("Ice Owls");
  await shell.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Expand God View - Pro" }).click();
  await expect(page.locator('button[data-pick="2"]')).toHaveAccessibleName(/Ice Owls/);
  await expect(page.locator('#mobile-draft-panel-roster select').first().locator('option[value="Team 1"]')).toHaveText("Ice Owls");
  await expect(page.getByRole("region", { name: "League Standings", exact: true }).getByText(/Ice Owls/)).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('button[data-pick="2"]')).toHaveAccessibleName(/Ice Owls/);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(shell.getByLabel("Team name at draft position 2")).toHaveValue("Ice Owls");
  await shell.getByRole("button", { name: "Done", exact: true }).click();
  const players = page.locator('#mobile-draft-panel-players');
  await players.locator('[class*="tableContainer"]').evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await players.getByRole("button", { name: "Draft", exact: true }).first().click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(shell.getByRole("button", { name: "Move Ice Owls up" })).toBeDisabled();
  await expect(shell.getByLabel("Team name at draft position 2")).toBeEnabled();
  await shell.getByRole("button", { name: "Management", exact: true }).click();
  await shell.getByRole("button", { name: "Reset Entire Draft", exact: true }).click();
  await shell.getByRole("button", { name: "Confirm Reset Entire Draft", exact: true }).click();
  await expect(shell).toBeVisible();
  await expect(shell.getByRole("tab", { name: "League & Draft", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(shell.getByRole("button", { name: "Move Ice Owls up" })).toBeEnabled();
});

test("the final pick can align left with trailing space", async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => {
    const snapshot = JSON.parse(sessionStorage.getItem("draft.snapshot.v2")!);
    snapshot.currentPick = 204;
    sessionStorage.setItem("draft.snapshot.v2", JSON.stringify(snapshot));
    localStorage.setItem("draft.god-view.open", "true");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const last = page.locator('[data-pick="204"]');
  await expect(last).toHaveAttribute("data-on-clock", "true");
  await expect.poll(() => last.evaluate(el => Math.abs(el.getBoundingClientRect().left - el.parentElement!.getBoundingClientRect().left - 8))).toBeLessThan(1);
});

test("homepage promotion works on desktop and mobile", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const banner = page.getByRole("region", { name: "FHFH Draft Dashboard" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await banner.scrollIntoViewIfNeeded();
    await expect(banner.getByRole("link", { name: "Open Draft Dashboard", exact: true })).toHaveAttribute("href", "/draft-dashboard");
    const premium = banner.getByRole("link", { name: "Explore Draft Pro", exact: true });
    await expect(premium).toHaveAttribute("href", "/account?section=draft-pro");
    expect(await premium.evaluate(el => ({ foreground: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }))).toEqual({ foreground: "rgb(13, 15, 17)", background: "rgb(255, 200, 87)" });
    await expect.poll(() => banner.locator("img").evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect(await banner.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await banner.screenshot({ path: testInfo.outputPath(`homepage-banner-${width}.png`) });
  }
});

test("Draft Pro account controls use accessible marigold styling", async ({ page }, testInfo) => {
  await openFixture(page);
  await page.route("**/api/v1/account/draft-pro", route => route.fulfill({ json: { data: {
    access: { ...access, eligible: false, grantingSources: [], capabilities: [] },
    passInfo: { priceCents: 599, expiresAt: "2027-07-01T04:00:00.000Z", renewal: "none" },
    checkoutAvailability: { available: true, reason: "available" },
    configurationReadiness: { stripe: true, patreon: false, yahoo: false },
    purchases: [], refundRequests: [], savedDrafts: [], privateImports: [],
  } } }));
  await page.goto("/account?section=draft-pro", { waitUntil: "domcontentloaded" });
  const purchase = page.getByRole("button", { name: /Get Draft Pro/ });
  await expect(purchase).toBeVisible();
  expect(await purchase.evaluate(el => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor])).toEqual(["rgb(13, 15, 17)", "rgb(255, 200, 87)"]);
  await purchase.focus();
  expect(await purchase.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("solid");
  await page.screenshot({ path: testInfo.outputPath("draft-pro-account.png"), fullPage: true });
});
