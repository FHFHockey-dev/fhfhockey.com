import type { NextApiResponse } from "next";

import { getCurrentSeason } from "lib/NHL/server";
import {
  buildTweetPatternReviewExportSummary,
  buildTweetPatternReviewDedupeKey,
  buildTweetPatternReviewText,
  normalizePatternEvidencePhrase,
  normalizePatternReviewAssignments,
  type TweetPatternReviewAssignment,
  TWEET_PATTERN_CATEGORY_OPTIONS
} from "lib/sources/tweetPatternReview";
import { fetchLinesCccTweetOEmbedAttempt } from "lib/sources/linesCccIngestion";
import adminOnly from "utils/adminOnlyMiddleware";

type ReviewStatus = "pending" | "reviewed" | "ignored";
type PlayerOption = {
  id: number;
  fullName: string;
  lastName: string;
  position: string | null;
  team_id: number | null;
};

function normalizeResolvedHandle(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

type TweetPatternReviewRow = {
  id: string;
  dedupe_key: string;
  source_table: string;
  source_row_key: string;
  source_group: string | null;
  source_key: string | null;
  source_account: string | null;
  source_label: string | null;
  source_handle: string | null;
  author_name: string | null;
  snapshot_date: string | null;
  source_created_at: string | null;
  tweet_id: string | null;
  tweet_url: string | null;
  source_url: string | null;
  quoted_tweet_id: string | null;
  quoted_tweet_url: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  parser_classification: string | null;
  parser_filter_status: string | null;
  parser_filter_reason: string | null;
  keyword_hits: string[] | null;
  review_text: string | null;
  raw_text: string | null;
  enriched_text: string | null;
  quoted_text: string | null;
  review_status: ReviewStatus;
  reviewed_category: string | null;
  reviewed_subcategory: string | null;
  selected_highlights: string[] | null;
  review_assignments: TweetPatternReviewAssignment[] | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SyncCandidate = Omit<TweetPatternReviewRow, "id" | "created_at" | "updated_at"> & {
  source_priority: number;
};

type ExistingReviewRow = Pick<
  TweetPatternReviewRow,
  | "id"
  | "dedupe_key"
  | "review_status"
  | "reviewed_category"
  | "reviewed_subcategory"
  | "selected_highlights"
  | "review_assignments"
  | "notes"
  | "metadata"
  | "reviewed_at"
>;

type LinesCccReviewSourceRow = {
  capture_key: string;
  source: string | null;
  source_label: string | null;
  source_handle: string | null;
  author_name: string | null;
  snapshot_date: string | null;
  observed_at: string | null;
  tweet_id: string | null;
  tweet_url: string | null;
  source_url: string | null;
  quoted_tweet_id: string | null;
  quoted_tweet_url: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  classification: string | null;
  nhl_filter_status: string | null;
  nhl_filter_reason: string | null;
  keyword_hits: string[] | null;
  raw_text: string | null;
  enriched_text: string | null;
  quoted_raw_text: string | null;
  quoted_enriched_text: string | null;
  raw_payload: Record<string, unknown> | null;
  primary_text_source: string | null;
  tweet_posted_label: string | null;
  status: string | null;
};

type LineSourceSnapshotReviewSourceRow = {
  capture_key: string;
  source_group: string | null;
  source_key: string | null;
  source_account: string | null;
  source: string | null;
  source_label: string | null;
  source_handle: string | null;
  author_name: string | null;
  snapshot_date: string | null;
  observed_at: string | null;
  tweet_id: string | null;
  tweet_url: string | null;
  source_url: string | null;
  quoted_tweet_id: string | null;
  quoted_tweet_url: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  classification: string | null;
  nhl_filter_status: string | null;
  nhl_filter_reason: string | null;
  keyword_hits: string[] | null;
  raw_text: string | null;
  enriched_text: string | null;
  quoted_raw_text: string | null;
  quoted_enriched_text: string | null;
  raw_payload: Record<string, unknown> | null;
  primary_text_source: string | null;
  tweet_posted_label: string | null;
  status: string | null;
};

type LinesCccEventReviewSourceRow = {
  id: string;
  source: string | null;
  source_account: string | null;
  username: string | null;
  text: string | null;
  link_to_tweet: string | null;
  tweet_id: string | null;
  tweet_created_at: string | null;
  created_at_label: string | null;
  processing_status: string | null;
  received_at: string | null;
  raw_payload: Record<string, unknown> | null;
};

type LineSourceEventReviewSourceRow = {
  id: string;
  source: string | null;
  source_group: string | null;
  source_key: string | null;
  source_account: string | null;
  username: string | null;
  text: string | null;
  link_to_tweet: string | null;
  tweet_id: string | null;
  tweet_created_at: string | null;
  created_at_label: string | null;
  processing_status: string | null;
  received_at: string | null;
  raw_payload: Record<string, unknown> | null;
};

function parseLimit(value: string | string[] | undefined, fallback = 100): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : fallback;
}

function parseStatus(value: string | string[] | undefined): ReviewStatus | "all" {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (rawValue === "reviewed" || rawValue === "ignored" || rawValue === "all") {
    return rawValue;
  }
  return "pending";
}

function parseString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseHighlights(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => normalizePatternEvidencePhrase(typeof item === "string" ? item : ""))
        .filter(Boolean)
    )
  );
}

