import { expect, test, type Page } from "@playwright/test";

type Surface = "playerStats" | "teamStats" | "goalieStats";
type FixtureState = "data" | "loading" | "empty" | "error";
const surfaces: Surface[] = ["playerStats", "teamStats", "goalieStats"];
const viewportSizes = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  // Effective layout size of a 1440x900 display at 200% browser zoom.
  { width: 720, height: 450 },
];

async function installFixtures(page: Page, surface: Surface, state: FixtureState = "data") {
  const requests: string[] = [];
  let releaseLoading = () => {};
  const loadingGate = new Promise<void>((resolve) => { releaseLoading = resolve; });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const localOrigin = new URL(test.info().project.use.baseURL as string).origin;
    if (url.origin !== localOrigin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (!url.pathname.startsWith("/api/v1/underlying-stats/")) return route.fulfill({ json: {} });
    requests.push(url.pathname + url.search);
    if (url.pathname.endsWith("/route-status")) {
      const snapshot = { latestSnapshotDate: "2026-03-08", rowCount: 32, status: "ready" };
      return route.fulfill({ json: { success: true, status: {
        teamRatings: snapshot, skaterOffenseRatings: snapshot, skaterDefenseRatings: snapshot,
        goalieRatings: snapshot, gamePredictions: snapshot,
        playerPredictions: { latestSnapshotDate: null, rowCount: 0, status: "pending" },
        modelMarketFlags: { latestSnapshotDate: null, rowCount: 0, status: "pending" },
      } } });
    }
    if (state === "loading") await loadingGate;
    if (state === "error") return route.fulfill({ status: 503, json: { error: "Fixture stats unavailable" } });
    const isTeam = surface === "teamStats";
    const isGoalie = surface === "goalieStats";
    const isDetail = /\/(players|goalies)\/\d+$/.test(url.pathname);
    const isChart = url.pathname.endsWith("/chart");
    const rates = url.searchParams.get("displayMode") === "rates";
    const family = isTeam ? (rates ? "rates" : "counts") : isGoalie ? (rates ? "goalieRates" : "goalieCounts") : (rates ? "onIceRates" : "onIceCounts");
    const pageNumber = Number(url.searchParams.get("page") ?? 1);
    const count = state === "empty" ? 0 : isChart ? 10 : isDetail ? 8 : isTeam ? 32 : 100;
    const rows = Array.from({ length: count }, (_, i) => {
      const index = (pageNumber - 1) * 100 + i;
      return {
        rowKey: `fixture:${index}`, playerId: 8478400 + index,
        playerName: `Fixture ${isGoalie ? "Goalie" : "Skater"} ${index + 1}`,
        teamId: 1, teamLabel: "FLA", positionCode: isGoalie ? "G" : "C",
        seasonId: 20252026 - i * 10001, seasonLabel: `${2025 - i}-${2026 - i}`,
        gamesPlayed: 12, toiSeconds: 12000, xgfPct: 0.55, points: 23,
        cf: 100, ca: 90, xgf: 12, xga: 10, saves: 150, shotsAgainst: 160, savePct: 0.9375,
        gameId: 2026020001 + i, gameDate: `2026-10-${String(i + 1).padStart(2, "0")}`,
        opponentTeamId: 2, isHome: true,
      };
    });
    return route.fulfill({ json: {
      family, rows, playerId: 8478400,
      sort: { sortKey: url.searchParams.get("sortKey") ?? (isTeam ? "points" : isGoalie ? "saves" : "xgfPct"), direction: url.searchParams.get("sortDirection") ?? "desc" },
      pagination: { page: pageNumber, pageSize: isTeam ? 50 : 100, totalRows: state === "empty" ? 0 : isDetail ? 8 : isTeam ? 32 : 200, totalPages: isTeam || isDetail ? 1 : 2 },
      placeholder: false, generatedAt: "2026-10-09T10:00:00.000Z",
    } });
  });
  return { requests, releaseLoading };
}

