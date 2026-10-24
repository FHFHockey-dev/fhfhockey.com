import { defineConfig } from "./node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const artifacts = fileURLToPath(new URL("./", import.meta.url));
export default defineConfig({
  root: repository, cacheDir: `${artifacts}.vite`, esbuild: { jsx: "automatic" }, server: { fs: { allow: [repository] } },
  test: { environment: "jsdom", setupFiles: [`${repository}web/__tests__/vitest.setup.js`],
    include: ["web/lib/forge-testing-grounds/preview/TestingGroundsPreview.test.tsx", "tasks/artifacts/forge-testing-grounds-2026-10-24/slice-04-review/boundaries.test.tsx"],
    cache: false, maxWorkers: 1, fileParallelism: false },
});
