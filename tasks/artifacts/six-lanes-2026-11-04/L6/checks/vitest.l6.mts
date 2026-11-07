import { defineConfig } from "/Users/tim/Code/fhfhockey.com/web/node_modules/vitest/dist/config.js";
const web = "/Users/tim/Code/fhfhockey.com/web";
export default defineConfig({
  root: "/Users/tim/Code/fhfhockey.com/tasks/artifacts/six-lanes-2026-11-04/L6/candidate",
  cacheDir: "/Users/tim/Code/fhfhockey.com/tasks/artifacts/six-lanes-2026-11-04/L6/checks/vite-cache",
  resolve: { alias: { ...Object.fromEntries(["utils", "hooks", "components", "styles", "lib", "context", "contexts"].map(name => [name, `${web}/${name}`])), ...Object.fromEntries(["react", "react-dom", "@tanstack/react-query", "@testing-library/react"].map(name => [name, `${web}/node_modules/${name}`])) } },
  test: {
    environment: "jsdom",
    setupFiles: [`${web}/__tests__/vitest.setup.js`],
    include: ["web/components/WiGO/PlayerRatingsDisplay.test.tsx"],
    pool: "forks", maxWorkers: 1, minWorkers: 1,
  },
});
