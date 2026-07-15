import { getTeamLogoSvg, fallbackNHLLogo } from "lib/images";
import { teamsInfo } from "lib/teamsInfo";

export type NewsFeedItemPlayer = {
  id: string;
  news_item_id: string;
  player_id: number | null;
  player_name: string;
  team_id: number | null;
  role: string;
};

export type NewsFeedItemRow = {
  id: string;
  source_review_item_id: string | null;
  source_tweet_id: string | null;
  source_url: string | null;
  tweet_url: string | null;
  source_label: string | null;
  source_account: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  headline: string;
  blurb: string;
  category: string;
  subcategory: string | null;
  card_status: "draft" | "published" | "archived";
  observed_at: string | null;
  published_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type NewsFeedItem = NewsFeedItemRow & {
  players: NewsFeedItemPlayer[];
};

export type NewsFeedSourceProvenance = {
  source_handle?: string | null;
  author_name?: string | null;
  source_url?: string | null;
  tweet_url?: string | null;
  quoted_tweet_url?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PublicNewsSourceAttribution = {
  displayName: string | null;
  account: string | null;
  url: string | null;
};

export type NewsFeedKeywordPhrase = {
  id: string;
  source_review_item_id: string | null;
  source: string;
  phrase: string;
  normalized_phrase: string;
  scope_key: string;
  category: string | null;
  subcategory: string | null;
  notes: string | null;
  status: "active" | "ignored";
  created_at: string;
  updated_at: string;
};

export type PlayerNewsFlag = {
  category: string;
  subcategory: string | null;
  label: string;
  headline: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  tone: "danger" | "success" | "info" | "warning" | "neutral";
};

export type TeamOption = {
  id: number;
  abbreviation: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  accent: string;
  logoUrl: string;
};

export function normalizeNewsTeamId(
  teamId: number | null | undefined,
  validTeamIds: ReadonlySet<number>,
): number | null {
  return typeof teamId === "number" && validTeamIds.has(teamId) ? teamId : null;
}

export function resolveAutomatedNewsCardStatus(args: {
  existingStatus: "draft" | "published" | "archived" | null | undefined;
  candidateStatus: "draft" | "published";
}): "draft" | "published" | "archived" {
  return args.existingStatus === "published" || args.existingStatus === "archived"
    ? args.existingStatus
    : args.candidateStatus;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

const NEWS_RELAY_HANDLES = new Set([
  "cccmiddleton",
  "linescccmiddleton",
  "gamedaygoalies",
  "gamedaylines",
  "gamedaynewsnhl",
  "gamedaystatsnhl",
]);

const NEWS_RELAY_MENTION_PATTERN =
  /@?(?:CcC\s*Middleton|Lines\s*CcC\s*Middleton|Game\s*Day\s*Goalies|Game\s*Day\s*Lines|Game\s*Day\s*News\s*NHL|NHL\s*Game\s*Day\s*News|Game\s*Day\s*Stats\s*NHL)/gi;

const NEWS_RELAY_BYLINE_PATTERN =
  /\s*[—–-]\s*(?:CcC\s*Middleton|Lines\s*CcC\s*Middleton|Game\s*Day\s*Goalies|Game\s*Day\s*Lines|Game\s*Day\s*News\s*NHL|NHL\s*Game\s*Day\s*News|Game\s*Day\s*Stats\s*NHL)(?:\s*\([^)]*\))?(?:\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})?\s*$/gi;

function normalizeSourceHandle(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/^@/, "").toLowerCase();
  return normalized || null;
}

export function isNewsRelayAccount(
  value: string | null | undefined,
): boolean {
  const normalized = normalizeSourceHandle(value);
  return normalized ? NEWS_RELAY_HANDLES.has(normalized) : false;
}

export function sanitizePublicNewsText(
  value: string | null | undefined,
): string {
  return normalizeWhitespace(
    String(value ?? "")
      .replace(NEWS_RELAY_BYLINE_PATTERN, "")
      .replace(NEWS_RELAY_MENTION_PATTERN, "")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/(?:^|\s)(?:via|from|by)\s*(?=$|[,.])/gi, " ")
      .replace(/^\s*[:;,\-–—]+\s*/, ""),
  );
}

