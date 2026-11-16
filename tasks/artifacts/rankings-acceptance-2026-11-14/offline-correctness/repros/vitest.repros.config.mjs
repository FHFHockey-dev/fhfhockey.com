// Open-defect reproductions for the Rankings acceptance work. Each passing
// "DEFECT PRESENT" test means the defect still exists. Root stays web/ so lib/*
// paths resolve; this folder is explicitly allowed. Run from web/:
//   npx vitest run --config ../tasks/artifacts/rankings-acceptance-2026-11-14/offline-correctness/repros/vitest.repros.config.mjs
import tsconfigPaths from "/Users/tim/Code/fhfhockey.com/web/node_modules/vite-tsconfig-paths/dist/index.mjs";

const WEB = "/Users/tim/Code/fhfhockey.com/web";
const REPROS = "/Users/tim/Code/fhfhockey.com/tasks/artifacts/rankings-acceptance-2026-11-14/offline-correctness/repros";

export default {
  root: WEB,
  plugins: [tsconfigPaths({ root: WEB })],
  server: { fs: { strict: false, allow: ["/Users/tim/Code/fhfhockey.com"] } },
  test: {
    environment: "node",
    dir: REPROS,
    include: ["**/*.repro.test.ts"],
    setupFiles: [`${WEB}/__tests__/vitest.setup.js`],
  },
};
