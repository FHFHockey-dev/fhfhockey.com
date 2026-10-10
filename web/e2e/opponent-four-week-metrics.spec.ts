import { expect, test, type Locator } from "@playwright/test";

async function colors(cells: Locator) {
  return cells.evaluateAll((nodes) => nodes.map((node) => ({
    band: node.getAttribute("data-favorability"), color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor,
  })));
}
for (const width of [1920, 390]) test(`production palette, compact rows, ties and missing values at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1080 });
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.goto("/");
  const master = page.getByRole("region", { name: "Combined Game Grid" });
  const omt = page.getByRole("region", { name: "Standalone OMT" });
  const fourWeek = page.getByRole("region", { name: "Standalone 4WG" });
  await expect(master.locator("tbody tr")).toHaveCount(33);
  await expect(page.locator("tbody small")).toHaveCount(0);
  const row = (id: number) => master.locator(`tbody tr:has(#game-grid-master-trigger-${id})`);
  const cells = (id: number) => row(id).locator("td:nth-last-child(-n+4)");
  const high = await colors(cells(1));
  expect(high.map(({ band }) => band)).toEqual(["high", "high", "high", "high"]);
  expect(await colors(cells(2))).toEqual(high);
  expect((await colors(cells(32))).every(({ band }) => band === null)).toBe(true);
  expect(await cells(32).allTextContents()).toEqual(["-", "-", "-", "-"]);
  for (const [band, id] of [["high", 1], ["middle", 6], ["low", 31]] as const) {
    const palette = (cell: Locator) => cell.evaluate((node) => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor }));
    expect(await palette(master.locator(`td[data-favorability="${band}"]`).first())).toEqual(await palette(row(id).locator("td").first()));
    expect(await palette(fourWeek.locator(`td[data-favorability="${band}"]`).first())).toEqual(await palette(omt.locator(`tr:has(img[alt="F${id}"]) td:nth-child(2)`)));
  }
  const averageWidths = await master.locator('tbody tr:first-child td:nth-last-child(-n+4)').evaluateAll((cells) => cells.map((cell) => ({ scroll: cell.scrollWidth, client: cell.clientWidth })));
  for (const cell of averageWidths) expect(cell.scroll).toBeLessThanOrEqual(cell.client);
  const dimensions = await master.locator("tbody tr:not(:first-child)").evaluateAll((rows) => rows.map((row) => Array.from(row.children).map((cell) => ({ top: cell.getBoundingClientRect().top, height: cell.getBoundingClientRect().height }))));
  for (const rowCells of dimensions) {
    expect(new Set(rowCells.map(({ top }) => top)).size).toBe(1);
    expect(new Set(rowCells.map(({ height }) => height)).size).toBe(1);
    expect(rowCells[0].height).toBeLessThanOrEqual(50);
  }
  const controls = await master.locator('tbody button[aria-expanded]').evaluateAll((buttons) => buttons.map((button) => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
  for (const button of controls) { expect(button.width).toBeGreaterThanOrEqual(44); expect(button.height).toBeGreaterThanOrEqual(44); }
  expect(await master.locator('tbody tr:first-child').evaluate((row) => row.getBoundingClientRect().height)).toBeLessThanOrEqual(44);
  const standaloneHeights = await page.locator('.panels tbody tr:not(:first-child)').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
  expect(Math.max(...standaloneHeights)).toBeLessThanOrEqual(30);
  expect(new Set(standaloneHeights).size).toBe(1);
  await expect(fourWeek.getByText(/Lower OPP% is favorable/)).toBeVisible();
  await master.getByRole("button", { name: "Sort by 4WK Score descending" }).first().click();
  await master.getByRole("button", { name: "Sort by 4WK Score ascending" }).first().click();
  expect(await colors(cells(1))).toEqual(high);
  await master.screenshot({ path: testInfo.outputPath(`master-${width}-sorted.png`) });
  await fourWeek.screenshot({ path: testInfo.outputPath(`four-week-${width}.png`) });
  await omt.screenshot({ path: testInfo.outputPath(`opponent-${width}.png`) });
  await page.getByRole("button", { name: "Toggle equal values" }).click();
  const allEqual = await master.locator("td[data-favorability]").evaluateAll((cells) => cells.map((cell) => cell.getAttribute("data-favorability")));
  expect(allEqual.every((band) => band === "middle")).toBe(true);
  await master.screenshot({ path: testInfo.outputPath(`master-${width}-all-equal.png`) });
  await expect(page.locator("tbody small")).toHaveCount(0);
  await fourWeek.getByRole("tab", { name: "Weekly Detail" }).click();
  await expect(fourWeek.getByText("Schedule unavailable", { exact: true })).toBeVisible();
  await expect(fourWeek.getByText("Schedule partial", { exact: true })).toBeVisible();
  await expect(fourWeek.getByText(/\d+\s*\/\s*\d+\s+days/)).toHaveCount(0);
  await fourWeek.screenshot({ path: testInfo.outputPath(`four-week-${width}-weekly-detail.png`) });
});
