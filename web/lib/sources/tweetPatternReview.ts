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

const DEFAULT_SOURCE_SCOPE = "tweet-pattern-review";

export const TWEET_PATTERN_CATEGORY_OPTIONS: PatternCategoryOption[] = [
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
}): string | null {
  const wrapperText = normalizeBlock(args.enrichedText ?? args.rawText);
  const quotedText = normalizeBlock(args.quotedEnrichedText ?? args.quotedRawText);

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
