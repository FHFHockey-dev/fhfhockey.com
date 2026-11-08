import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r27/m/web";
export default defineConfig({ root: "/private/tmp/c7-r27/head/web", cacheDir: "/private/tmp/c7-r27/cache-old", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: ["/private/tmp/c7-r27/head/web/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r27/m/web/lib/socialShare/**/*.test.ts", "/private/tmp/c7-r27/m/web/components/SocialShare/**/*.test.ts*"], maxWorkers: 1, fileParallelism: false } });
