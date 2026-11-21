// Only the two signed API handlers are built here. Preserve the production producer-admission
// check and webpack stamp from the application. This project has no content pages or cron jobs.
const applicationConfig = require("../next.config");
module.exports = phase => ({
  ...applicationConfig(phase),
  typescript: { tsconfigPath: "tsconfig.json" },
  redirects: async () => [],
  rewrites: async () => [],
  outputFileTracingIncludes: {},
});