export function getPublicNewsItemDetails(
  item: Pick<
    NewsFeedItemRow,
    "headline" | "blurb" | "metadata" | "category" | "subcategory"
  >,
): string {
  const automation = item.metadata?.automation;
  const summary =
    automation && typeof automation === "object"
      ? (automation as Record<string, unknown>).summary
      : null;
  const category = normalizeNewsCategory(item.category);
  const subcategory = normalizeNewsCategory(item.subcategory);
  const isLineupCard =
    category === "LINEUP" ||
    category === "LINE COMBINATION" ||
    category === "PRACTICE LINES" ||
    subcategory === "LINEUP" ||
    subcategory === "PRACTICE LINES" ||
    subcategory === "FORWARD LINES" ||
    subcategory === "DEFENSE PAIRS";
  const candidates = isLineupCard
    ? [item.blurb, item.headline]
    : [summary, item.blurb, item.headline];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const sanitized = normalizeWhitespace(
      sanitizePublicNewsText(candidate)
        .replace(/^RT\s+@[A-Z0-9_]+:\s*/i, "")
        .replace(/(?:https?:\/\/|pic\.twitter\.com\/)\S+/gi, ""),
    );
    if (sanitized) return sanitized;
  }

  return "News update";
}

function parseTweetUrl(value: string | null | undefined): {
  handle: string | null;
  tweetId: string | null;
} {
  if (!value) return { handle: null, tweetId: null };
  try {
    const url = new URL(value);
    if (!/(?:^|\.)(?:x|twitter)\.com$/i.test(url.hostname)) {
      return { handle: null, tweetId: null };
    }
    const match = url.pathname.match(/^\/([^/]+)\/(?:status|statuses)\/(\d+)/i);
    const handle = match?.[1] && match[1].toLowerCase() !== "i" ? match[1] : null;
    return { handle, tweetId: match?.[2] ?? null };
  } catch {
    return { handle: null, tweetId: null };
  }
}

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstOriginalHandle(
  values: Array<string | null | undefined>,
): string | null {
  for (const value of values) {
    const handle = value?.trim().replace(/^@/, "") || null;
    if (handle && !isNewsRelayAccount(handle) && handle.toLowerCase() !== "i") {
      return handle;
    }
  }
  return null;
}

function safeOriginalSourceUrl(
  value: string | null | undefined,
  originalHandle: string | null,
): string | null {
  if (!value || NEWS_RELAY_MENTION_PATTERN.test(value)) {
    NEWS_RELAY_MENTION_PATTERN.lastIndex = 0;
    return null;
  }
  NEWS_RELAY_MENTION_PATTERN.lastIndex = 0;

  const parsed = parseTweetUrl(value);
  if (parsed.handle && isNewsRelayAccount(parsed.handle)) return null;
  if (!parsed.handle && parsed.tweetId && originalHandle) {
    return `https://x.com/${originalHandle}/status/${parsed.tweetId}`;
  }
  return value;
}

