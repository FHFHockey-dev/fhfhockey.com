import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r30/m/web";
export default defineConfig({ root: "/private/tmp/c7-r30/at/web", cacheDir: "/private/tmp/c7-r30/cache-old", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: ["/private/tmp/c7-r30/at/web/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r30/m/web/lib/rosterScheduleOptimizer/reconciliation.test.ts", "/private/tmp/c7-r30/m/web/lib/rosterScheduleOptimizer/planning.test.ts", "/private/tmp/c7-r30/m/web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts", ], maxWorkers: 1, fileParallelism: false } });
