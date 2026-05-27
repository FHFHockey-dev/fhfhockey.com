import { extractTweetIdFromUrl } from "./tweetLineupParsing";

export type PatternCategoryOption = {
  category: string;
  subcategories: string[];
};

export type TweetPatternReviewAssignment = {
  id: string;
  category: string;
  subcategory: string | null;
  playerIds: number[];
  playerNames: string[];
  highlightPhrases: string[];
  notes: string | null;
};

export type TweetPatternReviewExportRow = {
  id: string;
  source_key?: string | null;
  source_account?: string | null;
  author_name?: string | null;
  source_handle?: string | null;
  team_abbreviation?: string | null;
  parser_classification?: string | null;
  parser_filter_status?: string | null;
  parser_filter_reason?: string | null;
  keyword_hits?: string[] | null;
  review_text?: string | null;
  review_status: "pending" | "reviewed" | "ignored";
  reviewed_category?: string | null;
  reviewed_subcategory?: string | null;
  selected_highlights?: string[] | null;
  review_assignments?: TweetPatternReviewAssignment[] | null;
  notes?: string | null;
  source_url?: string | null;
  tweet_url?: string | null;
  reviewed_at?: string | null;
};

export type TweetPatternReviewExportSummary = {
  totalRows: number;
  reviewedRows: number;
  ignoredRows: number;
  assignmentCount: number;
  categoryCounts: Array<{ category: string; count: number }>;
  subcategoryCounts: Array<{
    category: string;
    subcategory: string;
    count: number;
  }>;
  phraseSuggestions: Array<{
    phrase: string;
    normalizedPhrase: string;
    category: string;
    subcategory: string | null;
    count: number;
    playerNames: string[];
    sourceAccounts: string[];
    tweetIds: string[];
    examples: Array<{
      reviewItemId: string;
      teamAbbreviation: string | null;
      sourceUrl: string | null;
      textSnippet: string | null;
    }>;
  }>;
  ambiguousBuckets: Array<{
    parserFilterStatus: string | null;
    parserFilterReason: string | null;
    reviewedCategory: string;
    reviewedSubcategory: string | null;
    count: number;
    exampleReviewItemIds: string[];
  }>;
  parserComparison: Array<{
    parserClassification: string | null;
    reviewedCategory: string;
    count: number;
  }>;
};

const DEFAULT_SOURCE_SCOPE = "tweet-pattern-review";

export const TWEET_PATTERN_CATEGORY_OPTIONS: PatternCategoryOption[] = [
  {
    category: "LINEUP",
    subcategories: [
      "LINE COMBINATION",
      "FORWARD LINES",
      "DEFENSE PAIRS",
      "PRACTICE LINES",
      "MORNING SKATE"
    ]
  },
  {
    category: "LINE COMBINATION",
    subcategories: [
      "FORWARD LINES",
      "DEFENSE PAIRS",
      "POWER PLAY",
      "POWER PLAY UNIT 1",
      "POWER PLAY UNIT 2",
      "PRACTICE LINES",
      "MORNING SKATE"
    ]
  },
  {
    category: "GOALIE START",
    subcategories: [
      "CONFIRMED STARTER",
      "EXPECTED STARTER",
      "STARTERS BOTH TEAMS",
      "STARTER RUMOR",
      "PRACTICE NET"
    ]
  },
  {
    category: "INJURY",
    subcategories: [
      "OUT",
      "QUESTIONABLE",
      "GAME TIME DECISION",
      "DAY TO DAY",
      "MAINTENANCE",
      "NON PARTICIPANT PRACTICE",
      "LIMITED PRACTICE",
      "RETURNING"
    ]
  },
  {
    category: "SCRATCHES",
    subcategories: ["HEALTHY SCRATCH", "PROJECTED SCRATCH", "CONFIRMED SCRATCH"]
  },
  {
    category: "RETURN",
    subcategories: ["RETURNING TO LINEUP", "RETURNING TO PRACTICE", "ACTIVATED"]
  },
  {
    category: "TRANSACTION",
    subcategories: ["CALL UP", "SENT DOWN", "TRADE", "WAIVER", "ROSTER MOVE"]
  },
  {
    category: "OTHER",
    subcategories: ["AMBIGUOUS", "NON NHL", "UNSUPPORTED FORMAT", "MULTI TEAM ROUNDUP"]
  }
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function normalizeBlock(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .join("\n")
    .trim();
  return normalized || null;
}

function normalizeScopeSegment(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || null;
}

export function normalizePatternEvidencePhrase(value: string | null | undefined): string {
  return normalizeWhitespace(String(value ?? ""));
}

function normalizePatternReviewAssignmentId(value: unknown, index: number): string {
  const normalized = normalizeScopeSegment(typeof value === "string" ? value : null);
  return normalized ?? `assignment-${index + 1}`;
}

function normalizePlayerIdList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0)
    )
  );
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => normalizeWhitespace(typeof item === "string" ? item : ""))
        .filter(Boolean)
    )
  );
}

