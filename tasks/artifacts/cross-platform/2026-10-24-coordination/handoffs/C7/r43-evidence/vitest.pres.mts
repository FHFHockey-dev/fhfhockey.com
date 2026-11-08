import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r43/pres/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r43/cache-pres", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r43/pres/web/lib/projections/reserveProjections.test.ts", "/private/tmp/c7-r43/pres/web/lib/projections/run-forge-projections.local-attempt.test.ts", "/private/tmp/c7-r43/pres/web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "/private/tmp/c7-r43/pres/web/lib/rosterScheduleData/forgeReservePayload.test.ts", ], maxWorkers: 2, testTimeout: 120000 } });
