// C7 reviewer config: mirrors web/vitest.config.mts (jsdom, setup, react, tsconfig paths) with scratch cache/include.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
const W = "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/news-r1/web";
export default defineConfig({
  root: W, cacheDir: "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/news-r1/cache", plugins: [tsconfigPaths({ root: W }), react()],
  resolve: { alias: ["lib", "components", "hooks", "pages", "utils", "contexts", "styles"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: W + "/" + n + "/" })) },
  server: { fs: { allow: ["/Users/tim/Code/fhfhockey.com/", "/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/"] } },
  test: { environment: "jsdom", setupFiles: [W + "/__tests__/vitest.setup.js"], dir: "/", include: ["/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b948d22c-6ba8-446f-ba36-c2db70333467/scratchpad/c7/news-r1/controls/**/*.test.tsx", W + "/lib/homepageNewsCompatibility.test.tsx", W + "/lib/newsFeed.test.ts", W + "/lib/sources/tweetNewsAutomation.test.ts", W + "/lib/sources/tweetPatternReview.test.ts"], maxWorkers: 1, fileParallelism: false },
});
