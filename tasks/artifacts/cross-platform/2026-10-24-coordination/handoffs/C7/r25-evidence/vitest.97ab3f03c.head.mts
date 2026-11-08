import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r25/head/web";
export default defineConfig({ root: "/private/tmp/c7-r25/head/web", cacheDir: "/private/tmp/c7-r25/cache-97ab3f03c-head", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: ["/private/tmp/c7-r25/head/web/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r25/head/web/components/WiGO/TeamPerformanceDrivers.test.tsx", "/private/tmp/c7-r25/head/web/components/WiGO/fetchTeamDriverSnapshots.test.ts", "/private/tmp/c7-r25/head/web/components/WiGO/teamPerformanceDrivers.test.ts", "/private/tmp/c7-r25/head/web/c7/r25Coverage.test.ts", ], maxWorkers: 1, fileParallelism: false } });
