import { defineConfig } from "../../../../web/node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";
const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const own = fileURLToPath(new URL("./", import.meta.url));
export default defineConfig({ root: repo, cacheDir: own + ".vite-cache", test: { environment: "node", cache: false, maxWorkers: 1, fileParallelism: false, setupFiles: [own + "offline.setup.ts"], include: ["web/lib/player-cards/nstCapture.test.ts"] } });
