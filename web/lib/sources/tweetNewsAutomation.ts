import {
  buildNewsFeedHeadline,
  getPublicNewsSourceAttribution,
  normalizeNewsCategory,
  normalizeNewsText,
} from "lib/newsFeed";
import {
  parseLineupCardFromText,
  readLineupCardFromMetadata,
} from "lib/newsLineupCard";
import type { NewsLineupCardData } from "lib/newsLineupCard";
import type { TweetPatternReviewAssignment } from "lib/sources/tweetPatternReview";
import {
  tweetNewsExclusionRules,
  tweetNewsPhraseDictionary,
  type TweetNewsPhraseRule,
} from "lib/sources/tweetNewsPhraseDictionary";

export type TweetNewsAutomationReviewRow = {
  id: string;
  source_account: string | null;
  source_label: string | null;
  source_handle: string | null;
  author_name: string | null;
  source_created_at: string | null;
  tweet_id: string | null;
  tweet_url: string | null;
  source_url: string | null;
  quoted_tweet_url?: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  parser_classification: string | null;
  parser_filter_status: string | null;
  parser_filter_reason: string | null;
  review_text: string | null;
  raw_text: string | null;
  enriched_text: string | null;
  quoted_text: string | null;
  review_status: "pending" | "reviewed" | "ignored";
  reviewed_category: string | null;
  reviewed_subcategory: string | null;
  selected_highlights: string[] | null;
  review_assignments: TweetPatternReviewAssignment[] | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
};

export type TweetNewsAutomationPlayer = {
  id: number;
  fullName: string;
  position: string | null;
  team_id: number | null;
};

export type TweetNewsPhraseMatch = {
  ruleId: string;
  category: string;
  subcategory: string | null;
  confidence: TweetNewsPhraseRule["confidence"];
  autoPublish: boolean;
  phrase: string;
  regex: string;
  requiredEvidence: TweetNewsPhraseRule["requiredEvidence"];
};

export type TweetNewsAutomationAssignment = TweetPatternReviewAssignment & {
  ruleId: string;
  confidence: TweetNewsPhraseRule["confidence"];
  autoPublish: boolean;
  requiredEvidence: TweetNewsPhraseRule["requiredEvidence"];
};

export type TweetNewsAutomationAmbiguityReason =
  | "no_dictionary_match"
  | "missing_required_evidence";

export type TweetNewsAutomationCandidate = {
  reviewItemId: string;
  sourceTweetId: string | null;
  sourceUrl: string | null;
  tweetUrl: string | null;
  sourceLabel: string | null;
  sourceAccount: string | null;
  teamId: number | null;
  teamAbbreviation: string | null;
  headline: string;
  blurb: string;
  category: string;
  subcategory: string | null;
  cardStatus: "draft" | "published";
  observedAt: string | null;
  publishedAt: string | null;
  playerAssignments: Array<{
    playerId: number | null;
    playerName: string;
    teamId: number | null;
  }>;
  reviewAssignments: TweetNewsAutomationAssignment[];
  metadata: Record<string, unknown>;
};

export function getTweetNewsCandidateSource(
  row: TweetNewsAutomationReviewRow,
): {
  sourceUrl: string | null;
  sourceLabel: string | null;
  sourceAccount: string | null;
} {
  const source = getPublicNewsSourceAttribution({
    item: {
      source_label: row.source_label,
      source_account: row.source_account,
      source_url: row.source_url,
      tweet_url: row.tweet_url,
      metadata: row.metadata,
    },
    provenance: {
      source_handle: row.source_handle,
      author_name: row.author_name,
      source_url: row.source_url,
      tweet_url: row.tweet_url,
      quoted_tweet_url: row.quoted_tweet_url,
      metadata: row.metadata,
    },
  });
  return {
    sourceUrl: source.url,
    sourceLabel: source.displayName,
    sourceAccount: source.account,
  };
}

type Evidence = {
  team: boolean;
  player: boolean;
  goalie: boolean;
  lineupStructure: boolean;
};

