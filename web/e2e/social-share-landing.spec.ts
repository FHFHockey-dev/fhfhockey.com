import { expect, test, type Page } from "@playwright/test";

/**
 * The /social-share landing page, behind the fictional editor session used by social-share.spec.ts. Run the dev server
 * and this spec with NEXT_PUBLIC_SUPABASE_URL on a reserved .invalid host. The network stays local.
 */
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://supabase.e2e.invalid");
const DAYS_KEY = "fhfh-social-share-landing-days";
const sectionOrder = (page: Page) => page.locator('[data-testid^="landing-section-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute("data-testid")!.replace("landing-section-", "")));

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
  // The default: the automatic source is unavailable, so the strip stays on hand marking. A test overrides this.
  await page.route("**/api/v1/social-share/posted-week", route => route.fulfill({ status: 503, json: { error: "Posted status unavailable." } }));
});

test("by category: daily sections first, with picture, name and description inside each bordered card", async ({ page }) => {
  const hydration: string[] = [];
  page.on("console", message => { if (/hydrat/i.test(message.text())) hydration.push(message.text()); });
  const response = await page.goto("/social-share");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page.getByRole("heading", { name: "Build a card" })).toBeVisible();
  await expect(page.getByText("Nothing is scheduled or published from here.")).toBeVisible();
  expect(await sectionOrder(page)).toEqual(["standouts", "schedule", "trends", "peripherals", "skaters", "defensemen", "goalies", "weekly", "comparisons", "player-cards"]);
  expect(await page.getByTestId("landing-row-standouts").getByTestId("landing-tile").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-card")))).toEqual(["standouts-forwards", "standouts-defensemen", "standouts-goalies", "standouts-under", "standouts-all"]);

  const card = page.getByTestId("landing-row-schedule").locator('[data-card="game-grid"]');
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByText("Example · fixture")).toBeVisible();
  await expect(card.locator("a")).toHaveAttribute("href", "/social-share/game-grid");
  const image = card.locator("img");
  await expect(image).toHaveAttribute("loading", "lazy");
  await expect(image).toHaveAttribute("width", "540");
  await expect(image).toHaveAttribute("height", "540");
  expect(await card.evaluate(node => getComputedStyle(node).borderTopStyle)).toBe("solid");
  const outer = (await card.boundingBox())!;
  for (const part of [image, card.getByRole("strong"), card.getByText("Every team's week of games")]) {
    const inner = (await part.boundingBox())!;
    expect(inner.x).toBeGreaterThanOrEqual(outer.x);
    expect(inner.y).toBeGreaterThanOrEqual(outer.y);
    expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width);
    expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height);
  }
  await expect(page.locator('[data-card="standouts-forwards"]').first().getByText("Example", { exact: true })).toBeVisible();
  // Every tile's file decodes at the size its width and height promise, whether or not lazy loading has reached it yet.
  const sizes = await page.locator('[data-testid="landing-tile"] img').evaluateAll(images => Promise.all(images.map(async node => {
    const element = node as HTMLImageElement, probe = new Image();
    probe.src = element.src; await probe.decode();
    return { src: element.src, ok: probe.naturalWidth === Number(element.getAttribute("width")) && probe.naturalHeight === Number(element.getAttribute("height")) };
  })));
  expect(sizes.filter(size => !size.ok)).toEqual([]);
  expect(hydration).toEqual([]);

  await page.route("**/api/v1/social-share/posts/**", route => route.fulfill({ status: 503, json: { error: "Fictional outage." } }));
  await page.locator('[data-card="bsh-risers"] a').first().click();
  await page.waitForURL(/\/social-share\/posts\?post=bsh-board&view=movers/);
  await expect(page.locator("label", { hasText: /^View/ }).locator("select")).toHaveValue("movers");
  await page.getByRole("link", { name: "All cards" }).click();
  await page.waitForURL(url => url.pathname === "/social-share");
  await expect(page.getByRole("heading", { name: "Build a card" })).toBeVisible();
});

