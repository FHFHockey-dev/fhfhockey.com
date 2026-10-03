import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test.describe("/rankings", () => {
  test("loads the historical fantasy snapshot and comparison without a history-scan timeout", async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    const requestFailures: Array<{ path: string; error: string | undefined }> = [];
    const rankingRequests: URL[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/v1/contextual-rankings") && !url.pathname.endsWith("/metadata")) rankingRequests.push(url);
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith("/api/v1/contextual-rankings")) requestFailures.push({ path, error: request.failure()?.errorText });
    });
    const matrixResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/v1/contextual-rankings/matrix" &&
        url.searchParams.get("sort_metric") === "mcm_score" &&
        url.searchParams.get("strength") === "all";
    }, { timeout: 45_000 });
    const snapshotResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/v1/contextual-rankings/snapshot" &&
        url.searchParams.get("selected_player") === "8471215";
    }, { timeout: 45_000 });
    const comparisonResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/v1/contextual-rankings/comparison" &&
        url.searchParams.get("sort_metric") === "mcm_score" &&
        url.searchParams.get("player_ids")?.split(",").length === 6;
    }, { timeout: 45_000 });
    const navigationStartedAt = Date.now();
    await page.goto("/rankings?entity=skaters&season=20252026&window=season&strength=all&min_gp=1&min_toi=600&sort_metric=mcm_score&selected_player=8471215");
    await expect(page.getByRole("heading", { name: "Skater Rankings" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Strength" })).toHaveValue("all");
    const [snapshot, comparison, matrix] = await Promise.all([snapshotResponse, comparisonResponse, matrixResponse]).catch(async (error) => {
      await testInfo.attach("ranking-request-failures", { body: JSON.stringify({ pageErrors, requestFailures }), contentType: "application/json" });
      throw error;
    });
    expect(snapshot.status()).toBe(200);
    expect(comparison.status()).toBe(200);
    expect(matrix.status()).toBe(200);
    const matrixPayload = await matrix.json();
    expect(matrixPayload.meta.sortMetricAvailableRowCount).toEqual(expect.any(Number));
    const contextSummary = matrixPayload.meta.sortMetricAvailableRowCount === 0
      ? "2025–2026 performance · No eligible values for MCM Score across all skaters · ALL · Season · Min 1 GP · Min 600s TOI"
      : "2025–2026 performance · Sorted by MCM Score percentile across all skaters · ALL · Season · Min 1 GP · Min 600s TOI";
    await expect(page.getByText(contextSummary, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Hide controls" }).click();
    await expect(page.getByText(contextSummary, { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Strength" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show controls" })).toBeVisible();
    await expect(page.getByText("Dataset snapshot", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText(contextSummary, { exact: true })).toBeVisible();
    await expect(page.getByText("Dataset snapshot", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("rankings-context-collapsed-390.png"), fullPage: true });
    await page.setViewportSize({ width: 1180, height: 900 });
    const snapshotPayload = await snapshot.json();
    const comparisonPayload = await comparison.json();
    expect(snapshotPayload).toMatchObject({ success: true, status: "available", row: { entity: { id: 8471215 } } });
    expect(comparisonPayload).toMatchObject({ success: true, status: "available", request: { subjectCount: 6 } });
    expect(comparisonPayload.subjects).toHaveLength(6);
    const context = page.getByRole("complementary", { name: "Comparison context" });
    await expect(context.getByText("Evgeni Malkin", { exact: true })).toBeVisible();
    await expect(context.getByText("Loading comparison...")).toHaveCount(0);
    await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    for (const url of rankingRequests) {
      expect(url.searchParams.get("season")).toBe("20252026");
      expect(url.searchParams.get("strength")).toBe("all");
      expect(url.searchParams.get("min_gp")).toBe("1");
      expect(url.searchParams.get("min_toi")).toBe("600");
    }
    const summary = { snapshotStatus: snapshot.status(), comparisonStatus: comparison.status(),
      matrixStatus: matrix.status(), sortMetricAvailableRowCount: matrixPayload.meta.sortMetricAvailableRowCount,
      contextSummary,
      snapshotDate: snapshotPayload.source?.snapshotDate, selectedPlayerId: snapshotPayload.row.entity.id,
      comparisonReadyFromNavigationMs: Date.now() - navigationStartedAt,
      requests: rankingRequests.map((url) => `${url.pathname}${url.search}`),
      comparisonSubjects: comparisonPayload.subjects.map((subject: { key: string; status: string }) => ({ key: subject.key, status: subject.status })) };
    await page.screenshot({ path: testInfo.outputPath("rankings-live-timeout-recovery.png"), fullPage: true });
    await writeFile(testInfo.outputPath("ranking-url-ready.json"), JSON.stringify(summary, null, 2));
    await testInfo.attach("live-ranking-response-summary", {
      body: JSON.stringify(summary),
      contentType: "application/json",
    });
  });

  test("applies and restores the fantasy preset at reference widths", async ({ page }) => {
    for (const width of [1180, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
      await page.goto("/rankings?season=20252026&strength=5v5&team=BOS&page=3");
      const preset = page.getByRole("button", { name: "Fantasy preset" });
      await preset.focus();
      await preset.press("Enter");
      await expect(page).toHaveURL(/(?:\?|&)sort_metric=mcm_score(?:&|$)/);
      const params = new URL(page.url()).searchParams;
      expect(params.get("season")).toBe("20252026");
      expect(params.get("strength")).toBe("all");
      expect(params.get("min_gp")).toBe("1");
      expect(params.get("min_toi")).toBe("600");
      expect(params.get("columns")).toContain("pp_points_per_60");
      expect(params.has("team")).toBe(false);
      await page.reload();
      await expect(page.getByRole("combobox", { name: "Strength" })).toHaveValue("all");
      await page.getByText("Fantasy preset basis", { exact: true }).click();
      await expect(page.getByText(/eligibility rules, not reliability guarantees/)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });

  test("renders the live skater matrix and core controls in a real browser", async ({
    page,
  }) => {
    await page.goto(
      "/rankings?entity=skaters&tab=rankings&strength=5v5&page_size=10",
    );

    await expect(
      page.getByRole("heading", { name: "Skater Rankings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Rankings Matrix" }),
    ).toBeVisible();
    await expect(page.getByText(/Showing 10 of \d+/)).toBeVisible();
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
    await expect(page.getByRole("table")).toContainText("Player");
    await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
    await expect(
      page.getByRole("complementary", { name: "Comparison context" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page).toHaveURL(/(?:\?|&)page=2(?:&|$)/);
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();

    await page.getByRole("button", { name: "More Filters" }).click();
    await expect(
      page.getByRole("dialog", { name: "More ranking filters" }),
    ).toBeVisible();
    await expect(page.getByText("Metric Groups")).toBeVisible();
    await expect(page.getByText("Columns")).toBeVisible();

    await page.getByRole("button", { name: "Metric Explorer" }).click();
    await expect(page).toHaveURL(/(?:\?|&)tab=metric_explorer(?:&|$)/);
    await expect(
      page.getByRole("heading", { name: "Metric Explorer" }),
    ).toBeVisible();
  });

  test("renders opportunity signals and goalie source states in a real browser", async ({
    page,
  }) => {
    await page.goto(
      "/rankings?entity=skaters&tab=trending&strength=5v5&page_size=10",
    );

    await expect(
      page.getByRole("heading", { name: "Trending Players" }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toContainText("Opportunity");
    await expect(page.getByText(/Opportunity contracts:/)).toBeVisible();

    await page.goto(
      "/rankings?entity=goalies&tab=rankings&goalie_metric=relative_save_percentage&page_size=10",
    );
    await expect(
      page.getByRole("heading", { name: "Goalie Rankings" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Ranking quick info").getByText("Rel SV% Percentile"),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Comparison context" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Trending" }).click();
    await expect(page.getByRole("region", { name: "Trending status" })).toBeVisible();
    await expect(
      page.getByText(/Trending is Source Pending for goalie rankings/),
    ).toBeVisible();
  });

  test("restores a live team unit metric from URL state", async ({ page }) => {
    await page.goto(
      "/rankings?entity=teams&tab=rankings&team_metric=forward_top_load_index&page_size=10",
    );

    await expect(
      page.getByRole("heading", { name: "Team Rankings" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Ranking quick info").getByText(
        "Forward Top Load Percentile",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Team Rankings Matrix" }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toContainText("Fwd Top Load");
    await expect(page.getByText(/Team style caveat:/)).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Comparison context" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/(?:\?|&)team_metric=forward_top_load_index(?:&|$)/);
  });
});
