import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r43/pfix/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r43/cache-pfix", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r43/pfix/web/lib/projections/externalInputProof.test.ts", "/private/tmp/c7-r43/pfix/web/lib/projections/verifiedForgeReleases.test.ts", "/private/tmp/c7-r43/pfix/web/lib/game-predictions/featureBuilder.test.ts", "/private/tmp/c7-r43/pfix/web/lib/game-predictions/publicPredictions.test.ts", "/private/tmp/c7-r43/pfix/web/lib/game-predictions/workflow.test.ts", ], maxWorkers: 2, testTimeout: 120000 } });
