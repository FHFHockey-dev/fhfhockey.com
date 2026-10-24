// CR-REL-04 browser acceptance for P04 (shared StatsPage PlayerSearchBar): stale responses,
// keyboard/Escape, no hover/touch prefetch, client navigation on a plain click.
// `router.prefetch` is a no-op under `next dev`, so the network cannot show a prefetch. The check
// spies on the live pages router (`window.next.router`), which useRouter() delegates to at call
// time, and which next/link's hover/touch handlers call even with prefetch={false}.
import { expect, test, type Page } from "@playwright/test";

const GAME_PAGE = "/stats/game/2025020001";
type Spy = { prefetch: string[]; push: string[] };

async function installRouterSpy(page: Page) {
  await page.waitForFunction(() => Boolean((window as any).next?.router));
  await page.evaluate(() => {
    const w = window as any, router = w.next.router;
    w.__p04 = { prefetch: [], push: [] };
    const prefetch = router.prefetch.bind(router);
    router.prefetch = (url: string, ...rest: unknown[]) => { w.__p04.prefetch.push(String(url)); return prefetch(url, ...rest); };
    // Record the navigation without leaving the page (the player page needs server data this lane does not serve).
    router.push = (url: string) => { w.__p04.push.push(String(url)); return Promise.resolve(true); };
  });
}
const spy = (page: Page) => page.evaluate(() => (window as any).__p04 as Spy);

test("P04: search ignores stale responses, supports keyboard and Escape, never prefetches on hover/touch, and clicks navigate client-side", async ({ page }, testInfo) => {
  await page.route(url => !["127.0.0.1", "localhost"].includes(url.hostname), route => route.abort());
  await page.route("**/api/**", route => route.fulfill({ status: 503, json: { error: "fixture: not mocked" } }));
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const queries: string[] = [];
  await page.route("**/rest/v1/players?**", async route => {
    const query = new URL(route.request().url()).searchParams.get("fullName") ?? "";
    queries.push(query);
    if (query === "ilike.%Ma%") {
      await held; // answered only after the newer query has rendered
      return route.fulfill({ json: [{ id: 9001, fullName: "Stale Result", image_url: null, team_id: null }] });
    }
    if (query === "ilike.%Mack%") return route.fulfill({ json: [
      { id: 8480001, fullName: "Fixture Mackenzie", image_url: null, team_id: null },
      { id: 8480002, fullName: "Fixture Mackintosh", image_url: null, team_id: null },
    ] });
    return route.fulfill({ json: [] });
  });
  await page.goto(GAME_PAGE);
  const input = page.getByRole("textbox", { name: "Search players" });
  await expect(input).toBeVisible();
  await installRouterSpy(page);

  // Stale ordering: "Ma" is held while "Mack" answers; the late "Ma" answer must not replace it.
  await input.fill("Ma");
  await expect.poll(() => queries.includes("ilike.%Ma%")).toBe(true);
  await input.fill("Mack");
  const results = page.getByRole("list", { name: "Player search results" });
  await expect(results.getByRole("link")).toHaveText(["Fixture Mackenzie", "Fixture Mackintosh"]);
  release();
  await page.waitForTimeout(500);
  await expect(results.getByRole("link")).toHaveText(["Fixture Mackenzie", "Fixture Mackintosh"]);
  await expect(page.getByText("Stale Result")).toHaveCount(0);
  await expect(results.getByRole("link", { name: "Fixture Mackenzie" })).toHaveAttribute("href", "/stats/player/8480001");
  await page.screenshot({ path: testInfo.outputPath(`p04-results-${testInfo.project.name}.png`) });

  // Hover and touch on results: no router prefetch.
  const first = results.getByRole("link", { name: "Fixture Mackenzie" });
  await first.hover();
  await results.getByRole("link", { name: "Fixture Mackintosh" }).hover();
  if (testInfo.project.use.hasTouch) await first.dispatchEvent("touchstart");
  await page.waitForTimeout(300);
  expect((await spy(page)).prefetch, "router.prefetch calls after hover/touch").toEqual([]);

  // Keyboard: ArrowDown focuses the first result, ArrowDown/ArrowUp move, Escape dismisses.
  await input.focus();
  await page.keyboard.press("ArrowDown");
  await expect(first).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(results.getByRole("link", { name: "Fixture Mackintosh" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(first).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(results).toHaveCount(0);
  await expect(input).toBeFocused();

  // ArrowDown reopens the retained results; a plain click (tap on mobile) then navigates through the
  // client router and clears the search.
  await page.keyboard.press("ArrowDown");
  await expect(first).toBeFocused();
  if (testInfo.project.use.hasTouch) await first.tap(); else await first.click();
  await expect.poll(async () => (await spy(page)).push).toEqual(["/stats/player/8480001"]);
  await expect(input).toHaveValue("");
  expect((await spy(page)).prefetch, "router.prefetch calls after selection").toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`p04-after-select-${testInfo.project.name}.png`) });
});
