import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r39/p3/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r39/cache-p3", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r39/p3/web/lib/integrations/yahoo/yahooDiet.test.ts", "/private/tmp/c7-r39/p3/web/lib/integrations/yahoo/planningConfirmations.test.ts", "/private/tmp/c7-r39/p3/web/lib/rosterScheduleOptimizer/providerRules.test.ts", "/private/tmp/c7-r39/p3/web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", ], maxWorkers: 2, testTimeout: 120000 } });