export function getPublicNewsSourceAttribution(args: {
  item: Pick<
    NewsFeedItemRow,
    | "source_label"
    | "source_account"
    | "source_url"
    | "tweet_url"
    | "metadata"
  >;
  provenance?: NewsFeedSourceProvenance | null;
}): PublicNewsSourceAttribution {
  const metadata = args.item.metadata ?? args.provenance?.metadata ?? null;
  const quotedTweetUrl =
    args.provenance?.quoted_tweet_url ??
    readMetadataString(metadata, "quotedTweetUrl");
  const originalHandle = firstOriginalHandle([
    readMetadataString(metadata, "quotedAuthorHandle"),
    parseTweetUrl(quotedTweetUrl).handle,
    args.provenance?.source_handle,
    parseTweetUrl(args.provenance?.source_url).handle,
    parseTweetUrl(args.item.source_url).handle,
    args.item.source_account,
  ]);
  const originalName = [
    readMetadataString(metadata, "quotedAuthorName"),
    args.provenance?.author_name,
  ].find(
    (value) =>
      Boolean(value?.trim()) &&
      !isNewsRelayAccount(value) &&
      sanitizePublicNewsText(value) !== "",
  );
  const urlCandidates = [
    quotedTweetUrl,
    args.provenance?.source_url,
    args.item.source_url,
    args.provenance?.tweet_url,
    args.item.tweet_url,
  ];
  const url =
    urlCandidates
      .map((candidate) => safeOriginalSourceUrl(candidate, originalHandle))
      .find(Boolean) ?? null;

  return {
    displayName: originalName ? sanitizePublicNewsText(originalName) : null,
    account: originalHandle ? `@${originalHandle}` : null,
    url,
  };
}

function sanitizePublicMetadataValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (NEWS_RELAY_MENTION_PATTERN.test(value)) {
      NEWS_RELAY_MENTION_PATTERN.lastIndex = 0;
      if (/^https?:\/\//i.test(value)) return null;
      const sanitized = sanitizePublicNewsText(value);
      return sanitized || null;
    }
    NEWS_RELAY_MENTION_PATTERN.lastIndex = 0;
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map(sanitizePublicMetadataValue)
      .filter((item) => item != null);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, sanitizePublicMetadataValue(item)])
        .filter(([, item]) => item != null),
    );
  }
  return value;
}

export function sanitizePublicNewsFeedItem(
  item: NewsFeedItem,
  provenance?: NewsFeedSourceProvenance | null,
): NewsFeedItem {
  const source = getPublicNewsSourceAttribution({ item, provenance });
  return {
    ...item,
    headline: sanitizePublicNewsText(item.headline),
    blurb: sanitizePublicNewsText(item.blurb),
    source_label: source.displayName,
    source_account: source.account,
    source_url: source.url,
    tweet_url: source.url,
    metadata: sanitizePublicMetadataValue(item.metadata) as Record<
      string,
      unknown
    > | null,
  };
}

export function normalizeNewsText(value: string | null | undefined): string {
  return normalizeWhitespace(String(value ?? ""));
}

export function normalizeNewsCategory(value: string | null | undefined): string {
  return normalizeNewsText(value).replace(/[_-]+/g, " ").toUpperCase();
}

