import { defineConfig } from "vitest/config";
const W = "/private/tmp/c7-r28/head/web";
export default defineConfig({ root: W, cacheDir: "/private/tmp/c7-r28/cache-m", resolve: { alias: ["lib"].map(n => ({ find: new RegExp("^" + n + "/"), replacement: W + "/" + n + "/" })) }, test: { environment: "node", include: ["c7/r28Manifest.test.ts", "lib/forge-testing-grounds/runStoreContract.test.ts", "lib/player-cards/cardEvidenceVerdict.test.ts"] } });
