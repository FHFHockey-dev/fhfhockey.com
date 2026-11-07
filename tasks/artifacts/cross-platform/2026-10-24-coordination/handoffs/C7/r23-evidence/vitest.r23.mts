import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
const W = "/private/tmp/c7-r23/web";
export default defineConfig({ root: W, cacheDir: "/private/tmp/c7-r23/web/c7/cache", plugins: [tsconfigPaths({ root: W }), react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: W + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [W + "/__tests__/vitest.setup.js"], include: ["lib/player-cards/**/*.test.ts*", "__tests__/pages/social-share/player-cards.test.ts", "c7/*.test.ts"], maxWorkers: 1, fileParallelism: false } });
