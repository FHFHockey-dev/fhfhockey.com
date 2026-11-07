import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r35/p/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r35/cache-p", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "node", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r35/p/web/lib/projections/nativeInputEligibility.test.ts", "/private/tmp/c7-r35/p/web/lib/projections/run-forge-projections.external-inputs.test.ts", "/private/tmp/c7-r35/p/web/lib/projections/run-forge-projections.local-attempt.test.ts", "/private/tmp/c7-r35/p/web/lib/projections/startChartPipeline.test.ts", "/private/tmp/c7-r35/p/web/lib/projections/nativeGoalAccounting.test.ts", "/private/tmp/c7-r35/p/web/lib/projections/runProjectionV2.test.ts", ], maxWorkers: 2, testTimeout: 120000 } });