test("the sort choice is remembered, and a missing image shows a clean placeholder", async ({ page }) => {
  await page.route("**/social-share/examples/standouts-forwards.webp", route => route.abort());
  await page.goto("/social-share");
  await expect(page.locator('[data-card="standouts-forwards"]').first().getByTestId("landing-placeholder")).toHaveText("No example yet");
  await page.getByRole("button", { name: "By day" }).click();
  await expect(page.getByTestId("landing-row-misc")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "By day" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/A suggested week, not a schedule/)).toBeVisible();
  await expect(page.getByTestId("landing-section-thu").locator('[data-card="player-cards"] a')).toHaveAttribute("href", "/social-share/player-cards");
});

test("by day: today leads and is labelled, then Misc, then the rest from tomorrow", async ({ page }) => {
  for (const [time, order] of [
    ["2026-11-02T16:00:00Z", ["mon", "misc", "tue", "wed", "thu", "fri", "sat", "sun"]],
    ["2026-11-04T16:00:00Z", ["wed", "misc", "thu", "fri", "sat", "sun", "mon", "tue"]],
    // Still Saturday night in New York, already Sunday in UTC.
    ["2026-11-08T04:00:00Z", ["sat", "misc", "sun", "mon", "tue", "wed", "thu", "fri"]],
  ] as const) {
    await page.clock.setFixedTime(new Date(time));
    await page.goto("/social-share");
    await page.getByRole("button", { name: "By day" }).click();
    await expect(page.getByRole("heading", { name: /^Today/ })).toBeVisible();
    await expect.poll(() => sectionOrder(page)).toEqual([...order]);
    await expect(page.getByTestId(`landing-section-${order[0]}`).getByRole("heading", { name: /^Today/ })).toBeVisible();
    await expect(page.getByTestId("landing-jump").getByRole("link").first()).toHaveText("Today");
  }
});

test("the week strip: marked by hand, future days neutral, one click per day, and a Monday reset", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-04T16:00:00Z")); // Wednesday
  await page.goto("/social-share");
  const strip = page.getByTestId("landing-strip");
  await expect(page.getByText(/Marked by hand/)).toBeVisible();
  await expect(strip.getByTestId("landing-strip-wed")).toHaveAttribute("data-today", "true");
  await expect(strip.getByTestId("landing-strip-mon").locator("[data-mark]")).toHaveAttribute("data-mark", "missed");
  await expect(strip.getByTestId("landing-strip-wed").locator("[data-mark]")).toHaveAttribute("data-mark", "missed");
  for (const day of ["thu", "fri", "sat", "sun"]) {
    const button = strip.getByTestId(`landing-strip-${day}`);
    await expect(button).toHaveAttribute("data-status", "upcoming");
    await expect(button.locator("[data-mark]")).not.toHaveAttribute("data-mark", "missed");
    await expect(button).toBeDisabled();
  }
  await expect(page.getByRole("checkbox")).toHaveCount(0);

  await strip.getByTestId("landing-strip-mon").click();
  await expect(strip.getByTestId("landing-strip-mon").locator("[data-mark]")).toHaveAttribute("data-mark", "done");
  await page.reload();
  await expect(strip.getByTestId("landing-strip-mon").locator("[data-mark]")).toHaveAttribute("data-mark", "done");
  await strip.getByTestId("landing-strip-tue").click();
  await strip.getByTestId("landing-strip-tue").click();
  await expect(strip.getByTestId("landing-strip-tue").locator("[data-mark]")).toHaveAttribute("data-mark", "missed");
  expect(await page.evaluate(key => JSON.parse(window.localStorage.getItem(key)!), DAYS_KEY)).toEqual({ week: "2026-11-02", done: ["mon"] });

  await page.clock.setFixedTime(new Date("2026-11-09T16:00:00Z")); // The next Monday
  await page.reload();
  await expect(strip.getByTestId("landing-strip-mon")).toHaveAttribute("data-today", "true");
  await expect(strip.getByTestId("landing-strip-mon").locator("[data-mark]")).toHaveAttribute("data-mark", "missed");
  await expect(strip.getByTestId("landing-strip-tue")).toHaveAttribute("data-status", "upcoming");
});

