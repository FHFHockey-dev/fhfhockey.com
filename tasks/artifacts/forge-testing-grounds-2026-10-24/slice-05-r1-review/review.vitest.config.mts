import { defineConfig } from "../../../../web/node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const web = `${repository}web/`, artifacts = fileURLToPath(new URL("./", import.meta.url));
export default defineConfig({
  root: repository, cacheDir: `${artifacts}.vite`, esbuild: { jsx: "automatic" },
  resolve: { alias: { lib: `${web}lib` } }, server: { fs: { allow: [repository] } },
  test: { environment: "jsdom", setupFiles: [`${web}__tests__/vitest.setup.js`],
    include: ["web/lib/forge-testing-grounds/TestingGroundsOwnerGate.test.tsx", "tasks/artifacts/forge-testing-grounds-2026-10-24/slice-05-review/gate-controls.test.tsx", "tasks/artifacts/forge-testing-grounds-2026-10-24/slice-05-r1-review/lifecycle-controls.test.tsx"],
    cache: false, maxWorkers: 1, fileParallelism: false,
    testNamePattern: /\[independent S05-R1\]|\[S05-R1\]|foreground lifecycle:|rejects late JSON|withdraws access on account switch|ignores late initial getSession|ignores a late successful/ },
});
