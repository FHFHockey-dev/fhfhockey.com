import { readFileSync } from "node:fs";
import { evaluateForwardTweetClaimExport, type TweetClaimEvaluationExport } from "../lib/sources/tweetClaimEvaluation";

/** Offline only. Input must be an approved retained export, never a live DB URL. */
export function evaluateTweetClaimFile(path: string, asOf = new Date().toISOString()) {
  return evaluateForwardTweetClaimExport(JSON.parse(readFileSync(path, "utf8")) as TweetClaimEvaluationExport, asOf);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--input") throw new Error("Usage: evaluate-tweet-claims.ts --input <retained-evaluation-export.json>");
  process.stdout.write(`${JSON.stringify(evaluateTweetClaimFile(args[1]!), null, 2)}\n`);
}