function parseAssignmentNotes(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseReviewAssignments(value: unknown): TweetPatternReviewAssignment[] {
  if (!Array.isArray(value)) return [];

  return normalizePatternReviewAssignments({
    assignments: value
      .map((assignment) => {
        if (!assignment || typeof assignment !== "object") return null;
        const record = assignment as Record<string, unknown>;
        return {
          id: typeof record.id === "string" ? record.id : null,
          category: parseString(record.category) ?? "",
          subcategory: parseString(record.subcategory),
          playerIds: Array.isArray(record.playerIds) ? record.playerIds : [],
          playerNames: Array.isArray(record.playerNames) ? record.playerNames : [],
          highlightPhrases: parseHighlights(record.highlightPhrases),
          notes: parseAssignmentNotes(record.notes)
        };
      })
      .filter(Boolean)
  });
}

async function fetchRosterPlayers(supabase: any): Promise<PlayerOption[]> {
  const currentSeason = await getCurrentSeason();
  const { data: rosterRows, error: rosterError } = await supabase
    .from("rosters")
    .select("teamId, players!inner(id, fullName, lastName, position)")
    .eq("seasonId", currentSeason.seasonId)
    .eq("is_current", true);
  if (rosterError) throw rosterError;

  return (rosterRows ?? [])
    .map((row: any): PlayerOption | null => {
      const player = row.players;
      if (!player) return null;
      return {
        id: Number(player.id),
        fullName: String(player.fullName ?? ""),
        lastName: String(player.lastName ?? ""),
        position: player.position ?? null,
        team_id: Number(row.teamId)
      };
    })
    .filter((player: PlayerOption | null): player is PlayerOption => Boolean(player))
    .sort((left: PlayerOption, right: PlayerOption) =>
      left.fullName.localeCompare(right.fullName)
    );
}

function toMillis(value: string | null | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function readNestedString(
  value: Record<string, unknown> | null | undefined,
  path: string[]
): string | null {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function parseHandleFromTweetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (!hostname.includes("twitter.com") && !hostname.includes("x.com")) {
      return null;
    }
    const handle = url.pathname.split("/").filter(Boolean)[0] ?? null;
    return handle?.trim() || null;
  } catch {
    return null;
  }
}

function chooseLongestText(...values: Array<string | null | undefined>): string | null {
  return values
    .map((value) => (typeof value === "string" && value.trim() ? value : null))
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.length - left.length)[0] ?? null;
}

function extractFallbackAuthor(args: {
  authorName?: string | null;
  sourceHandle?: string | null;
  username?: string | null;
  sourceUrl?: string | null;
  tweetUrl?: string | null;
  rawPayload?: Record<string, unknown> | null;
}) {
  const urlHandle =
    parseHandleFromTweetUrl(args.sourceUrl) ??
    parseHandleFromTweetUrl(args.tweetUrl);
  return {
    authorName:
      readNestedString(args.rawPayload, ["linesCccOembed", "wrapper", "authorName"]) ??
      readNestedString(args.rawPayload, ["author_name"]) ??
      readNestedString(args.rawPayload, ["authorName"]) ??
      readNestedString(args.rawPayload, ["AuthorName"]) ??
      args.authorName ??
      urlHandle ??
      null,
    sourceHandle:
      urlHandle ??
      readNestedString(args.rawPayload, ["linesCccOembed", "wrapper", "authorHandle"]) ??
      readNestedString(args.rawPayload, ["username"]) ??
      readNestedString(args.rawPayload, ["UserName"]) ??
      readNestedString(args.rawPayload, ["screen_name"]) ??
      args.sourceHandle ??
      args.username ??
      null,
  };
}

