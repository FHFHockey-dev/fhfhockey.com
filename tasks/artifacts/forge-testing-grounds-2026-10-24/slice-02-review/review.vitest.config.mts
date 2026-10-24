import { defineConfig } from "../../../../web/node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const artifacts = fileURLToPath(new URL("./", import.meta.url));
export default defineConfig({
  root: repository,
  cacheDir: `${artifacts}.vite`,
  test: {
    environment: "node",
    setupFiles: [`${repository}web/__tests__/vitest.setup.js`],
    include: [
      "web/lib/forge-testing-grounds/ownerPolicy.test.ts",
      "tasks/artifacts/forge-testing-grounds-2026-10-24/slice-02-review/boundaries.test.ts",
    ],
    cache: false, maxWorkers: 1, fileParallelism: false,
  },
});
