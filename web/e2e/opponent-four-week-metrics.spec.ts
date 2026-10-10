import { expect, test, type Locator } from "@playwright/test";
import { abbreviations } from "./fixtures/opponent-four-week-metrics/data";

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
    expect(await palette(fourWeek.locator(`td[data-favorability="${band}"]`).first())).toEqual(await palette(omt.locator(`tr:has(img[alt="${abbreviations[id - 1]}"]) td:nth-child(2)`)));
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
  await expect(fourWeek.getByText(/Lower OPP% is favorable/)).toBeHidden();
  await fourWeek.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(fourWeek.getByText(/Lower OPP% is favorable/)).toBeVisible();
  await page.keyboard.press("Space");
  await expect(fourWeek.getByText(/Lower OPP% is favorable/)).toBeHidden();
  const logoGeometry = async () => master.locator("tbody td img").evaluateAll((images) => images.map((image) => {
    const logo = image as HTMLImageElement;
    const imageRect = logo.getBoundingClientRect();
    const cellRect = logo.closest("td")!.getBoundingClientRect();
    return { src: logo.getAttribute("src"), loaded: logo.complete && logo.naturalWidth > 0,
      width: imageRect.width, height: imageRect.height,
      dx: imageRect.x + imageRect.width / 2 - cellRect.x - cellRect.width / 2,
      dy: imageRect.y + imageRect.height / 2 - cellRect.y - cellRect.height / 2 };
  }));
  const initialGeometry = await logoGeometry();
  expect(initialGeometry).toHaveLength(32);
  for (const logo of initialGeometry) {
    expect(logo.loaded).toBe(true);
    expect(logo.src).toMatch(/^\/teamLogos\/[A-Z]{3}\.png$/);
    expect(logo.width).toBe(34); expect(logo.height).toBe(34);
    expect(Math.abs(logo.dx)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(logo.dy)).toBeLessThanOrEqual(0.6);
  }
  const standaloneImages = await page.locator('.panels tbody img').evaluateAll((images) => images.map((image) => ({ loaded: (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0, width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height, ratio: (image as HTMLImageElement).naturalHeight / (image as HTMLImageElement).naturalWidth })));
  expect(standaloneImages).toHaveLength(64);
  for (const logo of standaloneImages) { expect(logo.loaded).toBe(true); expect(logo.width).toBe(24); expect(logo.height).toBeCloseTo(24 * logo.ratio, 1); }
  const scroll = master.locator('table:has(tbody)').locator('..');
  await scroll.evaluate((node) => { node.scrollLeft = node.scrollWidth - node.clientWidth; });
  await page.evaluate(() => window.scrollTo(0, 400));
  for (const logo of await logoGeometry()) {
    expect(Math.abs(logo.dx)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(logo.dy)).toBeLessThanOrEqual(0.6);
  }
  if (width === 1920) await expect(master.locator("table")).toHaveCount(2);
  await master.screenshot({ path: testInfo.outputPath(`master-${width}-scrolled.png`) });
  await testInfo.attach("logo-geometry", { body: JSON.stringify(initialGeometry, null, 2), contentType: "application/json" });
  await scroll.evaluate((node) => { node.scrollLeft = 0; });
  await page.evaluate(() => window.scrollTo(0, 0));
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

for (const width of [1920, 390]) test(`native Info disclosure and truthful data states at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1080 });
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.goto("/");
  const master = page.getByRole("region", { name: "Combined Game Grid" });
  const omt = page.getByRole("region", { name: "Standalone OMT" });
  const fourWeek = page.getByRole("region", { name: "Standalone 4WG" });
  for (const [panel, label] of [[master, "Game Grid metrics"], [omt, "opponent metrics"], [fourWeek, "four-week forecast"]] as const) {
    await expect(panel.locator("details")).not.toHaveAttribute("open", "");
    await expect(panel.locator("summary")).toHaveAccessibleName(`Info about ${label}`);
    expect(await panel.locator("p").evaluateAll((paragraphs) => paragraphs.every((p) => p.closest("details")))).toBe(true);
    await expect(panel.getByRole("status")).not.toBeEmpty();
    await panel.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(panel.locator("details")).toHaveAttribute("open", "");
    const ring = await panel.locator("summary").evaluate((node) => ({ width: getComputedStyle(node).outlineWidth, style: getComputedStyle(node).outlineStyle, height: node.getBoundingClientRect().height }));
    expect(ring.width).toBe("2px"); expect(ring.style).toBe("solid"); expect(ring.height).toBeGreaterThanOrEqual(44);
    if (panel === fourWeek) await expect(panel.getByText(/Lower OPP% is favorable/)).toBeVisible();
    else await expect(panel.getByText(/Snapshot freshness unknown/)).toBeVisible();
    await panel.screenshot({ path: testInfo.outputPath(`${label.replaceAll(" ", "-")}-${width}-info-open.png`) });
    await page.keyboard.press("Space");
    await expect(panel.locator("details")).not.toHaveAttribute("open", "");
  }
  await page.getByRole("combobox", { name: "Data state" }).selectOption("complete");
  await expect(page.locator('[role="status"]:not(:empty)')).toHaveCount(0);
  await expect(master.getByText(/Snapshot freshness unknown/)).toBeHidden();
  await expect(omt.getByText(/Snapshot freshness unknown/)).toBeHidden();
  await page.getByRole("button", { name: "Toggle snapshot provenance" }).click();
  await master.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(master.getByText(/Database snapshot updated 2026-10-10 01:30:08 UTC/)).toBeVisible();
  await expect(master.getByText(/Source observation freshness unknown/)).toBeVisible();
  await expect(master.getByText(/Schedule complete/)).toBeVisible();
  await master.screenshot({ path: testInfo.outputPath(`master-${width}-known-import-info.png`) });
  await page.keyboard.press("Space");
  await page.getByRole("combobox", { name: "Data state" }).selectOption("failed");
  await expect(master.getByRole("status")).toHaveText("Opponent stats unavailable. Reload to retry. Schedule unavailable. Reload to retry.");
  await expect(omt.getByRole("alert")).toHaveText("Opponent stats could not load. Reload to retry.");
  await expect(fourWeek.getByRole("status")).toHaveText("Schedule unavailable. Reload to retry.");
  await expect(page.getByText("Synthetic provider failure")).toHaveCount(0);
  await expect(master.locator('tbody td[data-favorability]')).toHaveCount(0);
  await master.screenshot({ path: testInfo.outputPath(`master-${width}-failed-data.png`) });
});
