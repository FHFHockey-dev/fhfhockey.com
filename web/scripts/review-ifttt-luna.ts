import { closeSync, fsyncSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { runRetainedTweetLunaReview, type LunaReviewInput } from "../lib/sources/tweetLunaReview";
import { createLunaTransport } from "../lib/sources/tweetLunaTransport";
import { openLunaLocalAdmission } from "../lib/sources/tweetLunaLocalStore";
import { DECISION_REFERENCE_SHA256 } from "../lib/sources/tweetDecisionReviewMapping";

/** Manual post-retention worker. One saved packet; no DB read, scheduler or live intake hook.
 * Default invocation never reads a key or ledger and never sends a request.
 * A reviewed existing ledger, explicit --dispatch and runtime kill switch are all required.
 */
async function main() {
  const args = process.argv.slice(2), dispatch = args.includes("--dispatch");
  const value = (key: string) => { const i = args.indexOf(key); return i >= 0 ? args[i + 1] : undefined; };
  const inputPath = value("--input"), outputPath = value("--output"), ledgerPath = value("--ledger");
  if (!inputPath || !outputPath || (dispatch && !ledgerPath)) throw new Error("Expected --input packet.json --output new-review.json; dispatch also requires --ledger existing-approved-ledger.json");
  if (resolve(inputPath) === resolve(outputPath) || ledgerPath && [inputPath, outputPath].some(p => resolve(p) === resolve(ledgerPath))) throw new Error("Input, output and ledger must be distinct");
  const raw = readFileSync(inputPath);
  if (raw.length > 512_000) throw new Error("Review packet exceeds local byte limit");
  const ref = readFileSync(resolve("lib/sources/decisionsReference/adapter.mjs"));
  if (createHash("sha256").update(ref).digest("hex") !== DECISION_REFERENCE_SHA256) throw new Error("Retained reference digest mismatch");
  const input: LunaReviewInput = JSON.parse(raw.toString("utf8"));
  const transport = dispatch ? createLunaTransport({ enabled: true,
    stopped: () => process.env.IFTTT_LUNA_REVIEW_ENABLED !== "true" || process.env.IFTTT_LUNA_REVIEW_STOP !== "false",
    apiKey: () => process.env.OPENAI_API_KEY, admission: openLunaLocalAdmission(ledgerPath!),
  }) : undefined;
  // Reserve the new output file before any dispatch; never overwrite an adjudication.
  const output = openSync(outputPath, "wx", 0o600);
  try {
    const result = await runRetainedTweetLunaReview({ enabled: dispatch, input, transport });
    writeFileSync(output, JSON.stringify(result, null, 2) + "\n"); fsyncSync(output);
    process.stdout.write(JSON.stringify({ status: result.status, attempts: result.attempts, holds: result.holds }) + "\n");
    if (result.status === "held") process.exitCode = 2;
  } finally { closeSync(output); }
}

main().catch(() => { process.stderr.write("Luna review held; no automatic retry. Inspect the approved local packet and admission record.\n"); process.exitCode = 1; });