function extractFallbackReviewText(args: {
  reviewText?: string | null;
  rawText?: string | null;
  enrichedText?: string | null;
  quotedText?: string | null;
  rawPayload?: Record<string, unknown> | null;
}) {
  return chooseLongestText(
    args.reviewText,
    args.quotedText,
    readNestedString(args.rawPayload, ["linesCccOembed", "wrapper", "text"]),
    readNestedString(args.rawPayload, ["text"]),
    readNestedString(args.rawPayload, ["Text"]),
    args.enrichedText,
    args.rawText
  );
}

function buildLinesCccCandidate(row: LinesCccReviewSourceRow): SyncCandidate {
  const fallbackAuthor = extractFallbackAuthor({
    authorName: row.author_name,
    sourceHandle: row.source_handle,
    sourceUrl: row.source_url,
    tweetUrl: row.tweet_url,
    rawPayload: row.raw_payload,
  });
  const reviewText = buildTweetPatternReviewText({
    rawText: row.raw_text,
    enrichedText: row.enriched_text,
    quotedRawText: row.quoted_raw_text,
    quotedEnrichedText: row.quoted_enriched_text
  });
  return {
    dedupe_key: buildTweetPatternReviewDedupeKey({
      sourceKey: "cccmiddleton",
      sourceAccount: row.source_handle ?? row.source ?? "CcCMiddleton",
      tweetId: row.tweet_id,
      tweetUrl: row.tweet_url ?? row.source_url,
      sourceRowKey: row.capture_key
    }),
    source_table: "lines_ccc",
    source_row_key: row.capture_key,
    source_group: "ccc",
    source_key: "cccmiddleton",
    source_account: "CcCMiddleton",
    source_label: row.source_label ?? row.source,
    source_handle: fallbackAuthor.sourceHandle,
    author_name: fallbackAuthor.authorName,
    snapshot_date: row.snapshot_date,
    source_created_at: row.observed_at,
    tweet_id: row.tweet_id,
    tweet_url: row.tweet_url,
    source_url: row.source_url,
    quoted_tweet_id: row.quoted_tweet_id,
    quoted_tweet_url: row.quoted_tweet_url,
    team_id: row.team_id,
    team_abbreviation: row.team_abbreviation,
    parser_classification: row.classification,
    parser_filter_status: row.nhl_filter_status,
    parser_filter_reason: row.nhl_filter_reason,
    keyword_hits: row.keyword_hits ?? [],
    review_text: extractFallbackReviewText({
      reviewText,
      rawText: row.raw_text,
      enrichedText: row.enriched_text,
      quotedText: row.quoted_enriched_text ?? row.quoted_raw_text ?? null,
      rawPayload: row.raw_payload,
    }),
    raw_text: row.raw_text,
    enriched_text: row.enriched_text,
    quoted_text: row.quoted_enriched_text ?? row.quoted_raw_text ?? null,
    review_status: "pending",
      reviewed_category: null,
      reviewed_subcategory: null,
      selected_highlights: [],
      review_assignments: [],
      notes: null,
    metadata: {
      primaryTextSource: row.primary_text_source,
      tweetPostedLabel: row.tweet_posted_label,
      sourceRowStatus: row.status
    },
    reviewed_at: null,
    source_priority: 4
  };
}

