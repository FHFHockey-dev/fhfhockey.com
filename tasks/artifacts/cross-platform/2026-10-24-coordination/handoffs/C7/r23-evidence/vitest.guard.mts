import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
const W = "/private/tmp/c7-r23/web";
export default defineConfig({ root: W, cacheDir: "/private/tmp/c7-r23/web/c7/cache-g", plugins: [tsconfigPaths({ root: W })], test: { environment: "node", include: ["lib/player-cards/cardEvidenceVerdict.test.ts"], testNamePattern: "evidence wiring boundary" } });