type AutomationContext = {
  text: string;
  exclusionRuleId: string | null;
  manualAssignments: TweetNewsAutomationAssignment[];
  phraseMatches: TweetNewsPhraseMatch[];
  matchedPlayers: TweetNewsAutomationPlayer[];
  preliminaryLineupCard: NewsLineupCardData | null;
  evidence: Evidence;
  ruleAssignments: TweetNewsAutomationAssignment[];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeForMatch(value: string): string {
  return normalizeNewsText(value).replace(/[’]/g, "'").replace(/[–—−]/g, "-");
}

function getReviewText(row: TweetNewsAutomationReviewRow): string {
  return (
    row.review_text ??
    row.quoted_text ??
    row.enriched_text ??
    row.raw_text ??
    ""
  );
}

function isLineCombinationCategory(category: string | null): boolean {
  return normalizeNewsCategory(category) === "LINE COMBINATION";
}

function hasLineupStructure(text: string): boolean {
  const playerName = String.raw`[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ.'’'-]+(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ.'’'-]+){0,2}`;
  const forwardLine = new RegExp(
    `${playerName}\\s*[-–—/]\\s*${playerName}\\s*[-–—/]\\s*${playerName}`,
    "u",
  );
  const defensePair = new RegExp(
    `${playerName}\\s*[-–—/]\\s*${playerName}`,
    "u",
  );
  const lines = text.split(/\r?\n/).filter(Boolean);
  return (
    forwardLine.test(text) ||
    lines.filter((line) => defensePair.test(line)).length >= 2
  );
}

function matchesExclusion(text: string): string | null {
  for (const rule of tweetNewsExclusionRules) {
    if (rule.regexes.some((regex) => new RegExp(regex, "i").test(text))) {
      return rule.id;
    }
  }
  return null;
}

export function matchTweetNewsPhrases(text: string): TweetNewsPhraseMatch[] {
  const normalizedText = normalizeForMatch(text);
  const matches: TweetNewsPhraseMatch[] = [];

  for (const rule of tweetNewsPhraseDictionary) {
    rule.regexes.forEach((regex, index) => {
      if (!new RegExp(regex, "i").test(normalizedText)) return;
      matches.push({
        ruleId: rule.id,
        category: rule.category,
        subcategory: rule.subcategory,
        confidence: rule.confidence,
        autoPublish: rule.autoPublish,
        phrase: rule.phrases[index] ?? rule.phrases[0] ?? rule.id,
        regex,
        requiredEvidence: rule.requiredEvidence,
      });
    });
  }

  return matches;
}

function includesPlayerName(text: string, name: string): boolean {
  return new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text);
}

function getLastName(fullName: string): string {
  return fullName.trim().split(/\s+/).at(-1) ?? fullName;
}

function resolveMentionedPlayers(args: {
  row: TweetNewsAutomationReviewRow;
  players: TweetNewsAutomationPlayer[];
  text: string;
}): TweetNewsAutomationPlayer[] {
  const scopedPlayers = args.row.team_id
    ? args.players.filter((player) => player.team_id === args.row.team_id)
    : args.players;
  const text = normalizeForMatch(args.text);
  const fullNameMatches = scopedPlayers.filter((player) =>
    includesPlayerName(text, normalizeForMatch(player.fullName)),
  );
  if (fullNameMatches.length > 0) return fullNameMatches.slice(0, 12);

  // Transaction tweets frequently name a destination team before the players
  // table reflects the move. Fall back to a global exact-name lookup before
  // trying less precise last-name matching inside the inferred team.
  if (args.row.team_id) {
    const globalFullNameMatches = args.players.filter((player) =>
      includesPlayerName(text, normalizeForMatch(player.fullName)),
    );
    if (globalFullNameMatches.length > 0) {
      return globalFullNameMatches.slice(0, 12);
    }
  }

  const lastNameMatches = scopedPlayers.filter((player) => {
    const lastName = normalizeForMatch(getLastName(player.fullName));
    return lastName.length >= 4 && includesPlayerName(text, lastName);
  });

  return lastNameMatches.slice(0, 12);
}

function resolveManualAssignments(
  row: TweetNewsAutomationReviewRow,
): TweetNewsAutomationAssignment[] {
  return (row.review_assignments ?? [])
    .filter((assignment) => normalizeNewsCategory(assignment.category))
    .map((assignment, index) => ({
      ...assignment,
      id: assignment.id || `manual-${index + 1}`,
      category: normalizeNewsCategory(assignment.category),
      subcategory: normalizeNewsCategory(assignment.subcategory) || null,
      ruleId: "manual-review",
      confidence: "auto",
      autoPublish: row.review_status === "reviewed",
      requiredEvidence: [],
    }));
}

