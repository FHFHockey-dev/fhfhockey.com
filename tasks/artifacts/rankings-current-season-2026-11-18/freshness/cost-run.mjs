// Run with Node 22 from any directory. No network or .env files are used.
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const folder = dirname(fileURLToPath(import.meta.url));
const repo = resolve(folder, "../../../..");
const [, , exportDir, releaseRef] = process.argv;
if (Boolean(exportDir) !== Boolean(releaseRef)) throw Error("Provide both a source export and its Git revision.");
const web = join(exportDir ? resolve(exportDir) : repo, "web");
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const revision = git("rev-parse", "--verify", (releaseRef ?? "HEAD") + "^{commit}");
const require = createRequire(join(web, "package.json"));
const temp = mkdtempSync(join(tmpdir(), "rankings-cost-"));
try {
  const out = join(temp, "run.cjs");
  const { metafile } = await require("esbuild").build({
    absWorkingDir: web, bundle: true, platform: "node", outfile: out, format: "cjs", metafile: true,
    nodePaths: [join(web, "node_modules")], tsconfig: join(web, "tsconfig.json"), logLevel: "silent",
    entryPoints: [join(folder, "cost-fixture.ts")], define: { "process.env.NODE_ENV": '"production"' },
  });
  const files = Object.keys(metafile.inputs).filter(path => path.startsWith("lib/") && !path.includes("__acceptance__")).sort();
  if (releaseRef) {
    if (!files.length) throw Error("No candidate sources found.");
    for (const file of files) {
      if (git("hash-object", join(web, file)) !== git("rev-parse", revision + ":web/" + file)) {
        throw Error("Export differs from the release at web/" + file);
      }
    }
  }
  const graph = createHash("sha256");
  for (const file of files) graph.update(file + "\0").update(readFileSync(join(web, file)));
  execFileSync(process.execPath, [out], {
    stdio: "inherit", cwd: web, env: {
      COST_OUTPUT: join(folder, "cost-sample.json"), GRAPH_SHA256: graph.digest("hex"), GRAPH_FILES: String(files.length),
      CHECKOUT_BASE: revision,
      RANKINGS_DAILY_PUBLICATION: "2026-11-17", NEXT_PUBLIC_SUPABASE_URL: "http://fixture.invalid",
      VERCEL_GIT_COMMIT_SHA: revision, RANKINGS_DAILY_PUBLICATION_RELEASE: revision,
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-placeholder", NODE_ENV: "production",
    },
  });
} finally { rmSync(temp, { recursive: true, force: true }); }
