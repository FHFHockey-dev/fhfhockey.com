import { expect, test, Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { WIGO_STAT_ORDER } from "../components/WiGO/statMetadata";

const evidenceDirectory = "../tasks/TASKS/wigo-single-viewport/evidence";
const periods = ["STD", "LY", "CA", "3YA", "L5", "L10", "L20"];

test("radar distinguishes a timeout from missing data and supports retry", async ({ page }) => {
  let attempts = 0;
  await page.route("**/rest/v1/rpc/get_skaters_avg_stats", route => {
    attempts++;
    return attempts <= 2
      ? route.fulfill({ status: 500, json: { code: "57014", message: "statement timeout" } })
      : route.fulfill({ json: [{ id: 8476453, avggoals: 1, avgassists: 1, avgplusminus: 1, avgpim: 1, avghits: 1, avgblockedshots: 1, avgpowerplaypoints: 1, avgshots: 1, numgames: 76 }] });
  });
  await page.goto("/wigoCharts?playerId=8476453");
  const radar = page.locator('[data-coverage="C15"]');
  await expect(radar).toContainText("Category percentile request timed out.");
  expect(attempts).toBe(2);
  await expect(radar).not.toContainText("unavailable for this player");
  await radar.getByRole("button", { name: "Retry category percentiles" }).click();
  await expect(radar.locator("canvas")).toBeVisible();
  expect(attempts).toBe(3);
  await expect(radar).not.toContainText("timed out");
});

test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

async function assertViewport(page: Page) {
  const measurements = await page.evaluate(() => {
    const visible = (element: Element) =>
      element.getBoundingClientRect().width > 0 &&
      element.getBoundingClientRect().height > 0;
    const root = document.querySelector('[class*="wigoDashboardContent"]')!;
    const panels = Array.from(
      root.querySelectorAll<HTMLElement>("[data-coverage]"),
    ).filter(visible);
    const outside = panels
      .filter((element) => {
        const r = element.getBoundingClientRect();
        return (
          r.x < -1 ||
          r.y < -1 ||
          r.right > innerWidth + 1 ||
          r.bottom > innerHeight + 1
        );
      })
      .map((element) => element.dataset.coverage);
    const overflowing = Array.from(root.querySelectorAll<HTMLElement>("*"))
      .filter(
        (element) =>
          visible(element) &&
          !element.closest("details:not([open])") &&
          !element.className.toString().includes("visuallyHidden") &&
          element instanceof HTMLElement &&
          getComputedStyle(element).display !== "inline" &&
          (element.scrollWidth > element.clientWidth + 1 ||
            element.scrollHeight > element.clientHeight + 1),
      )
      .map((element) => ({
        name: element.className,
        text: element.innerText?.slice(0, 50),
        client: [element.clientWidth, element.clientHeight],
        scroll: [element.scrollWidth, element.scrollHeight],
      }));
    const smallText = [
      ...Array.from(root.querySelectorAll<HTMLElement>("*")),
      ...Array.from(document.querySelectorAll<HTMLElement>("header *")),
    ]
      .filter(
        (element) =>
          visible(element) &&
          !element.closest("details:not([open])") &&
          Array.from(element.childNodes).some(
            (node) =>
              node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
          ) &&
          parseFloat(getComputedStyle(element).fontSize) < 12,
      )
      .map((element) => ({
        text: element.textContent?.slice(0, 60),
        size: getComputedStyle(element).fontSize,
      }));
    const clippedCells = Array.from(root.querySelectorAll("table th, table td"))
      .filter((cell) => {
        const bounds = cell.getBoundingClientRect();
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (!node.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const text = range.getBoundingClientRect();
          if (
            text.left < bounds.left - 1 ||
            text.right > bounds.right + 1 ||
            text.top < bounds.top - 1 ||
            text.bottom > bounds.bottom + 1
          )
            return true;
        }
        return false;
      })
      .map((cell) => cell.textContent);
    return {
      clippedCells,
      document: [
        document.documentElement.scrollWidth,
        document.documentElement.scrollHeight,
      ],
      outside,
      overflowing,
      smallText,
      coverage: panels.flatMap((element) =>
        element.dataset.coverage!.split(" "),
      ),
    };
  });
  expect(measurements.document).toEqual([1920, 1080]);
  expect(measurements.outside).toEqual([]);
  expect(measurements.overflowing).toEqual([]);
  expect(measurements.smallText).toEqual([]);
  expect(measurements.clippedCells).toEqual([]);
  for (let id = 1; id <= 19; id++)
    expect(measurements.coverage).toContain(`C${String(id).padStart(2, "0")}`);
  return measurements;
}

async function ready(page: Page) {
  await page.goto("/wigoCharts?playerId=8476453&tab=comparison");
  await expect(
    page.getByRole("combobox", { name: "Search player" }),
  ).toHaveValue("Nikita Kucherov");
  await expect(page.locator('[data-coverage="C07"]')).toContainText("Offense", {
    timeout: 60_000,
  });
  await expect(page.locator('[data-coverage="C19"] meter')).toHaveCount(16, {
    timeout: 60_000,
  });
  await expect(page.locator("#wigo-selected-stat .recharts-line")).toHaveCount(
    1,
  );
}

test("complete desktop matrix, reserved log, filters and chart controls", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      maxWidth,
    ) {
      const canvas = this.canvas as HTMLCanvasElement & {
        wigoLabels?: Record<string, string>;
      };
      (canvas.wigoLabels ??= {})[text] = this.font;
      if (maxWidth === undefined) fillText.call(this, text, x, y);
      else fillText.call(this, text, x, y, maxWidth);
    };
  });
  const errors: string[] = [];
  let teamGameRequests = 0;
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/wgo_team_stats") && url.searchParams.get("select")?.includes("pp_opportunities")) teamGameRequests++;
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydration|Warning:.*React|Each child in a list/.test(message.text()))
      errors.push(message.text());
  });
  // This verification never permits existing image-enrichment code to write remotely.
  await page.route("**/rest/v1/**", (route) =>
    ["PATCH", "PUT", "DELETE"].includes(route.request().method())
      ? route.abort()
      : route.continue(),
  );
  // The live radar RPC can time out. This explicit cohort fixture verifies
  // rendering and labels; the separate live screenshot retains real data.
  await page.route("**/rest/v1/rpc/get_skaters_avg_stats", (route) =>
    route.fulfill({
      json: [0, 1, 2].map((value) => ({
        id: value === 1 ? 8476453 : value,
        avggoals: value,
        avgassists: value,
        avgplusminus: value,
        avgpim: value,
        avghits: value,
        avgblockedshots: value,
        avgpowerplaypoints: value,
        avgshots: value,
        count: 20,
      })),
    }),
  );
  await ready(page);
  const teamDrivers = page.locator('[class*="driverGrid"]');
  await expect(teamDrivers.locator("article")).toHaveCount(4);
  await expect(page.locator('[data-coverage="C08 C09 C10 C11"]')).toContainText(/Regular season · 5v5:|Incomplete regular-season coverage/);
  const initialTeamRequests = teamGameRequests;
  expect(initialTeamRequests).toBeGreaterThan(0);
  await test.info().attach("team-driver-values", { body: await teamDrivers.innerText(), contentType: "text/plain" });
  const matrix = page.getByRole("table", { name: /Seven timeframes/ });
  await expect(matrix.getByRole("columnheader")).toHaveCount(37);
  expect(await matrix.getByRole("columnheader").allTextContents()).toEqual([
    "Period",
    ...WIGO_STAT_ORDER,
  ]);
  await expect(matrix.locator("tbody tr")).toHaveCount(8);
  await expect(matrix.locator("tbody td")).toHaveCount(288);
  expect(await matrix.getByRole("rowheader").allTextContents()).toEqual([
    "STD L",
    "LY ",
    "CA R",
    "3YA ",
    "L5 ",
    "L10 ",
    "L20 ",
    "DIFF",
  ]);
  await expect(
    matrix.getByRole("button", { name: "Show GP game log", exact: true }),
  ).toHaveCount(0);
  const before = await page.locator("#wigo-selected-stat").boundingBox();
  for (const metric of ["Goals", "ATOI", "S%", "SOG/60"]) {
    await page
      .getByRole("button", { name: `Show ${metric} game log`, exact: true })
      .click();
    await expect(page.locator("#wigo-selected-stat h3")).toContainText(metric);
    await expect(
      page.getByRole("button", {
        name: `Show ${metric} game log`,
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(await page.locator("#wigo-selected-stat").boundingBox()).toEqual(
      before,
    );
  }
  for (const period of periods) {
    const toggle = page.getByRole("button", {
      name: `Toggle ${period} reference`,
      exact: true,
    });
    const previous = await toggle.getAttribute("aria-pressed");
    await toggle.click();
    await expect(toggle).toHaveAttribute(
      "aria-pressed",
      previous === "true" ? "false" : "true",
    );
  }
  await page
    .getByLabel("Select left timeframe for comparison")
    .selectOption("L10");
  await page
    .getByLabel("Select right timeframe for comparison")
    .selectOption("L10");
  await expect(matrix.locator("tr[data-left][data-right] th")).toHaveText(
    "L10 LR",
  );
  await page
    .getByLabel("Select left timeframe for comparison")
    .selectOption("STD");
  await page
    .getByLabel("Select right timeframe for comparison")
    .selectOption("CA");
  const toi = page.locator('[data-coverage="C16"]');
  await toi.getByRole("button", { name: "PP TOI %", exact: true }).click();
  await expect(toi).toContainText("Power Play TOI %");
  await toi.getByRole("button", { name: "TOI", exact: true }).click();
  for (const id of ["C16", "C17", "C18"]) {
    const panel = page.locator(`[data-coverage="${id}"]`);
    const canvas = panel.locator("canvas");
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1100);
    const originalPlot = await canvas.evaluate((element) =>
      (element as HTMLCanvasElement).toDataURL(),
    );
    const bounds = (await canvas.boundingBox())!;
    await page.mouse.move(bounds.x + 100, bounds.y + 30);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 300, bounds.y + 40, { steps: 8 });
    await page.mouse.up();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1100);
    const zoomedPlot = await canvas.evaluate((element) =>
      (element as HTMLCanvasElement).toDataURL(),
    );
    expect(zoomedPlot).not.toBe(originalPlot);
    await page.keyboard.down("Shift");
    await page.mouse.move(bounds.x + 250, bounds.y + 45);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 180, bounds.y + 45, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1100);
    expect(
      await canvas.evaluate((element) =>
        (element as HTMLCanvasElement).toDataURL(),
      ),
    ).not.toBe(zoomedPlot);
    await panel.getByRole("button", { name: "Reset", exact: true }).click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1100);
    expect(
      await canvas.evaluate((element) =>
        (element as HTMLCanvasElement).toDataURL(),
      ),
    ).toBe(originalPlot);
  }
  const rates = page.locator('[data-coverage="C19"]');
  for (const strength of ["ES", "PP", "PK", "AS"]) {
    await rates.getByRole("button", { name: strength, exact: true }).click();
    await expect(
      rates.getByRole("button", { name: strength, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(rates.locator("meter")).toHaveCount(16, { timeout: 60_000 });
  }
  await page.getByLabel("Min GP:").fill("15");
  await expect(rates).toContainText("Min GP:15");
  await page.getByLabel("Min GP:").fill("10");
  await page.mouse.move(0, 0);
  const radarLabels = await page
    .locator('[data-coverage="C15"] canvas')
    .evaluate(
      (element) =>
        (element as HTMLCanvasElement & { wigoLabels: Record<string, string> })
          .wigoLabels,
    );
  for (const label of [
    "GOALS",
    "ASSISTS",
    "PPP",
    "SOG",
    "+/−",
    "PIM",
    "BLK",
    "HITS",
    "100",
  ])
    expect(radarLabels).toHaveProperty(label);
  const smallCanvasLabels = await page
    .locator('[class*="wigoDashboardContent"] canvas')
    .evaluateAll((elements) =>
      elements.flatMap((element) =>
        Object.entries(
          (
            element as HTMLCanvasElement & {
              wigoLabels?: Record<string, string>;
            }
          ).wigoLabels ?? {},
        ).filter(([, font]) => Number(font.match(/([\d.]+)px/)?.[1]) < 12),
      ),
    );
  expect(smallCanvasLabels).toEqual([]);
  const measurements = await assertViewport(page);
  await page.screenshot({
    path: `${evidenceDirectory}/desktop-radar-fixture-1920x1080.png`,
    fullPage: false,
  });
  await test.info().attach("viewport-measurements", {
    body: JSON.stringify(measurements, null, 2),
    contentType: "application/json",
  });
  await writeFile(`${evidenceDirectory}/viewport-measurements.json`, JSON.stringify(measurements, null, 2));
  await page
    .locator("#wigo-selected-stat .recharts-wrapper")
    .hover({ position: { x: 350, y: 100 } });
  await expect(page.locator("#wigo-selected-stat")).toContainText(
    /Game \d+ \(/,
  );
  await page.mouse.move(0, 0);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Search player" }),
  ).toBeFocused();
  await expect(page).not.toHaveURL(/playerId=/);
  await assertViewport(page);
  const search = page.getByRole("combobox", { name: "Search player" });
  await search.fill("Connor McDavid");
  await expect(page.getByRole("option").first()).toContainText(
    "Connor McDavid",
  );
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(search).toHaveValue("Connor McDavid");
  await expect(search).toBeFocused();
  await expect(page).toHaveURL(/playerId=8478402/);
  await expect(page.locator('[data-coverage="C02 C03"]')).toContainText(
    "MCDAVID",
    { ignoreCase: true },
  );
  await expect(teamDrivers.locator("article")).toHaveCount(4);
  expect(teamGameRequests).toBe(initialTeamRequests);
});

test("long identity, missing image and radar, seven-point bucket and empty stat log fit", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.route("**/rest/v1/players?*", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    if (!Array.isArray(data) && data?.id === 8476453) {
      await route.fulfill({
        response,
        json: {
          ...data,
          firstName: "Jean-Christophe",
          lastName: "Beauvillier-Johnson",
          fullName: "Jean-Christophe Beauvillier-Johnson",
          image_url: null,
          birthDate: null,
          heightInCentimeters: null,
          weightInKilograms: null,
        },
      });
    } else await route.fulfill({ response });
  });
  await page.route("https://api-web.nhle.com/v1/player/*/landing", (route) =>
    route.fulfill({ json: {} }),
  );
  await page.route("**/rest/v1/rpc/get_skaters_avg_stats", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/rest/v1/nst_gamelog_as_rates?*", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/rest/v1/wgo_skater_stats?*", (route) => {
    const select = new URL(route.request().url()).searchParams
      .get("select")
      ?.replace(/\s/g, "");
    if (select === "game_id,date,points,shots,hits,blocked_shots") {
      return route.fulfill({
        json: Array.from({ length: 8 }, (_, points) => ({
          game_id: 2025020001 + points,
          date: `2026-01-${String(points + 1).padStart(2, "0")}`,
          points,
          shots: points,
          hits: 0,
          blocked_shots: 0,
        })),
      });
    }
    return route.continue();
  });
  await page.goto("/wigoCharts?playerId=8476453");
  await expect(
    page.getByRole("combobox", { name: "Search player" }),
  ).toHaveValue("Jean-Christophe Beauvillier-Johnson");
  await expect(page.locator('[data-coverage="C14"]')).toContainText("7 Pts:");
  await expect(page.locator('[data-coverage="C14"]')).toContainText("8 GP");
  await expect(page.locator('[data-coverage="C15"]')).toContainText(
    "unavailable",
  );
  await expect(page.locator("#wigo-selected-stat")).toContainText(
    "No game log data",
  );
  await expect(
    page.getByRole("button", { name: /^Toggle .* reference$/ }),
  ).toHaveCount(7);
  await expect(page.locator('[data-coverage="C19"] meter')).toHaveCount(16, {
    timeout: 60_000,
  });
  await assertViewport(page);
  await page.screenshot({
    path: `${evidenceDirectory}/edge-states-1920x1080.png`,
    fullPage: false,
  });
});

