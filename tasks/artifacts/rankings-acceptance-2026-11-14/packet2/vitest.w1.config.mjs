// W1 dry build (reads only). Root web/ for lib/* paths; no unit-test setup file (it points Supabase at an invalid host).
import tsconfigPaths from "/Users/tim/Code/fhfhockey.com/web/node_modules/vite-tsconfig-paths/dist/index.mjs";
const WEB = "/Users/tim/Code/fhfhockey.com/web";
export default {
  root: WEB,
  plugins: [tsconfigPaths({ root: WEB })],
  server: { fs: { strict: false, allow: ["/Users/tim/Code/fhfhockey.com"] } },
  test: { environment: "node", dir: "/Users/tim/Code/fhfhockey.com/tasks/artifacts/rankings-acceptance-2026-11-14/packet2", include: ["**/*.w1.test.ts"], testTimeout: 60_000 },
};
