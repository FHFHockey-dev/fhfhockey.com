import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r26/head/web";
export default defineConfig({ root: "/private/tmp/c7-r26/head/web", cacheDir: "/private/tmp/c7-r26/cache-head", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: ["/private/tmp/c7-r26/head/web/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r26/head/web/lib/socialShare/**/*.test.ts", "/private/tmp/c7-r26/head/web/components/SocialShare/**/*.test.ts*"], maxWorkers: 1, fileParallelism: false } });