test("existing narrower-screen access and URL tabs remain available", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await ready(page);
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await expect(
      page.getByRole("combobox", { name: "Search player" }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("combobox", { name: "Search player" }),
    ).toBeVisible();
    if (size.width === 390) {
      await expect(
        page.getByRole("button", { name: "Comparison", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await expect(page).toHaveURL(/tab=overview/);
      await page
        .getByRole("button", { name: "Comparison", exact: true })
        .click();
      await expect(page).toHaveURL(/tab=comparison/);
      const comparison = page.locator('table').filter({ has: page.getByRole("columnheader", { name: "STD", exact: true }) });
      await expect(comparison).toBeVisible();
      for (const period of [...periods, "DIFF"]) {
        await expect(comparison.getByRole("columnheader", { name: period, exact: true })).toBeVisible();
      }
    }
    await page.screenshot({
      path: `${evidenceDirectory}/narrow-${size.width}x${size.height}.png`,
      fullPage: false,
    });
  }
});

test("source failure and missing history remain explicit within their reserved regions", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.route("**/rest/v1/wgo_skater_stats?*", (route) => {
    const select = new URL(route.request().url()).searchParams
      .get("select")
      ?.replace(/\s/g, "");
    return select === "game_id,date,points,shots,hits,blocked_shots"
      ? route.fulfill({
          json: [
            {
              game_id: 2025020001,
              date: "2026-01-01",
              points: null,
              shots: 0,
              hits: 0,
              blocked_shots: 0,
            },
          ],
        })
      : route.continue();
  });
  await page.route("**/rest/v1/nst_gamelog_as_rates?*", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Test source unavailable" },
    }),
  );
  for (const table of ["wigo_career", "wigo_rates"]) {
    await page.route(`**/rest/v1/${table}?*`, async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      for (const row of Array.isArray(data) ? data : data ? [data] : [])
        for (const key of Object.keys(row))
          if (/^(ly|ca|ya3|3ya)_/.test(key)) row[key] = null;
      await route.fulfill({ response, json: data });
    });
  }
  await page.goto("/wigoCharts?playerId=8476453");
  await expect(page.locator("#wigo-selected-stat")).toContainText(
    "Failed to load game log for SOG/60.",
    { timeout: 60_000 },
  );
  const matrix = page.getByRole("table", { name: /Seven timeframes/ });
  await expect(page.locator('[data-coverage="C14"]')).toContainText(
    "Consistency unavailable: incomplete game data.",
  );
  await expect(matrix.locator("tbody tr").nth(1).locator("td")).toHaveText(
    Array(36).fill("-"),
  );
  await expect(
    page.getByRole("button", { name: /^Toggle .* reference$/ }),
  ).toHaveCount(7);
  await expect(page.locator('[data-coverage="C19"] meter')).toHaveCount(16, {
    timeout: 60_000,
  });
  await assertViewport(page);
});
