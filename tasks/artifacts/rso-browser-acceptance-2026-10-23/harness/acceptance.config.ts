import { defineConfig, devices } from "@playwright/test";

// Copied into <export>/web/e2e/acceptance/ by run-acceptance.sh; the server is started there.
const out = process.env.RSO_ACCEPT_OUT ?? "test-results/acceptance";

export default defineConfig({
  testDir: ".",
  testMatch: /.*-acceptance\.spec\.ts$/,
  outputDir: `${out}/acceptance-results`,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } } },
  ],
});