function normalizeAssignment(value: unknown, index: number): TweetPatternReviewAssignment | null {
  if (!value || typeof value !== "object") return null;
  const assignment = value as Record<string, unknown>;
  const category = normalizeWhitespace(typeof assignment.category === "string" ? assignment.category : "");
  if (!category) return null;

  const subcategory = normalizeWhitespace(
    typeof assignment.subcategory === "string" ? assignment.subcategory : ""
  );
  const notes = normalizeWhitespace(typeof assignment.notes === "string" ? assignment.notes : "");

  return {
    id: normalizePatternReviewAssignmentId(assignment.id, index),
    category,
    subcategory: subcategory || null,
    playerIds: normalizePlayerIdList(assignment.playerIds),
    playerNames: normalizeStringList(assignment.playerNames),
    highlightPhrases: normalizeStringList(assignment.highlightPhrases),
    notes: notes || null
  };
}

export function normalizePatternReviewAssignments(args: {
  assignments: unknown;
  legacyCategory?: string | null;
  legacySubcategory?: string | null;
  legacyHighlights?: unknown;
  legacyNotes?: string | null;
}): TweetPatternReviewAssignment[] {
  const normalizedAssignments = Array.isArray(args.assignments)
    ? args.assignments
        .map((assignment, index) => normalizeAssignment(assignment, index))
        .filter((assignment): assignment is TweetPatternReviewAssignment => Boolean(assignment))
    : [];

  if (normalizedAssignments.length > 0) {
    return normalizedAssignments;
  }

  const legacyCategory = normalizeWhitespace(args.legacyCategory ?? "");
  if (!legacyCategory) return [];

  const legacySubcategory = normalizeWhitespace(args.legacySubcategory ?? "");
  const legacyNotes = normalizeWhitespace(args.legacyNotes ?? "");
  return [
    {
      id: "assignment-1",
      category: legacyCategory,
      subcategory: legacySubcategory || null,
      playerIds: [],
      playerNames: [],
      highlightPhrases: normalizeStringList(args.legacyHighlights),
      notes: legacyNotes || null
    }
  ];
}

export function buildTweetPatternReviewText(args: {
  rawText?: string | null;
  enrichedText?: string | null;
  quotedRawText?: string | null;
  quotedEnrichedText?: string | null;
  primaryTextSource?: string | null;
}): string | null {
  const wrapperText = normalizeBlock(args.enrichedText ?? args.rawText);
  const quotedText = normalizeBlock(args.quotedEnrichedText ?? args.quotedRawText);

  if (args.primaryTextSource === "quoted_oembed" && quotedText) {
    return quotedText;
  }

  if (wrapperText && quotedText && wrapperText !== quotedText) {
    return `Wrapper text\n${wrapperText}\n\nQuoted text\n${quotedText}`;
  }

  return quotedText ?? wrapperText ?? null;
}

