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
} from "lib/sources/lineupSourceIngestion";
import {
  expandRedirectUrl,
  extractStatusUrlsFromText,
  extractTcoUrlsFromText,
  extractTweetIdFromUrl,
  normalizeTweetStatusUrl,
  parseTweetOEmbedHtml,
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
  return Array.from(
    text.matchAll(
      /[A-Z][A-Za-z.'’`-]+(?:\s+[A-Z][A-Za-z.'’`-]+){0,2}\s*[-–—/\\•]\s*[A-Z]/g,
    ),
  ).length;
}

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
  return new RegExp(`(?:^|\\s)${escapeRegExp(label)}(?:$|\\s)`, "i").test(
    text,
  );
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

function resolveTeamFromRosterDensity(args: {
  text: string;
  teams: TeamDirectoryEntry[];
  rosterByTeam: Map<number, RosterNameEntry[]>;
}): TeamDirectoryEntry | null {
  const structuredMentions = countStructuredPlayerMentions(args.text);
  const scores = args.teams
    .map((team) => {
      const rosterEntries = args.rosterByTeam.get(team.id) ?? [];
      const matched = matchRosterNamesInTweet(args.text, rosterEntries);
      return {
        team,
        matchedCount: matched.matchedPlayerIds.length,
      };
    })
    .sort((left, right) => right.matchedCount - left.matchedCount);

  const best = scores[0];
  const second = scores[1];
  if (!best || best.matchedCount === 0) {
    return null;
  }

  const uniqueLeader = best.matchedCount > (second?.matchedCount ?? 0);
  const decisiveRosterLead =
    best.matchedCount >= 2 &&
    best.matchedCount - (second?.matchedCount ?? 0) >= 2;
  const sufficientForRosterFallback =
    decisiveRosterLead ||
    best.matchedCount >= 6 ||
    (structuredMentions > 0 && best.matchedCount >= 4);

  return uniqueLeader && sufficientForRosterFallback ? best.team : null;
}

export function resolveLinesCccTeam(args: {
  text: string;
  teams: TeamDirectoryEntry[];
  rosterByTeam?: Map<number, RosterNameEntry[]>;
  sourceHandles?: Array<string | null | undefined>;
}): TeamDirectoryEntry | null {
  const leadVsTeam = resolveTeamFromLeadVsText(args.text, args.teams);
  if (leadVsTeam) {
    return leadVsTeam;
  }

  const labelMatches = findLabelMatchedTeams(args.text, args.teams);

  if (args.rosterByTeam) {
    const rosterDensityTeam = resolveTeamFromRosterDensity({
      text: args.text,
      teams: args.teams,
      rosterByTeam: args.rosterByTeam,
    });
    if (rosterDensityTeam) {
      return rosterDensityTeam;
    }
  }

  if (labelMatches.length === 1) {
    return labelMatches[0]!;
  }

  const textHintTeam = findTeamMentionInText(args.text, args.teams);
  if (textHintTeam && labelMatches.length === 0) {
    return textHintTeam;
  }
  if (
    textHintTeam &&
    labelMatches.length > 1 &&
    labelMatches.some((team) => team.id === textHintTeam.id)
  ) {
    return textHintTeam;
  }

  const handleHintTeam = resolveTeamFromHandleHints(
    args.sourceHandles ?? [],
    args.teams,
  );
  if (handleHintTeam) {
    return handleHintTeam;
  }

  return null;
}

function getPrimaryTextForSource(source: ParsedLinesCccSource): string {
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
): string[] {
  return names.map(
    (name) =>
      resolveTweetNameToRosterEntry(name, rosterEntries)?.fullName ?? name,
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
  const normalizedText = args.text.toLowerCase();
  const orderedNames = extractOrderedRosterHitsFromTweet(
    args.text,
    args.rosterEntries,
  );
  const signals: string[] = [];

  if (/\breturns?\b|\breturning\b/.test(normalizedText)) signals.push("return");
  if (/\brecalled\b/.test(normalizedText)) signals.push("recalled");
  if (/\bpromoted\b/.test(normalizedText)) signals.push("promoted");
  if (/\bsigned\b/.test(normalizedText)) signals.push("signed");
  if (/\bactivated\b/.test(normalizedText)) signals.push("activated");

  return signals.flatMap((signal) =>
    orderedNames.slice(0, 3).map((playerName) => ({
      signal,
      playerName,
    })),
  );
}

function extractPowerPlayUnits(args: {
  text: string;
  rosterEntries: RosterNameEntry[];
}): string[][] {
  const units = Array.from(args.text.matchAll(/\bpp([12])\b[:\s-]+([^\n]+)/gi))
    .sort((left, right) => Number(left[1] ?? 9) - Number(right[1] ?? 9))
    .map((match) =>
      canonicalizeNames(
        match[2]!
          .split(/\s*[-–—/\\•]\s*|\s*,\s*/)
          .map((name) => name.trim())
          .filter(Boolean),
        args.rosterEntries,
      ),
    )
    .filter((unit) => unit.length >= 3);

  return units.slice(0, 2);
}

function buildStructuredContent(args: {
  text: string;
  classification: GameDayTweetsClassification;
  rosterEntries: RosterNameEntry[];
}): Pick<
  ParsedLinesCccSource,
  | "forwards"
  | "defensePairs"
  | "goalies"
  | "scratches"
  | "injuries"
  | "metadata"
> {
  const structured = extractStructuredPlayerGroupsFromText(args.text);
  let forwards = structured.forwards
    .map((line) => canonicalizeNames(line, args.rosterEntries))
    .filter((line) => line.length === 3);
  let defensePairs = structured.defensePairs
    .map((pair) => canonicalizeNames(pair, args.rosterEntries))
    .filter((pair) => pair.length === 2);
  let goalies = structured.goalies
    .map((name) => {
      const resolvedRosterEntry = resolveTweetNameToRosterEntry(
        name,
        args.rosterEntries,
      );
      const hasHeadingKeywords =
        /\b(lines?|pairings|power play|pp1|pp2|injury|update)\b/i.test(name);
      if (!resolvedRosterEntry && hasHeadingKeywords) {
        return null;
      }
      return resolvedRosterEntry?.fullName ?? name;
    })
    .filter((name): name is string => Boolean(name))
    .filter(Boolean);
  const standaloneResolvedGoalies = args.text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/[-–—/\\•]/.test(line))
    .filter(
      (line) =>
        !/\b(lines?|pairings|power play|pp1|pp2|injury|update)\b/i.test(line),
    )
    .map(
      (line) =>
        resolveTweetNameToRosterEntry(line, args.rosterEntries)?.fullName ??
        null,
    )
    .filter((name): name is string => Boolean(name));

  if (
    (args.classification === "lineup" ||
      args.classification === "practice_lines") &&
    forwards.length === 0 &&
    defensePairs.length === 0
  ) {
    const orderedRosterHits = extractOrderedRosterHitsFromTweet(
      args.text,
      args.rosterEntries,
    );
    forwards = Array.from(
      { length: Math.floor(Math.min(orderedRosterHits.length, 12) / 3) },
      (_, index) => orderedRosterHits.slice(index * 3, index * 3 + 3),
    ).filter((line) => line.length === 3);
    const defenseStartIndex = forwards.length * 3;
    const defenseHits = orderedRosterHits.slice(
      defenseStartIndex,
      defenseStartIndex + 6,
    );
    defensePairs = Array.from(
      { length: Math.floor(defenseHits.length / 2) },
      (_, index) => defenseHits.slice(index * 2, index * 2 + 2),
    ).filter((pair) => pair.length === 2);
  }

  const extractedGoalieName = extractGoalieName(args.text);
  if (extractedGoalieName) {
    const canonicalGoalieName =
      resolveTweetNameToRosterEntry(extractedGoalieName, args.rosterEntries)
        ?.fullName ?? extractedGoalieName;
    goalies = dedupeOrderedNames([
      canonicalGoalieName,
      ...goalies,
      ...standaloneResolvedGoalies,
    ]).slice(0, 2);
  } else {
    goalies = dedupeOrderedNames([
      ...goalies,
      ...standaloneResolvedGoalies,
    ]).slice(0, 2);
  }

  const scratches = parseNamedListFromLabel({
    text: args.text,
    labelPattern: /\b(?:scratched|scratches)\b[:\s-]+([^\n]+)/i,
    rosterEntries: args.rosterEntries,
  });
  const injuries = extractInjuryNames({
    text: args.text,
    classification: args.classification,
    rosterEntries: args.rosterEntries,
  });
  const powerPlayUnits =
    args.classification === "power_play"
      ? extractPowerPlayUnits({
          text: args.text,
          rosterEntries: args.rosterEntries,
        })
      : [];
  const transactionSignals = extractTransactionSignals({
    text: args.text,
    rosterEntries: args.rosterEntries,
  });

  return {
    forwards,
    defensePairs,
    goalies,
    scratches,
    injuries,
    metadata: {
      powerPlayUnits,
      transactionSignals,
    },
  };
}

export function buildLinesCccSourceFromIftttEvent(args: {
  event: LinesCccIftttEventInput;
  snapshotDate: string;
  teams: TeamDirectoryEntry[];
  rosterByTeam: Map<number, RosterNameEntry[]>;
  gameIdByTeamId?: Map<number, number>;
}): ParsedLinesCccSource {
  const text = args.event.text?.trim() ?? "";
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
      });
  const rosterEntries = team ? (args.rosterByTeam.get(team.id) ?? []) : [];
  const matched = matchRosterNamesInTweet(text, rosterEntries);
  const goalieName = extractGoalieName(text);
  const classification = classifyGameDayTweet(text);
  const structuredContent = buildStructuredContent({
    text,
    classification,
    rosterEntries,
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
    tweetPostedAt: args.event.tweet_created_at,
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
        : goalieName
          ? [goalieName]
          : [],
    scratches: structuredContent.scratches,
    injuries: structuredContent.injuries,
    rawPayload: args.event.raw_payload,
    metadata: {
      iftttEventId: args.event.id,
      iftttSource: args.event.source,
      iftttSourceAccount: args.event.source_account,
      teamLabelMatches: labelMatchedTeams.map(
        (matchedTeam) => matchedTeam.abbreviation,
      ),
      nonNhlSourceHandle: nonNhlHandleMatch?.matchedHandle ?? null,
      initialStructureSignals: textSignals.structureSignals,
      ...structuredContent.metadata,
    },
  };

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
      });
  const rosterEntries = team ? (args.rosterByTeam.get(team.id) ?? []) : [];
  const matched = matchRosterNamesInTweet(text, rosterEntries);
  const classification = classifyGameDayTweet(text);
  const structuredContent = buildStructuredContent({
    text,
    classification,
    rosterEntries,
  });
  const goalieName = extractGoalieName(text);
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
        : goalieName
          ? [goalieName]
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

  return {
    ...refreshedSource,
    metadata: {
      ...refreshedSource.metadata,
      ...buildPrimaryTextMetadata(refreshedSource),
    },
  };
}

function mapNamesToPlayerIdsOrdered(
  names: string[] | null,
  rosterEntries: RosterNameEntry[],
): Array<number | null> | null {
  if (!names) return null;

  const rosterByLastName = new Map<string, RosterNameEntry[]>();

  for (const rosterEntry of rosterEntries) {
    const lastName = normalizeNameKey(rosterEntry.lastName);
    rosterByLastName.set(lastName, [
      ...(rosterByLastName.get(lastName) ?? []),
      rosterEntry,
    ]);
  }

  return names.map((name) => {
    const resolvedEntry = resolveTweetNameToRosterEntry(name, rosterEntries);
    if (resolvedEntry) return resolvedEntry.playerId;

    const normalizedName = normalizeNameKey(name);
    const lastName = normalizedName.split(" ").pop() ?? normalizedName;
    const lastNameMatches = rosterByLastName.get(lastName) ?? [];
    return lastNameMatches.length === 1 ? lastNameMatches[0]!.playerId : null;
  });
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

function parseDateLabelToIso(
  dateLabel: string | null | undefined,
): string | null {
  if (!dateLabel) return null;
  const parsed = Date.parse(`${String(dateLabel).trim()} 00:00:00 UTC`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
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
  return {
    ok: true,
    httpStatus: response.status,
    data: {
      text: parsed.text,
      postedAt: parseDateLabelToIso(parsed.postedLabel),
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
      args.oembedData.postedAt ?? args.source.tweetPostedAt ?? null,
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
      ...buildPrimaryTextMetadata(nextSource),
    },
  };
}

async function resolveQuotedTweetStatusUrlForOEmbed(
  text: string,
): Promise<string | null> {
  const directStatusUrl = extractStatusUrlsFromText(text).find((value) =>
    Boolean(extractTweetIdFromUrl(value)),
  );
  if (directStatusUrl) {
    return directStatusUrl;
  }

  for (const shortUrl of extractTcoUrlsFromText(text)) {
    const expandedUrl = await expandRedirectUrl(shortUrl);
    if (expandedUrl && extractTweetIdFromUrl(expandedUrl)) {
      return expandedUrl;
    }
  }

  return null;
}

export async function resolveLinesCccQuotedTweet(args: {
  wrapperText: string;
}): Promise<LinesCccResolvedQuotedTweet | null> {
  const quotedTweetStatusUrl = await resolveQuotedTweetStatusUrlForOEmbed(
    args.wrapperText,
  );
  if (!quotedTweetStatusUrl) {
    return null;
  }

  const quotedTweetId = extractTweetIdFromUrl(quotedTweetStatusUrl);
  if (!quotedTweetId) {
    return null;
  }

  const quotedTweet = await fetchLinesCccTweetOEmbedData(quotedTweetStatusUrl);
  if (!quotedTweet) {
    return null;
  }

  return {
    quotedTweetId,
    quotedTweetUrl:
      normalizeTweetStatusUrl(quotedTweetStatusUrl, quotedTweetId) ??
      quotedTweetStatusUrl,
    quotedText: quotedTweet.text,
    quotedPostedAt: quotedTweet.postedAt,
    quotedPostedLabel: quotedTweet.postedLabel,
    quotedSourceTweetUrl: quotedTweet.sourceTweetUrl,
    quotedAuthorName: quotedTweet.authorName,
    quotedAuthorHandle: quotedTweet.authorHandle,
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
    primaryTextSource: "quoted_oembed",
    sourceLabel: nextSource.sourceLabel ?? "quoted_oembed",
    metadata: {
      ...nextSource.metadata,
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

function buildLinesCccCaptureKey(source: ParsedLinesCccSource): string {
  return [
    source.snapshotDate,
    source.team?.id ?? "no-team",
    source.gameId ?? "no-game",
    source.tweetId ?? source.tweetUrl ?? "no-wrapper-tweet",
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
  const line = (index: number) =>
    toStoredForwardOrder(source.forwards?.[index] ?? null);
  const pair = (index: number) =>
    toStoredDefenseOrder(source.defensePairs?.[index] ?? null);
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
    line_1_player_ids: mapNamesToPlayerIdsOrdered(line(0), rosterEntries),
    line_1_player_names: line(0),
    line_2_player_ids: mapNamesToPlayerIdsOrdered(line(1), rosterEntries),
    line_2_player_names: line(1),
    line_3_player_ids: mapNamesToPlayerIdsOrdered(line(2), rosterEntries),
    line_3_player_names: line(2),
    line_4_player_ids: mapNamesToPlayerIdsOrdered(line(3), rosterEntries),
    line_4_player_names: line(3),
    pair_1_player_ids: mapNamesToPlayerIdsOrdered(pair(0), rosterEntries),
    pair_1_player_names: pair(0),
    pair_2_player_ids: mapNamesToPlayerIdsOrdered(pair(1), rosterEntries),
    pair_2_player_names: pair(1),
    pair_3_player_ids: mapNamesToPlayerIdsOrdered(pair(2), rosterEntries),
    pair_3_player_names: pair(2),
    goalie_1_player_id: goalie1
      ? (mapNamesToPlayerIdsOrdered([goalie1], rosterEntries)?.[0] ?? null)
      : null,
    goalie_1_name: goalie1,
    goalie_2_player_id: goalie2
      ? (mapNamesToPlayerIdsOrdered([goalie2], rosterEntries)?.[0] ?? null)
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
    },
    updated_at: now,
  };
}
