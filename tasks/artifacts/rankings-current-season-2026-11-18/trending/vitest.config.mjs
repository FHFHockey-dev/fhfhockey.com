import { execFileSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "../../../../web/node_modules/vite-tsconfig-paths/dist/index.mjs";
import react from "../../../../web/node_modules/@vitejs/plugin-react/dist/index.js";

const folder = dirname(fileURLToPath(import.meta.url));
const root = resolve(folder, "../../../..");
const web = resolve(root, "web");
const original = "57a90dfa7892ad8003fa6957c945457f4e0ce173";
const mode = process.env.TRENDING_VERSION;
if (!["before", "after"].includes(mode))
  throw Error("Set TRENDING_VERSION=before or after");
const candidatePaths = new Set([
  "web/lib/rankings/rankingQueries.ts",
  "web/lib/rankings/rollingWindowCountSupportReader.ts",
]);
export default {
  root: web,
  plugins: [
    {
      name: "pin-benchmark-source",
      enforce: "pre",
      resolveId(source, importer) {
        if (
          importer?.startsWith(folder + "/") &&
          !source.startsWith(".") &&
          !source.startsWith("/") &&
          !source.startsWith("node:")
        )
          return this.resolve(
            source,
            web + "/__tests__/pages/rankings.test.tsx",
            { skipSelf: true },
          );
      },
      load(id) {
        const path = relative(root, id);
        if (
          !/^web\/(lib\/rankings\/|pages\/api\/v1\/contextual-rankings\/|components\/Rankings\/|pages\/rankings\.tsx$)/.test(
            path,
          ) ||
          !/\.tsx?$/.test(path)
        )
          return;
        const revision = mode === "after" && candidatePaths.has(path) ? "50dea27b84a34b05a1aa6e67dc24d2774e5d3f24" : original;
        return execFileSync("git", ["show", revision + ":" + path], {
          cwd: root,
          encoding: "utf8",
        });
      },
    },
    tsconfigPaths({ root: web }),
    react(),
  ],
  server: { fs: { allow: [root] } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./__tests__/vitest.setup.js"],
    dir: folder,
    include: ["**/interaction.bench.tsx"],
    testTimeout: 180000,
    hookTimeout: 180000,
  },
};