export function buildTweetPatternReviewDedupeKey(args: {
  sourceKey?: string | null;
  sourceAccount?: string | null;
  tweetId?: string | null;
  tweetUrl?: string | null;
  sourceRowKey: string;
}): string {
  const sourceScope =
    normalizeScopeSegment(args.sourceKey) ??
    normalizeScopeSegment(args.sourceAccount) ??
    DEFAULT_SOURCE_SCOPE;
  const tweetScope =
    args.tweetId ??
    extractTweetIdFromUrl(args.tweetUrl ?? null) ??
    normalizeScopeSegment(args.sourceRowKey) ??
    "unknown";
  return `${sourceScope}:${tweetScope}`;
}

function incrementCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortCountEntries<T extends { count: number; label: string }>(
  entries: T[]
): T[] {
  return entries.sort(
    (left, right) =>
      right.count - left.count || left.label.localeCompare(right.label)
  );
}

function normalizeExportCategory(value: string | null | undefined): string {
  return normalizeWhitespace(value ?? "").toUpperCase();
}

function getReviewItemTweetId(row: TweetPatternReviewExportRow): string {
  return (
    extractTweetIdFromUrl(row.source_url ?? null) ??
    extractTweetIdFromUrl(row.tweet_url ?? null) ??
    row.id
  );
}

function buildTextSnippet(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value ?? "");
  if (!normalized) return null;
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

