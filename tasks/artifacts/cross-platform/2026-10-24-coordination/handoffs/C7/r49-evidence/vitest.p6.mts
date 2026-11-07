import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r49/p6/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r49/cache-p6", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r49/p6/web/lib/integrations/yahoo/rosterPlanning.test.ts", "/private/tmp/c7-r49/p6/web/lib/integrations/yahoo/yahooDiet.test.ts", "/private/tmp/c7-r49/p6/web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts", ], maxWorkers: 2, testTimeout: 180000 } });
