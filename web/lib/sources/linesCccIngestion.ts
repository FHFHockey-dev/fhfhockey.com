import type {
  GameDayTweetsClassification,
  RosterNameEntry,
  TeamDirectoryEntry
} from "lib/sources/lineupSourceIngestion";

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
  return normalizeNameKey(value).replace(/[^a-z0-9#@]+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTweetId(value: string | null): string | null {
  if (!value) return null;
  return value.match(/\/status(?:es)?\/(\d+)/i)?.[1] ?? null;
}

function normalizeTweetUrl(value: string | null, tweetId: string | null): string | null {
  if (value) {
    const id = extractTweetId(value);
    if (id) return `https://twitter.com/i/web/status/${id}`;
  }
  return tweetId ? `https://twitter.com/i/web/status/${tweetId}` : null;
}

function classifyLinesCccText(text: string): GameDayTweetsClassification {
  const normalized = normalizeTextKey(text);
  if (/\b(pp1|pp2|power play)\b/.test(normalized)) return "power_play";
  if (/\bstarting goalie\b|\bstarter\b|\bin net\b/.test(normalized)) return "goalie_start";
  if (/\binjur|returns?|recalled|assigned|out\b/.test(normalized)) return "injury";
  if (/\bpractice lines?\b|\bline rushes\b|\brushes\b/.test(normalized)) {
    return "practice_lines";
  }
  if (/\blines?\b|\bline combinations?\b|\bline combos?\b/.test(normalized)) {
    return "lineup";
  }
  return "other";
}

function findLinesCccKeywordHits(text: string): string[] {
  const normalized = normalizeTextKey(text);
  return [
    "lines",
    "line combinations",
    "line combos",
    "practice lines",
    "line rushes",
    "power play",
    "pp1",
    "pp2",
    "starting goalie",
    "starter",
    "injury",
    "returns",
    "recalled",
    "assigned"
  ].filter((keyword) => normalized.includes(normalizeTextKey(keyword)));
}

function detectNonNhlLeague(text: string): string | null {
  const normalized = normalizeTextKey(text);
  const match = normalized.match(/\b(ahl|echl|ohl|whl|qmjhl|ncaa)\b/);
  return match?.[1]?.toUpperCase() ?? null;
}

function resolveTeamFromText(
  text: string,
  teams: TeamDirectoryEntry[]
): TeamDirectoryEntry | null {
  const normalized = normalizeTextKey(text);
  const matches = teams.filter((team) => {
    const labels = [
      team.name,
      team.abbreviation,
      team.shortName,
      team.location,
      `${team.location ?? ""} ${team.shortName ?? ""}`.trim()
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => normalizeTextKey(value))
      .filter(Boolean);

    return labels.some((label) => new RegExp(`\\b${escapeRegExp(label)}\\b`, "i").test(normalized));
  });

  return matches.length === 1 ? matches[0]! : null;
}

function matchRosterNamesInText(
  text: string,
  rosterEntries: RosterNameEntry[]
): { matchedPlayerIds: number[]; matchedNames: string[]; unmatchedNames: string[] } {
  const normalized = normalizeTextKey(text);
  const matched = rosterEntries.filter((entry) => {
    const fullName = normalizeTextKey(entry.fullName);
    const lastName = normalizeTextKey(entry.lastName);
    return (
      (fullName && new RegExp(`\\b${escapeRegExp(fullName)}\\b`, "i").test(normalized)) ||
      (lastName && new RegExp(`\\b${escapeRegExp(lastName)}\\b`, "i").test(normalized))
    );
  });

  return {
    matchedPlayerIds: matched.map((entry) => entry.playerId).sort((a, b) => a - b),
    matchedNames: matched.map((entry) => entry.fullName).sort((a, b) => a.localeCompare(b)),
    unmatchedNames: []
  };
}

function extractGoalieName(text: string): string | null {
  const match = text.match(/starting goalie:\s*([^:\n]+?)(?:\s+https?:\/\/|$)/i);
  return match?.[1]?.trim() ?? null;
}

export function buildLinesCccSourceFromIftttEvent(args: {
  event: LinesCccIftttEventInput;
  snapshotDate: string;
  teams: TeamDirectoryEntry[];
  rosterByTeam: Map<number, RosterNameEntry[]>;
  gameIdByTeamId?: Map<number, number>;
}): ParsedLinesCccSource {
  const text = args.event.text?.trim() ?? "";
  const tweetId = args.event.tweet_id ?? extractTweetId(args.event.link_to_tweet);
  const tweetUrl = normalizeTweetUrl(args.event.link_to_tweet, tweetId);
  const detectedNonNhlLeague = detectNonNhlLeague(text);
  const team = detectedNonNhlLeague ? null : resolveTeamFromText(text, args.teams);
  const rosterEntries = team ? args.rosterByTeam.get(team.id) ?? [] : [];
  const matched = matchRosterNamesInText(text, rosterEntries);
  const goalieName = extractGoalieName(text);
  const classification = classifyLinesCccText(text);
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
        ? "explicit_non_nhl_league_marker"
        : nhlFilterStatus === "rejected_insufficient_text"
          ? "missing_text"
          : "no_single_nhl_team_match";

  return {
    snapshotDate: args.snapshotDate,
    observedAt: args.event.received_at,
    tweetPostedAt: args.event.tweet_created_at,
    tweetPostedLabel: args.event.created_at_label,
    gameId: team ? args.gameIdByTeamId?.get(team.id) ?? null : null,
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
    keywordHits: findLinesCccKeywordHits(text),
    matchedPlayerIds: matched.matchedPlayerIds,
    matchedNames: matched.matchedNames,
    unmatchedNames: matched.unmatchedNames,
    goalies: goalieName ? [goalieName] : [],
    rawPayload: args.event.raw_payload,
    metadata: {
      iftttEventId: args.event.id,
      iftttSource: args.event.source,
      iftttSourceAccount: args.event.source_account
    }
  };
}

function mapNamesToPlayerIdsOrdered(
  names: string[] | null,
  rosterEntries: RosterNameEntry[]
): Array<number | null> | null {
  if (!names) return null;

  const rosterByFullName = new Map<string, RosterNameEntry>();
  const rosterByLastName = new Map<string, RosterNameEntry[]>();

  for (const rosterEntry of rosterEntries) {
    rosterByFullName.set(normalizeNameKey(rosterEntry.fullName), rosterEntry);
    const lastName = normalizeNameKey(rosterEntry.lastName);
    rosterByLastName.set(lastName, [...(rosterByLastName.get(lastName) ?? []), rosterEntry]);
  }

  return names.map((name) => {
    const normalizedName = normalizeNameKey(name);
    const fullNameMatch = rosterByFullName.get(normalizedName);
    if (fullNameMatch) return fullNameMatch.playerId;

    const lastName = normalizedName.split(" ").pop() ?? normalizedName;
    const lastNameMatches = rosterByLastName.get(lastName) ?? [];
    return lastNameMatches.length === 1 ? lastNameMatches[0]!.playerId : null;
  });
}

function toStoredForwardOrder(players: string[] | null): string[] | null {
  return players && players.length === 3 ? [players[2]!, players[1]!, players[0]!] : players;
}

function toStoredDefenseOrder(players: string[] | null): string[] | null {
  return players && players.length === 2 ? [players[1]!, players[0]!] : players;
}

function normalizeTweetPostedAt(value: string | null | undefined): string | null {
  if (!value) return null;

  const hasExplicitTimezone =
    /(?:z|gmt|utc)$/i.test(value.trim()) || /[+-]\d{2}:?\d{2}\b/.test(value);
  if (!hasExplicitTimezone) return null;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function buildLinesCccCaptureKey(source: ParsedLinesCccSource): string {
  return [
    source.snapshotDate,
    source.team?.id ?? "no-team",
    source.gameId ?? "no-game",
    source.tweetId ?? source.tweetUrl ?? "no-wrapper-tweet",
    source.quotedTweetId ?? source.quotedTweetUrl ?? "no-quoted-tweet",
    source.classification ?? "unclassified",
    source.nhlFilterStatus
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
  const status = source.nhlFilterStatus === "accepted" ? "observed" : "rejected";
  const line = (index: number) => toStoredForwardOrder(source.forwards?.[index] ?? null);
  const pair = (index: number) => toStoredDefenseOrder(source.defensePairs?.[index] ?? null);
  const goalie1 = source.goalies?.[0] ?? null;
  const goalie2 = source.goalies?.[1] ?? null;
  const scratches = source.scratches && source.scratches.length > 0 ? source.scratches : null;
  const injuries = source.injuries && source.injuries.length > 0 ? source.injuries : null;

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
    keyword_hits: source.keywordHits && source.keywordHits.length > 0 ? source.keywordHits : null,
    matched_player_ids:
      source.matchedPlayerIds && source.matchedPlayerIds.length > 0
        ? source.matchedPlayerIds
        : null,
    matched_player_names:
      source.matchedNames && source.matchedNames.length > 0 ? source.matchedNames : null,
    unmatched_names:
      source.unmatchedNames && source.unmatchedNames.length > 0 ? source.unmatchedNames : null,
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
    goalie_1_player_id: goalie1 ? mapNamesToPlayerIdsOrdered([goalie1], rosterEntries)?.[0] ?? null : null,
    goalie_1_name: goalie1,
    goalie_2_player_id: goalie2 ? mapNamesToPlayerIdsOrdered([goalie2], rosterEntries)?.[0] ?? null : null,
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
      ...source.metadata
    },
    updated_at: now
  };
}
