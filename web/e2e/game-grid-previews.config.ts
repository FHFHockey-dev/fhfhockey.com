import { defineConfig } from '@playwright/test';

export default defineConfig({
  outputDir: '../test-results/game-grid-previews',
  testDir: '.', testMatch: 'game-grid-previews.spec.ts', timeout: 60_000, workers: 1,
  expect: { timeout: 15_000 }, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3112', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node fixtures/game-grid-previews/server.mjs', url: 'http://127.0.0.1:3112', reuseExistingServer: false, timeout: 60_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