export function formatNewsFeedLabel(value: string | null | undefined): string {
  return normalizeNewsCategory(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function normalizeKeywordScopeKey(args: {
  phrase: string;
  category?: string | null;
  subcategory?: string | null;
}): string {
  const phrase = normalizeNewsText(args.phrase).toLowerCase();
  const category = normalizeNewsCategory(args.category).toLowerCase();
  const subcategory = normalizeNewsCategory(args.subcategory).toLowerCase();
  return [phrase, category, subcategory].join("::");
}

export function getTeamOptions(): TeamOption[] {
  return Object.values(teamsInfo)
    .map((team) => ({
      id: team.id,
      abbreviation: team.abbrev,
      name: team.name,
      shortName: team.shortName,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
      accent: team.accent,
      logoUrl: getTeamLogoSvg(team.abbrev),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getNewsItemTone(category: string | null | undefined): PlayerNewsFlag["tone"] {
  switch (normalizeNewsCategory(category)) {
    case "INJURY":
    case "WAIVER":
      return "danger";
    case "REPORTED INJURY":
      return "warning";
    case "RETURN":
    case "RETURNING":
      return "success";
    case "GOALIE START":
    case "LINE COMBINATION":
    case "LINE CHANGE":
      return "info";
    case "TRANSACTION":
    case "TRADE":
    case "SIGNING":
    case "NEWS UPDATE":
    case "ROSTER MOVE":
      return "warning";
    default:
      return "neutral";
  }
}

export function buildNewsFlagLabel(args: {
  category: string;
  subcategory?: string | null;
}): string {
  const category = formatNewsFeedLabel(args.category);
  const subcategory = formatNewsFeedLabel(args.subcategory);
  return subcategory ? `${category} · ${subcategory}` : category;
}

export function buildNewsFeedHeadline(args: {
  playerNames: string[];
  category?: string | null;
  subcategory?: string | null;
  teamAbbreviation?: string | null;
}): string {
  const category = normalizeNewsCategory(args.category);
  const subcategory = normalizeNewsCategory(args.subcategory);
  const primaryName = args.playerNames.find(Boolean)?.trim() ?? "";
  const team = args.teamAbbreviation?.trim() ?? "";

  if (category === "INJURY" && primaryName) return `${primaryName} injury update`;
  if (category === "REPORTED INJURY" && primaryName) return `${primaryName} reported injury`;
  if (category === "REPORTED INJURY" && team) return `${team} reported injury`;
  if (category === "NEWS UPDATE" && primaryName) return `${primaryName} news update`;
  if (category === "NEWS UPDATE" && team) return `${team} news update`;
  if ((category === "RETURN" || category === "RETURNING") && primaryName) {
    return `${primaryName} return update`;
  }
  if (category === "GOALIE START" && primaryName) return `${primaryName} goalie update`;
  if (category === "LINE COMBINATION" && team) return `${team} line combination update`;
  if (category === "LINE CHANGE" && team) return `${team} line change`;
  if ((category === "TRADE" || category === "SIGNING" || category === "ROSTER MOVE") && primaryName) {
    return `${primaryName} ${category.toLowerCase()}`;
  }
  if (category === "RETIREMENT" && primaryName) return `${primaryName} retires`;
  if (primaryName && category) return `${primaryName} ${category.toLowerCase()}`;
  if (team && category) return `${team} ${category.toLowerCase()}`;
  if (subcategory) return subcategory;
  return "Update";
}

export function getNewsItemTeamColors(teamAbbreviation: string | null | undefined) {
  const team = teamAbbreviation ? teamsInfo[teamAbbreviation as keyof typeof teamsInfo] : null;
  return {
    primary: team?.primaryColor ?? "#14a2d2",
    secondary: team?.secondaryColor ?? "#24282e",
    accent: team?.accent ?? "#14a2d2",
    logoUrl: team ? getTeamLogoSvg(team.abbrev) : fallbackNHLLogo,
    shortName: team?.shortName ?? teamAbbreviation ?? "NHL",
  };
}

export async function fetchNewsFeedItems(args: {
  supabase: any;
  status?: "draft" | "published" | "archived" | "all";
  limit?: number;
  reviewItemId?: string | null;
}): Promise<NewsFeedItem[]> {
  let query = args.supabase
    .from("news_feed_items" as any)
    .select(
      "id, source_review_item_id, source_tweet_id, source_url, tweet_url, source_label, source_account, team_id, team_abbreviation, headline, blurb, category, subcategory, card_status, observed_at, published_at, metadata, created_at, updated_at"
    )
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 100);

  if (args.reviewItemId) {
    query = query.eq("source_review_item_id", args.reviewItemId);
  }
  if (args.status && args.status !== "all") {
    query = query.eq("card_status", args.status);
  }

  const { data: itemRows, error: itemError } = await query;
  if (itemError) throw itemError;

  const items = (itemRows ?? []) as NewsFeedItemRow[];
  if (items.length === 0) return [];

  const reviewItemIds = items
    .map((item) => item.source_review_item_id)
    .filter((id): id is string => Boolean(id));
  const provenanceByReviewItemId = new Map<string, NewsFeedSourceProvenance>();
  if (reviewItemIds.length > 0) {
    const { data: provenanceRows, error: provenanceError } = await args.supabase
      .from("tweet_pattern_review_items" as any)
      .select(
        "id, source_handle, author_name, source_url, tweet_url, quoted_tweet_url, metadata",
      )
      .in("id", reviewItemIds);
    if (provenanceError) throw provenanceError;
    for (const row of (provenanceRows ?? []) as Array<
      NewsFeedSourceProvenance & { id: string }
    >) {
      provenanceByReviewItemId.set(row.id, row);
    }
  }

  const { data: playerRows, error: playerError } = await args.supabase
    .from("news_feed_item_players" as any)
    .select("id, news_item_id, player_id, player_name, team_id, role")
    .in(
      "news_item_id",
      items.map((item) => item.id)
    )
    .order("created_at", { ascending: true });
  if (playerError) throw playerError;

  const playersByItemId = new Map<string, NewsFeedItemPlayer[]>();
  for (const row of (playerRows ?? []) as NewsFeedItemPlayer[]) {
    const bucket = playersByItemId.get(row.news_item_id) ?? [];
    bucket.push(row);
    playersByItemId.set(row.news_item_id, bucket);
  }

  return items.map((item) =>
    sanitizePublicNewsFeedItem(
      {
        ...item,
        players: playersByItemId.get(item.id) ?? [],
      },
      item.source_review_item_id
        ? provenanceByReviewItemId.get(item.source_review_item_id)
        : null,
    ),
  );
}

export async function fetchNewsFeedKeywordPhrases(args: {
  supabase: any;
  reviewItemId?: string | null;
  limit?: number;
}): Promise<NewsFeedKeywordPhrase[]> {
  let query = args.supabase
    .from("news_feed_keyword_phrases" as any)
    .select(
      "id, source_review_item_id, source, phrase, normalized_phrase, scope_key, category, subcategory, notes, status, created_at, updated_at"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 100);

  if (args.reviewItemId) {
    query = query.eq("source_review_item_id", args.reviewItemId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NewsFeedKeywordPhrase[];
}

export async function fetchLatestPlayerNewsFlags(args: {
  supabase: any;
  playerIds: number[];
}): Promise<Map<number, PlayerNewsFlag>> {
  const playerIds = Array.from(new Set(args.playerIds.filter((id) => Number.isFinite(id))));
  if (playerIds.length === 0) return new Map();

  const { data: playerRows, error: playerError } = await args.supabase
    .from("news_feed_item_players" as any)
    .select("news_item_id, player_id")
    .in("player_id", playerIds);
  if (playerError) throw playerError;

  const itemIds = Array.from(
    new Set(
      (playerRows ?? [])
        .map((row: any) => row.news_item_id)
        .filter((value: unknown): value is string => typeof value === "string")
    )
  );
  if (itemIds.length === 0) return new Map();

  const { data: itemRows, error: itemError } = await args.supabase
    .from("news_feed_items" as any)
    .select("id, category, subcategory, headline, source_url, published_at, created_at, card_status")
    .in("id", itemIds)
    .eq("card_status", "published");
  if (itemError) throw itemError;

  const itemById = new Map<string, any>((itemRows ?? []).map((row: any) => [row.id, row]));
  const flags = new Map<number, PlayerNewsFlag>();

  const rows = ((playerRows ?? []) as Array<{ news_item_id: string; player_id: number | null }>).sort(
    (left, right) => {
      const leftItem = itemById.get(left.news_item_id);
      const rightItem = itemById.get(right.news_item_id);
      const leftTime = Date.parse(leftItem?.published_at ?? leftItem?.created_at ?? "");
      const rightTime = Date.parse(rightItem?.published_at ?? rightItem?.created_at ?? "");
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    }
  );

  for (const row of rows) {
    if (!row.player_id || flags.has(row.player_id)) continue;
    const item = itemById.get(row.news_item_id);
    if (!item) continue;
    flags.set(row.player_id, {
      category: item.category,
      subcategory: item.subcategory ?? null,
      label: buildNewsFlagLabel({
        category: item.category,
        subcategory: item.subcategory ?? null,
      }),
      headline: item.headline,
      sourceUrl: item.source_url ?? null,
      publishedAt: item.published_at ?? item.created_at ?? null,
      tone: getNewsItemTone(item.category),
    });
  }

  return flags;
}
