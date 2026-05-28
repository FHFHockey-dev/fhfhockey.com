import fs from "fs";
import path from "path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  buildTweetNewsAmbiguousCandidate,
  buildTweetNewsAutomationCandidate,
  type TweetNewsAutomationPlayer,
  type TweetNewsAutomationReviewRow,
} from "lib/sources/tweetNewsAutomation";
import { tweetNewsPhraseDictionary } from "lib/sources/tweetNewsPhraseDictionary";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type SourceTable =
  | "tweet_pattern_review_items"
  | "line_source_snapshots"
  | "lines_ccc"
  | "line_source_ifttt_events"
  | "lines_ccc_ifttt_events";

type TweetCorpusRecord = {
  corpusId: string;
  sourceTable: SourceTable;
  sourceRowKey: string;
  sourceGroup: string | null;
  sourceKey: string | null;
  sourceAccount: string | null;
  authorName: string | null;
  sourceHandle: string | null;
  tweetId: string | null;
  tweetUrl: string | null;
  sourceUrl: string | null;
  quotedTweetId: string | null;
  quotedTweetUrl: string | null;
  teamAbbreviation: string | null;
  parserClassification: string | null;
  parserFilterStatus: string | null;
  parserFilterReason: string | null;
  reviewStatus: string | null;
  reviewedCategory: string | null;
  reviewedSubcategory: string | null;
  keywordHits: string[];
  observedAt: string | null;
  createdAt: string | null;
  primaryText: string;
  rawText: string | null;
  enrichedText: string | null;
  quotedText: string | null;
};

type PhraseRule = {
  category: string;
  subcategory: string | null;
  phrase: string;
  pattern: RegExp;
  confidence: "auto" | "review" | "support";
};

type PhraseHit = {
  phrase: string;
  category: string;
  subcategory: string | null;
  confidence: PhraseRule["confidence"];
  count: number;
  reviewedMatches: number;
  acceptedParserMatches: number;
  sourceAccounts: string[];
  parserClassifications: string[];
  examples: Array<{
    corpusId: string;
    sourceTable: SourceTable;
    sourceAccount: string | null;
    tweetId: string | null;
    teamAbbreviation: string | null;
    parserClassification: string | null;
    reviewedCategory: string | null;
    text: string;
    url: string | null;
  }>;
};

const PAGE_SIZE = 1000;
const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "scripts/output/tweet-news-phrase-audit",
);

const STOPWORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "he",
  "his",
  "in",
  "into",
  "is",
  "it",
  "its",
  "not",
  "of",
  "on",
  "or",
  "per",
  "that",
  "the",
  "their",
  "this",
  "to",
  "today",
  "tonight",
  "vs",
  "was",
  "were",
  "will",
  "with",
]);

const PHRASE_RULES: PhraseRule[] = tweetNewsPhraseDictionary.flatMap((rule) =>
  rule.regexes.map((regex, index) => ({
    category: rule.category,
    subcategory: rule.subcategory,
    phrase: rule.phrases[index] ?? rule.phrases[0] ?? rule.id,
    pattern: new RegExp(regex, "i"),
    confidence: rule.confidence,
  })),
);

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in web/.env.local",
    );
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

