import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../web");
const require = createRequire(resolve(root, "package.json"));
const { defineConfig } = require("vitest/config");
const react = require("@vitejs/plugin-react").default;
export default defineConfig({ root, envDir: here, cacheDir: resolve(here, ".vite"), plugins: [react()],
  resolve: { alias: Object.fromEntries(["lib", "components", "hooks", "contexts", "utils", "pages", "styles"].map(key => [key, resolve(root, key)])) },
  test: { environment: "jsdom", maxWorkers: 1, fileParallelism: false, include: [
    "components/GoalieShareChart/*.test.*", "lib/projections/goalie/workloadEvidence.test.ts",
    "lib/player-forecasts/rollingWindowParticipation.test.ts", "lib/projections/goaliePipeline.test.ts",
    "lib/rosterScheduleData/forgeDailyBridge.test.ts", "__tests__/pages/api/v1/start-chart.test.ts"
  ] }
});
