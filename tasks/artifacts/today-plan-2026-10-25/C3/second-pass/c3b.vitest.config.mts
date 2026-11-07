// C3b correction harness (outbox; repo frozen). Run from web/ with
//   npx vitest run --config /private/tmp/fhfh-claude-outbox/C3/c3b.vitest.config.mts
const repo = "/Users/tim/Code/fhfhockey.com";
const web = `${repo}/web`;
const outbox = "/private/tmp/fhfh-claude-outbox/C3";
const webDir = (name: string) => ({ find: new RegExp(`^${name}/`), replacement: `${web}/${name}/` });

export default {
  root: web,
  cacheDir: "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/78c46f6f-2967-469e-b211-acb09d7137fb/scratchpad/vite-cache-c3b",
  resolve: {
    alias: [
      ...["lib", "utils", "components", "hooks", "types", "pages"].map(webDir),
      { find: /^vitest$/, replacement: `${web}/node_modules/vitest/dist/index.js` },
      // The patched copy keeps its source's relative import; both resolve to the web file.
      { find: /^\.\/playerStatsSummaryRefresh$/, replacement: `${web}/lib/underlying-stats/playerStatsSummaryRefresh.ts` },
    ],
  },
  server: { fs: { allow: [repo, outbox] } },
  test: {
    environment: "node",
    setupFiles: [`${web}/__tests__/vitest.setup.js`],
    include: [`${outbox}/tests/**/*.test.ts`],
    restoreMocks: true,
  },
};
