import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r41/at/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r41/cache-c7", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r41/at/web/lib/projections/c7/r41Identity.test.ts", ], maxWorkers: 2, testTimeout: 120000 } });