function buildLineSourceSnapshotCandidate(row: LineSourceSnapshotReviewSourceRow): SyncCandidate {
  const fallbackAuthor = extractFallbackAuthor({
    authorName: row.author_name,
    sourceHandle: row.source_handle,
    sourceUrl: row.source_url,
    tweetUrl: row.tweet_url,
    rawPayload: row.raw_payload,
  });
  const reviewText = buildTweetPatternReviewText({
    rawText: row.raw_text,
    enrichedText: row.enriched_text,
    quotedRawText: row.quoted_raw_text,
    quotedEnrichedText: row.quoted_enriched_text
  });
  return {
    dedupe_key: buildTweetPatternReviewDedupeKey({
      sourceKey: row.source_key ?? row.source_account,
      sourceAccount: row.source_account,
      tweetId: row.tweet_id,
      tweetUrl: row.source_url ?? row.tweet_url,
      sourceRowKey: row.capture_key
    }),
    source_table: "line_source_snapshots",
    source_row_key: row.capture_key,
    source_group: row.source_group,
    source_key: row.source_key,
    source_account: row.source_account,
    source_label: row.source_label ?? row.source,
    source_handle: fallbackAuthor.sourceHandle,
    author_name: fallbackAuthor.authorName,
    snapshot_date: row.snapshot_date,
    source_created_at: row.observed_at,
    tweet_id: row.tweet_id,
    tweet_url: row.tweet_url,
    source_url: row.source_url,
    quoted_tweet_id: row.quoted_tweet_id,
    quoted_tweet_url: row.quoted_tweet_url,
    team_id: row.team_id,
    team_abbreviation: row.team_abbreviation,
    parser_classification: row.classification,
    parser_filter_status: row.nhl_filter_status,
    parser_filter_reason: row.nhl_filter_reason,
    keyword_hits: row.keyword_hits ?? [],
    review_text: extractFallbackReviewText({
      reviewText,
      rawText: row.raw_text,
      enrichedText: row.enriched_text,
      quotedText: row.quoted_enriched_text ?? row.quoted_raw_text ?? null,
      rawPayload: row.raw_payload,
    }),
    raw_text: row.raw_text,
    enriched_text: row.enriched_text,
    quoted_text: row.quoted_enriched_text ?? row.quoted_raw_text ?? null,
    review_status: "pending",
      reviewed_category: null,
      reviewed_subcategory: null,
      selected_highlights: [],
      review_assignments: [],
      notes: null,
    metadata: {
      primaryTextSource: row.primary_text_source,
      tweetPostedLabel: row.tweet_posted_label,
      sourceRowStatus: row.status
    },
    reviewed_at: null,
    source_priority: 4
  };
}

function buildLinesCccEventCandidate(row: LinesCccEventReviewSourceRow): SyncCandidate {
  const fallbackAuthor = extractFallbackAuthor({
    sourceHandle: row.username,
    sourceUrl: row.link_to_tweet,
    tweetUrl: row.link_to_tweet,
    rawPayload: row.raw_payload,
  });
  return {
    dedupe_key: buildTweetPatternReviewDedupeKey({
      sourceKey: "cccmiddleton",
      sourceAccount: row.source_account ?? row.username ?? "CcCMiddleton",
      tweetId: row.tweet_id,
      tweetUrl: row.link_to_tweet,
      sourceRowKey: row.id
    }),
    source_table: "lines_ccc_ifttt_events",
    source_row_key: row.id,
    source_group: "ccc",
    source_key: "cccmiddleton",
    source_account: row.source_account ?? "CcCMiddleton",
    source_label: row.source,
    source_handle: fallbackAuthor.sourceHandle,
    author_name: fallbackAuthor.authorName ?? fallbackAuthor.sourceHandle,
    snapshot_date: null,
    source_created_at: row.tweet_created_at ?? row.received_at,
    tweet_id: row.tweet_id,
    tweet_url: row.link_to_tweet,
    source_url: row.link_to_tweet,
    quoted_tweet_id: null,
    quoted_tweet_url: null,
    team_id: null,
    team_abbreviation: null,
    parser_classification: null,
    parser_filter_status: row.processing_status,
    parser_filter_reason: null,
    keyword_hits: [],
    review_text: extractFallbackReviewText({
      reviewText: row.text ?? null,
      rawText: row.text ?? null,
      enrichedText: row.text ?? null,
      rawPayload: row.raw_payload,
    }),
    raw_text: row.text ?? null,
    enriched_text: row.text ?? null,
    quoted_text: null,
    review_status: "pending",
      reviewed_category: null,
      reviewed_subcategory: null,
      selected_highlights: [],
      review_assignments: [],
      notes: null,
    metadata: {
      createdAtLabel: row.created_at_label,
      sourceProcessingStatus: row.processing_status
    },
    reviewed_at: null,
    source_priority: 1
  };
}

