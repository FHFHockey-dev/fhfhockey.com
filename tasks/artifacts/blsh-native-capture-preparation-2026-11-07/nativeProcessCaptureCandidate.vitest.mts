import { resolve, dirname } from "node:path";
const web = process.cwd();
const artifacts = resolve(web, "../tasks/artifacts/blsh-native-capture-preparation-2026-11-07");
const canonical = resolve(web, "lib/nst/client.ts");
const candidate = resolve(artifacts, "nativeProcessCaptureClient.candidate.ts");
export default {
  root: web, envDir: false,
  resolve: { alias: { lib: resolve(web, "lib"), vitest: resolve(web, "node_modules/vitest/dist/index.js") } },
  plugins: [{ name: "isolated-native-client-candidate", enforce: "pre" as const, resolveId(source: string, importer?: string) {
    if (source === "memory-cache") return resolve(web, "node_modules/memory-cache/index.js");
    if (!importer) return;
    if (source.startsWith(".") && resolve(dirname(importer), source).replace(/\.ts$/, "") === canonical.replace(/\.ts$/, "")) return candidate;
    if (importer === candidate && source.startsWith(".")) return resolve(dirname(canonical), `${source}.ts`);
  } }],
  test: { dir: resolve(web, ".."), environment: "node", setupFiles: [resolve(artifacts, "nativeProcessCaptureNetworkBlock.setup.ts")],
    include: ["web/lib/nst/client.test.ts", "tasks/artifacts/blsh-native-capture-preparation-2026-11-07/nativeProcessCaptureClient.test.ts"] },
};
