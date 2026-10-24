import { defineConfig } from "./node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const web = `${repository}web/`, artifacts = fileURLToPath(new URL("./", import.meta.url));
export default defineConfig({
  root: repository, cacheDir: `${artifacts}.vite`, esbuild: { jsx: "automatic" },
  resolve: { alias: { lib: `${web}lib` } }, server: { fs: { allow: [repository] } },
  test: { environment: "jsdom", setupFiles: [`${web}__tests__/vitest.setup.js`],
    include: ["web/lib/forge-testing-grounds/serverOwnerBoundary.test.ts", "web/lib/forge-testing-grounds/ownerRoutes.test.ts", "web/lib/forge-testing-grounds/TestingGroundsOwnerGate.test.tsx", "tasks/artifacts/forge-testing-grounds-2026-10-24/slice-05-review/server-controls.test.ts", "tasks/artifacts/forge-testing-grounds-2026-10-24/slice-05-review/gate-controls.test.tsx"],
    cache: false, maxWorkers: 1, fileParallelism: false },
});
