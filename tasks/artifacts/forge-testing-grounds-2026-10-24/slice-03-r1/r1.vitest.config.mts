import { defineConfig } from "../../../../web/node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const artifacts = fileURLToPath(new URL("./", import.meta.url));
export default defineConfig({
  root: repository, cacheDir: `${artifacts}.vite`, server: { fs: { allow: [repository] } },
  test: {
    environment: "node", setupFiles: [`${repository}web/__tests__/vitest.setup.js`],
    include: ["tasks/artifacts/forge-testing-grounds-2026-10-24/slice-03-review/boundaries.test.ts"],
    cache: false, maxWorkers: 1, fileParallelism: false,
    testNamePattern: /\[S03-R1\]|preserves pending outcome accounting when the run deadline/,
  },
});
