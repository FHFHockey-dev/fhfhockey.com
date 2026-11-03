import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r46/pwa/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r46/cache-pwa", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r46/pwa/web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts", "/private/tmp/c7-r46/pwa/web/lib/rosterScheduleData/forgeDailyBridge.test.ts", ], maxWorkers: 2, testTimeout: 120000 } });
