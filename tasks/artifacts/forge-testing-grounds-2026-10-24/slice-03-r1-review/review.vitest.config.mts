import { defineConfig } from "../../../../web/node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const artifacts = fileURLToPath(new URL("./", import.meta.url));
export default defineConfig({
  root: repository, cacheDir: `${artifacts}.vite`, server: { fs: { allow: [repository] } },
  test: { environment: "node", setupFiles: [`${repository}web/__tests__/vitest.setup.js`],
    include: ["tasks/artifacts/forge-testing-grounds-2026-10-24/slice-03-review/boundaries.test.ts", "web/lib/forge-testing-grounds/boundedWorker.test.ts", "tasks/artifacts/forge-testing-grounds-2026-10-24/slice-03-r1-review/budgets.test.ts"],
    testNamePattern: /S03-R1|preserves pending outcome accounting when the run deadline|keeps legacy manifest hashes|stops at the independent outcome-check cap|does not let a pending check erase|\[S03-r1-review\]/,
    cache: false, maxWorkers: 1, fileParallelism: false },
});
