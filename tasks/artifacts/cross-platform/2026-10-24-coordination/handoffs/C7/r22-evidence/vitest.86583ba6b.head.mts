import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const M = "/Users/tim/Code/fhfhockey.com/web";
export default defineConfig({ root: "/Users/tim/Code/fhfhockey.com/web", cacheDir: "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/controls8/cache-86583ba6b-head", plugins: [react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles", "public"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: M + "/" + n + "/" })) },
  server: { fs: { allow: ["/Users/tim/Code/fhfhockey.com/", "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/controls8/"] } },
  test: { environment: "jsdom", setupFiles: ["/Users/tim/Code/fhfhockey.com/web/__tests__/vitest.setup.js"], dir: "/", include: ["/Users/tim/Code/fhfhockey.com/web/lib/forge-testing-grounds/preview/TestingGroundsPreview.test.tsx", "/Users/tim/Code/fhfhockey.com/web/lib/forge-testing-grounds/runStoreContract.test.ts", ], maxWorkers: 1, fileParallelism: false } });
