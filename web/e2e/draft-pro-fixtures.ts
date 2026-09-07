import type { Page } from "@playwright/test";

/** Keeps browser smoke coverage local, free, and independent of real accounts. */
export async function installDraftProFreeFixtures(page: Page) {
  await page.route("**/api/v1/account/draft-pro", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Authentication is required." }),
    }),
  );
  await page.route("**://*.stripe.com/**", (route) => route.abort());
  await page.route("**://*.patreon.com/**", (route) => route.abort());
}
