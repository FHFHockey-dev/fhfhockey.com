import { expect, test, type Page } from "@playwright/test";

/**
 * The /social-share landing page, behind the fictional editor session used by social-share.spec.ts. Run the dev server
 * and this spec with NEXT_PUBLIC_SUPABASE_URL on a reserved .invalid host. The network stays local.
 */
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");
const CHECKLIST_KEY = "fhfh-social-share-landing-checklist";

async function noPageOverflow(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(client);
}

test.beforeEach(async ({ page }) => {
  expect(supabaseOrigin.hostname.endsWith(".invalid")).toBe(true);
  const user = { id: "00000000-0000-4000-8000-00000000e2e1", aud: "authenticated", role: "authenticated", email: "editor@example.invalid", app_metadata: {}, user_metadata: {} };
  const session = { access_token: "e2e-fictional-editor-token", refresh_token: "e2e-fictional-refresh", token_type: "bearer", expires_in: 365 * 86400, expires_at: Math.floor(Date.now() / 1000) + 365 * 86400, user };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [`sb-${supabaseOrigin.hostname.split(".")[0]}-auth-token`, JSON.stringify(session)]);
  await page.context().route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.route(`${supabaseOrigin.origin}/**`, route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET") return route.abort();
    if (url.pathname === "/rest/v1/users") return route.fulfill({ json: /vnd\.pgrst\.object/.test(request.headers().accept ?? "") ? { role: "social_editor" } : [{ role: "social_editor" }] });
    return route.fulfill({ json: [] });
  });
});

test("by category: labelled lazy examples, working links, and a tile can list twice", async ({ page }) => {
  const response = await page.goto("/social-share");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page.getByRole("heading", { name: "Build a card" })).toBeVisible();
  await expect(page.getByText("Nothing is scheduled or published from here.")).toBeVisible();
  const schedule = page.locator("section", { has: page.getByRole("heading", { name: "Schedule", exact: true }) });
  const grid = schedule.locator('[data-card="game-grid"]');
  await expect(grid.getByText("Example · fixture")).toBeVisible();
  await expect(grid.locator("a")).toHaveAttribute("href", "/social-share/game-grid");
  const image = grid.locator("img");
  await expect(image).toHaveAttribute("loading", "lazy");
  await expect(image).toHaveAttribute("width", "540");
  await expect(image).toHaveAttribute("height", "540");
  await expect(page.locator('[data-card="standouts-defensemen"]')).toHaveCount(2);
  await expect(page.locator('[data-card="standouts-defensemen"]').first().getByText("Example", { exact: true })).toBeVisible();
  // Every tile's file decodes at the size its width and height promise, whether or not lazy loading has reached it yet.
  const sizes = await page.locator('[data-testid="landing-tile"] img').evaluateAll(images => Promise.all(images.map(async node => {
    const element = node as HTMLImageElement, probe = new Image();
    probe.src = element.src; await probe.decode();
    return { src: element.src, ok: probe.naturalWidth === Number(element.getAttribute("width")) && probe.naturalHeight === Number(element.getAttribute("height")) };
  })));
  expect(sizes.filter(size => !size.ok)).toEqual([]);

  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ status: 503, json: { error: "Fictional outage." } }));
  await page.locator('[data-card="bsh-risers"] a').first().click();
  await page.waitForURL(/\/social-share\/posts\?post=bsh-board&view=movers/);
  await expect(page.locator("label", { hasText: /^View/ }).locator("select")).toHaveValue("movers");
  await page.getByRole("link", { name: "All cards" }).click();
  await page.waitForURL(url => url.pathname === "/social-share");
  await expect(page.getByRole("heading", { name: "Build a card" })).toBeVisible();
});

test("the sort choice is remembered, and a missing image shows a clean placeholder", async ({ page }) => {
  await page.route("**/social-share/examples/game-grid.webp", route => route.abort());
  await page.goto("/social-share");
  await expect(page.locator('[data-card="game-grid"]').first().getByTestId("landing-placeholder")).toHaveText("No example yet");
  await page.getByRole("button", { name: "By day" }).click();
  await expect(page.getByTestId("landing-misc")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "By day" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/A suggested week, not a schedule/)).toBeVisible();
  for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) await expect(page.getByTestId(`landing-day-${day}`)).toBeVisible();
  await expect(page.getByTestId("landing-day-thu").locator('[data-card="player-cards"] a')).toHaveAttribute("href", "/social-share/player-cards");
});

test("by day: ticks survive a reload and clear in a new week", async ({ page }) => {
  await page.goto("/social-share");
  await page.getByRole("button", { name: "By day" }).click();
  const box = page.getByTestId("landing-day-mon").locator('[data-card="game-grid"]').getByRole("checkbox");
  await box.check();
  await page.reload();
  await expect(page.getByTestId("landing-day-mon").locator('[data-card="game-grid"]').getByRole("checkbox")).toBeChecked();
  await page.evaluate(key => window.localStorage.setItem(key, JSON.stringify({ week: "2020-01-06", done: ["mon:game-grid"] })), CHECKLIST_KEY);
  await page.reload();
  await expect(page.getByTestId("landing-day-mon").locator('[data-card="game-grid"]').getByRole("checkbox")).not.toBeChecked();
});

test("phone: no page overflow in either sort, a centred 90% page, and Misc scrolls on its own", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/social-share");
  await expect(page.getByRole("heading", { name: "Build a card" })).toBeVisible();
  await noPageOverflow(page);
  const box = await page.getByRole("heading", { name: "Build a card" }).evaluate(node => { const rect = node.closest("[class*='landing']")!.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width }; });
  expect(box.width).toBeLessThanOrEqual(375 * 0.9 + 1);
  expect(Math.abs(box.left - (375 - box.right))).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "By day" }).click();
  const misc = page.getByTestId("landing-misc");
  await expect(misc).toBeVisible();
  await noPageOverflow(page);
  expect(await misc.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  expect(await misc.evaluate(node => { node.scrollLeft = 300; return node.scrollLeft; })).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  await page.screenshot({ path: "test-results/social-share-landing/phone-by-day.png" });
});

test("desktop: seven day columns, with Misc scrolling above them", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/social-share");
  await expect(page.getByRole("heading", { name: "Build a card" })).toBeVisible();
  await page.screenshot({ path: "test-results/social-share-landing/desktop-by-category.png" });
  const byDay = page.getByRole("button", { name: "By day" });
  await byDay.click();
  await expect(byDay).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "By category" })).toHaveAttribute("aria-pressed", "false");
  const misc = page.getByTestId("landing-misc");
  expect(await misc.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  await byDay.blur();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);
  const tops = await Promise.all(["mon", "sun"].map(day => page.getByTestId(`landing-day-${day}`).evaluate(node => node.getBoundingClientRect().top)));
  expect(tops[0]).toBe(tops[1]);
  expect((await misc.boundingBox())!.y).toBeLessThan(tops[0]);
  await noPageOverflow(page);
  await page.screenshot({ path: "test-results/social-share-landing/desktop-by-day.png" });
});
