// One-off TT-2 capture runner (lane TT). Vitest is used only as a TypeScript runner with web's path aliases.
// It reads the public anon key from web/.env.local into this process's env; nothing is printed or saved.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../../web");
const require = createRequire(resolve(root, "package.json"));
const { defineConfig } = require("vitest/config");
const env = Object.fromEntries(readFileSync(resolve(root, ".env.local"), "utf8").split("\n")
  .map(line => line.match(/^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLIC_KEY)=(.*)$/)).filter(Boolean)
  .map(match => [match![1], match![2].trim().replace(/^["']|["']$/g, "")]));
export default defineConfig({ root, cacheDir: resolve(here, ".vite"),
  resolve: { alias: { ...Object.fromEntries(["lib", "components", "hooks", "contexts", "utils", "pages", "styles"].map(key => [key, resolve(root, key)])),
    "@supabase/supabase-js": resolve(root, "node_modules/@supabase/supabase-js") } },
  test: { environment: "node", dir: here, include: ["capture.run.ts"], testTimeout: 180000, maxWorkers: 1, fileParallelism: false, env: { ...env, TT_CAPTURE_DIR: here } } });
