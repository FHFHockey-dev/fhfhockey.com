import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r45/p/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r45/cache-p", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r45/p/web/__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts", "/private/tmp/c7-r45/p/web/lib/rosterScheduleData/forgeDailyBridge.test.ts", "/private/tmp/c7-r45/p/web/lib/rosterScheduleData/planning.test.ts", ], maxWorkers: 2, testTimeout: 120000 } });