test("the week strip from real posts: today reads not yet, future days are neutral, nothing to click, and counts by card", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-04T16:00:00Z")); // Wednesday
  const statuses = { mon: ["done", 2], tue: ["missed", 0], wed: ["notYet", 0], thu: ["upcoming", 0], fri: ["upcoming", 0], sat: ["upcoming", 0], sun: ["upcoming", 0] } as const;
  await page.route("**/api/v1/social-share/posted-week", route => route.fulfill({ json: {
    available: true, week: "2026-11-02", today: "wed", trackedFrom: "2026-10-01", latest: "2026-11-02T17:00:00Z", stale: false, undated: 1,
    days: Object.entries(statuses).map(([id, [status, posts]], index) => ({ id, date: `2026-11-0${index + 2}`, posts, status })),
    cards: [{ card: "game-grid", name: "Game Grid", count: 1 }], unmatched: 1,
  } }));
  await page.addInitScript(key => window.localStorage.setItem(key, JSON.stringify({ week: "2026-11-02", done: ["tue"] })), DAYS_KEY);
  await page.goto("/social-share");
  const strip = page.getByTestId("landing-strip");
  await expect(page.getByText(/From @FHFHockey's posts.*Last live delivery Nov 2\./)).toBeVisible();
  await expect(page.getByText(/Marked by hand/)).toHaveCount(0);
  await expect(strip.getByTestId("landing-strip-mon").locator("[data-mark]")).toHaveAttribute("data-mark", "done");
  await expect(strip.getByTestId("landing-strip-mon")).toHaveAttribute("aria-label", "Mon: posted, 2 posts");
  // A hand mark for Tuesday is ignored while the source answers.
  await expect(strip.getByTestId("landing-strip-tue").locator("[data-mark]")).toHaveAttribute("data-mark", "missed");
  await expect(strip.getByTestId("landing-strip-tue")).not.toContainText("not yet");
  await expect(strip.getByTestId("landing-strip-tue")).toHaveAttribute("aria-label", "Tue: no post recorded");
  await expect(strip.getByTestId("landing-strip-wed").locator("[data-mark]")).toHaveAttribute("data-mark", "missed");
  await expect(strip.getByTestId("landing-strip-wed")).toContainText("not yet");
  await expect(strip.getByTestId("landing-strip-wed")).toHaveAttribute("aria-label", "Wed (today): not yet");
  await expect(strip.getByTestId("landing-strip-thu").locator("[data-mark]")).not.toHaveAttribute("data-mark", "missed");
  await expect(strip.getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("landing-posted-cards")).toHaveText(/Posts by card, this week:\s*Game Grid 1\s*Unmatched 1\s*No date 1/);

  await page.setViewportSize({ width: 375, height: 812 });
  await noPageOverflow(page);
  for (const day of ["mon", "sun"]) { const box = (await page.getByTestId(`landing-strip-${day}`).boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(375); }
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/social-share-landing/phone-posted-strip.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/social-share-landing/desktop-posted-strip.png" });
});

test("a stale source reads no record, not a cross, and says why", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-04T16:00:00Z")); // Wednesday
  const statuses = { mon: "noRecord", tue: "noRecord", wed: "noRecord", thu: "upcoming", fri: "upcoming", sat: "upcoming", sun: "upcoming" };
  await page.route("**/api/v1/social-share/posted-week", route => route.fulfill({ json: {
    available: true, week: "2026-11-02", today: "wed", trackedFrom: "2026-10-01", latest: "2026-10-30T17:00:00Z", stale: true, undated: 0,
    days: Object.entries(statuses).map(([id, status], index) => ({ id, date: `2026-11-0${index + 2}`, posts: 0, status })), cards: [], unmatched: 0,
  } }));
  await page.goto("/social-share");
  await expect(page.getByText(/No live delivery since Oct 30, so later days have no record\./)).toBeVisible();
  const strip = page.getByTestId("landing-strip");
  for (const day of ["mon", "tue", "wed"]) {
    await expect(strip.getByTestId(`landing-strip-${day}`).locator("[data-mark]")).not.toHaveAttribute("data-mark", "missed");
    await expect(strip.getByTestId(`landing-strip-${day}`)).toContainText("no record");
  }
  await expect(strip.getByTestId("landing-strip-wed")).toHaveAttribute("aria-label", "Wed (today): no record");
});

test("no dated posts: hand marking, with the undated count shown", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-04T16:00:00Z")); // Wednesday
  await page.route("**/api/v1/social-share/posted-week", route => route.fulfill({ json: { available: false, undated: 2 } }));
  await page.goto("/social-share");
  await expect(page.getByText(/Marked by hand/)).toBeVisible();
  await expect(page.getByTestId("landing-posted-undated")).toHaveText("Posts received with no date: 2");
  await page.getByTestId("landing-strip-mon").click();
  await expect(page.getByTestId("landing-strip-mon").locator("[data-mark]")).toHaveAttribute("data-mark", "done");
});

