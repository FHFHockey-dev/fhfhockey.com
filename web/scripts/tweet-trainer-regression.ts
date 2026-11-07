// Replays the current tweet parser over every tweet TJ labelled in the swipe trainer and reports per-type accuracy
// plus newly fixed and newly broken cases. Read-only: it never writes to the database.
//
//   NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
//     scripts/tweet-trainer-regression.ts [--baseline=path.json] [--output=path.json] [--type=line_combination]
//
// --legacy scores the legacy parse path instead of production's interpretation path.
// --output writes this run's results; pass that file as --baseline next time to see what a parser change fixed or broke.
// Without a baseline, each case is compared with the parser's verdict when TJ labelled it.
import { loadEnvConfig } from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";

import type { TweetAnswerKeyRecord } from "../lib/sources/tweetSwipeTrainer";

loadEnvConfig(process.cwd());
// Production parses with the interpretation path on; score that path unless --legacy is passed.
if (!process.argv.includes("--legacy")) process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED = "true";
const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

async function fetchAnswerKey(
  supabase: any,
  readAnswerKeyRecord: (metadata: unknown) => TweetAnswerKeyRecord | null
): Promise<Array<{ id: string; record: TweetAnswerKeyRecord }>> {
  const entries: Array<{ id: string; record: TweetAnswerKeyRecord }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("tweet_pattern_review_items")
      .select("id, metadata")
      .not("metadata->answerKey", "is", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    for (const row of data ?? []) {
      const record = readAnswerKeyRecord(row.metadata);
      if (record) entries.push({ id: row.id, record });
    }
    if ((data ?? []).length < 1000) return entries;
  }
}

async function main() {
  // Imported after the env is loaded: these modules create Supabase clients when they load.
  const { getServiceRoleClient } = await import("../lib/supabase/server");
  const { readAnswerKeyRecord, replayAnswerKey } = await import("../lib/sources/tweetSwipeTrainer");
  const { loadTrainerContext } = await import("../lib/sources/tweetSwipeTrainerServer");
  const supabase = getServiceRoleClient();
  const type = argument("type");
  const baselinePath = argument("baseline");
  const baseline = baselinePath ? (JSON.parse(readFileSync(baselinePath, "utf8")).results as Record<string, boolean>) : null;
  const entries = (await fetchAnswerKey(supabase, readAnswerKeyRecord)).filter((entry) => !type || entry.record.expected.type === type);
  const { results, summary } = await replayAnswerKey({
    entries,
    baseline,
    contextFor: (record) => loadTrainerContext(supabase, record.input.publishedAt)
  });

  console.log(`Answer key: ${summary.total} labelled tweets, ${summary.correct} correct (${summary.accuracy}%).`);
  console.log(`Parse path: ${process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED === "true" ? "interpretation (production)" : "legacy"}`);
  console.log(`Baseline: ${baselinePath ?? "parser verdict at label time"}`);
  for (const entry of summary.byType) console.log(`  ${entry.type.padEnd(18)} ${entry.correct}/${entry.total}  ${entry.accuracy}%`);
  // Answer-key v2 fields (context, scope, game binding, PP swaps), scored only on v2 records.
  if (summary.byField.length) {
    console.log("v2 fields:");
    for (const entry of summary.byField) console.log(`  ${entry.field.padEnd(18)} ${entry.correct}/${entry.total}  ${entry.accuracy}%`);
  }
  const describe = (id: string) => {
    const result = results.find((item) => item.id === id)!;
    // false = differs; null = not judged (a v1 record has no v2 fields).
    const misses = Object.entries(result.comparison).filter(([key, value]) => key !== "correct" && value === false).map(([key]) => key);
    return `  ${id} tweet ${result.tweetId ?? "?"} (${result.type})${misses.length ? ` · differs in ${misses.join(", ")}` : ""}`;
  };
  console.log(`Newly fixed: ${summary.newlyFixed.length}`);
  summary.newlyFixed.forEach((id) => console.log(describe(id)));
  console.log(`Newly broken: ${summary.newlyBroken.length}`);
  summary.newlyBroken.forEach((id) => console.log(describe(id)));

  const output = argument("output");
  if (output) {
    writeFileSync(output, JSON.stringify({
      generatedAt: new Date().toISOString(),
      summary,
      results: Object.fromEntries(results.map((result) => [result.id, result.correct])),
      failures: results.filter((result) => !result.correct).map(({ id, tweetId, type, comparison, expected, actual }) => ({ id, tweetId, type, comparison, expected, actual }))
    }, null, 2));
    console.log(`Wrote ${output}`);
  }
  if (summary.newlyBroken.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
