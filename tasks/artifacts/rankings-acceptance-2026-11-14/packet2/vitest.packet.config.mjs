// Offline perf bench config. Root stays web/ so lib/* paths resolve; the
// artifacts folder is explicitly allowed. Run from web/:
//   npx vitest run --config ../tasks/artifacts/rankings-acceptance-2026-11-14/packet2/vitest.perf.config.mjs
import tsconfigPaths from "/Users/tim/Code/fhfhockey.com/web/node_modules/vite-tsconfig-paths/dist/index.mjs";

const WEB = "/Users/tim/Code/fhfhockey.com/web";
const DIR = "/Users/tim/Code/fhfhockey.com/tasks/artifacts/rankings-acceptance-2026-11-14/packet2";

export default {
  root: WEB,
  plugins: [tsconfigPaths({ root: WEB })],
  server: { fs: { strict: false, allow: ["/Users/tim/Code/fhfhockey.com"] } },
  test: {
    globals: true,
    environment: "node",
    dir: DIR,
    include: ["**/*.urls.test.ts"],
    setupFiles: [`${WEB}/__tests__/vitest.setup.js`],
    testTimeout: 600_000,
  },
};
