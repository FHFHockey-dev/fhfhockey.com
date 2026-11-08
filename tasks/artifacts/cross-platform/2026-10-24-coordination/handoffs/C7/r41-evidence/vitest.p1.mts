import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/private/tmp/c7-r41/p1/web";
export default defineConfig({ root: M, cacheDir: "/private/tmp/c7-r41/cache-p1", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  test: { environment: "jsdom", setupFiles: [M + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/c7-r41/p1/web/lib/projections/externalInputProof.test.ts", "/private/tmp/c7-r41/p1/web/lib/projections/forgeProducerIdentity.test.ts", "/private/tmp/c7-r41/p1/web/lib/projections/verifiedForgeReleases.test.ts", "/private/tmp/c7-r41/p1/web/lib/projections/apiHelpers.runAdmission.test.ts", "/private/tmp/c7-r41/p1/web/lib/projections/releasedRunFence.test.ts", "/private/tmp/c7-r41/p1/web/__tests__/pages/api/v1/forge/players.test.ts", "/private/tmp/c7-r41/p1/web/__tests__/pages/api/v1/projections/explicitRunAdmission.test.ts", ], maxWorkers: 2, testTimeout: 120000 } });
