import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
const W = "/private/tmp/c7-r25/head/web";
export default defineConfig({ root: W, cacheDir: "/private/tmp/c7-r25/cache-leak", plugins: [tsconfigPaths({ root: W }), react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: W + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [W + "/__tests__/vitest.setup.js"], include: ["c7/r25Leak.test.ts"] } });