function buildEvidence(args: {
  row: TweetNewsAutomationReviewRow;
  text: string;
  matchedPlayers: TweetNewsAutomationPlayer[];
  lineupCard: NewsLineupCardData | null;
}): Evidence {
  return {
    team: Boolean(args.row.team_id && args.row.team_abbreviation),
    player: args.matchedPlayers.length > 0,
    goalie: args.matchedPlayers.some((player) => player.position === "G"),
    lineupStructure:
      Boolean(args.lineupCard) ||
      hasLineupStructure(args.text) ||
      args.row.parser_classification === "lineup" ||
      args.row.parser_classification === "practice_lines" ||
      args.row.parser_classification === "power_play",
  };
}

function hasRequiredEvidence(
  requiredEvidence: TweetNewsPhraseRule["requiredEvidence"],
  evidence: Evidence,
): boolean {
  return requiredEvidence.every((key) => evidence[key]);
}

function getMissingRequiredEvidence(
  phraseMatches: TweetNewsPhraseMatch[],
  evidence: Evidence,
): string[] {
  return Array.from(
    new Set(
      phraseMatches.flatMap((match) =>
        match.requiredEvidence.filter((key) => !evidence[key]),
      ),
    ),
  );
}

function buildRuleAssignment(args: {
  row: TweetNewsAutomationReviewRow;
  match: TweetNewsPhraseMatch;
  matchedPlayers: TweetNewsAutomationPlayer[];
}): TweetNewsAutomationAssignment {
  const playerNames = args.matchedPlayers.map((player) => player.fullName);
  const playerIds = args.matchedPlayers.map((player) => player.id);

  return {
    id: `auto-${args.match.ruleId}`,
    category: args.match.category,
    subcategory: args.match.subcategory,
    playerIds,
    playerNames,
    highlightPhrases: [args.match.phrase],
    notes: `Matched phrase rule ${args.match.ruleId}.`,
    ruleId: args.match.ruleId,
    confidence: args.match.confidence,
    autoPublish: args.match.autoPublish,
    requiredEvidence: args.match.requiredEvidence,
  };
}

function choosePrimaryAssignment(
  assignments: TweetNewsAutomationAssignment[],
): TweetNewsAutomationAssignment | null {
  const categoryPriority = new Map([
    ["REPORTED INJURY", 61],
    ["INJURY", 60],
    ["RETURN", 55],
    ["GOALIE START", 50],
    ["LINE CHANGE", 45],
    ["LINE COMBINATION", 40],
    ["SCRATCHES", 35],
    ["TRANSACTION", 30],
    ["NEWS UPDATE", 31],
    ["TRADE", 29],
    ["SIGNING", 28],
    ["RETIREMENT", 27],
  ]);

  return (
    [...assignments].sort((left, right) => {
      const autoDifference =
        Number(right.autoPublish) - Number(left.autoPublish);
      if (autoDifference !== 0) return autoDifference;
      const confidenceDifference =
        Number(right.confidence === "auto") -
        Number(left.confidence === "auto");
      if (confidenceDifference !== 0) return confidenceDifference;
      return (
        (categoryPriority.get(right.category) ?? 0) -
        (categoryPriority.get(left.category) ?? 0)
      );
    })[0] ?? null
  );
}

function buildBlurb(text: string): string {
  const normalized = normalizeNewsText(text)
    .replace(/https?:\/\/\S+/gi, "")
    .trim();
  return normalized.length > 280
    ? `${normalized.slice(0, 277)}...`
    : normalized;
}

