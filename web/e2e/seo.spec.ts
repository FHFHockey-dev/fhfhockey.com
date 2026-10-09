import { expect, test } from "@playwright/test";
import { load } from "cheerio";

test.beforeEach(async ({ page }) => {
  // Next dev reloads 404 pages when unrelated on-demand routes compile. Keep
  // recovery interactions stable while other chats use the same dev server.
  await page.routeWebSocket("**/_next/webpack-hmr", () => {});
});

test("missing pages retain HTTP 404 and provide responsive recovery and player search", async ({ page }) => {
  await page.route("**/rest/v1/players?**", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify([{ id: 8478402, fullName: "Connor McDavid", image_url: null }]),
  }));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto("/this-page-does-not-exist-seo-check");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    const recovery = page.getByRole("navigation", { name: "Page recovery" });
    for (const name of ["Game Grid", "Underlying Stats", "Blog"]) {
      await expect(recovery.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const trigger = page.getByRole("button", { name: "Find a player", exact: true });
    await trigger.click();
    const search = page.getByRole("searchbox", { name: "Search players" });
    await expect(search).toBeFocused();
    await search.fill("Connor");
    await expect(page.getByRole("link", { name: /Connor McDavid/ })).toHaveAttribute("href", "/stats/player/8478402");
    await page.getByRole("dialog", { name: "Player search" }).getByRole("button", { name: "Close menu" }).click();
    await expect(trigger).toBeFocused();
    await page.screenshot({ path: `/tmp/fhfh-seo-404-${width}.png`, fullPage: true });
  }
});

test("privacy draft is linked in the footer, clearly unfinished and noindex", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/404");
  await page.getByRole("navigation", { name: "Footer navigation" }).getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  await expect(page.getByText("Five Hole Fantasy Hockey · Draft for review")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/fhfh-seo-privacy-mobile.png", fullPage: true });
});

test("server-rendered tool metadata uses absolute canonicals without query variants", async ({ request }) => {
  const response = await request.get("/game-grid/7-Day-Forecast?utm_source=seo-check");
  expect(response.status()).toBe(200);
  const $ = load(await response.text());
  expect($("title").text()).toBe("NHL Schedule & Fantasy Hockey Game Grid | FHFH");
  expect($('meta[name="description"]').attr("content")).toContain("off-night games");
  expect($('meta[name="robots"]').attr("content")).toBe("index,follow");
  const canonical = $('link[rel="canonical"]').attr("href")!;
  expect(new URL(canonical).pathname).toBe("/game-grid/7-Day-Forecast");
  expect(new URL(canonical).search).toBe("");
  expect($('meta[property="og:url"]').attr("content")).toBe(canonical);
  expect($('meta[property="og:image"]').attr("content")).toMatch(/^https?:\/\//);
  expect($('link[rel="canonical"]')).toHaveLength(1);
});

test("invalid dynamic routes return 404 and auth pages are not indexable", async ({ request }) => {
  for (const path of ["/stats/player/not-a-player", "/game-grid/not-a-mode"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    const $ = load(await response.text());
    expect($('meta[name="robots"]').attr("content")).toBe("noindex,follow");
    expect($('link[rel="canonical"]')).toHaveLength(0);
  }
  const response = await request.get("/auth");
  expect(response.status()).toBe(200);
  const $ = load(await response.text());
  expect($('meta[name="robots"]').attr("content")).toBe("noindex,follow");
  expect($('link[rel="canonical"]')).toHaveLength(0);
});
