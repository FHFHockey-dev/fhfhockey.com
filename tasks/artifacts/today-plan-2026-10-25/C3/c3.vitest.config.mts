// Offline C3 harness: run from web/ with
//   npx vitest run --config ../tasks/artifacts/today-plan-2026-10-25/C3/c3.vitest.config.mts
// Plain object (no imports) so the config resolves from outside web/.
const repo = "/Users/tim/Code/fhfhockey.com";
const web = `${repo}/web`;
const c3 = `${repo}/tasks/artifacts/today-plan-2026-10-25/C3`;
const webDir = (name: string) => ({ find: new RegExp(`^${name}/`), replacement: `${web}/${name}/` });

export default {
  root: web,
  cacheDir: "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/78c46f6f-2967-469e-b211-acb09d7137fb/scratchpad/vite-cache",
  resolve: {
    alias: [
      ...["lib", "utils", "components", "hooks", "types", "pages"].map(webDir),
      { find: /^vitest$/, replacement: `${web}/node_modules/vitest/dist/index.js` },
      // The patched copy keeps its source's relative import; both resolve to the web file.
      { find: /^\.\/playerStatsSummaryRefresh$/, replacement: `${web}/lib/underlying-stats/playerStatsSummaryRefresh.ts` },
    ],
  },
  server: { fs: { allow: [repo] } },
  test: {
    environment: "node",
    setupFiles: [`${web}/__tests__/vitest.setup.js`],
    include: [`${c3}/tests/**/*.test.ts`],
    restoreMocks: true,
  },
};