function buildLineSourceEventCandidate(row: LineSourceEventReviewSourceRow): SyncCandidate {
  const fallbackAuthor = extractFallbackAuthor({
    sourceHandle: row.username,
    sourceUrl: row.link_to_tweet,
    tweetUrl: row.link_to_tweet,
    rawPayload: row.raw_payload,
  });
  return {
    dedupe_key: buildTweetPatternReviewDedupeKey({
      sourceKey: row.source_key ?? row.source_account,
      sourceAccount: row.source_account,
      tweetId: row.tweet_id,
      tweetUrl: row.link_to_tweet,
      sourceRowKey: row.id
    }),
    source_table: "line_source_ifttt_events",
    source_row_key: row.id,
    source_group: row.source_group,
    source_key: row.source_key,
    source_account: row.source_account,
    source_label: row.source,
    source_handle: fallbackAuthor.sourceHandle,
    author_name: fallbackAuthor.authorName ?? fallbackAuthor.sourceHandle,
    snapshot_date: null,
    source_created_at: row.tweet_created_at ?? row.received_at,
    tweet_id: row.tweet_id,
    tweet_url: row.link_to_tweet,
    source_url: row.link_to_tweet,
    quoted_tweet_id: null,
    quoted_tweet_url: null,
    team_id: null,
    team_abbreviation: null,
    parser_classification: null,
    parser_filter_status: row.processing_status,
    parser_filter_reason: null,
    keyword_hits: [],
    review_text: extractFallbackReviewText({
      reviewText: row.text ?? null,
      rawText: row.text ?? null,
      enrichedText: row.text ?? null,
      rawPayload: row.raw_payload,
    }),
    raw_text: row.text ?? null,
    enriched_text: row.text ?? null,
    quoted_text: null,
    review_status: "pending",
      reviewed_category: null,
      reviewed_subcategory: null,
      selected_highlights: [],
      review_assignments: [],
      notes: null,
    metadata: {
      createdAtLabel: row.created_at_label,
      sourceProcessingStatus: row.processing_status
    },
    reviewed_at: null,
    source_priority: 1
  };
}

function shouldReplaceCandidate(existing: SyncCandidate, candidate: SyncCandidate): boolean {
  if (candidate.source_priority !== existing.source_priority) {
    return candidate.source_priority > existing.source_priority;
  }
  if (Boolean(candidate.review_text) !== Boolean(existing.review_text)) {
    return Boolean(candidate.review_text);
  }
  if (Boolean(candidate.parser_classification) !== Boolean(existing.parser_classification)) {
    return Boolean(candidate.parser_classification);
  }
  return toMillis(candidate.source_created_at) > toMillis(existing.source_created_at);
}

