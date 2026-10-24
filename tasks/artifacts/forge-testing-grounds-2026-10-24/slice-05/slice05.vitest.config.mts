import { defineConfig } from "../../../../web/node_modules/vitest/dist/config.js";
import react from "../../../../web/node_modules/@vitejs/plugin-react/dist/index.js";
import { fileURLToPath } from "node:url";
const web = fileURLToPath(new URL("../../../../web/", import.meta.url));
export default defineConfig({
  root: web,
  cacheDir: fileURLToPath(new URL("./.vitest-cache", import.meta.url)),
  plugins: [react()],
  resolve: { alias: { lib: `${web}lib` } },
  esbuild: { jsx: "automatic" },
  test: { environment: "jsdom", setupFiles: [], include: [
    "lib/forge-testing-grounds/serverOwnerBoundary.test.ts",
    "lib/forge-testing-grounds/ownerRoutes.test.ts",
    "lib/forge-testing-grounds/TestingGroundsOwnerGate.test.tsx",
  ] },
});
