import { defineConfig } from "./node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";
const artifacts = fileURLToPath(new URL("./", import.meta.url));
const web = fileURLToPath(new URL("../../../web/", import.meta.url));
export default defineConfig({
  root: artifacts, cacheDir: `${artifacts}.vite`, esbuild: { jsx: "automatic" },
  resolve: { alias: { hooks: `${web}hooks`, lib: `${web}lib` } },
  server: { fs: { allow: [artifacts, web] } },
  test: { environment: "jsdom", setupFiles: [`${web}__tests__/vitest.setup.js`], include: ["tests/*.test.ts", "tests/*.test.tsx"], cache: false, maxWorkers: 1, fileParallelism: false },
});
