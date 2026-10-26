/**
 * Offline check that one exact FORGE release cannot read third-party fantasy projection tables (TJ, 2026-10-26).
 *
 * Given a full 40-character commit SHA, it archives that commit's `web/` tree into /private/tmp (read-only git:
 * `rev-parse` and `archive`), follows the whole FORGE run import closure from its production entrypoints (static,
 * re-export, `require` and literal dynamic imports; type imports too) and fails when any module in it
 *   - imports or names the provider configuration (`PROJECTION_SOURCES_CONFIG`, `lib/projectionsConfig/projectionSourcesConfig`);
 *   - holds a `PROJECTIONS_*` / `projections_*` string or template literal (the pundit table family);
 *   - reads a pundit table through a non-literal `.from()` / `.rpc()` argument whose literal values it can resolve
 *     (constants, imported constants, `as const` loops, ternaries, same-file callers of a helper parameter);
 *   - has a dynamic import, an unresolvable local import, or a non-literal table site it cannot resolve that is not in
 *     the reviewed list below (a new site needs its own review before that release can be allowlisted).
 * It writes a JSON receipt. No database, network, deployment or git mutation.
 *
 * The scan, the closure identity and the reviewed dynamic sites live in scripts/forge-producer-closure.ts, shared with the
 * build-time stamp. `--worktree` verifies the checked-out tree in place, and `--tree <web dir>` an exported one; both
 * name their receipt by closure identity.
 *
 *   NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
 *     scripts/verify-forge-release-sha.ts <full-sha> | --worktree | --tree <web dir> [--receipt <path>]
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { computeForgeProducerClosure, FORGE_PRODUCER_IDENTITY_VERSION, FORGE_REQUIRED_MODULES, FORGE_RUN_ROOTS,
  REVIEWED_DYNAMIC_SITES } from "./forge-producer-closure";

export const FORGE_RELEASE_VERIFIER_VERSION = "forge-release-sha-verifier-v1";

/** Of UTF-8 text (every receipt input is a source file or JSON), so it equals the hash of the bytes. */
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function git(repoRoot: string, args: string[]) {
  const env = { ...process.env };
  delete env.GIT_DIR; delete env.GIT_WORK_TREE;
  return execFileSync("git", args, { cwd: repoRoot, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

function main() {
  const args = process.argv.slice(2), tree = args[0] === "--tree" ? resolve(args[1] ?? "") : null;
  const worktree = args[0] === "--worktree" || tree !== null, sha = worktree ? "" : args[0] ?? "";
  const repoRoot = resolve(__dirname, "../..");
  let webRoot: string, source: Record<string, unknown>;
  if (tree) {
    // An exported web/ tree (e.g. HEAD plus one lane's files), identified by its closure hash.
    webRoot = tree;
    source = { kind: "tree", path: tree, head: git(repoRoot, ["rev-parse", "HEAD"]) };
  } else if (worktree) {
    // The checked-out tree as it stands, identified by its closure hash; uncommitted closure files are listed.
    webRoot = join(repoRoot, "web");
    source = { kind: "worktree", head: git(repoRoot, ["rev-parse", "HEAD"]) };
  } else {
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Pass the exact full 40-character lowercase commit SHA, or --worktree.");
    if (git(repoRoot, ["rev-parse", "--verify", `${sha}^{commit}`]) !== sha) throw new Error(`${sha} is not a commit in this repository.`);
    const workDir = `/private/tmp/forge-release-verify-${sha}`;
    rmSync(workDir, { recursive: true, force: true });
    mkdirSync(workDir, { recursive: true });
    git(repoRoot, ["archive", "--format=tar", `--output=${join(workDir, "web.tar")}`, sha, "web"]);
    execFileSync("tar", ["-xf", join(workDir, "web.tar"), "-C", workDir]);
    webRoot = join(workDir, "web");
    source = { kind: "commit", sha, subject: git(repoRoot, ["log", "-1", "--format=%s", sha]),
      committedAt: git(repoRoot, ["log", "-1", "--format=%cI", sha]), tree: git(repoRoot, ["rev-parse", `${sha}^{tree}`]) };
  }
  const { scan, closureSha256 } = computeForgeProducerClosure(webRoot, FORGE_RUN_ROOTS);
  if (worktree && !tree) source.uncommittedClosureFiles = git(repoRoot, ["status", "--porcelain", "--", ...scan.modules.map(file => `web/${file}`)])
    .split("\n").filter(Boolean);
  const verified = scan.findings.length === 0;
  const receiptArg = args.includes("--receipt") ? args[args.indexOf("--receipt") + 1] : undefined;
  const receiptPath = resolve(receiptArg ?? join(repoRoot, "tasks/artifacts/projection-table-audit-2026-10-26/release-verification",
    worktree ? `closure-${closureSha256}.json` : `${sha}.json`));
  const receipt = {
    version: FORGE_RELEASE_VERIFIER_VERSION, ...(worktree ? {} : { sha }), verified,
    producerIdentity: { version: FORGE_PRODUCER_IDENTITY_VERSION, closureSha256 },
    ...(worktree ? { source } : { commit: { subject: source.subject, committedAt: source.committedAt, tree: source.tree } }),
    verifierSha256: sha256(readFileSync(__filename, "utf8")),
    closureWalkerSha256: sha256(readFileSync(join(__dirname, "forge-producer-closure.ts"), "utf8")),
    roots: FORGE_RUN_ROOTS, requiredModules: FORGE_REQUIRED_MODULES, reviewedDynamicSites: REVIEWED_DYNAMIC_SITES,
    closure: { moduleCount: scan.modules.length, modulesSha256: closureSha256, modules: scan.modules },
    findings: scan.findings, dynamicSites: scan.dynamicSites, guardRegexes: scan.guardRegexes,
  };
  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`${verified ? "VERIFIED" : "NOT VERIFIED"} ${tree ? "tree" : worktree ? "worktree" : sha} closure ${closureSha256}: ${scan.modules.length} modules, `
    + `${scan.findings.length} findings, ${scan.dynamicSites.length} dynamic table sites. Receipt ${receiptPath} sha256 ${sha256(readFileSync(receiptPath, "utf8"))}`);
  for (const finding of scan.findings.slice(0, 40)) console.log(`  ${finding.kind} ${finding.file}:${finding.line} ${finding.text}`);
  process.exitCode = verified ? 0 : 1;
}

if (require.main === module) main();