export function buildTweetPatternReviewExportSummary(
  rows: TweetPatternReviewExportRow[]
): TweetPatternReviewExportSummary {
  const categoryCounts = new Map<string, number>();
  const subcategoryCounts = new Map<string, number>();
  const parserComparisonCounts = new Map<string, number>();
  const phraseSuggestionMap = new Map<
    string,
    TweetPatternReviewExportSummary["phraseSuggestions"][number] & {
      playerNameSet: Set<string>;
      sourceAccountSet: Set<string>;
      tweetIdSet: Set<string>;
    }
  >();
  const ambiguousBucketMap = new Map<
    string,
    TweetPatternReviewExportSummary["ambiguousBuckets"][number]
  >();

  let assignmentCount = 0;

  for (const row of rows) {
    if (row.review_status !== "reviewed") continue;

    const assignments = normalizePatternReviewAssignments({
      assignments: row.review_assignments ?? [],
      legacyCategory: row.reviewed_category,
      legacySubcategory: row.reviewed_subcategory,
      legacyHighlights: row.selected_highlights,
      legacyNotes: row.notes
    });

    for (const assignment of assignments) {
      const category = normalizeExportCategory(assignment.category);
      if (!category) continue;

      const subcategory = normalizeExportCategory(assignment.subcategory) || null;
      assignmentCount += 1;
      incrementCount(categoryCounts, category);
      if (subcategory) {
        incrementCount(subcategoryCounts, `${category}\u0000${subcategory}`);
      }

      const parserClassification =
        normalizeExportCategory(row.parser_classification) || null;
      incrementCount(
        parserComparisonCounts,
        `${parserClassification ?? ""}\u0000${category}`
      );

      if (
        category === "OTHER" ||
        row.parser_filter_status?.startsWith("rejected")
      ) {
        const ambiguousKey = [
          row.parser_filter_status ?? "",
          row.parser_filter_reason ?? "",
          category,
          subcategory ?? ""
        ].join("\u0000");
        const bucket =
          ambiguousBucketMap.get(ambiguousKey) ??
          {
            parserFilterStatus: row.parser_filter_status ?? null,
            parserFilterReason: row.parser_filter_reason ?? null,
            reviewedCategory: category,
            reviewedSubcategory: subcategory,
            count: 0,
            exampleReviewItemIds: []
          };
        bucket.count += 1;
        if (bucket.exampleReviewItemIds.length < 8) {
          bucket.exampleReviewItemIds.push(row.id);
        }
        ambiguousBucketMap.set(ambiguousKey, bucket);
      }

      for (const phrase of assignment.highlightPhrases) {
        const normalizedPhrase = normalizePatternEvidencePhrase(phrase);
        if (!normalizedPhrase) continue;
        const phraseKey = [
          normalizedPhrase.toLowerCase(),
          category,
          subcategory ?? ""
        ].join("\u0000");
        const suggestion =
          phraseSuggestionMap.get(phraseKey) ??
          {
            phrase: normalizedPhrase,
            normalizedPhrase: normalizedPhrase.toLowerCase(),
            category,
            subcategory,
            count: 0,
            playerNames: [],
            sourceAccounts: [],
            tweetIds: [],
            examples: [],
            playerNameSet: new Set<string>(),
            sourceAccountSet: new Set<string>(),
            tweetIdSet: new Set<string>()
          };
        suggestion.count += 1;
        for (const playerName of assignment.playerNames) {
          suggestion.playerNameSet.add(playerName);
        }
        const sourceAccount =
          row.author_name ?? row.source_handle ?? row.source_account ?? row.source_key;
        if (sourceAccount) suggestion.sourceAccountSet.add(sourceAccount);
        suggestion.tweetIdSet.add(getReviewItemTweetId(row));
        if (suggestion.examples.length < 3) {
          suggestion.examples.push({
            reviewItemId: row.id,
            teamAbbreviation: row.team_abbreviation ?? null,
            sourceUrl: row.source_url ?? row.tweet_url ?? null,
            textSnippet: buildTextSnippet(row.review_text)
          });
        }
        phraseSuggestionMap.set(phraseKey, suggestion);
      }
    }
  }

  return {
    totalRows: rows.length,
    reviewedRows: rows.filter((row) => row.review_status === "reviewed").length,
    ignoredRows: rows.filter((row) => row.review_status === "ignored").length,
    assignmentCount,
    categoryCounts: sortCountEntries(
      Array.from(categoryCounts.entries()).map(([category, count]) => ({
        label: category,
        category,
        count
      }))
    ).map(({ category, count }) => ({ category, count })),
    subcategoryCounts: sortCountEntries(
      Array.from(subcategoryCounts.entries()).map(([key, count]) => {
        const [category, subcategory] = key.split("\u0000");
        return {
          label: `${category} ${subcategory}`,
          category,
          subcategory,
          count
        };
      })
    ).map(({ category, subcategory, count }) => ({
      category,
      subcategory,
      count
    })),
    phraseSuggestions: Array.from(phraseSuggestionMap.values())
      .map((suggestion) => ({
        phrase: suggestion.phrase,
        normalizedPhrase: suggestion.normalizedPhrase,
        category: suggestion.category,
        subcategory: suggestion.subcategory,
        count: suggestion.count,
        playerNames: Array.from(suggestion.playerNameSet).sort(),
        sourceAccounts: Array.from(suggestion.sourceAccountSet).sort(),
        tweetIds: Array.from(suggestion.tweetIdSet).sort(),
        examples: suggestion.examples
      }))
      .sort(
        (left, right) =>
          right.count - left.count ||
          left.category.localeCompare(right.category) ||
          left.phrase.localeCompare(right.phrase)
      ),
    ambiguousBuckets: Array.from(ambiguousBucketMap.values()).sort(
      (left, right) =>
        right.count - left.count ||
        left.reviewedCategory.localeCompare(right.reviewedCategory)
    ),
    parserComparison: sortCountEntries(
      Array.from(parserComparisonCounts.entries()).map(([key, count]) => {
        const [parserClassification, reviewedCategory] = key.split("\u0000");
        return {
          label: `${parserClassification} ${reviewedCategory}`,
          parserClassification: parserClassification || null,
          reviewedCategory,
          count
        };
      })
    ).map(({ parserClassification, reviewedCategory, count }) => ({
      parserClassification,
      reviewedCategory,
      count
    }))
  };
}
