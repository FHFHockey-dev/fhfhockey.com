import { defineConfig } from "../../../web/node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";
const repo = fileURLToPath(new URL("../../../", import.meta.url));
const own = fileURLToPath(new URL("./", import.meta.url));
export default defineConfig({
  root: repo,
  cacheDir: own + ".vite-cache",
  resolve: { alias: [
    { find: /^lib\/supabase$/, replacement: own + "blocked-browser-client.ts" },
    { find: /^lib\//, replacement: repo + "web/lib/" },
    { find: /^utils\//, replacement: repo + "web/utils/" },
    { find: /^components\//, replacement: repo + "web/components/" }
  ] },
  server: { fs: { allow: [repo] } },
  test: {
    environment: "node", cache: false, maxWorkers: 1, fileParallelism: false,
    setupFiles: [own + "offline.setup.ts"],
    include: [
      "web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts",
      "web/utils/fetchWigoPlayerStats.test.ts",
      "tasks/artifacts/wigo-local-fix-independent-review-2026-10-24/independent-controls.test.ts"
    ],
    env: { CRON_SECRET: "reviewer-synthetic", NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-offline", SUPABASE_SERVICE_ROLE_KEY: "synthetic-offline" }
  }
});
