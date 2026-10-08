import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { frozenPairOutcome, frozenPairOutcomeMarkdown, officialOutcomeSourceFromRetainedFiles } from "../lib/forecast-diagnostics/frozenPairOutcome";
import { denyNetwork } from "./run-frozen-forecast-pair";

/** Consume the acquisition owner's retained final source. No collection, polling, forecast issuance or original-file writes. */
export function readFrozenForecastOutcome(args: string[]) {
  if (args.length !== 3 && args.length !== 4) throw new Error("Usage: read-frozen-forecast-outcome.ts ISSUED_DIRECTORY RETAINED_FINAL_SOURCE_JSON [RAW_BODY_FILE] EXCLUSIVE_PRIVATE_DIRECTORY");
  const [issuedDirectory, finalSourceFile] = args, destination = args[args.length - 1];
  const rawBodyFile = args.length === 4 ? args[2] : null;
  const issued = realpathSync(issuedDirectory), requestedOutput = resolve(destination);
  const output = join(realpathSync(dirname(requestedOutput)), basename(requestedOutput));
  const inside = relative(issued, output);
  if (!inside || (inside !== ".." && !inside.startsWith(".." + sep) && !isAbsolute(inside))) throw new Error("Outcome cannot be written inside the preserved original directory");
  if (existsSync(join(issued, "failed.json"))) throw new Error("Failed issuance has no original outcome comparison");
  denyNetwork();
  const read = (file: string, limit: number) => {
    const info = lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > limit) throw new Error("Invalid or oversized retained outcome input");
    const bytes = readFileSync(file);
    if (bytes.length > limit) throw new Error("Oversized retained outcome input");
    return bytes;
  };
  const files = [join(issued, "inputs.json"), join(issued, "original.json"), resolve(finalSourceFile),
    ...(rawBodyFile === null ? [] : [resolve(rawBodyFile)])];
  const bytes = files.map((file, index) => read(file, index === 3 ? 8 * 1024 * 1024 : 32 * 1024 * 1024));
  if (bytes.reduce((total, value) => total + value.length, 0) > 48 * 1024 * 1024) throw new Error("Combined outcome readback exceeds 48 MiB bound");
  const source = rawBodyFile === null ? JSON.parse(bytes[2].toString("utf8"))
    : officialOutcomeSourceFromRetainedFiles(JSON.parse(bytes[2].toString("utf8")), bytes[3].toString("utf8"));
  const report = frozenPairOutcome(JSON.parse(bytes[0].toString("utf8")), JSON.parse(bytes[1].toString("utf8")), source);
  const sha = (value: Buffer) => createHash("sha256").update(new Uint8Array(value)).digest("hex");
  const verifyUnchanged = () => files.forEach((file, index) => {
    if (sha(read(file, 32 * 1024 * 1024)) !== sha(bytes[index])) throw new Error("Retained original or final source changed during readback");
  });
  verifyUnchanged();
  mkdirSync(output, { mode: 0o700 });
  const save = (name: string, text: string) => {
    const fd = openSync(join(output, name), "wx", 0o600);
    try { writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
  };
  save("outcome.json", JSON.stringify(report, null, 2) + "\n");
  save("outcome.md", frozenPairOutcomeMarkdown(report));
  verifyUnchanged();
  save("manifest.json", JSON.stringify({ version: "frozen-outcome-readback-v1", createdAt: new Date().toISOString(),
    pairId: report.pairId, sourceFiles: files.map((path, index) => ({ path, rawBytesHash: sha(bytes[index]) })),
    originalsUnchanged: true, networkDenied: true, acceptanceEligible: false }, null, 2) + "\n");
  return report;
}
if (require.main === module) {
  try { const report = readFrozenForecastOutcome(process.argv.slice(2));
    console.log(JSON.stringify({ status: "outcome_readback", pairId: report.pairId, gameId: report.scope.gameId, acceptanceEligible: false })); }
  catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
