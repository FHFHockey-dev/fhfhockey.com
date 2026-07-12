import { expect, test } from "@playwright/test";

test.describe("/rankings", () => {
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
