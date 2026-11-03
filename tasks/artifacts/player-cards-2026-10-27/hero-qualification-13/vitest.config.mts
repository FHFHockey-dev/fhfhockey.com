import { defineConfig } from "../../../../web/node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";
const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const own = fileURLToPath(new URL("./", import.meta.url));
export default defineConfig({root:repo,resolve:{alias:{lib:repo+"web/lib"}},cacheDir:own+".vite-cache",esbuild:{jsx:"automatic"},test:{environment:"jsdom",setupFiles:[own+"offline.setup.ts"],include:["web/lib/player-cards/currentArtwork.test.ts", "web/components/player-cards/CurrentPlayerCardStudio.test.tsx", "web/components/player-cards/PlayerCardShareStudio.test.tsx", "web/lib/player-cards/shareExport.test.ts"],maxWorkers:1,minWorkers:1,fileParallelism:false}});
