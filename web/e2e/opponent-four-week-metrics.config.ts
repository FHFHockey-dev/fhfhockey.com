import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "opponent-four-week-metrics.spec.ts", workers: 1, timeout: 60_000,
  outputDir: process.env.OMT_SCREENSHOTS_DIR ?? "../test-results/opponent-four-week-metrics",
  reporter: "list", use: { baseURL: "http://127.0.0.1:3114", trace: "retain-on-failure" },
  webServer: { command: "node fixtures/opponent-four-week-metrics/server.mjs", url: "http://127.0.0.1:3114", reuseExistingServer: false, timeout: 60_000 },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
