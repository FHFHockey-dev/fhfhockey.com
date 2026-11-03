import { defineConfig } from "../../../web/node_modules/vitest/dist/config.js";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
const repo=fileURLToPath(new URL("../../../",import.meta.url)), own=fileURLToPath(new URL("./",import.meta.url));
export default defineConfig({root:repo+"web",resolve:{alias:{lib:repo+"web/lib"}},cacheDir:own+".integration-vite",esbuild:{jsx:"automatic"},plugins:[{name:"unapplied-card-integration",enforce:"pre",load(id){if(id===repo+"web/components/player-cards/CurrentPlayerCardStudio.tsx")return readFileSync(own+"integration/CurrentPlayerCardStudio.tsx","utf8");}}],test:{globals:true,environment:"jsdom",setupFiles:[repo+"web/__tests__/vitest.setup.js"],include:["components/player-cards/CurrentPlayerCardStudio.test.tsx","components/player-cards/PlayerAnalysisStudio.test.tsx"],maxWorkers:1,minWorkers:1,fileParallelism:false}});
