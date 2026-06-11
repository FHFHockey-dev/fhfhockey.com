import { expect, test } from "@playwright/test";

test.describe("/rankings", () => {
  test("renders the live skater matrix and core controls in a real browser", async ({
    page,
  }) => {
    await page.goto(
      "/rankings?entity=skaters&tab=rankings&strength=5v5&page_size=10",
    );

    await expect(
      page.getByRole("heading", { name: "Player Rankings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Rankings Matrix" }),
    ).toBeVisible();
    await expect(page.getByText(/Showing 10 of \d+/)).toBeVisible();
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
    await expect(page.getByRole("table")).toContainText("Player");
    await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();

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
});
