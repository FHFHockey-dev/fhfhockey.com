import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r36/at/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r36/cache-head", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r36/at/web/lib/rosterScheduleOptimizer/workspace.test.ts", "/private/tmp/c7-r36/at/web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "/private/tmp/c7-r36/at/web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", ], maxWorkers: 2, testTimeout: 120000 } });