async function expectReachableTable(page: Page, requiresVerticalScroll = true) {
  const viewport = page.locator('[class*="PlayerStatsTable_viewport"]');
  await expect(viewport.locator("tbody tr").first()).toBeVisible();
  const size = await viewport.boundingBox();
  expect(size?.height).toBeGreaterThan(150);
  expect(size?.height).toBeLessThanOrEqual(674);
  await viewport.scrollIntoViewIfNeeded();
  await expect(viewport).toBeInViewport({ ratio: 0.5 });
  const geometry = await viewport.evaluate((el) => {
    const bounds = el.getBoundingClientRect();
    let ancestor = el.parentElement;
    const clippedBy: string[] = [];
    while (ancestor) {
      const style = getComputedStyle(ancestor);
      const rect = ancestor.getBoundingClientRect();
      if (/hidden|clip/.test(style.overflowY) && (bounds.top < rect.top - 1 || bounds.bottom > rect.bottom + 1)) clippedBy.push(ancestor.className);
      ancestor = ancestor.parentElement;
    }
    return { clippedBy, documentWidth: document.documentElement.scrollWidth, width: innerWidth, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  });
  expect(geometry.clippedBy).toEqual([]);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.width);
  if (requiresVerticalScroll) expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
  return viewport;
}

for (const surface of surfaces) {
  for (const width of [320, 390, 641, 1023, 1024, 1440]) {
    test(`${surface} Tab and Shift+Tab fully reveal sort controls at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const fixture = await installFixtures(page, surface);
      await page.goto(`/underlying-stats/${surface}`);
      const viewport = await expectReachableTable(page);
      const buttons = viewport.locator("thead button");
      const count = await buttons.count();
      await buttons.first().focus();

      const expectFocusedControlVisible = async (index: number) => {
        const button = buttons.nth(index);
        await expect(button).toBeFocused();
        await expect.poll(() => button.evaluate((el) => {
          const view = el.closest('[class*="PlayerStatsTable_viewport"]')!;
          const bounds = view.getBoundingClientRect();
          const header = el.closest("th")!;
          const pinnedRight = getComputedStyle(header).left !== "auto" ? bounds.left :
            Math.max(bounds.left, ...Array.from(view.querySelectorAll("thead th"))
              .filter((cell) => getComputedStyle(cell).left !== "auto")
              .map((cell) => cell.getBoundingClientRect().right));
          const rect = el.getBoundingClientRect();
          const hit = (x: number) => el.contains(document.elementFromPoint(x, rect.top + rect.height / 2));
          const label = document.createRange();
          label.selectNodeContents(el.querySelector("span")!);
          const labelFits = Array.from(label.getClientRects()).every((line) =>
            line.left >= rect.left - 1 && line.right <= rect.right + 1);
          return el.matches(":focus-visible") && labelFits &&
            rect.left >= pinnedRight + 4 && rect.right <= bounds.left + view.clientWidth - 4 &&
            rect.top >= bounds.top + 4 && rect.bottom <= bounds.top + view.clientHeight - 4 &&
            hit(rect.left + 1) && hit(rect.right - 1);
        }), { message: `Fully visible keyboard focus and label for ${await button.getAttribute("aria-label")}` }).toBe(true);
      };

      for (let index = 0; index < count; index++) {
        await expectFocusedControlVisible(index);
        if (surface === "playerStats" && await buttons.nth(index).getAttribute("aria-label") === "Sort by CA") {
          await page.keyboard.press("Enter");
          await expect(buttons.nth(index)).toHaveAttribute("aria-pressed", "true");
          await expect.poll(() => fixture.requests.some((url) => new URL(url, "http://fixture").searchParams.get("sortKey") === "ca")).toBe(true);
          await expectFocusedControlVisible(index);
        }
        if (index < count - 1) await page.keyboard.press("Tab");
      }
      for (let index = count - 2; index >= 0; index--) {
        await page.keyboard.press("Shift+Tab");
        await expectFocusedControlVisible(index);
      }
      const pinnedCount = await viewport.locator("thead th").evaluateAll((cells) =>
        cells.filter((cell) => getComputedStyle(cell).left !== "auto").length);
      expect(pinnedCount).toBe(width >= 1024 ? 2 : 1);
      await page.screenshot({ path: test.info().outputPath("keyboard-reveal.png") });
    });
  }
}

test.describe("Underlying Stats touch scrolling with keyboard focus", () => {
  test.use({ hasTouch: true });
  for (const surface of surfaces) {
    test(`${surface} retains horizontal touch scrolling at 390px`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await installFixtures(page, surface);
      await page.goto(`/underlying-stats/${surface}`);
      const viewport = await expectReachableTable(page);
      await viewport.locator("thead button").first().focus();
      const bounds = (await viewport.boundingBox())!;
      const session = await page.context().newCDPSession(page);
      const swipe = async (towardEnd: boolean) => {
        const start = bounds.x + (towardEnd ? bounds.width - 30 : 30);
        const end = bounds.x + (towardEnd ? 30 : bounds.width - 30);
        const y = bounds.y + 80;
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: start, y }] });
        for (let step = 1; step <= 5; step++) {
          await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start + (end - start) * step / 5, y }] });
        }
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(200);
      };
      const before = await viewport.evaluate((el) => el.scrollLeft);
      await swipe(true);
      const after = await viewport.evaluate((el) => el.scrollLeft);
      expect(after).toBeGreaterThan(before);
      await swipe(false);
      expect(await viewport.evaluate((el) => el.scrollLeft)).toBeLessThan(after);
      await session.detach();
    });
  }
});

for (const surface of surfaces) {
  for (const viewportSize of viewportSizes) {
    test(`${surface} data, alignment and two-axis scrolling at ${viewportSize.width}x${viewportSize.height}`, async ({ page }) => {
      await page.setViewportSize(viewportSize);
      const fixture = await installFixtures(page, surface);
      await page.goto(`/underlying-stats/${surface}`);
      const viewport = await expectReachableTable(page);
      const rank = viewport.locator("thead th").first();
      const rankBefore = await rank.boundingBox();
      await viewport.evaluate((el) => { el.scrollTop = el.scrollHeight; el.scrollLeft = el.scrollWidth; });
      const lastHeader = viewport.locator("thead th").last();
      const lastCell = viewport.locator("tbody tr").last().locator("td").last();
      await expect(lastCell).toBeVisible();
      const headerBox = await lastHeader.boundingBox();
      const cellBox = await lastCell.boundingBox();
      const viewportBox = await viewport.boundingBox();
      expect(Math.abs(headerBox!.x - cellBox!.x)).toBeLessThan(1);
      expect(Math.abs(headerBox!.y - viewportBox!.y)).toBeLessThan(2);
      expect(Math.abs((await rank.boundingBox())!.x - rankBefore!.x)).toBeLessThan(1);
      expect(await lastHeader.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      })).toBe(true);
      if (surface !== "teamStats") {
        const initialRequests = fixture.requests.filter((url) => /\/(players|goalies)\?/.test(url));
        expect(initialRequests.length).toBeGreaterThan(0);
        expect(initialRequests.every((url) => new URL(url, "http://fixture").searchParams.get("page") === "1")).toBe(true);
        await page.getByRole("button", { name: "Load more", exact: true }).click();
        await expect(viewport.locator("tbody tr")).toHaveCount(200);
        expect(fixture.requests.filter((url) => /\/(players|goalies)\?/.test(url))).toHaveLength(initialRequests.length + 1);
      }
      await page.screenshot({ path: test.info().outputPath("data-and-scroll.png"), fullPage: true });
    });
  }

  for (const width of [390, 1440]) {
    for (const state of ["loading", "empty", "error"] as const) {
      test(`${surface} ${state} state remains reachable at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        const fixture = await installFixtures(page, surface, state);
        await page.goto(`/underlying-stats/${surface}`);
        const message = state === "error" ? /Fixture stats unavailable/ : state === "empty" ? /No (players|goalies|team results) matched/ : surface === "teamStats" ? /Loading team results/ : /Loading first 100 (rows|goalies)/;
        const content = page.locator("main").getByText(message).first();
        await content.scrollIntoViewIfNeeded();
        await expect(content).toBeInViewport();
        await expect(page.getByRole("button", { name: "Show advanced filters" })).toBeVisible();
        fixture.releaseLoading();
        if (state === "loading") await expectReachableTable(page);
        await page.screenshot({ path: test.info().outputPath(`${state}.png`), fullPage: true });
      });
    }
  }
}

for (const surface of ["playerStats", "goalieStats"] as const) {
  for (const width of [390, 1440]) {
    test(`${surface} detail and expanded trend remain reachable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await installFixtures(page, surface);
      await page.goto(`/underlying-stats/${surface}`);
      const viewport = await expectReachableTable(page);
      await viewport.getByRole("button", { name: /Expand .* trend chart/ }).first().click();
      await expect(viewport.getByRole("button", { name: /Collapse .* trend chart/ }).first()).toHaveAttribute("aria-expanded", "true");
      await expect(viewport.locator('[class*="PlayerStatsExpandedRowChart"]').first()).toBeVisible();
      const link = viewport.getByRole("link", { name: /Fixture/ }).first();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/underlying-stats/${surface}/8478400`));
      await expectReachableTable(page, false);
      await page.screenshot({ path: test.info().outputPath("detail.png"), fullPage: true });
    });
  }
}
