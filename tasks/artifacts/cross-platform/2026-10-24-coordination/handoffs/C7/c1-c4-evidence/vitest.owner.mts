// C7 reviewer config: mirrors web/vitest.config.mts (jsdom, setup, react, tsconfig paths) with scratch cache/include.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
const W = "/Users/tim/Code/fhfhockey.com/web";
export default defineConfig({
  root: W, cacheDir: "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/cache2", plugins: [tsconfigPaths({ root: W }), react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: W + "/" + n + "/" })) },
  server: { fs: { allow: ["/Users/tim/Code/fhfhockey.com/", "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/"] } },
  test: { environment: "jsdom", setupFiles: [W + "/__tests__/vitest.setup.js"], dir: "/", include: [W + "/hooks/useShotData.test.tsx", W + "/components/TeamTabNavigation/TeamTabNavigation.test.tsx", W + "/__tests__/pages/stats/team/teamAbbreviation.test.tsx", W + "/__tests__/pages/wigoCharts.test.tsx"], maxWorkers: 1, fileParallelism: false },
});
