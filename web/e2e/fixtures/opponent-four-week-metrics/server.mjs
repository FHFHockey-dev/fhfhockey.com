import { build, preview } from "vite";
import react from "@vitejs/plugin-react";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(root, "../../..");
const cache = await mkdtemp(path.join(tmpdir(), "fhfh-omt-4wg-production-"));
const data = path.join(root, "data.ts");
const config = { configFile: false, root, envDir: cache, cacheDir: cache, mode: "production", logLevel: "error",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  plugins: [{ name: "isolated-omt-4wg", enforce: "pre", resolveId(source) {
    source = source.startsWith(web + "/") ? source.slice(web.length + 1).replace(/\.tsx?$/, "") : source;
    if (source.includes("supabase") || source === "lib/NHL/client") throw new Error("Production reader attempted in fixture: " + source);
    if (["hooks/useTeams", "next/link", "next/image", "next/legacy/image"].includes(source)) return "\0fixture:" + source;
    if (source.endsWith("/PoissonHeatMap")) return "\0fixture:empty";
  }, load(id) {
    if (!id.startsWith("\0fixture:")) return;
    const name = id.slice("\0fixture:".length);
    if (name === "empty") return "export default function Empty() { return null; }";
    const mapping = { "hooks/useTeams": "useTeamsMap", "next/link": "Link as default", "next/image": "Image as default", "next/legacy/image": "Image as default" };
    return `export { ${mapping[name]} } from ${JSON.stringify(data)};`;
  } }, react()],
  resolve: { alias: Object.fromEntries(["components", "hooks", "lib", "styles", "utils"].map((key) => [key, path.join(web, key)])) },
  css: { preprocessorOptions: { scss: { loadPaths: [web], quietDeps: true, silenceDeprecations: ["legacy-js-api", "import", "global-builtin", "color-functions"] } } },
  build: { outDir: path.join(cache, "dist"), emptyOutDir: true },
  preview: { host: "127.0.0.1", port: 3114, strictPort: true },
};
await build(config);
const server = await preview(config);
server.printUrls();
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.httpServer.close(() => process.exit(0)));
