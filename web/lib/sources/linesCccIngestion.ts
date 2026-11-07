import { extractTweetPlayerEvents, type TweetPlayerEvent } from "./tweetPlayerEvents";
import type { PlayerSlotRole } from "./playerIdentity";
import { identityMentionPresent, interpretTweetUnits, lineupChangeEvents, playerPositionRole, segmentPlayerRow, surnameMentionPresent, tweetPipelineFlags, type TweetInterpretation } from "./tweetInterpretation";
import type {
  GameDayTweetsClassification,
  RosterNameEntry,
  TeamDirectoryEntry,
} from "lib/sources/lineupSourceIngestion";
import {
  classifyGameDayTweet,
  extractOrderedRosterHitsFromTweet,
  extractStructuredPlayerGroupsFromText,
  extractStructuredNameGroupsFromTweet,
  findGameDayTweetKeywordHits,
  matchRosterNamesInTweet,
  resolveTweetNameToRosterEntry,
  rosterNamesHaveRole,
} from "lib/sources/lineupSourceIngestion";
import {
  extractTweetIdFromUrl,
  normalizeTweetStatusUrl,
  parseTweetOEmbedHtml,
  resolveTweetReferenceFromText,
} from "lib/sources/tweetLineupParsing";

export type LinesCccNhlFilterStatus =
  | "accepted"
  | "rejected_non_nhl"
  | "rejected_ambiguous"
  | "rejected_insufficient_text";

export type LinesCccPrimaryTextSource =
  | "wrapper_oembed"
  | "quoted_oembed"
  | "retweet_oembed"
  | "ifttt_text"
  | "manual_fixture";

