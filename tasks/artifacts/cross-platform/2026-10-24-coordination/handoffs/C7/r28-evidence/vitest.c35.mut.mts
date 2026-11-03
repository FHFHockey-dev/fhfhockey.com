import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r28/mut/web";
export default defineConfig({ root: "/private/tmp/c7-r28/head/web", cacheDir: "/private/tmp/c7-r28/cache-c35.mut", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: ["/private/tmp/c7-r28/head/web/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r28/mut/web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts"], maxWorkers: 1, fileParallelism: false } });
