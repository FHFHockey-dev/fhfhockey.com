import { expect, test } from "@playwright/test";
import { installDraftProFreeFixtures } from "./draft-pro-fixtures";

test("mock is isolated, completes, and resumes paused without changing the manual draft", async ({
  page,
}) => {
  await installDraftProFreeFixtures(page, { skaterCount: 12 });
  page.on("dialog", (dialog) => dialog.accept());
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/draft-dashboard");
  await expect(
    page.locator("#mobile-draft-panel-players tbody tr").first(),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole("button", { name: "Practice / Mock Draft" }),
  ).toBeVisible();
  await page
    .locator("#mobile-draft-panel-players tbody tr")
    .first()
    .getByRole("button", { name: "Draft", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}")
            .draftedPlayers?.length,
      ),
    )
    .toBe(1);
  const before = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}")
        .draftedPlayers,
  );
  await page.getByRole("button", { name: "Practice / Mock Draft" }).click();
  const mock = page.getByRole("dialog", { name: "Practice Mock Draft" });
  await expect(
    mock.getByRole("button", { name: "Start mock draft" }),
  ).toBeEnabled();
  await expect(mock.locator('option[value="pro"]')).toHaveAttribute(
    "disabled",
    "",
  );
  await mock.getByRole("button", { name: "Start mock draft" }).click();
  await expect(
    mock.getByText("Pick 1 · Your turn", { exact: true }),
  ).toBeVisible();
  await mock.focus();
  await page.keyboard.press("u");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}")
          .draftedPlayers,
    ),
  ).toEqual(before);
  await mock.getByRole("button", { name: "Pause", exact: true }).click();
  await mock.getByRole("button", { name: "Exit practice" }).click();
  await page.getByRole("button", { name: "Practice / Mock Draft" }).click();
  await mock.getByRole("button", { name: "Take over in this tab" }).click();
  await expect(
    mock.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await mock.getByRole("button", { name: "Resume", exact: true }).click();
  await mock
    .getByRole("button", { name: "Draft", exact: true })
    .first()
    .click();
  await mock.getByRole("button", { name: "Fast-forward to my turn" }).click();
  await expect(
    mock.getByText("Draft complete", { exact: true }).first(),
  ).toBeVisible();
  await mock
    .getByRole("button", { name: "Draft summary", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Close Draft Summary" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close Draft Summary" }).click();
  await mock.getByRole("button", { name: "Exit practice" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("draft.snapshot.v2") || "{}")
          .draftedPlayers,
    ),
  ).toEqual(before);
  expect(errors).toEqual([]);
});

test("reloading restores a paused mock and a second tab must take over", async ({
  page,
  context,
}) => {
  await installDraftProFreeFixtures(page, { skaterCount: 12 });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/draft-dashboard");
  await page.getByRole("button", { name: "Practice / Mock Draft" }).click();
  const mock = page.getByRole("dialog", { name: "Practice Mock Draft" });
  await mock.getByRole("button", { name: "Start mock draft" }).click();
  await expect(
    mock.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await mock.getByRole("button", { name: "Pause", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Practice / Mock Draft" }).click();
  await mock.getByRole("button", { name: "Take over in this tab" }).click();
  await expect(
    mock.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  const second = await context.newPage();
  await installDraftProFreeFixtures(second);
  second.on("dialog", (dialog) => dialog.accept());
  await second.goto("/draft-dashboard");
  await second.getByRole("button", { name: "Practice / Mock Draft" }).click();
  const other = second.getByRole("dialog", { name: "Practice Mock Draft" });
  await expect(
    other.getByRole("button", { name: "Resume", exact: true }),
  ).toBeDisabled();
  await other.getByRole("button", { name: "Take over in this tab" }).click();
  await expect(
    mock.getByRole("button", { name: "Resume", exact: true }),
  ).toBeDisabled();
  await expect(
    other.getByRole("button", { name: "Resume", exact: true }),
  ).toBeEnabled();
});

test("public ADP is accessible to guests and displays insufficient samples", async ({
  page,
}) => {
  await installDraftProFreeFixtures(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/api/v1/mock-draft/adp?**", (route) =>
    route.fulfill({
      json: {
        data: {
          total: 1,
          cohorts: [],
          rows: [
            {
              playerId: "1001",
              name: "Fixture Center",
              position: "C",
              adp: null,
              median: null,
              low: null,
              high: null,
              selections: 3,
              contributors: 3,
              lastObserved: "2026-09-17T00:00:00Z",
            },
          ],
        },
      },
    }),
  );
  await page.goto("/draft-dashboard");
  await page.getByRole("button", { name: "Practice / Mock Draft" }).click();
  await page
    .getByRole("button", { name: "Human Mock ADP", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Insufficient sample" }),
  ).toBeVisible();
});
