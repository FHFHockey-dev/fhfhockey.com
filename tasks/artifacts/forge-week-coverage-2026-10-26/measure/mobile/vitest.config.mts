import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const root = "/Users/tim/Code/fhfhockey.com/web";
const require = createRequire(resolve(root, "package.json"));
const { defineConfig } = require("vitest/config");
export default defineConfig({ root: here, cacheDir: resolve(here, ".vite"),
  resolve: { alias: Object.fromEntries(["lib", "components", "hooks", "contexts", "utils", "pages", "styles"].map(k => [k, resolve(root, k)])) },
  server: { fs: { allow: [root, here] } },
  test: { environment: "node", testTimeout: 300000, include: ["mobile.test.ts"] } });