async function syncTweetPatternReviewItems(args: {
  supabase: any;
  perSourceLimit: number;
}) {
  const [linesCccResult, lineSourceSnapshotResult, linesCccEventResult, lineSourceEventResult] =
    await Promise.all([
      args.supabase
        .from("lines_ccc" as any)
        .select(
          "capture_key, source, source_label, source_handle, author_name, snapshot_date, observed_at, tweet_id, tweet_url, source_url, quoted_tweet_id, quoted_tweet_url, team_id, team_abbreviation, classification, nhl_filter_status, nhl_filter_reason, keyword_hits, raw_text, enriched_text, quoted_raw_text, quoted_enriched_text, raw_payload, primary_text_source, tweet_posted_label, status"
        )
        .order("observed_at", { ascending: false })
        .limit(args.perSourceLimit),
      args.supabase
        .from("line_source_snapshots" as any)
        .select(
          "capture_key, source_group, source_key, source_account, source, source_label, source_handle, author_name, snapshot_date, observed_at, tweet_id, tweet_url, source_url, quoted_tweet_id, quoted_tweet_url, team_id, team_abbreviation, classification, nhl_filter_status, nhl_filter_reason, keyword_hits, raw_text, enriched_text, quoted_raw_text, quoted_enriched_text, raw_payload, primary_text_source, tweet_posted_label, status"
        )
        .order("observed_at", { ascending: false })
        .limit(args.perSourceLimit),
      args.supabase
        .from("lines_ccc_ifttt_events" as any)
        .select(
          "id, source, source_account, username, text, link_to_tweet, tweet_id, tweet_created_at, created_at_label, processing_status, received_at, raw_payload"
        )
        .order("received_at", { ascending: false })
        .limit(args.perSourceLimit),
      args.supabase
        .from("line_source_ifttt_events" as any)
        .select(
          "id, source, source_group, source_key, source_account, username, text, link_to_tweet, tweet_id, tweet_created_at, created_at_label, processing_status, received_at, raw_payload"
        )
        .order("received_at", { ascending: false })
        .limit(args.perSourceLimit)
    ]);

  for (const result of [
    linesCccResult,
    lineSourceSnapshotResult,
    linesCccEventResult,
    lineSourceEventResult
  ]) {
    if (result.error) throw result.error;
  }

  const candidates = new Map<string, SyncCandidate>();
  for (const candidate of [
    ...((linesCccResult.data ?? []) as LinesCccReviewSourceRow[]).map(buildLinesCccCandidate),
    ...((lineSourceSnapshotResult.data ?? []) as LineSourceSnapshotReviewSourceRow[]).map(
      buildLineSourceSnapshotCandidate
    ),
    ...((linesCccEventResult.data ?? []) as LinesCccEventReviewSourceRow[]).map(
      buildLinesCccEventCandidate
    ),
    ...((lineSourceEventResult.data ?? []) as LineSourceEventReviewSourceRow[]).map(
      buildLineSourceEventCandidate
    )
  ]) {
    const existing = candidates.get(candidate.dedupe_key);
    if (!existing || shouldReplaceCandidate(existing, candidate)) {
      candidates.set(candidate.dedupe_key, candidate);
    }
  }

  const dedupeKeys = Array.from(candidates.keys());
  if (dedupeKeys.length === 0) {
    return {
      syncedCount: 0,
      preferredSourceCount: 0
    };
  }

  const { data: existingRows, error: existingError } = await args.supabase
    .from("tweet_pattern_review_items" as any)
    .select(
      "id, dedupe_key, review_status, reviewed_category, reviewed_subcategory, selected_highlights, review_assignments, notes, metadata, reviewed_at"
    )
    .in("dedupe_key", dedupeKeys);
  if (existingError) throw existingError;

  const existingByKey = new Map<string, ExistingReviewRow>(
    ((existingRows ?? []) as ExistingReviewRow[]).map((row) => [row.dedupe_key, row])
  );
  const nowIso = new Date().toISOString();
  const upsertRows = Array.from(candidates.values()).map((candidate) => {
    const existing = existingByKey.get(candidate.dedupe_key);
    return {
      dedupe_key: candidate.dedupe_key,
      source_table: candidate.source_table,
      source_row_key: candidate.source_row_key,
      source_group: candidate.source_group,
      source_key: candidate.source_key,
      source_account: candidate.source_account,
      source_label: candidate.source_label,
      source_handle: candidate.source_handle,
      author_name: candidate.author_name,
      snapshot_date: candidate.snapshot_date,
      source_created_at: candidate.source_created_at,
      tweet_id: candidate.tweet_id,
      tweet_url: candidate.tweet_url,
      source_url: candidate.source_url,
      quoted_tweet_id: candidate.quoted_tweet_id,
      quoted_tweet_url: candidate.quoted_tweet_url,
      team_id: candidate.team_id,
      team_abbreviation: candidate.team_abbreviation,
      parser_classification: candidate.parser_classification,
      parser_filter_status: candidate.parser_filter_status,
      parser_filter_reason: candidate.parser_filter_reason,
      keyword_hits: candidate.keyword_hits ?? [],
      review_text: candidate.review_text,
      raw_text: candidate.raw_text,
      enriched_text: candidate.enriched_text,
      quoted_text: candidate.quoted_text,
      review_status: existing?.review_status ?? "pending",
      reviewed_category: existing?.reviewed_category ?? null,
      reviewed_subcategory: existing?.reviewed_subcategory ?? null,
      selected_highlights: existing?.selected_highlights ?? [],
      review_assignments: existing?.review_assignments ?? [],
      notes: existing?.notes ?? null,
      metadata: {
        ...(candidate.metadata ?? {}),
        ...((existing?.metadata as Record<string, unknown> | null) ?? {})
      },
      reviewed_at: existing?.reviewed_at ?? null,
      updated_at: nowIso
    };
  });

  const { error: upsertError } = await args.supabase
    .from("tweet_pattern_review_items" as any)
    .upsert(upsertRows, { onConflict: "dedupe_key" });
  if (upsertError) throw upsertError;

  return {
    syncedCount: upsertRows.length,
    preferredSourceCount: candidates.size
  };
}