test("a failed read says so and falls back to hand marking", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-04T16:00:00Z")); // Wednesday
  await page.goto("/social-share");
  await expect(page.getByText(/Could not read posts\. Marked by hand/)).toBeVisible();
  await page.getByTestId("landing-strip-mon").click();
  await expect(page.getByTestId("landing-strip-mon").locator("[data-mark]")).toHaveAttribute("data-mark", "done");
});

test("crossing midnight with the tab visible: today and the week move on with no reload", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-09T04:59:00Z") }); // Sunday 23:59 in New York
  await page.addInitScript(key => window.localStorage.setItem(key, JSON.stringify({ week: "2026-11-02", done: ["mon"] })), DAYS_KEY);
  await page.goto("/social-share");
  const strip = page.getByTestId("landing-strip");
  await expect(strip.getByTestId("landing-strip-sun")).toHaveAttribute("data-today", "true");
  await expect(strip.getByTestId("landing-strip-mon").locator("[data-mark]")).toHaveAttribute("data-mark", "done");

  await page.clock.fastForward("02:00"); // Monday 00:01
  await expect(strip.getByTestId("landing-strip-mon")).toHaveAttribute("data-today", "true");
  await expect(strip.getByTestId("landing-strip-mon").locator("[data-mark]")).toHaveAttribute("data-mark", "missed");
  await expect(strip.getByTestId("landing-strip-sun")).toHaveAttribute("data-status", "upcoming");
  await expect(strip.getByTestId("landing-strip-tue")).toBeDisabled();
});

test("a click in the minute before the page catches up cannot mark a day that has not come", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-09T04:59:00Z")); // Sunday 23:59 in New York
  await page.goto("/social-share");
  const strip = page.getByTestId("landing-strip");
  await expect(strip.getByTestId("landing-strip-tue")).toBeEnabled();

  await page.clock.setFixedTime(new Date("2026-11-09T05:00:30Z")); // Monday 00:00:30, and the page has not ticked yet
  await strip.getByTestId("landing-strip-tue").click();
  await expect(strip.getByTestId("landing-strip-mon")).toHaveAttribute("data-today", "true");
  await expect(strip.getByTestId("landing-strip-tue")).toHaveAttribute("data-status", "upcoming");
  await expect(strip.getByTestId("landing-strip-tue").locator("[data-mark]")).not.toHaveAttribute("data-mark", "done");
  expect(await page.evaluate(key => window.localStorage.getItem(key), DAYS_KEY)).toBeNull();
});

test("the week strip falls back to hand marking when the source has no posts, or answers for another week", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-04T16:00:00Z")); // Wednesday
  await page.route("**/api/v1/social-share/posted-week", route => route.fulfill({ json: { available: false } }));
  await page.goto("/social-share");
  await expect(page.getByText(/Marked by hand/)).toBeVisible();
  await page.getByTestId("landing-strip-mon").click();
  await expect(page.getByTestId("landing-strip-mon").locator("[data-mark]")).toHaveAttribute("data-mark", "done");
  await expect(page.getByTestId("landing-posted-cards")).toHaveCount(0);

  await page.route("**/api/v1/social-share/posted-week", route => route.fulfill({ json: { available: true, week: "2026-10-26", today: "sun", trackedFrom: "2026-10-01", latest: "2026-10-30T17:00:00Z", stale: false, undated: 0, days: [], cards: [], unmatched: 0 } }));
  await page.reload();
  await expect(page.getByText(/Marked by hand/)).toBeVisible();
  await expect(page.getByTestId("landing-strip-mon").locator("[data-mark]")).toHaveAttribute("data-mark", "done");
});