function extractCandidatePhrases(text: string): string[] {
  const stopWords = new Set([
    "and",
    "are",
    "but",
    "for",
    "from",
    "has",
    "have",
    "his",
    "into",
    "not",
    "off",
    "out",
    "per",
    "the",
    "this",
    "that",
    "their",
    "they",
    "was",
    "with",
    "will",
  ]);
  const hockeyWords = new Set([
    "available",
    "confirmed",
    "goalie",
    "injury",
    "line",
    "lines",
    "lineup",
    "net",
    "practice",
    "recalled",
    "returns",
    "rushes",
    "scratch",
    "start",
    "starter",
    "starting",
    "warmup",
    "warmups",
  ]);
  const tokens = normalizeForMatch(text)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#][a-z0-9_]+/gi, " ")
    .replace(/[^a-z0-9'\-\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token));
  const scored = new Map<string, number>();

  for (let size = 2; size <= 5; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const chunk = tokens.slice(index, index + size);
      if (chunk.every((token) => stopWords.has(token))) continue;
      const phrase = chunk.join(" ");
      const score =
        size +
        chunk.filter((token) => hockeyWords.has(token)).length * 3 -
        chunk.filter((token) => stopWords.has(token)).length;
      if (score <= 1) continue;
      scored.set(phrase, Math.max(scored.get(phrase) ?? 0, score));
    }
  }

  return [...scored.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 12)
    .map(([phrase]) => phrase);
}

function buildAmbiguousHeadline(args: {
  row: TweetNewsAutomationReviewRow;
  playerNames: string[];
}): string {
  const playerName = args.playerNames.find(Boolean);
  if (playerName) return `${playerName} dictionary review`;
  const team = args.row.team_abbreviation?.trim();
  if (team) return `${team} dictionary review`;
  return "Tweet dictionary review";
}

function getLineupCard(args: {
  text: string;
  category: string | null;
  subcategory: string | null;
  metadata: Record<string, unknown> | null;
}): NewsLineupCardData | null {
  return (
    readLineupCardFromMetadata(args.metadata) ??
    parseLineupCardFromText({
      text: args.text,
      category: args.category,
      subcategory: args.subcategory,
    })
  );
}

function buildAutomationContext(args: {
  row: TweetNewsAutomationReviewRow;
  players: TweetNewsAutomationPlayer[];
}): AutomationContext | null {
  if (args.row.review_status === "ignored") return null;

  const text = getReviewText(args.row);
  if (!text.trim()) return null;

  const exclusionRuleId = matchesExclusion(text);
  const manualAssignments = resolveManualAssignments(args.row);
  const phraseMatches = matchTweetNewsPhrases(text);
  const matchedPlayers = resolveMentionedPlayers({
    row: args.row,
    players: args.players,
    text,
  });
  const preliminaryLineupCard = getLineupCard({
    text,
    category: "LINE COMBINATION",
    subcategory: null,
    metadata: args.row.metadata,
  });
  const evidence = buildEvidence({
    row: args.row,
    text,
    matchedPlayers,
    lineupCard: preliminaryLineupCard,
  });
  const ruleAssignments = phraseMatches
    .filter((match) => hasRequiredEvidence(match.requiredEvidence, evidence))
    .map((match) =>
      buildRuleAssignment({
        row: args.row,
        match,
        matchedPlayers,
      }),
    );

  return {
    text,
    exclusionRuleId,
    manualAssignments,
    phraseMatches,
    matchedPlayers,
    preliminaryLineupCard,
    evidence,
    ruleAssignments,
  };
}

export function buildTweetNewsAutomationCandidate(args: {
  row: TweetNewsAutomationReviewRow;
  players: TweetNewsAutomationPlayer[];
  nowIso?: string;
}): TweetNewsAutomationCandidate | null {
  const context = buildAutomationContext({
    row: args.row,
    players: args.players,
  });
  if (!context || context.exclusionRuleId) return null;
  if (
    context.manualAssignments.length === 0 &&
    context.phraseMatches.length === 0
  ) {
    return null;
  }

  const reviewAssignments =
    context.manualAssignments.length > 0
      ? context.manualAssignments
      : context.ruleAssignments;
  const primaryAssignment = choosePrimaryAssignment(reviewAssignments);
  if (!primaryAssignment) return null;

  const lineupCard = isLineCombinationCategory(primaryAssignment.category)
    ? getLineupCard({
        text: context.text,
        category: primaryAssignment.category,
        subcategory: primaryAssignment.subcategory,
        metadata: args.row.metadata,
      })
    : null;
  const shouldPublish =
    primaryAssignment.autoPublish &&
    primaryAssignment.confidence === "auto" &&
    hasRequiredEvidence(primaryAssignment.requiredEvidence, context.evidence);
  const nowIso = args.nowIso ?? new Date().toISOString();
  const playerAssignments =
    primaryAssignment.playerNames.length > 0
      ? primaryAssignment.playerNames.map((playerName, index) => ({
          playerId: primaryAssignment.playerIds[index] ?? null,
          playerName,
          teamId: args.row.team_id,
        }))
      : [];
  const metadata: Record<string, unknown> = {
    ...(args.row.metadata ?? {}),
    automation: {
      source: "tweet_news_phrase_dictionary",
      generatedAt: nowIso,
      primaryRuleId: primaryAssignment.ruleId,
      phraseMatches: context.phraseMatches,
      evidence: context.evidence,
      autoPublish: shouldPublish,
    },
  };

  if (lineupCard) {
    metadata.lineupCard = lineupCard;
  }
  const source = getTweetNewsCandidateSource(args.row);

  return {
    reviewItemId: args.row.id,
    sourceTweetId: args.row.tweet_id,
    sourceUrl: source.sourceUrl,
    tweetUrl: source.sourceUrl,
    sourceLabel: source.sourceLabel,
    sourceAccount: source.sourceAccount,
    teamId: args.row.team_id,
    teamAbbreviation: args.row.team_abbreviation,
    headline: buildNewsFeedHeadline({
      playerNames: primaryAssignment.playerNames,
      category: primaryAssignment.category,
      subcategory: primaryAssignment.subcategory,
      teamAbbreviation: args.row.team_abbreviation,
    }),
    blurb: buildBlurb(context.text),
    category: primaryAssignment.category,
    subcategory: primaryAssignment.subcategory,
    cardStatus: shouldPublish ? "published" : "draft",
    observedAt: args.row.source_created_at,
    publishedAt: shouldPublish ? nowIso : null,
    playerAssignments,
    reviewAssignments,
    metadata,
  };
}

export function buildTweetNewsAmbiguousCandidate(args: {
  row: TweetNewsAutomationReviewRow;
  players: TweetNewsAutomationPlayer[];
  nowIso?: string;
}): TweetNewsAutomationCandidate | null {
  const context = buildAutomationContext({
    row: args.row,
    players: args.players,
  });
  if (!context || context.exclusionRuleId) return null;
  if (context.manualAssignments.length > 0 || context.ruleAssignments.length > 0) {
    return null;
  }

  const ambiguityReason: TweetNewsAutomationAmbiguityReason =
    context.phraseMatches.length > 0
      ? "missing_required_evidence"
      : "no_dictionary_match";
  const nowIso = args.nowIso ?? new Date().toISOString();
  const matchedPlayerAssignments = context.matchedPlayers.map((player) => ({
    playerId: player.id,
    playerName: player.fullName,
    teamId: player.team_id,
  }));
  const category = "OTHER";
  const subcategory = "AMBIGUOUS";
  const metadata: Record<string, unknown> = {
    ...(args.row.metadata ?? {}),
    automation: {
      source: "tweet_news_phrase_dictionary",
      generatedAt: nowIso,
      ambiguityReason,
      dictionaryGap: true,
      phraseMatches: context.phraseMatches,
      candidatePhrases: extractCandidatePhrases(context.text),
      missingRequiredEvidence: getMissingRequiredEvidence(
        context.phraseMatches,
        context.evidence,
      ),
      evidence: context.evidence,
      autoPublish: false,
    },
  };

  if (context.preliminaryLineupCard) {
    metadata.lineupCard = context.preliminaryLineupCard;
  }
  const source = getTweetNewsCandidateSource(args.row);

  return {
    reviewItemId: args.row.id,
    sourceTweetId: args.row.tweet_id,
    sourceUrl: source.sourceUrl,
    tweetUrl: source.sourceUrl,
    sourceLabel: source.sourceLabel,
    sourceAccount: source.sourceAccount,
    teamId: args.row.team_id,
    teamAbbreviation: args.row.team_abbreviation,
    headline: buildAmbiguousHeadline({
      row: args.row,
      playerNames: matchedPlayerAssignments.map((player) => player.playerName),
    }),
    blurb: buildBlurb(context.text),
    category,
    subcategory,
    cardStatus: "draft",
    observedAt: args.row.source_created_at,
    publishedAt: null,
    playerAssignments: matchedPlayerAssignments,
    reviewAssignments: [],
    metadata,
  };
}
