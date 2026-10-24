import { defineConfig, devices } from "/tmp/fhfh-latest-social-access-zbjtop5e/web/node_modules/@playwright/test";
export default defineConfig({
  testDir: "/tmp/fhfh-latest-social-access-zbjtop5e/web/e2e",
  testMatch: "social-share.spec.ts",
  outputDir: "/Users/tim/Code/fhfhockey.com/tasks/artifacts/production-release-coordination-2026-10-24/latest-social-access/independent-verification/test-results",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  fullyParallel: false,
  reporter: [["list"], ["json", { outputFile: "/Users/tim/Code/fhfhockey.com/tasks/artifacts/production-release-coordination-2026-10-24/latest-social-access/independent-verification/PLAYWRIGHT.json" }]],
  use: { baseURL: "http://127.0.0.1:3140", ...devices["Desktop Chrome"], headless: true, serviceWorkers: "block", screenshot: "only-on-failure", trace: "off", video: "off" },
});
