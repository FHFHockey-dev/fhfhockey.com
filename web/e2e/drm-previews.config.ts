import { defineConfig } from '@playwright/test';

export default defineConfig({
  outputDir: '../test-results/drm-previews',
  testDir: '.', testMatch: 'drm-previews.spec.ts', timeout: 30_000, workers: 1,
  expect: { timeout: 10_000 }, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3114', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node fixtures/drm-previews/server.mjs', url: 'http://127.0.0.1:3114', reuseExistingServer: true, timeout: 30_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
