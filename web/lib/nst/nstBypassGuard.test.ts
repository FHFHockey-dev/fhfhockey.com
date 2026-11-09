// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Static guard: every runtime source file that names an NST host must reach NST
// only through the admitted clients (web/lib/nst/client.ts fetchNstText* /
// nstRequest, or Python nst_get). Otherwise a new path could bypass the global
// rate windows, and one NST rate-limit hit is a 24-hour ban.
const REPO = resolve(__dirname, "../../..");
const ROOTS = ["web", "functions", "webhooks", "cms"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".next-playwright", ".vercel", "__tests__", "tests", "e2e", "dist", "build", ".turbo", "coverage", "__pycache__"]);
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|py)$/;
const TEST_FILE = /\.(test|spec)\.[^.]+$|\.testHelper\.|\.setup\.|vitest\.|playwright\./;
const NST_HOST = /naturalstattrick\.com/i;

/** The admitted clients themselves. */
const CLIENTS = new Set(["web/lib/nst/client.ts", "functions/lib/nst_admission.py"]);
/** Reviewed: these name an NST host only to build or validate a URL; they make no request. */
const REVIEWED_NO_FETCH = new Map([
  ["web/lib/buyLowSellHigh/currentProcessEvidence.server.ts", "validates retained provider URLs; no network call"],
  ["web/scripts/blsh/nativeProcessCapturePreparation.ts", "offline plan builder; execution refuses and names client.ts for any future call"],
]);
const TS_CLIENT_IMPORT = /import\s*\{[^}]*\b(fetchNstText|fetchNstTextByUrl|fetchNstTextWithCache|fetchNstTextWithCacheByUrl|nstRequest)\b[^}]*\}\s*from\s*["'](lib\/nst\/client|(\.\.?\/)+(lib\/)?nst\/client|\.\/client)["']/;
const PY_CLIENT_IMPORT = /from\s+lib\.nst_admission\s+import\s+[^\n]*\bnst_get\b/;
// A direct HTTP call on the same line as an NST host literal is a bypass even in a client-importing file.
const DIRECT_CALL_ON_NST_LINE = /(\bfetch\(|axios\.(get|post|request)\(|\brequests\.(get|post|request|Session)\(|urlopen\(|httpx\.)/;

function walk(directory: string, out: string[]) {
  for (const name of readdirSync(directory)) {
    // Hidden directories (.next*, .vercel, .git) hold build output or local copies, not source.
    if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (SOURCE.test(name) && !TEST_FILE.test(name)) out.push(relative(REPO, path).split("\\").join("/"));
  }
}

function nstFiles(): string[] {
  const files: string[] = [];
  for (const root of ROOTS) {
    try { walk(join(REPO, root), files); } catch (error: any) { if (error.code !== "ENOENT") throw error; }
  }
  return files.filter((file) => NST_HOST.test(readFileSync(join(REPO, file), "utf8"))).sort();
}

describe("NST admission bypass guard", () => {
  const files = nstFiles();

  it("finds the known NST callers (guards against a broken scan)", () => {
    expect(files).toEqual(expect.arrayContaining([...CLIENTS, "web/pages/api/v1/db/update-nst-goalies.ts", "web/pages/api/v1/db/nst_gamelog_scraper.py"]));
  });

  it("every file naming an NST host goes through an admitted client or is reviewed", () => {
    const offenders = files.filter((file) => {
      if (CLIENTS.has(file) || REVIEWED_NO_FETCH.has(file)) return false;
      const source = readFileSync(join(REPO, file), "utf8");
      return !(file.endsWith(".py") ? PY_CLIENT_IMPORT : TS_CLIENT_IMPORT).test(source);
    });
    expect(offenders, "Route NST traffic through lib/nst/client.ts or nst_get, or add a reviewed no-fetch entry").toEqual([]);
  });

  it("no file makes a direct HTTP call on a line naming an NST host", () => {
    const offenders = files.filter((file) => !CLIENTS.has(file)).flatMap((file) =>
      readFileSync(join(REPO, file), "utf8").split("\n")
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => NST_HOST.test(line) && DIRECT_CALL_ON_NST_LINE.test(line))
        .map(({ index }) => `${file}:${index + 1}`));
    expect(offenders).toEqual([]);
  });

  it("the reviewed no-fetch files really make no HTTP call", () => {
    for (const file of REVIEWED_NO_FETCH.keys()) {
      expect(DIRECT_CALL_ON_NST_LINE.test(readFileSync(join(REPO, file), "utf8")), file).toBe(false);
    }
  });
});
