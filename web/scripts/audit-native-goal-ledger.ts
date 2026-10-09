import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { auditNativeGoalLedger } from "../lib/projections/nativeGoalLedgerAudit";
import { projectionInputHash } from "../lib/projections/inputCapture";

const MAX_BYTES = 32 * 1024 * 1024;
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
function localJson(path: string) {
  if (statSync(path).size > MAX_BYTES) throw new Error("Retained local file exceeds 32 MiB");
  const bytes = readFileSync(path);
  return { path, sha256: digest(new Uint8Array(bytes)), value: JSON.parse(bytes.toString("utf8")) };
}

/** Reads only already-retained local files. It never imports a DB client, captures inputs or issues forecasts. */
export function runNativeGoalLedgerAudit(args: string[]) {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    if (!["--history", "--revisions", "--attribute-audit", "--output"].includes(args[index]) || !args[index + 1] || options.has(args[index]))
      throw new Error("Use --history FILE --revisions DIR --attribute-audit FILE --output NEW_FILE");
    options.set(args[index], resolve(args[index + 1]));
  }
  if (options.size !== 4) throw new Error("Use --history FILE --revisions DIR --attribute-audit FILE --output NEW_FILE");
  const history = localJson(options.get("--history")!);
  const prior = localJson(options.get("--attribute-audit")!);
  const ids = [...history.value.retainedHistorySources, ...history.value.scheduleSources].map(row => row.revisionId);
  if (ids.some(id => typeof id !== "string" || !/^[A-Za-z0-9-]{1,128}$/.test(id))) throw new Error("Unsafe retained revision filename");
  const revisions = ids.sort().map(id => localJson(resolve(options.get("--revisions")!, `${id}.json`)));
  const root = resolve(__dirname, "../..");
  const sources = ["web/lib/projections/nativeGoalLedgerAudit.ts", "web/scripts/audit-native-goal-ledger.ts",
    "web/lib/supabase/Upserts/nhlStrengthState.ts", "web/lib/forecast-diagnostics/pairedInputs.ts", "web/lib/projections/inputCapture.ts"];
  const sourceHashes = Object.fromEntries(sources.map(path => [path, digest(new Uint8Array(readFileSync(resolve(root, path))))]));
  const result = auditNativeGoalLedger({ historyBundle: history.value, revisions: revisions.map(row => row.value),
    attributeAudit: prior.value, parserSourceHash: sourceHashes["web/lib/supabase/Upserts/nhlStrengthState.ts"] });
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const receipt = {
    version: "native-goal-ledger-local-receipt-v1", codeCommit: git("rev-parse", "HEAD"),
    sourceDirty: Boolean(git("status", "--porcelain")), nodeVersion: process.version, sourceHashes,
    committedWebTreeHash: projectionInputHash(git("ls-tree", "-r", "HEAD", "web")),
    lockfileHash: digest(new Uint8Array(readFileSync(resolve(root, "web/package-lock.json")))),
    inputFiles: [history, prior, ...revisions].map(({ path, sha256 }) => ({ path, sha256 })),
    resultHash: projectionInputHash(result), result,
  };
  // A new output is required so retained inputs, owner artifacts and prior receipts cannot be overwritten.
  writeFileSync(options.get("--output")!, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  return receipt;
}

if (require.main === module) {
  try {
    const receipt = runNativeGoalLedgerAudit(process.argv.slice(2));
    console.log(JSON.stringify({ codeCommit: receipt.codeCommit, resultHash: receipt.resultHash,
      verifiedGames: receipt.result.games.length, officialPlayGoals: receipt.result.goalCount,
      acceptanceEligible: receipt.result.acceptanceEligible, exposureStatus: receipt.result.exposureAudit.status }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
