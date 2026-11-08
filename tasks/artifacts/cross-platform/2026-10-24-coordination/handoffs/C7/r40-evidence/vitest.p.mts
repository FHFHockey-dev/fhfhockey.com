import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r40b/p/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r40b/cache-p", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "node", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r40b/p/web/lib/projections/apiHelpers.runAdmission.test.ts", "/private/tmp/c7-r40b/p/web/lib/projections/externalInputProof.test.ts", "/private/tmp/c7-r40b/p/web/lib/projections/verifiedForgeReleases.test.ts", "/private/tmp/c7-r40b/p/web/lib/rosterScheduleData/forgeDailyBridge.test.ts", ], maxWorkers: 2, testTimeout: 120000 } });
