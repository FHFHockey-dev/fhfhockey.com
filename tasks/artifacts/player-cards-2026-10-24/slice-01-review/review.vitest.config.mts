import { defineConfig } from "../../../../web/node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";
const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const own = fileURLToPath(new URL("./", import.meta.url));
export default defineConfig({ root: repo, cacheDir: own + ".vite-cache",
  esbuild: { jsx: "automatic" }, server: { fs: { allow: [repo] } },
  test: { environment: "jsdom", cache: false, maxWorkers: 1, fileParallelism: false,
    setupFiles: [own + "offline.setup.ts"], include: [
      "web/lib/player-cards/ranking.test.ts", "web/components/player-cards/PlayerCardPreview.test.tsx",
      "tasks/artifacts/player-cards-2026-10-24/slice-01-review/independent-controls.test.tsx"
    ] }
});
