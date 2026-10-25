import { expect, test } from "@playwright/test";

for (const width of [1440, 1024, 390, 320]) {
  test(`offline home and news fixtures fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    await page.goto("/");
    const controls = page.getByRole("complementary", { name: "League separation controls" });
    const chart = page.locator('svg[aria-label="Team standings by games played"]');
    await expect(controls.getByRole("checkbox")).toHaveCount(32);
    await expect(chart.locator("g.team-group")).toHaveCount(32);
    await expect(page.getByRole("region", { name: "Practice snapshot players" })).toBeVisible();
    await expect(page.getByRole("group", { name: "PP1", exact: true })).toBeVisible();
    const teamGrids = await controls.locator('[class*="divisionTeams"]').evaluateAll((nodes) => nodes.map((node) =>
      Array.from(node.children).map((child) => {
        const box = child.getBoundingClientRect();
        return { x: Math.round(box.x), y: Math.round(box.y) };
      })));
    expect(teamGrids).toHaveLength(4);
    for (const positions of teamGrids) {
      expect(positions).toHaveLength(8);
      expect(new Set(positions.map(({ x }) => x)).size).toBe(2);
      expect(new Set(positions.map(({ y }) => y)).size).toBe(4);
      expect(positions[0].y).toBe(positions[1].y);
      expect(positions[2].y).toBeGreaterThan(positions[0].y);
      expect(positions[0].x).toBe(positions[2].x);
    }
    const mini = page.getByRole("region", { name: "Practice snapshot players" });
    await expect(mini.locator('span[class*="role"]')).toHaveCount(0);
    await expect(mini.getByRole("group", { name: "F1: Captured Left A", exact: true })).toHaveText("Captured Left A");
    const miniName = mini.getByText("Captured Left A", { exact: true });
    await expect(miniName).toHaveAttribute("title", "Captured Left A");
    const miniFontSize = parseFloat(await miniName.evaluate((node) => getComputedStyle(node).fontSize));
    const miniCellHeight = (await mini.locator('[class*="slot"]').first().boundingBox())!.height;
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const railBox = await controls.boundingBox();
    const chartBox = await chart.boundingBox();
    expect(chartBox!.width).toBeGreaterThan(250);
    const panelBox = await page.locator('[class*="leagueChartPanel"]').boundingBox();
    expect(chartBox!.y + chartBox!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height + 1);
    const axisLabelBox = await chart.getByText("Games Played", { exact: true }).boundingBox();
    expect(axisLabelBox!.y + axisLabelBox!.height).toBeLessThanOrEqual(chartBox!.y + chartBox!.height);
    if (width >= 1024) expect(railBox!.x).toBeGreaterThan(chartBox!.x + chartBox!.width);
    if (width <= 390) expect(railBox!.y).toBeGreaterThan(chartBox!.y + chartBox!.height - 1);
    await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true });

    await controls.getByRole("combobox", { name: "Conference" }).selectOption("E");
    await controls.getByRole("combobox", { name: "Division" }).selectOption("Atlantic");
    await expect(chart.locator("g.team-group")).toHaveCount(8);
    await controls.getByRole("button", { name: "Clear all" }).click();
    await expect(chart.locator("g.team-group")).toHaveCount(0);
    await controls.getByRole("button", { name: "Select all" }).click();
    await expect(chart.locator("g.team-group")).toHaveCount(8);
    await controls.getByRole("checkbox", { name: "BOS", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(chart.locator("g.team-group")).toHaveCount(7);
    await controls.getByRole("combobox", { name: "Metric" }).selectOption("pointPct");
    await expect(chart.getByText("% above .500", { exact: true })).toBeVisible();

    const viewport = page.getByRole("region", { name: "Practice snapshot players" });
    await viewport.focus();
    await expect(viewport).toBeFocused();
    await expect(viewport).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("End");
    const overflow = await viewport.evaluate((node) => ({ height: node.clientHeight, content: node.scrollHeight }));
    expect(overflow.height).toBeLessThanOrEqual(180);
    if (overflow.content > overflow.height) await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);

    await page.goto("/?full");
    await expect(page.getByRole("heading", { name: "News grid fixtures" })).toBeVisible();
    const full = page.getByRole("region", { name: "Practice snapshot players" });
    await expect(full.getByText("F1", { exact: true })).toHaveCount(3);
    const fullFontSize = parseFloat(await full.getByText("Captured Left A", { exact: true }).evaluate((node) => getComputedStyle(node).fontSize));
    expect(miniFontSize).toBeLessThanOrEqual(fullFontSize * 0.85);
    expect(miniCellHeight).toBeLessThan((await full.locator('[class*="slot"]').first().boundingBox())!.height * 0.75);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const palettes = await page.locator('article').evaluateAll((nodes) => nodes.slice(0, 3).map((node) => {
      const slot = node.querySelector('[class*="slot"]')!;
      const background = getComputedStyle(slot).backgroundColor;
      const canvas = document.createElement("canvas").getContext("2d")!;
      canvas.fillStyle = background;
      canvas.fillRect(0, 0, 1, 1);
      const rgb = Array.from(canvas.getImageData(0, 0, 1, 1).data).slice(0, 3).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      return { pigment: (node as HTMLElement).style.getPropertyValue("--lineup-team-primary"), background,
        text: getComputedStyle(slot).color, contrast: 1.05 / (luminance + 0.05) };
    }));
    expect(new Set(palettes.map((palette) => palette.pigment)).size).toBe(3);
    expect(new Set(palettes.map((palette) => palette.background)).size).toBe(3);
    expect(palettes.every((palette) => palette.text === "rgb(255, 255, 255)")).toBe(true);
    expect(palettes.every((palette) => palette.contrast >= 4.5)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`news-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
