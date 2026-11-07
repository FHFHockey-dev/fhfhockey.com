import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r24/head/web";
export default defineConfig({ root: "/private/tmp/c7-r24/head/web", cacheDir: "/private/tmp/c7-r24/cache-0f457e0da-head", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: ["/private/tmp/c7-r24/head/web/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r24/head/web/components/WiGO/GameScoreSection.test.tsx", "/private/tmp/c7-r24/head/web/components/WiGO/NameSearchBar.test.tsx", "/private/tmp/c7-r24/head/web/components/WiGO/StatsTable.test.tsx", "/private/tmp/c7-r24/head/web/components/WiGO/StatsTableRowChart.test.tsx", "/private/tmp/c7-r24/head/web/components/WiGO/fetchTeamDriverSnapshots.test.ts", ], maxWorkers: 1, fileParallelism: false } });