async function handleGet(req: any, res: NextApiResponse) {
  const authorLookupUrl = parseString(req.query.authorLookupUrl);
  if (authorLookupUrl) {
    const result = await fetchLinesCccTweetOEmbedAttempt(authorLookupUrl);
    if (!result.ok) {
      return res.status(result.retryable ? 429 : 502).json({
        success: false,
        message: result.error
      });
    }

    return res.json({
      success: true,
      authorName: result.data.authorName,
      authorHandle: normalizeResolvedHandle(result.data.authorHandle)
    });
  }

  const limit = parseLimit(req.query.limit);
  const status = parseStatus(req.query.status);
  const exportMode = parseString(req.query.export);
  let query = req.supabase
    .from("tweet_pattern_review_items" as any)
    .select(
      "id, dedupe_key, source_table, source_row_key, source_group, source_key, source_account, source_label, source_handle, author_name, snapshot_date, source_created_at, tweet_id, tweet_url, source_url, quoted_tweet_id, quoted_tweet_url, team_id, team_abbreviation, parser_classification, parser_filter_status, parser_filter_reason, keyword_hits, review_text, raw_text, enriched_text, quoted_text, review_status, reviewed_category, reviewed_subcategory, selected_highlights, review_assignments, notes, metadata, reviewed_at, created_at, updated_at"
    )
    .order("source_created_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "all") {
    query = query.eq("review_status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  const items = ((data ?? []) as TweetPatternReviewRow[]).map((row) => ({
    ...row,
    review_assignments: normalizePatternReviewAssignments({
      assignments: row.review_assignments,
      legacyCategory: row.reviewed_category,
      legacySubcategory: row.reviewed_subcategory,
      legacyHighlights: row.selected_highlights,
      legacyNotes: row.notes
    })
  }));

  if (exportMode === "summary" || exportMode === "reviewed-summary") {
    return res.json({
      success: true,
      exportMode,
      summary: buildTweetPatternReviewExportSummary(items),
      generatedAt: new Date().toISOString()
    });
  }

  const players = await fetchRosterPlayers(req.supabase);

  return res.json({
    success: true,
    items,
    players,
    categoryOptions: TWEET_PATTERN_CATEGORY_OPTIONS
  });
}

async function handlePost(req: any, res: NextApiResponse) {
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const action = parseString(body.action) ?? "save";

  if (action === "sync") {
    const syncSummary = await syncTweetPatternReviewItems({
      supabase: req.supabase,
      perSourceLimit: parseLimit(body.perSourceLimit, 200)
    });
    return res.json({
      success: true,
      message: `Synced ${syncSummary.syncedCount} review rows from stored tweet sources.`,
      ...syncSummary
    });
  }

  const itemId = parseString(body.itemId);
  if (!itemId) {
    return res.status(400).json({
      success: false,
      message: "Missing itemId."
    });
  }

  if (action === "ignore" || action === "requeue") {
    const nextStatus: ReviewStatus = action === "ignore" ? "ignored" : "pending";
    const { error } = await req.supabase
      .from("tweet_pattern_review_items" as any)
      .update({
        review_status: nextStatus,
        reviewed_at: action === "ignore" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", itemId);
    if (error) throw error;

    return res.json({
      success: true,
      message: action === "ignore" ? "Tweet ignored." : "Tweet returned to pending review."
    });
  }

  const reviewedCategory = parseString(body.reviewedCategory);
  const reviewedSubcategory = parseString(body.reviewedSubcategory);
  const notes = parseString(body.notes);
  const selectedHighlights = parseHighlights(body.selectedHighlights);
  const reviewAssignments = parseReviewAssignments(body.reviewAssignments);

  if (reviewAssignments.length === 0 && !reviewedCategory) {
    return res.status(400).json({
      success: false,
      message: "Add at least one assignment before saving."
    });
  }

  const primaryAssignment = reviewAssignments[0] ?? null;

  const { error } = await req.supabase
    .from("tweet_pattern_review_items" as any)
    .update({
      review_status: "reviewed",
      reviewed_category: primaryAssignment?.category ?? reviewedCategory,
      reviewed_subcategory: primaryAssignment?.subcategory ?? reviewedSubcategory,
      selected_highlights: primaryAssignment?.highlightPhrases ?? selectedHighlights,
      review_assignments: reviewAssignments,
      notes: notes ?? primaryAssignment?.notes ?? null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", itemId);
  if (error) throw error;

  return res.json({
    success: true,
    message: `Saved ${reviewAssignments.length || 1} assignment${reviewAssignments.length === 1 ? "" : "s"}.`
  });
}

export default adminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method === "GET") {
    return handleGet(req, res);
  }
  if (req.method === "POST") {
    return handlePost(req, res);
  }
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({
    success: false,
    message: "Method not allowed."
  });
});
