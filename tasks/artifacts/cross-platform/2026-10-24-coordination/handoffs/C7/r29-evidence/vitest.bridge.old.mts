import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r29/m/web";
export default defineConfig({ root: "/private/tmp/c7-r29/at/web", cacheDir: "/private/tmp/c7-r29/cache-bridge.old", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: ["/private/tmp/c7-r29/at/web/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r29/m/web/lib/rosterScheduleData/forgeDailyBridge.test.ts"], maxWorkers: 1, fileParallelism: false } });
