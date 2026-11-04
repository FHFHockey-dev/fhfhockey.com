import { closeSync, fsyncSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { runRetainedTweetLunaReview, type LunaReviewInput } from "../lib/sources/tweetLunaReview";
import { createLunaTransport } from "../lib/sources/tweetLunaTransport";
import { openLunaLocalAdmission } from "../lib/sources/tweetLunaLocalStore";
import { DECISION_REFERENCE_SHA256 } from "../lib/sources/tweetDecisionReviewMapping";
import { LUNA_EVIDENCE_BINDING_POLICY } from "../lib/sources/tweetLunaEvidenceBinding";
import { recordLunaEvidenceBindingDecision, runRetainedTweetLunaReviewWithBinding } from "../lib/sources/tweetLunaBindingWorkflow";

/** Manual post-retention worker. One saved packet; no DB read, scheduler or live intake hook.
 * Default invocation never reads a key or ledger and never sends a request.
 * A reviewed existing ledger, explicit --dispatch and runtime kill switch are all required.
 */
async function main() {
  const args = process.argv.slice(2), dispatch = args.includes("--dispatch");
  const value = (key: string) => { const i = args.indexOf(key); return i >= 0 ? args[i + 1] : undefined; };
  const inputPath = value("--input"), outputPath = value("--output"), ledgerPath = value("--ledger");
  const candidateOutput = value("--binding-candidate-output"), decisionPath = value("--binding-decision");
  if (decisionPath) {
    const candidatePath = value("--binding-candidate"), originalPath = value("--original-review");
    if (dispatch || inputPath || ledgerPath || candidateOutput || !candidatePath || !originalPath || !outputPath
      || new Set([decisionPath, candidatePath, originalPath, outputPath].map(p => resolve(p))).size !== 4) throw new Error("Separate local decision inputs/output required");
    const read = (path: string) => { const raw = readFileSync(path); if (raw.length > 1_500_000) throw new Error("Decision input too large"); return JSON.parse(raw.toString("utf8")); };
    const result = recordLunaEvidenceBindingDecision({ candidate: read(candidatePath), originalReview: read(originalPath), decision: read(decisionPath) });
    if (result.status !== "recorded_for_review") throw new Error("Binding decision held");
    const output = openSync(outputPath, "wx", 0o600);
    try { writeFileSync(output, JSON.stringify(result.record, null, 2) + "\n"); fsyncSync(output); } finally { closeSync(output); }
    process.stdout.write(JSON.stringify({ status: result.status, canApply: false }) + "\n");
    return;
  }
  if (args.includes("--binding-candidate") || args.includes("--original-review") || args.includes("--binding-decision")
    || args.includes("--binding-candidate-output") && !candidateOutput) throw new Error("Incomplete binding review arguments");
  if (!inputPath || !outputPath || (dispatch && !ledgerPath)) throw new Error("Expected --input packet.json --output new-review.json; dispatch also requires --ledger existing-approved-ledger.json");
  const paths = [inputPath, outputPath, ...(ledgerPath ? [ledgerPath] : []), ...(candidateOutput ? [candidateOutput] : [])].map(p => resolve(p));
  if (new Set(paths).size !== paths.length) throw new Error("Input, output, candidate and ledger must be distinct");
  const raw = readFileSync(inputPath);
  if (raw.length > 512_000) throw new Error("Review packet exceeds local byte limit");
  const ref = readFileSync(resolve("lib/sources/decisionsReference/adapter.mjs"));
  if (createHash("sha256").update(ref as unknown as Uint8Array).digest("hex") !== DECISION_REFERENCE_SHA256) throw new Error("Retained reference digest mismatch");
  const input: LunaReviewInput = JSON.parse(raw.toString("utf8"));
  const transport = dispatch ? createLunaTransport({ enabled: true,
    stopped: () => process.env.IFTTT_LUNA_REVIEW_ENABLED !== "true" || process.env.IFTTT_LUNA_REVIEW_STOP !== "false",
    apiKey: () => process.env.OPENAI_API_KEY, admission: openLunaLocalAdmission(ledgerPath!),
  }) : undefined;
  // Reserve the new output file before any dispatch; never overwrite an adjudication.
  const output = openSync(outputPath, "wx", 0o600);
  let candidateFile: number | undefined;
  try {
    // Reserve the separate correction artifact before any request as well.
    if (candidateOutput) candidateFile = openSync(candidateOutput, "wx", 0o600);
    const bound = candidateOutput ? await runRetainedTweetLunaReviewWithBinding({ enabled: dispatch, input, transport,
      bindingPolicy: LUNA_EVIDENCE_BINDING_POLICY }) : null;
    const result = bound ? bound.review : await runRetainedTweetLunaReview({ enabled: dispatch, input, transport });
    writeFileSync(output, JSON.stringify(result, null, 2) + "\n"); fsyncSync(output);
    if (candidateFile !== undefined && bound) {
      writeFileSync(candidateFile, JSON.stringify(bound.candidate ?? { status: bound.bindingStatus, candidate: null }, null, 2) + "\n"); fsyncSync(candidateFile);
    }
    process.stdout.write(JSON.stringify({ status: result.status, attempts: result.attempts, holds: result.holds }) + "\n");
    if (result.status === "held") process.exitCode = 2;
  } finally { if (candidateFile !== undefined) closeSync(candidateFile); closeSync(output); }
}

main().catch(() => { process.stderr.write("Luna review held; no automatic retry. Inspect the approved local packet and admission record.\n"); process.exitCode = 1; });
