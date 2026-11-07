import { defineConfig } from "../../../../web/node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";
const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const own = fileURLToPath(new URL("./", import.meta.url));
export default defineConfig({ root: repo, resolve: { alias: { components: repo + "web/components", contexts: repo + "web/contexts", lib: repo + "web/lib" } }, cacheDir: own + ".vite-cache",
  esbuild: { jsx: "automatic" }, server: { fs: { allow: [repo] } },
  test: { environment: "jsdom", cache: false, maxWorkers: 1, fileParallelism: false,
    setupFiles: [own + "offline.setup.ts"], include: ["tasks/artifacts/player-cards-2026-10-26/report-qualification-01/real-report-contract.test.ts", "web/components/player-cards/ObservedPlayerCard.test.tsx"] }
});
