const web = "/Users/tim/Code/fhfhockey.com/web";
export default {
  root: web,
  cacheDir: "/Users/tim/Code/fhfhockey.com/tasks/artifacts/six-lanes-2026-11-04/L6/checks/vite-cache",
  esbuild: { jsx: "automatic" },
  resolve: { alias: {
    vitest: `${web}/node_modules/vitest/dist/index.js`,
    ...Object.fromEntries(["utils", "hooks", "components", "styles", "lib", "context", "contexts"].map(name => [name, `${web}/${name}`])),
    ...Object.fromEntries(["react", "react-dom", "@tanstack/react-query", "@testing-library/react"].map(name => [name, `${web}/node_modules/${name}`])),
  } },
  test: {
    environment: "jsdom",
    setupFiles: [`${web}/__tests__/vitest.setup.js`],
    include: ["/Users/tim/Code/fhfhockey.com/tasks/artifacts/six-lanes-2026-11-04/L6/candidate/web/components/WiGO/PlayerRatingsDisplay.test.tsx"],
    pool: "forks", maxWorkers: 1, minWorkers: 1,
  },
};
