import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r48/pp/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r48/cache-pp", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r48/pp/web/__tests__/pages/api/v1/db/run-projection-v2.preflight.test.ts", ], maxWorkers: 2, testTimeout: 120000 } });
