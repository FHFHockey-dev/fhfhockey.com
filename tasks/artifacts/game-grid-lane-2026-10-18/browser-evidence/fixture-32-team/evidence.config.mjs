import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'evidence.spec.ts', outputDir: '/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/7dd6c895-7939-4b4b-bd87-bcbcfce08f68/scratchpad/gg32/results', timeout: 90_000, workers: 1, reporter: 'list',
  expect: { timeout: 15_000 },
  webServer: [
    { command: 'node server.mjs', url: 'http://127.0.0.1:3116', reuseExistingServer: true, timeout: 60_000 },
    { command: 'node /Users/tim/Code/fhfhockey.com/web/e2e/fixtures/opponent-four-week-metrics/server.mjs', url: 'http://127.0.0.1:3114', reuseExistingServer: false, timeout: 60_000 },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
