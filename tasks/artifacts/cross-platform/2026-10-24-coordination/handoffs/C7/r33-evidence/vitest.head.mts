import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r33/at/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r33/cache-head", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r33/at/web/lib/integrations/yahoo/rosterPlanning.test.ts", "/private/tmp/c7-r33/at/web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts", "/private/tmp/c7-r33/at/web/lib/player-forecasts/planningContributions.test.ts", "/private/tmp/c7-r33/at/web/lib/player-forecasts/rsoUsePolicy.test.ts", "/private/tmp/c7-r33/at/web/lib/rosterScheduleData/planning.test.ts", "/private/tmp/c7-r33/at/web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts", "/private/tmp/c7-r33/at/web/lib/rosterScheduleOptimizer/executionAdapter.test.ts", "/private/tmp/c7-r33/at/web/lib/rosterScheduleOptimizer/planning.test.ts", ], maxWorkers: 2, testTimeout: 120000 } });