async function fetchAllRows<T extends Record<string, unknown>>(args: {
  supabase: any;
  table: SourceTable;
  select: string;
  orderColumn: string;
}): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await args.supabase
      .from(args.table as never)
      .select(args.select)
      .order(args.orderColumn, { ascending: false, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${args.table}: ${error.message}`);

    rows.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }

  return rows;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

async function fetchPlayers(args: {
  supabase: any;
}): Promise<TweetNewsAutomationPlayer[]> {
  const { data, error } = await args.supabase
    .from("players" as never)
    .select("id, fullName, position, team_id")
    .not("fullName", "is", null);
  if (error) throw new Error(`players: ${error.message}`);

  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => ({
      id: Number(row.id),
      fullName: asString(row.fullName) ?? "",
      position: asString(row.position),
      team_id: asNumber(row.team_id),
    }))
    .filter((row) => Number.isFinite(row.id) && row.fullName);
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/pic\.twitter\.com\/\S+/gi, " ")
    .replace(/[@#][A-Za-z0-9_]+/g, " ")
    .replace(/[’']/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function displaySnippet(value: string): string {
  const normalized = normalizeText(value);
  return normalized.length > 220
    ? `${normalized.slice(0, 217)}...`
    : normalized;
}

function tokenizedText(value: string): string[] {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9.' -]+/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^'+|'+$/g, ""))
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function ngrams(tokens: string[], min = 2, max = 5): string[] {
  const phrases: string[] = [];
  for (let size = min; size <= max; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      phrases.push(tokens.slice(index, index + size).join(" "));
    }
  }
  return phrases;
}

function choosePrimaryText(row: Record<string, unknown>): string {
  return (
    asString(row.review_text) ??
    asString(row.quoted_enriched_text) ??
    asString(row.quoted_text) ??
    asString(row.enriched_text) ??
    asString(row.quoted_raw_text) ??
    asString(row.raw_text) ??
    asString(row.text) ??
    ""
  );
}

function toCorpusRecord(
  sourceTable: SourceTable,
  row: Record<string, unknown>,
): TweetCorpusRecord {
  const sourceRowKey =
    asString(row.id) ??
    asString(row.capture_key) ??
    asString(row.source_row_key) ??
    "unknown";
  const quotedText =
    asString(row.quoted_text) ??
    asString(row.quoted_enriched_text) ??
    asString(row.quoted_raw_text);

  return {
    corpusId: `${sourceTable}:${sourceRowKey}`,
    sourceTable,
    sourceRowKey,
    sourceGroup: asString(row.source_group),
    sourceKey: asString(row.source_key),
    sourceAccount: asString(row.source_account),
    authorName: asString(row.author_name) ?? asString(row.username),
    sourceHandle: asString(row.source_handle) ?? asString(row.username),
    tweetId: asString(row.tweet_id),
    tweetUrl: asString(row.tweet_url) ?? asString(row.link_to_tweet),
    sourceUrl: asString(row.source_url) ?? asString(row.link_to_tweet),
    quotedTweetId: asString(row.quoted_tweet_id),
    quotedTweetUrl: asString(row.quoted_tweet_url),
    teamAbbreviation: asString(row.team_abbreviation),
    parserClassification:
      asString(row.parser_classification) ?? asString(row.classification),
    parserFilterStatus:
      asString(row.parser_filter_status) ?? asString(row.nhl_filter_status),
    parserFilterReason:
      asString(row.parser_filter_reason) ?? asString(row.nhl_filter_reason),
    reviewStatus: asString(row.review_status),
    reviewedCategory: asString(row.reviewed_category),
    reviewedSubcategory: asString(row.reviewed_subcategory),
    keywordHits: asStringArray(row.keyword_hits),
    observedAt:
      asString(row.source_created_at) ??
      asString(row.observed_at) ??
      asString(row.received_at) ??
      asString(row.tweet_created_at),
    createdAt: asString(row.created_at),
    primaryText: choosePrimaryText(row),
    rawText: asString(row.raw_text) ?? asString(row.text),
    enrichedText: asString(row.enriched_text),
    quotedText,
  };
}

function toAutomationReviewRow(
  row: Record<string, unknown>,
): TweetNewsAutomationReviewRow {
  return {
    id: asString(row.id) ?? "unknown",
    source_account: asString(row.source_account),
    source_label: asString(row.source_label),
    source_handle: asString(row.source_handle),
    author_name: asString(row.author_name),
    source_created_at: asString(row.source_created_at),
    tweet_id: asString(row.tweet_id),
    tweet_url: asString(row.tweet_url),
    source_url: asString(row.source_url),
    team_id: asNumber(row.team_id),
    team_abbreviation: asString(row.team_abbreviation),
    parser_classification: asString(row.parser_classification),
    parser_filter_status: asString(row.parser_filter_status),
    parser_filter_reason: asString(row.parser_filter_reason),
    review_text: asString(row.review_text),
    raw_text: asString(row.raw_text),
    enriched_text: asString(row.enriched_text),
    quoted_text: asString(row.quoted_text),
    review_status:
      asString(row.review_status) === "reviewed" ||
      asString(row.review_status) === "ignored"
        ? (asString(row.review_status) as "reviewed" | "ignored")
        : "pending",
    reviewed_category: asString(row.reviewed_category),
    reviewed_subcategory: asString(row.reviewed_subcategory),
    selected_highlights: asStringArray(row.selected_highlights),
    review_assignments: Array.isArray(row.review_assignments)
      ? (row.review_assignments as TweetNewsAutomationReviewRow["review_assignments"])
      : null,
    notes: asString(row.notes),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null,
  };
}

function dedupeForAnalysis(records: TweetCorpusRecord[]): TweetCorpusRecord[] {
  const bestByKey = new Map<string, TweetCorpusRecord>();

  for (const record of records) {
    const textKey = normalizeText(record.primaryText).toLowerCase();
    if (!textKey) continue;
    const key =
      record.quotedTweetId ??
      record.tweetId ??
      `${record.sourceAccount ?? ""}:${textKey}`;
    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, record);
      continue;
    }

    const existingScore =
      Number(existing.sourceTable === "tweet_pattern_review_items") * 8 +
      Number(existing.reviewStatus === "reviewed") * 4 +
      Number(Boolean(existing.parserClassification)) * 2 +
      Number(Boolean(existing.teamAbbreviation));
    const candidateScore =
      Number(record.sourceTable === "tweet_pattern_review_items") * 8 +
      Number(record.reviewStatus === "reviewed") * 4 +
      Number(Boolean(record.parserClassification)) * 2 +
      Number(Boolean(record.teamAbbreviation));
    if (candidateScore > existingScore) {
      bestByKey.set(key, record);
    }
  }

  return Array.from(bestByKey.values());
}

function incrementMap(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function addSetValue(
  map: Map<string, Set<string>>,
  key: string,
  value: string | null,
): void {
  if (!value) return;
  const set = map.get(key) ?? new Set<string>();
  set.add(value);
  map.set(key, set);
}

function buildPhraseHits(records: TweetCorpusRecord[]): PhraseHit[] {
  const hits = new Map<string, PhraseHit>();

  for (const record of records) {
    const text = record.primaryText;
    if (!text.trim()) continue;

    for (const rule of PHRASE_RULES) {
      if (!rule.pattern.test(text)) continue;
      const key = `${rule.category}\u0000${rule.subcategory ?? ""}\u0000${rule.phrase}`;
      const hit = hits.get(key) ?? {
        phrase: rule.phrase,
        category: rule.category,
        subcategory: rule.subcategory,
        confidence: rule.confidence,
        count: 0,
        reviewedMatches: 0,
        acceptedParserMatches: 0,
        sourceAccounts: [],
        parserClassifications: [],
        examples: [],
      };

      hit.count += 1;
      if (record.reviewStatus === "reviewed") hit.reviewedMatches += 1;
      if (record.parserFilterStatus === "accepted")
        hit.acceptedParserMatches += 1;
      hit.sourceAccounts = Array.from(
        new Set(
          [...hit.sourceAccounts, record.sourceAccount].filter(
            Boolean,
          ) as string[],
        ),
      ).sort();
      hit.parserClassifications = Array.from(
        new Set(
          [...hit.parserClassifications, record.parserClassification].filter(
            Boolean,
          ) as string[],
        ),
      ).sort();
      if (hit.examples.length < 5) {
        hit.examples.push({
          corpusId: record.corpusId,
          sourceTable: record.sourceTable,
          sourceAccount: record.sourceAccount,
          tweetId: record.tweetId,
          teamAbbreviation: record.teamAbbreviation,
          parserClassification: record.parserClassification,
          reviewedCategory: record.reviewedCategory,
          text: displaySnippet(text),
          url: record.sourceUrl ?? record.tweetUrl,
        });
      }
      hits.set(key, hit);
    }
  }

  return Array.from(hits.values()).sort(
    (left, right) =>
      right.count - left.count ||
      left.category.localeCompare(right.category) ||
      left.phrase.localeCompare(right.phrase),
  );
}

function buildCommonNgrams(records: TweetCorpusRecord[]) {
  const counts = new Map<string, number>();
  const sourceAccounts = new Map<string, Set<string>>();
  const examples = new Map<
    string,
    Array<{
      corpusId: string;
      sourceAccount: string | null;
      text: string;
      url: string | null;
    }>
  >();

  for (const record of records) {
    const tokens = tokenizedText(record.primaryText);
    const uniquePhrases = new Set(
      ngrams(tokens).filter((phrase) => {
        const words = phrase.split(" ");
        return (
          words.length >= 2 &&
          !words.every((word) => /^\d+$/.test(word)) &&
          words.some((word) => word.length >= 4)
        );
      }),
    );

    for (const phrase of uniquePhrases) {
      incrementMap(counts, phrase);
      addSetValue(sourceAccounts, phrase, record.sourceAccount);
      const phraseExamples = examples.get(phrase) ?? [];
      if (phraseExamples.length < 3) {
        phraseExamples.push({
          corpusId: record.corpusId,
          sourceAccount: record.sourceAccount,
          text: displaySnippet(record.primaryText),
          url: record.sourceUrl ?? record.tweetUrl,
        });
      }
      examples.set(phrase, phraseExamples);
    }
  }

  return Array.from(counts.entries())
    .map(([phrase, count]) => ({
      phrase,
      count,
      sourceAccounts: Array.from(sourceAccounts.get(phrase) ?? []).sort(),
      examples: examples.get(phrase) ?? [],
    }))
    .filter((item) => item.count >= 3)
    .sort(
      (left, right) =>
        right.count - left.count || left.phrase.localeCompare(right.phrase),
    )
    .slice(0, 250);
}

function summarizeRecords(records: TweetCorpusRecord[]) {
  const bySourceTable = new Map<string, number>();
  const bySourceAccount = new Map<string, number>();
  const byParserClassification = new Map<string, number>();
  const byParserFilterStatus = new Map<string, number>();
  const byReviewStatus = new Map<string, number>();

  for (const record of records) {
    incrementMap(bySourceTable, record.sourceTable);
    incrementMap(bySourceAccount, record.sourceAccount ?? "unknown");
    incrementMap(
      byParserClassification,
      record.parserClassification ?? "unknown",
    );
    incrementMap(byParserFilterStatus, record.parserFilterStatus ?? "unknown");
    incrementMap(byReviewStatus, record.reviewStatus ?? "unknown");
  }

  const toSortedObject = (map: Map<string, number>) =>
    Object.fromEntries(
      Array.from(map.entries()).sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      ),
    );

  return {
    totalRecords: records.length,
    bySourceTable: toSortedObject(bySourceTable),
    bySourceAccount: toSortedObject(bySourceAccount),
    byParserClassification: toSortedObject(byParserClassification),
    byParserFilterStatus: toSortedObject(byParserFilterStatus),
    byReviewStatus: toSortedObject(byReviewStatus),
  };
}

function getAutomationMetadata(
  metadata: Record<string, unknown> | null,
): Record<string, unknown> | null {
  const automation = metadata?.automation;
  return automation && typeof automation === "object"
    ? (automation as Record<string, unknown>)
    : null;
}

function buildReviewQueueAutomationSummary(args: {
  reviewRows: Record<string, unknown>[];
  players: TweetNewsAutomationPlayer[];
  generatedAt: string;
}) {
  const counts = new Map<string, number>();
  const samples: Array<{
    reviewItemId: string;
    sourceAccount: string | null;
    teamAbbreviation: string | null;
    status: string;
    category: string;
    subcategory: string | null;
    ambiguityReason: unknown;
    headline: string;
  }> = [];

  for (const sourceRow of args.reviewRows) {
    const row = toAutomationReviewRow(sourceRow);
    const candidate =
      buildTweetNewsAutomationCandidate({
        row,
        players: args.players,
        nowIso: args.generatedAt,
      }) ??
      buildTweetNewsAmbiguousCandidate({
        row,
        players: args.players,
        nowIso: args.generatedAt,
      });
    const key = candidate
      ? `${candidate.cardStatus}:${candidate.category}:${candidate.subcategory ?? ""}`
      : "none";
    incrementMap(counts, key);

    if (candidate && samples.length < 20) {
      samples.push({
        reviewItemId: candidate.reviewItemId,
        sourceAccount: candidate.sourceAccount,
        teamAbbreviation: candidate.teamAbbreviation,
        status: candidate.cardStatus,
        category: candidate.category,
        subcategory: candidate.subcategory,
        ambiguityReason:
          getAutomationMetadata(candidate.metadata)?.ambiguityReason ?? null,
        headline: candidate.headline,
      });
    }
  }

  const countEntries = Array.from(counts.entries());
  return {
    rowsAnalyzed: args.reviewRows.length,
    candidates: countEntries.reduce(
      (sum, [key, count]) => (key === "none" ? sum : sum + count),
      0,
    ),
    autoPublishCandidates: countEntries.reduce(
      (sum, [key, count]) =>
        key.startsWith("published:") ? sum + count : sum,
      0,
    ),
    ambiguousCandidates: countEntries.reduce(
      (sum, [key, count]) =>
        key.includes(":OTHER:AMBIGUOUS") ? sum + count : sum,
      0,
    ),
    byOutcome: Object.fromEntries(
      countEntries.sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      ),
    ),
    samples,
  };
}

async function main() {
  const supabase = getSupabaseClient();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const [
    reviewRows,
    lineSourceSnapshotRows,
    linesCccRows,
    lineSourceEventRows,
    linesCccEventRows,
    players,
  ] = await Promise.all([
    fetchAllRows<Record<string, unknown>>({
      supabase,
      table: "tweet_pattern_review_items",
      orderColumn: "created_at",
      select:
        "id, source_table, source_row_key, source_group, source_key, source_account, source_label, source_handle, author_name, source_created_at, tweet_id, tweet_url, source_url, quoted_tweet_id, quoted_tweet_url, team_id, team_abbreviation, parser_classification, parser_filter_status, parser_filter_reason, keyword_hits, review_text, raw_text, enriched_text, quoted_text, review_status, reviewed_category, reviewed_subcategory, selected_highlights, review_assignments, notes, metadata, created_at",
    }),
    fetchAllRows<Record<string, unknown>>({
      supabase,
      table: "line_source_snapshots",
      orderColumn: "observed_at",
      select:
        "capture_key, source_group, source_key, source_account, observed_at, tweet_id, tweet_url, source_url, quoted_tweet_id, quoted_tweet_url, team_abbreviation, classification, nhl_filter_status, nhl_filter_reason, keyword_hits, raw_text, enriched_text, quoted_raw_text, quoted_enriched_text, source_handle, author_name",
    }),
    fetchAllRows<Record<string, unknown>>({
      supabase,
      table: "lines_ccc",
      orderColumn: "observed_at",
      select:
        "capture_key, observed_at, tweet_id, tweet_url, source_url, quoted_tweet_id, quoted_tweet_url, team_abbreviation, classification, nhl_filter_status, nhl_filter_reason, keyword_hits, raw_text, enriched_text, quoted_raw_text, quoted_enriched_text, source_handle, author_name",
    }),
    fetchAllRows<Record<string, unknown>>({
      supabase,
      table: "line_source_ifttt_events",
      orderColumn: "received_at",
      select:
        "id, source_group, source_key, source_account, username, text, link_to_tweet, tweet_id, tweet_created_at, created_at_label, processing_status, received_at",
    }),
    fetchAllRows<Record<string, unknown>>({
      supabase,
      table: "lines_ccc_ifttt_events",
      orderColumn: "received_at",
      select:
        "id, source_account, username, text, link_to_tweet, tweet_id, tweet_created_at, created_at_label, processing_status, received_at",
    }),
    fetchPlayers({ supabase }),
  ]);

  const records = [
    ...reviewRows.map((row) =>
      toCorpusRecord("tweet_pattern_review_items", row),
    ),
    ...lineSourceSnapshotRows.map((row) =>
      toCorpusRecord("line_source_snapshots", row),
    ),
    ...linesCccRows.map((row) =>
      toCorpusRecord("lines_ccc", {
        ...row,
        source_group: "ccc",
        source_key: "cccmiddleton",
        source_account: "CcCMiddleton",
      }),
    ),
    ...lineSourceEventRows.map((row) =>
      toCorpusRecord("line_source_ifttt_events", row),
    ),
    ...linesCccEventRows.map((row) =>
      toCorpusRecord("lines_ccc_ifttt_events", {
        ...row,
        source_group: "ccc",
        source_key: "cccmiddleton",
      }),
    ),
  ].filter((record) => record.primaryText.trim());

  const dedupedRecords = dedupeForAnalysis(records);
  const generatedAt = new Date().toISOString();
  const corpus = {
    generatedAt,
    sourceTables: {
      tweet_pattern_review_items: reviewRows.length,
      line_source_snapshots: lineSourceSnapshotRows.length,
      lines_ccc: linesCccRows.length,
      line_source_ifttt_events: lineSourceEventRows.length,
      lines_ccc_ifttt_events: linesCccEventRows.length,
    },
    records,
  };
  const analysis = {
    generatedAt,
    summary: {
      raw: summarizeRecords(records),
      deduped: summarizeRecords(dedupedRecords),
    },
    reviewQueueAutomation: buildReviewQueueAutomationSummary({
      reviewRows,
      players,
      generatedAt,
    }),
    phraseHits: buildPhraseHits(dedupedRecords),
    commonNgrams: buildCommonNgrams(dedupedRecords),
    draftDictionary: tweetNewsPhraseDictionary,
  };

  const corpusPath = path.join(OUTPUT_DIR, "tweet-corpus.json");
  const analysisPath = path.join(OUTPUT_DIR, "phrase-analysis.json");
  fs.writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`);
  fs.writeFileSync(analysisPath, `${JSON.stringify(analysis, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        generatedAt,
        corpusPath,
        analysisPath,
        rawRecords: records.length,
        dedupedRecords: dedupedRecords.length,
        phraseHits: analysis.phraseHits.length,
        commonNgrams: analysis.commonNgrams.length,
        reviewQueueAutomation: analysis.reviewQueueAutomation,
        topPhraseHits: analysis.phraseHits.slice(0, 12).map((hit) => ({
          phrase: hit.phrase,
          category: hit.category,
          subcategory: hit.subcategory,
          count: hit.count,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
