import { expect, test, type Page } from "@playwright/test";
import { installDraftProAuthenticatedFixtures, installDraftProFreeFixtures } from "./draft-pro-fixtures";

async function setup(page: Page, count: number, paid = true) {
  let enabled = paid;
  if (paid) await installDraftProAuthenticatedFixtures(page, () => ({ access: {
    eligible: enabled, grantingSources: enabled ? ["purchase"] : [], expiresAt: "2027-07-01T04:00:00Z", verifiedAt: null,
    nextVerificationAt: null, reason: enabled ? "eligible" : "expired", capabilities: enabled ? ["god_view"] : [], providerReadiness: { stripe: true, patreon: false, yahoo: false },
  } }));
  else await installDraftProFreeFixtures(page);
  await page.addInitScript((teamCount) => {
    const session = localStorage.getItem("sb-127-auth-token");
    if (session) localStorage.setItem("sb-fyhftlxokyjtpndbkfse-auth-token", session);
    sessionStorage.setItem("draft.snapshot.v2", JSON.stringify({ v: 2, configured: true, currentPick: 1, draftedPlayers: [], customTeamNames: { "Team 12": "The Incredibly Long Hockey Team Name That Still Needs To Fit" }, draftSettings: {
      teamCount, draftOrder: Array.from({ length: teamCount }, (_, i) => `Team ${i + 1}`), draftOrderMode: "snake",
      rosterConfig: { C: 2, LW: 2, RW: 2, D: 4, G: 2, utility: 1, bench: 4 },
    } }));
  }, count);
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/draft-dashboard");
  await page.getByRole("button", { name: /God View · Pro/ }).click();
  return () => { enabled = false; };
}