test("quick links: a section jump, a card chip that scrolls its row by keyboard, and the filter", async ({ page }) => {
  await page.goto("/social-share");
  const jump = page.getByTestId("landing-jump");
  await expect(jump).toBeVisible();
  expect(await jump.getByRole("link").evaluateAll(links => links.map(link => document.getElementById((link as HTMLAnchorElement).hash.slice(1))?.getAttribute("data-testid")))).toEqual(["standouts", "schedule", "trends", "peripherals", "skaters", "defensemen", "goalies", "weekly", "comparisons", "player-cards"].map(id => `landing-section-${id}`));
  await jump.getByRole("link", { name: "Goalies" }).focus();
  await page.keyboard.press("Enter");
  const goalies = page.getByTestId("landing-section-goalies");
  await expect(goalies).toBeInViewport();
  await expect(goalies).toBeFocused();

  const row = page.getByTestId("landing-row-goalies"), chip = goalies.getByRole("navigation").getByRole("link", { name: "Goalie of the Month" });
  await expect(goalies.locator(await chip.getAttribute("href") as string)).toHaveCount(1);
  expect(await row.evaluate(node => node.scrollLeft)).toBe(0);
  await chip.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => row.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
  await expect(row.locator('[data-card="goalie-of-month"] a')).toBeFocused();
  await expect(row.locator('[data-card="goalie-of-month"]')).toBeInViewport();

  const filter = page.locator("label", { hasText: /^Show/ }).locator("select");
  await filter.selectOption("trends");
  expect(await sectionOrder(page)).toEqual(["trends"]);
  await jump.getByRole("link", { name: "Peripherals" }).click();
  expect(await sectionOrder(page)).toEqual(["peripherals"]);
  await expect(filter).toHaveValue("peripherals");
  await filter.selectOption("all");
  expect((await sectionOrder(page)).length).toBe(10);
});

// The studio page is 90% wide and centred from tablet up, and full width on phones (TJ, 2026-11-06).
const pageBox = (page: Page) => page.getByRole("heading", { name: "Build a card" }).evaluate(node => { const rect = node.closest("[class*='SocialShare_page']")!.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width }; });

test("phone: no page overflow in either sort, a full-width page, and each row scrolls on its own", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/social-share");
  await expect(page.getByRole("heading", { name: "Build a card" })).toBeVisible();
  await noPageOverflow(page);
  const box = await pageBox(page);
  expect(box.width).toBeGreaterThanOrEqual(375 - 1);
  expect(Math.abs(box.left - (375 - box.right))).toBeLessThanOrEqual(1);
  for (const day of ["mon", "sun"]) { const strip = (await page.getByTestId(`landing-strip-${day}`).boundingBox())!; expect(strip.x).toBeGreaterThanOrEqual(0); expect(strip.x + strip.width).toBeLessThanOrEqual(375); }
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/social-share-landing/phone-by-category.png" });

  await page.getByRole("button", { name: "By day" }).click();
  const misc = page.getByTestId("landing-row-misc");
  await expect(misc).toBeVisible();
  await noPageOverflow(page);
  expect(await misc.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  expect(await misc.evaluate(node => { node.scrollLeft = 300; return node.scrollLeft; })).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/social-share-landing/phone-by-day.png" });
});

test("desktop: a centred 90% page, one side-scrolling row per section, no page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/social-share");
  await expect(page.getByRole("heading", { name: "Build a card" })).toBeVisible();
  const box = await pageBox(page);
  expect(box.width).toBeLessThanOrEqual(1440 * 0.9 + 1);
  expect(Math.abs(box.left - (1440 - box.right))).toBeLessThanOrEqual(1);
  const goalies = page.getByTestId("landing-row-goalies");
  expect(await goalies.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  const tops = await goalies.getByTestId("landing-tile").evaluateAll(nodes => new Set(nodes.map(node => node.getBoundingClientRect().top)).size);
  expect(tops).toBe(1);
  await noPageOverflow(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/social-share-landing/desktop-by-category.png" });
  const byDay = page.getByRole("button", { name: "By day" });
  await byDay.click();
  await expect(byDay).toHaveAttribute("aria-pressed", "true");
  await noPageOverflow(page);
  await byDay.blur();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/social-share-landing/desktop-by-day.png" });
});