export type ParsedLinesCccSource = {
  snapshotDate: string;
  observedAt?: string | null;
  tweetPostedAt?: string | null;
  tweetPostedLabel?: string | null;
  gameId?: number | null;
  team?: TeamDirectoryEntry | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  sourceHandle?: string | null;
  authorName?: string | null;
  tweetId?: string | null;
  tweetUrl?: string | null;
  quotedTweetId?: string | null;
  quotedTweetUrl?: string | null;
  quotedAuthorHandle?: string | null;
  quotedAuthorName?: string | null;
  primaryTextSource?: LinesCccPrimaryTextSource | null;
  classification?: GameDayTweetsClassification | null;
  detectedLeague?: string | null;
  nhlFilterStatus: LinesCccNhlFilterStatus;
  nhlFilterReason?: string | null;
  rawText?: string | null;
  enrichedText?: string | null;
  quotedRawText?: string | null;
  quotedEnrichedText?: string | null;
  keywordHits?: string[];
  matchedPlayerIds?: number[];
  matchedNames?: string[];
  unmatchedNames?: string[];
  forwards?: string[][];
  defensePairs?: string[][];
  goalies?: string[];
  scratches?: string[];
  injuries?: string[];
  rawPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type LinesCccIftttEventInput = {
  id: string;
  source: string;
  source_account: string;
  username: string | null;
  text: string | null;
  link_to_tweet: string | null;
  tweet_id: string | null;
  tweet_created_at: string | null;
  created_at_label: string | null;
  raw_payload: Record<string, unknown>;
  received_at: string;
};

export type LinesCccRow = {
  capture_key: string;
  snapshot_date: string;
  observed_at: string;
  tweet_posted_at: string | null;
  tweet_posted_label: string | null;
  game_id: number | null;
  team_id: number | null;
  team_abbreviation: string | null;
  team_name: string | null;
  source: "lines_ccc";
  source_url: string | null;
  source_label: string | null;
  source_handle: string | null;
  author_name: string | null;
  tweet_id: string | null;
  tweet_url: string | null;
  quoted_tweet_id: string | null;
  quoted_tweet_url: string | null;
  quoted_author_handle: string | null;
  quoted_author_name: string | null;
  primary_text_source: LinesCccPrimaryTextSource | null;
  classification: GameDayTweetsClassification | null;
  detected_league: string | null;
  nhl_filter_status: LinesCccNhlFilterStatus;
  nhl_filter_reason: string | null;
  status: "observed" | "rejected";
  raw_text: string | null;
  enriched_text: string | null;
  quoted_raw_text: string | null;
  quoted_enriched_text: string | null;
  keyword_hits: string[] | null;
  matched_player_ids: number[] | null;
  matched_player_names: string[] | null;
  unmatched_names: string[] | null;
  line_1_player_ids: Array<number | null> | null;
  line_1_player_names: string[] | null;
  line_2_player_ids: Array<number | null> | null;
  line_2_player_names: string[] | null;
  line_3_player_ids: Array<number | null> | null;
  line_3_player_names: string[] | null;
  line_4_player_ids: Array<number | null> | null;
  line_4_player_names: string[] | null;
  pair_1_player_ids: Array<number | null> | null;
  pair_1_player_names: string[] | null;
  pair_2_player_ids: Array<number | null> | null;
  pair_2_player_names: string[] | null;
  pair_3_player_ids: Array<number | null> | null;
  pair_3_player_names: string[] | null;
  goalie_1_player_id: number | null;
  goalie_1_name: string | null;
  goalie_2_player_id: number | null;
  goalie_2_name: string | null;
  scratches_player_ids: Array<number | null> | null;
  scratches_player_names: string[] | null;
  injured_player_ids: Array<number | null> | null;
  injured_player_names: string[] | null;
  raw_payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export type LinesCccTweetOEmbedData = {
  text: string | null;
  postedAt: string | null;
  postedLabel: string | null;
  sourceTweetUrl: string | null;
  authorName: string | null;
  authorHandle: string | null;
};

export type LinesCccResolvedQuotedTweet = {
  quotedTweetId: string;
  quotedTweetUrl: string;
  quotedText: string | null;
  quotedPostedAt: string | null;
  quotedPostedLabel: string | null;
  quotedSourceTweetUrl: string | null;
  quotedAuthorName: string | null;
  quotedAuthorHandle: string | null;
  resolvedUrl: string;
  shortUrl: string | null;
  retrievalStatus: "x_api_success" | "oembed_success" | "resolved_url_only" | "fxtwitter_payload";
};

export type LinesCccWrapperOEmbedBackfillState = {
  status: "pending" | "success" | "failed" | "deferred_429";
  tweetId: string | null;
  tweetUrl: string | null;
  sourceTweetUrl?: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt?: string | null;
  fetchedAt?: string | null;
  httpStatus?: number | null;
  lastError?: string | null;
  text?: string | null;
  postedAt?: string | null;
  postedLabel?: string | null;
  authorName?: string | null;
  authorHandle?: string | null;
};

export type LinesCccTweetOEmbedAttemptResult =
  | {
      ok: true;
      data: LinesCccTweetOEmbedData;
      httpStatus: number | null;
    }
  | {
      ok: false;
      httpStatus: number | null;
      retryable: boolean;
      error: string;
    };

type LinesCccTextSignals = {
  keywordHits: string[];
  structureSignals: {
    forwardLineCount: number;
    defensePairCount: number;
    parsedForwardLines: number;
    parsedDefensePairs: number;
    parsedGoalieCount: number;
  };
};

const NHL_HANDLE_HINTS: Record<string, string> = {
  canadiensmtl: "MTL",
  chrishabs360: "MTL",
  lakings: "LAK",
  edmontonoilers: "EDM",
  tampabaylightning: "TBL",
  tblightning: "TBL",
  mnwildpr: "MIN",
  wpgjetspr: "WPG",
  bellefraser1: "BOS",
  derek_lee27: "ANA",
  joesmithnhl: "MIN",
  lassimak: "DAL",
  matthewfairburn: "BUF",
  owennewkirk: "DAL",
  patrickcpresent: "ANA",
  rachelmlenzi: "BUF",
  smclaughlin9: "BOS",
};

const NHL_TEXT_HINTS: Record<string, string> = {
  gohabsgo: "MTL",
  habs: "MTL",
  gobolts: "TBL",
  bolts: "TBL",
  flytogether: "ANA",
  mnwild: "MIN",
  nhlbruins: "BOS",
  sabres: "BUF",
};

const NON_NHL_HANDLE_HINTS: Array<{
  pattern: RegExp;
  league: string;
}> = [
  { pattern: /\bahl\b/i, league: "AHL" },
  { pattern: /\bechl\b/i, league: "ECHL" },
  { pattern: /\bohl\b/i, league: "OHL" },
  { pattern: /\bwhl\b/i, league: "WHL" },
  { pattern: /\bqmjhl\b/i, league: "QMJHL" },
  { pattern: /\bncaa\b/i, league: "NCAA" },
  { pattern: /\bthehersheybears\b/i, league: "AHL" },
  { pattern: /\bsdgullsahl\b/i, league: "AHL" },
  { pattern: /\bsjbarracuda\b/i, league: "AHL" },
  { pattern: /\binsideahlhockey\b/i, league: "AHL" },
];

function countStructuredPlayerMentions(text: string): number {
  const structuredGroups = extractStructuredPlayerGroupsFromText(text);
  return (
    structuredGroups.forwards.reduce((sum, line) => sum + line.length, 0) +
    structuredGroups.defensePairs.reduce((sum, pair) => sum + pair.length, 0) +
    structuredGroups.goalies.length
  );
}

type PowerPlayUnitLabel = "pp1" | "pp2" | null;

type ExtractedPowerPlayUnits = {
  labels: PowerPlayUnitLabel[];
  units: string[][];
};

function isWrapperTextInsufficientWithoutQuote(
  source: ParsedLinesCccSource,
): boolean {
  const wrapperText = source.enrichedText ?? source.rawText ?? "";
  if (!wrapperText.trim()) return true;

  const hasQuoteShortLink = /https?:\/\/t\.co\//i.test(wrapperText);
  const hasStructuredNames = countStructuredPlayerMentions(wrapperText) > 0;
  const hasGoalieName = Boolean(extractGoalieName(wrapperText));
  const hasRosterMatches = (source.matchedPlayerIds?.length ?? 0) >= 3;
  const looksLikeHeadlineOnly =
    /\b(lines?|starting goalie|goalie)\b/i.test(wrapperText) &&
    hasQuoteShortLink &&
    !hasStructuredNames &&
    !hasGoalieName &&
    !hasRosterMatches;

  return looksLikeHeadlineOnly;
}

function normalizeNameKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTextKey(value: string): string {
  return normalizeNameKey(value)
    .replace(/[^a-z0-9#@]+/g, " ")
    .trim();
}

function normalizeHandle(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^@/, "").toLowerCase();
  return normalized || null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesNormalizedLabel(text: string, label: string): boolean {
  return new RegExp(`(?:^|\\s)${escapeRegExp(label)}(?:$|\\s)`, "i").test(text);
}

function detectNonNhlLeague(text: string): string | null {
  const normalized = normalizeTextKey(text);
  if (/\b#?mbmoose\b/.test(normalized)) return "AHL";
  const match = normalized.match(/\b(ahl|echl|ohl|whl|qmjhl|ncaa)\b/);
  return match?.[1]?.toUpperCase() ?? null;
}

function buildTextSignals(text: string): LinesCccTextSignals {
  const inlineSignals = extractStructuredNameGroupsFromTweet(text);
  const parsedGroups = extractStructuredPlayerGroupsFromText(text);

  return {
    keywordHits: findGameDayTweetKeywordHits(text),
    structureSignals: {
      forwardLineCount: inlineSignals.forwardLineCount,
      defensePairCount: inlineSignals.defensePairCount,
      parsedForwardLines: parsedGroups.forwards.length,
      parsedDefensePairs: parsedGroups.defensePairs.length,
      parsedGoalieCount: parsedGroups.goalies.length,
    },
  };
}

function buildPrimaryTextMetadata(
  source: ParsedLinesCccSource,
): Record<string, unknown> {
  const wrapperText = source.enrichedText ?? source.rawText ?? null;
  const quotedText = source.quotedEnrichedText ?? source.quotedRawText ?? null;
  const primaryText =
    source.primaryTextSource === "quoted_oembed"
      ? (quotedText ?? wrapperText)
      : (wrapperText ?? quotedText);
  const wrapperSignals = wrapperText ? buildTextSignals(wrapperText) : null;
  const quotedSignals = quotedText ? buildTextSignals(quotedText) : null;
  const primarySignals = primaryText ? buildTextSignals(primaryText) : null;

  return {
    primaryText,
    primaryTextSource: source.primaryTextSource ?? null,
    primarySourceUrl:
      source.primaryTextSource === "quoted_oembed"
        ? (source.quotedTweetUrl ?? source.tweetUrl ?? null)
        : (source.tweetUrl ?? source.quotedTweetUrl ?? null),
    wrapperTextSource:
      source.primaryTextSource === "wrapper_oembed"
        ? "wrapper_oembed"
        : "wrapper",
    wrapperKeywordHits: wrapperSignals?.keywordHits ?? [],
    wrapperStructureSignals: wrapperSignals?.structureSignals ?? null,
    quotedKeywordHits: quotedSignals?.keywordHits ?? [],
    quotedStructureSignals: quotedSignals?.structureSignals ?? null,
    primaryKeywordHits: primarySignals?.keywordHits ?? [],
    primaryStructureSignals: primarySignals?.structureSignals ?? null,
    resolvedTweetUrls: {
      wrapperTweetUrl: source.tweetUrl ?? null,
      quotedTweetUrl: source.quotedTweetUrl ?? null,
      sourceUrl: source.sourceUrl ?? null,
    },
  };
}

function addMinutesIso(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60 * 1000).toISOString();
}

export function readLinesCccWrapperOEmbedBackfillState(
  rawPayload: Record<string, unknown> | null | undefined,
): LinesCccWrapperOEmbedBackfillState | null {
  const wrapper = (
    rawPayload?.linesCccOembed as Record<string, unknown> | undefined
  )?.wrapper as Record<string, unknown> | undefined;
  if (!wrapper || typeof wrapper !== "object") {
    return null;
  }

  return {
    status:
      wrapper.status === "success" ||
      wrapper.status === "failed" ||
      wrapper.status === "deferred_429" ||
      wrapper.status === "pending"
        ? wrapper.status
        : "pending",
    tweetId: typeof wrapper.tweetId === "string" ? wrapper.tweetId : null,
    tweetUrl: typeof wrapper.tweetUrl === "string" ? wrapper.tweetUrl : null,
    sourceTweetUrl:
      typeof wrapper.sourceTweetUrl === "string"
        ? wrapper.sourceTweetUrl
        : null,
    attemptCount:
      typeof wrapper.attemptCount === "number" &&
      Number.isFinite(wrapper.attemptCount)
        ? wrapper.attemptCount
        : 0,
    lastAttemptAt:
      typeof wrapper.lastAttemptAt === "string" ? wrapper.lastAttemptAt : null,
    nextAttemptAt:
      typeof wrapper.nextAttemptAt === "string" ? wrapper.nextAttemptAt : null,
    fetchedAt: typeof wrapper.fetchedAt === "string" ? wrapper.fetchedAt : null,
    httpStatus:
      typeof wrapper.httpStatus === "number" &&
      Number.isFinite(wrapper.httpStatus)
        ? wrapper.httpStatus
        : null,
    lastError: typeof wrapper.lastError === "string" ? wrapper.lastError : null,
    text: typeof wrapper.text === "string" ? wrapper.text : null,
    postedAt: typeof wrapper.postedAt === "string" ? wrapper.postedAt : null,
    postedLabel:
      typeof wrapper.postedLabel === "string" ? wrapper.postedLabel : null,
    authorName:
      typeof wrapper.authorName === "string" ? wrapper.authorName : null,
    authorHandle:
      typeof wrapper.authorHandle === "string" ? wrapper.authorHandle : null,
  };
}

export function shouldAttemptLinesCccWrapperOEmbedBackfill(args: {
  tweetId: string | null;
  tweetUrl: string | null;
  existingState: LinesCccWrapperOEmbedBackfillState | null;
  nowIso: string;
}): boolean {
  if (!args.tweetId || !args.tweetUrl) {
    return false;
  }

  if (!args.existingState) {
    return true;
  }

  if (
    args.existingState.status === "success" ||
    args.existingState.status === "failed"
  ) {
    return false;
  }

  if (!args.existingState.nextAttemptAt) {
    return true;
  }

  const nextAttemptAtMs = Date.parse(args.existingState.nextAttemptAt);
  const nowMs = Date.parse(args.nowIso);
  if (!Number.isFinite(nextAttemptAtMs) || !Number.isFinite(nowMs)) {
    return true;
  }

  return nextAttemptAtMs <= nowMs;
}

export function buildLinesCccWrapperOEmbedDeferredState(args: {
  tweetId: string | null;
  tweetUrl: string | null;
  existingState: LinesCccWrapperOEmbedBackfillState | null;
  nowIso: string;
  httpStatus: number | null;
  error: string;
}): LinesCccWrapperOEmbedBackfillState {
  const attemptCount = (args.existingState?.attemptCount ?? 0) + 1;
  const backoffMinutes = Math.min(5 * 2 ** (attemptCount - 1), 360);

  return {
    status: "deferred_429",
    tweetId: args.tweetId,
    tweetUrl: args.tweetUrl,
    attemptCount,
    lastAttemptAt: args.nowIso,
    nextAttemptAt: addMinutesIso(args.nowIso, backoffMinutes),
    httpStatus: args.httpStatus,
    lastError: args.error,
  };
}

export function buildLinesCccWrapperOEmbedFailureState(args: {
  tweetId: string | null;
  tweetUrl: string | null;
  existingState: LinesCccWrapperOEmbedBackfillState | null;
  nowIso: string;
  httpStatus: number | null;
  error: string;
}): LinesCccWrapperOEmbedBackfillState {
  return {
    status: "failed",
    tweetId: args.tweetId,
    tweetUrl: args.tweetUrl,
    attemptCount: (args.existingState?.attemptCount ?? 0) + 1,
    lastAttemptAt: args.nowIso,
    httpStatus: args.httpStatus,
    lastError: args.error,
  };
}

export function buildLinesCccWrapperOEmbedSuccessState(args: {
  tweetId: string | null;
  tweetUrl: string | null;
  nowIso: string;
  data: LinesCccTweetOEmbedData;
  existingState: LinesCccWrapperOEmbedBackfillState | null;
}): LinesCccWrapperOEmbedBackfillState {
  return {
    status: "success",
    tweetId: args.tweetId,
    tweetUrl: args.tweetUrl,
    sourceTweetUrl: args.data.sourceTweetUrl,
    attemptCount: (args.existingState?.attemptCount ?? 0) + 1,
    lastAttemptAt: args.nowIso,
    fetchedAt: args.nowIso,
    httpStatus: 200,
    text: args.data.text,
    postedAt: args.data.postedAt,
    postedLabel: args.data.postedLabel,
    authorName: args.data.authorName,
    authorHandle: args.data.authorHandle,
  };
}

export function toLinesCccTweetOEmbedDataFromBackfillState(
  state: LinesCccWrapperOEmbedBackfillState | null,
): LinesCccTweetOEmbedData | null {
  if (!state || state.status !== "success" || !state.text) {
    return null;
  }

  return {
    text: state.text,
    postedAt: state.postedAt ?? null,
    postedLabel: state.postedLabel ?? null,
    sourceTweetUrl: state.sourceTweetUrl ?? null,
    authorName: state.authorName ?? null,
    authorHandle: state.authorHandle ?? null,
  };
}

function detectNonNhlHandle(args: {
  sourceHandles: Array<string | null | undefined>;
}): { league: string; matchedHandle: string } | null {
  for (const handle of args.sourceHandles) {
    const normalizedHandle = normalizeHandle(handle);
    if (!normalizedHandle) continue;

    for (const hint of NON_NHL_HANDLE_HINTS) {
      if (hint.pattern.test(normalizedHandle)) {
        return {
          league: hint.league,
          matchedHandle: normalizedHandle,
        };
      }
    }
  }

  return null;
}

function findLabelMatchedTeams(
  text: string,
  teams: TeamDirectoryEntry[],
): TeamDirectoryEntry[] {
  const normalized = normalizeTextKey(text);
  return teams.filter((team) => {
    const labels = [
      team.name,
      team.abbreviation,
      team.shortName,
      team.location,
      `${team.location ?? ""} ${team.shortName ?? ""}`.trim(),
      ...team.hashtags,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => normalizeTextKey(value))
      .filter(Boolean);

    return labels.some((label) => includesNormalizedLabel(normalized, label));
  });
}

function buildTeamTextLabels(team: TeamDirectoryEntry): string[] {
  return [
    team.name,
    team.abbreviation,
    team.shortName,
    team.location,
    `${team.location ?? ""} ${team.shortName ?? ""}`.trim(),
    ...team.hashtags,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeTextKey(value))
    .filter(Boolean);
}

function findTeamMentionInText(
  text: string,
  teams: TeamDirectoryEntry[],
): TeamDirectoryEntry | null {
  const normalized = normalizeTextKey(text);
  const hintedTeams = Object.entries(NHL_TEXT_HINTS)
    .filter(([hint]) => includesNormalizedLabel(normalized, hint))
    .map(
      ([, abbreviation]) =>
        teams.find((team) => team.abbreviation === abbreviation) ?? null,
    )
    .filter((team): team is TeamDirectoryEntry => Boolean(team));
  const uniqueHintedTeams = new Map(hintedTeams.map((team) => [team.id, team]));
  if (uniqueHintedTeams.size === 1) {
    return Array.from(uniqueHintedTeams.values())[0]!;
  }

  const labelTeams = teams.filter((team) =>
    buildTeamTextLabels(team).some((label) =>
      includesNormalizedLabel(normalized, label),
    ),
  );
  const matches = [...hintedTeams, ...labelTeams];
  const uniqueMatches = new Map(matches.map((team) => [team.id, team]));
  return uniqueMatches.size === 1
    ? Array.from(uniqueMatches.values())[0]!
    : null;
}

function resolveTeamFromLeadVsText(
  text: string,
  teams: TeamDirectoryEntry[],
): TeamDirectoryEntry | null {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? text;
  const leadMatch = firstLine.match(/^(.+?)\b(?:vs\.?|versus|against|at)\b/i);
  if (!leadMatch?.[1]) return null;

  const leadText = leadMatch[1]
    .replace(
      /\b(lines?|lineup|rushes|warmups?|projected|unchanged|confirmed)\b/gi,
      " ",
    )
    .trim();
  return findTeamMentionInText(leadText, teams);
}

function resolveTeamFromHandleHints(
  handles: Array<string | null | undefined>,
  teams: TeamDirectoryEntry[],
): TeamDirectoryEntry | null {
  const hintedTeams = handles
    .map((handle) => normalizeHandle(handle))
    .filter((handle): handle is string => Boolean(handle))
    .map((handle) => NHL_HANDLE_HINTS[handle])
    .filter((abbreviation): abbreviation is string => Boolean(abbreviation))
    .map(
      (abbreviation) =>
        teams.find((team) => team.abbreviation === abbreviation) ?? null,
    )
    .filter((team): team is TeamDirectoryEntry => Boolean(team));

  const uniqueHintedTeams = new Map(hintedTeams.map((team) => [team.id, team]));
  return uniqueHintedTeams.size === 1
    ? Array.from(uniqueHintedTeams.values())[0]!
    : null;
}

type TeamResolutionScore = {
  team: TeamDirectoryEntry;
  rosterMatchCount: number;
  exactFullNameMatchCount: number;
  supportScore: number;
  totalScore: number;
};

function countMatchedTeamLabels(args: {
  normalizedText: string;
  labels: string[];
}): number {
  return args.labels.filter((label) =>
    includesNormalizedLabel(args.normalizedText, label),
  ).length;
}

function buildTeamResolutionScores(args: {
  text: string;
  teams: TeamDirectoryEntry[];
  rosterByTeam: Map<number, RosterNameEntry[]>;
  leadVsTeam: TeamDirectoryEntry | null;
  handleHintTeam: TeamDirectoryEntry | null;
}): TeamResolutionScore[] {
  const normalizedText = normalizeTextKey(args.text);
  const textHintAbbreviations = new Set(
    Object.entries(NHL_TEXT_HINTS)
      .filter(([hint]) => includesNormalizedLabel(normalizedText, hint))
      .map(([, abbreviation]) => abbreviation),
  );

  return args.teams
    .map((team) => {
      const rosterEntries = args.rosterByTeam.get(team.id) ?? [];
      const matched = matchRosterNamesInTweet(args.text, rosterEntries);
      const exactFullNameMatchCount = rosterEntries.filter((rosterEntry) =>
        includesNormalizedLabel(
          normalizedText,
          normalizeTextKey(rosterEntry.fullName),
        ),
      ).length;
      const hashtagMatchCount = countMatchedTeamLabels({
        normalizedText,
        labels: team.hashtags.map((hashtag) => normalizeTextKey(hashtag)),
      });
      const genericLabelMatchCount = countMatchedTeamLabels({
        normalizedText,
        labels: [
          team.name,
          team.abbreviation,
          team.shortName,
          team.location,
          `${team.location ?? ""} ${team.shortName ?? ""}`.trim(),
        ]
          .filter((value): value is string => Boolean(value))
          .map((value) => normalizeTextKey(value)),
      });
      const textHintMatched = textHintAbbreviations.has(team.abbreviation);
      const leadVsMatched = args.leadVsTeam?.id === team.id;
      const handleHintMatched = args.handleHintTeam?.id === team.id;
      const supportScore =
        hashtagMatchCount * 3 +
        genericLabelMatchCount * 2 +
        (textHintMatched ? 2 : 0) +
        (handleHintMatched ? 4 : 0) +
        (leadVsMatched ? 1 : 0);

      return {
        team,
        rosterMatchCount: matched.matchedPlayerIds.length,
        exactFullNameMatchCount,
        supportScore,
        totalScore:
          matched.matchedPlayerIds.length * 10 +
          exactFullNameMatchCount * 4 +
          supportScore,
      };
    })
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }
      if (right.rosterMatchCount !== left.rosterMatchCount) {
        return right.rosterMatchCount - left.rosterMatchCount;
      }
      return right.supportScore - left.supportScore;
    });
}

function resolveTeamFromRosterDensity(args: {
  text: string;
  teams: TeamDirectoryEntry[];
  rosterByTeam: Map<number, RosterNameEntry[]>;
  leadVsTeam: TeamDirectoryEntry | null;
  handleHintTeam: TeamDirectoryEntry | null;
  classification: GameDayTweetsClassification | null | undefined;
}): TeamDirectoryEntry | null {
  const scores = buildTeamResolutionScores(args);
  const best = scores[0];
  const second = scores[1];
  if (!best) {
    return null;
  }

  const rosterLead = best.rosterMatchCount - (second?.rosterMatchCount ?? 0);
  const scoreLead = best.totalScore - (second?.totalScore ?? 0);
  const hasSupport = best.supportScore > 0;
  const hasExactFullName = best.exactFullNameMatchCount >= 1;
  const supportedRosterMatch =
    best.rosterMatchCount >= 1 &&
    rosterLead >= 1 &&
    hasSupport &&
    scoreLead >= 2;
  const decisiveRosterOnlyGoalieMatch =
    best.rosterMatchCount >= 2 && rosterLead >= 2 && scoreLead >= 8;
  const supportedLineupMatch =
    best.rosterMatchCount >= 2 &&
    rosterLead >= 1 &&
    hasSupport &&
    scoreLead >= 4;
  const confirmedLineupMatch =
    best.rosterMatchCount >= 4 && rosterLead >= 2 && scoreLead >= 4;
  const decisiveRosterOnlyLineupMatch =
    best.rosterMatchCount >= 3 && rosterLead >= 2 && scoreLead >= 8;

  if (args.classification === "injury") {
    return hasExactFullName || supportedRosterMatch ? best.team : null;
  }

  if (args.classification === "goalie_start") {
    return hasExactFullName ||
      supportedRosterMatch ||
      decisiveRosterOnlyGoalieMatch
      ? best.team
      : null;
  }

  return confirmedLineupMatch ||
    supportedLineupMatch ||
    decisiveRosterOnlyLineupMatch
    ? best.team
    : null;
}

/**
 * "Cole Reinhardt: Line Change: Reinhardt will draw back into the lineup vs. Washington" is news about the lead player:
 * the subject is the one team whose roster has that exact full name. A team named only after "vs.", "against", "at" or
 * "@" is the opponent. Any other team mention (a trade destination, a second team) leaves the existing rules to decide.
 */
function resolveTeamFromLeadPlayerItem(args: {
  text: string;
  teams: TeamDirectoryEntry[];
  rosterByTeam: Map<number, RosterNameEntry[]>;
}): TeamDirectoryEntry | null {
  const body = args.text.replace(/^RT\s+@[^:]+:\s*/i, "");
  const lead = body.match(/^([^\n:]{3,40}):\s/)?.[1];
  if (!lead) return null;
  const leadKey = normalizeTextKey(lead);
  const owners = args.teams.filter((team) =>
    (args.rosterByTeam.get(team.id) ?? []).some((entry) => normalizeTextKey(entry.fullName) === leadKey));
  if (owners.length !== 1) return null;
  const subject = owners[0]!;
  let rest = ` ${normalizeTextKey(body.slice(lead.length + 1))} `;
  for (const team of args.teams) {
    if (team.id === subject.id) continue;
    const labels = [
      ...buildTeamTextLabels(team),
      ...Object.entries(NHL_TEXT_HINTS).filter(([, abbreviation]) => abbreviation === team.abbreviation).map(([hint]) => normalizeTextKey(hint)),
    ].filter(Boolean).sort((left, right) => right.length - left.length).map(escapeRegExp);
    if (labels.length) rest = rest.replace(new RegExp(`\\s(?:vs|versus|against|at|@)\\s*(?:the\\s+)?(?:${labels.join("|")})(?=\\s)`, "g"), " ");
  }
  const otherMention = findLabelMatchedTeams(rest, args.teams).some((team) => team.id !== subject.id)
    || (findTeamMentionInText(rest, args.teams)?.id ?? subject.id) !== subject.id;
  return otherMention ? null : subject;
}

export function resolveLinesCccTeam(args: {
  text: string;
  teams: TeamDirectoryEntry[];
  rosterByTeam?: Map<number, RosterNameEntry[]>;
  sourceHandles?: Array<string | null | undefined>;
  classification?: GameDayTweetsClassification | null;
}): TeamDirectoryEntry | null {
  const leadVsTeam = resolveTeamFromLeadVsText(args.text, args.teams);
  const labelMatches = findLabelMatchedTeams(args.text, args.teams);
  const handleHintTeam = resolveTeamFromHandleHints(
    args.sourceHandles ?? [],
    args.teams,
  );
  const textHintTeam = findTeamMentionInText(args.text, args.teams);

  if (args.rosterByTeam) {
    const rosterDensityTeam = resolveTeamFromRosterDensity({
      text: args.text,
      teams: args.teams,
      rosterByTeam: args.rosterByTeam,
      leadVsTeam,
      handleHintTeam,
      classification: args.classification,
    });
    if (rosterDensityTeam) {
      return rosterDensityTeam;
    }
    const leadPlayerTeam = resolveTeamFromLeadPlayerItem({ text: args.text, teams: args.teams, rosterByTeam: args.rosterByTeam });
    if (leadPlayerTeam) return leadPlayerTeam;
  }

  if (tweetPipelineFlags().interpretation && args.rosterByTeam) {
    const claims = extractTweetPlayerEvents({ text: args.text, players: [...args.rosterByTeam.values()].flat(), publishedAt: null });
    const goalieTeams = [...new Set(claims.filter((event) => event.kind === "goalie" && event.teamId != null).map((event) => event.teamId))];
    if (goalieTeams.length === 1) {
      const claimedTeam = args.teams.find((team) => team.id === goalieTeams[0]);
      if (claimedTeam && (!labelMatches.length || labelMatches.some((team) => team.id === claimedTeam.id))) return claimedTeam;
    }
  }

  if (
    textHintTeam &&
    labelMatches.length === 1 &&
    labelMatches[0]?.id === textHintTeam.id &&
    (!handleHintTeam || handleHintTeam.id === textHintTeam.id)
  ) {
    return textHintTeam;
  }
  if (
    leadVsTeam &&
    labelMatches.length === 1 &&
    labelMatches[0]?.id === leadVsTeam.id &&
    (!handleHintTeam || handleHintTeam.id === leadVsTeam.id)
  ) {
    return leadVsTeam;
  }
  if (textHintTeam && handleHintTeam && textHintTeam.id === handleHintTeam.id) {
    return textHintTeam;
  }
  if (leadVsTeam && handleHintTeam && leadVsTeam.id === handleHintTeam.id) {
    return leadVsTeam;
  }
  if (
    handleHintTeam &&
    labelMatches.length === 0 &&
    !textHintTeam &&
    args.classification !== "other"
  ) {
    return handleHintTeam;
  }
  if (
    !args.rosterByTeam &&
    handleHintTeam &&
    labelMatches.length === 1 &&
    labelMatches[0]?.id === handleHintTeam.id
  ) {
    return handleHintTeam;
  }
  if (args.classification == null) {
    if (leadVsTeam) {
      return leadVsTeam;
    }
    if (labelMatches.length === 1) {
      return labelMatches[0]!;
    }
    if (textHintTeam && labelMatches.length === 0) {
      return textHintTeam;
    }
    if (handleHintTeam) {
      return handleHintTeam;
    }
  }

  return null;
}

export function getPrimaryTextForSource(source: ParsedLinesCccSource): string {
  if (source.primaryTextSource === "quoted_oembed") {
    return source.quotedEnrichedText ?? source.quotedRawText ?? "";
  }
  return source.enrichedText ?? source.rawText ?? "";
}

function extractGoalieName(text: string): string | null {
  const match = text.match(
    /starting goalie:\s*([^:\n]+?)(?:\s+https?:\/\/|$)/i,
  );
  return match?.[1]?.trim() ?? null;
}

function dedupeOrderedNames(names: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    const normalizedName = name ? normalizeNameKey(name) : "";
    if (!normalizedName || seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    result.push(name!.trim());
  }

  return result;
}

function canonicalizeNames(
  names: string[],
  rosterEntries: RosterNameEntry[],
  role?: PlayerSlotRole,
): string[] {
  return names.map(
    (name) =>
      resolveTweetNameToRosterEntry(name, rosterEntries, role)?.fullName ?? name,
  );
}

function parseNamedListFromLabel(args: {
  text: string;
  labelPattern: RegExp;
  rosterEntries: RosterNameEntry[];
}): string[] {
  const match = args.text.match(args.labelPattern);
  const rawValue = match?.[1]?.trim();
  if (!rawValue) return [];

  const names = rawValue
    .split(/\s*,\s*|\s*;\s*|\s+\/\s+|\s+\|\s+/)
    .map((name) => name.trim())
    .filter(Boolean);

  return dedupeOrderedNames(canonicalizeNames(names, args.rosterEntries));
}

function extractInjuryNames(args: {
  text: string;
  classification: GameDayTweetsClassification;
  rosterEntries: RosterNameEntry[];
}): string[] {
  if (args.classification !== "injury") {
    return [];
  }

  const orderedRosterHits = extractOrderedRosterHitsFromTweet(
    args.text,
    args.rosterEntries,
  ).slice(0, 4);
  if (orderedRosterHits.length > 0) {
    return orderedRosterHits;
  }

  const labeledNames = parseNamedListFromLabel({
    text: args.text,
    labelPattern:
      /\b(?:injured|injury|out|ir|injured reserve)\b[:\s-]+([^\n]+)/i,
    rosterEntries: args.rosterEntries,
  });
  if (labeledNames.length > 0) {
    return labeledNames;
  }

  return [];
}

function extractTransactionSignals(args: {
  text: string;
  rosterEntries: RosterNameEntry[];
}): Array<{ signal: string; playerName: string }> {
  const signalPatterns: Array<{ signal: string; pattern: RegExp }> = [
    {
      signal: "return",
      pattern: /\breturns?\b|\breturning\b|\bback in (?:the )?lineup\b/i,
    },
    {
      signal: "called_up",
      pattern: /\brecalled\b|\bcalled up\b|\bpromoted\b/i,
    },
    {
      signal: "sent_down",
      pattern: /\bassigned to\b|\bsent down\b|\bloaned\b/i,
    },
    {
      signal: "healthy_scratch",
      pattern:
        /\bhealthy scratch(?:ed)?\b|\bscratched\b|\bremoved from (?:the )?lineup\b/i,
    },
    {
      signal: "trade",
      pattern: /\btraded\b|\bacquired (?:in a trade|from)\b/i,
    },
    {
      signal: "waiver",
      pattern: /\bwaived\b|\bwaivers?\b|\bclaimed off waivers\b/i,
    },
    { signal: "signing", pattern: /\bsigned\b|\bsigns\b/i },
    { signal: "activated", pattern: /\bactivated\b/i },
    { signal: "ir", pattern: /\bplaced on (?:ir|injured reserve)\b/i },
  ];
  const pairs: Array<{ signal: string; playerName: string }> = [];
  const seen = new Set<string>();
  const addPairs = (text: string) => {
    const names = extractOrderedRosterHitsFromTweet(text, args.rosterEntries);
    if (names.length === 0) return;

    for (const { signal, pattern } of signalPatterns) {
      if (!pattern.test(text)) continue;
      for (const playerName of names.slice(0, 3)) {
        const key = `${signal}:${normalizeNameKey(playerName)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ signal, playerName });
      }
    }
  };

  for (const clause of args.text.split(/[,;\n]|(?<=[.!?])\s+/)) {
    addPairs(clause);
  }
  if (pairs.length === 0) addPairs(args.text);

  return pairs;
}

function detectPowerPlayUnitLabel(value: string): PowerPlayUnitLabel {
  const normalized = normalizeTextKey(value);
  if (
    /\b(?:pp\s*1|power play\s*1|power-play\s*1|first unit|top unit|unit 1|unite 1|premiere unite|première unité)\b/i.test(
      normalized,
    )
  ) {
    return "pp1";
  }
  if (
    /\b(?:pp\s*2|power play\s*2|power-play\s*2|second unit|unit 2|unite 2|deuxieme unite|deuxième unité)\b/i.test(
      normalized,
    )
  ) {
    return "pp2";
  }
  return null;
}

function extractPowerPlayUnits(args: {
  text: string;
  rosterEntries: RosterNameEntry[];
}): ExtractedPowerPlayUnits {
  const labeledUnits = Array.from(
    args.text.matchAll(/\b(?:pp|power\s*play)\s*([12])\b[:\s-]+([^\n]+)/gi),
  )
    .sort((left, right) => Number(left[1] ?? 9) - Number(right[1] ?? 9))
    .map((match) => ({
      label: `pp${match[1] ?? ""}` as PowerPlayUnitLabel,
      unit: canonicalizeNames(
        match[2]!
          .split(/\s*[-–—/\\•]\s*|\s*,\s*/)
          .map((name) => name.trim())
          .filter(Boolean),
        args.rosterEntries,
      ),
    }))
    .filter((entry) => entry.unit.length >= 3)
    .map((entry) => ({
      label: entry.label,
      unit: entry.unit.slice(0, 5),
    }));

  const groupedLineTokens = args.text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !/https?:|t\.co|pic\.twitter\.com|^#/.test(line) &&
        !/\b(power play|units?|advantage numérique|avantage numerique|jeu de puissance|vs\.?|contre)\b/i.test(
          line,
        ),
    )
    .flatMap((line) => {
      const parsed = extractStructuredPlayerGroupsFromText(
        line,
        args.rosterEntries,
      );
      return [
        ...parsed.forwards.map((group) =>
          canonicalizeNames(group, args.rosterEntries),
        ),
        ...parsed.defensePairs.map((group) =>
          canonicalizeNames(group, args.rosterEntries),
        ),
        ...parsed.goalies
          .map((name) => canonicalizeNames([name], args.rosterEntries))
          .filter((group) => group.length === 1),
      ];
    });

  const unlabeledUnits: Array<{ label: PowerPlayUnitLabel; unit: string[] }> =
    [];
  for (let index = 0; index <= groupedLineTokens.length - 3; index += 1) {
    const first = groupedLineTokens[index];
    const second = groupedLineTokens[index + 1];
    const third = groupedLineTokens[index + 2];
    if (first?.length === 1 && second?.length === 3 && third?.length === 1) {
      unlabeledUnits.push({
        label: null,
        unit: [...first, ...second, ...third],
      });
      index += 2;
    }
  }

  const dedupedUnits = [...labeledUnits, ...unlabeledUnits].reduce<
    Array<{ label: PowerPlayUnitLabel; unit: string[] }>
  >((units, unit) => {
    const normalizedKey = unit.unit
      .map((name) => normalizeNameKey(name))
      .join("|");
    if (
      normalizedKey &&
      !units.some(
        (existing) =>
          existing.unit.map((name) => normalizeNameKey(name)).join("|") ===
          normalizedKey,
      )
    ) {
      units.push(unit);
    }
    return units;
  }, []);

  if (dedupedUnits.length === 0) {
    const orderedRosterHits = dedupeOrderedNames(
      canonicalizeNames(
        extractOrderedRosterHitsFromTweet(args.text, args.rosterEntries),
        args.rosterEntries,
      ),
    );
    if (orderedRosterHits.length === 5 || orderedRosterHits.length === 10) {
      const units =
        orderedRosterHits.length === 10
          ? [orderedRosterHits.slice(0, 5), orderedRosterHits.slice(5, 10)]
          : [orderedRosterHits];
      return {
        units,
        labels:
          units.length === 2
            ? ["pp1", "pp2"]
            : [detectPowerPlayUnitLabel(args.text)],
      };
    }
  }

  const flattenedUnits = dedupedUnits
    .filter((entry) => entry.unit.length === 5 || entry.unit.length === 10)
    .flatMap((entry) =>
      entry.unit.length === 10
        ? [
            {
              label: "pp1" as PowerPlayUnitLabel,
              unit: entry.unit.slice(0, 5),
            },
            {
              label: "pp2" as PowerPlayUnitLabel,
              unit: entry.unit.slice(5, 10),
            },
          ]
        : [entry],
    )
    .slice(0, 2);

  return {
    units: flattenedUnits.map((entry) => entry.unit),
    labels:
      flattenedUnits.length === 2
        ? flattenedUnits.map(
            (entry, index) => entry.label ?? (index === 0 ? "pp1" : "pp2"),
          )
        : flattenedUnits.map(
            (entry) => entry.label ?? detectPowerPlayUnitLabel(args.text),
          ),
  };
}

function extractGoalieNameFromKeywordLine(args: {
  text: string;
  rosterEntries: RosterNameEntry[];
}): string | null {
  for (const line of args.text.split(/\n+/).map((value) => value.trim())) {
    if (
      !line ||
      !/\b(goalie|starter|starting|in net|gets the start|gets the nod|warmup)\b/i.test(
        line,
      )
    ) {
      continue;
    }

    const matchedNames = canonicalizeNames(
      extractOrderedRosterHitsFromTweet(line, args.rosterEntries),
      args.rosterEntries,
      "goalie",
    );
    if (matchedNames.length === 1) {
      const player = resolveTweetNameToRosterEntry(matchedNames[0]!, args.rosterEntries, "goalie");
      if (player && playerPositionRole(player) === "goalie") return player.fullName;
    }
  }

  return null;
}

export type RowGoalieState = {
  /** Roster name, or the literal text of a goalie slot that did not resolve (it keeps its slot, id null). */
  name: string;
  playerId: number | null;
  /** Event state, the row's own ✅/🅿️ marker, "listed" for an unmarked goalie row, "unresolved" for an unknown name. */
  state: "confirmed" | "likely" | "projected" | "observed" | "listed" | "unresolved" | "ruled_out";
  role: "starter" | "backup" | null;
  /** The goalie row's position in the tweet's list (1 = starter, 2 = backup), when it came from one. */
  slot: number | null;
  observation: TweetPlayerEvent["observation"] | null;
  source: "event" | "unit";
  /** False when the goalie is ruled out: kept for evidence, never stored as goalie_1/goalie_2. */
  stored: boolean;
};

const GOALIE_STATE_RANK: Record<string, number> = { confirmed: 0, likely: 1, projected: 2 };

/**
 * Row goalies from the interpretation, in this order: explicit confirmed or likely starts; then the tweet's goalie
 * rows in slot order (first listed = starter, second = backup), where an unresolved name keeps its slot as a
 * literal with no id; then projected starts and warmup/first-off observations; then backups. A ruled-out goalie is
 * never a row goalie. Every goalie's state is kept in `states` so a projected start is not read as a confirmed one.
 */
export function buildRowGoalies(args: { interpretation: TweetInterpretation; events: TweetPlayerEvent[]; rosterEntries: RosterNameEntry[] }) {
  const goalieEntry = (playerId: number) => args.rosterEntries.find((entry) => entry.playerId === playerId && entry.position === "G");
  const events = args.events.filter((event) => event.kind === "goalie" && goalieEntry(event.playerId));
  const ruledOut = new Set(events.filter((event) => event.state === "ruled_out").map((event) => event.playerId));
  for (const event of events) if (event.state !== "ruled_out") ruledOut.delete(event.playerId);
  const rank = (event: TweetPlayerEvent) => event.observation ? 3 : GOALIE_STATE_RANK[event.state] ?? 2;
  const live = events.filter((event) => event.state !== "ruled_out");
  const starters = live.filter((event) => event.goalieRole !== "backup").map((event, index) => ({ event, index }))
    .sort((left, right) => rank(left.event) - rank(right.event) || left.index - right.index).map(({ event }) => event);
  const backups = live.filter((event) => event.goalieRole === "backup");
  const states: RowGoalieState[] = [];
  const add = (state: Omit<RowGoalieState, "stored" | "name"> & { name?: string }) => {
    if (state.playerId == null) {
      if (state.name) states.push({ ...state, name: state.name, stored: true });
      return;
    }
    const entry = goalieEntry(state.playerId);
    if (!entry || states.some((existing) => existing.playerId === state.playerId)) return;
    states.push({ ...state, name: entry.fullName, stored: !ruledOut.has(state.playerId) });
  };
  const eventState = (event: TweetPlayerEvent): RowGoalieState["state"] =>
    event.state === "confirmed" || event.state === "likely" || event.state === "projected" || event.state === "observed" || event.state === "ruled_out" ? event.state : "projected";
  const fromEvent = (event: TweetPlayerEvent, role: RowGoalieState["role"]) =>
    add({ playerId: event.playerId, state: eventState(event), role, slot: null, observation: event.observation ?? null, source: "event" });
  for (const event of starters) if (rank(event) < 2) fromEvent(event, event.goalieRole ?? "starter");
  const slots = [
    ...args.interpretation.units.filter((unit) => unit.situation === "goalie" && unit.complete)
      .flatMap((unit) => unit.players.map((player) => ({ slot: unit.number, playerId: player.playerId as number | null, name: undefined as string | undefined, state: (unit.sourceMarker?.certainty ?? "listed") as RowGoalieState["state"] }))),
    ...args.interpretation.unresolved.filter((entry) => entry.situation === "goalie" && entry.number != null)
      .map((entry) => ({ slot: entry.number!, playerId: null, name: entry.text, state: "unresolved" as const })),
  ].sort((left, right) => (left.slot ?? Infinity) - (right.slot ?? Infinity));
  const listed = slots.filter((slot) => slot.slot != null).length > 1;
  for (const { slot, playerId, name, state } of slots) {
    add({ playerId, name, state, role: listed && slot === 1 ? "starter" : listed && slot === 2 ? "backup" : null, slot, observation: null, source: "unit" });
  }
  for (const event of starters) if (rank(event) >= 2) fromEvent(event, event.goalieRole ?? "starter");
  for (const event of backups) fromEvent(event, "backup");
  for (const event of events) if (ruledOut.has(event.playerId)) add({ playerId: event.playerId, state: "ruled_out", role: event.goalieRole ?? null, slot: null, observation: event.observation ?? null, source: "event" });
  return { goalies: states.filter((state) => state.stored).map((state) => state.name), states };
}

function buildStructuredContent(args: {
  publishedAt?: string | null;
  text: string;
  classification: GameDayTweetsClassification;
  rosterEntries: RosterNameEntry[];
  eventPlayers?: RosterNameEntry[];
}): Pick<
  ParsedLinesCccSource,
  | "forwards"
  | "defensePairs"
  | "goalies"
  | "scratches"
  | "injuries"
  | "metadata"
> {
  const structured = extractStructuredPlayerGroupsFromText(
    args.text,
    args.rosterEntries,
  );
  const namesHaveRole = (names: string[], role: "es_forward" | "es_defense" | "goalie") => rosterNamesHaveRole(names, args.rosterEntries, role);
  let forwards = structured.forwards
    .map((line) => canonicalizeNames(line, args.rosterEntries, "es_forward"))
    .filter((line) => line.length === 3 && namesHaveRole(line, "es_forward"));
  let defensePairs = structured.defensePairs
    .map((pair) => canonicalizeNames(pair, args.rosterEntries, "es_defense"))
    .filter((pair) => pair.length === 2 && namesHaveRole(pair, "es_defense"));
  // A power play is a sub-unit of the lineup: its tweet keeps its goalie rows.
  let goalies =
      structured.goalies
          .map((name) => {
            const resolvedRosterEntry = resolveTweetNameToRosterEntry(
              name,
              args.rosterEntries,
              "goalie",
            );
            const hasHeadingKeywords =
              /\b(lines?|pairings|power play|pp1|pp2|injury|update|goalie|starter|starting|net)\b/i.test(
                name,
              );
            if (!resolvedRosterEntry && hasHeadingKeywords) {
              return null;
            }
            return resolvedRosterEntry && playerPositionRole(resolvedRosterEntry) === "goalie" ? resolvedRosterEntry.fullName : null;
          })
          .filter((name): name is string => Boolean(name))
          .filter(Boolean);
  const standaloneResolvedGoalies =
      args.text
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .filter((line) => !/[-–—/\\•]/.test(line))
          .filter(
            (line) =>
              !/\b(lines?|pairings|power play|pp1|pp2|injury|update)\b/i.test(
                line,
              ),
          )
          .map(
            (line) =>
              namesHaveRole([line], "goalie") ? resolveTweetNameToRosterEntry(line, args.rosterEntries, "goalie")!.fullName : null,
          )
          .filter((name): name is string => Boolean(name));

  const extractedGoalieName = extractGoalieName(args.text);
  const inferredGoalieName =
    extractedGoalieName ??
    extractGoalieNameFromKeywordLine({
      text: args.text,
      rosterEntries: args.rosterEntries,
    });
  if (inferredGoalieName) {
    const canonicalGoalieName =
      resolveTweetNameToRosterEntry(inferredGoalieName, args.rosterEntries, "goalie")
        ?.fullName ?? inferredGoalieName;
    goalies = dedupeOrderedNames([
      ...(namesHaveRole([canonicalGoalieName], "goalie") ? [canonicalGoalieName] : []),
      ...goalies,
      ...standaloneResolvedGoalies,
    ]).slice(0, 2);
  } else {
    goalies = dedupeOrderedNames([
      ...goalies,
      ...standaloneResolvedGoalies,
    ]).slice(0, 2);
  }

  let scratches = parseNamedListFromLabel({
    text: args.text,
    labelPattern: /\b(?:scratched|scratches)\b[:\s-]+([^\n]+)/i,
    rosterEntries: args.rosterEntries,
  });
  for (const match of args.text.matchAll(/^(.+?)\s+(?:are|is)\s+(?:the\s+)?extras?[.!]?\s*$/gim)) {
    const extras = segmentPlayerRow(match[1]!, args.rosterEntries);
    if (extras) scratches = dedupeOrderedNames([...scratches, ...extras.map((hit) => hit.player.fullName)]);
  }
  let injuries = extractInjuryNames({
    text: args.text,
    classification: args.classification,
    rosterEntries: args.rosterEntries,
  });
  const powerPlayDetection =
    args.classification === "power_play"
      ? extractPowerPlayUnits({
          text: args.text,
          rosterEntries: args.rosterEntries,
        })
      : { units: [], labels: [] };
  const transactionSignals = extractTransactionSignals({
    text: args.text,
    rosterEntries: args.rosterEntries,
  });

  const interpretation = tweetPipelineFlags().interpretation ? interpretTweetUnits(args.text, args.rosterEntries) : null;
  const eventPlayers = interpretation ? (args.eventPlayers ?? args.rosterEntries).filter((player) =>
    surnameMentionPresent(args.text, player.lastName) || [player.fullName, ...(player.aliases ?? [])].some((name) => identityMentionPresent(args.text, name))) : [];
  const playerEvents = interpretation ? extractTweetPlayerEvents({ text: args.text, players: eventPlayers, publishedAt: args.publishedAt ?? null,
    includeClaimAnchors: process.env.TWEET_CLAIMS_MODE === "shadow" }).concat(lineupChangeEvents(args.text, interpretation.changes)) : [];
  const participationObservations = interpretation ? [] : extractTweetPlayerEvents({ text: args.text, players: args.rosterEntries, publishedAt: args.publishedAt ?? null })
    .filter((event) => event.kind === "participation" && event.state === "observed" && event.modality === "negated");
  let goalieStates: RowGoalieState[] | null = null;
  if (interpretation) {
    scratches = interpretation.units.filter((unit) => unit.situation === "scratch" && unit.complete).flatMap((unit) => unit.players.map((player) => player.name));
    injuries = playerEvents.filter((event) => event.kind === "injury" && (event.availability === "out" || ["new_injury", "ongoing", "setback"].includes(event.state))).flatMap((event) => args.rosterEntries.filter((entry) => entry.playerId === event.playerId).map((entry) => entry.fullName));
    forwards = interpretation.units.filter((unit) => unit.situation === "es_forward" && unit.complete).map((unit) => unit.players.map((player) => player.name));
    defensePairs = interpretation.units.filter((unit) => unit.situation === "es_defense" && unit.complete).map((unit) => unit.players.map((player) => player.name));
    const rowGoalies = buildRowGoalies({ interpretation, events: playerEvents, rosterEntries: args.rosterEntries });
    goalies = rowGoalies.goalies;
    goalieStates = rowGoalies.states;
    powerPlayDetection.units = interpretation.units.filter((unit) => unit.situation === "pp" && unit.complete).map((unit) => unit.players.map((player) => player.name));
    powerPlayDetection.labels = interpretation.units.filter((unit) => unit.situation === "pp" && unit.complete).map((unit) => unit.number === 1 ? "pp1" : unit.number === 2 ? "pp2" : null);
  }
  return {
    forwards,
    defensePairs,
    goalies,
    scratches,
    injuries,
    metadata: {
      ...(participationObservations.length ? { participationObservations } : {}),
      ...(interpretation ? { interpretation: {
        ...interpretation, events: playerEvents,
        identityContext: {
          basis: "current_membership", sourcePublishedAt: args.publishedAt ?? null,
          eventRosterRevision: eventPlayers.map((player) => [player.playerId, player.fullName, player.lastName, player.teamId, player.position, ...(player.aliases ?? [])].join(":")).sort().join("|"),
        },
      } } : {}),
      ...(interpretation ? { goalieStates: goalieStates ?? [] } : {}),
      powerPlayUnits: powerPlayDetection.units,
      powerPlayUnitLabels: powerPlayDetection.labels,
      transactionSignals,
    },
  };
}

/**
 * Where a queued tweet came from, read only from what intake stored. FxTwitter rows (raw_payload.provider
 * "fxtwitter", written by supabase/functions/x-timeline-poll toQueueRow) carry the status as raw_payload.fx: a repost
 * arrives as the original (its id, author and clock) with reposted_by set, or, when unhydrated, as the "RT @x:" wrapper
 * itself. IFTTT rows only expose the relaying account and an "RT @x:" prefix. The relaying account is never returned
 * as the original author. `dedupKey` keys reposts on the original tweet id, so a relay and its original collapse.
 */
export type TweetSourceProvenance = {
  provider: "fxtwitter" | "ifttt";
  postKind: "post" | "repost" | "repost_wrapper" | "quote";
  originalAuthor: string | null;
  originalAuthorName: string | null;
  relayAccount: string | null;
  originalTweetId: string | null;
  relayTweetId: string | null;
  dedupKey: string | null;
  quotedTweetId: string | null;
  quotedAuthor: string | null;
  quotedText: string | null;
  altTexts: string[];
  publishedAt: string | null;
  publicationTimeBasis: "provider_timestamp" | "tweet_id_or_unknown";
  /** True only when publishedAt is the original post's own clock (not a relay's). */
  timestampIsOriginal: boolean;
  ingestedAt: string;
  ingestedAtBasis: "first_seen_at" | "received_at";
};

const PROVENANCE_HANDLE = /^@?([A-Za-z0-9_]{1,15})$/;
const provenanceHandle = (value: unknown) => typeof value === "string" ? value.match(PROVENANCE_HANDLE)?.[1] ?? null : null;
const provenanceId = (value: unknown) => typeof value === "string" && /^\d+$/.test(value) ? value : typeof value === "number" && Number.isSafeInteger(value) ? String(value) : null;
const sameHandle = (left: string | null, right: string | null) => !!left && !!right && left.toLowerCase() === right.toLowerCase();

export function buildTweetSourceProvenance(event: LinesCccIftttEventInput): TweetSourceProvenance {
  const raw = (event.raw_payload ?? {}) as Record<string, any>;
  const fx = raw.provider === "fxtwitter" && raw.fx && typeof raw.fx === "object" ? raw.fx as Record<string, any> : null;
  const account = provenanceHandle(event.source_account) ?? provenanceHandle(event.username);
  const publishedAt = normalizeTweetPostedAt(event.tweet_created_at);
  const firstSeen = [raw.first_seen_at, fx?.first_seen_at].find((value) => typeof value === "string" && Number.isFinite(Date.parse(value))) as string | undefined;
  const base = {
    publishedAt, publicationTimeBasis: publishedAt ? "provider_timestamp" as const : "tweet_id_or_unknown" as const,
    ingestedAt: firstSeen ?? event.received_at, ingestedAtBasis: firstSeen ? "first_seen_at" as const : "received_at" as const,
  };
  const rtAuthor = (text: unknown) => typeof text === "string" ? provenanceHandle(text.match(/^\s*RT @([A-Za-z0-9_]{1,15}):/)?.[1]) : null;
  const dedup = (original: string | null, relay: string | null) => original ? `tweet:${original}` : relay ? `relay:${relay}` : null;
  if (fx) {
    const author = provenanceHandle(fx.author?.screen_name);
    const repostedBy = provenanceHandle(fx.reposted_by?.screen_name);
    const wrapperId = provenanceId(fx.repost_wrapper_id);
    const statusId = provenanceId(fx.id) ?? provenanceId(event.tweet_id);
    const quote = fx.quote && typeof fx.quote === "object" ? fx.quote as Record<string, any> : null;
    const summary = raw.quote && typeof raw.quote === "object" ? raw.quote as Record<string, any> : null;
    const quoted = {
      quotedTweetId: provenanceId(summary?.id) ?? provenanceId(quote?.id),
      quotedAuthor: provenanceHandle(summary?.author_handle) ?? provenanceHandle(quote?.author?.screen_name),
      quotedText: typeof summary?.text === "string" ? summary.text : typeof (quote?.raw_text?.text ?? quote?.text) === "string" ? quote!.raw_text?.text ?? quote!.text : null,
    };
    const media = Array.isArray(fx.media?.all) ? fx.media.all : [];
    const altTexts = media.map((item: any) => item?.altText ?? item?.alt_text).filter((alt: unknown): alt is string => typeof alt === "string" && alt.trim() !== "");
    const wrapped = sameHandle(author, account) ? rtAuthor(fx.raw_text?.text ?? fx.text) : null;
    if (wrapped) {
      // The unhydrated wrapper: id, text and clock are the relay's; the original id is not known yet.
      return { provider: "fxtwitter", postKind: "repost_wrapper", originalAuthor: wrapped, originalAuthorName: null, relayAccount: author,
        originalTweetId: null, relayTweetId: statusId, dedupKey: dedup(null, statusId), ...quoted, altTexts, ...base, timestampIsOriginal: false };
    }
    const repost = !!author && !sameHandle(author, account) && (!!repostedBy || !!wrapperId);
    return { provider: "fxtwitter", postKind: repost ? "repost" : quoted.quotedTweetId ? "quote" : "post",
      originalAuthor: author, originalAuthorName: typeof fx.author?.name === "string" ? fx.author.name : null,
      relayAccount: repost ? repostedBy ?? account : null, originalTweetId: statusId, relayTweetId: repost ? wrapperId : null,
      dedupKey: dedup(statusId, null), ...quoted, altTexts, ...base, timestampIsOriginal: !!publishedAt };
  }
  const tweetId = provenanceId(event.tweet_id) ?? extractTweetIdFromUrl(event.link_to_tweet);
  const relayed = rtAuthor(event.text);
  if (relayed) {
    return { provider: "ifttt", postKind: "repost", originalAuthor: relayed, originalAuthorName: null, relayAccount: account,
      originalTweetId: null, relayTweetId: tweetId, dedupKey: dedup(null, tweetId), quotedTweetId: null, quotedAuthor: null, quotedText: null,
      altTexts: [], ...base, timestampIsOriginal: false };
  }
  return { provider: "ifttt", postKind: "post", originalAuthor: account, originalAuthorName: null, relayAccount: null,
    originalTweetId: tweetId, relayTweetId: null, dedupKey: dedup(tweetId, null), quotedTweetId: null, quotedAuthor: null, quotedText: null,
    altTexts: [], ...base, timestampIsOriginal: !!publishedAt };
}

export function buildLinesCccSourceFromIftttEvent(args: {
  event: LinesCccIftttEventInput;
  snapshotDate: string;
  teams: TeamDirectoryEntry[];
  rosterByTeam: Map<number, RosterNameEntry[]>;
  gameIdByTeamId?: Map<number, number>;
}): ParsedLinesCccSource {
  const text = args.event.text?.trim() ?? "";
  const classification = classifyGameDayTweet(text);
  const tweetId =
    args.event.tweet_id ?? extractTweetIdFromUrl(args.event.link_to_tweet);
  const tweetUrl = normalizeTweetStatusUrl(args.event.link_to_tweet, tweetId);
  const sourceHandles = [args.event.username, args.event.source_account];
  const labelMatchedTeams = text ? findLabelMatchedTeams(text, args.teams) : [];
  const nonNhlHandleMatch = detectNonNhlHandle({
    sourceHandles,
  });
  const detectedNonNhlLeague =
    detectNonNhlLeague(text) ?? nonNhlHandleMatch?.league ?? null;
  const team = detectedNonNhlLeague
    ? null
    : resolveLinesCccTeam({
        text,
        teams: args.teams,
        rosterByTeam: args.rosterByTeam,
        sourceHandles,
        classification,
      });
  const rosterEntries = team ? (args.rosterByTeam.get(team.id) ?? []) : [];
  const matched = matchRosterNamesInTweet(text, rosterEntries);
  const goalieName = extractGoalieName(text);
  const goalieIdentity = goalieName ? resolveTweetNameToRosterEntry(goalieName, rosterEntries, "goalie") : null;
  const structuredContent = buildStructuredContent({
    text,
    publishedAt: args.event.tweet_created_at,
    classification,
    rosterEntries,
    eventPlayers: [...args.rosterByTeam.values()].flat(),
  });
  const nhlFilterStatus: LinesCccNhlFilterStatus = !text
    ? "rejected_insufficient_text"
    : detectedNonNhlLeague
      ? "rejected_non_nhl"
      : team
        ? "accepted"
        : "rejected_ambiguous";
  const nhlFilterReason =
    nhlFilterStatus === "accepted"
      ? null
      : nhlFilterStatus === "rejected_non_nhl"
        ? detectedNonNhlLeague === nonNhlHandleMatch?.league &&
          !detectNonNhlLeague(text)
          ? "minor_league_source_handle"
          : "explicit_non_nhl_league_marker"
        : nhlFilterStatus === "rejected_insufficient_text"
          ? "missing_text"
          : labelMatchedTeams.length > 1
            ? "ambiguous_multiple_team_labels"
            : "no_single_nhl_team_match";
  const textSignals = buildTextSignals(text);

  const source: ParsedLinesCccSource = {
    snapshotDate: args.snapshotDate,
    observedAt: args.event.received_at,
    tweetPostedAt: normalizeTweetPostedAt(args.event.tweet_created_at) ??
      tweetPublicationFromUrl(args.event.link_to_tweet),
    tweetPostedLabel: args.event.created_at_label,
    gameId: team ? (args.gameIdByTeamId?.get(team.id) ?? null) : null,
    team,
    sourceUrl: tweetUrl,
    sourceLabel: classification,
    sourceHandle: args.event.username ?? args.event.source_account,
    authorName: args.event.username,
    tweetId,
    tweetUrl,
    primaryTextSource: "ifttt_text",
    classification,
    detectedLeague: detectedNonNhlLeague ?? (team ? "NHL" : null),
    nhlFilterStatus,
    nhlFilterReason,
    rawText: text || null,
    enrichedText: text || null,
    keywordHits: textSignals.keywordHits,
    matchedPlayerIds: matched.matchedPlayerIds,
    matchedNames: matched.matchedNames,
    unmatchedNames: matched.unmatchedNames,
    forwards: structuredContent.forwards,
    defensePairs: structuredContent.defensePairs,
    goalies:
      (structuredContent.goalies ?? []).length > 0
        ? (structuredContent.goalies ?? [])
        : goalieIdentity && playerPositionRole(goalieIdentity) === "goalie" && !tweetPipelineFlags().interpretation
          ? [goalieIdentity.fullName]
          : [],
    scratches: structuredContent.scratches,
    injuries: structuredContent.injuries,
    rawPayload: args.event.raw_payload,
    metadata: {
      iftttEventId: args.event.id,
      iftttSource: args.event.source,
      iftttSourceAccount: args.event.source_account,
      publicationTimeBasis: normalizeTweetPostedAt(args.event.tweet_created_at)
        ? "provider_timestamp" : "tweet_id_or_unknown",
      sourceProvenance: buildTweetSourceProvenance(args.event),
      teamLabelMatches: labelMatchedTeams.map(
        (matchedTeam) => matchedTeam.abbreviation,
      ),
      nonNhlSourceHandle: nonNhlHandleMatch?.matchedHandle ?? null,
      initialStructureSignals: textSignals.structureSignals,
      ...structuredContent.metadata,
    },
  };

  if (tweetPipelineFlags().interpretation && (source.metadata?.interpretation as { context?: string } | undefined)?.context !== "game") source.gameId = null;

  return {
    ...source,
    metadata: {
      ...source.metadata,
      ...buildPrimaryTextMetadata(source),
    },
  };
}

export function refreshLinesCccSourceFromPrimaryText(args: {
  source: ParsedLinesCccSource;
  teams: TeamDirectoryEntry[];
  rosterByTeam: Map<number, RosterNameEntry[]>;
  gameIdByTeamId?: Map<number, number>;
}): ParsedLinesCccSource {
  const text = getPrimaryTextForSource(args.source).trim();
  if (!text) return args.source;
  const classification = classifyGameDayTweet(text);

  const sourceHandles = [
    args.source.sourceHandle,
    args.source.authorName,
    args.source.quotedAuthorHandle,
    args.source.quotedAuthorName,
  ];
  const labelMatchedTeams = findLabelMatchedTeams(text, args.teams);
  const nonNhlHandleMatch = detectNonNhlHandle({
    sourceHandles,
  });
  const detectedNonNhlLeague =
    detectNonNhlLeague(text) ?? nonNhlHandleMatch?.league ?? null;
  const team = detectedNonNhlLeague
    ? null
    : resolveLinesCccTeam({
        text,
        teams: args.teams,
        rosterByTeam: args.rosterByTeam,
        sourceHandles,
        classification,
      });
  const rosterEntries = team ? (args.rosterByTeam.get(team.id) ?? []) : [];
  const matched = matchRosterNamesInTweet(text, rosterEntries);
  const structuredContent = buildStructuredContent({
    text,
    publishedAt: args.source.tweetPostedAt,
    classification,
    rosterEntries,
    eventPlayers: [...args.rosterByTeam.values()].flat(),
  });
  const goalieName = extractGoalieName(text);
  const goalieIdentity = goalieName ? resolveTweetNameToRosterEntry(goalieName, rosterEntries, "goalie") : null;
  const nhlFilterStatus: LinesCccNhlFilterStatus = detectedNonNhlLeague
    ? "rejected_non_nhl"
    : team
      ? "accepted"
      : "rejected_ambiguous";
  const nhlFilterReason =
    nhlFilterStatus === "accepted"
      ? null
      : nhlFilterStatus === "rejected_non_nhl"
        ? detectedNonNhlLeague === nonNhlHandleMatch?.league &&
          !detectNonNhlLeague(text)
          ? "minor_league_source_handle"
          : "explicit_non_nhl_league_marker"
        : labelMatchedTeams.length > 1
          ? "ambiguous_multiple_team_labels"
          : "no_single_nhl_team_match";
  const textSignals = buildTextSignals(text);
  const refreshedSource: ParsedLinesCccSource = {
    ...args.source,
    gameId: team ? (args.gameIdByTeamId?.get(team.id) ?? null) : null,
    team,
    sourceLabel: classification,
    classification,
    detectedLeague: detectedNonNhlLeague ?? (team ? "NHL" : null),
    nhlFilterStatus,
    nhlFilterReason,
    keywordHits: textSignals.keywordHits,
    matchedPlayerIds: matched.matchedPlayerIds,
    matchedNames: matched.matchedNames,
    unmatchedNames: matched.unmatchedNames,
    forwards: structuredContent.forwards,
    defensePairs: structuredContent.defensePairs,
    goalies:
      (structuredContent.goalies ?? []).length > 0
        ? (structuredContent.goalies ?? [])
        : goalieIdentity && playerPositionRole(goalieIdentity) === "goalie" && !tweetPipelineFlags().interpretation
          ? [goalieIdentity.fullName]
          : [],
    scratches: structuredContent.scratches,
    injuries: structuredContent.injuries,
    metadata: {
      ...args.source.metadata,
      teamLabelMatches: labelMatchedTeams.map(
        (matchedTeam) => matchedTeam.abbreviation,
      ),
      nonNhlSourceHandle: nonNhlHandleMatch?.matchedHandle ?? null,
      refreshedFromPrimaryText: true,
      refreshedStructureSignals: textSignals.structureSignals,
      ...structuredContent.metadata,
    },
  };

  if (tweetPipelineFlags().interpretation && (refreshedSource.metadata?.interpretation as { context?: string } | undefined)?.context !== "game") refreshedSource.gameId = null;

  return {
    ...refreshedSource,
    metadata: {
      ...refreshedSource.metadata,
      ...buildPrimaryTextMetadata(refreshedSource),
    },
  };
}

/** One retained receipt may assert starters for both teams. Validate each
 * named claim independently while preserving the complete raw evidence. */
export function expandLinesCccGoalieClaims(args: {
  source: ParsedLinesCccSource;
  teams: TeamDirectoryEntry[];
  gameIdByTeamId?: Map<number, number>;
}): ParsedLinesCccSource[] {
  const source = args.source;
  const interpretation = source.metadata?.interpretation as TweetInterpretation | undefined;
  if (!interpretation || source.nhlFilterStatus === "rejected_non_nhl" || source.nhlFilterStatus === "rejected_insufficient_text"
    || interpretation.units.some((unit) => unit.situation === "es_forward" || unit.situation === "es_defense")) return [source];
  const claims = (interpretation.events ?? []).filter((event) => event.kind === "goalie" && event.teamId != null);
  const teamIds = [...new Set(claims.map((event) => event.teamId!))];
  if (!teamIds.length || teamIds.some((id) => !args.teams.some((team) => team.id === id))) return [source];
  if (claims.some((event) => {
    const labels = findLabelMatchedTeams(event.evidence.text, args.teams);
    return labels.length === 1 && labels[0]!.id !== event.teamId;
  })) return [source];
  return teamIds.map((teamId) => {
    const team = args.teams.find((entry) => entry.id === teamId)!;
    const events = (interpretation.events ?? []).filter((event) => event.teamId === teamId);
    const teamGoalies = events.filter((event) => event.kind === "goalie");
    const ruledOut = new Set(teamGoalies.filter((event) => event.state === "ruled_out").map((event) => event.playerId));
    for (const event of teamGoalies) if (event.state !== "ruled_out") ruledOut.delete(event.playerId);
    const rank = (event: TweetPlayerEvent) => event.observation ? 3 : GOALIE_STATE_RANK[event.state] ?? 2;
    const starters = teamGoalies.filter((event) => event.goalieRole !== "backup" && !ruledOut.has(event.playerId)).map((event, index) => ({ event, index }))
      .sort((left, right) => rank(left.event) - rank(right.event) || left.index - right.index).map(({ event }) => event);
    const ordered = [...starters, ...teamGoalies.filter((event) => event.goalieRole === "backup" && !ruledOut.has(event.playerId))];
    return { ...source, team, gameId: interpretation.context === "game" ? args.gameIdByTeamId?.get(teamId) ?? null : null,
      classification: "goalie_start", sourceLabel: "goalie_start", detectedLeague: "NHL", nhlFilterStatus: "accepted", nhlFilterReason: null,
      goalies: dedupeOrderedNames(ordered.map((event) => event.playerName)), forwards: [], defensePairs: [],
      matchedPlayerIds: [...new Set(events.map((event) => event.playerId))], matchedNames: dedupeOrderedNames(events.map((event) => event.playerName)),
      metadata: { ...source.metadata, claimTeamIds: teamIds, interpretation: { ...interpretation, events } },
    };
  });
}

function mapNamesToPlayerIdsOrdered(
  names: string[] | null,
  rosterEntries: RosterNameEntry[],
  role?: PlayerSlotRole,
): Array<number | null> | null {
  if (!names) return null;

  return names.map((name) => resolveTweetNameToRosterEntry(name, rosterEntries, role)?.playerId ?? null);
}

function toStoredForwardOrder(players: string[] | null): string[] | null {
  return players && players.length === 3
    ? [players[2]!, players[1]!, players[0]!]
    : players;
}

function toStoredDefenseOrder(players: string[] | null): string[] | null {
  return players && players.length === 2 ? [players[1]!, players[0]!] : players;
}

function normalizeTweetPostedAt(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const hasExplicitTimezone =
    /(?:z|gmt|utc)$/i.test(value.trim()) || /[+-]\d{2}:?\d{2}\b/.test(value);
  if (!hasExplicitTimezone) return null;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function tweetPublicationFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !/^(?:www\.)?(?:twitter\.com|x\.com)$/.test(url.hostname)) return null;
    const id = url.pathname.match(/^\/(?:[A-Za-z0-9_]+|i\/web)\/status(?:es)?\/(\d{15,20})\/?$/)?.[1];
    if (!id || BigInt(id) > BigInt("18446744073709551615")) return null;
    // X Snowflake creation time, not application receipt time. Keep IDs as strings:
    // https://github.com/twitter-archive/snowflake/blob/snowflake-2010/src/main/scala/com/twitter/service/snowflake/IdWorker.scala
    const timestamp = Number((BigInt(id) >> BigInt(22)) + BigInt("1288834974657"));
    return new Date(timestamp).toISOString();
  } catch {
    return null;
  }
}

function parseAuthorHandleFromUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const handle = url.pathname.split("/").filter(Boolean)[0] ?? null;
    return handle || null;
  } catch {
    return null;
  }
}

export async function fetchLinesCccTweetOEmbedData(
  tweetUrl: string,
): Promise<LinesCccTweetOEmbedData | null> {
  const result = await fetchLinesCccTweetOEmbedAttempt(tweetUrl);
  return result.ok ? result.data : null;
}

export async function fetchLinesCccTweetApiData(
  tweetId: string,
): Promise<LinesCccTweetOEmbedData | null> {
  const bearerToken =
    process.env.X_API_BEARER_TOKEN ?? process.env.X_BEARER_TOKEN ?? null;
  if (!bearerToken) return null;

  const endpoint = new URL(`https://api.x.com/2/tweets/${tweetId}`);
  endpoint.searchParams.set(
    "expansions",
    "author_id,referenced_tweets.id,referenced_tweets.id.author_id",
  );
  endpoint.searchParams.set(
    "tweet.fields",
    "author_id,created_at,referenced_tweets,text",
  );
  endpoint.searchParams.set("user.fields", "name,username");

  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${bearerToken}`,
      "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    data?: {
      id?: string;
      text?: string;
      author_id?: string;
      created_at?: string;
    };
    includes?: {
      users?: Array<{ id?: string; name?: string; username?: string }>;
    };
  };
  const post = payload.data;
  if (!post?.text) return null;
  const author = payload.includes?.users?.find(
    (user) => user.id && user.id === post.author_id,
  );

  return {
    text: post.text.trim() || null,
    postedAt: normalizeTweetPostedAt(post.created_at),
    postedLabel: null,
    sourceTweetUrl: author?.username
      ? `https://x.com/${author.username}/status/${tweetId}`
      : `https://twitter.com/i/web/status/${tweetId}`,
    authorName: author?.name?.trim() || null,
    authorHandle: author?.username?.trim() || null,
  };
}

export async function fetchLinesCccTweetOEmbedAttempt(
  tweetUrl: string,
): Promise<LinesCccTweetOEmbedAttemptResult> {
  const endpoint = `https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=${encodeURIComponent(tweetUrl)}`;
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    return {
      ok: false,
      httpStatus: response.status,
      retryable: response.status === 429,
      error: `oembed_http_${response.status}`,
    };
  }

  const payload = (await response.json()) as {
    html?: string;
    author_name?: string;
    author_url?: string;
  };
  if (!payload.html) {
    return {
      ok: false,
      httpStatus: response.status,
      retryable: false,
      error: "oembed_missing_html",
    };
  }

  const parsed = parseTweetOEmbedHtml(payload.html);
  if (!parsed.sourceTweetUrl || !tweetPublicationFromUrl(parsed.sourceTweetUrl) ||
      extractTweetIdFromUrl(parsed.sourceTweetUrl) !== extractTweetIdFromUrl(tweetUrl)) {
    return { ok: false, httpStatus: response.status, retryable: false, error: "oembed_tweet_identity_mismatch" };
  }
  return {
    ok: true,
    httpStatus: response.status,
    data: {
      text: parsed.text,
      // A date label has no time or timezone; it cannot establish publication.
      postedAt: tweetPublicationFromUrl(parsed.sourceTweetUrl),
      postedLabel: parsed.postedLabel,
      sourceTweetUrl: parsed.sourceTweetUrl,
      authorName: payload.author_name?.trim() || null,
      authorHandle: parseAuthorHandleFromUrl(payload.author_url),
    },
  };
}

export function applyLinesCccWrapperOEmbed(args: {
  source: ParsedLinesCccSource;
  oembedData: LinesCccTweetOEmbedData;
}): ParsedLinesCccSource {
  const nextSource: ParsedLinesCccSource = {
    ...args.source,
    enrichedText:
      args.oembedData.text ??
      args.source.enrichedText ??
      args.source.rawText ??
      null,
    tweetPostedAt:
      normalizeTweetPostedAt(args.source.tweetPostedAt) ??
      tweetPublicationFromUrl(args.oembedData.sourceTweetUrl) ?? null,
    tweetPostedLabel:
      args.oembedData.postedLabel ?? args.source.tweetPostedLabel ?? null,
    sourceUrl:
      args.oembedData.sourceTweetUrl ??
      args.source.sourceUrl ??
      args.source.tweetUrl ??
      null,
    authorName: args.oembedData.authorName ?? args.source.authorName ?? null,
    sourceHandle:
      args.oembedData.authorHandle ?? args.source.sourceHandle ?? null,
    primaryTextSource:
      args.oembedData.text && args.oembedData.text.trim()
        ? "wrapper_oembed"
        : (args.source.primaryTextSource ?? null),
  };

  return {
    ...nextSource,
    metadata: {
      ...nextSource.metadata,
      publicationTimeBasis: normalizeTweetPostedAt(args.source.tweetPostedAt)
        ? args.source.metadata?.publicationTimeBasis ?? "provider_timestamp" : "tweet_id_or_unknown",
      ...buildPrimaryTextMetadata(nextSource),
    },
  };
}

export async function resolveLinesCccQuotedTweet(args: {
  wrapperText: string;
}): Promise<LinesCccResolvedQuotedTweet | null> {
  const reference = await resolveTweetReferenceFromText(args.wrapperText);
  if (!reference) return null;

  const apiTweet = await fetchLinesCccTweetApiData(reference.tweetId);
  const quotedTweet =
    apiTweet ?? (await fetchLinesCccTweetOEmbedData(reference.normalizedUrl));

  return {
    quotedTweetId: reference.tweetId,
    quotedTweetUrl: reference.normalizedUrl,
    quotedText: quotedTweet?.text ?? null,
    quotedPostedAt: quotedTweet?.postedAt ?? null,
    quotedPostedLabel: quotedTweet?.postedLabel ?? null,
    quotedSourceTweetUrl: quotedTweet?.sourceTweetUrl ?? reference.resolvedUrl,
    quotedAuthorName: quotedTweet?.authorName ?? null,
    quotedAuthorHandle:
      quotedTweet?.authorHandle ?? reference.authorHandle ?? null,
    resolvedUrl: reference.resolvedUrl,
    shortUrl: reference.shortUrl,
    retrievalStatus: apiTweet
      ? "x_api_success"
      : quotedTweet
        ? "oembed_success"
        : "resolved_url_only",
  };
}

function shouldPreferQuotedTweetText(args: {
  source: ParsedLinesCccSource;
  quotedTweet: LinesCccResolvedQuotedTweet;
}): boolean {
  const wrapperText = args.source.enrichedText ?? args.source.rawText ?? "";
  const quotedText = args.quotedTweet.quotedText ?? "";

  if (!quotedText.trim()) return false;

  const wrapperHasOnlyHeadlineAndLink =
    /\b(lines?|starting goalie|goalie)\b/i.test(wrapperText) &&
    /https?:\/\/t\.co\//i.test(wrapperText) &&
    countStructuredPlayerMentions(wrapperText) === 0;

  if (wrapperHasOnlyHeadlineAndLink) return true;

  const wrapperKeywordCount = findGameDayTweetKeywordHits(wrapperText).length;
  const quotedKeywordCount = findGameDayTweetKeywordHits(quotedText).length;
  const wrapperStructureCount = countStructuredPlayerMentions(wrapperText);
  const quotedStructureCount = countStructuredPlayerMentions(quotedText);

  return (
    quotedStructureCount > wrapperStructureCount ||
    quotedKeywordCount > wrapperKeywordCount
  );
}

export function applyQuotedTweetPreference(args: {
  source: ParsedLinesCccSource;
  quotedTweet: LinesCccResolvedQuotedTweet | null;
}): ParsedLinesCccSource {
  const quotedTweet = args.quotedTweet;
  if (!quotedTweet) {
    return args.source;
  }

  const nextSource: ParsedLinesCccSource = {
    ...args.source,
    quotedTweetId: quotedTweet.quotedTweetId,
    quotedTweetUrl: quotedTweet.quotedTweetUrl,
    quotedAuthorHandle: quotedTweet.quotedAuthorHandle,
    quotedAuthorName: quotedTweet.quotedAuthorName,
    quotedRawText: quotedTweet.quotedText,
    quotedEnrichedText: quotedTweet.quotedText,
    metadata: {
      ...args.source.metadata,
      quotedPostedAt: quotedTweet.quotedPostedAt,
      quotedPostedLabel: quotedTweet.quotedPostedLabel,
      quotedSourceTweetUrl: quotedTweet.quotedSourceTweetUrl,
      quotedResolvedUrl: quotedTweet.resolvedUrl,
      quotedShortUrl: quotedTweet.shortUrl,
      quotedRetrievalStatus: quotedTweet.retrievalStatus,
    },
  };

  if (!shouldPreferQuotedTweetText({ source: args.source, quotedTweet })) {
    return {
      ...nextSource,
      metadata: {
        ...nextSource.metadata,
        ...buildPrimaryTextMetadata(nextSource),
      },
    };
  }

  const preferredSource: ParsedLinesCccSource = {
    ...nextSource,
    tweetPostedAt: quotedTweet.retrievalStatus === "x_api_success"
      ? normalizeTweetPostedAt(quotedTweet.quotedPostedAt)
      : tweetPublicationFromUrl(quotedTweet.quotedTweetUrl),
    tweetPostedLabel: quotedTweet.quotedPostedLabel,
    primaryTextSource: "quoted_oembed",
    sourceLabel: nextSource.sourceLabel ?? "quoted_oembed",
    metadata: {
      ...nextSource.metadata,
      wrapperPostedAt: args.source.tweetPostedAt ?? null,
      wrapperPostedLabel: args.source.tweetPostedLabel ?? null,
      publicationTimeBasis: quotedTweet.retrievalStatus === "x_api_success"
        ? "provider_timestamp" : "tweet_id_or_unknown",
      preferredQuotedTweet: true,
    },
  };

  return {
    ...preferredSource,
    metadata: {
      ...preferredSource.metadata,
      ...buildPrimaryTextMetadata(preferredSource),
    },
  };
}

export function rejectInsufficientQuoteWrapper(args: {
  source: ParsedLinesCccSource;
  quotedTweet: LinesCccResolvedQuotedTweet | null;
}): ParsedLinesCccSource {
  if (args.quotedTweet) {
    return args.source;
  }

  if (!isWrapperTextInsufficientWithoutQuote(args.source)) {
    return args.source;
  }

  return {
    ...args.source,
    nhlFilterStatus: "rejected_insufficient_text",
    nhlFilterReason: "unresolved_quoted_tweet",
    metadata: {
      ...args.source.metadata,
      unresolvedQuotedTweet: true,
      ...buildPrimaryTextMetadata({
        ...args.source,
        nhlFilterStatus: "rejected_insufficient_text",
        nhlFilterReason: "unresolved_quoted_tweet",
      }),
    },
  };
}

/** FxTwitter reposts key on the original tweet id; IFTTT keys are left exactly as they were stored. */
function captureTweetId(source: ParsedLinesCccSource): string | null {
  const provenance = source.metadata?.sourceProvenance as TweetSourceProvenance | undefined;
  return provenance?.provider === "fxtwitter" && provenance.originalTweetId ? provenance.originalTweetId : source.tweetId ?? null;
}

function buildLinesCccCaptureKey(source: ParsedLinesCccSource): string {
  return [
    source.snapshotDate,
    source.team?.id ?? "no-team",
    source.gameId ?? "no-game",
    captureTweetId(source) ?? source.tweetUrl ?? "no-wrapper-tweet",
    source.quotedTweetId ?? source.quotedTweetUrl ?? "no-quoted-tweet",
    source.classification ?? "unclassified",
    source.nhlFilterStatus,
  ].join(":");
}

export function toLinesCccRow(args: {
  source: ParsedLinesCccSource;
  rosterEntries?: RosterNameEntry[];
}): LinesCccRow {
  const rosterEntries = args.rosterEntries ?? [];
  const source = args.source;
  const now = new Date().toISOString();
  const observedAt = source.observedAt ?? now;
  const status =
    source.nhlFilterStatus === "accepted" ? "observed" : "rejected";
  const interpretation = source.metadata?.interpretation as TweetInterpretation | undefined;
  const admittedRow = (situation: "es_forward" | "es_defense", index: number) => interpretation?.units
    .find((unit) => unit.situation === situation && unit.complete && unit.number === index + 1)?.players.map((player) => player.name) ?? null;
  const line = (index: number) =>
    toStoredForwardOrder(interpretation ? admittedRow("es_forward", index) : source.forwards?.[index] ?? null);
  const pair = (index: number) =>
    toStoredDefenseOrder(interpretation ? admittedRow("es_defense", index) : source.defensePairs?.[index] ?? null);
  const goalie1 = source.goalies?.[0] ?? null;
  const goalie2 = source.goalies?.[1] ?? null;
  const scratches =
    source.scratches && source.scratches.length > 0 ? source.scratches : null;
  const injuries =
    source.injuries && source.injuries.length > 0 ? source.injuries : null;

  return {
    capture_key: buildLinesCccCaptureKey(source),
    snapshot_date: source.snapshotDate,
    observed_at: observedAt,
    tweet_posted_at: normalizeTweetPostedAt(source.tweetPostedAt),
    tweet_posted_label: source.tweetPostedLabel ?? source.tweetPostedAt ?? null,
    game_id: source.gameId ?? null,
    team_id: source.team?.id ?? null,
    team_abbreviation: source.team?.abbreviation ?? null,
    team_name: source.team?.name ?? null,
    source: "lines_ccc",
    source_url: source.sourceUrl ?? source.tweetUrl ?? null,
    source_label: source.sourceLabel ?? source.classification ?? null,
    source_handle: source.sourceHandle ?? null,
    author_name: source.authorName ?? null,
    tweet_id: source.tweetId ?? null,
    tweet_url: source.tweetUrl ?? null,
    quoted_tweet_id: source.quotedTweetId ?? null,
    quoted_tweet_url: source.quotedTweetUrl ?? null,
    quoted_author_handle: source.quotedAuthorHandle ?? null,
    quoted_author_name: source.quotedAuthorName ?? null,
    primary_text_source: source.primaryTextSource ?? null,
    classification: source.classification ?? null,
    detected_league: source.detectedLeague ?? null,
    nhl_filter_status: source.nhlFilterStatus,
    nhl_filter_reason: source.nhlFilterReason ?? null,
    status,
    raw_text: source.rawText ?? null,
    enriched_text: source.enrichedText ?? null,
    quoted_raw_text: source.quotedRawText ?? null,
    quoted_enriched_text: source.quotedEnrichedText ?? null,
    keyword_hits:
      source.keywordHits && source.keywordHits.length > 0
        ? source.keywordHits
        : null,
    matched_player_ids:
      source.matchedPlayerIds && source.matchedPlayerIds.length > 0
        ? source.matchedPlayerIds
        : null,
    matched_player_names:
      source.matchedNames && source.matchedNames.length > 0
        ? source.matchedNames
        : null,
    unmatched_names:
      source.unmatchedNames && source.unmatchedNames.length > 0
        ? source.unmatchedNames
        : null,
    line_1_player_ids: mapNamesToPlayerIdsOrdered(line(0), rosterEntries, "es_forward"),
    line_1_player_names: line(0),
    line_2_player_ids: mapNamesToPlayerIdsOrdered(line(1), rosterEntries, "es_forward"),
    line_2_player_names: line(1),
    line_3_player_ids: mapNamesToPlayerIdsOrdered(line(2), rosterEntries, "es_forward"),
    line_3_player_names: line(2),
    line_4_player_ids: mapNamesToPlayerIdsOrdered(line(3), rosterEntries, "es_forward"),
    line_4_player_names: line(3),
    pair_1_player_ids: mapNamesToPlayerIdsOrdered(pair(0), rosterEntries, "es_defense"),
    pair_1_player_names: pair(0),
    pair_2_player_ids: mapNamesToPlayerIdsOrdered(pair(1), rosterEntries, "es_defense"),
    pair_2_player_names: pair(1),
    pair_3_player_ids: mapNamesToPlayerIdsOrdered(pair(2), rosterEntries, "es_defense"),
    pair_3_player_names: pair(2),
    goalie_1_player_id: goalie1
      ? (mapNamesToPlayerIdsOrdered([goalie1], rosterEntries, "goalie")?.[0] ?? null)
      : null,
    goalie_1_name: goalie1,
    goalie_2_player_id: goalie2
      ? (mapNamesToPlayerIdsOrdered([goalie2], rosterEntries, "goalie")?.[0] ?? null)
      : null,
    goalie_2_name: goalie2,
    scratches_player_ids: mapNamesToPlayerIdsOrdered(scratches, rosterEntries),
    scratches_player_names: scratches,
    injured_player_ids: mapNamesToPlayerIdsOrdered(injuries, rosterEntries),
    injured_player_names: injuries,
    raw_payload: source.rawPayload ?? {},
    metadata: {
      storedSkaterOrder: ["RW", "C", "LW"],
      storedDefenseOrder: ["RD", "LD"],
      primaryText:
        source.quotedEnrichedText ??
        source.quotedRawText ??
        source.enrichedText ??
        source.rawText ??
        null,
      matchedNames: source.matchedNames ?? [],
      unmatchedNames: source.unmatchedNames ?? [],
      ...source.metadata,
      powerPlayUnitPlayerIds: Array.isArray(source.metadata?.powerPlayUnits)
        ? (source.metadata.powerPlayUnits as string[][]).map((unit) => mapNamesToPlayerIdsOrdered(unit, rosterEntries))
        : [],
    },
    updated_at: now,
  };
}