test("God View lays out 12 picks, preserves suggestions and selects a roster", async ({ page }) => {
  await page.setViewportSize({ width: 2000, height: 1100 });
  await setup(page, 12);
  const region = page.getByRole("region", { name: "God View", exact: true });
  const cards = region.getByRole("button", { name: /^View .* roster, pick/ });
  await expect.poll(() => page.evaluate(() => {
    const dashboard = document.querySelector('main[data-god-view-open]')!;
    return dashboard.scrollHeight - dashboard.clientHeight;
  })).toBeLessThanOrEqual(1);

  await expect(cards).toHaveCount(12);
  for (const [width, expectedRows] of [[1920, 1], [1919, 2], [1024, 2]]) {
    await page.setViewportSize({ width, height: 1100 });
    await expect.poll(async () => new Set((await cards.all()).length ? await cards.evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().top))) : []).size).toBe(expectedRows);
    const view = region.getByLabel("Upcoming pick cards", { exact: true });
    expect(await view.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    expect(await cards.evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth))).toBe(true);
    expect((await page.locator("#mobile-draft-panel-suggested").boundingBox())!.height).toBeGreaterThanOrEqual(210);
  }
  await cards.nth(1).click();
  await expect(page.locator("#mobile-draft-panel-roster select").first()).toHaveValue("Team 2");
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftedPlayers.length)).toBe(0);
  const graph = region.getByRole("button", { name: "Expand draft graph" });
  await graph.click();
  await expect(page.getByRole("dialog", { name: /draft graph/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(graph).toBeFocused();
  await page.setViewportSize({ width: 1920, height: 1100 });
  await expect(page.locator("#mobile-draft-panel-players tbody tr").first()).toBeVisible();
  await page.screenshot({ path: "/tmp/god-view-desktop.png", fullPage: true });
  await region.getByRole("button", { name: /God View · Pro/ }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  const suggested = page.locator("#mobile-draft-panel-suggested");
  await expect(suggested.locator('[class*="header"] [class*="tagsRow"]').first()).toBeVisible();
  await expect(suggested.locator('[class*="reason"]')).toHaveCount(0);
  const firstCard = suggested.getByRole("listitem").first();
  expect(await firstCard.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  await expect(firstCard.getByRole("button", { name: /^Draft / })).toBeInViewport();
  await suggested.getByRole("button", { name: "Advanced", exact: true }).click();
  await expect(suggested.getByLabel("DUST lineup mode")).toBeVisible();
  await suggested.getByRole("button", { name: "Advanced", exact: true }).click();
  await page.screenshot({ path: "/tmp/compact-suggested.png", fullPage: true });
});

test("13 picks paginate and mobile remains scrollable", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await setup(page, 13);
  const region = page.getByRole("region", { name: "God View", exact: true });
  await expect(region.getByText("1–12 of 13 picks")).toBeVisible();
  await region.getByRole("button", { name: "Next", exact: true }).click();
  await expect(region.getByText("13–13 of 13 picks")).toBeVisible();
  await region.getByRole("button", { name: "Previous", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(region.getByText("13 upcoming picks · swipe or use arrow keys to scroll")).toBeVisible();
  const view = region.getByLabel("Upcoming pick cards", { exact: true });
  const touch = await page.context().newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const box = (await view.boundingBox())!;
  await touch.send("Input.synthesizeScrollGesture", { x: box.x + box.width / 2, y: box.y + 40, xDistance: -150, yDistance: 0, gestureSourceType: "touch" });
  await expect.poll(() => view.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await touch.detach();
  await view.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => view.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await region.getByRole("button", { name: /^View Team 2 roster/ }).click();
  await expect(page.locator("#mobile-draft-panel-roster")).toBeVisible();
  await expect(page.locator("#mobile-draft-panel-roster select").first()).toHaveValue("Team 2");
  await page.screenshot({ path: "/tmp/god-view-mobile.png", fullPage: true });
});

test("free open preference stays locked across reload and drafting remains usable", async ({ page }) => {
  await setup(page, 2, false);
  const region = page.getByRole("region", { name: "God View", exact: true });
  await expect(region.getByRole("link", { name: "Explore Draft Pro" })).toHaveAttribute("href", "/account?section=draft-pro");
  await expect(region.getByRole("button", { name: /^View .* roster, pick/ })).toHaveCount(0);
  await page.reload();
  await expect(region.getByRole("button", { name: /God View · Pro/ })).toHaveAttribute("aria-expanded", "true");
  await page.locator("#mobile-draft-panel-players tbody tr").first().getByRole("button", { name: "Draft", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftedPlayers.length)).toBe(1);
});


test("queue returns to the clock after a pick and entitlement loss removes cards", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const expire = await setup(page, 13);
  const region = page.getByRole("region", { name: "God View", exact: true });
  await region.getByRole("button", { name: "Next", exact: true }).click();
  await expect(region.getByText("13–13 of 13 picks")).toBeVisible();
  await page.locator("#mobile-draft-panel-players tbody tr").first().getByRole("button", { name: "Draft", exact: true }).click();
  await expect(region.getByText("1–12 of 13 picks")).toBeVisible();
  await expect(region.getByRole("button", { name: /^View Team 2 roster, pick 2, on the clock/ })).toBeVisible();
  expect(await region.getByLabel("Upcoming pick cards", { exact: true }).evaluate(el => el.scrollLeft)).toBe(0);
  expire();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(region.getByRole("link", { name: "Explore Draft Pro" })).toBeVisible();
  await expect(region.getByRole("button", { name: /^View .* roster, pick/ })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}").draftedPlayers.length)).toBe(1);
});

test("200 percent zoom reflows cards and supports reduced-motion keyboard scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page, 12);
  // CSS page zoom exercises layout at 200%, including container breakpoints.
  await page.evaluate(() => { document.body.style.zoom = "2"; });
  const region = page.getByRole("region", { name: "God View", exact: true });
  await expect(region.getByText("12 upcoming picks · swipe or use arrow keys to scroll")).toBeVisible();
  const view = region.getByLabel("Upcoming pick cards", { exact: true });
  await view.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => view.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await expect(view).toBeFocused();
  await page.screenshot({ path: "/tmp/god-view-zoom.png", fullPage: true });
});
