import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
const W = "/Users/tim/Code/fhfhockey.com/web";
export default defineConfig({ root: W, cacheDir: "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/controls4/cache-wigo", plugins: [tsconfigPaths({ root: W }), react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: W + "/" + n + "/" })) },
  server: { fs: { allow: ["/Users/tim/Code/fhfhockey.com/", "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/controls4/"] } },
  test: { environment: "jsdom", setupFiles: [W + "/__tests__/vitest.setup.js"], dir: "/", include: [W + "/components/WiGO/**/*.test.ts*", W + "/__tests__/pages/wigoCharts.test.tsx", W + "/utils/fetchWigoPlayerStats.test.ts", W + "/utils/calculateWigoRatings.test.ts", W + "/utils/fetchWigoPercentiles.test.ts", W + "/utils/calculatePercentiles.test.ts", W + "/hooks/usePercentileRank.test.tsx"], maxWorkers: 1, fileParallelism: false } });
