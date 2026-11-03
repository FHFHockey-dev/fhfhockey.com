import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r33/p2/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r33/cache-p2", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r33/p2/web/lib/player-forecasts/planningContributions.test.ts", "/private/tmp/c7-r33/p2/web/lib/player-forecasts/rsoUsePolicy.test.ts", "/private/tmp/c7-r33/p2/web/lib/rosterScheduleData/planning.test.ts", "/private/tmp/c7-r33/p2/web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts", "/private/tmp/c7-r33/p2/web/lib/rosterScheduleOptimizer/executionAdapter.test.ts", "/private/tmp/c7-r33/p2/web/lib/rosterScheduleOptimizer/planning.test.ts", ], maxWorkers: 2, testTimeout: 120000 } });
