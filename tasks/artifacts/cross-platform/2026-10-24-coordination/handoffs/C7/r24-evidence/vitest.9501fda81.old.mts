import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r24/m-9501fda81/web";
export default defineConfig({ root: "/private/tmp/c7-r24/head/web", cacheDir: "/private/tmp/c7-r24/cache-9501fda81-old", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: ["/private/tmp/c7-r24/head/web/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r24/m-9501fda81/web/components/RosterScheduleOptimizer/HealthyReserveAlert.test.tsx", "/private/tmp/c7-r24/m-9501fda81/web/lib/rosterScheduleOptimizer/healthyReserves.test.ts", ], maxWorkers: 1, fileParallelism: false } });
