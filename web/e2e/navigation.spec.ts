import { expect, test } from "@playwright/test";

// Exercise the shared shell without page-specific hockey data dependencies.
test.beforeEach(async ({ page }) => {
  await page.goto("/404");
});

test("desktop standalone links, dropdowns and keyboard dismissal", async ({
  page,
}) => {
  for (const width of [1440, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    const nav = page.getByRole("navigation", {
      name: "Primary navigation",
      exact: true,
    });
    for (const name of ["Game Grid", "Blog", "Underlying Stats"]) {
      const link = nav.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const nav = page.getByRole("navigation", {
    name: "Primary navigation",
    exact: true,
  });
  const tools = nav.getByRole("button", { name: "Tools", exact: true });
  await tools.click();
  await expect(tools).toHaveAttribute("aria-expanded", "true");
  await nav.getByRole("link", { name: /Start Chart/ }).focus();
  await page.keyboard.press("Escape");
  await expect(tools).toHaveAttribute("aria-expanded", "false");
  await expect(tools).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tools).toHaveAttribute("aria-expanded", "true");
  await page.locator("footer").click({ position: { x: 5, y: 5 } });
  await expect(tools).toHaveAttribute("aria-expanded", "false");
  await page
    .getByRole("button", { name: "Search players", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Player search" }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search players" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Search players", exact: true }),
  ).toBeFocused();
});

test("mobile modal has one scroll area, all destinations and focus restoration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole("button", { name: "Open menu", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Site menu" });
  await expect(
    dialog.getByRole("button", { name: "Close menu" }),
  ).toBeFocused();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  for (const group of ["Analytics", "Tools", "Community"]) {
    const button = dialog.getByRole("button", {
      name: new RegExp(`^${group}`),
    });
    if ((await button.getAttribute("aria-expanded")) !== "true")
      await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
  }
  await expect(
    dialog.getByRole("link", { name: "Blog", exact: true }),
  ).toBeVisible();
  expect(
    await dialog
      .locator('nav[aria-label="All destinations"] a[href^="/"]')
      .count(),
  ).toBe(18);
  expect(
    await dialog.evaluate(
      (element) =>
        Array.from(element.querySelectorAll("*")).filter((node) =>
          ["auto", "scroll"].includes(getComputedStyle(node).overflowY),
        ).length,
    ),
  ).toBe(1);
  await dialog.getByRole("link", { name: "Support FHFH" }).focus();
  await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await page
    .getByRole("navigation", { name: "Primary mobile navigation" })
    .getByRole("button", { name: "Tools" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Tools", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    dialog.getByRole("link", { name: "Draft Dashboard", exact: true }),
  ).toBeVisible();
});

test("search ignores stale responses and recovers from errors", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let fail = false;
  await page.route("**/rest/v1/players?**", async (route) => {
    const old = route.request().url().includes("Old");
    if (old) await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({
      status: fail ? 500 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        fail
          ? { message: "Unavailable" }
          : [
              {
                id: 1,
                fullName: old ? "Old Result" : "Connor Test",
                image_url: null,
              },
            ],
      ),
    });
  });
  await page
    .getByRole("button", { name: "Search players", exact: true })
    .click();
  const input = page.getByRole("searchbox", { name: "Search players" });
  const requested = page.waitForRequest(
    (request) =>
      request.url().includes("/rest/v1/players") &&
      request.url().includes("Old"),
  );
  await input.fill("Old");
  await requested;
  await input.fill("Connor");
  await expect(page.getByRole("link", { name: /Connor Test/ })).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page.getByRole("link", { name: /Old Result/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear player search" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Enter at least two characters",
  );
  fail = true;
  await input.fill("Error");
  await expect(page.getByRole("status")).toContainText("Unable to search");
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("link", { name: /Connor Test/ })).toBeVisible();
});

test("bottom bar follows scroll direction and clears normal-flow footer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Supply a long content area independently of remote page data.
  await page.locator("footer").evaluate((footer) => {
    const content = document.createElement("div");
    content.style.height = "1800px";
    content.textContent = "Long content";
    footer.before(content);
  });
  const bar = page.getByRole("navigation", {
    name: "Primary mobile navigation",
  });
  await expect(bar).toBeVisible();
  await page.evaluate(() => scrollTo(0, 700));
  await expect(bar).not.toBeVisible();
  await page.evaluate(() => scrollTo(0, 600));
  await expect(bar).toBeVisible();
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(bar).not.toBeVisible();
  await page.evaluate(() => scrollBy(0, -10));
  await expect(bar).toBeVisible();
  await expect(page.locator("footer")).toHaveCSS("position", "static");
  const footerBox = await page.locator("footer").boundingBox();
  const barBox = await bar.boundingBox();
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(barBox!.y);
});

test("menu reflows at 320px and in short landscape", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Site menu" });
    await dialog.getByRole("button", { name: /^Tools/ }).click();
    const optimizer = dialog.getByRole("link", {
      name: "Roster Schedule Optimizer",
    });
    await optimizer.scrollIntoViewIfNeeded();
    await expect(optimizer).toBeVisible();
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    const box = await optimizer.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    await page.keyboard.press("Escape");
  }
});
